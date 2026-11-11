#!/bin/bash
# Écran de lancement de l’appli iOS : fond lavande et 23 points de données, aux places exactes de la première image de
# l’ouverture animée (« Le logo se construit », 11 novembre ; ludique.css, 37 bis ; écrit par tools/ecran-lancement.py).
# Elisa, 3 novembre, 23 h 02 : « quand j’ouvre l’appli, il y a un écran noir » : l’ancien écran étirait sur tout l’écran une
# image de 2732 × 2732 px, sur un fond « couleur système » (noir en mode sombre) : trop lourde pour iOS, qui la sautait.
# Celui-ci n’a plus d’image du tout. Le dossier ios/ n’est pas dans Git : ce script y recopie la version gardée dans
# resources/ios. Lancé par npm run ios et npm run ios:testflight, après « cap sync ».
set -euo pipefail
racine="$(cd "$(dirname "$0")/.." && pwd)"
app="$racine/ios/App/App"
if [ ! -d "$app/Assets.xcassets" ] || [ ! -d "$app/Base.lproj" ]; then
  echo "Projet iOS introuvable (ios/App/App) : lance d’abord npm run ios:add." >&2
  exit 1
fi
cp "$racine/resources/ios/LaunchScreen.storyboard" "$app/Base.lproj/LaunchScreen.storyboard"
# L’image de la touche (jusqu’au 11 novembre) ne sert plus
rm -rf "$app/Assets.xcassets/SplashLogo.imageset"
echo "Écran de lancement à jour : fond lavande, points de données."
