import Foundation
import UIKit
import Capacitor
import WidgetKit
import ActivityKit

// Le pont entre l’app web et l’iPhone (Elisa, 4 novembre) :
// - le widget (3 h 54) : index.html (widgetMaj) appelle Capacitor.nativePromise('RequeteWidget', 'maj', { serie, jour, fait, limite }) ;
//   la série est rangée dans le groupe d’apps, que le widget (RequeteWidget.swift) relit, puis le widget est redessiné. 7 novembre
//   (« Cheminée + lunettes ») : la cheminée y lit aussi les stickers gagnés, les défis réussis, les modules finis, la prochaine
//   activité (titre, mot-clé de sa carte mémo, défi ou non) et la dernière carte mémo gagnée ; la requête de poche, ses questions
//   du jour ; la carte mémo, les cartes gagnées ; ta semaine, ses jours actifs et ses jours de repos ;
// - les raccourcis de l’icône (9 h 02, « comment avoir ça », d’après Duolingo) : la page les pose (raccourcis), et le raccourci
//   choisi lui revient en événement « raccourci », gardé jusqu’à ce qu’elle l’écoute, même si l’app était fermée ;
// - sous le clavier (11 h 08, « en bas, tu vois du noir sur les deux côtés, je préfère du transparent ») : la page rétrécit au-dessus
//   du clavier (Keyboard « native ») et ses coins arrondis laissaient voir la fenêtre, noire. La page lui donne la couleur de son bas
//   (fond), avant que le clavier s’ouvre ;
// - la Dynamic Island (12 h 35, « tu peux faire une Dynamic Island ») : la leçon en cours, en Live Activity. La page la lance à
//   l’ouverture d’une leçon en vidéo (leconDebut), la met à jour quand la vidéo avance et quand on quitte l’app (leconMaj), et
//   l’arrête à la fin (leconFin) ; son dessin est dans le widget (RequeteWidget.swift, RequeteLeconActivite). 5 novembre, 6 h 45 :
//   les moments réussis (« 2/4 ») ; un moment réussi de plus, le nouveau compte arrive une seconde après qu’on a quitté l’app,
//   quand la Dynamic Island est à l’écran : le chiffre roule sous les yeux (anime).
// - la sauvegarde (22 h 08, « une interaction qui dit fichier exporté alors qu’on a juste cliqué ») : partager écrit le fichier de
//   sauvegarde et ouvre la feuille de partage d’iOS ; la page n’annonce la sauvegarde qu’une fois le fichier parti ;
// - « Noter Requête » (22 h 08) : ouvrir passe la page « Écrire un avis » de l’App Store au système.

/// Le raccourci choisi sur l’icône : le délégué de scène (SceneDelegate.swift) le range ici, l’app ouverte ou non ;
/// le pont le passe à la page dès qu’il existe.
enum RequeteRaccourci {
    static var enAttente: String?
    static let annonce = Notification.Name("RequeteRaccourci")

    static func recevoir(_ type: String) {
        enAttente = type
        NotificationCenter.default.post(name: annonce, object: nil)
    }

    /// Un lien de Requête (le bouton « Allumer ma flamme » du widget La cheminée, 7 novembre) : son hôte devient un raccourci,
    /// « seance » donne « fr.requete.app.seance ». La page ignore ce qu’elle ne connaît pas (index.html, raccourciOuvrir).
    static func ouvrir(_ lien: URL) {
        guard lien.scheme == "requete", let hote = lien.host, !hote.isEmpty else { return }
        recevoir("fr.requete.app." + hote)
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
        CAPPluginMethod(name: "leconFin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "partager", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ouvrir", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(raccourciRecu), name: RequeteRaccourci.annonce, object: nil)
        raccourciRecu()   // choisi avant que le pont n’existe (app lancée par le raccourci)
        // Une leçon restée dans la Dynamic Island (l’app fermée en pleine leçon) : la page s’ouvre, plus rien n’est en cours. La carte
        // d’une leçon réussie (la flamme dorée, un quart d’heure sur l’écran verrouillé) reste jusqu’au bout.
        if #available(iOS 16.2, *) {
            Task { await RequeteLeconPont.arreterEnCours() }
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
        // La cheminée (RequeteWidget.swift, ChemineeFournisseur)
        d.set(max(0, call.getInt("stickers") ?? 0), forKey: "stickers")
        d.set(max(0, call.getInt("trophees") ?? 0), forKey: "trophees")
        d.set(max(0, call.getInt("diplomes") ?? 0), forKey: "diplomes")
        d.set(call.getString("prochaine") ?? "", forKey: "prochaine")
        d.set(call.getString("cle") ?? "", forKey: "cle")
        d.set(call.getBool("defi") ?? false, forKey: "defi")
        d.set(call.getString("carte") ?? "", forKey: "carte")
        // La requête de poche (RequeteWidget.swift, PocheRangement) : les questions du jour, en JSON. Une nouvelle série repart de
        // sa première question ; la même (l’app la renvoie en partant) laisse le widget où il en est.
        let poche: String = call.getString("poche") ?? "[]"
        if poche != (d.string(forKey: "poche") ?? "") {
            d.set(poche, forKey: "poche")
            d.set(0, forKey: "pocheIndex")
            d.set(-1, forKey: "pocheChoix")
        }
        // La carte mémo (RequeteWidget.swift, CartesRangement) : les cartes gagnées, en JSON. Leur rythme de révision vit dans le
        // widget (« cartesRythme ») et ne change pas quand l’app range de nouveau les cartes.
        d.set(call.getString("cartes") ?? "[]", forKey: "cartes")
        // Ta semaine (RequeteWidget.swift, SemaineRangement) : les jours actifs, les jours de repos du planning, le premier jour.
        d.set(call.getString("semaine") ?? "", forKey: "semaine")
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

    /// La leçon s’ouvre : { titre, module, progression (0 à 1), allumee, reussis, moments, objectif }. Répond { ok } (faux si les
    /// Live Activities sont coupées).
    @objc func leconDebut(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        let titre = call.getString("titre") ?? "Leçon"
        let module = call.getString("module") ?? ""
        let base = RequeteLeconPont.etat(progression: call.getDouble("progression"), allumee: call.getBool("allumee"), fini: false)
        let etat: RequeteLecon.ContentState = RequeteLeconPont.moments(base, call)
        Task {
            let ok = await RequeteLeconPont.debut(titre: titre, module: module, etat: etat)
            call.resolve(["ok": ok])
        }
    }

    /// La leçon avance : { progression, allumee, reussis, moments, objectif, anime }. anime : on vient de quitter l’app avec un moment
    /// réussi de plus (RequeteLeconPont.maj).
    @objc func leconMaj(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let base = RequeteLeconPont.etat(progression: call.getDouble("progression"), allumee: call.getBool("allumee"), fini: false)
        let etat: RequeteLecon.ContentState = RequeteLeconPont.moments(base, call)
        let anime: Bool = call.getBool("anime") ?? false
        Task {
            await RequeteLeconPont.maj(etat, anime: anime)
            call.resolve()
        }
    }

    /// La leçon se ferme : { fini, allumee, reussis }. Réussie, elle reste un quart d’heure sur l’écran verrouillé, la flamme dorée,
    /// avec ses moments réussis ; sinon, elle s’en va tout de suite.
    @objc func leconFin(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let fini = call.getBool("fini") ?? false
        let allumee = call.getBool("allumee") ?? fini
        let reussis: Int? = call.getInt("reussis")
        Task {
            await RequeteLeconPont.fin(reussie: fini, allumee: allumee, reussis: reussis)
            call.resolve()
        }
    }

    /// La sauvegarde : { nom, texte }. Le fichier est écrit dans le dossier temporaire, puis la feuille de partage d’iOS s’ouvre
    /// (Enregistrer dans Fichiers, AirDrop, Mail…). Répond { ok, type } : ok est faux si la personne a fermé la feuille sans rien faire.
    @objc func partager(_ call: CAPPluginCall) {
        guard let texte = call.getString("texte") else {
            call.reject("Rien à partager")
            return
        }
        let nom = (call.getString("nom") ?? "requete-sauvegarde.json").replacingOccurrences(of: "/", with: "-")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(nom)
        do {
            try texte.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            call.reject("Le fichier n’a pas pu être écrit")
            return
        }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("Aucune fenêtre pour partager")
                return
            }
            let feuille = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            feuille.completionWithItemsHandler = { type, fait, _, _ in
                call.resolve(["ok": fait, "type": type?.rawValue ?? ""])
            }
            if let pop = feuille.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            vc.present(feuille, animated: true)
        }
    }

    /// Une adresse que la page ne peut pas ouvrir elle-même (itms-apps:// pour l’App Store) : { url }. Répond { ok }.
    @objc func ouvrir(_ call: CAPPluginCall) {
        guard let texte = call.getString("url"), let url = URL(string: texte) else {
            call.reject("Adresse invalide")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { ok in
                call.resolve(["ok": ok])
            }
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
        var reussis: Int? = nil   // les moments « À toi » réussis du premier coup (5 novembre, 6 h 45 : « 2/4 »)
        var moments: Int? = nil   // les moments de la leçon
        var objectif: Int? = nil  // les moments à réussir pour valider la leçon
    }

    var titre: String
    var module: String
}

/// Une tâche de fond, le temps d’une mise à jour : l’app vient de passer en arrière-plan, iOS la laisse finir (une seconde, au
/// plus quelques-unes ; à l’expiration, elle s’arrête d’elle-même).
final class RequeteTacheDeFond {
    private var id: UIBackgroundTaskIdentifier = .invalid

    func debut() {
        DispatchQueue.main.async {
            guard self.id == .invalid else { return }
            self.id = UIApplication.shared.beginBackgroundTask(withName: "RequeteLecon") { [weak self] in
                self?.fin()
            }
        }
    }

    func fin() {
        DispatchQueue.main.async {
            guard self.id != .invalid else { return }
            UIApplication.shared.endBackgroundTask(self.id)
            self.id = .invalid
        }
    }
}

/// Une seule leçon à la fois ; une heure sans nouvelles et iOS la montre comme passée.
@available(iOS 16.2, *)
enum RequeteLeconPont {
    static func etat(progression: Double?, allumee: Bool?, fini: Bool) -> RequeteLecon.ContentState {
        let brute: Double = progression ?? 0
        let p: Double = min(1, max(0, brute))
        return RequeteLecon.ContentState(progression: p, allumee: allumee ?? false, fini: fini)
    }

    /// Les moments de la leçon, quand la page les donne : { reussis, moments, objectif }.
    static func moments(_ etat: RequeteLecon.ContentState, _ call: CAPPluginCall) -> RequeteLecon.ContentState {
        guard let n = call.getInt("moments"), n > 0 else { return etat }
        let r: Int = call.getInt("reussis") ?? 0
        let but: Int = call.getInt("objectif") ?? n
        var e: RequeteLecon.ContentState = etat
        e.moments = n
        e.reussis = min(n, max(0, r))
        e.objectif = min(n, max(1, but))
        return e
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

    /// 5 novembre, 6 h 45 : on quitte l’app avec un moment réussi de plus (anime). La Dynamic Island apparaît d’abord avec l’ancien
    /// compte ; le nouveau arrive une seconde après, quand elle est à l’écran : le chiffre roule, la case se remplit. Une tâche de fond
    /// garde l’app éveillée le temps de cette seconde.
    static func maj(_ etat: RequeteLecon.ContentState, anime: Bool) async {
        let fond = RequeteTacheDeFond()
        if anime { fond.debut() }
        for a in Activity<RequeteLecon>.activities {
            let avant: Int? = a.content.state.reussis
            if anime, let ancien = avant, ancien != etat.reussis {
                var attente: RequeteLecon.ContentState = etat
                attente.reussis = ancien
                await a.update(ActivityContent(state: attente, staleDate: Date().addingTimeInterval(3600)))
                try? await Task.sleep(nanoseconds: 1_100_000_000)
            }
            await a.update(ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)))
        }
        if anime { fond.fin() }
    }

    static func fin(reussie: Bool, allumee: Bool, reussis: Int?) async {
        for a in Activity<RequeteLecon>.activities {
            let p: Double = reussie ? 1 : a.content.state.progression
            var bilan: RequeteLecon.ContentState = a.content.state
            bilan.progression = p
            bilan.allumee = allumee
            bilan.fini = reussie
            if let r = reussis, let n = bilan.moments { bilan.reussis = min(n, max(0, r)) }
            let dernier = ActivityContent(state: bilan, staleDate: nil)
            let politique: ActivityUIDismissalPolicy = reussie ? .after(Date().addingTimeInterval(15 * 60)) : .immediate
            await a.end(dernier, dismissalPolicy: politique)
        }
    }

    static func toutArreter() async {
        for a in Activity<RequeteLecon>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }

    static func arreterEnCours() async {
        for a in Activity<RequeteLecon>.activities where !a.content.state.fini {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}

extension UIColor {
    /// « #4529CC » ou « 4529CC » ; nil sinon. Les trois composantes sont calculées d’abord, chacune avec son type (4 novembre,
    /// 16 h 28 : une seule expression trop longue suffit à faire échouer l’archive, voir la bulle du widget).
    convenience init?(requeteHex hex: String) {
        let s = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        let rouge: CGFloat = CGFloat((v >> 16) & 0xFF) / 255
        let vert: CGFloat = CGFloat((v >> 8) & 0xFF) / 255
        let bleu: CGFloat = CGFloat(v & 0xFF) / 255
        self.init(red: rouge, green: vert, blue: bleu, alpha: 1)
    }
}
