#!/usr/bin/env bash
# Le clavier d’Android dans une note, filmé et mesuré sur un émulateur de GitHub (.github/workflows/android.yml, travail « clavier »).
# Elisa, 26 novembre, 17 h 27, sur son Samsung : « Ça a continué à sauter au niveau de la prise de notes. Quand on clique sur le
# carré, le cadre pour écrire, ça saute au début. » Le téléphone simulé a la taille du sien (411 × 914 points). L’appli s’ouvre
# droit dans l’accueil ; tools/android/clavier.mjs ouvre une note, touche le cadre d’écriture avec le doigt d’Android (le vrai
# clavier monte), relève image par image ce qui bouge dans la page, et filme l’écran. Le journal donne les mesures et une planche
# des images du film (en base64, entre deux repères), le rapport et le film sont dans l’artefact « clavier-android ».
set -eu
BT="$RUNNER_TEMP/bundletool.jar"
java -jar "$BT" install-apks --apks essai/requete-essai.apks
adb shell pm grant fr.requete.app android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell settings put global anr_show_background 0 || true
# Le clavier à l’écran même si l’émulateur se croit un clavier physique
adb shell settings put secure show_ime_with_hard_keyboard 1 || true
adb shell wm size; adb shell wm density
echo "Clavier : $(adb shell settings get secure default_input_method | tr -d '\r')"
adb logcat -c || true
adb shell monkey -p fr.requete.app -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 35
PID=$(adb shell pidof fr.requete.app | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | tr -d "\r" | grep -o "webview_devtools_remote_$PID" | head -1 || true)
adb forward tcp:9222 "localabstract:${SOCK:-webview_devtools_remote_$PID}"
mkdir -p captures
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
HAUT=$(adb shell cat /sdcard/ui.xml 2>/dev/null | tr -d "\r" | grep -o 'class="android.webkit.WebView"[^>]*bounds="\[[0-9]*,[0-9]*\]' | head -1 | sed 's/.*\[[0-9]*,\([0-9]*\)\]$/\1/' || true)
echo "Haut de la vue de l’appli : ${HAUT:-?} px"
ESSAI_HAUT="${HAUT:-0}" timeout 600 node tools/android/clavier.mjs || echo "La mesure s’est arrêtée en erreur"
echo "--- Journal de l’appli (erreurs) ---"
timeout 30 adb logcat -d | grep -iE "fr.requete|Capacitor|chromium|AndroidRuntime" | grep -iE "error|exception|fatal" | grep -v "Error injecting safe area" | tail -30 || true
