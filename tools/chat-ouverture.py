#!/usr/bin/env python3
"""Le chat de l’ouverture de l’appli iOS (Elisa, 11 novembre, 14 h 36 : « Est-ce possible de mettre le chat qui marche dessus ? »).

À partir de ses deux GIF sur fond vert (12 images chacun, générés par Elisa) : la marche, en boucle, et l’arrêt, assis, deux
coups de pattes. Le fond vert est retiré (transparence selon le vert qui dépasse le rouge et le bleu, puis le vert ramené au
niveau des deux autres, pour qu’aucun liseré vert ne reste), et chaque GIF devient une grille de 12 images (4 colonnes, 3 rangées,
dans l’ordre de lecture), en WebP avec transparence : assets/ouverture-chat-marche-grille.webp et
assets/ouverture-chat-appui-grille.webp (ludique.css, 37 bis, les fait défiler par crans).

12 novembre, 12 h 24 (Elisa, « le chat bug, il apparaît puis pas ») : plus de bande de 12 images côte à côte. Sur l’iPhone, WebKit
découpe en tuiles de 512 px tout calque plus large que 1 280 px (1 024 quand la mémoire manque) et ne peint une tuile qu’en arrivant
dessus : la bande faisait 1 572 px de large sur un iPhone 15, si bien que pendant la marche, quand le démarrage occupait le fil
principal, des images du chat restaient vides. En grille, le calque fait 4 × 131 sur 3 × 131 px (846 sur 634 au plus, sur le plus
grand iPad) : un seul tenant, peint une fois.

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
    sortie = os.path.join(RACINE, 'assets', f'ouverture-chat-{nom}-grille.webp')
    rangees = [np.concatenate(vues[r * 4:(r + 1) * 4], axis=1) for r in range(3)]
    Image.fromarray(np.concatenate(rangees, axis=0), 'RGBA').save(sortie, 'WEBP', quality=90, alpha_quality=100, method=6)
    print('écrit', os.path.relpath(sortie, RACINE), os.path.getsize(sortie), 'octets')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    bande(sys.argv[1], 'marche')
    bande(sys.argv[2], 'appui')
