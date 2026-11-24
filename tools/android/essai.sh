#!/usr/bin/env bash
# L’essai de l’appli Android sur un émulateur de GitHub (.github/workflows/android.yml, travail « essai »).
# Installe le paquet tel que Google Play le livrerait (partie principale + paquet des voix), lance l’appli,
# puis tools/android/essai.mjs vérifie de l’intérieur que la page tourne et que les voix se lisent.
set -eu
BT="$RUNNER_TEMP/bundletool.jar"
java -jar "$BT" install-apks --apks essai/requete-essai.apks
echo "Fichiers installés :"; adb shell pm path fr.requete.app
adb logcat -c || true
adb shell monkey -p fr.requete.app -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 30
PID=$(adb shell pidof fr.requete.app | tr -d '\r')
echo "Appli lancée (processus $PID)"
SOCK=$(adb shell cat /proc/net/unix | tr -d "\r" | grep -o "webview_devtools_remote_$PID" | head -1 || true)
adb forward tcp:9222 "localabstract:${SOCK:-webview_devtools_remote_$PID}"
mkdir -p captures
VOIX="$(cd assets/voix && ls -d */ | head -1)"; VOIX="${VOIX%/}"; FICHIER="$(ls assets/voix/$VOIX | grep mp3 | head -1)"
ESSAI_VOIX="assets/voix/$VOIX/$FICHIER" ESSAI_TAILLE="$(stat -c %s "assets/voix/$VOIX/$FICHIER")" node tools/android/essai.mjs
adb exec-out screencap -p > captures/ecran-final.png || true
echo "--- Journal de l’appli (erreurs) ---"
adb logcat -d | grep -iE "fr.requete|Capacitor|chromium" | grep -iE "error|exception|fatal" | tail -40 || true
