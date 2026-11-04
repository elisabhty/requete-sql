import Foundation
import UIKit
import Capacitor
import WidgetKit

// Le pont entre l’app web et l’iPhone (Elisa, 4 novembre) :
// - le widget (3 h 54) : index.html (widgetMaj) appelle Capacitor.nativePromise('RequeteWidget', 'maj', { serie, jour, fait, limite }) ;
//   la série est rangée dans le groupe d’apps, que le widget (RequeteWidget.swift) relit, puis le widget est redessiné ;
// - les raccourcis de l’icône (9 h 02, « comment avoir ça », d’après Duolingo) : la page les pose (raccourcis), et le raccourci
//   choisi lui revient en événement « raccourci », gardé jusqu’à ce qu’elle l’écoute, même si l’app était fermée ;
// - sous le clavier (11 h 08, « en bas, tu vois du noir sur les deux côtés, je préfère du transparent ») : la page rétrécit au-dessus
//   du clavier (Keyboard « native ») et ses coins arrondis laissaient voir la fenêtre, noire. La page lui donne la couleur de son bas
//   (fond), avant que le clavier s’ouvre.

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
        CAPPluginMethod(name: "fond", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(raccourciRecu), name: RequeteRaccourci.annonce, object: nil)
        raccourciRecu()   // choisi avant que le pont n’existe (app lancée par le raccourci)
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
}

extension UIColor {
    /// « #4529CC » ou « 4529CC » ; nil sinon.
    convenience init?(requeteHex hex: String) {
        let s = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
        self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
    }
}
