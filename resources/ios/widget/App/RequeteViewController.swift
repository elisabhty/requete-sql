import UIKit
import Capacitor

// Le contrôleur de l’app : celui de Capacitor, plus le pont du widget (RequeteWidgetPlugin), enregistré avant le chargement de la
// page. Main.storyboard le désigne à la place de CAPBridgeViewController (scripts/ios-widget.mjs).
class RequeteViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RequeteWidgetPlugin())
    }
}
