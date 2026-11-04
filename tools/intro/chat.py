#!/usr/bin/env python3
"""Le chat de l’ouverture de l’appli iOS (Elisa, 4 novembre, 2 h 33 : « fais cligner des yeux au lancement » ; le chat surgit
derrière la touche >_, cligne des yeux, puis on plonge dans l’appli).

À partir de la mascotte entière (assets/anim/mascotte.webp, 668 × 1002), fabrique :
  assets/intro/chat.webp          le haut du chat (tête, patte qui salue), en autocollant : contour blanc et petite ombre ;
  assets/intro/chat-mi-clos.webp  les paupières à moitié baissées, seules, sur un fond transparent ;
  assets/intro/chat-clos.webp     les yeux fermés (paupières et cils), seuls.
Les trois images ont la même taille : posées l’une sur l’autre, le clignement n’est qu’un changement d’opacité.

    python3 tools/intro/chat.py
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
SOURCE = os.path.join(RACINE, 'assets', 'anim', 'mascotte.webp')
SORTIE = os.path.join(RACINE, 'assets', 'intro')

COUPE = 590          # on garde la hauteur 0 → 590 de la mascotte : la tête, la patte qui salue, le haut du sweat ; le reste est derrière la touche
MARGE = 22           # place pour le contour blanc (en haut et sur les côtés)
CONTOUR = 13         # épaisseur du contour blanc
# Les yeux (centre x, centre y, demi-largeur, demi-hauteur), en pixels de la mascotte entière
YEUX = [(262, 292, 52, 54), (444, 326, 58, 51)]
COILS = (20, 16, 36)  # le trait des cils
SS = 4               # suréchantillonnage des paupières (bords lisses)


def ellipse_masque(w, h, cx, cy, rx, ry, ss=1):
    y, x = np.mgrid[0:h * ss, 0:w * ss] / ss
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def fourrure(img, cx, cy, rx, ry):
    """Couleur de la fourrure sous la paupière : une surface lisse (second degré en x et y) ajustée, canal par canal, sur la
    fourrure de l’anneau qui entoure l’œil (ni monture violette, ni trait sombre, ni reflet blanc pur)."""
    a = np.asarray(img).astype(float)
    h, w = a.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    c = a[..., :3]
    anneau = (d > 1.10 ** 2) & (d < 1.38 ** 2) & (c.min(axis=-1) > 170) & ((c[..., 2] - c[..., 0]) < 35) & (a[..., 3] > 250)
    X, Y = (x[anneau] - cx) / rx, (y[anneau] - cy) / ry
    M = np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y], axis=1)
    coef = np.linalg.lstsq(M, c[anneau], rcond=None)[0]
    Xa, Ya = (x - cx) / rx, (y - cy) / ry
    Ma = np.stack([np.ones_like(Xa), Xa, Ya, Xa * Xa, Xa * Ya, Ya * Ya], axis=-1)
    return np.clip(Ma @ coef, 0, 255)


def paupieres(img, ferme):
    """Calque transparent avec les paupières : ferme=True, l’œil entier ; sinon, jusqu’au milieu."""
    w, h = img.size
    calque = np.zeros((h * SS, w * SS, 4))
    trait = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(trait)
    for i, (cx, cy, rx, ry) in enumerate(YEUX):
        rx2, ry2 = rx + 2.5, ry + 2.5                          # un peu plus large : le contour sombre de l’œil est couvert
        couleur = fourrure(img, cx, cy, rx2, ry2)
        # à peine plus sombre en haut, comme une paupière
        hh = np.mgrid[0:h, 0:w][0]
        couleur = couleur * (0.965 + 0.035 * np.clip((hh - (cy - ry2)) / (2 * ry2), 0, 1))[..., None]
        yy, xx = np.mgrid[0:h * SS, 0:w * SS] / SS
        # un peu plus large que l’œil (son trait sombre déborde par endroits), sans toucher à la monture violette des lunettes
        px = np.asarray(img).astype(float)
        monture = (px[..., 2] > px[..., 0] + 35) & (px[..., 0] > 55) & (px[..., 2] > 150)
        monture = np.asarray(Image.fromarray((monture * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).resize((w * SS, h * SS), Image.NEAREST)) > 0
        dcoeur = ((xx - cx) / rx2) ** 2 + ((yy - cy) / ry2) ** 2
        dans = (dcoeur <= 1.13 ** 2) & ~(monture & (dcoeur > 1))
        if ferme:
            zone = dans
            # le trait fermé : une courbe qui descend au milieu (◡), et un petit cil au coin extérieur
            pts = []
            for t in np.linspace(0, 1, 60):
                x = cx + (t * 2 - 1) * rx * 0.93
                y = cy + ry * (0.12 + 0.40 * (1 - (t * 2 - 1) ** 2))
                pts.append((x * SS, y * SS))
            d.line(pts, fill=255, width=int(7.5 * SS), joint='curve')
            bout = pts[0] if i == 0 else pts[-1]
            sens = -1 if i == 0 else 1
            d.line([bout, (bout[0] + sens * 10 * SS, bout[1] - 8 * SS)], fill=255, width=int(6 * SS))
            for p in (pts[0], pts[-1]):
                d.ellipse([p[0] - 3.7 * SS, p[1] - 3.7 * SS, p[0] + 3.7 * SS, p[1] + 3.7 * SS], fill=255)
        else:
            # la paupière à moitié baissée : son bord, une courbe qui descend un peu au milieu
            bord = cy - ry * 0.12 + ry * 0.28 * (1 - ((xx - cx) / rx) ** 2).clip(0, 1)
            zone = dans & (yy <= bord)
            pts = [((cx + s * rx2) * SS, (cy - ry * 0.12 + ry * 0.28 * (1 - s * s)) * SS) for s in np.linspace(-0.985, 0.985, 60)]
            d.line(pts, fill=255, width=int(7.5 * SS), joint='curve')
        big = np.asarray(Image.fromarray(couleur.astype('uint8')).resize((w * SS, h * SS), Image.BILINEAR)).astype(float)
        calque[zone, :3] = big[zone]
        dist = np.sqrt(dcoeur) / 1.13
        fondu = np.clip((1 - dist) * min(rx2, ry2) * 1.13 / 2.2, 0, 1)   # 0 au bord, 1 à 2,2 px vers l’intérieur
        calque[zone, 3] = np.maximum(calque[zone, 3], 255 * fondu[zone])
    # le trait sombre par-dessus la fourrure peinte
    t = np.asarray(trait).astype(float) / 255
    for c in range(3):
        calque[..., c] = calque[..., c] * (1 - t) + COILS[c] * t
    calque[..., 3] = np.maximum(calque[..., 3], t * 255)
    out = Image.fromarray(calque.clip(0, 255).astype('uint8'), 'RGBA').resize((w, h), Image.LANCZOS)
    return out


def autocollant(chat):
    """Contour blanc et petite ombre à rebord, comme les autocollants de l’appli."""
    w, h = chat.size
    a = chat.split()[3]
    # une ouverture (érosion puis dilatation) retire les moustaches avant de grossir la silhouette
    plein = a.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    gros = plein.filter(ImageFilter.MaxFilter(CONTOUR * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    gros = gros.point(lambda v: 255 if v > 110 else int(v * 255 / 110))
    ombre = Image.new('RGBA', (w, h), (27, 22, 64, 0))
    ombre.putalpha(gros.point(lambda v: int(v * 0.16)).filter(ImageFilter.GaussianBlur(3)))
    blanc = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    blanc.putalpha(gros)
    fond = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    fond.alpha_composite(ombre, (0, 7))
    fond.alpha_composite(blanc)
    fond.alpha_composite(chat)
    return fond


def main():
    src = Image.open(SOURCE).convert('RGBA')
    W = src.width + 2 * MARGE
    toile = Image.new('RGBA', (W, COUPE + MARGE), (0, 0, 0, 0))
    toile.alpha_composite(src.crop((0, 0, src.width, COUPE)), (MARGE, MARGE))
    global YEUX
    YEUX = [(cx + MARGE, cy + MARGE, rx, ry) for cx, cy, rx, ry in YEUX]
    ouvert = autocollant(toile)
    mi = paupieres(toile, ferme=False)
    clos = paupieres(toile, ferme=True)
    os.makedirs(SORTIE, exist_ok=True)
    for nom, im, q in (('chat', ouvert, 88), ('chat-mi-clos', mi, 90), ('chat-clos', clos, 90)):
        # les calques des paupières ne gardent que leur boîte utile : même taille que le chat, le reste transparent
        im.save(os.path.join(SORTIE, nom + '.webp'), 'WEBP', quality=q, method=6, exact=True)
        print(nom, im.size, os.path.getsize(os.path.join(SORTIE, nom + '.webp')), 'octets')
    # aperçu : ouvert, mi-clos, fermé
    ap = Image.new('RGBA', (W * 3 + 40, COUPE + MARGE), (244, 242, 252, 255))
    for k, calque in enumerate((None, mi, clos)):
        v = ouvert.copy()
        if calque is not None:
            v.alpha_composite(calque)
        ap.alpha_composite(v, (k * (W + 20), 0))
    ap.convert('RGB').save(os.path.join(ICI, 'sortie', 'apercu-clignement.png')) if os.path.isdir(os.path.join(ICI, 'sortie')) else None


if __name__ == '__main__':
    os.makedirs(os.path.join(ICI, 'sortie'), exist_ok=True)
    main()
