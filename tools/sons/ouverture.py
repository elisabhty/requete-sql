#!/usr/bin/env python3
"""Le son de l’ouverture de l’appli iOS (Elisa, 4 novembre, 1 h 51 : « il n’y a pas d’haptique d’onde ni de son »).

Calé à la milliseconde sur l’animation « Le logo se construit » (11 novembre, 13 h 10 ; ludique.css, 37 bis, et le script qui
suit #loader ; le 0 est l’instant où #loader prend la classe is-play) :
  0 à 0,45 s  les points s’envolent : un souffle léger qui monte ;
  0,38 s      les seize cases se posent dans la touche, une toutes les 32 ms : seize « tic » de touche de clavier, de gauche à
              droite dans l’espace selon leur colonne, un peu plus aigus à mesure que la touche se remplit ;
  1,08 s      la touche est entière : un « toc » de touche Entrée, grave et net ;
  1,11 s      les lettres de « Requête » se posent, une toutes les 36 ms : sept clochettes qui montent (gamme pentatonique de do) ;
  1,53 s      on appuie sur la touche : un petit toc ;
  1,62 s      la plongée : un souffle qui enfle ;
  1,93 s      l’appli apparaît : un accord de do majeur, doux, qui s’éteint.
Son synthétisé ici (aucun enregistrement), en stéréo, avec un peu de réverbération ; crête à -4 dB. La version courte de
l’ouverture (les autres ouvertures du jour) est muette.

    python3 tools/sons/ouverture.py      # écrit assets/sons/ouverture.m4a (et tools/sons/sortie/ouverture.wav)
"""
import math
import os
import subprocess
import wave

import numpy as np

SR = 44100
DUREE = 2.6
N = int(SR * DUREE)
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
SORTIE_WAV = os.path.join(ICI, 'sortie', 'ouverture.wav')
SORTIE_M4A = os.path.join(RACINE, 'assets', 'sons', 'ouverture.m4a')

# Les instants de l’animation (en secondes après is-play), comme PLEINE dans le script qui suit #loader
ORDRE = sorted([(c, r) for c in range(4) for r in range(4)], key=lambda s: (s[0] + s[1], s[0]))
CASES = [(0.380 + 0.032 * i, c) for i, (c, r) in enumerate(ORDRE)]   # case posée : 380 + 32 i ms, et sa colonne
ENTIERE = 1.080
LETTRES = [1.110 + 0.036 * j for j in range(7)]
APPUI = 1.440 + 0.64 * 0.14
PLONGEE = 1.440 + 0.64 * 0.28
ARRIVEE = 1.930

gauche = np.zeros(N)
droite = np.zeros(N)
alea = np.random.default_rng(7)


def poser(sig, t0, pan=0.0, gain=1.0):
    """Ajoute un son à t0 (s), panoramique à puissance constante (-1 à gauche, +1 à droite)."""
    i0 = int(round(t0 * SR))
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    a = (pan + 1) * math.pi / 4
    gauche[i0:i0 + n] += sig[:n] * math.cos(a) * gain
    droite[i0:i0 + n] += sig[:n] * math.sin(a) * gain


def enveloppe(n, attaque, tau):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / attaque) * np.exp(-t / tau)


def bruit_bande(n, bas, haut):
    x = alea.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < bas) | (f > haut)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.max(np.abs(y)) + 1e-12)


def passe_bande(x, fc, amorti):
    """Filtre à variables d’état, fréquence centrale variable (fc : un tableau, en Hz)."""
    y = np.zeros_like(x)
    bas = bande = 0.0
    for i in range(len(x)):
        f = 2 * math.sin(math.pi * min(fc[i], SR / 6) / SR)
        haut = x[i] - bas - amorti * bande
        bande += f * haut
        bas += f * bande
        y[i] = bande
    return y / (np.max(np.abs(y)) + 1e-12)


def souffle(duree, f0, f1, montee, forme):
    n = int(duree * SR)
    t = np.arange(n) / SR
    fc = f0 * np.power(f1 / f0, t / duree)
    s = passe_bande(alea.standard_normal(n), fc, 0.9)
    e = forme(t)
    return s * e


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# Le « toc » d’une touche Entrée : un corps grave qui descend (pour les écouteurs), un « clac » de plastique (que le haut-parleur
# de l’iPhone rend bien) et un petit déclic
def toc(grave=1.0):
    n = int(0.14 * SR)
    t = np.arange(n) / SR
    f = (105 + 85 * np.exp(-t / 0.018)) * grave
    corps = np.sin(2 * np.pi * np.cumsum(f) / SR) * enveloppe(n, 0.0015, 0.036)
    f = (600 + 300 * np.exp(-t / 0.01)) * grave
    clac = np.sin(2 * np.pi * np.cumsum(f) / SR) * enveloppe(n, 0.0008, 0.016)
    declic = bruit_bande(n, 1800, 7000) * enveloppe(n, 0.0004, 0.005)
    return 0.8 * corps + 0.45 * clac + 0.32 * declic


# 1. L’envol : un souffle léger qui monte (400 → 2 400 Hz) pendant que les points partent
duree = 0.5
for pan in (-0.4, 0.4):
    s_ = souffle(duree, 400, 2400, 0.0, lambda t: np.clip(t / 0.3, 0, 1) ** 1.5 * np.clip((duree - t) / 0.2, 0, 1))
    poser(s_, 0.0, pan, 0.05)

# 2. Les cases qui se posent : un « tic » de touche de clavier (un clic aigu bref et un petit corps), de plus en plus aigu
for i, (t0, c) in enumerate(CASES):
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    fr = 1500 * 2 ** (i / 32)
    tic = (0.6 * bruit_bande(n, 2500, 8000) * enveloppe(n, 0.0003, 0.004)
           + np.sin(2 * np.pi * fr * tt) * enveloppe(n, 0.0005, 0.009)
           + 0.5 * np.sin(2 * np.pi * (fr / 4) * tt) * enveloppe(n, 0.001, 0.012))
    poser(tic, t0 - 0.002, -0.6 + 0.4 * c, 0.16)

# 3. La touche entière : le toc de la touche Entrée, net
poser(toc(), ENTIERE - 0.002, 0.0, 0.66)

# 4. Les lettres : sept clochettes qui montent, une par lettre posée
pentatonique = [84, 86, 88, 91, 93, 96, 98]       # do6 ré6 mi6 sol6 la6 do7 ré7
for i, t0 in enumerate(LETTRES):
    fr = note(pentatonique[i])
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    cloche = (np.sin(2 * np.pi * fr * tt)
              + 0.22 * np.sin(2 * np.pi * fr * 2.0 * tt) * np.exp(-tt / 0.07)
              + 0.10 * np.sin(2 * np.pi * fr * 3.01 * tt) * np.exp(-tt / 0.04)) * enveloppe(n, 0.0015, 0.16)
    poser(cloche, t0, -0.45 + 0.15 * i, 0.11)

# 5. L’appui : un petit toc, plus léger
poser(toc(1.15), APPUI - 0.002, 0.0, 0.42)

# 6. La plongée : un souffle qui enfle (300 → 2 600 Hz) jusqu’à ce que la touche remplisse l’écran
duree = 0.52
for pan in (-0.25, 0.25):
    s_ = souffle(duree, 300, 2600, 0.0, lambda t: (np.clip(t / 0.42, 0, 1) ** 2.2) * np.clip((duree - t) / 0.12, 0, 1))
    poser(s_, PLONGEE, pan, 0.12)

# 7. L’arrivée : do majeur, doux (do5 mi5 sol5 do6, assez haut pour le haut-parleur de l’iPhone), qui s’éteint
for midi, g, pan in ((72, 0.07, -0.2), (76, 0.055, 0.2), (79, 0.05, 0.0), (84, 0.035, 0.0)):
    fr = note(midi)
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    voix = (np.sin(2 * np.pi * fr * tt) + 0.12 * np.sin(6 * np.pi * fr * tt)) * np.minimum(1, tt / 0.012) * np.exp(-tt / 0.24)
    poser(voix, ARRIVEE, pan, g)

# Réverbération légère (bruit qui décroît, 0,5 s), puis limiteur doux et crête à -4 dB
n = int(0.5 * SR)
for canal in (gauche, droite):
    ri = alea.standard_normal(n) * np.exp(-np.arange(n) / SR / 0.11)
    ri /= np.sum(np.abs(ri))
    mouille = np.convolve(canal, ri * 7, mode='full')[:N]
    canal += 0.16 * mouille
stereo = np.stack([gauche, droite], axis=1)
stereo = np.tanh(stereo * 1.6) / 1.6
stereo *= 10 ** (-4 / 20) / np.max(np.abs(stereo))
fin = int(0.03 * SR)
stereo[-fin:] *= np.linspace(1, 0, fin)[:, None]

os.makedirs(os.path.dirname(SORTIE_WAV), exist_ok=True)
os.makedirs(os.path.dirname(SORTIE_M4A), exist_ok=True)
with wave.open(SORTIE_WAV, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', SORTIE_WAV, '-c:a', 'aac', '-b:a', '96k', SORTIE_M4A], check=True)
print('écrit', os.path.relpath(SORTIE_M4A, RACINE), os.path.getsize(SORTIE_M4A), 'octets')
