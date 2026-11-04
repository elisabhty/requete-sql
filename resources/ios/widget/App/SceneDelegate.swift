import UIKit
import Capacitor

// Le délégué de scène du modèle de Capacitor 8.6, recopié à sa place par scripts/ios-widget.mjs (l’original est gardé à côté :
// SceneDelegate.swift.avant-requete), avec deux changements :
// - le contrôleur de l’app est RequeteViewController, qui enregistre le pont du widget et des raccourcis (RequeteWidgetPlugin).
//   Capacitor crée ici même un CAPBridgeViewController, sans passer par Main.storyboard : sans ce changement, le pont n’existait pas ;
// - les raccourcis de l’icône (appui long sur l’icône de l’app, comme Duolingo : « Tu supprimes Requête ? », « Fais une petite
//   requête ! ») arrivent ici, l’app déjà ouverte (windowScene(_:performActionFor:)) ou lancée par le raccourci (connectionOptions).
//   RequeteRaccourci les passe à la page (RequeteWidgetPlugin.swift).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // Derrière la page (sous les coins arrondis du clavier) : le fond de l’app plutôt que du noir ; la page le change ensuite
        // selon ce qu’elle montre (RequeteWidgetPlugin.fond).
        window?.backgroundColor = UIColor(requeteHex: "#F4F2FC")
        window?.rootViewController = RequeteViewController()
        window?.makeKeyAndVisible()

        if let raccourci = connectionOptions.shortcutItem {
            RequeteRaccourci.recevoir(raccourci.type)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        RequeteRaccourci.recevoir(shortcutItem.type)
        completionHandler(true)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
