import UIKit
import Capacitor

// Le contrôleur de l’app : celui de Capacitor, plus le pont du widget et des raccourcis (RequeteWidgetPlugin), enregistré avant le
// chargement de la page. Le délégué de scène (SceneDelegate.swift) le crée à la place de CAPBridgeViewController, et Main.storyboard
// le désigne aussi (projets sans délégué de scène) : scripts/ios-widget.mjs.
class RequeteViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RequeteWidgetPlugin())
    }
}
