#!/usr/bin/env python3
"""L’écran de lancement de l’appli iOS : fond lavande et 23 points de données (Elisa, 11 novembre, 13 h 10 : « Le logo se construit »).

12 novembre, 17 h 51 (« Améliore cette entrée ») : au centre, les seize emplacements de la touche, en clair (#E9E4FA), là où les
points vont se poser. Une vue transparente de 496 unités de côté (4 cases de 112, espacées de 16), centrée comme la touche
(14 unités au-dessus du milieu), porte seize vues carrées placées en fractions de son côté : comme .in-s dans la page.

Les points sont ceux de l’ouverture animée (POINTS, dans le script qui suit #loader, index.html) : [x, y] en fractions de la
largeur et de la hauteur de l’écran, carrés de 30/2732 du plus grand côté (30 unités, --u dans ludique.css, 37 bis), couleur
#D2C6F7. Ce script les lit dans index.html et écrit resources/ios/LaunchScreen.storyboard : de simples vues carrées, sans image
(une grande image ne s’affichait pas : l’écran noir du 3 novembre), placées par des contraintes proportionnelles (centre =
centre de l’écran × 2x), si bien que la première image de l’ouverture est identique sur tous les iPhone. Les écrans de lancement
n’acceptent ni code ni attributs personnalisés : les points restent carrés, comme dans la page avant le départ.

    python3 tools/ecran-lancement.py      # réécrit resources/ios/LaunchScreen.storyboard
"""
import json
import os
import re

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
PAGE = os.path.join(RACINE, 'index.html')
SORTIE = os.path.join(RACINE, 'resources', 'ios', 'LaunchScreen.storyboard')

COTE = 30 / 2732                 # côté d’un point : 30 unités sur 2732, du plus grand côté de l’écran
COULEUR = (0xD2, 0xC6, 0xF7)     # #D2C6F7, comme .in-d
CASE = (0xE9, 0xE4, 0xFA)        # #E9E4FA, comme .in-s
GRILLE = 496 / 2732              # côté de la grille des emplacements : 4 × 112 + 3 × 16 unités
FOND = '<color key="backgroundColor" red="0.95686274509803926" green="0.94901960784313721" blue="0.9882352941176471" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>'
VUE = 'Ze5-6b-2t3'
GRILLE_ID = 'gRl-eM-plc'
L, H = 375, 667                  # le cadre d’Interface Builder (les contraintes font le reste)


def points():
    page = open(PAGE, encoding='utf-8').read()
    m = re.search(r'var POINTS=(\[\[[\d.,\[\]\s]+\]\]);', page)
    if not m:
        raise SystemExit('POINTS introuvable dans index.html')
    return json.loads(re.sub(r'\s+', '', m.group(1)))


def nombre(v):
    return ('%.6f' % v).rstrip('0').rstrip('.')


def ecrire():
    pts = points()
    assert len(pts) == 23, len(pts)
    c = max(L, H) * COTE
    coul = ' '.join('%s="%s"' % (k, nombre(v / 255)) for k, v in zip(('red', 'green', 'blue'), COULEUR))
    vues, liens = [], []
    for i, (x, y) in enumerate(pts):
        ident = 'P%02d-dD-pnt' % i
        vues.append(
            f'                            <view userInteractionEnabled="NO" contentMode="scaleToFill" translatesAutoresizingMaskIntoConstraints="NO" id="{ident}" userLabel="Point {i + 1}">\n'
            f'                                <rect key="frame" x="{nombre(x * L - c / 2)}" y="{nombre(y * H - c / 2)}" width="{nombre(c)}" height="{nombre(c)}"/>\n'
            f'                                <color key="backgroundColor" {coul} alpha="1" colorSpace="custom" customColorSpace="sRGB"/>\n'
            f'                                <constraints>\n'
            f'                                    <constraint firstAttribute="width" secondItem="{ident}" secondAttribute="height" id="c{i:02d}-Ar-dDt"/>\n'
            f'                                </constraints>\n'
            f'                            </view>')
        liens += [
            f'<constraint firstItem="{ident}" firstAttribute="centerX" secondItem="{VUE}" secondAttribute="centerX" multiplier="{nombre(2 * x)}" id="c{i:02d}-Cx-dDt"/>',
            f'<constraint firstItem="{ident}" firstAttribute="centerY" secondItem="{VUE}" secondAttribute="centerY" multiplier="{nombre(2 * y)}" id="c{i:02d}-Cy-dDt"/>',
        ]
        # Le plus grand des deux côtés, comme max(100vw,100vh) dans la page : deux minimums, deux égalités presque obligatoires
        for n, cote in enumerate(('height', 'width')):
            liens.append(f'<constraint firstItem="{ident}" firstAttribute="height" relation="greaterThanOrEqual" secondItem="{VUE}" secondAttribute="{cote}" multiplier="{nombre(COTE)}" id="c{i:02d}-M{n}-dDt"/>')
            liens.append(f'<constraint firstItem="{ident}" firstAttribute="height" secondItem="{VUE}" secondAttribute="{cote}" multiplier="{nombre(COTE)}" priority="999" id="c{i:02d}-E{n}-dDt"/>')
    # Les seize emplacements, dans leur grille (une vue transparente, du plus grand côté de l’écran comme les points)
    g = max(L, H) * GRILLE
    coul_case = ' '.join('%s="%s"' % (k, nombre(v / 255)) for k, v in zip(('red', 'green', 'blue'), CASE))
    cases, liens_grille = [], []
    for col in range(4):
        for r in range(4):
            n = col * 4 + r
            ident = 'S%02d-eM-plc' % n
            fx, fy = (col * 128 + 56) / 496, (r * 128 + 56) / 496
            cc = g * 112 / 496
            cases.append(
                f'                                    <view userInteractionEnabled="NO" contentMode="scaleToFill" translatesAutoresizingMaskIntoConstraints="NO" id="{ident}" userLabel="Emplacement {n + 1}">\n'
                f'                                        <rect key="frame" x="{nombre(fx * g - cc / 2)}" y="{nombre(fy * g - cc / 2)}" width="{nombre(cc)}" height="{nombre(cc)}"/>\n'
                f'                                        <color key="backgroundColor" {coul_case} alpha="1" colorSpace="custom" customColorSpace="sRGB"/>\n'
                f'                                        <constraints>\n'
                f'                                            <constraint firstAttribute="width" secondItem="{ident}" secondAttribute="height" id="s{n:02d}-Ar-eMp"/>\n'
                f'                                        </constraints>\n'
                f'                                    </view>')
            liens_grille += [
                f'<constraint firstItem="{ident}" firstAttribute="centerX" secondItem="{GRILLE_ID}" secondAttribute="centerX" multiplier="{nombre(2 * fx)}" id="s{n:02d}-Cx-eMp"/>',
                f'<constraint firstItem="{ident}" firstAttribute="centerY" secondItem="{GRILLE_ID}" secondAttribute="centerY" multiplier="{nombre(2 * fy)}" id="s{n:02d}-Cy-eMp"/>',
                f'<constraint firstItem="{ident}" firstAttribute="width" secondItem="{GRILLE_ID}" secondAttribute="width" multiplier="{nombre(112 / 496)}" id="s{n:02d}-Wd-eMp"/>',
            ]
    grille = (
        f'                            <view userInteractionEnabled="NO" contentMode="scaleToFill" translatesAutoresizingMaskIntoConstraints="NO" id="{GRILLE_ID}" userLabel="Emplacements de la touche">\n'
        f'                                <rect key="frame" x="{nombre(L / 2 - g / 2)}" y="{nombre(H / 2 * (1 - 28 / 2732) - g / 2)}" width="{nombre(g)}" height="{nombre(g)}"/>\n'
        f'                                <subviews>\n' + '\n'.join(cases) + '\n'
        f'                                </subviews>\n'
        f'                                <color key="backgroundColor" white="0.0" alpha="0.0" colorSpace="custom" customColorSpace="genericGamma22GrayColorSpace"/>\n'
        f'                                <constraints>\n'
        f'                                    <constraint firstAttribute="width" secondItem="{GRILLE_ID}" secondAttribute="height" id="gRl-Ar-eMp"/>\n'
        + '\n'.join('                                    ' + l for l in liens_grille) + '\n'
        f'                                </constraints>\n'
        f'                            </view>')
    vues.insert(0, grille)
    # Centrée en largeur ; en hauteur, 14 unités au-dessus du milieu (comme --cy : 50 % − 14 × --u) ; côté : 496/2732 du plus grand côté
    liens += [
        f'<constraint firstItem="{GRILLE_ID}" firstAttribute="centerX" secondItem="{VUE}" secondAttribute="centerX" id="gRl-Cx-eMp"/>',
        f'<constraint firstItem="{GRILLE_ID}" firstAttribute="centerY" secondItem="{VUE}" secondAttribute="centerY" multiplier="{nombre(1 - 28 / 2732)}" id="gRl-Cy-eMp"/>',
    ]
    for n, cote in enumerate(('height', 'width')):
        liens.append(f'<constraint firstItem="{GRILLE_ID}" firstAttribute="height" relation="greaterThanOrEqual" secondItem="{VUE}" secondAttribute="{cote}" multiplier="{nombre(GRILLE)}" id="gRl-M{n}-eMp"/>')
        liens.append(f'<constraint firstItem="{GRILLE_ID}" firstAttribute="height" secondItem="{VUE}" secondAttribute="{cote}" multiplier="{nombre(GRILLE)}" priority="999" id="gRl-E{n}-eMp"/>')
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<!-- Écrit par tools/ecran-lancement.py à partir des points de l’ouverture animée (index.html, POINTS) : ne pas modifier à la main. -->
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="17132" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina4_7" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="17105"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--View Controller-->
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="{VUE}">
                        <rect key="frame" x="0.0" y="0.0" width="{L}" height="{H}"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
{chr(10).join(vues)}
                        </subviews>
                        <viewLayoutGuide key="safeArea" id="Rq1-Sa-0Ky"/>
                        {FOND}
                        <constraints>
{chr(10).join('                            ' + l for l in liens)}
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
</document>
'''
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write(xml)
    print('écrit', os.path.relpath(SORTIE, RACINE), len(pts), 'points,', len(cases), 'emplacements')


if __name__ == '__main__':
    ecrire()
