#!/usr/bin/env python3
"""Les chats montrés en grand, deux fois plus nets (Elisa, 12 novembre, 20 h 24 : « je trouve que la première page est floue »).

Les GIF des chats font environ 300 px de large : parfaits à 100 pt (trois pixels par point sur un iPhone), flous quand la page les
montre à 230 ou 270 pt (la page « bonjour », celle des questions, « À bientôt ! »). Ce script les agrandit deux fois avec un petit
réseau de neurones fait pour le dessin (Anime4KCPP, modèle ACNet, sur le processeur) : les traits et le liseré blanc sont
redessinés nets au lieu d'être étirés. Rien n'est inventé d'autre : même dessin, mêmes images, mêmes durées, même boucle.

    pip install pyanime4k pillow numpy
    python3 tools/chats-nets.py coucou parti aurevoir

Pour chaque nom : assets/chat-<nom>.webp (animé) et assets/chat-<nom>-fixe.webp (l'image du mouvement réduit).
La couleur est agrandie sur fond blanc (la couleur du liseré : pas de halo sombre au bord), la transparence à part, par le même réseau.
Qualité 72 : à deux pixels par pixel d'origine, on ne voit pas la différence avec 80, et le GIF pèse 325 Ko au lieu de 480.
"""
import io, os, struct, sys, tempfile
import numpy as np
from PIL import Image, ImageSequence
from pyanime4k.pyac import pyac

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
MODELE, FACTEUR, QUALITE = 'acnet-gan', 2.0, 72
LARGEUR_MAX = 520   # déjà agrandi (plus de 520 px de large) : on n'y retouche pas


def durees_et_boucle(chemin):
    """Les durées des images et le nombre de boucles, lus dans le fichier (Pillow ne les rend pas toujours)."""
    b = open(chemin, 'rb').read()
    i, durees, boucle = 12, [], 0
    while i + 8 <= len(b):
        nom, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        d = b[i + 8:i + 8 + n]
        if nom == b'ANIM':
            boucle = struct.unpack('<H', d[4:6])[0]
        elif nom == b'ANMF':
            durees.append(d[12] | d[13] << 8 | d[14] << 16)
        i += 8 + n + (n & 1)
    return durees, boucle


def agrandir(image, reseau, dossier):
    a = np.asarray(image.convert('RGBA')).astype(np.float32)
    alpha = a[:, :, 3:4] / 255
    couleur = a[:, :, :3] * alpha + 255 * (1 - alpha)
    e, s = os.path.join(dossier, 'e.png'), os.path.join(dossier, 's.png')
    sorties = []
    for plan in (couleur.astype(np.uint8), np.repeat((alpha * 255).astype(np.uint8), 3, axis=2)):
        Image.fromarray(plan).save(e)
        if not pyac.core.imwrite(s, reseau(pyac.core.imread(e), FACTEUR)):
            raise IOError('image non écrite')
        sorties.append(Image.open(s).convert('RGB').copy())
    # La transparence pèse plus du tiers du fichier : presque transparent devient transparent, presque opaque devient opaque, le
    # reste par paliers de 8 ; et sous le transparent, du blanc uni. À l'œil rien ne change (38 dB), le fichier perd un tiers.
    t = np.asarray(sorties[1].convert('L')).astype(np.int32)
    t = np.where(t < 10, 0, np.where(t > 245, 255, (t // 8) * 8 + 4)).astype(np.uint8)
    c = np.asarray(sorties[0]).copy()
    c[t == 0] = 255
    grande = Image.fromarray(c, 'RGB')
    grande.putalpha(Image.fromarray(t, 'L'))
    return grande


def traiter(nom, reseau):
    with tempfile.TemporaryDirectory() as dossier:
        for suffixe in ('', '-fixe'):
            chemin = os.path.join(RACINE, f'chat-{nom}{suffixe}.webp')
            source = Image.open(chemin)
            if source.width > LARGEUR_MAX:
                print(f'  chat-{nom}{suffixe}.webp : déjà en grand ({source.width} px), laissé tel quel')
                continue
            avant = os.path.getsize(chemin)
            images = [agrandir(f, reseau, dossier) for f in ImageSequence.Iterator(source)]
            if len(images) > 1:
                durees, boucle = durees_et_boucle(chemin)
                assert len(durees) == len(images), (len(durees), len(images))
                tampon = io.BytesIO()
                images[0].save(tampon, 'WEBP', save_all=True, append_images=images[1:], duration=durees, loop=boucle,
                               quality=QUALITE, method=6, minimize_size=True, allow_mixed=False)
            else:
                tampon = io.BytesIO()
                images[0].save(tampon, 'WEBP', quality=QUALITE + 6, method=6)
            open(chemin, 'wb').write(tampon.getvalue())
            print(f'  chat-{nom}{suffixe}.webp : {source.width} × {source.height} → {images[0].width} × {images[0].height}, '
                  f'{len(images)} image(s), {avant // 1024} Ko → {len(tampon.getvalue()) // 1024} Ko')


if __name__ == '__main__':
    noms = sys.argv[1:]
    if not noms:
        sys.exit(__doc__)
    reseau = pyac.core.Processor('cpu', 0, MODELE)
    for n in noms:
        print(n)
        traiter(n, reseau)
