#!/usr/bin/env bash
# La mise à jour à distance sur Android (.github/workflows/android.yml, travail « maj »).
# Elisa, 25 novembre, 22 h 57 : « Vérifie » (que l’appli Android se met à jour à distance comme l’iPhone).
# Le paquet « ancienne » est l’appli d’aujourd’hui qui se croit en v3100 : elle doit lire l’annonce de requeteapp.com, télécharger
# la version publiée pour tous, l’installer au lancement suivant et la garder (tools/android/maj.mjs).
set -eu
BT="$RUNNER_TEMP/bundletool.jar"
java -jar "$BT" install-apks --apks essai/requete-ancienne.apks
echo "Fichiers installés :"; adb shell pm path fr.requete.app
adb shell settings put global anr_show_background 0 || true
adb logcat -c || true
mkdir -p captures
timeout 900 node tools/android/maj.mjs
