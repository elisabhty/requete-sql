package fr.requete.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* 26 novembre, 15 h 28 (Elisa, sur son Samsung : « Pas de terme coupé stp »). La WebView d’Android agrandit d’elle-même le texte
       de la page selon le réglage « Taille de police » du téléphone ; les pages, faites pour la taille de l’iPhone (qui, lui, ne
       l’agrandit pas), coupaient alors des mots (« Recommence / r »). Le texte de l’appli garde sa taille prévue, comme sur iPhone.
       26 novembre, 21 h 34 (« ça flash encore ») : le clavier passe par-dessus la vue (ClavierPlugin), à partir d’Android 11 (les
       marges du clavier y sont celles de la fenêtre) ; avant, la vue rétrécit toujours avec lui (SystemBars). Le module est inscrit
       avant le démarrage du pont (après ceux de Capacitor, donc après SystemBars). */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) registerPlugin(ClavierPlugin.class);
        super.onCreate(savedInstanceState);
        WebView vue = getBridge() != null ? getBridge().getWebView() : null;
        if (vue != null) vue.getSettings().setTextZoom(100);
    }
}
