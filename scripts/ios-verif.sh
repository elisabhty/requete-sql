#!/bin/bash
# Vérifie que le Swift de l’app et de ses widgets compile, sans signer ni rien envoyer (Elisa, 7 novembre, 20 h 44 : « compile swift
# je suis sur mac »). À lancer par « npm run ios:verif », qui prépare le projet comme ios:testflight (la page, Capacitor, l’écran de
# lancement, le widget). Une fabrication pour iPhone sans signature : ni compte Apple, ni profil, ni droit des push n’entrent en
# jeu. Le journal complet va dans ios/verif-swift.log (hors de Git : Claude le lit par le dossier connecté) ; à l’écran, les erreurs.
set -uo pipefail
cd "$(dirname "$0")/../ios/App"
journal=../verif-swift.log
echo "Compilation de l’app et des widgets (sans signature, rien n’est envoyé, quelques minutes)…"
xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath build/verif CODE_SIGNING_ALLOWED=NO build > "$journal" 2>&1
code=$?
grep -E "error:" "$journal" | sort -u | head -30
if [ "$code" -eq 0 ]; then
  echo "✅ Le Swift compile (journal : ios/verif-swift.log)."
else
  echo "❌ Ça ne compile pas encore : les erreurs sont au-dessus (journal complet : ios/verif-swift.log)."
fi
exit 0
