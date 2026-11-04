import WidgetKit
import SwiftUI
import ActivityKit

// Le widget de Requête (Elisa, 4 novembre, 3 h 54, d’après l’onboarding de Duolingo) : la flamme du jour et le chat qui dépasse
// du bas, sur le violet de l’app (12 h 35 : « pourquoi 12 ? non, je veux que la flamme du jour ! » : plus de nombre de jours). L’app (index.html, widgetMaj) range la série dans le groupe d’apps
// chaque fois qu’elle passe en arrière-plan ; le widget la relit à chaque minuit : la flamme du jour s’éteint, et une série
// qui n’a pas été tenue (après le dernier jour qui la gardait, jours de repos du planning compris) retombe à zéro.

private let groupe = "group.fr.requete.app"

/// Elisa, 4 novembre, 12 h 14 : « un chat qui change dans la journée : une bulle le matin, la flamme le soir, un saut de joie quand
/// la séance du jour est faite, avec une transition à chaque changement ». Le moment se lit à l’heure de l’entrée ; le fournisseur en
/// pose une à minuit, 5 h, midi et 18 h, et l’app recharge le widget en partant, après une séance : c’est le saut de joie.
enum Humeur: String {
    case matin     // de 5 h à midi : « Une petite requête ? » dans une bulle (« Jour de repos ! » un jour de repos du planning)
    case journee   // de midi à 18 h, et la nuit : le chat qui dépasse du bas, comme avant
    case soir      // de 18 h à minuit, un jour de séance : la flamme en grand, « Ta flamme t’attend ! »
    case fete      // la séance du jour est faite : la flamme dorée, et le chat saute de joie entre des étincelles
}

struct SerieEntree: TimelineEntry {
    let date: Date
    let serie: Int
    let faitAujourdhui: Bool
    /// Un jour de repos du planning : la série tient sans séance aujourd’hui, le soir ne presse donc pas.
    var repos: Bool = false

    var humeur: Humeur {
        if faitAujourdhui { return .fete }
        switch Calendar.current.component(.hour, from: date) {
        case 5..<12: return .matin
        case 18..<24: return repos ? .journee : .soir
        default: return .journee
        }
    }
}

struct SerieFournisseur: TimelineProvider {
    func placeholder(in context: Context) -> SerieEntree {
        SerieEntree(date: Date(), serie: 5, faitAujourdhui: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (SerieEntree) -> Void) {
        let e = entree(pour: Date())
        // Dans la galerie des widgets, une série vide montrerait « 0 » : on montre plutôt à quoi il ressemble.
        if context.isPreview && e.serie == 0 {
            completion(SerieEntree(date: Date(), serie: 5, faitAujourdhui: true))
        } else {
            completion(e)
        }
    }

    /// Une entrée maintenant, puis à chaque changement du chat (minuit, 5 h, midi, 18 h) sur sept jours.
    func getTimeline(in context: Context, completion: @escaping (Timeline<SerieEntree>) -> Void) {
        let cal = Calendar.current
        let maintenant = Date()
        let aujourdhui = cal.startOfDay(for: maintenant)
        var dates = [maintenant]
        for j in 0...7 {
            guard let jour = cal.date(byAdding: .day, value: j, to: aujourdhui) else { break }
            for heure in [0, 5, 12, 18] {
                guard let d = cal.date(bySettingHour: heure, minute: 0, second: 0, of: jour), d > maintenant else { continue }
                dates.append(d)
            }
        }
        completion(Timeline(entries: dates.map { entree(pour: $0) }, policy: .atEnd))
    }

    private func cle(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// jour : le jour où l’app a compté la série ; fait : ce jour-là a eu son activité ;
    /// limite : le dernier jour où une activité garde la série (avant elle, les jours de repos du planning).
    private func entree(pour date: Date) -> SerieEntree {
        let d = UserDefaults(suiteName: groupe)
        let serie = d?.integer(forKey: "serie") ?? 0
        let jour = d?.string(forKey: "jour") ?? ""
        let fait = d?.bool(forKey: "fait") ?? false
        let limite = d?.string(forKey: "limite") ?? ""
        let k = cle(date)
        let repos = !limite.isEmpty && k < limite
        if k == jour {
            return SerieEntree(date: date, serie: serie, faitAujourdhui: fait, repos: !fait && repos)
        }
        if !limite.isEmpty && k <= limite {
            return SerieEntree(date: date, serie: serie, faitAujourdhui: false, repos: repos)
        }
        return SerieEntree(date: date, serie: 0, faitAujourdhui: false)
    }
}

private let violet = LinearGradient(
    gradient: Gradient(colors: [
        Color(red: 0.478, green: 0.361, blue: 1.0),
        Color(red: 0.333, green: 0.220, blue: 0.902),
        Color(red: 0.271, green: 0.161, blue: 0.800)
    ]),
    startPoint: .topLeading,
    endPoint: .bottomTrailing
)

private let dore = Color(red: 1.0, green: 0.784, blue: 0.239)
private let doreClair = Color(red: 1.0, green: 0.847, blue: 0.420)
private let violetTexte = Color(red: 0.333, green: 0.220, blue: 0.902)
private let braise = Color(red: 1.0, green: 0.541, blue: 0.239)
private let menthe = Color(red: 0.624, green: 0.941, blue: 0.776)
private let encre = Color(red: 0.106, green: 0.086, blue: 0.251)

/// Elisa, 4 novembre, 8 h 36 : « c’est possible d’animer plus le widget ? ». iOS n’anime pas un widget en boucle (pas de flamme qui
/// danse sur l’écran d’accueil) ; il anime le passage d’un état à l’autre : la flamme s’allume d’un rebond, et le chat plonge puis
/// ressort en sautant. C’est ce qu’on voit en revenant sur l’écran d’accueil après une séance (l’app range le jour en partant), et à
/// minuit quand la flamme s’éteint.
/// 12 h 14 : le chat change aussi avec la journée (voir Humeur) ; à chaque changement, il plonge et ressort dans sa nouvelle pose,
/// la bulle sort de sa bouche, la flamme grandit ou se rallume, les étincelles jaillissent. Avant iOS 17, les poses changent sans
/// animation. 12 h 35 : la flamme du jour, sans le nombre de jours. 13 h 11 (« mettre 0/1 au niveau de la flamme, avec un validé
/// coche ✅ quand c’est bon ») : à côté de la flamme, la séance du jour, 0/1 puis 1/1, et la coche menthe sur la flamme dorée.
struct SerieVue: View {
    let entree: SerieEntree

    private var humeur: Humeur { entree.humeur }

    private var flamme: Color {
        if entree.faitAujourdhui { return dore }
        return Color.white.opacity(humeur == .soir ? 0.85 : 0.55)
    }

    /// Le soir, la flamme grandit et rougeoie : elle attend la séance du jour.
    private var tailleFlamme: CGFloat {
        if entree.faitAujourdhui { return 1 }
        return humeur == .soir ? 1.25 : 0.88
    }

    private var lueur: Color {
        switch humeur {
        case .soir: return braise.opacity(0.9)
        case .fete: return dore.opacity(0.5)
        case .matin, .journee: return Color.clear
        }
    }

    /// Le haut de la flamme, en part de la hauteur (le soir, plus haut : elle grandit, et sa phrase passe dessous).
    private var hautFlamme: CGFloat {
        switch humeur {
        case .matin, .fete: return 0.08
        case .journee: return 0.1
        case .soir: return 0.06
        }
    }

    /// Le centre du chat, en part de la hauteur : réveillé le matin, plus bas le soir (il attend), en l’air quand c’est fait.
    private var hauteurChat: CGFloat {
        switch humeur {
        case .matin: return 0.93
        case .journee: return 0.97
        case .soir: return 1.04
        case .fete: return 0.9
        }
    }

    private var ressort: Animation { .spring(response: 0.55, dampingFraction: 0.58) }

    /// Le saut de joie : un ressort plus vif, qui monte plus haut que sa place avant de s’y poser.
    private var saut: Animation { .spring(response: 0.5, dampingFraction: 0.5) }

    private var libelle: String {
        if entree.faitAujourdhui { return "Séance du jour validée : 1 sur 1. Ta flamme est allumée." }
        return entree.repos ? "Jour de repos." : "Séance du jour : 0 sur 1."
    }

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    private func contenu(_ s: CGSize) -> some View {
        let w = s.width
        let h = s.height
        return ZStack(alignment: .topTrailing) {
            if humeur == .fete {
                etincelles(w, h)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))   // elles jaillissent de derrière le chat
            }
            chatVue(w, h)
                .id(humeur)   // le moment change : le chat plonge et ressort dans sa nouvelle pose
                .transition(.asymmetric(
                    insertion: AnyTransition.move(edge: .bottom).animation((humeur == .fete ? saut : ressort).delay(0.15)),
                    removal: AnyTransition.move(edge: .bottom).animation(.easeIn(duration: 0.2))
                ))
            compteurVue(w)
                .scaleEffect(humeur == .matin ? 0.55 : 1, anchor: .topLeading)   // le matin, il se range dans le coin
                .frame(width: w * 0.84, alignment: humeur == .matin ? .leading : .center)
                .padding(.horizontal, w * 0.08)
                .padding(.top, h * hautFlamme)
            if humeur == .soir {
                legende(w, h)
                    .transition(.opacity.combined(with: .offset(y: h * 0.05)))
            }
            if humeur == .matin {
                bulle(w)
                    .padding(.top, h * 0.07)
                    .padding(.trailing, w * 0.05)
                    .transition(.scale(scale: 0.3, anchor: .bottomLeading).combined(with: .opacity))   // elle sort de la bouche du chat
            }
        }
        .frame(width: w, height: h)
        .animation(ressort, value: entree.faitAujourdhui)
        .animation(ressort, value: humeur)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(libelle))
    }

    private func chatVue(_ w: CGFloat, _ h: CGFloat) -> some View {
        Image("Mascotte")
            .resizable()
            .scaledToFit()
            .frame(width: w * 0.66)
            .rotationEffect(.degrees(humeur == .fete ? -8 : 0))   // le saut de joie : en l’air, et penché
            .position(x: w / 2, y: h * hauteurChat)
    }

    /// Le soir, sous la flamme.
    private func legende(_ w: CGFloat, _ h: CGFloat) -> some View {
        Text(entree.serie > 0 ? "Ta flamme t’attend\u{202F}!" : "Allume ta flamme\u{202F}!")
            .font(.system(size: w * 0.072, weight: .bold, design: .rounded))
            .foregroundColor(Color.white.opacity(0.92))
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .frame(width: w * 0.9)
            .padding(.horizontal, w * 0.05)
            .padding(.top, h * 0.425)
    }

    /// La flamme du jour et la séance du jour à côté (« 0/1 », puis « 1/1 »). Un jour de repos du planning, pas d’objectif : la flamme seule.
    private func compteurVue(_ w: CGFloat) -> some View {
        HStack(alignment: .center, spacing: w * (humeur == .soir ? 0.07 : entree.faitAujourdhui ? 0.05 : 0.03)) {
            flammeVue(w)
            if !entree.repos {
                objectifVue(w)
                    .transition(.opacity)
            }
        }
    }

    /// La flamme du jour : éteinte, rougeoyante le soir, dorée quand la séance est faite, avec sa coche menthe. Dans un ZStack : allumée
    /// ou éteinte, c’est une autre flamme, qui entre d’un rebond à la place de l’autre ; la coche arrive d’un rebond aussi.
    private func flammeVue(_ w: CGFloat) -> some View {
        ZStack(alignment: .bottomTrailing) {
            Image(systemName: "flame.fill")
                .font(.system(size: w * 0.3, weight: .bold))
                .foregroundColor(flamme)
                .scaleEffect(tailleFlamme)
                .shadow(color: lueur, radius: w * 0.06)
                .id(entree.faitAujourdhui)   // allumée ↔ éteinte : une autre flamme, qui entre d’un rebond
                .transition(.scale(scale: 0.3).combined(with: .opacity))
            if entree.faitAujourdhui {
                coche(w)
                    .offset(x: w * 0.025, y: w * 0.015)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))   // validé : la coche se pose sur la flamme
            }
        }
    }

    /// « 0/1 » : le « /1 » plus petit, pour que le chiffre reste lisible même rangé dans le coin, le matin. Il roule de 0 à 1 (iOS 17).
    private func objectifVue(_ w: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text(entree.faitAujourdhui ? "1" : "0")
                .font(.system(size: w * 0.22, weight: .heavy, design: .rounded))
                .chiffreQuiRoule(entree.faitAujourdhui ? 1 : 0)
            Text("/1")
                .font(.system(size: w * 0.13, weight: .bold, design: .rounded))
                .opacity(0.75)
        }
        .foregroundColor(entree.faitAujourdhui ? doreClair : Color.white.opacity(0.9))
        .lineLimit(1)
    }

    /// La coche « validé » : menthe, cerclée de blanc, comme l’étiquette « ✓ Validée » du bilan.
    private func coche(_ w: CGFloat) -> some View {
        Image(systemName: "checkmark")
            .font(.system(size: w * 0.07, weight: .heavy))
            .foregroundColor(encre)
            .frame(width: w * 0.14, height: w * 0.14)
            .background(Circle().fill(menthe))
            .overlay(Circle().stroke(Color.white, lineWidth: w * 0.012))
    }

    /// La bulle du matin, en haut à droite, après le compteur réduit (la flamme et « 0/1 », de 0,08 à 0,39 de la largeur environ).
    private func bulle(_ w: CGFloat) -> some View {
        let pointe = w * 0.055
        return Text(entree.repos ? "Jour de repos\u{202F}!" : "Une petite requête\u{202F}?")
            .font(.system(size: w * 0.075, weight: .bold, design: .rounded))
            .foregroundColor(violetTexte)
            .multilineTextAlignment(.center)
            .lineLimit(3)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, w * 0.035)
            .padding(.vertical, w * 0.03)
            .frame(width: w * 0.53)
            .padding(.bottom, pointe)
            .background(Bulle(pointe: pointe).fill(Color.white))
            .shadow(color: Color.black.opacity(0.15), radius: w * 0.025, y: w * 0.012)
    }

    /// Les étincelles de la fête, autour de la tête du chat.
    private func etincelles(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            etincelle(w * 0.1).position(x: w * 0.12, y: h * 0.6)
            etincelle(w * 0.12).position(x: w * 0.88, y: h * 0.52)
            etincelle(w * 0.07).position(x: w * 0.85, y: h * 0.8)
        }
    }

    private func etincelle(_ taille: CGFloat) -> some View {
        Image(systemName: "sparkle")
            .font(.system(size: taille, weight: .bold))
            .foregroundColor(doreClair)
            .shadow(color: dore.opacity(0.6), radius: taille * 0.3)
    }
}

/// La bulle du matin : un rectangle arrondi, et sa pointe en bas à gauche, vers le chat.
struct Bulle: Shape {
    var pointe: CGFloat

    func path(in r: CGRect) -> Path {
        let corps = CGRect(x: r.minX, y: r.minY, width: r.width, height: max(0, r.height - pointe))
        var p = Path(roundedRect: corps, cornerRadius: min(corps.height / 2, r.width * 0.16), style: .continuous)
        let x = r.minX + r.width * 0.24
        p.move(to: CGPoint(x: x, y: corps.maxY - 1))
        p.addLine(to: CGPoint(x: x - pointe * 0.5, y: r.maxY))
        p.addLine(to: CGPoint(x: x + pointe * 1.1, y: corps.maxY - 1))
        p.closeSubpath()
        return p
    }
}

extension View {
    /// iOS 17 et plus : le fond passe par containerBackground (sinon le widget affiche « Adoptez l’API containerBackground »).
    @ViewBuilder
    func fondRequete() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { violet }
        } else {
            self.background(violet)
        }
    }
}

extension View {
    /// iOS 17 et plus : le chiffre de la séance du jour roule de 0 à 1 (avant, il change d’un fondu).
    @ViewBuilder
    func chiffreQuiRoule(_ valeur: Int) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.contentTransition(.numericText(value: Double(valeur)))
        } else {
            self
        }
    }
}

extension WidgetConfiguration {
    /// iOS 17 et plus : sans les marges ajoutées autour du contenu, le chat peut dépasser du bas, comme dans l’app.
    func sansMarges() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

struct RequeteWidget: Widget {
    let kind = "RequeteSerie"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SerieFournisseur()) { entree in
            SerieVue(entree: entree).fondRequete()
        }
        .configurationDisplayName("Ta flamme")
        .description("La flamme du jour sur Requête, et le chat qui change avec la journée.")
        .supportedFamilies([.systemSmall])
        .sansMarges()
    }
}

// MARK: - La leçon en cours, dans la Dynamic Island
//
// Elisa, 4 novembre, 12 h 35 : « tu peux faire une Dynamic Island ». Une Live Activity : la page (index.html, ileDebut, ileMaj, ileFin)
// la lance quand une leçon en vidéo s’ouvre, la met à jour quand la vidéo avance et quand on quitte l’app, et l’arrête à la fin
// (RequeteWidgetPlugin.swift : leconDebut, leconMaj, leconFin). On quitte l’app en pleine leçon : la flamme et l’avancement dans la
// Dynamic Island, la leçon sur l’écran verrouillé, et un appui y ramène. Leçon réussie : la flamme du jour s’allume, dorée, sur l’écran
// verrouillé, un quart d’heure.

/// Le même type, au même nom et aux mêmes champs, est déclaré dans l’app (RequeteWidgetPlugin.swift) : iOS relie la Live Activity
/// lancée par l’app à son dessin ici par ce nom.
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

@available(iOS 16.1, *)
func leconPhrase(_ e: RequeteLecon.ContentState) -> String {
    if e.fini { return "Leçon terminée\u{202F}! Ta flamme du jour est allumée." }
    let pct = Int((min(1, max(0, e.progression)) * 100).rounded())
    return e.allumee ? "\(pct)\u{202F}% de la leçon" : "\(pct)\u{202F}% · termine-la pour allumer ta flamme"
}

/// La flamme du jour : dorée quand elle est allumée, braise tant que la leçon la fait attendre.
@available(iOS 16.1, *)
struct LeconFlamme: View {
    let etat: RequeteLecon.ContentState
    let taille: CGFloat

    var body: some View {
        Image(systemName: "flame.fill")
            .font(.system(size: taille, weight: .bold))
            .foregroundColor(etat.fini || etat.allumee ? dore : braise)
    }
}

/// L’avancement de la leçon : une barre, dorée quand la leçon est réussie.
struct LeconBarre: View {
    let progression: Double
    let fini: Bool

    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.white.opacity(0.22))
                Capsule()
                    .fill(fini ? dore : Color.white)
                    .frame(width: max(g.size.height, g.size.width * CGFloat(min(1, max(0, progression)))))
            }
        }
        .frame(height: 7)
    }
}

/// L’avancement en anneau, à droite de la Dynamic Island.
struct LeconAnneau: View {
    let progression: Double
    let fini: Bool

    var body: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.25), lineWidth: 3)
            Circle()
                .trim(from: 0, to: CGFloat(min(1, max(0.03, progression))))
                .stroke(fini ? dore : braise, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

/// L’écran verrouillé : le chat, le module et la leçon, l’avancement, et la flamme du jour.
@available(iOS 16.1, *)
struct LeconVerrouille: View {
    let lecon: RequeteLecon
    let etat: RequeteLecon.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image("Mascotte")
                .resizable()
                .scaledToFit()
                .frame(width: 56)
            VStack(alignment: .leading, spacing: 5) {
                Text(lecon.module)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.7))
                    .lineLimit(1)
                Text(lecon.titre)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundColor(Color.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                LeconBarre(progression: etat.fini ? 1 : etat.progression, fini: etat.fini)
                    .padding(.top, 2)
                Text(leconPhrase(etat))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
            }
            LeconFlamme(etat: etat, taille: 34)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

@available(iOS 16.1, *)
struct RequeteLeconActivite: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RequeteLecon.self) { context in
            LeconVerrouille(lecon: context.attributes, etat: context.state)
                .activityBackgroundTint(violetTexte)
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image("Mascotte")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    LeconFlamme(etat: context.state, taille: 30)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.module)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(Color.white.opacity(0.6))
                            .lineLimit(1)
                        Text(context.attributes.titre)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(Color.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 7) {
                        LeconBarre(progression: context.state.fini ? 1 : context.state.progression, fini: context.state.fini)
                        Text(leconPhrase(context.state))
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color.white.opacity(0.85))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 2)
                }
            } compactLeading: {
                LeconFlamme(etat: context.state, taille: 15)
            } compactTrailing: {
                LeconAnneau(progression: context.state.fini ? 1 : context.state.progression, fini: context.state.fini)
                    .frame(width: 17, height: 17)
            } minimal: {
                LeconFlamme(etat: context.state, taille: 14)
            }
            .keylineTint(braise)
        }
    }
}

/// Le widget de la flamme, et la Live Activity de la leçon (iOS 16.1 et plus).
@main
struct RequeteWidgets: WidgetBundle {
    var body: some Widget {
        RequeteWidget()
        if #available(iOS 16.1, *) {
            RequeteLeconActivite()
        }
    }
}
