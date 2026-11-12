#!/bin/bash
# Écran de lancement de l’appli iOS : fond lavande, les 16 emplacements de la touche (12 novembre) et 23 points de données, aux places exactes de la première image de
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
# 12 novembre, 17 h 51 (Elisa, sa capture de l’écran de lancement : l’heure et « TestFlight » en blanc sur le fond lavande) :
# pendant l’écran de lancement, iOS suit la clé UIStatusBarStyle d’Info.plist ; sans elle, en mode sombre, la barre d’état est
# blanche, puis l’appli la repasse en sombre : un saut au départ. Sombre dès le lancement.
plist="$app/Info.plist"
if [ -f "$plist" ] && [ -x /usr/libexec/PlistBuddy ]; then
  /usr/libexec/PlistBuddy -c "Set :UIStatusBarStyle UIStatusBarStyleDarkContent" "$plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :UIStatusBarStyle string UIStatusBarStyleDarkContent" "$plist"
  # 12 novembre, 18 h 12 (sa capture de la connexion avec Google : « “App” souhaite utiliser “accounts.google.com” pour se
  # connecter ») : iOS y écrit CFBundleName, qui valait $(PRODUCT_NAME), le nom de la cible Xcode de Capacitor : « App ».
  /usr/libexec/PlistBuddy -c "Set :CFBundleName Requête" "$plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleName string Requête" "$plist"
fi
echo "Écran de lancement à jour : fond lavande, emplacements de la touche et points de données."
