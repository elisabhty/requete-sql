package fr.requete.app;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

/* 26 novembre, 21 h 34 (Elisa, sur son Samsung : « ça flash encore », après « quand on écrit sur le cadre fait pour ça, ça saute,
   ça saute, ça saute […] pour les nouvelles notes en tout cas »). Filmé sur émulateur : dès que le clavier commence à monter,
   SystemBars (Capacitor 8) réduit d’un coup la fenêtre de l’appli à la hauteur qu’elle aura clavier ouvert. La WebView change de
   taille, redessine toute la page (une image blanche), et une bande claire (le fond de la fenêtre) reste sous la page le temps que
   le clavier finisse de monter.
   Le clavier passe maintenant par-dessus la vue, comme sur l’iPhone depuis le 13 novembre : la WebView garde toujours sa taille, et
   la page se cale sur le clavier dès qu’il s’annonce (keyboardWillShow, plugin Keyboard), en suivant son mouvement (index.html :
   kbNatif, --app-h ; ludique.css : « Le clavier qui monte »).
   Ce module remplace l’écouteur des marges de SystemBars sur la fenêtre (posé avant lui : les modules de Capacitor se chargent
   d’abord). Les barres du système restent comptées comme avant : avec une WebView récente (140 et plus), la page s’étend sous les
   barres et reçoit leur place (--safe-area-inset-*) ; avec une plus ancienne, la fenêtre garde la place de la barre d’état et des
   côtés, et la page descend jusqu’en bas de l’écran (la barre du bas comptée dans --safe-area-inset-bottom). Le clavier, lui, n’est
   plus retiré à la page : sa hauteur arrive par le plugin Keyboard, et la WebView ne le voit plus.
   C’est la page qui le demande (regler({dessus:true}), au tout début de index.html) : sans cette demande, rien ne change par rapport
   à SystemBars (la vue rétrécit avec le clavier). Une page plus ancienne, qui ne sait pas suivre le clavier elle-même, garde donc
   la vue qui rétrécit ; et une mise à jour de la page peut revenir à ce comportement (regler({dessus:false})) sans nouvelle version
   de l’appli. */
@CapacitorPlugin(name = "RequeteClavier")
public class ClavierPlugin extends Plugin {

    // SystemBars : WEBVIEW_VERSION_WITH_SAFE_AREA_FIX et WEBVIEW_VERSION_WITH_SAFE_AREA_KEYBOARD_FIX
    private static final int WEBVIEW_MARGES = 140;
    private static final int WEBVIEW_MARGES_CLAVIER = 144;

    private volatile boolean dessus = false;
    private int versionWebView = 0;

    @Override
    public void load() {
        super.load();
        View fenetre = getActivity().getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(fenetre, this::appliquer);
        fenetre.requestApplyInsets();
    }

    @PluginMethod
    public void regler(final PluginCall call) {
        final boolean voulu = Boolean.TRUE.equals(call.getBoolean("dessus", false));
        getBridge()
            .executeOnMainThread(() -> {
                dessus = voulu;
                getActivity().getWindow().getDecorView().requestApplyInsets();
                JSObject r = new JSObject();
                r.put("dessus", dessus);
                call.resolve(r);
            });
    }

    private WindowInsetsCompat appliquer(View v, WindowInsetsCompat marges) {
        int barresEtEncoche = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        Insets barres = marges.getInsets(barresEtEncoche);
        Insets clavier = marges.getInsets(WindowInsetsCompat.Type.ime());
        boolean clavierLa = marges.isVisible(WindowInsetsCompat.Type.ime());
        int version = versionWebView();
        boolean recente = version >= WEBVIEW_MARGES;
        WindowInsetsCompat.Builder b = new WindowInsetsCompat.Builder(marges);
        int haut = 0, droite = 0, bas = 0, gauche = 0;

        if (dessus) {
            // Le clavier par-dessus la vue : la WebView ne le voit plus (ni sa place, ni sa présence)
            b.setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE);
            b.setVisible(WindowInsetsCompat.Type.ime(), false);
            if (recente) {
                v.setPadding(0, 0, 0, 0);
                b.setInsets(barresEtEncoche, barres);
                haut = barres.top;
                droite = barres.right;
                gauche = barres.left;
            } else {
                v.setPadding(barres.left, barres.top, barres.right, 0);
                b.setInsets(barresEtEncoche, Insets.NONE);
            }
            bas = barres.bottom;
        } else if (recente) {
            // SystemBars, WebView récente
            v.setPadding(0, 0, 0, clavierLa ? clavier.bottom : 0);
            int basBarres = version < WEBVIEW_MARGES_CLAVIER && clavierLa ? 0 : barres.bottom;
            b.setInsets(barresEtEncoche, Insets.of(barres.left, barres.top, barres.right, basBarres));
            haut = barres.top;
            droite = barres.right;
            gauche = barres.left;
            bas = clavierLa ? 0 : basBarres;
        } else {
            // SystemBars, WebView plus ancienne
            v.setPadding(barres.left, barres.top, barres.right, clavierLa ? clavier.bottom : barres.bottom);
            b.setInsets(barresEtEncoche, Insets.NONE);
        }

        poserMarges(haut, droite, bas, gauche);
        return b.build();
    }

    /* Les mêmes variables que SystemBars (--safe-area-inset-*, en px CSS), et le mode du clavier pour la page */
    private void poserMarges(int haut, int droite, int bas, int gauche) {
        float d = getActivity().getResources().getDisplayMetrics().density;
        final String script = String.format(
            Locale.US,
            "try{var s=document.documentElement.style;" +
                "s.setProperty('--safe-area-inset-top','%dpx');s.setProperty('--safe-area-inset-right','%dpx');" +
                "s.setProperty('--safe-area-inset-bottom','%dpx');s.setProperty('--safe-area-inset-left','%dpx');" +
                "window.__requeteClavier='%s';}catch(e){}",
            (int) (haut / d),
            (int) (droite / d),
            (int) (bas / d),
            (int) (gauche / d),
            dessus ? "dessus" : "vue"
        );
        getBridge()
            .executeOnMainThread(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().evaluateJavascript(script, null);
            });
    }

    private int versionWebView() {
        if (versionWebView > 0 || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return versionWebView;
        try {
            PackageInfo p = WebView.getCurrentWebViewPackage();
            if (p != null && p.versionName != null) versionWebView = Integer.parseInt(p.versionName.split("\\.")[0]);
        } catch (Exception e) {
            versionWebView = 0;
        }
        return versionWebView;
    }
}
