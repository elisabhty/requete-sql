import WidgetKit
import SwiftUI

// Le widget de Requête (Elisa, 4 novembre, 3 h 54, d’après l’onboarding de Duolingo) : la série de jours, la flamme du jour
// et le chat qui dépasse du bas, sur le violet de l’app. L’app (index.html, widgetMaj) range la série dans le groupe d’apps
// chaque fois qu’elle passe en arrière-plan ; le widget la relit à chaque minuit : la flamme du jour s’éteint, et une série
// qui n’a pas été tenue (après le dernier jour qui la gardait, jours de repos du planning compris) retombe à zéro.

private let groupe = "group.fr.requete.app"

struct SerieEntree: TimelineEntry {
    let date: Date
    let serie: Int
    let faitAujourdhui: Bool
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

    func getTimeline(in context: Context, completion: @escaping (Timeline<SerieEntree>) -> Void) {
        let cal = Calendar.current
        let maintenant = Date()
        var dates = [maintenant]
        var minuit = cal.startOfDay(for: maintenant)
        for _ in 0..<7 {
            guard let suivant = cal.date(byAdding: .day, value: 1, to: minuit) else { break }
            minuit = suivant
            dates.append(suivant)
        }
        completion(Timeline(entries: dates.map { entree(pour: $0) }, policy: .atEnd))
    }

    private func cle(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// jour : le jour où l’app a compté la série ; fait : ce jour-là a eu son activité ;
    /// limite : le dernier jour où une activité garde la série.
    private func entree(pour date: Date) -> SerieEntree {
        let d = UserDefaults(suiteName: groupe)
        let serie = d?.integer(forKey: "serie") ?? 0
        let jour = d?.string(forKey: "jour") ?? ""
        let fait = d?.bool(forKey: "fait") ?? false
        let limite = d?.string(forKey: "limite") ?? ""
        let k = cle(date)
        if k == jour {
            return SerieEntree(date: date, serie: serie, faitAujourdhui: fait)
        }
        if !limite.isEmpty && k <= limite {
            return SerieEntree(date: date, serie: serie, faitAujourdhui: false)
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

struct SerieVue: View {
    let entree: SerieEntree

    private var flamme: Color {
        entree.faitAujourdhui ? Color(red: 1.0, green: 0.784, blue: 0.239) : Color.white.opacity(0.55)
    }

    private var chiffre: Color {
        entree.faitAujourdhui ? Color(red: 1.0, green: 0.847, blue: 0.420) : Color.white.opacity(0.9)
    }

    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .top) {
                HStack(spacing: g.size.width * 0.03) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: g.size.width * 0.2, weight: .bold))
                        .foregroundColor(flamme)
                    Text("\(entree.serie)")
                        .font(.system(size: g.size.width * 0.27, weight: .heavy, design: .rounded))
                        .foregroundColor(chiffre)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                }
                .padding(.top, g.size.height * 0.1)
                .frame(width: g.size.width)
                Image("Mascotte")
                    .resizable()
                    .scaledToFit()
                    .frame(width: g.size.width * 0.66)
                    .position(x: g.size.width / 2, y: g.size.height * 0.97)
            }
            .frame(width: g.size.width, height: g.size.height)
        }
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
        .description("Ta série de jours sur Requête, et la flamme du jour.")
        .supportedFamilies([.systemSmall])
        .sansMarges()
    }
}
