import Foundation
import UIKit
import Capacitor
import WidgetKit
import ActivityKit

// Le pont entre l’app web et l’iPhone (Elisa, 4 novembre) :
// - le widget (3 h 54) : index.html (widgetMaj) appelle Capacitor.nativePromise('RequeteWidget', 'maj', { serie, jour, fait, limite }) ;
//   la série est rangée dans le groupe d’apps, que le widget (RequeteWidget.swift) relit, puis le widget est redessiné ;
// - les raccourcis de l’icône (9 h 02, « comment avoir ça », d’après Duolingo) : la page les pose (raccourcis), et le raccourci
//   choisi lui revient en événement « raccourci », gardé jusqu’à ce qu’elle l’écoute, même si l’app était fermée ;
// - sous le clavier (11 h 08, « en bas, tu vois du noir sur les deux côtés, je préfère du transparent ») : la page rétrécit au-dessus
//   du clavier (Keyboard « native ») et ses coins arrondis laissaient voir la fenêtre, noire. La page lui donne la couleur de son bas
//   (fond), avant que le clavier s’ouvre ;
// - la Dynamic Island (12 h 35, « tu peux faire une Dynamic Island ») : la leçon en cours, en Live Activity. La page la lance à
//   l’ouverture d’une leçon en vidéo (leconDebut), la met à jour quand la vidéo avance et quand on quitte l’app (leconMaj), et
//   l’arrête à la fin (leconFin) ; son dessin est dans le widget (RequeteWidget.swift, RequeteLeconActivite).

/// Le raccourci choisi sur l’icône : le délégué de scène (SceneDelegate.swift) le range ici, l’app ouverte ou non ;
/// le pont le passe à la page dès qu’il existe.
enum RequeteRaccourci {
    static var enAttente: String?
    static let annonce = Notification.Name("RequeteRaccourci")

    static func recevoir(_ type: String) {
        enAttente = type
        NotificationCenter.default.post(name: annonce, object: nil)
    }
}

@objc(RequeteWidgetPlugin)
public class RequeteWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RequeteWidgetPlugin"
    public let jsName = "RequeteWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "maj", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "raccourcis", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fond", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leconDebut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leconMaj", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "leconFin", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(raccourciRecu), name: RequeteRaccourci.annonce, object: nil)
        raccourciRecu()   // choisi avant que le pont n’existe (app lancée par le raccourci)
        // Une leçon restée dans la Dynamic Island (l’app fermée en pleine leçon) : la page s’ouvre, plus rien n’est en cours.
        if #available(iOS 16.2, *) {
            Task { await RequeteLeconPont.toutArreter() }
        }
    }

    @objc private func raccourciRecu() {
        guard let type = RequeteRaccourci.enAttente else { return }
        RequeteRaccourci.enAttente = nil
        notifyListeners("raccourci", data: ["type": type], retainUntilConsumed: true)
    }

    @objc func maj(_ call: CAPPluginCall) {
        guard let d = UserDefaults(suiteName: "group.fr.requete.app") else {
            call.reject("Groupe d’apps indisponible")
            return
        }
        d.set(max(0, call.getInt("serie") ?? 0), forKey: "serie")
        d.set(call.getString("jour") ?? "", forKey: "jour")
        d.set(call.getBool("fait") ?? false, forKey: "fait")
        d.set(call.getString("limite") ?? "", forKey: "limite")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Les raccourcis de l’icône, quatre au plus : { type, titre, sousTitre, icone (symbole SF) }.
    @objc func raccourcis(_ call: CAPPluginCall) {
        let items: [UIApplicationShortcutItem] = (call.getArray("items", JSObject.self) ?? []).prefix(4).compactMap { (r: JSObject) -> UIApplicationShortcutItem? in
            guard let type = r["type"] as? String, let titre = r["titre"] as? String else { return nil }
            let icone = (r["icone"] as? String).map { UIApplicationShortcutIcon(systemImageName: $0) }
            return UIApplicationShortcutItem(type: type, localizedTitle: titre, localizedSubtitle: r["sousTitre"] as? String, icon: icone, userInfo: nil)
        }
        DispatchQueue.main.async {
            UIApplication.shared.shortcutItems = items
            call.resolve()
        }
    }

    /// La couleur de la fenêtre, derrière la page : « #RRGGBB » (celle du bas de la page, que le clavier laisse voir dans ses coins).
    @objc func fond(_ call: CAPPluginCall) {
        guard let couleur = UIColor(requeteHex: call.getString("couleur") ?? "") else {
            call.reject("Couleur attendue : #RRGGBB")
            return
        }
        DispatchQueue.main.async {
            self.bridge?.viewController?.view.window?.backgroundColor = couleur
            call.resolve()
        }
    }

    /// La leçon s’ouvre : { titre, module, progression (0 à 1), allumee }. Répond { ok } (faux si les Live Activities sont coupées).
    @objc func leconDebut(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        let titre = call.getString("titre") ?? "Leçon"
        let module = call.getString("module") ?? ""
        let etat = RequeteLeconPont.etat(progression: call.getDouble("progression"), allumee: call.getBool("allumee"), fini: false)
        Task {
            let ok = await RequeteLeconPont.debut(titre: titre, module: module, etat: etat)
            call.resolve(["ok": ok])
        }
    }

    /// La leçon avance : { progression, allumee }.
    @objc func leconMaj(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let etat = RequeteLeconPont.etat(progression: call.getDouble("progression"), allumee: call.getBool("allumee"), fini: false)
        Task {
            await RequeteLeconPont.maj(etat)
            call.resolve()
        }
    }

    /// La leçon se ferme : { fini, allumee }. Réussie, elle reste un quart d’heure sur l’écran verrouillé, la flamme dorée ;
    /// sinon, elle s’en va tout de suite.
    @objc func leconFin(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let fini = call.getBool("fini") ?? false
        let allumee = call.getBool("allumee") ?? fini
        Task {
            await RequeteLeconPont.fin(reussie: fini, allumee: allumee)
            call.resolve()
        }
    }
}

// MARK: - La leçon en cours (Live Activity)

/// Le même type, au même nom et aux mêmes champs, est déclaré dans le widget (RequeteWidget.swift) : iOS relie la Live Activity
/// lancée par l’app à son dessin là-bas par ce nom.
@available(iOS 16.1, *)
struct RequeteLecon: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var progression: Double   // de 0 à 1 : l’avancement de la vidéo
        var allumee: Bool         // la flamme du jour est déjà allumée (une séance faite aujourd’hui)
        var fini: Bool            // la leçon est réussie
    }

    var titre: String
    var module: String
}

/// Une seule leçon à la fois ; une heure sans nouvelles et iOS la montre comme passée.
@available(iOS 16.2, *)
enum RequeteLeconPont {
    static func etat(progression: Double?, allumee: Bool?, fini: Bool) -> RequeteLecon.ContentState {
        RequeteLecon.ContentState(progression: min(1, max(0, progression ?? 0)), allumee: allumee ?? false, fini: fini)
    }

    static func debut(titre: String, module: String, etat: RequeteLecon.ContentState) async -> Bool {
        await toutArreter()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        do {
            _ = try Activity<RequeteLecon>.request(
                attributes: RequeteLecon(titre: titre, module: module),
                content: ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)),
                pushType: nil
            )
            return true
        } catch {
            return false
        }
    }

    static func maj(_ etat: RequeteLecon.ContentState) async {
        for a in Activity<RequeteLecon>.activities {
            await a.update(ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)))
        }
    }

    static func fin(reussie: Bool, allumee: Bool) async {
        for a in Activity<RequeteLecon>.activities {
            let p = reussie ? 1 : a.content.state.progression
            let dernier = ActivityContent(state: RequeteLecon.ContentState(progression: p, allumee: allumee, fini: reussie), staleDate: nil)
            await a.end(dernier, dismissalPolicy: reussie ? .after(Date().addingTimeInterval(15 * 60)) : .immediate)
        }
    }

    static func toutArreter() async {
        for a in Activity<RequeteLecon>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}

extension UIColor {
    /// « #4529CC » ou « 4529CC » ; nil sinon.
    convenience init?(requeteHex hex: String) {
        let s = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}
