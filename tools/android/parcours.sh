#!/usr/bin/env bash
# Le parcours complet de l’appli Android sur un émulateur de GitHub (.github/workflows/android.yml, travail « parcours ») :
# installe le paquet d’essai, lance l’appli, puis tools/android/parcours.mjs la fait parcourir de l’intérieur.
set -eu
BT="$RUNNER_TEMP/bundletool.jar"
java -jar "$BT" install-apks --apks essai/requete-essai.apks
# Les notifications : autorisées d’avance (la fenêtre d’Android ne bloque pas le parcours)
adb shell pm grant fr.requete.app android.permission.POST_NOTIFICATIONS 2>/dev/null || true
if [ "${ESSAI_SOMBRE:-0}" = "1" ]; then adb shell cmd uimode night yes || true; sleep 2; fi
adb shell wm size; adb shell wm density
adb logcat -c || true
adb shell monkey -p fr.requete.app -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 35
PID=$(adb shell pidof fr.requete.app | tr -d '\r')
SOCK=$(adb shell cat /proc/net/unix | tr -d "\r" | grep -o "webview_devtools_remote_$PID" | head -1 || true)
adb forward tcp:9222 "localabstract:${SOCK:-webview_devtools_remote_$PID}"
mkdir -p captures
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
HAUT=$(adb shell cat /sdcard/ui.xml 2>/dev/null | tr -d "\r" | grep -o 'class="android.webkit.WebView"[^>]*bounds="\[[0-9]*,[0-9]*\]' | head -1 | sed 's/.*\[[0-9]*,\([0-9]*\)\]$/\1/' || true)
ESSAI_HAUT="${HAUT:-0}" node tools/android/parcours.mjs || echo "Le parcours s’est arrêté en erreur"
echo "--- Journal de l’appli (erreurs) ---"
adb logcat -d | grep -iE "fr.requete|Capacitor|chromium|AndroidRuntime" | grep -iE "error|exception|fatal" | grep -v "Error injecting safe area" | tail -40 || true
