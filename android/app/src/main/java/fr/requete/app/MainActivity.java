package fr.requete.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* 26 novembre, 15 h 28 (Elisa, sur son Samsung : « Pas de terme coupé stp »). La WebView d’Android agrandit d’elle-même le texte
       de la page selon le réglage « Taille de police » du téléphone ; les pages, faites pour la taille de l’iPhone (qui, lui, ne
       l’agrandit pas), coupaient alors des mots (« Recommence / r »). Le texte de l’appli garde sa taille prévue, comme sur iPhone. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView vue = getBridge() != null ? getBridge().getWebView() : null;
        if (vue != null) vue.getSettings().setTextZoom(100);
    }
}
