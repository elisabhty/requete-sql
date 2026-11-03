#!/bin/bash
# Envoie l’appli iOS sur TestFlight : archive « Release » puis envoi à App Store Connect, sans passer par les menus d’Xcode.
# À lancer par « npm run ios:testflight » (qui copie d’abord l’app web dans le projet iOS).
# Avant la première fois : l’équipe choisie dans Xcode (cible App › Signing & Capabilities › Team) et la fiche de l’appli
# créée sur App Store Connect avec l’identifiant fr.requete.app (voir IOS.md, « TestFlight »).
set -euo pipefail
cd "$(dirname "$0")/../ios/App"

if ! grep -q 'DEVELOPMENT_TEAM' App.xcodeproj/project.pbxproj; then
  echo "Choisis d’abord ton équipe dans Xcode : cible App › Signing & Capabilities › Team." >&2
  exit 1
fi

rm -rf build/Requete.xcarchive build/envoi
echo "1/2 Fabrication de l’appli (quelques minutes)…"
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/Requete.xcarchive \
  -allowProvisioningUpdates archive
echo "2/2 Envoi à App Store Connect…"
xcodebuild -exportArchive -archivePath build/Requete.xcarchive \
  -exportOptionsPlist ../../scripts/ios-export-options.plist -exportPath build/envoi \
  -allowProvisioningUpdates
echo "Envoyé. Apple prépare la version : elle arrive dans TestFlight d’ici 10 à 30 minutes (un e-mail le dit)."
