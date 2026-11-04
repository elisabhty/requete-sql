import Foundation
import Capacitor
import WidgetKit

// Le pont entre l’app web et son widget (Elisa, 4 novembre, 3 h 54) : index.html (widgetMaj) appelle
// Capacitor.nativePromise('RequeteWidget', 'maj', { serie, jour, fait, limite }) ; la série est rangée dans le groupe d’apps,
// que le widget (RequeteWidget.swift) relit, puis le widget est redessiné.
@objc(RequeteWidgetPlugin)
public class RequeteWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RequeteWidgetPlugin"
    public let jsName = "RequeteWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "maj", returnType: CAPPluginReturnPromise)
    ]

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
}
