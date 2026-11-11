#!/usr/bin/env python3
"""Le chat de l’ouverture de l’appli iOS (Elisa, 11 novembre, 14 h 36 : « Est-ce possible de mettre le chat qui marche dessus ? »).

À partir de ses deux GIF sur fond vert (12 images chacun, générés par Elisa) : la marche, en boucle, et l’arrêt, assis, deux
coups de pattes. Le fond vert est retiré (transparence selon le vert qui dépasse le rouge et le bleu, puis le vert ramené au
niveau des deux autres, pour qu’aucun liseré vert ne reste), et chaque GIF devient une bande de 12 images côte à côte, en WebP
avec transparence : assets/ouverture-chat-marche.webp et assets/ouverture-chat-appui.webp (ludique.css, 37 bis, les fait
défiler par crans).

    python3 tools/chat-ouverture.py marche.gif appui.gif
"""
import os
import sys

import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LARGEUR = 356          # largeur d’une image (les GIF font 356 ou 358 px : le chat ne touche pas le bord droit)


def images(fichier):
    gif = Image.open(fichier)
    for i in range(gif.n_frames):
        gif.seek(i)
        yield np.array(gif.convert('RGB')).astype(float)[:, :LARGEUR]


def detourer(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.maximum(r, b)
    alpha = np.clip((130 - (g - m)) / (130 - 45), 0, 1)
    return np.dstack([r, np.minimum(g, m + 4), b, alpha * 255]).clip(0, 255).astype(np.uint8)


def bande(fichier, nom):
    vues = [detourer(a) for a in images(fichier)]
    assert len(vues) == 12, f'{fichier} : {len(vues)} images (12 attendues)'
    sortie = os.path.join(RACINE, 'assets', f'ouverture-chat-{nom}.webp')
    Image.fromarray(np.concatenate(vues, axis=1), 'RGBA').save(sortie, 'WEBP', quality=90, alpha_quality=100, method=6)
    print('écrit', os.path.relpath(sortie, RACINE), os.path.getsize(sortie), 'octets')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    bande(sys.argv[1], 'marche')
    bande(sys.argv[2], 'appui')
