import WidgetKit
import SwiftUI

// Le widget de Requête (Elisa, 4 novembre, 3 h 54, d’après l’onboarding de Duolingo) : la série de jours, la flamme du jour
// et le chat qui dépasse du bas, sur le violet de l’app. L’app (index.html, widgetMaj) range la série dans le groupe d’apps
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

/// Elisa, 4 novembre, 8 h 36 : « c’est possible d’animer plus le widget ? ». iOS n’anime pas un widget en boucle (pas de flamme qui
/// danse sur l’écran d’accueil) ; il anime le passage d’un état à l’autre, quand la série change : le chiffre roule (4 → 5), la flamme
/// s’allume d’un rebond, et le chat plonge puis ressort en sautant. C’est ce qu’on voit en revenant sur l’écran d’accueil après une
/// séance (l’app range la nouvelle série en partant), et à minuit quand la flamme s’éteint.
/// 12 h 14 : le chat change aussi avec la journée (voir Humeur) ; à chaque changement, il plonge et ressort dans sa nouvelle pose,
/// la bulle sort de sa bouche, la flamme grandit ou se rallume, les étincelles jaillissent. Avant iOS 17, les poses changent sans
/// animation.
struct SerieVue: View {
    let entree: SerieEntree

    private var humeur: Humeur { entree.humeur }

    private var flamme: Color {
        if entree.faitAujourdhui { return dore }
        return Color.white.opacity(humeur == .soir ? 0.85 : 0.55)
    }

    private var chiffre: Color {
        entree.faitAujourdhui ? doreClair : Color.white.opacity(0.9)
    }

    /// Le soir, la flamme grandit et rougeoie : elle attend la séance du jour.
    private var tailleFlamme: CGFloat {
        if entree.faitAujourdhui { return 1 }
        return humeur == .soir ? 1.3 : 0.88
    }

    private var lueur: Color {
        switch humeur {
        case .soir: return Color(red: 1.0, green: 0.541, blue: 0.239).opacity(0.9)
        case .fete: return dore.opacity(0.5)
        case .matin, .journee: return Color.clear
        }
    }

    /// Le haut du compteur, en part de la hauteur.
    private var hautCompteur: CGFloat {
        switch humeur {
        case .matin, .soir: return 0.08
        case .journee: return 0.1
        case .fete: return 0.07
        }
    }

    /// Le centre du chat, en part de la hauteur : réveillé le matin, plus bas le soir (il attend), en l’air quand c’est fait.
    private var hauteurChat: CGFloat {
        switch humeur {
        case .matin: return 0.93
        case .journee: return 0.97
        case .soir: return 1.02
        case .fete: return 0.9
        }
    }

    /// Ce qui fait plonger le chat : la série ou le moment change.
    private var chat: String { "\(entree.serie)-\(humeur.rawValue)" }

    private var ressort: Animation { .spring(response: 0.55, dampingFraction: 0.58) }

    /// Le saut de joie : un ressort plus vif, qui monte plus haut que sa place avant de s’y poser.
    private var saut: Animation { .spring(response: 0.5, dampingFraction: 0.5) }

    private var libelle: String {
        let jours = entree.serie > 1 ? "\(entree.serie) jours" : "\(entree.serie) jour"
        return entree.faitAujourdhui ? "Ta série : \(jours). Séance du jour faite." : "Ta série : \(jours)."
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
                .id(chat)   // la série ou le moment change : le chat plonge et ressort dans sa nouvelle pose
                .transition(.asymmetric(
                    insertion: AnyTransition.move(edge: .bottom).animation((humeur == .fete ? saut : ressort).delay(0.15)),
                    removal: AnyTransition.move(edge: .bottom).animation(.easeIn(duration: 0.2))
                ))
            compteur(w)
                .scaleEffect(humeur == .matin ? 0.6 : 1, anchor: .topLeading)   // le matin, il se range dans le coin
                .frame(width: w * 0.84, alignment: humeur == .matin ? .leading : .center)
                .padding(.horizontal, w * 0.08)
                .padding(.top, h * hautCompteur)
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
        .animation(ressort, value: entree.serie)
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

    private func compteur(_ w: CGFloat) -> some View {
        HStack(spacing: w * (humeur == .soir ? 0.07 : 0.03)) {
            Image(systemName: "flame.fill")
                .font(.system(size: w * 0.2, weight: .bold))
                .foregroundColor(flamme)
                .scaleEffect(tailleFlamme)
                .shadow(color: lueur, radius: w * 0.05)
                .id(entree.faitAujourdhui)   // allumée ↔ éteinte : une autre flamme, qui entre d’un rebond
                .transition(.scale(scale: 0.3).combined(with: .opacity))
            Text("\(entree.serie)")
                .font(.system(size: w * 0.27, weight: .heavy, design: .rounded))
                .foregroundColor(chiffre)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .chiffreQuiRoule(entree.serie)
        }
    }

    /// La bulle du matin, en haut à droite : elle commence après le compteur réduit (plus large à partir de trois chiffres).
    private func bulle(_ w: CGFloat) -> some View {
        let chiffres = CGFloat(String(entree.serie).count)
        let finCompteur = 0.08 + 0.6 * (0.2 + 0.175 * chiffres)   // en part de la largeur : la flamme, puis les chiffres
        let debut = max(0.42, finCompteur + 0.03)
        let pointe = w * 0.055
        return Text(entree.repos ? "Jour de repos\u{202F}!" : "Une petite requête\u{202F}?")
            .font(.system(size: w * 0.075, weight: .bold, design: .rounded))
            .foregroundColor(violetTexte)
            .multilineTextAlignment(.center)
            .lineLimit(3)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, w * 0.035)
            .padding(.vertical, w * 0.03)
            .frame(width: w * (0.95 - debut))
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
    /// iOS 17 et plus : le chiffre de la série roule d’une valeur à l’autre (avant, il change d’un fondu).
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

@main
struct RequeteWidget: Widget {
    let kind = "RequeteSerie"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SerieFournisseur()) { entree in
            SerieVue(entree: entree).fondRequete()
        }
        .configurationDisplayName("Ta série")
        .description("Ta série de jours sur Requête, et le chat qui change avec la journée.")
        .supportedFamilies([.systemSmall])
        .sansMarges()
    }
}
