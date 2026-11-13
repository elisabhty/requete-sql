import Foundation
import UIKit
import Capacitor
import WidgetKit
import ActivityKit
import UserNotifications
import StoreKit

// Le pont entre l’app web et l’iPhone (Elisa, 4 novembre) :
// - le widget (3 h 54) : index.html (widgetMaj) appelle Capacitor.nativePromise('RequeteWidget', 'maj', { serie, jour, fait, limite }) ;
//   la série est rangée dans le groupe d’apps, que le widget (RequeteWidget.swift) relit, puis le widget est redessiné. 7 novembre
//   (« Cheminée + lunettes ») : la cheminée y lit aussi les stickers gagnés, les défis réussis, les modules finis, la prochaine
//   activité (titre, mot-clé de sa carte mémo, défi ou non) et la dernière carte mémo gagnée ; la requête de poche, ses questions
//   du jour ; ta semaine, ses jours actifs et ses jours de repos ;
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

/// Le jeton de push d’Apple : l’AppDelegate le reçoit (didRegisterForRemoteNotificationsWithDeviceToken, branché par
/// scripts/ios-widget.mjs) et le passe par la notification de Capacitor (.capacitorDidRegisterForRemoteNotifications) ; on le
/// garde et on le rend à qui l’attend. Pas de réponse d’Apple en 10 secondes : le dernier connu (ou rien).
enum RequetePush {
    static var dernier: String?
    static var attentes: [(String?) -> Void] = []
    static var observe = false

    static func jeton(_ fini: @escaping (String?) -> Void) {
        DispatchQueue.main.async {
            if !observe {
                observe = true
                NotificationCenter.default.addObserver(forName: .capacitorDidRegisterForRemoteNotifications, object: nil, queue: .main) { n in
                    if let d = n.object as? Data { dernier = d.map { String(format: "%02x", $0) }.joined() }
                    rendre()
                }
                NotificationCenter.default.addObserver(forName: .capacitorDidFailToRegisterForRemoteNotifications, object: nil, queue: .main) { _ in
                    rendre()
                }
            }
            attentes.append(fini)
            UIApplication.shared.registerForRemoteNotifications()
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { rendre() }
        }
    }

    private static func rendre() {
        let a = attentes
        attentes = []
        a.forEach { $0(dernier) }
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
        CAPPluginMethod(name: "ouvrir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flammeProgrammer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flammeAllumee", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flammeArreter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salleDebut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salleMaj", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "salleFin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "partagerTexte", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accueilDebut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accueilMaj", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accueilFin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notifAutoriser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notifJeton", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abonnementGerer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "noter", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(raccourciRecu), name: RequeteRaccourci.annonce, object: nil)
        raccourciRecu()   // choisi avant que le pont n’existe (app lancée par le raccourci)
        // Une leçon restée dans la Dynamic Island (l’app fermée en pleine leçon) : la page s’ouvre, plus rien n’est en cours. La carte
        // d’une leçon réussie (la flamme dorée, un quart d’heure sur l’écran verrouillé) reste jusqu’au bout.
        if #available(iOS 16.2, *) {
            Task { await RequeteLeconPont.arreterEnCours() }
        }
        // Ta flamme en direct d’un soir passé (minuit est passé, l’app n’a pas été ouverte depuis) : elle s’en va.
        if #available(iOS 16.2, *) {
            Task { await RequeteFlammePont.nettoyer() }
        }
        // La salle dans l’île restée d’avant (l’app relancée) : la page la rouvre si elle reprend la salle. Le podium reste.
        if #available(iOS 16.2, *) {
            Task { await RequeteSallePont.arreterEnCours() }
        }
        // L’onboarding resté dans l’île (l’app fermée en plein onboarding) : la page la relance si l’onboarding reprend. Le parcours
        // prêt (les étoiles plein les yeux, cinq minutes sur l’écran verrouillé) reste jusqu’au bout.
        if #available(iOS 16.2, *) {
            Task { await RequeteAccueilPont.arreterEnCours() }
        }
        // Le petit miaou de la salle dans l’île (les alertes poussées par le serveur), rangé là où iOS le cherche.
        RequeteSon.installer()
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
            // 10 novembre, 8 h 24 (« quand on appuie sur la flèche, on a la même question ») : une série rangée de nouveau garde la
            // question du moment si elle y est encore, au lieu de repartir de la première.
            let rang: Int = RequetePocheSuite.rang(ancienne: d.string(forKey: "poche"), index: d.integer(forKey: "pocheIndex"), nouvelle: poche)
            d.set(poche, forKey: "poche")
            d.set(rang, forKey: "pocheIndex")
            if rang == 0 {
                d.set(-1, forKey: "pocheChoix")
            }
        }
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
    /// Les notifications (Elisa, 11 novembre, 15 h 55 : « M’avertir au lancement » en vraie notification push). notifAutoriser :
    /// iOS demande l’autorisation (une seule fois, quand on active l’alerte d’un parcours), puis l’app s’inscrit aux push d’Apple ;
    /// notifJeton : sans rien demander, le jeton si c’est déjà autorisé (à chaque ouverture, il peut changer). Répond { autorise,
    /// refuse, jeton } : jeton en hexadécimal (vide si Apple ne l’a pas donné à temps) ; refuse, si les notifications sont coupées.
    @objc func notifAutoriser(_ call: CAPPluginCall) { notif(call, demander: true) }
    @objc func notifJeton(_ call: CAPPluginCall) { notif(call, demander: false) }

    private func notif(_ call: CAPPluginCall, demander: Bool) {
        let centre = UNUserNotificationCenter.current()
        let rendre: (Bool, Bool) -> Void = { autorise, refuse in
            if autorise {
                RequetePush.jeton { jeton in call.resolve(["autorise": true, "refuse": false, "jeton": jeton ?? ""]) }
            } else {
                call.resolve(["autorise": false, "refuse": refuse, "jeton": ""])
            }
        }
        centre.getNotificationSettings { reglages in
            switch reglages.authorizationStatus {
            case .authorized, .provisional:
                rendre(true, false)
            case .notDetermined:
                guard demander else { rendre(false, false); return }
                centre.requestAuthorization(options: [.alert, .sound, .badge]) { ok, _ in rendre(ok, !ok) }
            case .denied:
                rendre(false, true)
            default:
                rendre(false, false)
            }
        }
    }

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

    /// Ta flamme en direct (7 novembre) : { jours: [{ jour, debut, minuit (en millisecondes), titre, action, nouvelle, alerteTitre,
    /// alerteTexte }] }, les prochains soirs de séance pas encore faits (index.html, flammeDirectJours). Répond { ok, auto, jours } :
    /// ok est faux si les Live Activities sont coupées ; auto, iOS 26 et plus (iOS la démarre tout seul à l’heure dite, l’app
    /// fermée) ; jours, les soirs qui ont leur flamme, programmée ou en cours.
    @objc func flammeProgrammer(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false, "auto": false, "jours": [String]()])
            return
        }
        let brutes: [JSObject] = call.getArray("jours", JSObject.self) ?? []
        let demandes: [RequeteFlammeDemande] = brutes.compactMap { (r: JSObject) -> RequeteFlammeDemande? in
            RequeteFlammeDemande(r)
        }
        Task {
            let jours: [String] = await RequeteFlammePont.programmer(demandes)
            let ok: Bool = ActivityAuthorizationInfo().areActivitiesEnabled
            call.resolve(["ok": ok, "auto": RequeteFlammePont.auto, "jours": jours])
        }
    }

    /// La flamme du jour vient de s’allumer : { jour, discret } (discret : une leçon est dans la Dynamic Island, elle le dit déjà).
    @objc func flammeAllumee(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let jour: String = call.getString("jour") ?? ""
        let discret: Bool = call.getBool("discret") ?? false
        Task {
            await RequeteFlammePont.allumee(jour: jour, discret: discret)
            call.resolve()
        }
    }

    /// Coupée dans Mon compte : plus rien, ni en cours ni programmé. Répond comme flammeProgrammer, sans soir.
    @objc func flammeArreter(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": true, "auto": false, "jours": [String]()])
            return
        }
        Task {
            await RequeteFlammePont.toutArreter()
            call.resolve(["ok": true, "auto": RequeteFlammePont.auto, "jours": [String]()])
        }
    }

    /// La salle dans l’île (7 novembre) : une salle entre amis s’ouvre, { code, moi, max, etat (JSON) }. Répond { ok } (faux si les
    /// Live Activities sont coupées). Le jeton de push de l’activité arrive ensuite, en événement « salleJeton » : { code, jeton }.
    @objc func salleDebut(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        guard let code = call.getString("code"), let moi = call.getString("moi"), let etat = RequeteSallePont.etat(call.getString("etat")) else {
            call.reject("Salle incomplète")
            return
        }
        let places: Int = call.getInt("max") ?? 6   // six joueurs par salle (8 novembre, 22 h 27) ; 1 pour une partie seule
        let push: Bool = call.getBool("push") ?? true   // une partie seule (10 novembre) : pas de jeton, personne d’autre à prévenir
        Task {
            let ok: Bool = await RequeteSallePont.debut(code: code, moi: moi, max: places, etat: etat, push: push) { [weak self] jeton in
                DispatchQueue.main.async {
                    self?.notifyListeners("salleJeton", data: ["code": code, "jeton": jeton], retainUntilConsumed: true)
                }
            }
            call.resolve(["ok": ok])
        }
    }

    /// La salle change, l’app ouverte : { etat (JSON) }.
    @objc func salleMaj(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        guard let etat = RequeteSallePont.etat(call.getString("etat")) else {
            call.reject("État illisible")
            return
        }
        Task {
            await RequeteSallePont.maj(etat)
            call.resolve()
        }
    }

    /// Le podium, ou on quitte la salle : { etat (JSON, facultatif), garder }. garder : le podium reste un quart d’heure sur l’écran
    /// verrouillé ; sinon, l’activité s’en va tout de suite.
    @objc func salleFin(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let etat: RequeteSalle.ContentState? = RequeteSallePont.etat(call.getString("etat"))
        let garder: Bool = call.getBool("garder") ?? false
        Task {
            await RequeteSallePont.fin(etat, garder: garder)
            call.resolve()
        }
    }

    /// L’onboarding s’ouvre : { etape, total, titre, bonjour, minutes }. Répond { ok } (faux si les Live Activities sont coupées).
    @objc func accueilDebut(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        let etat: RequeteAccueil.ContentState = RequeteAccueilPont.etat(call, fini: false)
        Task {
            let ok: Bool = await RequeteAccueilPont.debut(etat)
            call.resolve(["ok": ok])
        }
    }

    /// Une autre page de l’onboarding : { etape, total, titre, bonjour, minutes }.
    @objc func accueilMaj(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let etat: RequeteAccueil.ContentState = RequeteAccueilPont.etat(call, fini: false)
        Task {
            await RequeteAccueilPont.maj(etat)
            call.resolve()
        }
    }

    /// L’onboarding se ferme : { fini }. Fini, le parcours prêt reste cinq minutes sur l’écran verrouillé, les étoiles plein les
    /// yeux du chat ; sinon, l’activité s’en va tout de suite.
    @objc func accueilFin(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        let fini: Bool = call.getBool("fini") ?? false
        Task {
            await RequeteAccueilPont.fin(fini: fini)
            call.resolve()
        }
    }

    /// « Partager », depuis l’île : { texte, url }. La feuille de partage d’iOS (la page, ouverte par un lien et non par un geste,
    /// ne peut pas appeler navigator.share). Répond { ok }.
    @objc func partagerTexte(_ call: CAPPluginCall) {
        let texte: String = call.getString("texte") ?? ""
        var objets: [Any] = [texte]
        if let lien = call.getString("url"), let url = URL(string: lien) {
            objets.append(url)
        }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("Aucune fenêtre pour partager")
                return
            }
            let feuille = UIActivityViewController(activityItems: objets, applicationActivities: nil)
            feuille.completionWithItemsHandler = { _, fait, _, _ in
                call.resolve(["ok": fait])
            }
            if let pop = feuille.popoverPresentationController {
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.maxY - 80, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            vc.present(feuille, animated: true)
        }
    }

    /// « Gérer mon abonnement », dans Mon compte (12 novembre, 21 h 42) : la feuille d’Apple (changer d’offre, annuler), sans
    /// quitter l’app. C’est aussi le seul moyen d’annuler un abonnement de test pris dans TestFlight. Répond { ok } quand elle se
    /// referme ; ok est faux si elle n’a pas pu s’ouvrir (la page ouvre alors les abonnements de l’App Store).
    @objc func abonnementGerer(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.resolve(["ok": false])
            return
        }
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.resolve(["ok": false])
                return
            }
            Task { @MainActor in
                do {
                    try await AppStore.showManageSubscriptions(in: scene)
                    call.resolve(["ok": true])
                } catch {
                    call.resolve(["ok": false])
                }
            }
        }
    }

    /// Noter l’app, à la demande d’iOS (Elisa, 13 novembre, 1 h 02 : « une notif Apple de noter l’application après le premier
    /// cours ») : la petite fenêtre aux cinq étoiles d’Apple, par-dessus l’app. iOS décide seul de la montrer (trois fois par an au
    /// plus pour une même personne, jamais dans une version TestFlight) et ne dit pas si elle est apparue : { ok } veut seulement
    /// dire que la demande est passée.
    @objc func noter(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.resolve(["ok": false])
                return
            }
            Task { @MainActor in
                if #available(iOS 16.0, *) {
                    AppStore.requestReview(in: scene)
                } else {
                    SKStoreReviewController.requestReview(in: scene)
                }
                call.resolve(["ok": true])
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
        var pause: Bool? = nil    // la vidéo est en pause (10 novembre) : « Reprendre » dans l’île et sur l’écran verrouillé
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
        var e: RequeteLecon.ContentState = etat
        e.pause = call.getBool("pause")   // la vidéo en pause (10 novembre) : « Reprendre » dans l’île
        guard let n = call.getInt("moments"), n > 0 else { return e }
        let r: Int = call.getInt("reussis") ?? 0
        let but: Int = call.getInt("objectif") ?? n
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

// MARK: - L’onboarding en cours (Live Activity)
//
// Elisa, 10 novembre, 7 h 33 (capture de la Dynamic Island d’une autre app) : « En plein onboarding, fais la même chose pour
// Requête avec les yeux du chat. » La page la lance sur l’accueil de l’onboarding (accueilDebut), la met à jour à chaque page
// (accueilMaj) et l’arrête à la fin (accueilFin) ; son dessin est dans le widget (RequeteWidget.swift, RequeteAccueilIle).

/// Le même type, au même nom et aux mêmes champs, est déclaré dans le widget (RequeteWidget.swift) : iOS relie la Live Activity
/// lancée par l’app à son dessin là-bas par ce nom.
@available(iOS 16.1, *)
struct RequeteAccueil: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var etape: Int        // l’étape de l’onboarding : 0 sur l’accueil, total sur le parcours prêt
        var total: Int        // les étapes du tunnel (« Étape 3 sur 18 »)
        var titre: String     // ce que demande la page (« Ton niveau »)
        var bonjour: String   // « Bienvenue, Elisa », ou « Bienvenue sur Requête » avant le prénom
        var minutes: Int      // le temps qui reste, comme l’en-tête de l’onboarding ; 0 sur le parcours prêt
        var fini: Bool        // l’onboarding est terminé : le parcours est prêt
    }

    var app: String
}

/// Un seul onboarding à la fois ; une heure sans nouvelles et iOS le montre comme passé (le chat s’endort).
@available(iOS 16.2, *)
enum RequeteAccueilPont {
    static func etat(_ call: CAPPluginCall, fini: Bool) -> RequeteAccueil.ContentState {
        let total: Int = max(1, call.getInt("total") ?? 1)
        let etape: Int = min(total, max(0, call.getInt("etape") ?? 0))
        let titre: String = call.getString("titre") ?? "Ton parcours"
        let bonjour: String = call.getString("bonjour") ?? "Bienvenue sur Requête"
        let minutes: Int = max(0, call.getInt("minutes") ?? 0)
        return RequeteAccueil.ContentState(etape: etape, total: total, titre: titre, bonjour: bonjour, minutes: minutes, fini: fini)
    }

    static func debut(_ etat: RequeteAccueil.ContentState) async -> Bool {
        await toutArreter()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        do {
            _ = try Activity<RequeteAccueil>.request(
                attributes: RequeteAccueil(app: "Requête"),
                content: ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)),
                pushType: nil
            )
            return true
        } catch {
            return false
        }
    }

    static func maj(_ etat: RequeteAccueil.ContentState) async {
        if Activity<RequeteAccueil>.activities.isEmpty {
            _ = await debut(etat)
            return
        }
        for a in Activity<RequeteAccueil>.activities {
            await a.update(ActivityContent(state: etat, staleDate: Date().addingTimeInterval(3600)))
        }
    }

    static func fin(fini: Bool) async {
        for a in Activity<RequeteAccueil>.activities {
            var bilan: RequeteAccueil.ContentState = a.content.state
            if fini {
                bilan.fini = true
                bilan.etape = bilan.total
                bilan.minutes = 0
            }
            let dernier = ActivityContent(state: bilan, staleDate: nil)
            let politique: ActivityUIDismissalPolicy = fini ? .after(Date().addingTimeInterval(5 * 60)) : .immediate
            await a.end(dernier, dismissalPolicy: politique)
        }
    }

    static func toutArreter() async {
        for a in Activity<RequeteAccueil>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }

    static func arreterEnCours() async {
        for a in Activity<RequeteAccueil>.activities where !a.content.state.fini {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}

// MARK: - Ta flamme en direct, jusqu’à minuit (Live Activity)
//
// Elisa, 7 novembre, 19 h 26 (« Oui », pour la planche « Ta flamme, en direct jusqu’à minuit ») : les soirs de séance, à l’heure
// du rappel (au plus tôt 18 h), si la flamme du jour n’est pas encore allumée, un compte à rebours jusqu’à minuit. Sans serveur : la
// page demande les deux prochains soirs à chaque ouverture (flammeProgrammer). À partir d’iOS 26, iOS démarre une Live Activity
// programmée à l’heure dite, même l’app fermée (Activity.request(…, start:), avec une alerte obligatoire) ; avant, elle démarre
// quand on ouvre l’app ce soir-là. Son dessin est dans le widget (RequeteWidget.swift, RequeteFlammeDirecte).

/// Le même type, au même nom et aux mêmes champs, est déclaré dans le widget (RequeteWidget.swift) : iOS relie la Live Activity
/// programmée par l’app à son dessin là-bas par ce nom.
@available(iOS 16.1, *)
struct RequeteFlammeDirect: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var fait: Bool   // la flamme du jour est allumée
    }

    var jour: String     // « AAAA-MM-JJ »
    var debut: Date      // l’heure du rappel, au plus tôt 18 h
    var minuit: Date     // la fin du jour
    var titre: String    // la prochaine activité : « Leçon 4 · LEFT JOIN »
    var action: String   // « Leçon express · 3 min »
}

/// Un soir demandé par la page.
@available(iOS 16.1, *)
struct RequeteFlammeDemande {
    let flamme: RequeteFlammeDirect
    let nouvelle: Bool       // l’heure passée, elle peut démarrer tout de suite (pas si elle a déjà démarré ce soir-là)
    let alerteTitre: String  // l’alerte d’iOS quand elle démarre toute seule (iOS 26)
    let alerteTexte: String

    init?(_ r: JSObject) {
        guard let jour = r["jour"] as? String, let debut = RequeteFlammeDemande.date(r["debut"]), let minuit = RequeteFlammeDemande.date(r["minuit"]) else {
            return nil
        }
        let titre: String = (r["titre"] as? String) ?? ""
        let action: String = (r["action"] as? String) ?? ""
        flamme = RequeteFlammeDirect(jour: jour, debut: min(debut, minuit), minuit: minuit, titre: titre, action: action)
        nouvelle = (r["nouvelle"] as? Bool) ?? true
        alerteTitre = (r["alerteTitre"] as? String) ?? "Ta flamme t’attend\u{202F}!"
        alerteTexte = (r["alerteTexte"] as? String) ?? "Il te reste jusqu’à minuit pour l’allumer."
    }

    /// Des millisecondes depuis 1970 (le getTime() d’une date de la page).
    private static func date(_ v: Any?) -> Date? {
        if let n = v as? NSNumber { return Date(timeIntervalSince1970: n.doubleValue / 1000) }
        if let d = v as? Double { return Date(timeIntervalSince1970: d / 1000) }
        if let i = v as? Int { return Date(timeIntervalSince1970: Double(i) / 1000) }
        return nil
    }
}

@available(iOS 16.2, *)
enum RequeteFlammePont {
    /// iOS 26 et plus : la flamme programmée démarre toute seule à l’heure dite.
    static var auto: Bool {
        if #available(iOS 26.0, *) {
            return true
        }
        return false
    }

    /// D’abord les flammes déjà là : une flamme finie garde sa carte (« Flamme allumée ! », un quart d’heure) ; une flamme d’un soir
    /// passé, plus demandée, ou programmée autrement (son heure, sa leçon) s’en va ; une flamme commencée, ou programmée telle quelle,
    /// reste. Puis les soirs qui manquent (lancer). Répond les soirs qui ont leur flamme.
    static func programmer(_ demandes: [RequeteFlammeDemande]) async -> [String] {
        let maintenant = Date()
        var gardes: Set<String> = []
        for a in Activity<RequeteFlammeDirect>.activities {
            if a.activityState == .ended || a.activityState == .dismissed { continue }
            let x: RequeteFlammeDirect = a.attributes
            let voulue: RequeteFlammeDemande? = demandes.first { $0.flamme.jour == x.jour }
            if let d = voulue, x.minuit > maintenant, garder(x, d.flamme, maintenant) {
                gardes.insert(x.jour)
            } else {
                await a.end(nil, dismissalPolicy: .immediate)
            }
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return gardes.sorted() }
        var jours: Set<String> = gardes
        for d in demandes where !gardes.contains(d.flamme.jour) {
            if lancer(d, maintenant) { jours.insert(d.flamme.jour) }
        }
        return jours.sorted()
    }

    /// Une flamme déjà là reste : commencée (son compte à rebours défile), ou programmée à la même heure, avec la même leçon.
    static func garder(_ x: RequeteFlammeDirect, _ voulue: RequeteFlammeDirect, _ maintenant: Date) -> Bool {
        if x.debut <= maintenant { return true }
        return x.debut == voulue.debut && x.titre == voulue.titre && x.action == voulue.action
    }

    /// L’heure passée : tout de suite (l’app est ouverte), sauf si elle a déjà démarré ce soir-là (balayée, elle ne revient pas). Sinon,
    /// à partir d’iOS 26, programmée : iOS la démarre tout seul à l’heure dite, avec son alerte, le message du rappel quand il tombe à
    /// la même heure (la page ne le programme pas en plus). Minuit la rend périmée (staleDate) : le chat s’endort.
    static func lancer(_ d: RequeteFlammeDemande, _ maintenant: Date) -> Bool {
        let x: RequeteFlammeDirect = d.flamme
        guard x.minuit > maintenant else { return false }
        let contenu = ActivityContent(state: RequeteFlammeDirect.ContentState(fait: false), staleDate: x.minuit)
        if x.debut <= maintenant {
            guard d.nouvelle else { return false }
            do {
                _ = try Activity<RequeteFlammeDirect>.request(attributes: x, content: contenu, pushType: nil)
                return true
            } catch {
                return false
            }
        }
        guard #available(iOS 26.0, *) else { return false }
        let titre: LocalizedStringResource = "\(d.alerteTitre)"
        let texte: LocalizedStringResource = "\(d.alerteTexte)"
        let alerte = AlertConfiguration(title: titre, body: texte, sound: .default)
        do {
            _ = try Activity<RequeteFlammeDirect>.request(attributes: x, content: contenu, pushType: nil, style: .standard, alertConfiguration: alerte, start: x.debut)
            return true
        } catch {
            return false
        }
    }

    /// La flamme du jour est allumée. Commencée : « Flamme allumée ! », un quart d’heure sur l’écran verrouillé (discret : tout de
    /// suite partie) ; programmée, pas encore commencée : annulée.
    static func allumee(jour: String, discret: Bool) async {
        let maintenant = Date()
        for a in Activity<RequeteFlammeDirect>.activities where a.attributes.jour == jour {
            if a.activityState == .ended || a.activityState == .dismissed { continue }
            let commencee: Bool = a.attributes.debut <= maintenant
            if discret || !commencee {
                await a.end(nil, dismissalPolicy: .immediate)
                continue
            }
            let fin = ActivityContent(state: RequeteFlammeDirect.ContentState(fait: true), staleDate: nil)
            await a.end(fin, dismissalPolicy: .after(maintenant.addingTimeInterval(15 * 60)))
        }
    }

    static func toutArreter() async {
        for a in Activity<RequeteFlammeDirect>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// À l’ouverture de l’app : une flamme d’un soir passé s’en va.
    static func nettoyer() async {
        let maintenant = Date()
        for a in Activity<RequeteFlammeDirect>.activities where a.attributes.minuit <= maintenant {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}

// MARK: - La salle dans l’île (Live Activity)
//
// Elisa, 7 novembre, 20 h 16 (« Oui », pour la planche « Ta salle vit dans l’île » : « Une seule activité, du code de la salle
// jusqu’au podium. Tu pars envoyer le code sur WhatsApp : tu vois tes amis arriver. »). La page la lance en ouvrant une salle entre
// amis (salleDebut), la tient à jour tant que l’app est ouverte (salleMaj), et l’arrête en quittant la salle, ou garde le podium un
// quart d’heure (salleFin). Elle demande à Apple un jeton de push pour l’activité : la page le confie au serveur
// (jeu_ile_jeton_v2), qui la met à jour l’app fermée (supabase/functions/jeu-ile). Son dessin est dans le widget
// (RequeteWidget.swift, RequeteSalleIle).

/// Les mêmes types, aux mêmes noms et aux mêmes champs, sont déclarés dans le widget (RequeteWidget.swift) ; le serveur envoie
/// le même état, en JSON (supabase/functions/jeu-ile).
@available(iOS 16.1, *)
struct RequeteSalle: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var phase: String            // « attente », « partie », « pause » (entre deux manches), « fin »
        var joueurs: [JoueurSalle]   // dans l’ordre de la salle en attente, du classement ensuite
        var hote: String             // l’identifiant de l’hôte
        var manche: Int              // de 1 à nb (0 en attente)
        var nb: Int                  // les manches de la partie
        var defi: String             // le titre du défi de la manche
        var fin: Double              // la fin du chrono de la manche, en secondes depuis 1970 (0 : pas de chrono)
        var nouveau: String          // l’identifiant de qui vient d’arriver (un clin d’œil), sinon vide
    }

    var code: String   // le code de la salle
    var moi: String    // mon identifiant dans la salle
    var max: Int       // les joueurs au plus
}

/// Un joueur de la salle, tel que l’île le montre.
struct JoueurSalle: Codable, Hashable {
    var p: String   // son identifiant
    var n: String   // son pseudo
    var pts: Int    // ses points
    var r: Int      // sa place (0 en attente)
    var ok: Bool    // prêt (en attente) ; a trouvé la manche (en partie)
}

/// La requête de poche rangée de nouveau : où se trouve, dans la nouvelle série, la question qu’on avait à l’écran (son code et son
/// énoncé) ; 0 si elle n’y est plus.
enum RequetePocheSuite {
    static func cle(_ q: [String: Any]) -> String {
        let code: [String] = (q["code"] as? [String]) ?? []
        let enonce: String = (q["enonce"] as? String) ?? ""
        return code.joined(separator: "\n") + "|" + enonce
    }

    static func liste(_ texte: String?) -> [[String: Any]] {
        guard let t = texte, let donnees = t.data(using: .utf8) else { return [] }
        return ((try? JSONSerialization.jsonObject(with: donnees)) as? [[String: Any]]) ?? []
    }

    static func rang(ancienne: String?, index: Int, nouvelle: String) -> Int {
        let avant: [[String: Any]] = liste(ancienne)
        let apres: [[String: Any]] = liste(nouvelle)
        guard !avant.isEmpty, !apres.isEmpty else { return 0 }
        let courante: String = cle(avant[max(0, index) % avant.count])
        return apres.firstIndex { cle($0) == courante } ?? 0
    }
}

/// Une partie seule : la Live Activity démarre tout de suite sans jeton de push (le second essai de RequeteSallePont.debut).
enum RequeteSansPush: Error {
    case seul
}

/// Une seule salle à la fois.
@available(iOS 16.2, *)
enum RequeteSallePont {
    /// L’état envoyé par la page, en JSON : le même que celui que le serveur pousse.
    static func etat(_ texte: String?) -> RequeteSalle.ContentState? {
        guard let t = texte, let donnees = t.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(RequeteSalle.ContentState.self, from: donnees)
    }

    /// La salle s’ouvre : l’ancienne activité s’en va, la nouvelle demande un jeton de push (sans la permission des push, elle
    /// démarre sans : elle suit alors la salle seulement l’app ouverte). Chaque jeton reçu part à la page (jetons).
    static func debut(code: String, moi: String, max: Int, etat: RequeteSalle.ContentState, push: Bool, jetons: @escaping (String) -> Void) async -> Bool {
        for a in Activity<RequeteSalle>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        let salle = RequeteSalle(code: code, moi: moi, max: max)
        let contenu = ActivityContent(state: etat, staleDate: nil)
        let activite: Activity<RequeteSalle>
        do {
            guard push else { throw RequeteSansPush.seul }
            activite = try Activity<RequeteSalle>.request(attributes: salle, content: contenu, pushType: .token)
        } catch {
            do {
                activite = try Activity<RequeteSalle>.request(attributes: salle, content: contenu, pushType: nil)
            } catch {
                return false
            }
        }
        guard push else { return true }
        Task {
            for await jeton in activite.pushTokenUpdates {
                let hex: String = jeton.map { String(format: "%02x", $0) }.joined()
                jetons(hex)
            }
        }
        return true
    }

    static func maj(_ etat: RequeteSalle.ContentState) async {
        for a in Activity<RequeteSalle>.activities where a.activityState == .active || a.activityState == .stale {
            await a.update(ActivityContent(state: etat, staleDate: nil))
        }
    }

    static func arreterEnCours() async {
        for a in Activity<RequeteSalle>.activities where a.activityState == .active || a.activityState == .stale {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// garder : le podium reste un quart d’heure sur l’écran verrouillé. Sinon, tout s’en va, même un podium déjà affiché.
    static func fin(_ etat: RequeteSalle.ContentState?, garder: Bool) async {
        for a in Activity<RequeteSalle>.activities {
            if a.activityState == .ended || a.activityState == .dismissed {
                if !garder { await a.end(nil, dismissalPolicy: .immediate) }
                continue
            }
            let dernier: ActivityContent<RequeteSalle.ContentState>? = etat.map { ActivityContent(state: $0, staleDate: nil) }
            let politique: ActivityUIDismissalPolicy = garder ? .after(Date().addingTimeInterval(15 * 60)) : .immediate
            await a.end(dernier, dismissalPolicy: politique)
        }
    }
}

/// « Quand Léa entre, l’île s’ouvre un instant, avec un petit miaou » (la planche) : l’alerte poussée par le serveur joue un son de
/// l’app, que iOS cherche dans Library/Sounds. Il voyage avec la page (public/assets/sons/miaou.wav, synthétisé par
/// tools/sons/miaou.py) : recopié là à chaque lancement (une version plus récente remplace l’ancienne).
enum RequeteSon {
    static func installer() {
        let fm = FileManager.default
        guard let source = Bundle.main.url(forResource: "miaou", withExtension: "wav", subdirectory: "public/assets/sons"),
              let bibliotheque = fm.urls(for: .libraryDirectory, in: .userDomainMask).first else { return }
        let dossier = bibliotheque.appendingPathComponent("Sounds", isDirectory: true)
        let cible = dossier.appendingPathComponent("miaou.wav")
        try? fm.createDirectory(at: dossier, withIntermediateDirectories: true)
        try? fm.removeItem(at: cible)
        try? fm.copyItem(at: source, to: cible)
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
