import WidgetKit
import SwiftUI
import ActivityKit
import AppIntents

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

    /// Le soir, sous la flamme. Comme la bulle (16 h 28) : la phrase et les mesures d’abord, chacune avec son type.
    private func legende(_ w: CGFloat, _ h: CGFloat) -> some View {
        let phrase: String = entree.serie > 0 ? "Ta flamme t’attend\u{202F}!" : "Allume ta flamme\u{202F}!"
        let police: Font = Font.system(size: w * 0.072, weight: .bold, design: .rounded)
        let couleur: Color = Color.white.opacity(0.92)
        let largeur: CGFloat = w * 0.9
        let marge: CGFloat = w * 0.05
        let haut: CGFloat = h * 0.425
        return Text(phrase)
            .font(police)
            .foregroundColor(couleur)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .frame(width: largeur)
            .padding(.horizontal, marge)
            .padding(.top, haut)
    }

    /// L’écart entre la flamme et « 0/1 », en part de la largeur : plus grand le soir (la flamme grandit), un peu plus quand la coche
    /// est posée sur la flamme.
    private var ecartCompteur: CGFloat {
        if humeur == .soir { return 0.07 }
        return entree.faitAujourdhui ? 0.05 : 0.03
    }

    /// La flamme du jour et la séance du jour à côté (« 0/1 », puis « 1/1 »). Un jour de repos du planning, pas d’objectif : la flamme seule.
    private func compteurVue(_ w: CGFloat) -> some View {
        let ecart: CGFloat = w * ecartCompteur
        return HStack(alignment: .center, spacing: ecart) {
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
        let fait: Bool = entree.faitAujourdhui
        let chiffre: String = fait ? "1" : "0"
        let valeur: Int = fait ? 1 : 0
        let grand: Font = Font.system(size: w * 0.22, weight: .heavy, design: .rounded)
        let petit: Font = Font.system(size: w * 0.13, weight: .bold, design: .rounded)
        let teinte: Color = fait ? doreClair : Color.white.opacity(0.9)
        return HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text(chiffre)
                .font(grand)
                .chiffreQuiRoule(valeur)
            Text("/1")
                .font(petit)
                .opacity(0.75)
        }
        .foregroundColor(teinte)
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
    /// 4 novembre, 16 h 28 (« mon TestFlight s’est arrêté à 5 ») : l’archive échouait ici, Xcode n’arrivait pas à vérifier à temps
    /// les types de la phrase au choix suivie de onze modificateurs. La phrase, la police et les mesures sont posées d’abord, chacune
    /// avec son type, et la chaîne est coupée en deux.
    private func bulle(_ w: CGFloat) -> some View {
        let pointe: CGFloat = w * 0.055
        let phrase: String = entree.repos ? "Jour de repos\u{202F}!" : "Une petite requête\u{202F}?"
        let police: Font = Font.system(size: w * 0.075, weight: .bold, design: .rounded)
        let margeH: CGFloat = w * 0.035
        let margeV: CGFloat = w * 0.03
        let largeur: CGFloat = w * 0.53
        let flou: CGFloat = w * 0.025
        let chute: CGFloat = w * 0.012
        let ombre: Color = Color.black.opacity(0.15)
        let fond = Bulle(pointe: pointe).fill(Color.white)
        let texte: Text = Text(phrase).font(police).foregroundColor(violetTexte)
        let cadre = texte
            .multilineTextAlignment(.center)
            .lineLimit(3)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, margeH)
            .padding(.vertical, margeV)
            .frame(width: largeur)
        return cadre
            .padding(.bottom, pointe)
            .background(fond)
            .shadow(color: ombre, radius: flou, x: 0, y: chute)
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

// MARK: - La flamme sur l’écran verrouillé
//
// Elisa, 6 novembre, 0 h 40 (« dans compte mettre ça (widget) avec les animations de comment procéder », sur une capture « Widgets
// de l’écran d’accueil », « Widgets de l’écran verrouillé ») : Mon compte montre comment poser le widget sur l’écran d’accueil et sur
// l’écran verrouillé. Sur l’écran verrouillé, iOS dessine les widgets d’une seule teinte, par-dessus le fond d’écran : la flamme du
// jour (pleine quand la séance est faite, en contour sinon) et la séance du jour, « 0/1 » puis « 1/1 » — en rond, en bandeau, ou sur
// la ligne de la date. Même fournisseur que le widget de l’écran d’accueil (minuit, 5 h, midi, 18 h, et l’app qui recharge tous les
// widgets en partant, RequeteWidgetPlugin.swift). Comme pour la bulle du matin (IOS.md) : la phrase, les polices et les mesures
// d’abord, chacune avec son type, puis de courtes suites de modificateurs.

@available(iOS 16.1, *)
struct VerrouVue: View {
    let entree: SerieEntree
    @Environment(\.widgetFamily) private var famille

    private var fait: Bool { entree.faitAujourdhui }

    /// Pleine quand la séance du jour est faite, en contour sinon.
    private var symbole: String { fait ? "flame.fill" : "flame" }

    private var compte: String { fait ? "1/1" : "0/1" }

    /// La phrase du bandeau : celle du widget de l’écran d’accueil, selon le moment de la journée.
    private var phrase: String {
        if fait { return "Séance du jour validée" }
        if entree.repos { return "Jour de repos" }
        switch entree.humeur {
        case .matin:
            return "Une petite requête\u{202F}?"
        case .soir:
            return entree.serie > 0 ? "Ta flamme t’attend\u{202F}!" : "Allume ta flamme\u{202F}!"
        default:
            return "Séance du jour\u{00A0}: 0/1"
        }
    }

    private var libelle: String {
        if fait { return "Séance du jour validée : 1 sur 1. Ta flamme est allumée." }
        return entree.repos ? "Jour de repos." : "Séance du jour : 0 sur 1."
    }

    var body: some View {
        Group {
            switch famille {
            case .accessoryRectangular:
                bandeau
            case .accessoryInline:
                ligne
            default:
                rond
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(libelle))
    }

    /// Le rond : la flamme, et « 0/1 » dessous (un jour de repos, la flamme seule).
    private var rond: some View {
        let flamme: Font = Font.system(size: 20, weight: .bold)
        let chiffre: Font = Font.system(size: 12, weight: .heavy, design: .rounded)
        return ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Image(systemName: symbole)
                    .font(flamme)
                    .widgetAccentable()
                if !entree.repos {
                    Text(compte)
                        .font(chiffre)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
        }
    }

    /// Le bandeau : la flamme, « Requête » et la phrase du moment.
    private var bandeau: some View {
        let flamme: Font = Font.system(size: 28, weight: .bold)
        let titre: Font = Font.system(size: 15, weight: .heavy, design: .rounded)
        let texte: Font = Font.system(size: 13, weight: .semibold, design: .rounded)
        let ecart: CGFloat = 8
        return HStack(alignment: .center, spacing: ecart) {
            Image(systemName: symbole)
                .font(flamme)
                .widgetAccentable()
            VStack(alignment: .leading, spacing: 1) {
                Text("Requête")
                    .font(titre)
                    .widgetAccentable()
                Text(phrase)
                    .font(texte)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
    }

    /// La ligne de la date : la flamme et la séance du jour (un seul choix par ligne, retours-1628).
    private var ligne: some View {
        let texte: String = texteLigne
        return Label(texte, systemImage: symbole)
    }

    private var texteLigne: String {
        if fait { return "Séance du jour validée" }
        return entree.repos ? "Jour de repos" : "Séance du jour 0/1"
    }
}

extension View {
    /// iOS 17 et plus : l’écran verrouillé attend aussi containerBackground ; le fond reste transparent (le rond dessine son disque).
    @ViewBuilder
    func fondVerrou() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { Color.clear }
        } else {
            self
        }
    }
}

@available(iOS 16.1, *)
struct RequeteFlammeVerrou: Widget {
    let kind = "RequeteSerieVerrou"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SerieFournisseur()) { entree in
            VerrouVue(entree: entree).fondVerrou()
        }
        .configurationDisplayName("Ta flamme")
        .description("La flamme et la séance du jour, sur l’écran verrouillé.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

// MARK: - La cheminée : le grand widget, et le très grand d’iOS 27
//
// Elisa, 7 novembre, 16 h 03 (des captures de Tolan, Lightly et Airlearn : « des supers widgets […] créatifs, à un niveau plus
// qu’élevé ») ; de 17 h 01 à 17 h 38, les images qu’elle a générées pour la planche : la pièce (carrée, et en portrait), les trois
// feux, le trophée, la plante, le diplôme. Son choix : « Cheminée + lunettes ». La pièce du chat : le feu raconte la séance du jour
// (froid ; des braises le soir, quand elle attend ; une belle flambée quand elle est faite) et le ciel, par la fenêtre, suit l’heure
// (l’aurore, le jour, le crépuscule, la nuit). Au mur, les stickers gagnés (trois au plus) ; sur la cheminée, la plante, un trophée
// dès le premier défi réussi, un diplôme dès le premier module fini. Le très grand widget (iOS 27, en portrait) ajoute le liège (la
// dernière carte mémo gagnée et le post-it du chat, une phrase par jour) et l’écran de l’ordinateur (la prochaine leçon). Le soir,
// « Allumer ma flamme » ouvre la séance du jour (le lien requete://seance : SceneDelegate.swift, puis index.html, raccourciOuvrir).
// La pièce est le fond du widget (containerBackground) : quand iOS teinte l’écran d’accueil, il l’enlève, et la phrase, le chat et
// le bouton restent. Ses images restent sous la surface du widget (WidgetKit refuse les plus grandes) : en 2x et en 3x.

/// La lumière de la pièce, à l’heure de l’entrée : le ciel par la fenêtre et la teinte du mur.
enum Lumiere {
    case aurore       // de 5 h à midi : le soleil se lève
    case jour         // de midi à 18 h : le ciel bleu
    case crepuscule   // de 18 h à 21 h : le couchant et la lune
    case nocturne     // de 21 h à 5 h : la nuit étoilée

    init(heure: Int) {
        switch heure {
        case 5..<12: self = .aurore
        case 12..<18: self = .jour
        case 18..<21: self = .crepuscule
        default: self = .nocturne
        }
    }

    /// Le soir et la nuit, la pièce est sombre : le texte passe en blanc, sous un voile.
    var sombre: Bool {
        switch self {
        case .crepuscule, .nocturne: return true
        case .aurore, .jour: return false
        }
    }

    /// La fin du nom de l’image de la pièce (Assets.xcassets : PieceGrandMatin, PieceTresGrandNuit…).
    var nom: String {
        switch self {
        case .aurore: return "Matin"
        case .jour: return "Jour"
        case .crepuscule: return "Soir"
        case .nocturne: return "Nuit"
        }
    }
}

/// Le feu dans la cheminée : il raconte la séance du jour.
enum Feu {
    case froid     // pas encore de séance, ou un jour de repos
    case braises   // le soir, la séance attend : des braises rougeoient
    case vif       // la séance du jour est faite : une belle flambée

    var image: String {
        switch self {
        case .froid: return "FeuFroid"
        case .braises: return "FeuBraises"
        case .vif: return "FeuVif"
        }
    }
}

struct ChemineeEntree: TimelineEntry {
    let date: Date
    /// La séance du jour, avec les règles du widget de la flamme (le jour de repos du planning compris).
    let flamme: SerieEntree
    var stickers: Int = 0    // les stickers gagnés
    var trophees: Int = 0    // les défis réussis
    var diplomes: Int = 0    // les modules finis
    var prochaine: String = ""   // le titre de la prochaine activité
    var cle: String = ""         // le mot-clé de sa carte mémo (« LEFT JOIN ») ; vide pour un défi
    var defi: Bool = false       // la prochaine activité est un défi
    var carte: String = ""       // le mot-clé de la dernière carte mémo gagnée

    var heure: Int { Calendar.current.component(.hour, from: date) }
    var lumiere: Lumiere { Lumiere(heure: heure) }
    var fait: Bool { flamme.faitAujourdhui }
    var repos: Bool { flamme.repos }

    var feu: Feu {
        if fait { return .vif }
        if repos { return .froid }
        return heure >= 18 ? .braises : .froid
    }

    /// De 18 h à minuit, un jour de séance pas encore faite : les braises, « Ta flamme t’attend ! », le bouton.
    var attendLeSoir: Bool { !fait && !repos && heure >= 18 }

    var minuit: Date {
        let cal = Calendar.current
        let debut: Date = cal.startOfDay(for: date)
        return cal.date(byAdding: .day, value: 1, to: debut) ?? date
    }

    var titre: String {
        if fait { return "Flamme allumée\u{202F}!" }
        if repos { return "Jour de repos\u{202F}!" }
        if heure < 5 { return "Chut, le chat dort…" }
        if heure < 18 { return "Une petite requête\u{202F}?" }
        return flamme.serie > 0 ? "Ta flamme t’attend\u{202F}!" : "Allume ta flamme\u{202F}!"
    }

    /// Sous le titre ; le soir, le temps qu’il reste avant minuit le remplace (ChemineeVue).
    var sousTitre: String {
        if fait { return lumiere == .nocturne ? "Bonne nuit." : "Bien joué, à demain." }
        if repos { return "Ta flamme tient sans séance aujourd’hui." }
        if heure < 12 { return "La cheminée est froide." }
        return "Quelques minutes suffisent."
    }

    /// La pose du chat : il dort la nuit, se réveille le matin, travaille l’après-midi et tient sa bougie le soir ; il saute de joie
    /// quand la séance est faite, et salue un jour de repos.
    var chat: String {
        let dort: Bool = lumiere == .nocturne
        if fait { return dort ? "ChatDodo" : "ChatBravo" }
        if repos { return dort ? "ChatDodo" : "ChatSalut" }
        if heure < 5 { return "ChatDodo" }
        if heure < 12 { return "ChatReveil" }
        if heure < 18 { return "ChatOrdi" }
        return "ChatAllumette"
    }

    /// L’écran de l’ordinateur (très grand widget) : la prochaine activité, en mot-clé SQL quand sa carte mémo en a un.
    var ecranMot: String { cle.isEmpty ? prochaine : cle }

    var ecranEtiquette: String { defi ? "Prochain défi" : "Prochaine leçon" }

    var libelle: String {
        if fait { return "La cheminée flambe\u{00A0}: séance du jour validée, ta flamme est allumée." }
        if repos { return "La cheminée\u{00A0}: jour de repos." }
        return attendLeSoir ? "La cheminée\u{00A0}: ta flamme t’attend, séance du jour 0 sur 1." : "La cheminée\u{00A0}: séance du jour 0 sur 1."
    }
}

extension SerieFournisseur {
    /// Le jour de la flamme pour la cheminée : les mêmes règles que le widget de la flamme (entree(pour:)).
    func flammeDu(_ date: Date) -> SerieEntree {
        entree(pour: date)
    }
}

struct ChemineeFournisseur: TimelineProvider {
    func placeholder(in context: Context) -> ChemineeEntree {
        ChemineeFournisseur.exemple(Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (ChemineeEntree) -> Void) {
        let e = entree(pour: Date())
        // Dans la galerie des widgets, une pièce vide ne dirait rien : la flambée du soir, avec ses objets.
        if context.isPreview && e.flamme.serie == 0 && !e.fait {
            completion(ChemineeFournisseur.exemple(Date()))
        } else {
            completion(e)
        }
    }

    /// Une entrée maintenant, puis à chaque changement de la pièce (minuit, 5 h, midi, 18 h, 21 h) sur sept jours.
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChemineeEntree>) -> Void) {
        let cal = Calendar.current
        let maintenant = Date()
        let aujourdhui = cal.startOfDay(for: maintenant)
        var dates = [maintenant]
        for j in 0...7 {
            guard let jour = cal.date(byAdding: .day, value: j, to: aujourdhui) else { break }
            for heure in [0, 5, 12, 18, 21] {
                guard let d = cal.date(bySettingHour: heure, minute: 0, second: 0, of: jour), d > maintenant else { continue }
                dates.append(d)
            }
        }
        completion(Timeline(entries: dates.map { entree(pour: $0) }, policy: .atEnd))
    }

    /// La séance du jour (comme le widget de la flamme), et ce que l’app range pour la pièce (RequeteWidgetPlugin.swift, maj).
    private func entree(pour date: Date) -> ChemineeEntree {
        let d = UserDefaults(suiteName: groupe)
        let flamme: SerieEntree = SerieFournisseur().flammeDu(date)
        var e = ChemineeEntree(date: date, flamme: flamme)
        e.stickers = max(0, d?.integer(forKey: "stickers") ?? 0)
        e.trophees = max(0, d?.integer(forKey: "trophees") ?? 0)
        e.diplomes = max(0, d?.integer(forKey: "diplomes") ?? 0)
        e.prochaine = d?.string(forKey: "prochaine") ?? ""
        e.cle = d?.string(forKey: "cle") ?? ""
        e.defi = d?.bool(forKey: "defi") ?? false
        e.carte = d?.string(forKey: "carte") ?? ""
        return e
    }

    /// La galerie des widgets : la flambée de 21 h 30, trois stickers, le trophée, le diplôme.
    static func exemple(_ date: Date) -> ChemineeEntree {
        let soir: Date = Calendar.current.date(bySettingHour: 21, minute: 30, second: 0, of: date) ?? date
        var e = ChemineeEntree(date: soir, flamme: SerieEntree(date: soir, serie: 5, faitAujourdhui: true))
        e.stickers = 3
        e.trophees = 1
        e.diplomes = 1
        e.prochaine = "LEFT JOIN"
        e.cle = "LEFT JOIN"
        e.carte = "GROUP BY"
        return e
    }
}

private let lavande = Color(red: 0.894, green: 0.851, blue: 1.0)
private let violetVif = Color(red: 0.478, green: 0.361, blue: 1.0)
private let lilas = Color(red: 0.643, green: 0.545, blue: 1.0)
private let lilasClair = Color(red: 0.839, green: 0.8, blue: 1.0)
private let lilasPale = Color(red: 0.725, green: 0.682, blue: 0.91)
private let sousClair = Color(red: 0.294, green: 0.247, blue: 0.549)
private let jauneNote = Color(red: 1.0, green: 0.957, blue: 0.722)
private let encreNote = Color(red: 0.231, green: 0.18, blue: 0.102)
private let ombreObjet: Color = encre.opacity(0.25)

/// La lueur du feu dans la pièce : dorée au cœur d’une flambée, orangée autour ; orangée seule, des braises.
private let haloVifArrets: [Gradient.Stop] = [
    Gradient.Stop(color: dore.opacity(0.42), location: 0),
    Gradient.Stop(color: braise.opacity(0.18), location: 0.5),
    Gradient.Stop(color: braise.opacity(0), location: 1)
]
private let haloBraisesArrets: [Gradient.Stop] = [
    Gradient.Stop(color: braise.opacity(0.3), location: 0),
    Gradient.Stop(color: braise.opacity(0), location: 1)
]

/// Le voile du haut : plus sombre au crépuscule (le couchant est clair), plus léger la nuit.
private let voileSoirArrets: [Gradient.Stop] = [
    Gradient.Stop(color: encre.opacity(0.5), location: 0),
    Gradient.Stop(color: encre.opacity(0.34), location: 0.55),
    Gradient.Stop(color: encre.opacity(0), location: 1)
]
private let voileNuitArrets: [Gradient.Stop] = [
    Gradient.Stop(color: encre.opacity(0.3), location: 0),
    Gradient.Stop(color: encre.opacity(0), location: 1)
]

/// L’étoile du deuxième sticker (dans un carré de 40, comme la planche) et celle de la carte mémo (dans un carré de 24).
private let etoileSticker: [CGPoint] = [
    CGPoint(x: 20, y: 9), CGPoint(x: 23.2, y: 16.4), CGPoint(x: 31, y: 17.2), CGPoint(x: 25.2, y: 22.4), CGPoint(x: 26.8, y: 30),
    CGPoint(x: 20, y: 26), CGPoint(x: 13.2, y: 30), CGPoint(x: 14.8, y: 22.4), CGPoint(x: 9, y: 17.2), CGPoint(x: 16.8, y: 16.4)
]
private let etoileCarte: [CGPoint] = [
    CGPoint(x: 12, y: 3), CGPoint(x: 14.6, y: 8.9), CGPoint(x: 21, y: 9.6), CGPoint(x: 16.2, y: 13.9), CGPoint(x: 17.6, y: 20.2),
    CGPoint(x: 12, y: 16.9), CGPoint(x: 6.4, y: 20.2), CGPoint(x: 7.8, y: 13.9), CGPoint(x: 3, y: 9.6), CGPoint(x: 9.4, y: 8.9)
]

/// Le post-it du chat (très grand widget) : une phrase par jour, à tour de rôle.
private let notesDuChat: [String] = [
    "WHERE avant DELETE\u{202F}!",
    "Un JOIN par jour.",
    "GROUP BY, puis HAVING.",
    "SELECT * FROM croquettes",
    "Ranger avec ORDER BY.",
    "Une requête ce soir\u{202F}?",
    "Penser à la virgule\u{202F}!"
]

private func noteDuChat(_ date: Date) -> String {
    let jour: Int = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 1
    return notesDuChat[jour % notesDuChat.count]
}

/// « requete://seance » : le bouton du soir ouvre la séance du jour. Construit par morceaux : les tests lisent ce fichier sans ses
/// commentaires, et deux barres obliques écrites dans le code y passeraient pour un commentaire.
private let lienSeance: URL = {
    var c = URLComponents()
    c.scheme = "requete"
    c.host = "seance"
    return c.url ?? URL(fileURLWithPath: "/")
}()

/// Où sont les choses dans la pièce, en pixels de l’image d’origine (1254 × 1254 pour le grand widget, 1024 × 1536 pour le très
/// grand), relevées sur la planche du 7 novembre. `reference` est l’échelle de la planche (un widget de 364 points de large) : les
/// textes posés dans la pièce en partent.
struct Agencement {
    let tresGrand: Bool
    let image: CGSize
    let reference: CGFloat
    let piece: String
    let foyer: CGRect        // l’ouverture de la cheminée, en arche
    let feu: CGRect          // le feu (son image carrée a des bords transparents)
    let haloBraises: CGPoint
    let rayonBraises: CGFloat
    let haloVif: CGPoint
    let rayonVif: CGFloat
    let autocollant: CGRect  // les stickers, au mur
    let etoile: CGRect
    let sql: CGRect
    let trophee: CGRect      // sur la cheminée
    let plante: CGRect
    let diplome: CGRect
    let carte: CGRect        // le liège et l’écran : très grand widget seulement
    let note: CGRect
    let ecran: CGRect

    static let grand = Agencement(
        tresGrand: false, image: CGSize(width: 1254, height: 1254), reference: 0.30463, piece: "PieceGrand",
        foyer: CGRect(x: 689.4, y: 590.9, width: 315.1, height: 370.9),
        feu: CGRect(x: 676.2, y: 630.3, width: 341.4, height: 341.4),
        haloBraises: CGPoint(x: 847, y: 925.7), rayonBraises: 444.6,
        haloVif: CGPoint(x: 847, y: 820.7), rayonVif: 694.9,
        autocollant: CGRect(x: 548.2, y: 190.4, width: 87.7, height: 131.3),
        etoile: CGRect(x: 732, y: 210.1, width: 98.5, height: 98.5),
        sql: CGRect(x: 889.6, y: 210.1, width: 164.1, height: 78.8),
        trophee: CGRect(x: 595.5, y: 342.4, width: 117.2, height: 117.2),
        plante: CGRect(x: 800.3, y: 359.1, width: 97.8, height: 97.8),
        diplome: CGRect(x: 986.5, y: 331.2, width: 125.7, height: 125.7),
        carte: CGRect.zero, note: CGRect.zero, ecran: CGRect.zero
    )

    static let portrait = Agencement(
        tresGrand: true, image: CGSize(width: 1024, height: 1536), reference: 0.38672, piece: "PieceTresGrand",
        foyer: CGRect(x: 548.2, y: 853.3, width: 287, height: 343.9),
        feu: CGRect(x: 536.6, y: 896.3, width: 310.3, height: 310.3),
        haloBraises: CGPoint(x: 693, y: 1137.8), rayonBraises: 472,
        haloVif: CGPoint(x: 693, y: 1034.3), rayonVif: 733.5,
        autocollant: CGRect(x: 475.8, y: 170.7, width: 69, height: 103.4),
        etoile: CGRect(x: 630.9, y: 186.2, width: 77.6, height: 77.6),
        sql: CGRect(x: 770.6, y: 186.2, width: 129.3, height: 62.1),
        trophee: CGRect(x: 487.2, y: 647.2, width: 92.3, height: 92.3),
        plante: CGRect(x: 648.5, y: 660.4, width: 77.1, height: 77.1),
        diplome: CGRect(x: 795.2, y: 638.5, width: 99, height: 99),
        carte: CGRect(x: 486.1, y: 377.5, width: 165.5, height: 212),
        note: CGRect(x: 713.7, y: 382.7, width: 181, height: 206.9),
        ecran: CGRect(x: 77.6, y: 708.5, width: 268.9, height: 160)
    )

    /// Le très grand widget est en portrait : bien plus haut que large.
    static func pour(_ taille: CGSize) -> Agencement {
        taille.height > taille.width * 1.25 ? portrait : grand
    }
}

/// La pièce posée sur le widget comme un fond qui le remplit (centrée, rognée sur les bords) : un point de l’image d’origine, ramené
/// au widget.
struct PlanPiece {
    let s: CGFloat
    let ox: CGFloat
    let oy: CGFloat

    init(_ taille: CGSize, image: CGSize) {
        let e: CGFloat = max(taille.width / image.width, taille.height / image.height)
        s = e
        ox = (taille.width - image.width * e) / 2
        oy = (taille.height - image.height * e) / 2
    }

    func x(_ v: CGFloat) -> CGFloat { ox + v * s }
    func y(_ v: CGFloat) -> CGFloat { oy + v * s }
    func l(_ v: CGFloat) -> CGFloat { v * s }
}

extension View {
    /// Posée dans la pièce : un cadre en pixels de l’image d’origine, ramené au widget.
    func dansPiece(_ r: CGRect, _ p: PlanPiece) -> some View {
        let largeur: CGFloat = p.l(r.width)
        let hauteur: CGFloat = p.l(r.height)
        let cx: CGFloat = p.x(r.midX)
        let cy: CGFloat = p.y(r.midY)
        return self
            .frame(width: largeur, height: hauteur)
            .position(x: cx, y: cy)
    }
}

/// L’ouverture de la cheminée : un rectangle au haut arrondi en demi-cercle (deux quarts de cercle, en courbes de Bézier : pas de
/// sens de rotation à deviner dans le repère de SwiftUI, dont l’axe vertical descend).
struct Arche: Shape {
    func path(in r: CGRect) -> Path {
        let rayon: CGFloat = min(r.width / 2, r.height)
        let k: CGFloat = rayon * 0.5523
        let epaule: CGFloat = r.minY + rayon
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: epaule))
        p.addCurve(to: CGPoint(x: r.midX, y: r.minY), control1: CGPoint(x: r.minX, y: epaule - k), control2: CGPoint(x: r.midX - k, y: r.minY))
        p.addCurve(to: CGPoint(x: r.maxX, y: epaule), control1: CGPoint(x: r.midX + k, y: r.minY), control2: CGPoint(x: r.maxX, y: epaule - k))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.closeSubpath()
        return p
    }
}

/// Un tracé de la planche (des points dans un carré de côté `cote`), mis à l’échelle de son cadre.
struct Trace: Shape {
    let points: [CGPoint]
    let cote: CGFloat

    func path(in r: CGRect) -> Path {
        let e: CGFloat = min(r.width, r.height) / cote
        var p = Path()
        guard let premier = points.first else { return p }
        p.move(to: CGPoint(x: r.minX + premier.x * e, y: r.minY + premier.y * e))
        for q in points.dropFirst() {
            p.addLine(to: CGPoint(x: r.minX + q.x * e, y: r.minY + q.y * e))
        }
        p.closeSubpath()
        return p
    }
}

/// Le deuxième sticker : un rond violet cerclé de blanc, et son étoile dorée.
struct EtoileAutocollant: View {
    var body: some View {
        GeometryReader { g in
            dessin(min(g.size.width, g.size.height))
        }
    }

    private func dessin(_ c: CGFloat) -> some View {
        let rond: CGFloat = c * 34 / 40
        let trait: CGFloat = c * 3 / 40
        return ZStack {
            Circle()
                .fill(violetVif)
                .frame(width: rond, height: rond)
            Circle()
                .stroke(Color.white, lineWidth: trait)
                .frame(width: rond, height: rond)
            Trace(points: etoileSticker, cote: 40)
                .fill(dore)
                .frame(width: c, height: c)
        }
        .frame(width: c, height: c)
    }
}

/// La pièce : le mur et la fenêtre (le ciel est peint dans l’image), le feu dans l’arche de la cheminée, la lueur du feu, puis les
/// stickers et les objets ; dans le très grand widget, le liège et l’écran. C’est le fond du widget (fondCheminee).
struct PieceVue: View {
    let entree: ChemineeEntree

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    private func contenu(_ taille: CGSize) -> some View {
        let ag: Agencement = Agencement.pour(taille)
        let p: PlanPiece = PlanPiece(taille, image: ag.image)
        let nom: String = ag.piece + entree.lumiere.nom
        let largeur: CGFloat = p.l(ag.image.width)
        let hauteur: CGFloat = p.l(ag.image.height)
        let cx: CGFloat = taille.width / 2
        let cy: CGFloat = taille.height / 2
        return ZStack(alignment: .topLeading) {
            Image(nom)
                .resizable()
                .frame(width: largeur, height: hauteur)
                .position(x: cx, y: cy)
            foyer(ag, p)
            halo(ag, p, taille)
            voile(taille)
            murEtCheminee(ag, p)
            if ag.tresGrand {
                liege(ag, p)
                ecran(ag, p)
            }
        }
        .frame(width: taille.width, height: taille.height)
        .clipped()
    }

    /// Le feu dans l’arche, sur sa lueur : il passe de l’un à l’autre en fondu quand la séance du jour est faite.
    private func foyer(_ ag: Agencement, _ p: PlanPiece) -> some View {
        let arche: CGRect = ag.foyer
        let largeur: CGFloat = p.l(arche.width)
        let hauteur: CGFloat = p.l(arche.height)
        let cote: CGFloat = p.l(ag.feu.width)
        let decalX: CGFloat = p.l(ag.feu.minX - arche.minX)
        let decalY: CGFloat = p.l(ag.feu.minY - arche.minY)
        let cx: CGFloat = p.x(arche.midX)
        let cy: CGFloat = p.y(arche.midY)
        let feu: Feu = entree.feu
        let fondu: Animation = .easeInOut(duration: 0.6)
        return ZStack(alignment: .topLeading) {
            lueur(largeur)
            Image(feu.image)
                .resizable()
                .frame(width: cote, height: cote)
                .offset(x: decalX, y: decalY)
                .id(feu)
                .transition(.opacity)
        }
        .frame(width: largeur, height: hauteur, alignment: .topLeading)
        .clipShape(Arche())
        .position(x: cx, y: cy)
        .animation(fondu, value: feu)
    }

    /// La lueur au fond de l’arche : orangée sous des braises, dorée sous une flambée ; rien, la cheminée froide.
    private func lueur(_ largeur: CGFloat) -> some View {
        let vif: Bool = entree.feu == .vif
        let coeur: Color = vif ? dore : braise
        let force: Double = vif ? 0.62 : 0.55
        let visible: Double = entree.feu == .froid ? 0 : 1
        let bas: CGFloat = vif ? 0.76 : 0.885
        let part: CGFloat = vif ? 0.74 : 0.72
        let rayon: CGFloat = largeur * part
        let couleurs: [Color] = [coeur.opacity(force), braise.opacity(0)]
        let centre = UnitPoint(x: 0.5, y: bas)
        return RadialGradient(gradient: Gradient(colors: couleurs), center: centre, startRadius: 0, endRadius: rayon)
            .opacity(visible)
    }

    /// La lueur du feu dans toute la pièce.
    private func halo(_ ag: Agencement, _ p: PlanPiece, _ taille: CGSize) -> some View {
        let vif: Bool = entree.feu == .vif
        let point: CGPoint = vif ? ag.haloVif : ag.haloBraises
        let rayonImage: CGFloat = vif ? ag.rayonVif : ag.rayonBraises
        let rayon: CGFloat = p.l(rayonImage)
        let centre = UnitPoint(x: p.x(point.x) / taille.width, y: p.y(point.y) / taille.height)
        let arrets: [Gradient.Stop] = vif ? haloVifArrets : haloBraisesArrets
        let visible: Double = entree.feu == .froid ? 0 : 1
        return RadialGradient(gradient: Gradient(stops: arrets), center: centre, startRadius: 0, endRadius: rayon)
            .opacity(visible)
            .frame(width: taille.width, height: taille.height)
    }

    /// En haut, le soir et la nuit, un voile sombre : le texte blanc se lit sur le mur.
    private func voile(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 364
        let hauteur: CGFloat = 96 * u
        let arrets: [Gradient.Stop] = entree.lumiere == .crepuscule ? voileSoirArrets : voileNuitArrets
        let visible: Double = entree.lumiere.sombre ? 1 : 0
        let cx: CGFloat = taille.width / 2
        let cy: CGFloat = hauteur / 2
        return LinearGradient(gradient: Gradient(stops: arrets), startPoint: .top, endPoint: .bottom)
            .frame(width: taille.width, height: hauteur)
            .opacity(visible)
            .position(x: cx, y: cy)
    }

    /// Au mur, les stickers gagnés (trois au plus : la mascotte, l’étoile, « <SQL> ») ; sur la cheminée, le trophée dès le premier
    /// défi réussi, la plante, le diplôme dès le premier module fini.
    private func murEtCheminee(_ ag: Agencement, _ p: PlanPiece) -> some View {
        let k: CGFloat = p.s / ag.reference
        let flou: CGFloat = 2.5 * k
        let chute: CGFloat = 3 * k
        return ZStack(alignment: .topLeading) {
            if entree.stickers >= 1 {
                Image("Autocollant")
                    .resizable()
                    .rotationEffect(.degrees(-8))
                    .shadow(color: ombreObjet, radius: flou, x: 0, y: chute)
                    .dansPiece(ag.autocollant, p)
            }
            if entree.stickers >= 2 {
                EtoileAutocollant()
                    .rotationEffect(.degrees(10))
                    .shadow(color: ombreObjet, radius: flou, x: 0, y: chute)
                    .dansPiece(ag.etoile, p)
            }
            if entree.stickers >= 3 {
                etiquetteSQL(k)
                    .rotationEffect(.degrees(-6))
                    .dansPiece(ag.sql, p)
            }
            if entree.trophees > 0 {
                objet("Trophee", ag.trophee, p, k)
            }
            objet("Plante", ag.plante, p, k)
            if entree.diplomes > 0 {
                objet("Diplome", ag.diplome, p, k)
            }
        }
    }

    private func objet(_ nom: String, _ r: CGRect, _ p: PlanPiece, _ k: CGFloat) -> some View {
        let flou: CGFloat = 1.5 * k
        let chute: CGFloat = 2 * k
        return Image(nom)
            .resizable()
            .shadow(color: ombreObjet, radius: flou, x: 0, y: chute)
            .dansPiece(r, p)
    }

    /// Le troisième sticker : « <SQL> » sur une étiquette blanche.
    private func etiquetteSQL(_ k: CGFloat) -> some View {
        let police: Font = Font.system(size: 10.5 * k, weight: .heavy, design: .monospaced)
        let coin: CGFloat = 8 * k
        let flou: CGFloat = 3 * k
        let chute: CGFloat = 3 * k
        let fond = RoundedRectangle(cornerRadius: coin, style: .continuous).fill(Color.white)
        let texte: Text = Text("<SQL>").font(police).foregroundColor(violetTexte)
        return texte
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(fond)
            .shadow(color: ombreObjet, radius: flou, x: 0, y: chute)
    }

    /// Sur le liège (très grand widget) : la dernière carte mémo gagnée, punaisée, et le post-it du chat.
    private func liege(_ ag: Agencement, _ p: PlanPiece) -> some View {
        let k: CGFloat = p.s / ag.reference
        return ZStack(alignment: .topLeading) {
            if !entree.carte.isEmpty {
                carteMemo(k)
                    .rotationEffect(.degrees(-5))
                    .dansPiece(ag.carte, p)
                punaise(braise, ag.carte, p)
            }
            postIt(k)
                .rotationEffect(.degrees(4))
                .dansPiece(ag.note, p)
            punaise(violetVif, ag.note, p)
        }
    }

    /// La punaise, au milieu du haut.
    private func punaise(_ couleur: Color, _ r: CGRect, _ p: PlanPiece) -> some View {
        let tete = CGRect(x: r.midX - 11.65, y: r.minY - 7.65, width: 23.3, height: 23.3)
        let flou: CGFloat = p.l(3)
        let chute: CGFloat = p.l(3)
        let ombre: Color = Color.black.opacity(0.3)
        return Circle()
            .fill(couleur)
            .shadow(color: ombre, radius: flou, x: 0, y: chute)
            .dansPiece(tete, p)
    }

    /// La carte mémo : l’étoile dorée et le mot-clé, sur le violet des cartes de l’app.
    private func carteMemo(_ k: CGFloat) -> some View {
        let coin: CGFloat = 8 * k
        let etoile: CGFloat = 20 * k
        let police: Font = Font.system(size: 9.5 * k, weight: .heavy, design: .monospaced)
        let haut: CGFloat = 12 * k
        let bas: CGFloat = 10 * k
        let cote: CGFloat = 4 * k
        let flou: CGFloat = 4 * k
        let chute: CGFloat = 4 * k
        let degrade = LinearGradient(gradient: Gradient(colors: [violetVif, violetTexte]), startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
        let fond = RoundedRectangle(cornerRadius: coin, style: .continuous).fill(degrade)
        let ombre: Color = encre.opacity(0.3)
        let mot: String = entree.carte
        return VStack(spacing: 0) {
            Trace(points: etoileCarte, cote: 24)
                .fill(dore)
                .frame(width: etoile, height: etoile)
            Spacer(minLength: 0)
            Text(mot)
                .font(police)
                .foregroundColor(Color.white)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.6)
        }
        .padding(.top, haut)
        .padding(.bottom, bas)
        .padding(.horizontal, cote)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(fond)
        .shadow(color: ombre, radius: flou, x: 0, y: chute)
    }

    /// Le post-it du chat, écrit à la main : une phrase par jour (notesDuChat).
    private func postIt(_ k: CGFloat) -> some View {
        let police: Font = Font.custom("Noteworthy-Bold", size: 14 * k)
        let haut: CGFloat = 10 * k
        let cote: CGFloat = 7 * k
        let bas: CGFloat = 6 * k
        let flou: CGFloat = 4 * k
        let chute: CGFloat = 4 * k
        let mot: String = noteDuChat(entree.date)
        return Text(mot)
            .font(police)
            .foregroundColor(encreNote)
            .multilineTextAlignment(.leading)
            .lineLimit(4)
            .minimumScaleFactor(0.6)
            .padding(.top, haut)
            .padding(.horizontal, cote)
            .padding(.bottom, bas)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(jauneNote)
            .shadow(color: ombreObjet, radius: flou, x: 0, y: chute)
    }

    /// L’écran de l’ordinateur (très grand widget) : « >_ », puis la prochaine leçon ou le prochain défi ; rien d’autre une fois le
    /// parcours fini.
    private func ecran(_ ag: Agencement, _ p: PlanPiece) -> some View {
        let k: CGFloat = p.s / ag.reference
        let invite: Font = Font.system(size: 14 * k, weight: .heavy, design: .monospaced)
        let etiquette: Font = Font.system(size: 10 * k, weight: .heavy, design: .rounded)
        let code: Font = Font.system(size: 14 * k, weight: .heavy, design: .monospaced)
        let titre: Font = Font.system(size: 12 * k, weight: .bold, design: .rounded)
        let enCode: Bool = !entree.cle.isEmpty
        let police: Font = enCode ? code : titre
        let quoi: String = entree.ecranEtiquette
        let mot: String = entree.ecranMot
        let ecart: CGFloat = 2 * k
        return VStack(alignment: .leading, spacing: ecart) {
            Text(">_")
                .font(invite)
                .foregroundColor(lilas)
            if !mot.isEmpty {
                Text(quoi)
                    .font(etiquette)
                    .foregroundColor(lilasPale)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(mot)
                    .font(police)
                    .foregroundColor(Color.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .dansPiece(ag.ecran, p)
    }
}

/// Par-dessus la pièce : la phrase du moment et la séance du jour (« 0/1 », puis la coche et « 1/1 » sur l’or), le chat dans sa pose
/// du moment, et le soir, « Allumer ma flamme ». Le soir, le temps qu’il reste avant minuit défile tout seul (en français).
struct ChemineeVue: View {
    let entree: ChemineeEntree

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    private var ressort: Animation { .spring(response: 0.55, dampingFraction: 0.62) }

    private func contenu(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 364
        let tresGrand: Bool = Agencement.pour(taille).tresGrand
        let hautTexte: CGFloat = (tresGrand ? 16 : 13) * u
        let marge: CGFloat = 18 * u
        let hautChat: CGFloat = (tresGrand ? 196 : 178) * u
        let bas: CGFloat = 4 * u
        let gauche: CGFloat = 6 * u
        let droite: CGFloat = 16 * u
        let basBouton: CGFloat = 14 * u
        let nomChat: String = entree.chat
        let fr = Locale(identifier: "fr_FR")
        return ZStack(alignment: .topLeading) {
            Image(nomChat)
                .resizable()
                .scaledToFit()
                .frame(height: hautChat)
                .padding(.leading, gauche)
                .padding(.bottom, bas)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .id(nomChat)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .accessibilityHidden(true)
            bandeau(u)
                .padding(.horizontal, marge)
                .padding(.top, hautTexte)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            if entree.attendLeSoir {
                bouton(u)
                    .padding(.trailing, droite)
                    .padding(.bottom, basBouton)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            }
        }
        .frame(width: taille.width, height: taille.height)
        .animation(ressort, value: nomChat)
        .environment(\.locale, fr)
    }

    /// La phrase et la séance du jour (un jour de repos du planning, pas d’objectif : la phrase seule).
    private func bandeau(_ u: CGFloat) -> some View {
        let ecart: CGFloat = 12 * u
        let lu: String = entree.libelle
        return HStack(alignment: .top, spacing: ecart) {
            phrases(u)
            Spacer(minLength: 0)
            if !entree.repos {
                puce(u)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(lu))
    }

    private func phrases(_ u: CGFloat) -> some View {
        let grand: Font = Font.system(size: 18 * u, weight: .black, design: .rounded)
        let petit: Font = Font.system(size: 13 * u, weight: .heavy, design: .rounded)
        let clair: Bool = !entree.lumiere.sombre
        let couleurTitre: Color = clair ? encre : Color.white
        let couleurSous: Color = clair ? sousClair : Color.white.opacity(0.9)
        let ombre: Color = clair ? Color.clear : encre.opacity(0.45)
        let flou: CGFloat = 3 * u
        let ecart: CGFloat = 2 * u
        let titre: String = entree.titre
        return VStack(alignment: .leading, spacing: ecart) {
            Text(titre)
                .font(grand)
                .foregroundColor(couleurTitre)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            sousTitre
                .font(petit)
                .foregroundColor(couleurSous)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .shadow(color: ombre, radius: flou, x: 0, y: 1)
    }

    /// Le soir, « Encore 3 h 12 min avant minuit. » : iOS fait défiler le temps qui reste.
    private var sousTitre: Text {
        if entree.attendLeSoir {
            let minuit: Date = entree.minuit
            return Text("Encore ") + Text(minuit, style: .relative) + Text(" avant minuit.")
        }
        let phrase: String = entree.sousTitre
        return Text(phrase)
    }

    private var puceFond: Color {
        if entree.fait { return dore }
        return entree.lumiere.sombre ? Color.white.opacity(0.2) : Color.white
    }

    private var puceBord: Color {
        if entree.fait { return dore }
        return entree.lumiere.sombre ? Color.white.opacity(0.65) : Color.white
    }

    private var puceTexte: Color {
        if entree.fait { return encre }
        return entree.lumiere.sombre ? Color.white : violetTexte
    }

    /// La séance du jour : « 0/1 », puis la coche menthe et « 1/1 » sur l’or (le chiffre roule, iOS 17).
    private func puce(_ u: CGFloat) -> some View {
        let fait: Bool = entree.fait
        let compte: String = fait ? "1/1" : "0/1"
        let valeur: Int = fait ? 1 : 0
        let police: Font = Font.system(size: 15 * u, weight: .black, design: .rounded)
        let haut: CGFloat = 5 * u
        let cote: CGFloat = 11 * u
        let ecart: CGFloat = 5 * u
        let trait: CGFloat = 1.5 * u
        let fond = Capsule().fill(puceFond)
        let bord = Capsule().stroke(puceBord, lineWidth: trait)
        return HStack(alignment: .center, spacing: ecart) {
            if fait {
                coche(u)
            }
            Text(compte)
                .font(police)
                .monospacedDigit()
                .chiffreQuiRoule(valeur)
        }
        .foregroundColor(puceTexte)
        .padding(.vertical, haut)
        .padding(.horizontal, cote)
        .background(fond)
        .overlay(bord)
    }

    private func coche(_ u: CGFloat) -> some View {
        let cote: CGFloat = 15 * u
        let police: Font = Font.system(size: 8 * u, weight: .black)
        return Image(systemName: "checkmark")
            .font(police)
            .foregroundColor(encre)
            .frame(width: cote, height: cote)
            .background(Circle().fill(menthe))
    }

    /// « Allumer ma flamme » : un appui ouvre l’app sur la séance recommandée (lienSeance).
    private func bouton(_ u: CGFloat) -> some View {
        let police: Font = Font.system(size: 13 * u, weight: .black, design: .rounded)
        let symbole: Font = Font.system(size: 14 * u, weight: .bold)
        let ecart: CGFloat = 6 * u
        let haut: CGFloat = 9 * u
        let gauche: CGFloat = 11 * u
        let droite: CGFloat = 14 * u
        let flou: CGFloat = 7 * u
        let chute: CGFloat = 6 * u
        let ombre: Color = Color(red: 0.157, green: 0.078, blue: 0.471).opacity(0.25)
        let fond = Capsule().fill(Color.white)
        return Link(destination: lienSeance) {
            HStack(alignment: .center, spacing: ecart) {
                Image(systemName: "flame.fill")
                    .font(symbole)
                    .foregroundColor(braise)
                Text("Allumer ma flamme")
                    .font(police)
                    .foregroundColor(violetTexte)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.vertical, haut)
            .padding(.leading, gauche)
            .padding(.trailing, droite)
            .background(fond)
            .shadow(color: ombre, radius: flou, x: 0, y: chute)
        }
    }
}

extension View {
    /// iOS 17 et plus : la pièce passe par containerBackground (iOS l’enlève quand il teinte l’écran d’accueil) ; avant, en fond.
    @ViewBuilder
    func fondCheminee<Fond: View>(_ fond: Fond) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { fond }
        } else {
            self.background(fond)
        }
    }
}

/// Le grand widget ; compilé avec Xcode 27 (Swift 6.4) et sur iOS 27, aussi le très grand, en portrait. Avec un Xcode plus ancien,
/// le très grand n’existe pas encore : le grand seul.
private var famillesCheminee: [WidgetFamily] {
    #if compiler(>=6.4)
    if #available(iOSApplicationExtension 27.0, *) {
        return [.systemLarge, .systemExtraLargePortrait]
    }
    #endif
    return [.systemLarge]
}

struct RequeteCheminee: Widget {
    let kind = "RequeteCheminee"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChemineeFournisseur()) { entree in
            ChemineeVue(entree: entree)
                .fondCheminee(PieceVue(entree: entree))
        }
        .configurationDisplayName("La cheminée")
        .description("La pièce du chat : le feu de la séance du jour, le ciel de l’heure, tes stickers, tes trophées et tes diplômes.")
        .supportedFamilies(famillesCheminee)
        .sansMarges()
    }
}

// MARK: - La requête de poche (widget moyen, interactif à partir d’iOS 17)
//
// Elisa, 7 novembre (« Requête de poche », d’après la planche : « Une question tirée de tes leçons. Tu réponds dans le widget, sans
// ouvrir l’app. ») : une requête à trou et trois réponses, dont une seule marche. Bonne réponse : « Bien vu ! », le chat hoche la
// tête et le trou se remplit ; sinon « Presque ! », la bonne réponse s’allume, avec le pourquoi en une ligne. La flèche passe à la
// question suivante. L’app range une vingtaine de questions des leçons faites (index.html, POCHE et widgetPoche ; le pont les
// garde, RequeteWidgetPlugin.swift). Son choix pour la flamme : « la séance seule » ; répondre ici n’allume pas la flamme du jour.
// Les boutons passent par App Intents (RepondrePoche, SuivantePoche) : ils écrivent dans le groupe d’apps, puis iOS redessine le
// widget. Avant iOS 17, les widgets n’ont pas de boutons : le widget n’existe qu’à partir d’iOS 17 (le paquet le garde derrière).

/// Une question, telle que l’app la range : le nom du module, les lignes de la requête (« ___ » à la place du trou), les trois
/// réponses, la bonne, et le pourquoi d’une bonne et d’une mauvaise réponse (les mots de SQL entre accents graves).
struct QuestionPoche: Codable, Hashable {
    let titre: String
    let code: [String]
    let choix: [String]
    let bon: Int
    let oui: String
    let non: String
}

enum EtatPoche {
    case question   // rien de touché
    case juste      // la bonne réponse
    case presque    // une autre
}

struct PocheEntree: TimelineEntry {
    let date: Date
    let question: QuestionPoche?
    var touchee: Int? = nil

    var etat: EtatPoche {
        guard let t = touchee, let q = question else { return .question }
        return t == q.bon ? .juste : .presque
    }
}

/// Ce que le widget garde dans le groupe d’apps : « poche » (les questions, rangées par l’app), « pocheIndex » (la question du
/// moment), « pocheChoix » (la réponse touchée, -1 avant).
enum PocheRangement {
    static let exemple = QuestionPoche(
        titre: "Agrégats et regroupements",
        code: ["SELECT ville, COUNT(*)", "FROM clients GROUP BY ville", "___ COUNT(*) >= 2;"],
        choix: ["WHERE", "HAVING", "ON"],
        bon: 1,
        oui: "`HAVING` filtre les groupes.",
        non: "Après `GROUP BY`, c’est `HAVING`."
    )

    static func questions() -> [QuestionPoche] {
        let d = UserDefaults(suiteName: groupe)
        guard let texte = d?.string(forKey: "poche"), let donnees = texte.data(using: .utf8) else { return [] }
        let liste: [QuestionPoche] = (try? JSONDecoder().decode([QuestionPoche].self, from: donnees)) ?? []
        return liste.filter { q in
            q.choix.count >= 2 && q.bon >= 0 && q.bon < q.choix.count && !q.code.isEmpty
        }
    }

    static func entree(_ date: Date) -> PocheEntree {
        let d = UserDefaults(suiteName: groupe)
        let liste: [QuestionPoche] = questions()
        guard !liste.isEmpty else { return PocheEntree(date: date, question: nil) }
        let rang: Int = max(0, d?.integer(forKey: "pocheIndex") ?? 0) % liste.count
        let q: QuestionPoche = liste[rang]
        let touchee: Int = (d?.object(forKey: "pocheChoix") as? Int) ?? -1
        let valide: Bool = touchee >= 0 && touchee < q.choix.count
        var e = PocheEntree(date: date, question: q)
        if valide {
            e.touchee = touchee
        }
        return e
    }

    /// La réponse touchée : une seule fois par question (la suivante remet à zéro).
    static func repondre(_ choix: Int) {
        let d = UserDefaults(suiteName: groupe)
        let deja: Int = (d?.object(forKey: "pocheChoix") as? Int) ?? -1
        if deja < 0 {
            d?.set(choix, forKey: "pocheChoix")
        }
    }

    /// La question suivante ; après la dernière, la première revient.
    static func suivante() {
        let d = UserDefaults(suiteName: groupe)
        let n: Int = questions().count
        let i: Int = d?.integer(forKey: "pocheIndex") ?? 0
        let apres: Int = n > 0 ? (i + 1) % n : 0
        d?.set(apres, forKey: "pocheIndex")
        d?.set(-1, forKey: "pocheChoix")
    }

    static func bonne(_ q: QuestionPoche) -> String {
        q.bon >= 0 && q.bon < q.choix.count ? q.choix[q.bon] : ""
    }

    static func chat(_ etat: EtatPoche) -> String {
        switch etat {
        case .question: return "ChatQuestion"
        case .juste: return "ChatOui"
        case .presque: return "ChatEffort"
        }
    }

    static func hauteurChat(_ etat: EtatPoche) -> CGFloat {
        switch etat {
        case .question: return 130
        case .juste: return 126
        case .presque: return 114
        }
    }

    /// Une ligne de code, colorée comme la console de l’app : mots-clés lilas, fonctions menthe, nombres et textes dorés,
    /// commentaires gris.
    static func code(_ ligne: String) -> Text {
        var t = Text(verbatim: "")
        for b in BoutCode.decouper(ligne) {
            t = t + b.texte
        }
        return t
    }

    /// Le pourquoi : les mots entre accents graves s’écrivent en code.
    static func explication(_ s: String, _ police: Font, _ code: Font) -> Text {
        let morceaux: [String] = s.components(separatedBy: "`")
        var t = Text(verbatim: "")
        for (i, m) in morceaux.enumerated() {
            let enCode: Bool = i % 2 == 1
            let f: Font = enCode ? code : police
            t = t + Text(verbatim: m).font(f)
        }
        return t
    }

    /// La taille du code : 11,5 points au plus ; moins pour une ligne longue (le trou compte pour la plus longue réponse) ou une
    /// requête de quatre lignes.
    static func policeCode(_ q: QuestionPoche, u: CGFloat, v: CGFloat) -> CGFloat {
        let trou: Int = (q.choix.map { $0.count }.max() ?? 3) + 1
        let longueurs: [Int] = q.code.map { $0.replacingOccurrences(of: "___", with: String(repeating: "x", count: trou)).count }
        let plusLongue: Int = max(1, longueurs.max() ?? 1)
        let parLargeur: CGFloat = 222 * u / (0.61 * CGFloat(plusLongue))
        let parHauteur: CGFloat = 54 * v / (1.3 * CGFloat(max(3, q.code.count)))
        return min(11.5 * u, parLargeur, parHauteur)
    }
}

/// Un morceau de code et sa couleur.
struct BoutCode {
    let texte: Text

    private static let motsCles: Set<String> = [
        "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN", "ORDER", "BY", "GROUP", "HAVING",
        "LIMIT", "OFFSET", "AS", "DISTINCT", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON", "UNION", "ALL",
        "INTERSECT", "EXCEPT", "WITH", "RECURSIVE", "CASE", "WHEN", "THEN", "ELSE", "END", "INSERT", "INTO", "VALUES", "UPDATE",
        "SET", "DELETE", "CREATE", "TABLE", "VIEW", "INDEX", "DROP", "ALTER", "ADD", "COLUMN", "PRIMARY", "KEY", "REFERENCES",
        "CASCADE", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "TO", "TRANSACTION", "ISOLATION", "SERIALIZABLE", "GRANT", "REVOKE",
        "CALL", "TRIGGER", "AFTER", "BEFORE", "EACH", "ROW", "ROWS", "OVER", "PARTITION", "PRECEDING", "FOLLOWING", "UNBOUNDED",
        "CURRENT", "DESC", "ASC", "EXISTS", "ANY", "SCHEMA", "MERGE", "USING", "MATCHED", "INTEGER", "TEXT", "REAL", "DATE"
    ]

    private static func morceau(_ s: String, _ couleur: Color, gras: Bool = false) -> BoutCode {
        let t: Text = Text(verbatim: s).foregroundColor(couleur)
        if gras {
            return BoutCode(texte: t.fontWeight(.bold))
        }
        return BoutCode(texte: t)
    }

    static func decouper(_ ligne: String) -> [BoutCode] {
        let c: [Character] = Array(ligne)
        var bouts: [BoutCode] = []
        var i = 0
        while i < c.count {
            let x: Character = c[i]
            if x == "-" && i + 1 < c.count && c[i + 1] == "-" {
                bouts.append(morceau(String(c[i...]), commentaireCode))
                break
            }
            if x == "'" {
                var j = i + 1
                while j < c.count && c[j] != "'" { j += 1 }
                let fin: Int = min(j + 1, c.count)
                bouts.append(morceau(String(c[i..<fin]), dore))
                i = fin
                continue
            }
            if x.isLetter || x == "_" {
                var j = i
                while j < c.count && (c[j].isLetter || c[j].isNumber || c[j] == "_") { j += 1 }
                let mot = String(c[i..<j])
                let appel: Bool = j < c.count && c[j] == "("
                let capitales: Bool = mot == mot.uppercased()
                if appel && capitales {
                    bouts.append(morceau(mot, menthe))
                } else if capitales && motsCles.contains(mot) {
                    bouts.append(morceau(mot, motCleCode, gras: true))
                } else {
                    bouts.append(morceau(mot, Color.white))
                }
                i = j
                continue
            }
            if x.isNumber {
                var j = i
                while j < c.count && (c[j].isNumber || c[j] == ".") { j += 1 }
                bouts.append(morceau(String(c[i..<j]), dore))
                i = j
                continue
            }
            bouts.append(morceau(String(x), Color.white))
            i += 1
        }
        return bouts
    }
}

private let motCleCode = Color(red: 0.725, green: 0.651, blue: 1.0)
private let commentaireCode = Color(red: 0.557, green: 0.529, blue: 0.722)
private let gristexte = Color(red: 0.416, green: 0.376, blue: 0.651)
private let encrePoche = Color(red: 0.231, green: 0.18, blue: 0.549)
private let sousPoche = Color(red: 0.31, green: 0.282, blue: 0.502)
private let vertBord = Color(red: 0.298, green: 0.788, blue: 0.549)
private let vertFonce = Color(red: 0.059, green: 0.239, blue: 0.161)
private let vertTexte = Color(red: 0.059, green: 0.42, blue: 0.263)
private let braiseFond = Color(red: 1.0, green: 0.882, blue: 0.8)
private let braiseTexte = Color(red: 0.478, green: 0.18, blue: 0.0)
private let presqueTexte = Color(red: 0.604, green: 0.227, blue: 0.0)
private let fondPoche = LinearGradient(gradient: Gradient(colors: [Color.white, Color(red: 0.953, green: 0.937, blue: 1.0)]), startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))

/// L’allure d’une réponse : au repos ; la bonne (menthe, sa coche) ; celle qu’on attendait (cerclée de vert) ; la mauvaise touchée
/// (braise, sa croix) ; les autres, pâlies.
struct StylePuce {
    let fond: Color
    let bord: Color
    let texte: Color
    let opacite: Double
    let symbole: String?

    static let repos = StylePuce(fond: Color(red: 0.965, green: 0.953, blue: 1.0), bord: Color(red: 0.882, green: 0.855, blue: 1.0), texte: encrePoche, opacite: 1, symbole: nil)
    static let pale = StylePuce(fond: Color(red: 0.965, green: 0.953, blue: 1.0), bord: Color(red: 0.882, green: 0.855, blue: 1.0), texte: encrePoche, opacite: 0.45, symbole: nil)
    static let bonne = StylePuce(fond: menthe, bord: vertBord, texte: vertFonce, opacite: 1, symbole: "checkmark")
    static let attendue = StylePuce(fond: Color.white, bord: vertBord, texte: vertTexte, opacite: 1, symbole: nil)
    static let ratee = StylePuce(fond: braiseFond, bord: braise, texte: braiseTexte, opacite: 1, symbole: "xmark")

    static func pour(_ i: Int, _ e: PocheEntree, _ q: QuestionPoche) -> StylePuce {
        switch e.etat {
        case .question:
            return repos
        case .juste:
            return i == q.bon ? bonne : pale
        case .presque:
            if i == q.bon { return attendue }
            return i == e.touchee ? ratee : pale
        }
    }
}

@available(iOS 17.0, *)
struct RepondrePoche: AppIntent {
    static let title: LocalizedStringResource = "Répondre à la requête de poche"
    static let isDiscoverable: Bool = false

    @Parameter(title: "Réponse")
    var choix: Int

    init() {}

    init(choix: Int) {
        self.choix = choix
    }

    func perform() async throws -> some IntentResult {
        PocheRangement.repondre(choix)
        return .result()
    }
}

@available(iOS 17.0, *)
struct SuivantePoche: AppIntent {
    static let title: LocalizedStringResource = "Question suivante de la requête de poche"
    static let isDiscoverable: Bool = false

    init() {}

    func perform() async throws -> some IntentResult {
        PocheRangement.suivante()
        return .result()
    }
}

struct PocheFournisseur: TimelineProvider {
    func placeholder(in context: Context) -> PocheEntree {
        PocheEntree(date: Date(), question: PocheRangement.exemple)
    }

    func getSnapshot(in context: Context, completion: @escaping (PocheEntree) -> Void) {
        let e = PocheRangement.entree(Date())
        // Dans la galerie des widgets, sans leçon faite : la question de la planche (HAVING).
        if context.isPreview && e.question == nil {
            completion(PocheEntree(date: Date(), question: PocheRangement.exemple))
        } else {
            completion(e)
        }
    }

    /// Une seule entrée : le widget change quand on y répond (App Intents) ou quand l’app range de nouvelles questions.
    func getTimeline(in context: Context, completion: @escaping (Timeline<PocheEntree>) -> Void) {
        completion(Timeline(entries: [PocheRangement.entree(Date())], policy: .never))
    }
}

/// Le widget : le chat à gauche, et à droite le module, la requête à trou, les trois réponses, puis le verdict et la flèche.
@available(iOS 17.0, *)
struct PocheVue: View {
    let entree: PocheEntree

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    private var ressort: Animation { .spring(response: 0.5, dampingFraction: 0.65) }

    @ViewBuilder
    private func contenu(_ taille: CGSize) -> some View {
        if let q = entree.question {
            avecQuestion(taille, q)
        } else {
            sansQuestion(taille)
        }
    }

    private func avecQuestion(_ taille: CGSize, _ q: QuestionPoche) -> some View {
        let u: CGFloat = taille.width / 364
        let v: CGFloat = taille.height / 170
        let repondu: Bool = entree.etat != .question
        return ZStack(alignment: .topLeading) {
            chat(v)
            colonne(u, v, q)
            if repondu {
                suivante(u, v)
                    .transition(.scale(scale: 0.4).combined(with: .opacity))
            }
        }
        .frame(width: taille.width, height: taille.height)
        .animation(ressort, value: repondu)
    }

    private func chat(_ v: CGFloat) -> some View {
        let nom: String = PocheRangement.chat(entree.etat)
        let hauteur: CGFloat = PocheRangement.hauteurChat(entree.etat) * v
        let bas: CGFloat = 2 * v
        return Image(nom)
            .resizable()
            .scaledToFit()
            .frame(height: hauteur)
            .offset(y: bas)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            .id(nom)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityHidden(true)
    }

    private func colonne(_ u: CGFloat, _ v: CGFloat, _ q: QuestionPoche) -> some View {
        let gauche: CGFloat = 108 * u
        let haut: CGFloat = 10 * v
        let largeur: CGFloat = 242 * u
        let apresTitre: CGFloat = 4 * v
        let apresCode: CGFloat = 6 * v
        return VStack(alignment: .leading, spacing: 0) {
            etiquette(u, q)
            code(u, v, q)
                .padding(.top, apresTitre)
            reponses(u, v, q)
                .padding(.top, apresCode)
            retour(u, q)
                .padding(.top, apresCode)
        }
        .frame(width: largeur, alignment: .leading)
        .padding(.leading, gauche)
        .padding(.top, haut)
    }

    /// « Révision · Agrégats et regroupements » : le module, pas la leçon (son nom donnerait souvent la réponse).
    private func etiquette(_ u: CGFloat, _ q: QuestionPoche) -> some View {
        let police: Font = Font.system(size: 11 * u, weight: .heavy, design: .rounded)
        let ecart: CGFloat = 0.5 * u
        let texte: String = "Révision · " + q.titre
        return Text(verbatim: texte)
            .font(police)
            .tracking(ecart)
            .textCase(.uppercase)
            .foregroundColor(gristexte)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }

    private func code(_ u: CGFloat, _ v: CGFloat, _ q: QuestionPoche) -> some View {
        let lignes: [String] = Array(q.code.prefix(4))
        let taille: CGFloat = PocheRangement.policeCode(q, u: u, v: v)
        let police: Font = Font.system(size: taille, weight: .medium, design: .monospaced)
        let ecart: CGFloat = taille * 0.16
        let marge: CGFloat = 10 * u
        let margeV: CGFloat = 7 * v
        let coin: CGFloat = 12 * u
        let largeur: CGFloat = 242 * u
        let fond = RoundedRectangle(cornerRadius: coin, style: .continuous).fill(encre)
        return VStack(alignment: .leading, spacing: ecart) {
            ForEach(Array(lignes.enumerated()), id: \.offset) { item in
                ligne(item.element, q, police, taille)
            }
        }
        .padding(.horizontal, marge)
        .padding(.vertical, margeV)
        .frame(width: largeur, alignment: .leading)
        .background(fond)
    }

    private func ligne(_ s: String, _ q: QuestionPoche, _ police: Font, _ taille: CGFloat) -> some View {
        let morceaux: [String] = s.components(separatedBy: "___")
        let avant: String = morceaux.first ?? s
        let aTrou: Bool = morceaux.count > 1
        let apres: String = aTrou ? morceaux[1] : ""
        return HStack(alignment: .center, spacing: 0) {
            PocheRangement.code(avant)
                .font(police)
            if aTrou {
                trou(q, police, taille)
                PocheRangement.code(apres)
                    .font(police)
            }
        }
        .lineLimit(1)
        .fixedSize()
    }

    /// Le trou : en pointillés dorés tant qu’on n’a pas répondu ; ensuite, la bonne réponse sur la menthe.
    @ViewBuilder
    private func trou(_ q: QuestionPoche, _ police: Font, _ taille: CGFloat) -> some View {
        if entree.etat == .question {
            trouVide(q, taille)
        } else {
            trouRempli(q, police, taille)
        }
    }

    private func trouVide(_ q: QuestionPoche, _ taille: CGFloat) -> some View {
        let lettres: Int = q.choix.map { $0.count }.max() ?? 3
        let largeur: CGFloat = CGFloat(lettres) * taille * 0.61 + taille * 0.4
        let hauteur: CGFloat = taille * 1.3
        let trait = StrokeStyle(lineWidth: 1.5, dash: [3, 2])
        return RoundedRectangle(cornerRadius: 4, style: .continuous)
            .strokeBorder(dore, style: trait)
            .frame(width: largeur, height: hauteur)
    }

    private func trouRempli(_ q: QuestionPoche, _ police: Font, _ taille: CGFloat) -> some View {
        let mot: String = PocheRangement.bonne(q)
        let marge: CGFloat = taille * 0.3
        let fond = RoundedRectangle(cornerRadius: 4, style: .continuous).fill(menthe)
        return Text(verbatim: mot)
            .font(police)
            .fontWeight(.heavy)
            .foregroundColor(vertFonce)
            .padding(.horizontal, marge)
            .background(fond)
    }

    /// Les trois réponses : des boutons tant qu’on n’a pas répondu (App Intents, iOS 17).
    private func reponses(_ u: CGFloat, _ v: CGFloat, _ q: QuestionPoche) -> some View {
        let total: Int = q.choix.reduce(0) { $0 + $1.count }
        let place: CGFloat = 134 * u
        let ajuste: CGFloat = place / (0.61 * CGFloat(max(total, 1)))
        let taille: CGFloat = min(12 * u, ajuste)
        let ecart: CGFloat = 7 * u
        return HStack(spacing: ecart) {
            ForEach(Array(q.choix.enumerated()), id: \.offset) { item in
                reponse(item.offset, item.element, q, taille, u, v)
            }
        }
    }

    @ViewBuilder
    private func reponse(_ i: Int, _ texte: String, _ q: QuestionPoche, _ taille: CGFloat, _ u: CGFloat, _ v: CGFloat) -> some View {
        if entree.etat == .question {
            Button(intent: RepondrePoche(choix: i)) {
                puce(i, texte, q, taille, u, v)
            }
            .buttonStyle(.plain)
        } else {
            puce(i, texte, q, taille, u, v)
        }
    }

    private func puce(_ i: Int, _ texte: String, _ q: QuestionPoche, _ taille: CGFloat, _ u: CGFloat, _ v: CGFloat) -> some View {
        let style: StylePuce = StylePuce.pour(i, entree, q)
        let police: Font = Font.system(size: taille, weight: .heavy, design: .monospaced)
        let icone: Font = Font.system(size: taille * 0.8, weight: .black)
        let hauteur: CGFloat = 28 * v
        let marge: CGFloat = 11 * u
        let coin: CGFloat = 10 * u
        let trait: CGFloat = 2 * u
        let ecart: CGFloat = 4 * u
        let fond = RoundedRectangle(cornerRadius: coin, style: .continuous).fill(style.fond)
        let bord = RoundedRectangle(cornerRadius: coin, style: .continuous).strokeBorder(style.bord, lineWidth: trait)
        return HStack(spacing: ecart) {
            if let symbole = style.symbole {
                Image(systemName: symbole)
                    .font(icone)
            }
            Text(verbatim: texte)
                .font(police)
                .lineLimit(1)
        }
        .foregroundColor(style.texte)
        .padding(.horizontal, marge)
        .frame(height: hauteur)
        .background(fond)
        .overlay(bord)
        .opacity(style.opacite)
    }

    /// Sous les réponses : la consigne, puis le verdict et son pourquoi.
    @ViewBuilder
    private func retour(_ u: CGFloat, _ q: QuestionPoche) -> some View {
        switch entree.etat {
        case .question:
            consigne(u)
        case .juste:
            verdict("Bien vu\u{202F}!", q.oui, vertTexte, u)
        case .presque:
            verdict("Presque\u{202F}!", q.non, presqueTexte, u)
        }
    }

    private func consigne(_ u: CGFloat) -> some View {
        let police: Font = Font.system(size: 11.5 * u, weight: .bold, design: .rounded)
        return Text("Touche la bonne réponse")
            .font(police)
            .foregroundColor(gristexte)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }

    private func verdict(_ titre: String, _ pourquoi: String, _ couleur: Color, _ u: CGFloat) -> some View {
        let grand: Font = Font.system(size: 12.5 * u, weight: .black, design: .rounded)
        let petit: Font = Font.system(size: 11 * u, weight: .bold, design: .rounded)
        let code: Font = Font.system(size: 10.5 * u, weight: .bold, design: .monospaced)
        let explication: Text = PocheRangement.explication(pourquoi, petit, code)
        let place: CGFloat = 36 * u
        return VStack(alignment: .leading, spacing: 1) {
            Text(verbatim: titre)
                .font(grand)
                .foregroundColor(couleur)
            explication
                .foregroundColor(sousPoche)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .padding(.trailing, place)
    }

    /// La flèche : la question suivante.
    private func suivante(_ u: CGFloat, _ v: CGFloat) -> some View {
        let cote: CGFloat = 28 * u
        let symbole: Font = Font.system(size: 13 * u, weight: .heavy)
        let droite: CGFloat = 14 * u
        let bas: CGFloat = 12 * v
        return Button(intent: SuivantePoche()) {
            Image(systemName: "arrow.right")
                .font(symbole)
                .foregroundColor(Color.white)
                .frame(width: cote, height: cote)
                .background(Circle().fill(violetTexte))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("Question suivante"))
        .padding(.trailing, droite)
        .padding(.bottom, bas)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
    }

    /// Aucune leçon faite : le chat se pose la question, et un appui ouvre la séance du jour.
    private func sansQuestion(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 364
        let v: CGFloat = taille.height / 170
        let grand: Font = Font.system(size: 14 * u, weight: .black, design: .rounded)
        let petit: Font = Font.system(size: 12 * u, weight: .bold, design: .rounded)
        let gauche: CGFloat = 116 * u
        let droite: CGFloat = 16 * u
        let hauteurChat: CGFloat = 130 * v
        return ZStack(alignment: .leading) {
            Image("ChatQuestion")
                .resizable()
                .scaledToFit()
                .frame(height: hauteurChat)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Rien à réviser pour l’instant")
                    .font(grand)
                    .foregroundColor(encrePoche)
                Text("Termine une leçon\u{00A0}: ses questions viendront ici.")
                    .font(petit)
                    .foregroundColor(sousPoche)
            }
            .lineLimit(2)
            .minimumScaleFactor(0.8)
            .padding(.leading, gauche)
            .padding(.trailing, droite)
        }
        .frame(width: taille.width, height: taille.height)
        .widgetURL(lienSeance)
    }
}

@available(iOS 17.0, *)
struct RequetePoche: Widget {
    let kind = "RequetePoche"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PocheFournisseur()) { entree in
            PocheVue(entree: entree)
                .containerBackground(for: .widget) { fondPoche }
        }
        .configurationDisplayName("La requête de poche")
        .description("Une question SQL de tes leçons\u{00A0}: tu réponds dans le widget, sans ouvrir l’app.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

// MARK: - La carte mémo qui se retourne (petit widget, interactif à partir d’iOS 17)
//
// Elisa, 7 novembre (« La carte mémo qui se retourne », d’après la planche : « Touche la carte, elle se retourne. Tu dis si tu
// savais : elle revient au bon moment. ») : au recto, le mot-clé d’une carte gagnée ; un appui la retourne : son titre, sa
// première idée, et deux boutons. « Je savais » l’éloigne (3 jours, puis 7, 21 et 60, comme les révisions de l’app, INTERVALS),
// « À revoir » la ramène demain. Le rythme vit dans le widget (groupe d’apps, « cartesRythme ») ; l’app range les cartes gagnées
// (index.html, widgetCartes). Comme pour la requête de poche (son choix : « la séance seule »), réviser ici n’allume pas la
// flamme du jour. Tout est à jour : un appui ouvre l’album des cartes (requete://cartes).

/// Une carte gagnée, telle que l’app la range : le mot-clé, le titre et la première idée, en texte simple.
struct CarteWidget: Codable, Hashable {
    let id: Int
    let k: String
    let t: String
    let p: String
}

/// Le rythme d’une carte : son cran (0 à 4) et le jour où elle revient (« AAAA-MM-JJ »).
struct RythmeCarte: Codable {
    var niveau: Int
    var jour: String
}

/// La dernière carte notée, pour « Noté ! Elle revient dans 3 jours. », jusqu’au prochain appui ou jusqu’au lendemain.
struct CarteNotee: Codable {
    let id: Int
    let jours: Int
    let le: String
}

enum FaceCarte {
    case recto   // le mot-clé : un appui la retourne
    case verso   // la réponse, « Je savais » et « À revoir »
    case notee   // « Noté ! » : un appui, la suivante
    case aJour   // rien à revoir aujourd’hui
    case vide    // aucune carte gagnée
}

struct CarteEntree: TimelineEntry {
    let date: Date
    let face: FaceCarte
    var carte: CarteWidget? = nil
    var jours: Int = 0   // notée : dans combien de jours elle revient ; à jour : la prochaine
}

/// Ce que le widget garde dans le groupe d’apps : « cartes » (rangées par l’app), « cartesRythme », « carteRetournee » (la carte
/// montrée au verso, -1 sinon) et « carteNotee ».
enum CartesRangement {
    /// Comme les révisions de l’app (index.html, INTERVALS) : 1, 3, 7, 21 et 60 jours.
    static let intervalles: [Int] = [1, 3, 7, 21, 60]

    static let exemple = CarteWidget(id: 20, k: "LEFT JOIN", t: "Garder toute la gauche", p: "La table de gauche est celle écrite après FROM\u{00A0}: ses 10 clients donnent 10 lignes.")

    static func cle(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func jourDans(_ n: Int, apres date: Date) -> String {
        let cal = Calendar.current
        let debut: Date = cal.startOfDay(for: date)
        let d: Date = cal.date(byAdding: .day, value: n, to: debut) ?? debut
        return cle(d)
    }

    static func date(_ cle: String) -> Date? {
        let morceaux: [Int] = cle.split(separator: "-").compactMap { Int($0) }
        guard morceaux.count == 3 else { return nil }
        var c = DateComponents()
        c.year = morceaux[0]
        c.month = morceaux[1]
        c.day = morceaux[2]
        return Calendar.current.date(from: c)
    }

    /// Le nombre de jours d’une date à l’autre.
    static func ecart(_ de: String, _ a: String) -> Int {
        guard let x = date(de), let y = date(a) else { return 0 }
        return Calendar.current.dateComponents([.day], from: x, to: y).day ?? 0
    }

    static func cartes() -> [CarteWidget] {
        let d = UserDefaults(suiteName: groupe)
        guard let texte = d?.string(forKey: "cartes"), let donnees = texte.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([CarteWidget].self, from: donnees)) ?? []
    }

    static func rythmes() -> [String: RythmeCarte] {
        let d = UserDefaults(suiteName: groupe)
        guard let texte = d?.string(forKey: "cartesRythme"), let donnees = texte.data(using: .utf8) else { return [:] }
        return (try? JSONDecoder().decode([String: RythmeCarte].self, from: donnees)) ?? [:]
    }

    static func ecrire(_ r: [String: RythmeCarte]) {
        guard let donnees = try? JSONEncoder().encode(r), let texte = String(data: donnees, encoding: .utf8) else { return }
        UserDefaults(suiteName: groupe)?.set(texte, forKey: "cartesRythme")
    }

    static func notee() -> CarteNotee? {
        let d = UserDefaults(suiteName: groupe)
        guard let texte = d?.string(forKey: "carteNotee"), let donnees = texte.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(CarteNotee.self, from: donnees)
    }

    /// La carte du moment : d’abord celles qui reviennent aujourd’hui (la plus en retard en premier), puis les nouvelles, dans
    /// l’ordre du parcours.
    static func courante(_ liste: [CarteWidget], _ r: [String: RythmeCarte], _ aujourdhui: String) -> CarteWidget? {
        let dues: [CarteWidget] = liste.filter { c in
            guard let x = r[String(c.id)] else { return false }
            return x.jour <= aujourdhui
        }
        let enRetard: [CarteWidget] = dues.sorted { a, b in
            (r[String(a.id)]?.jour ?? "") < (r[String(b.id)]?.jour ?? "")
        }
        if let premiere = enRetard.first {
            return premiere
        }
        return liste.first { c in r[String(c.id)] == nil }
    }

    /// Tout est à jour : dans combien de jours revient la prochaine.
    static func prochaine(_ liste: [CarteWidget], _ r: [String: RythmeCarte], _ aujourdhui: String) -> Int {
        let jours: [String] = liste.compactMap { c in r[String(c.id)]?.jour }
        guard let plusTot = jours.min() else { return 1 }
        return max(1, ecart(aujourdhui, plusTot))
    }

    static func entree(_ date: Date) -> CarteEntree {
        let liste: [CarteWidget] = cartes()
        guard !liste.isEmpty else { return CarteEntree(date: date, face: .vide) }
        let aujourdhui: String = cle(date)
        if let n = notee(), n.le == aujourdhui, let c = liste.first(where: { $0.id == n.id }) {
            return CarteEntree(date: date, face: .notee, carte: c, jours: n.jours)
        }
        let r: [String: RythmeCarte] = rythmes()
        guard let c = courante(liste, r, aujourdhui) else {
            return CarteEntree(date: date, face: .aJour, jours: prochaine(liste, r, aujourdhui))
        }
        let retournee: Int = (UserDefaults(suiteName: groupe)?.object(forKey: "carteRetournee") as? Int) ?? -1
        let face: FaceCarte = retournee == c.id ? .verso : .recto
        return CarteEntree(date: date, face: face, carte: c)
    }

    static func retourner(_ id: Int) {
        UserDefaults(suiteName: groupe)?.set(id, forKey: "carteRetournee")
    }

    /// « Je savais » : un cran plus loin ; « À revoir » : demain, et elle repart du premier cran.
    static func noter(_ id: Int, savais: Bool) {
        let maintenant = Date()
        var r: [String: RythmeCarte] = rythmes()
        let avant: Int = r[String(id)]?.niveau ?? 0
        let niveau: Int = savais ? min(avant + 1, intervalles.count - 1) : 0
        let jours: Int = savais ? intervalles[niveau] : 1
        r[String(id)] = RythmeCarte(niveau: niveau, jour: jourDans(jours, apres: maintenant))
        ecrire(r)
        let d = UserDefaults(suiteName: groupe)
        d?.set(-1, forKey: "carteRetournee")
        let n = CarteNotee(id: id, jours: jours, le: cle(maintenant))
        if let donnees = try? JSONEncoder().encode(n), let texte = String(data: donnees, encoding: .utf8) {
            d?.set(texte, forKey: "carteNotee")
        }
    }

    static func suivante() {
        let d = UserDefaults(suiteName: groupe)
        d?.set("", forKey: "carteNotee")
        d?.set(-1, forKey: "carteRetournee")
    }

    /// « demain », « dans 3 jours », « dans 3 semaines », « dans 2 mois ».
    static func dans(_ jours: Int) -> String {
        if jours <= 1 { return "demain" }
        if jours < 14 { return "dans \(jours)\u{00A0}jours" }
        if jours < 56 { return "dans \(jours / 7)\u{00A0}semaines" }
        return "dans \(jours / 30)\u{00A0}mois"
    }
}

/// « requete://cartes » : l’album des cartes mémo (index.html, raccourciOuvrir).
private let lienCartes: URL = {
    var c = URLComponents()
    c.scheme = "requete"
    c.host = "cartes"
    return c.url ?? URL(fileURLWithPath: "/")
}()

private let vertNote = Color(red: 0.157, green: 0.361, blue: 0.271)
private let fondNote = LinearGradient(gradient: Gradient(colors: [Color(red: 0.937, green: 1.0, blue: 0.965), Color(red: 0.788, green: 0.961, blue: 0.875)]), startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
private let fondRecto = LinearGradient(gradient: Gradient(colors: [violetVif, violetTexte, Color(red: 0.271, green: 0.161, blue: 0.8)]), startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
private let fondCalme = Color(red: 0.957, green: 0.949, blue: 0.988)

/// Le fond de la carte : violet au recto, blanc au verso, menthe une fois notée, lavande sinon.
struct FondCarte: View {
    let face: FaceCarte

    var body: some View {
        switch face {
        case .recto:
            fondRecto
        case .verso:
            Color.white
        case .notee:
            fondNote
        case .aJour, .vide:
            fondCalme
        }
    }
}

@available(iOS 17.0, *)
struct RetournerCarte: AppIntent {
    static let title: LocalizedStringResource = "Retourner la carte mémo"
    static let isDiscoverable: Bool = false

    @Parameter(title: "Carte")
    var carte: Int

    init() {}

    init(carte: Int) {
        self.carte = carte
    }

    func perform() async throws -> some IntentResult {
        CartesRangement.retourner(carte)
        return .result()
    }
}

@available(iOS 17.0, *)
struct NoterCarte: AppIntent {
    static let title: LocalizedStringResource = "Noter la carte mémo"
    static let isDiscoverable: Bool = false

    @Parameter(title: "Carte")
    var carte: Int

    @Parameter(title: "Je savais")
    var savais: Bool

    init() {}

    init(carte: Int, savais: Bool) {
        self.carte = carte
        self.savais = savais
    }

    func perform() async throws -> some IntentResult {
        CartesRangement.noter(carte, savais: savais)
        return .result()
    }
}

@available(iOS 17.0, *)
struct CarteSuivante: AppIntent {
    static let title: LocalizedStringResource = "Carte mémo suivante"
    static let isDiscoverable: Bool = false

    init() {}

    func perform() async throws -> some IntentResult {
        CartesRangement.suivante()
        return .result()
    }
}

struct CarteFournisseur: TimelineProvider {
    func placeholder(in context: Context) -> CarteEntree {
        CarteEntree(date: Date(), face: .recto, carte: CartesRangement.exemple)
    }

    func getSnapshot(in context: Context, completion: @escaping (CarteEntree) -> Void) {
        let e = CartesRangement.entree(Date())
        // Dans la galerie des widgets, sans carte gagnée : la carte de la planche (LEFT JOIN).
        if context.isPreview && e.face == .vide {
            completion(CarteEntree(date: Date(), face: .recto, carte: CartesRangement.exemple))
        } else {
            completion(e)
        }
    }

    /// Maintenant, puis chaque minuit sur sept jours : une carte revient le jour dit.
    func getTimeline(in context: Context, completion: @escaping (Timeline<CarteEntree>) -> Void) {
        let cal = Calendar.current
        let maintenant = Date()
        let debut: Date = cal.startOfDay(for: maintenant)
        var dates = [maintenant]
        for j in 1...7 {
            if let d = cal.date(byAdding: .day, value: j, to: debut) {
                dates.append(d)
            }
        }
        completion(Timeline(entries: dates.map { CartesRangement.entree($0) }, policy: .atEnd))
    }
}

/// La carte, face par face. Un appui la retourne, la note, ou passe à la suivante (App Intents, iOS 17).
@available(iOS 17.0, *)
struct CarteVue: View {
    let entree: CarteEntree

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    @ViewBuilder
    private func contenu(_ taille: CGSize) -> some View {
        switch entree.face {
        case .recto:
            recto(taille)
        case .verso:
            verso(taille)
        case .notee:
            notee(taille)
        case .aJour:
            calme(taille, "Cartes à jour\u{202F}!", "La prochaine revient " + CartesRangement.dans(entree.jours) + ".", "ChatBravo", lienCartes)
        case .vide:
            calme(taille, "Pas encore de carte", "Termine une leçon\u{00A0}: sa carte mémo viendra ici.", "ChatQuestion", lienSeance)
        }
    }

    private var carte: CarteWidget { entree.carte ?? CartesRangement.exemple }

    /// Le recto : « Carte mémo », le mot-clé, « Tu t’en souviens ? » ; tout le widget la retourne.
    private func recto(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 170
        let c: CarteWidget = carte
        let etiquette: Font = Font.system(size: 10 * u, weight: .black, design: .rounded)
        let mot: Font = Font.system(size: 20 * u, weight: .heavy, design: .monospaced)
        let question: Font = Font.system(size: 15 * u, weight: .heavy, design: .rounded)
        let indice: Font = Font.system(size: 10.5 * u, weight: .heavy, design: .rounded)
        let etoile: CGFloat = 20 * u
        let marge: CGFloat = 14 * u
        let ecart: CGFloat = 0.8 * u
        let apresMot: CGFloat = 4 * u
        let blanc: Color = Color.white.opacity(0.85)
        return Button(intent: RetournerCarte(carte: c.id)) {
            ZStack(alignment: .topLeading) {
                grandeEtoile(u)
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .center, spacing: 0) {
                        Text("Carte mémo")
                            .font(etiquette)
                            .tracking(ecart)
                            .textCase(.uppercase)
                            .foregroundColor(blanc)
                        Spacer(minLength: 0)
                        Trace(points: etoileCarte, cote: 24)
                            .fill(dore)
                            .frame(width: etoile, height: etoile)
                    }
                    Spacer(minLength: 0)
                    Text(verbatim: c.k)
                        .font(mot)
                        .foregroundColor(Color.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.5)
                    Text("Tu t’en souviens\u{202F}?")
                        .font(question)
                        .foregroundColor(Color.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.top, apresMot)
                    Spacer(minLength: 0)
                    Label("Touche pour la retourner", systemImage: "arrow.clockwise")
                        .font(indice)
                        .foregroundColor(blanc)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .padding(marge)
            }
            .frame(width: taille.width, height: taille.height)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// La grande étoile pâle, qui dépasse du coin, comme sur les cartes de l’app.
    private func grandeEtoile(_ u: CGFloat) -> some View {
        let cote: CGFloat = 120 * u
        let dx: CGFloat = 26 * u
        let dy: CGFloat = 30 * u
        let pale: Color = Color.white.opacity(0.13)
        return Trace(points: etoileCarte, cote: 24)
            .fill(pale)
            .frame(width: cote, height: cote)
            .offset(x: dx, y: dy)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .accessibilityHidden(true)
    }

    /// Le verso : le mot-clé, le titre de la carte, sa première idée, puis « Je savais » et « À revoir ».
    private func verso(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 170
        let c: CarteWidget = carte
        let mot: Font = Font.system(size: 12 * u, weight: .heavy, design: .monospaced)
        let titre: Font = Font.system(size: 14 * u, weight: .black, design: .rounded)
        let idee: Font = Font.system(size: 11 * u, weight: .bold, design: .rounded)
        let marge: CGFloat = 14 * u
        let bas: CGFloat = 12 * u
        let ecart: CGFloat = 6 * u
        let apresMot: CGFloat = 4 * u
        let apresTitre: CGFloat = 3 * u
        return VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: c.k)
                .font(mot)
                .foregroundColor(violetTexte)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(verbatim: c.t)
                .font(titre)
                .foregroundColor(encre)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .padding(.top, apresMot)
            Text(verbatim: c.p)
                .font(idee)
                .foregroundColor(sousPoche)
                .lineLimit(3)
                .minimumScaleFactor(0.75)
                .padding(.top, apresTitre)
            Spacer(minLength: 0)
            HStack(spacing: ecart) {
                noter("Je savais", true, c, u)
                noter("À revoir", false, c, u)
            }
        }
        .padding(.horizontal, marge)
        .padding(.top, marge)
        .padding(.bottom, bas)
        .frame(width: taille.width, height: taille.height, alignment: .topLeading)
    }

    private func noter(_ titre: String, _ savais: Bool, _ c: CarteWidget, _ u: CGFloat) -> some View {
        let police: Font = Font.system(size: 12 * u, weight: .black, design: .rounded)
        let fond: Color = savais ? menthe : braiseFond
        let texte: Color = savais ? vertFonce : braiseTexte
        let hauteur: CGFloat = 32 * u
        let coin: CGFloat = 11 * u
        let forme = RoundedRectangle(cornerRadius: coin, style: .continuous).fill(fond)
        return Button(intent: NoterCarte(carte: c.id, savais: savais)) {
            Text(verbatim: titre)
                .font(police)
                .foregroundColor(texte)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .frame(height: hauteur)
                .background(forme)
        }
        .buttonStyle(.plain)
    }

    /// Notée : « Noté ! », quand elle revient, et le chat qui retourne une carte ; un appui, la suivante.
    private func notee(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 170
        let titre: Font = Font.system(size: 19 * u, weight: .black, design: .rounded)
        let phrase: Font = Font.system(size: 12 * u, weight: .heavy, design: .rounded)
        let indice: Font = Font.system(size: 10.5 * u, weight: .heavy, design: .rounded)
        let quand: String = "Elle revient " + CartesRangement.dans(entree.jours) + "."
        let marge: CGFloat = 14 * u
        let largeur: CGFloat = 140 * u
        let hauteurChat: CGFloat = 100 * u
        let chute: CGFloat = 4 * u
        let apresTitre: CGFloat = 4 * u
        return Button(intent: CarteSuivante()) {
            ZStack(alignment: .topLeading) {
                Image("ChatCarte")
                    .resizable()
                    .scaledToFit()
                    .frame(height: hauteurChat)
                    .offset(y: chute)
                    .padding(.trailing, chute)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Noté\u{202F}!")
                        .font(titre)
                        .foregroundColor(vertTexte)
                    Text(verbatim: quand)
                        .font(phrase)
                        .foregroundColor(vertNote)
                        .lineLimit(2)
                        .padding(.top, apresTitre)
                    Text("Touche pour la suivante")
                        .font(indice)
                        .foregroundColor(vertNote.opacity(0.75))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .padding(.top, apresTitre)
                }
                .frame(width: largeur, alignment: .leading)
                .padding(marge)
            }
            .frame(width: taille.width, height: taille.height)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// À jour, ou sans carte : une phrase, le chat, et un appui qui ouvre l’app (l’album, ou la séance du jour).
    private func calme(_ taille: CGSize, _ titre: String, _ phrase: String, _ chat: String, _ lien: URL) -> some View {
        let u: CGFloat = taille.width / 170
        let grand: Font = Font.system(size: 16 * u, weight: .black, design: .rounded)
        let petit: Font = Font.system(size: 11.5 * u, weight: .bold, design: .rounded)
        let marge: CGFloat = 14 * u
        let hauteurChat: CGFloat = 92 * u
        let chute: CGFloat = 4 * u
        let apresTitre: CGFloat = 4 * u
        return ZStack(alignment: .topLeading) {
            Image(chat)
                .resizable()
                .scaledToFit()
                .frame(height: hauteurChat)
                .offset(y: chute)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: titre)
                    .font(grand)
                    .foregroundColor(violetTexte)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                Text(verbatim: phrase)
                    .font(petit)
                    .foregroundColor(sousPoche)
                    .lineLimit(3)
                    .minimumScaleFactor(0.8)
                    .padding(.top, apresTitre)
            }
            .padding(marge)
        }
        .frame(width: taille.width, height: taille.height)
        .widgetURL(lien)
    }
}

@available(iOS 17.0, *)
struct RequeteCarte: Widget {
    let kind = "RequeteCarte"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CarteFournisseur()) { entree in
            CarteVue(entree: entree)
                .containerBackground(for: .widget) { FondCarte(face: entree.face) }
        }
        .configurationDisplayName("La carte mémo")
        .description("Tes cartes mémo, à retourner d’un appui. «\u{00A0}Je savais\u{00A0}» l’éloigne, «\u{00A0}À revoir\u{00A0}» la ramène demain.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: - Ta semaine, en résultat de requête (widget moyen)
//
// Elisa, 7 novembre (« Ta semaine, en résultat de requête », d’après la planche : « Le widget parle SQL : ta semaine sort comme
// un tableau de résultats. ») : « SELECT jour, flamme FROM ma_semaine; », puis la semaine du lundi au dimanche, une colonne par
// jour : la flamme dorée un jour actif, la lune un jour de repos du planning, la flamme en contour aujourd’hui tant que la séance
// attend, NULL un jour passé sans activité, « · » à venir. Dessous, comme sous un résultat : « 7 lignes · 4 flammes », et où en est
// aujourd’hui. Sombre façon terminal quand l’iPhone est en mode sombre, clair façon tableau de résultats sinon (les deux versions
// de la planche). L’app range les jours (index.html, widgetSemaine) ; le widget en tire la semaine du jour, même si l’app n’a pas
// été ouverte depuis (une entrée chaque minuit). Aujourd’hui en attente : un appui ouvre la séance du jour.

/// Ce que range l’app : les jours actifs (trois dernières semaines), les jours de repos du planning (trois semaines avant, deux
/// après), et le premier jour qui compte (début du planning ou première activité : avant lui, pas de NULL).
struct SemaineDonnees: Codable {
    var actifs: [String] = []
    var repos: [String] = []
    var debut: String = ""
}

enum JourSemaine {
    case fait      // un jour actif : la flamme dorée
    case attente   // aujourd’hui, la séance attend : la flamme en contour
    case repos     // un jour de repos du planning : la lune
    case manque    // un jour passé sans activité : NULL
    case avenir    // à venir (ou avant le premier jour) : « · »
}

struct CaseSemaine: Hashable {
    let cle: String
    let rang: Int        // 0 : lundi … 6 : dimanche
    let etat: JourSemaine
    let aujourdhui: Bool
}

struct SemaineEntree: TimelineEntry {
    let date: Date
    let jours: [CaseSemaine]
}

enum SemaineRangement {
    static let noms: [String] = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]
    static let nomsLongs: [String] = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]

    static func donnees() -> SemaineDonnees {
        let d = UserDefaults(suiteName: groupe)
        guard let texte = d?.string(forKey: "semaine"), let donnees = texte.data(using: .utf8) else { return SemaineDonnees() }
        return (try? JSONDecoder().decode(SemaineDonnees.self, from: donnees)) ?? SemaineDonnees()
    }

    /// La place du jour dans sa semaine, du lundi (0) au dimanche (6) ; Calendar compte du dimanche (1) au samedi (7).
    static func rang(_ date: Date) -> Int {
        let jour: Int = Calendar.current.component(.weekday, from: date)
        return (jour + 5) % 7
    }

    static func etatDu(_ cle: String, _ aujourdhui: String, _ s: SemaineDonnees) -> JourSemaine {
        if s.actifs.contains(cle) { return .fait }
        if s.repos.contains(cle) { return .repos }
        if cle == aujourdhui { return .attente }
        if cle > aujourdhui { return .avenir }
        if s.debut.isEmpty || cle < s.debut { return .avenir }
        return .manque
    }

    static func entree(_ date: Date) -> SemaineEntree {
        let s: SemaineDonnees = donnees()
        let aujourdhui: String = CartesRangement.cle(date)
        let lundi: Int = -rang(date)
        var jours: [CaseSemaine] = []
        for i in 0..<7 {
            let cle: String = CartesRangement.jourDans(lundi + i, apres: date)
            let etat: JourSemaine = etatDu(cle, aujourdhui, s)
            jours.append(CaseSemaine(cle: cle, rang: i, etat: etat, aujourdhui: cle == aujourdhui))
        }
        return SemaineEntree(date: date, jours: jours)
    }

    /// La semaine de la planche : trois flammes, un jour de repos, une flamme, aujourd’hui en attente, demain à venir.
    static func exemple(_ date: Date) -> SemaineEntree {
        let etats: [JourSemaine] = [.fait, .fait, .fait, .repos, .fait, .attente, .avenir]
        var jours: [CaseSemaine] = []
        for (i, e) in etats.enumerated() {
            jours.append(CaseSemaine(cle: "", rang: i, etat: e, aujourdhui: i == 5))
        }
        return SemaineEntree(date: date, jours: jours)
    }

    /// Sous le tableau, comme sous un résultat : « 7 lignes · 4 flammes ».
    static func lignes(_ jours: [CaseSemaine]) -> String {
        let n: Int = jours.filter { $0.etat == .fait }.count
        if n == 0 { return "7\u{00A0}lignes" }
        if n == 1 { return "7\u{00A0}lignes · 1\u{00A0}flamme" }
        return "7\u{00A0}lignes · \(n)\u{00A0}flammes"
    }

    /// « samedi : en attente », « samedi : flamme allumée », « samedi : repos ».
    static func duJour(_ jours: [CaseSemaine]) -> String {
        guard let j = jours.first(where: { $0.aujourdhui }) else { return "" }
        let nom: String = nomsLongs[j.rang]
        switch j.etat {
        case .fait: return nom + "\u{00A0}: flamme allumée"
        case .attente: return nom + "\u{00A0}: en attente"
        case .repos: return nom + "\u{00A0}: repos"
        case .manque, .avenir: return nom
        }
    }

    static func libelle(_ jours: [CaseSemaine]) -> String {
        var morceaux: [String] = ["Ta semaine."]
        for j in jours {
            let nom: String = nomsLongs[j.rang].capitalized
            morceaux.append(nom + "\u{00A0}: " + dit(j.etat) + ".")
        }
        return morceaux.joined(separator: " ")
    }

    static func dit(_ e: JourSemaine) -> String {
        switch e {
        case .fait: return "flamme allumée"
        case .attente: return "en attente"
        case .repos: return "repos"
        case .manque: return "pas de séance"
        case .avenir: return "à venir"
        }
    }
}

/// Les couleurs des deux versions de la planche : sombre façon terminal, clair façon tableau de résultats.
struct PaletteSemaine {
    let texte: Color
    let motCle: Color
    let entete: Color
    let enteteFond: Color
    let ligne: Color
    let separation: Color
    let jourTexte: Color
    let jourEntete: Color
    let jourCase: Color
    let lune: Color
    let pale: Color
    let pied: Color
    let attente: Color
    let allumee: Color

    static let sombre = PaletteSemaine(
        texte: Color.white, motCle: Color(red: 0.725, green: 0.651, blue: 1.0), entete: Color(red: 0.725, green: 0.682, blue: 0.91),
        enteteFond: Color.clear, ligne: Color.white.opacity(0.16), separation: Color.white.opacity(0.1),
        jourTexte: Color(red: 1.0, green: 0.725, blue: 0.541), jourEntete: braise.opacity(0.14), jourCase: braise.opacity(0.14),
        lune: Color(red: 0.557, green: 0.525, blue: 0.722), pale: Color(red: 0.431, green: 0.4, blue: 0.639),
        pied: Color(red: 0.725, green: 0.682, blue: 0.91), attente: Color(red: 1.0, green: 0.725, blue: 0.541), allumee: dore
    )

    static let claire = PaletteSemaine(
        texte: encre, motCle: violetTexte, entete: Color(red: 0.373, green: 0.341, blue: 0.569),
        enteteFond: Color(red: 0.953, green: 0.937, blue: 1.0), ligne: Color(red: 0.902, green: 0.878, blue: 1.0),
        separation: Color(red: 0.902, green: 0.878, blue: 1.0),
        jourTexte: Color(red: 0.604, green: 0.227, blue: 0.0), jourEntete: Color(red: 1.0, green: 0.914, blue: 0.859),
        jourCase: Color(red: 1.0, green: 0.957, blue: 0.925),
        lune: Color(red: 0.655, green: 0.624, blue: 0.816), pale: Color(red: 0.71, green: 0.678, blue: 0.851),
        pied: Color(red: 0.373, green: 0.341, blue: 0.569), attente: Color(red: 0.604, green: 0.227, blue: 0.0),
        allumee: Color(red: 0.718, green: 0.475, blue: 0.122)
    )
}

/// Les polices, posées une fois par dessin (la taille suit la largeur du widget).
struct PolicesSemaine {
    let ligneSQL: Font
    let jour: Font
    let flamme: Font
    let lune: Font
    let repos: Font
    let null: Font
    let point: Font
    let pied: Font
    let etat: Font

    init(_ u: CGFloat) {
        ligneSQL = Font.system(size: 12 * u, weight: .bold, design: .monospaced)
        jour = Font.system(size: 10.5 * u, weight: .heavy, design: .monospaced)
        flamme = Font.system(size: 21 * u, weight: .bold)
        lune = Font.system(size: 15 * u, weight: .bold)
        repos = Font.system(size: 9 * u, weight: .heavy, design: .rounded)
        null = Font.system(size: 9.5 * u, weight: .bold, design: .monospaced)
        point = Font.system(size: 16 * u, weight: .heavy)
        pied = Font.system(size: 11 * u, weight: .medium, design: .monospaced)
        etat = Font.system(size: 12 * u, weight: .heavy, design: .rounded)
    }
}

/// Le fond : le dégradé nuit du terminal en mode sombre, blanc en mode clair.
struct FondSemaine: View {
    @Environment(\.colorScheme) private var mode

    var body: some View {
        if mode == .dark {
            LinearGradient(gradient: Gradient(colors: [Color(red: 0.165, green: 0.129, blue: 0.376), encre]), startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
        } else {
            Color.white
        }
    }
}

extension View {
    /// iOS 17 et plus : le fond passe par containerBackground ; avant, en fond.
    @ViewBuilder
    func fondSemaine() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { FondSemaine() }
        } else {
            self.background(FondSemaine())
        }
    }
}

struct SemaineFournisseur: TimelineProvider {
    func placeholder(in context: Context) -> SemaineEntree {
        SemaineRangement.exemple(Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (SemaineEntree) -> Void) {
        let e = SemaineRangement.entree(Date())
        // Dans la galerie des widgets, une semaine vide ne dirait rien : la semaine de la planche.
        let vide: Bool = !e.jours.contains { $0.etat == .fait || $0.etat == .repos }
        if context.isPreview && vide {
            completion(SemaineRangement.exemple(Date()))
        } else {
            completion(e)
        }
    }

    /// Maintenant, puis chaque minuit sur sept jours : aujourd’hui avance, et le lundi, une nouvelle semaine commence.
    func getTimeline(in context: Context, completion: @escaping (Timeline<SemaineEntree>) -> Void) {
        let cal = Calendar.current
        let maintenant = Date()
        let debut: Date = cal.startOfDay(for: maintenant)
        var dates = [maintenant]
        for j in 1...7 {
            if let d = cal.date(byAdding: .day, value: j, to: debut) {
                dates.append(d)
            }
        }
        completion(Timeline(entries: dates.map { SemaineRangement.entree($0) }, policy: .atEnd))
    }
}

struct SemaineVue: View {
    let entree: SemaineEntree
    @Environment(\.colorScheme) private var mode

    var body: some View {
        GeometryReader { g in
            contenu(g.size)
        }
    }

    private var palette: PaletteSemaine {
        mode == .dark ? PaletteSemaine.sombre : PaletteSemaine.claire
    }

    /// Aujourd’hui en attente : un appui ouvre la séance du jour.
    private var lien: URL? {
        let attend: Bool = entree.jours.contains { $0.aujourdhui && $0.etat == .attente }
        return attend ? lienSeance : nil
    }

    private func contenu(_ taille: CGSize) -> some View {
        let u: CGFloat = taille.width / 364
        let v: CGFloat = taille.height / 170
        let p: PaletteSemaine = palette
        let f = PolicesSemaine(u)
        let marge: CGFloat = 18 * u
        let haut: CGFloat = 16 * v
        let ecart: CGFloat = 10 * v
        let bas: CGFloat = 13 * v
        let lu: String = SemaineRangement.libelle(entree.jours)
        return VStack(alignment: .leading, spacing: 0) {
            requete(f, p)
            grille(u, v, f, p)
                .padding(.top, ecart)
            Spacer(minLength: 0)
            pied(u, f, p)
        }
        .padding(.horizontal, marge)
        .padding(.top, haut)
        .padding(.bottom, bas)
        .frame(width: taille.width, height: taille.height, alignment: .topLeading)
        .widgetURL(lien)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: lu))
    }

    /// « SELECT jour, flamme FROM ma_semaine; »
    private func requete(_ f: PolicesSemaine, _ p: PaletteSemaine) -> some View {
        var ligne: Text = Text(verbatim: "SELECT").foregroundColor(p.motCle)
        ligne = ligne + Text(verbatim: " jour, flamme ").foregroundColor(p.texte)
        ligne = ligne + Text(verbatim: "FROM").foregroundColor(p.motCle)
        ligne = ligne + Text(verbatim: " ma_semaine;").foregroundColor(p.texte)
        return ligne
            .font(f.ligneSQL)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }

    private func grille(_ u: CGFloat, _ v: CGFloat, _ f: PolicesSemaine, _ p: PaletteSemaine) -> some View {
        let coin: CGFloat = 10 * u
        let forme = RoundedRectangle(cornerRadius: coin, style: .continuous)
        let derniere: Int = entree.jours.count - 1
        return HStack(spacing: 0) {
            ForEach(entree.jours, id: \.self) { j in
                colonne(j, j.rang == derniere, v, f, p)
            }
        }
        .clipShape(forme)
        .overlay(forme.stroke(p.ligne, lineWidth: 1))
    }

    /// Une colonne : le nom du jour, puis sa case ; aujourd’hui en braise.
    private func colonne(_ j: CaseSemaine, _ derniere: Bool, _ v: CGFloat, _ f: PolicesSemaine, _ p: PaletteSemaine) -> some View {
        let nom: String = SemaineRangement.noms[j.rang]
        let couleur: Color = j.aujourdhui ? p.jourTexte : p.entete
        let fondNom: Color = j.aujourdhui ? p.jourEntete : p.enteteFond
        let fondCase: Color = j.aujourdhui ? p.jourCase : Color.clear
        let hautNom: CGFloat = 22 * v
        let hautCase: CGFloat = 50 * v
        let trait: CGFloat = derniere ? 0 : 1
        return VStack(spacing: 0) {
            Text(verbatim: nom)
                .font(f.jour)
                .foregroundColor(couleur)
                .frame(maxWidth: .infinity)
                .frame(height: hautNom)
                .background(fondNom)
            Rectangle()
                .fill(p.ligne)
                .frame(height: 1)
            valeur(j.etat, f, p)
                .frame(maxWidth: .infinity)
                .frame(height: hautCase)
                .background(fondCase)
        }
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(p.separation)
                .frame(width: trait)
        }
    }

    @ViewBuilder
    private func valeur(_ e: JourSemaine, _ f: PolicesSemaine, _ p: PaletteSemaine) -> some View {
        switch e {
        case .fait:
            Image(systemName: "flame.fill")
                .font(f.flamme)
                .foregroundColor(dore)
        case .attente:
            Image(systemName: "flame")
                .font(f.flamme)
                .foregroundColor(braise)
        case .repos:
            VStack(spacing: 2) {
                Image(systemName: "moon.fill")
                    .font(f.lune)
                    .foregroundColor(p.lune)
                Text("repos")
                    .font(f.repos)
                    .foregroundColor(p.entete)
            }
        case .manque:
            Text(verbatim: "NULL")
                .font(f.null)
                .italic()
                .foregroundColor(p.pale)
        case .avenir:
            Text(verbatim: "·")
                .font(f.point)
                .foregroundColor(p.pale)
        }
    }

    /// « 7 lignes · 4 flammes », et où en est aujourd’hui.
    private func pied(_ u: CGFloat, _ f: PolicesSemaine, _ p: PaletteSemaine) -> some View {
        let gauche: String = SemaineRangement.lignes(entree.jours)
        let droite: String = SemaineRangement.duJour(entree.jours)
        let couleur: Color = couleurDuJour(p)
        let ecart: CGFloat = 8 * u
        return HStack(alignment: .firstTextBaseline, spacing: ecart) {
            Text(verbatim: gauche)
                .font(f.pied)
                .foregroundColor(p.pied)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            Text(verbatim: droite)
                .font(f.etat)
                .foregroundColor(couleur)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    private func couleurDuJour(_ p: PaletteSemaine) -> Color {
        guard let j = entree.jours.first(where: { $0.aujourdhui }) else { return p.pied }
        switch j.etat {
        case .fait: return p.allumee
        case .attente: return p.attente
        case .repos, .manque, .avenir: return p.pied
        }
    }
}

struct RequeteSemaine: Widget {
    let kind = "RequeteSemaine"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SemaineFournisseur()) { entree in
            SemaineVue(entree: entree).fondSemaine()
        }
        .configurationDisplayName("Ta semaine")
        .description("Ta semaine en résultat de requête\u{00A0}: une flamme par jour actif, la lune les jours de repos.")
        .supportedFamilies([.systemMedium])
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
//
// 5 novembre, 6 h 45 (« dans la Dynamic Island, est-ce que tu peux animer, mettre le nombre de moments réussis 2/4 etc. ») : à droite,
// les moments « À toi » réussis sur ceux de la leçon (« 2/4 ») ; appui long et écran verrouillé, une case par moment, le contour doré
// sur celle qui valide la leçon. Le compte part quand on quitte l’app : la Dynamic Island apparaît avec l’ancien, le nouveau arrive
// une seconde après (RequeteWidgetPlugin.swift) : le chiffre roule (iOS 17), la case se remplit et sa coche se pose.

/// Le même type, au même nom et aux mêmes champs, est déclaré dans l’app (RequeteWidgetPlugin.swift) : iOS relie la Live Activity
/// lancée par l’app à son dessin ici par ce nom.
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

@available(iOS 16.1, *)
func leconPhrase(_ e: RequeteLecon.ContentState) -> String {
    if e.fini { return "Leçon terminée\u{202F}! Ta flamme du jour est allumée." }
    let n: Int = e.moments ?? 0
    if n > 0 {
        let r: Int = min(n, max(0, e.reussis ?? 0))
        let but: Int = min(n, max(1, e.objectif ?? n))
        let reste: Int = but - r
        if reste <= 0 { return "Moments réussis\u{202F}: \(r)/\(n) · objectif atteint\u{202F}!" }
        return "Moments réussis\u{202F}: \(r)/\(n) · encore \(reste) pour valider"
    }
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

/// L’avancement en pour cent, à droite de la Dynamic Island ; une coche dorée quand la leçon est réussie.
/// 4 novembre, 17 h 27 (réf. 5 : « la Dynamic Island bugue, j’ai l’impression ») : l’anneau d’avant, presque vide en début de leçon,
/// ressemblait à une roue qui charge, et iOS en coupait le bord gauche. Le chiffre se lit d’un coup d’œil et tient dans la place.
@available(iOS 16.1, *)
struct LeconPourcent: View {
    let etat: RequeteLecon.ContentState

    var body: some View {
        let part: Double = etat.fini ? 1 : min(1, max(0, etat.progression))
        let pct: Int = Int((part * 100).rounded())
        let texte: String = etat.fini ? "✓" : "\(pct)\u{202F}%"
        let teinte: Color = etat.fini ? dore : braise
        let police: Font = Font.system(size: 14, weight: .heavy, design: .rounded)
        return Text(texte)
            .font(police)
            .monospacedDigit()
            .foregroundColor(teinte)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

/// Les moments réussis, à droite de la Dynamic Island (5 novembre, 6 h 45) : « 2/4 », comme « Tu as réussi 2 exercices sur 4 » à la
/// fin de la vidéo, le « /4 » plus petit, comme « 0/1 » dans le widget. Le chiffre roule quand il change (iOS 17) ; braise, puis menthe
/// une fois l’objectif de la leçon atteint. Leçon réussie, ou sans moments connus : le pour cent (la coche dorée à la fin).
@available(iOS 16.1, *)
struct LeconMoments: View {
    let etat: RequeteLecon.ContentState

    var body: some View {
        let n: Int = etat.moments ?? 0
        let r: Int = min(n, max(0, etat.reussis ?? 0))
        let but: Int = min(n, max(1, etat.objectif ?? n))
        let teinte: Color = r >= but ? menthe : braise
        let grand: Font = Font.system(size: 15, weight: .heavy, design: .rounded)
        let petit: Font = Font.system(size: 11, weight: .bold, design: .rounded)
        return Group {
            if etat.fini || n <= 0 {
                LeconPourcent(etat: etat)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text("\(r)")
                        .font(grand)
                        .monospacedDigit()
                        .chiffreQuiRoule(r)
                    Text("/\(n)")
                        .font(petit)
                        .monospacedDigit()
                        .opacity(0.8)
                }
                .foregroundColor(teinte)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            }
        }
    }
}

/// Une case de la jauge des moments : menthe avec sa coche une fois le moment réussi (la coche se pose d’un rebond), le contour doré
/// sur la case qui valide la leçon.
struct LeconCase: View {
    let pleine: Bool
    let objectif: Bool

    var body: some View {
        let fond: Color = pleine ? menthe : Color.white.opacity(0.22)
        let contour: Color = objectif ? dore : Color.clear
        return ZStack {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(fond)
            if pleine {
                Image(systemName: "checkmark")
                    .font(.system(size: 8, weight: .black))
                    .foregroundColor(encre)
                    .transition(.scale(scale: 0.2).combined(with: .opacity))
            }
        }
        .frame(height: 14)
        .overlay(
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .stroke(contour, lineWidth: 2)
        )
    }
}

/// Les moments de la leçon, une case par moment, comme la jauge de l’écran de fin dans l’app.
@available(iOS 16.1, *)
struct LeconJauge: View {
    let etat: RequeteLecon.ContentState

    var body: some View {
        let n: Int = min(12, max(0, etat.moments ?? 0))
        let r: Int = min(n, max(0, etat.reussis ?? 0))
        let but: Int = min(n, max(1, etat.objectif ?? n))
        return HStack(spacing: 5) {
            ForEach(0..<n, id: \.self) { i in
                LeconCase(pleine: i < r, objectif: i == but - 1)
            }
        }
    }
}

/// L’avancement : la jauge des moments quand la leçon en a, sinon la barre de la vidéo.
@available(iOS 16.1, *)
struct LeconAvance: View {
    let etat: RequeteLecon.ContentState

    var body: some View {
        if (etat.moments ?? 0) > 0 {
            LeconJauge(etat: etat)
        } else {
            LeconBarre(progression: etat.fini ? 1 : etat.progression, fini: etat.fini)
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
                LeconAvance(etat: etat)
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

// Les lunettes du chat (Elisa, 7 novembre, sur la planche « Le chat se cache dans l’île » ; son choix : « Cheminée + lunettes ») :
// l’île est noire, on n’y voit que les lunettes du chat, et ses yeux suivent la leçon. Il regarde ; il sourit, l’objectif de la leçon
// atteint ; il s’endort quand la leçon est en pause depuis une heure (la Live Activity est périmée : RequeteWidgetPlugin.swift,
// staleDate) ; leçon réussie, des étoiles plein les yeux. Appui long : le chat sort du noir (ChatNoir, sur fond noir).

/// Ce que disent les yeux du chat, dans la Dynamic Island.
enum Regard {
    case ouvert    // il suit ta leçon
    case rieur     // l’objectif de la leçon est atteint
    case endormi   // la leçon est en pause : il garde ta place
    case etoiles   // leçon réussie
    case clin      // un ami vient d’entrer dans ta salle (la salle dans l’île, 7 novembre)
}

/// Un morceau des lunettes, tracé dans le cadre de 46 × 24 de la planche, puis mis à l’échelle de son cadre.
struct MorceauLunettes: Shape {
    enum Quoi {
        case montures, pont, iris, pupilles, reflets, yeuxRieurs, yeuxFermes, grandZ, petitZ, etoiles
        case clinFerme, irisDroit, pupilleDroite, refletDroit
    }

    let quoi: Quoi

    func path(in r: CGRect) -> Path {
        let e: CGFloat = r.width / 46
        let o: CGPoint = r.origin
        var p = Path()
        switch quoi {
        case .montures:
            MorceauLunettes.rond(&p, o, e, 12, 13, 9)
            MorceauLunettes.rond(&p, o, e, 34, 13, 9)
        case .pont:
            MorceauLunettes.courbe(&p, o, e, [21, 12, 23, 10, 25, 12])
        case .iris:
            MorceauLunettes.rond(&p, o, e, 13, 13.5, 5.2)
            MorceauLunettes.rond(&p, o, e, 35, 13.5, 5.2)
        case .pupilles:
            MorceauLunettes.rond(&p, o, e, 14.6, 13.8, 2.7)
            MorceauLunettes.rond(&p, o, e, 36.6, 13.8, 2.7)
        case .reflets:
            MorceauLunettes.rond(&p, o, e, 12.3, 11.3, 1.3)
            MorceauLunettes.rond(&p, o, e, 34.3, 11.3, 1.3)
        case .yeuxRieurs:
            MorceauLunettes.courbe(&p, o, e, [7, 14.5, 12, 9, 17, 14.5])
            MorceauLunettes.courbe(&p, o, e, [29, 14.5, 34, 9, 39, 14.5])
        case .yeuxFermes:
            MorceauLunettes.courbe(&p, o, e, [7, 12, 12, 16.8, 17, 12])
            MorceauLunettes.courbe(&p, o, e, [29, 12, 34, 16.8, 39, 12])
        case .grandZ:
            MorceauLunettes.ligne(&p, o, e, [41, -3, 46, -3, 41, 3, 46, 3])
        case .petitZ:
            MorceauLunettes.ligne(&p, o, e, [47.5, -8, 50.5, -8, 47.5, -4.5, 50.5, -4.5])
        case .etoiles:
            MorceauLunettes.etoile(&p, o, e, 12)
            MorceauLunettes.etoile(&p, o, e, 34)
        case .clinFerme:
            MorceauLunettes.courbe(&p, o, e, [7, 14.5, 12, 9, 17, 14.5])
        case .irisDroit:
            MorceauLunettes.rond(&p, o, e, 35, 13.5, 5.2)
        case .pupilleDroite:
            MorceauLunettes.rond(&p, o, e, 36.6, 13.8, 2.7)
        case .refletDroit:
            MorceauLunettes.rond(&p, o, e, 34.3, 11.3, 1.3)
        }
        return p
    }

    private static func point(_ o: CGPoint, _ e: CGFloat, _ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: o.x + x * e, y: o.y + y * e)
    }

    private static func rond(_ p: inout Path, _ o: CGPoint, _ e: CGFloat, _ x: CGFloat, _ y: CGFloat, _ rayon: CGFloat) {
        let cadre = CGRect(x: o.x + (x - rayon) * e, y: o.y + (y - rayon) * e, width: 2 * rayon * e, height: 2 * rayon * e)
        p.addEllipse(in: cadre)
    }

    /// Une courbe : départ, point de contrôle, arrivée.
    private static func courbe(_ p: inout Path, _ o: CGPoint, _ e: CGFloat, _ v: [CGFloat]) {
        p.move(to: point(o, e, v[0], v[1]))
        p.addQuadCurve(to: point(o, e, v[4], v[5]), control: point(o, e, v[2], v[3]))
    }

    /// Une ligne brisée (les « z » du chat qui dort).
    private static func ligne(_ p: inout Path, _ o: CGPoint, _ e: CGFloat, _ v: [CGFloat]) {
        p.move(to: point(o, e, v[0], v[1]))
        var i = 2
        while i + 1 < v.count {
            p.addLine(to: point(o, e, v[i], v[i + 1]))
            i += 2
        }
    }

    /// Une étoile à quatre branches, au centre d’un verre.
    private static func etoile(_ p: inout Path, _ o: CGPoint, _ e: CGFloat, _ cx: CGFloat) {
        let branches: [CGFloat] = [0, -6.4, 1.6, -1.6, 6.4, 0, 1.6, 1.6, 0, 6.4, -1.6, 1.6, -6.4, 0, -1.6, -1.6]
        p.move(to: point(o, e, cx + branches[0], 13 + branches[1]))
        var i = 2
        while i + 1 < branches.count {
            p.addLine(to: point(o, e, cx + branches[i], 13 + branches[i + 1]))
            i += 2
        }
        p.closeSubpath()
    }
}

/// Les lunettes du chat : les montures lilas sur le noir de l’île, et les yeux du moment.
struct LunettesChat: View {
    let regard: Regard
    let largeur: CGFloat

    var body: some View {
        let e: CGFloat = largeur / 46
        let hauteur: CGFloat = largeur * 24 / 46
        let etoile: Bool = regard == .etoiles
        let verre: Color = etoile ? dore.opacity(0.14) : lilas.opacity(0.14)
        let lueur: Color = etoile ? dore.opacity(0.55) : lilas.opacity(0.6)
        let flou: CGFloat = etoile ? 2 * e : 1.5 * e
        let monture = StrokeStyle(lineWidth: 2.2 * e, lineCap: .round)
        let paupiere = StrokeStyle(lineWidth: 2.4 * e, lineCap: .round, lineJoin: .round)
        return ZStack {
            MorceauLunettes(quoi: .montures).fill(verre)
            MorceauLunettes(quoi: .montures).stroke(lilas, style: monture)
            MorceauLunettes(quoi: .pont).stroke(lilas, style: monture)
            yeux(e, paupiere)
        }
        .frame(width: largeur, height: hauteur)
        .shadow(color: lueur, radius: flou)
    }

    @ViewBuilder
    private func yeux(_ e: CGFloat, _ paupiere: StrokeStyle) -> some View {
        switch regard {
        case .ouvert:
            ZStack {
                MorceauLunettes(quoi: .iris).fill(lilasClair)
                MorceauLunettes(quoi: .pupilles).fill(encre)
                MorceauLunettes(quoi: .reflets).fill(Color.white)
            }
        case .rieur:
            MorceauLunettes(quoi: .yeuxRieurs).stroke(lilasClair, style: paupiere)
        case .endormi:
            ZStack {
                MorceauLunettes(quoi: .yeuxFermes).stroke(lilasClair, style: paupiere)
                MorceauLunettes(quoi: .grandZ).stroke(lilasClair, style: StrokeStyle(lineWidth: 1.6 * e, lineCap: .round, lineJoin: .round))
                MorceauLunettes(quoi: .petitZ).stroke(lilasClair.opacity(0.7), style: StrokeStyle(lineWidth: 1.3 * e, lineCap: .round, lineJoin: .round))
            }
        case .etoiles:
            MorceauLunettes(quoi: .etoiles).fill(dore)
        case .clin:
            ZStack {
                MorceauLunettes(quoi: .clinFerme).stroke(lilasClair, style: paupiere)
                MorceauLunettes(quoi: .irisDroit).fill(lilasClair)
                MorceauLunettes(quoi: .pupilleDroite).fill(encre)
                MorceauLunettes(quoi: .refletDroit).fill(Color.white)
            }
        }
    }
}

/// Les yeux du chat pendant la leçon : des étoiles une fois réussie, endormis quand elle est en pause, rieurs l’objectif atteint.
@available(iOS 16.1, *)
func leconRegard(_ e: RequeteLecon.ContentState, perime: Bool) -> Regard {
    if e.fini { return .etoiles }
    if perime { return .endormi }
    let n: Int = e.moments ?? 0
    let r: Int = min(n, max(0, e.reussis ?? 0))
    let but: Int = min(n, max(1, e.objectif ?? n))
    if n > 0 && r >= but { return .rieur }
    return .ouvert
}

/// La leçon n’a plus bougé depuis une heure : iOS marque la Live Activity périmée (iOS 16.2 et plus).
@available(iOS 16.1, *)
func leconPerimee(_ context: ActivityViewContext<RequeteLecon>) -> Bool {
    if #available(iOSApplicationExtension 16.2, *) {
        return context.isStale
    }
    return false
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
                    Image("ChatNoir")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 52)
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
                        LeconAvance(etat: context.state)
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
                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 30)
            } compactTrailing: {
                LeconMoments(etat: context.state)
            } minimal: {
                LunettesChat(regard: leconRegard(context.state, perime: leconPerimee(context)), largeur: 24)
            }
            .keylineTint(braise)
        }
    }
}

// MARK: - Ta flamme en direct, jusqu’à minuit (Live Activity)
//
// Elisa, 7 novembre, 19 h 26 (« Oui », pour la planche « Ta flamme, en direct jusqu’à minuit » : « À l’heure de ton planning, si ta
// flamme n’est pas encore allumée, une barre se vide toute seule jusqu’à minuit. Un tap : une leçon express. »). À activer dans Mon
// compte (« Sur ton iPhone »). La page programme les prochains soirs de séance (index.html, flammeDirectSync ; RequeteWidgetPlugin.swift,
// flammeProgrammer) : à partir d’iOS 26, iOS la démarre tout seul à l’heure du rappel (au plus tôt 18 h : une Live Activity vit huit
// heures au plus), l’app fermée ; avant, elle démarre quand on ouvre l’app ce soir-là sans avoir fait sa séance. Le compte à rebours et
// la barre avancent sans rien recevoir (timerInterval). À minuit, elle est périmée (staleDate) : le chat s’endort. La flamme allumée :
// « Flamme allumée ! À demain. », les yeux rieurs, un quart d’heure sur l’écran verrouillé. Un appui pendant le compte à rebours : la
// séance du jour (lienSeance). Comme ailleurs : les valeurs d’abord, chacune avec son type, puis de courtes suites de modificateurs.

/// Le même type, au même nom et aux mêmes champs, est déclaré dans l’app (RequeteWidgetPlugin.swift) : iOS relie la Live Activity
/// programmée par l’app à son dessin ici par ce nom.
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

private let fondDirect = Color(red: 0.149, green: 0.106, blue: 0.42)
private let orangeClair = Color(red: 1.0, green: 0.725, blue: 0.541)

/// Où en est la flamme en direct : elle attend, elle est allumée, ou minuit est passé.
enum MomentDirect {
    case attend
    case allumee
    case passee
}

/// Allumée (la page l’a dit) ; minuit passé : la Live Activity est périmée (iOS 16.2 et plus), ou son heure est passée.
@available(iOS 16.1, *)
func momentDirect(_ context: ActivityViewContext<RequeteFlammeDirect>) -> MomentDirect {
    if context.state.fait { return .allumee }
    if #available(iOSApplicationExtension 16.2, *) {
        if context.isStale { return .passee }
    }
    if Date() >= context.attributes.minuit { return .passee }
    return .attend
}

/// Les yeux du chat : il attend avec toi, il sourit la flamme allumée, il dort après minuit.
func regardDirect(_ m: MomentDirect) -> Regard {
    switch m {
    case .attend:
        return .ouvert
    case .allumee:
        return .rieur
    case .passee:
        return .endormi
    }
}

/// Le chat de la planche : l’allumette (il attend), le saut de joie (allumée), le dodo (minuit passé).
func chatDirect(_ m: MomentDirect) -> String {
    switch m {
    case .attend:
        return "ChatAllumette"
    case .allumee:
        return "ChatBravo"
    case .passee:
        return "ChatDodo"
    }
}

/// La grande phrase.
func titreDirect(_ m: MomentDirect) -> String {
    switch m {
    case .attend:
        return "Ta flamme t’attend\u{202F}!"
    case .allumee:
        return "Flamme allumée\u{202F}!"
    case .passee:
        return "Minuit est passé"
    }
}

/// Sous la phrase, dans l’île ouverte : la prochaine activité, « À demain. », ou la prochaine séance.
func sousTitreDirect(_ m: MomentDirect, _ titre: String) -> String {
    switch m {
    case .attend:
        return titre
    case .allumee:
        return "À demain."
    case .passee:
        return "À ta prochaine séance\u{202F}!"
    }
}

/// Un appui pendant le compte à rebours : la séance du jour ; après, l’app.
func lienDirect(_ m: MomentDirect) -> URL? {
    if m == .attend { return lienSeance }
    return nil
}

/// De l’heure du rappel à minuit (jamais à l’envers).
@available(iOS 16.1, *)
func periodeDirect(_ flamme: RequeteFlammeDirect) -> ClosedRange<Date> {
    let debut: Date = min(flamme.debut, flamme.minuit)
    return debut...flamme.minuit
}

/// Le temps qui reste avant minuit, « 3:12:45 » : iOS le fait défiler tout seul.
@available(iOS 16.1, *)
struct DirectCompte: View {
    let flamme: RequeteFlammeDirect
    let taille: CGFloat

    var body: some View {
        let periode: ClosedRange<Date> = periodeDirect(flamme)
        let police: Font = Font.system(size: taille, weight: .heavy, design: .rounded)
        return Text(timerInterval: periode, countsDown: true)
            .font(police)
            .monospacedDigit()
            .foregroundColor(braise)
            .multilineTextAlignment(.trailing)
            .lineLimit(1)
    }
}

/// La barre qui se vide toute seule jusqu’à minuit.
@available(iOS 16.1, *)
struct DirectBarre: View {
    let flamme: RequeteFlammeDirect

    var body: some View {
        let periode: ClosedRange<Date> = periodeDirect(flamme)
        return ProgressView(timerInterval: periode, countsDown: true) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(braise)
    }
}

/// La leçon express, en pastille braise (toute la Live Activity mène à la séance).
struct DirectBouton: View {
    let texte: String

    var body: some View {
        let police: Font = Font.system(size: 13, weight: .heavy, design: .rounded)
        return Text(texte)
            .font(police)
            .foregroundColor(encre)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Capsule().fill(braise))
    }
}

/// Sous la phrase, sur l’écran verrouillé : « Il te reste 3 h 12 min » (iOS fait défiler le temps), ou la suite.
@available(iOS 16.1, *)
struct DirectSousTitre: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        let police: Font = Font.system(size: 13, weight: .bold, design: .rounded)
        return Group {
            switch moment {
            case .attend:
                (Text("Il te reste ") + Text(flamme.minuit, style: .relative))
                    .foregroundColor(orangeClair)
            case .allumee:
                Text("À demain.")
                    .foregroundColor(lilasClair)
            case .passee:
                Text("Ta prochaine séance rallumera ta flamme.")
                    .foregroundColor(lilasClair)
            }
        }
        .font(police)
        .lineLimit(2)
        .minimumScaleFactor(0.85)
    }
}

/// L’écran verrouillé (tous les iPhone, même sans Dynamic Island) : le chat, la phrase et ses lunettes, le temps qui reste, la barre
/// qui se vide, la leçon express.
@available(iOS 16.1, *)
struct DirectVerrouille: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        let chat: String = chatDirect(moment)
        let titre: String = titreDirect(moment)
        let teinte: Color = moment == .allumee ? dore : Color.white
        let police: Font = Font.system(size: 19, weight: .heavy, design: .rounded)
        return HStack(alignment: .center, spacing: 12) {
            Image(chat)
                .resizable()
                .scaledToFit()
                .frame(width: 88)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 6) {
                    Text(titre)
                        .font(police)
                        .foregroundColor(teinte)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Spacer(minLength: 0)
                    LunettesChat(regard: regardDirect(moment), largeur: 26)
                }
                DirectSousTitre(flamme: flamme, moment: moment)
                if moment == .attend {
                    DirectBarre(flamme: flamme)
                        .padding(.top, 2)
                    DirectBouton(texte: flamme.action)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}

/// À droite de l’île : la flamme et « 3:12:45 » ; allumée, la flamme dorée ; minuit passé, la lune.
@available(iOS 16.1, *)
struct DirectDroite: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        let petite: Font = Font.system(size: 11, weight: .bold)
        let grande: Font = Font.system(size: 15, weight: .bold)
        return Group {
            switch moment {
            case .attend:
                HStack(spacing: 3) {
                    Image(systemName: "flame.fill")
                        .font(petite)
                        .foregroundColor(braise)
                    DirectCompte(flamme: flamme, taille: 14)
                        .frame(maxWidth: 54)
                }
            case .allumee:
                Image(systemName: "flame.fill")
                    .font(grande)
                    .foregroundColor(dore)
            case .passee:
                Image(systemName: "moon.fill")
                    .font(petite)
                    .foregroundColor(lilas)
            }
        }
    }
}

/// Tout petit (une leçon aussi dans l’île : ses lunettes sont à elle) : la flamme braise, dorée une fois allumée ; minuit passé, la
/// lune.
struct DirectMinimal: View {
    let moment: MomentDirect

    private var symbole: String {
        if moment == .passee { return "moon.fill" }
        return "flame.fill"
    }

    private var teinte: Color {
        switch moment {
        case .attend:
            return braise
        case .allumee:
            return dore
        case .passee:
            return lilas
        }
    }

    var body: some View {
        let police: Font = Font.system(size: 14, weight: .bold)
        return Image(systemName: symbole)
            .font(police)
            .foregroundColor(teinte)
    }
}

/// L’île ouverte, à droite : « 3:12:45 » en grand et « avant minuit » ; allumée, la flamme dorée ; minuit passé, la lune.
@available(iOS 16.1, *)
struct DirectFin: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        let legende: Font = Font.system(size: 11, weight: .bold, design: .rounded)
        let grande: Font = Font.system(size: 28, weight: .bold)
        return Group {
            switch moment {
            case .attend:
                VStack(alignment: .trailing, spacing: 0) {
                    DirectCompte(flamme: flamme, taille: 22)
                        .frame(maxWidth: 96, alignment: .trailing)
                    Text("avant minuit")
                        .font(legende)
                        .foregroundColor(lilasPale)
                }
            case .allumee:
                Image(systemName: "flame.fill")
                    .font(grande)
                    .foregroundColor(dore)
            case .passee:
                Image(systemName: "moon.fill")
                    .font(grande)
                    .foregroundColor(lilas)
            }
        }
    }
}

/// L’île ouverte, au milieu : la phrase, puis la prochaine activité (« Leçon 4 · LEFT JOIN »), ou la suite.
@available(iOS 16.1, *)
struct DirectCentre: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        let titre: String = titreDirect(moment)
        let sous: String = sousTitreDirect(moment, flamme.titre)
        let teinte: Color = moment == .allumee ? dore : Color.white
        let grande: Font = Font.system(size: 16, weight: .heavy, design: .rounded)
        let petite: Font = Font.system(size: 12, weight: .bold, design: .rounded)
        return VStack(alignment: .leading, spacing: 2) {
            Text(titre)
                .font(grande)
                .foregroundColor(teinte)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if !sous.isEmpty {
                Text(sous)
                    .font(petite)
                    .foregroundColor(lilasPale)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
    }
}

/// L’île ouverte, en bas : la barre qui se vide et la leçon express (seulement pendant le compte à rebours).
@available(iOS 16.1, *)
struct DirectBas: View {
    let flamme: RequeteFlammeDirect
    let moment: MomentDirect

    var body: some View {
        if moment == .attend {
            HStack(alignment: .center, spacing: 10) {
                DirectBarre(flamme: flamme)
                DirectBouton(texte: flamme.action)
            }
            .padding(.horizontal, 4)
            .padding(.top, 2)
        }
    }
}

@available(iOS 16.1, *)
struct RequeteFlammeDirecte: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RequeteFlammeDirect.self) { context in
            DirectVerrouille(flamme: context.attributes, moment: momentDirect(context))
                .activityBackgroundTint(fondDirect)
                .activitySystemActionForegroundColor(Color.white)
                .widgetURL(lienDirect(momentDirect(context)))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(chatDirect(momentDirect(context)))
                        .resizable()
                        .scaledToFit()
                        .frame(width: 58)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    DirectFin(flamme: context.attributes, moment: momentDirect(context))
                }
                DynamicIslandExpandedRegion(.center) {
                    DirectCentre(flamme: context.attributes, moment: momentDirect(context))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    DirectBas(flamme: context.attributes, moment: momentDirect(context))
                }
            } compactLeading: {
                LunettesChat(regard: regardDirect(momentDirect(context)), largeur: 30)
            } compactTrailing: {
                DirectDroite(flamme: context.attributes, moment: momentDirect(context))
            } minimal: {
                DirectMinimal(moment: momentDirect(context))
            }
            .widgetURL(lienDirect(momentDirect(context)))
            .keylineTint(braise)
        }
    }
}

// MARK: - La salle dans l’île (Live Activity)
//
// Elisa, 7 novembre, 20 h 16 (« Oui », pour la planche « Ta salle vit dans l’île » : « Une seule activité, du code de la salle
// jusqu’au podium. Tu pars envoyer le code sur WhatsApp : tu vois tes amis arriver. »). La page la lance en ouvrant une salle
// entre amis (index.html, ileSalleSuivre ; RequeteWidgetPlugin.swift, salleDebut) et la tient à jour tant que l’app est
// ouverte ; l’app fermée, c’est le serveur qui la met à jour (la fonction jeu-ile pousse l’état de la salle, par Apple, aux
// téléphones des autres joueurs). L’état est le même pour tous (les joueurs, leurs points, la manche) : chacun s’y retrouve par
// son identifiant (moi). Trois temps : on attend les amis (le code, qui est là ; pour l’hôte, Partager et Lancer) ; la partie (le
// chrono qui descend tout seul, ta place, le défi, les scores) ; le podium (Victoire !, le classement ; pour l’hôte, Rejouer), un
// quart d’heure sur l’écran verrouillé. Un ami qui arrive : un clin d’œil dans l’île.

/// Les mêmes types, aux mêmes noms et aux mêmes champs, sont déclarés dans l’app (RequeteWidgetPlugin.swift) ; le serveur envoie
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

/// Ce que l’île tire de l’état de la salle, pour ce téléphone (moi).
@available(iOS 16.1, *)
enum LectureSalle {
    static func moi(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> JoueurSalle? {
        return e.joueurs.first { $0.p == a.moi }
    }

    /// Ma place (la dernière si je n’y suis pas).
    static func place(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> Int {
        let j: JoueurSalle? = moi(e, a)
        let r: Int = j?.r ?? e.joueurs.count
        return max(1, r)
    }

    /// « 1er », « 2e », « 3e »…
    static func rang(_ n: Int) -> String {
        if n == 1 { return "1er" }
        return "\(n)e"
    }

    static func hote(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> Bool {
        return e.hote == a.moi
    }

    /// Le pseudo d’un joueur ; « Toi » pour moi.
    static func nom(_ j: JoueurSalle, _ a: RequeteSalle) -> String {
        if j.p == a.moi { return "Toi" }
        return j.n
    }

    /// « 2/5 » : les joueurs dans la salle, sur le maximum.
    static func compte(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        return "\(e.joueurs.count)/\(a.max)"
    }

    /// Qui vient d’arriver (pas moi) : son pseudo, sinon vide.
    static func arrivee(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if e.nouveau.isEmpty || e.nouveau == a.moi { return "" }
        let j: JoueurSalle? = e.joueurs.first { $0.p == e.nouveau }
        return j?.n ?? ""
    }

    /// « que Léa », « qu’Anne ».
    static func que(_ n: String) -> String {
        let voyelles: String = "aeiouyàâäéèêëîïôöùûüœæAEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŒÆ"
        let initiale: Character = n.first ?? "x"
        if voyelles.contains(initiale) { return "qu’" + n }
        return "que " + n
    }

    /// En attente : pour l’hôte, qui n’est pas encore prêt ; pour les autres, l’hôte qui lance.
    static func attente(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if !hote(e, a) {
            let h: JoueurSalle? = e.joueurs.first { $0.p == e.hote }
            let n: String = h?.n ?? "l’hôte"
            let qui: String = que(n)
            return "on attend \(qui) lance"
        }
        if e.joueurs.count < 2 { return "on attend tes amis" }
        let attendus: [String] = e.joueurs.filter { !$0.ok && $0.p != a.moi }.map { $0.n }
        if attendus.isEmpty { return "tout le monde est prêt" }
        return "on attend " + attendus.joined(separator: ", ")
    }

    /// « Léa 240 · Toi 210 · Max 150 »
    static func scores(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        let morceaux: [String] = e.joueurs.prefix(4).map { (j: JoueurSalle) -> String in "\(nom(j, a)) \(j.pts)" }
        return morceaux.joined(separator: " · ")
    }

    /// Le podium : « 1. Toi 320 », « 2. Léa 290 », « 3. Max 150 ».
    static func podium(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> [String] {
        return e.joueurs.prefix(3).map { (j: JoueurSalle) -> String in
            let r: Int = max(1, j.r)
            return "\(r). \(nom(j, a)) \(j.pts)"
        }
    }

    /// La fin : « Victoire ! » à la première place (à plusieurs), sinon « 2e sur 4 ».
    static func titreFin(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if e.joueurs.count < 2 { return "Partie terminée\u{202F}!" }
        let p: Int = place(e, a)
        let n: Int = e.joueurs.count
        if p == 1 { return "Victoire\u{202F}!" }
        return "\(rang(p)) sur \(n)"
    }

    /// « Manche 3 sur 5 » ; entre deux manches, « Manche 2 sur 5 terminée ».
    static func manche(_ e: RequeteSalle.ContentState) -> String {
        let m: Int = max(1, e.manche)
        let nb: Int = max(1, e.nb)
        let texte: String = "Manche \(m) sur \(nb)"
        if e.phase == "pause" { return texte + " terminée" }
        return texte
    }

    /// « Rejouer » pour l’hôte à la première place, « Revanche » sinon.
    static func rejouer(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if place(e, a) == 1 { return "Rejouer" }
        return "Revanche"
    }

    /// Le chrono de la manche tourne encore.
    static func enCours(_ e: RequeteSalle.ContentState) -> Bool {
        return e.phase == "partie" && e.fin > Date().timeIntervalSince1970
    }

    /// De maintenant à la fin du chrono (jamais à l’envers).
    static func chrono(_ e: RequeteSalle.ContentState) -> ClosedRange<Date> {
        let fin: Date = Date(timeIntervalSince1970: e.fin)
        let debut: Date = min(Date(), fin)
        return debut...fin
    }

    /// Les yeux du chat : un clin d’œil quand un ami arrive ; sur le podium, des étoiles à la première place, rieurs sinon ; il suit
    /// la salle le reste du temps.
    static func regard(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> Regard {
        if e.phase == "fin" {
            if place(e, a) == 1 { return .etoiles }
            return .rieur
        }
        if e.phase == "attente" && !arrivee(e, a).isEmpty { return .clin }
        return .ouvert
    }

    /// Le chat de l’écran verrouillé : il salue en attente, il code pendant la partie, il saute de joie à la première place.
    static func chat(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if e.phase == "attente" { return "ChatSalut" }
        if e.phase == "fin" && place(e, a) == 1 { return "ChatBravo" }
        if e.phase == "fin" { return "ChatSalut" }
        return "ChatOrdi"
    }
}

/// Les liens de l’île vers la salle : « salle-partager », « salle-lancer », « salle-rejouer » (index.html, raccourciOuvrir).
/// Construits par morceaux : deux barres obliques écrites dans le code passeraient pour un commentaire aux yeux des tests.
func lienSalle(_ action: String) -> URL {
    var c = URLComponents()
    c.scheme = "requete"
    c.host = action
    return c.url ?? URL(fileURLWithPath: "/")
}

/// Un bouton de l’île : une pastille, un lien vers la salle dans l’app.
struct BoutonSalle: View {
    let texte: String
    let action: String
    let plein: Bool

    var body: some View {
        let police: Font = Font.system(size: 13, weight: .heavy, design: .rounded)
        let fond: Color = plein ? braise : Color.white.opacity(0.16)
        let teinte: Color = plein ? encre : Color.white
        return Link(destination: lienSalle(action)) {
            Text(texte)
                .font(police)
                .foregroundColor(teinte)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(Capsule().fill(fond))
        }
    }
}

/// Les joueurs en pastilles : l’initiale de chacun, sur sa couleur.
struct AvatarsSalle: View {
    let joueurs: [JoueurSalle]
    let taille: CGFloat

    private static let teintes: [Color] = [violetVif, braise, menthe, dore, lilas]

    static func initiale(_ n: String) -> String {
        let sans: String = n.hasPrefix("@") ? String(n.dropFirst()) : n
        let premiere: Character = sans.first ?? "?"
        return String(premiere).uppercased()
    }

    var body: some View {
        let police: Font = Font.system(size: taille * 0.46, weight: .heavy, design: .rounded)
        let ecart: CGFloat = taille * -0.18
        let liste: [JoueurSalle] = Array(joueurs.prefix(5))
        return HStack(spacing: ecart) {
            ForEach(0..<liste.count, id: \.self) { i in
                Text(AvatarsSalle.initiale(liste[i].n))
                    .font(police)
                    .foregroundColor(encre)
                    .frame(width: taille, height: taille)
                    .background(Circle().fill(AvatarsSalle.teintes[i % 5]))
                    .overlay(Circle().stroke(Color.black, lineWidth: 2))
            }
        }
    }
}

/// À droite de l’île : « 2/5 » en attente, le chrono pendant la manche, la place ensuite (dorée à la première).
@available(iOS 16.1, *)
struct SalleDroite: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let police: Font = Font.system(size: 14, weight: .heavy, design: .rounded)
        let place: Int = LectureSalle.place(etat, salle)
        let teinte: Color = place == 1 ? dore : lilasClair
        return Group {
            if etat.phase == "attente" {
                Text(LectureSalle.compte(etat, salle))
                    .foregroundColor(lilasClair)
            } else if LectureSalle.enCours(etat) {
                Text(timerInterval: LectureSalle.chrono(etat), countsDown: true)
                    .monospacedDigit()
                    .foregroundColor(braise)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 50)
            } else {
                Text(LectureSalle.rang(place))
                    .foregroundColor(teinte)
            }
        }
        .font(police)
        .lineLimit(1)
    }
}

/// Tout petit (une autre activité dans l’île) : « 2/5 », puis la place.
@available(iOS 16.1, *)
struct SalleMinimale: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let police: Font = Font.system(size: 12, weight: .heavy, design: .rounded)
        let place: Int = LectureSalle.place(etat, salle)
        let attente: Bool = etat.phase == "attente"
        let texte: String = attente ? LectureSalle.compte(etat, salle) : LectureSalle.rang(place)
        let teinte: Color = place == 1 ? dore : lilasClair
        return Text(texte)
            .font(police)
            .foregroundColor(teinte)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
    }
}

/// L’île ouverte, à gauche : le code de la salle en attente ; ensuite, ma place, « sur 4 ».
@available(iOS 16.1, *)
struct SalleGauche: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let petite: Font = Font.system(size: 11, weight: .bold, design: .rounded)
        let code: Font = Font.system(size: 17, weight: .heavy, design: .monospaced)
        let grande: Font = Font.system(size: 26, weight: .heavy, design: .rounded)
        let place: Int = LectureSalle.place(etat, salle)
        let teinte: Color = place == 1 ? dore : Color.white
        return VStack(alignment: .leading, spacing: 0) {
            if etat.phase == "attente" {
                Text("Salle")
                    .font(petite)
                    .foregroundColor(lilasPale)
                Text(salle.code)
                    .font(code)
                    .foregroundColor(Color.white)
            } else {
                Text(LectureSalle.rang(place))
                    .font(grande)
                    .foregroundColor(teinte)
                Text("sur \(etat.joueurs.count)")
                    .font(petite)
                    .foregroundColor(lilasPale)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
}

/// L’île ouverte, à droite : combien on est en attente ; le chrono pendant la manche ; la manche finie, une coche ; sur le
/// podium, le trophée (doré à la première place).
@available(iOS 16.1, *)
struct SalleTemps: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let grande: Font = Font.system(size: 22, weight: .heavy, design: .rounded)
        let petite: Font = Font.system(size: 11, weight: .bold, design: .rounded)
        let symbole: Font = Font.system(size: 26, weight: .bold)
        let place: Int = LectureSalle.place(etat, salle)
        let teinte: Color = place == 1 ? dore : lilas
        return Group {
            if etat.phase == "attente" {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(LectureSalle.compte(etat, salle))
                        .font(grande)
                        .foregroundColor(lilasClair)
                    Text("joueurs")
                        .font(petite)
                        .foregroundColor(lilasPale)
                }
            } else if LectureSalle.enCours(etat) {
                Text(timerInterval: LectureSalle.chrono(etat), countsDown: true)
                    .font(grande)
                    .monospacedDigit()
                    .foregroundColor(braise)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 90, alignment: .trailing)
            } else if etat.phase == "fin" {
                Image(systemName: "trophy.fill")
                    .font(symbole)
                    .foregroundColor(teinte)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(symbole)
                    .foregroundColor(menthe)
            }
        }
        .lineLimit(1)
    }
}

/// L’île ouverte, au milieu : qui arrive, ou « On attend les amis » et les pastilles ; le défi et la manche ; sur le podium,
/// « Victoire ! » et le défi.
@available(iOS 16.1, *)
struct SalleCentre: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let grande: Font = Font.system(size: 16, weight: .heavy, design: .rounded)
        let petite: Font = Font.system(size: 12, weight: .bold, design: .rounded)
        let arrivee: String = LectureSalle.arrivee(etat, salle)
        let fin: Bool = etat.phase == "fin"
        let teinte: Color = fin && LectureSalle.place(etat, salle) == 1 ? dore : Color.white
        let accueil: String = arrivee.isEmpty ? "On attend les amis" : arrivee + " arrive\u{202F}!"
        let haut: String = fin ? LectureSalle.titreFin(etat, salle) : etat.defi
        let bas: String = fin ? etat.defi : LectureSalle.manche(etat)
        return VStack(alignment: .leading, spacing: 3) {
            if etat.phase == "attente" {
                Text(accueil)
                    .font(grande)
                    .foregroundColor(Color.white)
                AvatarsSalle(joueurs: etat.joueurs, taille: 20)
            } else {
                Text(haut)
                    .font(grande)
                    .foregroundColor(teinte)
                Text(bas)
                    .font(petite)
                    .foregroundColor(lilasPale)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
}

/// L’île ouverte, en bas : en attente, Partager et Lancer pour l’hôte, sinon qui doit lancer ; pendant la partie, les scores ; sur
/// le podium, le classement et, pour l’hôte, Rejouer.
@available(iOS 16.1, *)
struct SalleBas: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let police: Font = Font.system(size: 13, weight: .semibold, design: .rounded)
        let hote: Bool = LectureSalle.hote(etat, salle)
        let podium: String = LectureSalle.podium(etat, salle).joined(separator: "   ")
        return Group {
            if etat.phase == "attente" && hote {
                HStack(spacing: 10) {
                    BoutonSalle(texte: "Partager", action: "salle-partager", plein: false)
                    BoutonSalle(texte: "Lancer", action: "salle-lancer", plein: true)
                }
            } else if etat.phase == "attente" {
                Text(LectureSalle.attente(etat, salle))
                    .font(police)
                    .foregroundColor(lilasClair)
            } else if etat.phase == "fin" {
                HStack(alignment: .center, spacing: 10) {
                    Text(podium)
                        .font(police)
                        .foregroundColor(Color.white)
                        .minimumScaleFactor(0.7)
                    if hote {
                        BoutonSalle(texte: LectureSalle.rejouer(etat, salle), action: "salle-rejouer", plein: true)
                    }
                }
            } else {
                Text(LectureSalle.scores(etat, salle))
                    .font(police)
                    .foregroundColor(lilasClair)
                    .minimumScaleFactor(0.75)
            }
        }
        .lineLimit(1)
        .padding(.horizontal, 4)
        .padding(.top, 2)
    }
}

/// L’écran verrouillé, en haut à droite : les lunettes du chat ; pendant la manche, le chrono.
@available(iOS 16.1, *)
struct SalleCoin: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let police: Font = Font.system(size: 17, weight: .heavy, design: .rounded)
        return Group {
            if LectureSalle.enCours(etat) {
                Text(timerInterval: LectureSalle.chrono(etat), countsDown: true)
                    .font(police)
                    .monospacedDigit()
                    .foregroundColor(braise)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 70, alignment: .trailing)
            } else {
                LunettesChat(regard: LectureSalle.regard(etat, salle), largeur: 26)
            }
        }
    }
}

/// L’écran verrouillé, sous la phrase : les pastilles des joueurs en attente ; les scores pendant la partie ; le podium.
@available(iOS 16.1, *)
struct SalleDetail: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    var body: some View {
        let police: Font = Font.system(size: 13, weight: .semibold, design: .rounded)
        let podium: String = LectureSalle.podium(etat, salle).joined(separator: "   ")
        return Group {
            if etat.phase == "attente" {
                AvatarsSalle(joueurs: etat.joueurs, taille: 24)
            } else if etat.phase == "fin" {
                Text(podium)
                    .font(police)
                    .foregroundColor(Color.white)
            } else {
                Text(LectureSalle.scores(etat, salle))
                    .font(police)
                    .foregroundColor(lilasClair)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
}

/// L’écran verrouillé (tous les iPhone) : le chat, la salle et ce qui s’y passe ; pour l’hôte, Partager et Lancer, puis Rejouer.
@available(iOS 16.1, *)
struct SalleVerrouille: View {
    let salle: RequeteSalle
    let etat: RequeteSalle.ContentState

    /// « Salle K7P2QX » ; « 2e sur 4 » ; « Victoire ! ».
    static func titre(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if e.phase == "attente" { return "Salle " + a.code }
        if e.phase == "fin" { return LectureSalle.titreFin(e, a) }
        let rang: String = LectureSalle.rang(LectureSalle.place(e, a))
        return "\(rang) sur \(e.joueurs.count)"
    }

    /// « 2/5 · on attend Max » ; « Le meilleur client · Manche 3 sur 5 » ; « Le meilleur client · 1er sur 4 ».
    static func sous(_ e: RequeteSalle.ContentState, _ a: RequeteSalle) -> String {
        if e.phase == "attente" {
            let compte: String = LectureSalle.compte(e, a)
            let qui: String = LectureSalle.attente(e, a)
            return "\(compte) · \(qui)"
        }
        if e.phase == "fin" && e.joueurs.count < 2 { return e.defi }
        let rang: String = LectureSalle.rang(LectureSalle.place(e, a))
        if e.phase == "fin" { return "\(e.defi) · \(rang) sur \(e.joueurs.count)" }
        let manche: String = LectureSalle.manche(e)
        return "\(e.defi) · \(manche)"
    }

    var body: some View {
        let chat: String = LectureSalle.chat(etat, salle)
        let titre: String = SalleVerrouille.titre(etat, salle)
        let sous: String = SalleVerrouille.sous(etat, salle)
        let place: Int = LectureSalle.place(etat, salle)
        let teinte: Color = etat.phase == "fin" && place == 1 ? dore : Color.white
        let grande: Font = Font.system(size: 19, weight: .heavy, design: .rounded)
        let petite: Font = Font.system(size: 13, weight: .bold, design: .rounded)
        let hote: Bool = LectureSalle.hote(etat, salle)
        return HStack(alignment: .center, spacing: 12) {
            Image(chat)
                .resizable()
                .scaledToFit()
                .frame(width: 80)
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 6) {
                    Text(titre)
                        .font(grande)
                        .foregroundColor(teinte)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Spacer(minLength: 0)
                    SalleCoin(salle: salle, etat: etat)
                }
                Text(sous)
                    .font(petite)
                    .foregroundColor(orangeClair)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                SalleDetail(salle: salle, etat: etat)
                if hote && etat.phase == "attente" {
                    HStack(spacing: 8) {
                        BoutonSalle(texte: "Partager", action: "salle-partager", plein: false)
                        BoutonSalle(texte: "Lancer", action: "salle-lancer", plein: true)
                    }
                }
                if hote && etat.phase == "fin" {
                    BoutonSalle(texte: LectureSalle.rejouer(etat, salle), action: "salle-rejouer", plein: true)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}

@available(iOS 16.1, *)
struct RequeteSalleIle: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RequeteSalle.self) { context in
            SalleVerrouille(salle: context.attributes, etat: context.state)
                .activityBackgroundTint(fondDirect)
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    SalleGauche(salle: context.attributes, etat: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    SalleTemps(salle: context.attributes, etat: context.state)
                }
                DynamicIslandExpandedRegion(.center) {
                    SalleCentre(salle: context.attributes, etat: context.state)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    SalleBas(salle: context.attributes, etat: context.state)
                }
            } compactLeading: {
                LunettesChat(regard: LectureSalle.regard(context.state, context.attributes), largeur: 30)
            } compactTrailing: {
                SalleDroite(salle: context.attributes, etat: context.state)
            } minimal: {
                SalleMinimale(salle: context.attributes, etat: context.state)
            }
            .keylineTint(braise)
        }
    }
}

/// Le widget de la flamme, et la Live Activity de la leçon (iOS 16.1 et plus) ; depuis le 6 novembre, la flamme de l’écran verrouillé ;
/// depuis le 7 novembre, la cheminée, ta semaine, la requête de poche et la carte mémo (ces deux-là à partir d’iOS 17 : leurs
/// boutons), ta flamme en direct jusqu’à minuit et la salle dans l’île (deux Live Activities).
@main
struct RequeteWidgets: WidgetBundle {
    var body: some Widget {
        RequeteWidget()
        RequeteCheminee()
        RequeteSemaine()
        if #available(iOS 16.1, *) {
            RequeteLeconActivite()
        }
        if #available(iOS 16.1, *) {
            RequeteFlammeVerrou()
        }
        if #available(iOS 16.1, *) {
            RequeteFlammeDirecte()
        }
        if #available(iOS 16.1, *) {
            RequeteSalleIle()
        }
        if #available(iOS 17.0, *) {
            RequetePoche()
        }
        if #available(iOS 17.0, *) {
            RequeteCarte()
        }
    }
}
