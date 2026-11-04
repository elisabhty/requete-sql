#!/usr/bin/env python3
"""Le son de l’ouverture de l’appli iOS (Elisa, 4 novembre, 1 h 51 : « il n’y a pas d’haptique d’onde ni de son »).

Calé à la milliseconde sur l’animation (ludique.css, 37 bis ; le 0 est l’instant où #loader prend la classe is-play), ralentie
le 4 novembre à 9 h 28 (« l’arrivée de l’animation au début fait mal aux yeux, trop rapide ») :
  0,112 s  la touche >_ touche le fond : un « toc » de touche Entrée (corps grave qui descend, petit déclic aigu) ;
  0,18 s   l’onde part : un souffle qui monte, et un bip par anneau de cases, au moment où l’onde l’atteint
           (170 + (r - 256) / 1,65 ms, comme dans le script de l’ouverture), de plus en plus doux au loin ;
  0,78 s   la requête allume ses résultats, un toutes les 42 ms : huit clochettes qui montent (gamme pentatonique de do) ;
  1,23 s   la plongée dans la touche : un souffle qui enfle ;
  1,62 s   l’appli apparaît : un accord de do majeur, doux, qui s’éteint.
Son synthétisé ici (aucun enregistrement), en stéréo, avec un peu de réverbération ; crête à -4 dB.

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

# Les instants de l’animation (en secondes après is-play)
TOUCHE = 0.112                 # introKey : 18 % de 0,62 s, la touche au plus bas
ONDE = 0.18                    # introWave part à 0,18 s
VITESSE = 1650                 # unités par seconde, comme --w dans le script de l’ouverture
DEPART = 170                   # ms : --w = DEPART + (r - 256) / 1,65
ANNEAUX = [320, 452, 576, 640, 704, 768, 832, 896, 960, 1024]   # distances des rangées de cases (unités)
RESULTATS = [0.780 + i * 0.042 for i in range(8)]                # --p : 780 + k × 42 ms
PLONGEE = 1.23
ARRIVEE = 1.62

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


# 1. La touche Entrée : un « toc » grave qui descend (190 → 105 Hz, pour les écouteurs), un « clac » de plastique
#    (900 → 600 Hz, que le haut-parleur de l’iPhone rend bien) et un petit déclic
n = int(0.14 * SR)
t = np.arange(n) / SR
f = 105 + 85 * np.exp(-t / 0.018)
corps = np.sin(2 * np.pi * np.cumsum(f) / SR) * enveloppe(n, 0.0015, 0.036)
f = 600 + 300 * np.exp(-t / 0.01)
clac = np.sin(2 * np.pi * np.cumsum(f) / SR) * enveloppe(n, 0.0008, 0.016)
declic = bruit_bande(n, 1800, 7000) * enveloppe(n, 0.0004, 0.005)
poser(0.8 * corps + 0.45 * clac + 0.32 * declic, TOUCHE - 0.002, 0.0, 0.62)

# 2. L’onde : un souffle qui monte (500 → 3 500 Hz) puis s’efface, et un bip par anneau de cases
duree = 0.66
for pan, graine in ((-0.35, 1), (0.35, 2)):
    s = souffle(duree, 500, 3500, 0.16, lambda t: np.minimum(1, t / 0.16) * np.clip((duree - t) / 0.45, 0, 1) ** 1.5)
    poser(s, ONDE, pan, 0.075)
pentatonique = [84, 86, 88, 91, 93, 96, 98, 100]       # do6 ré6 mi6 sol6 la6 do7 ré7 mi7
for i, r in enumerate(ANNEAUX):
    t0 = (DEPART + (r - 256) / (VITESSE / 1000)) / 1000
    fr = note(pentatonique[int(alea.integers(0, 6))])
    n = int(0.07 * SR)
    tt = np.arange(n) / SR
    bip = (np.sin(2 * np.pi * fr * tt) + 0.18 * np.sin(4 * np.pi * fr * tt)) * enveloppe(n, 0.0012, 0.016)
    poser(bip, t0, -0.6 if i % 2 else 0.6, 0.22 * (1 - i / len(ANNEAUX)) ** 1.3 + 0.03)

# 3. Les résultats : huit clochettes qui montent, une par case allumée
for i, t0 in enumerate(RESULTATS):
    fr = note(pentatonique[i])
    n = int(0.7 * SR)
    tt = np.arange(n) / SR
    cloche = (np.sin(2 * np.pi * fr * tt)
              + 0.22 * np.sin(2 * np.pi * fr * 2.0 * tt) * np.exp(-tt / 0.07)
              + 0.10 * np.sin(2 * np.pi * fr * 3.01 * tt) * np.exp(-tt / 0.04)) * enveloppe(n, 0.0015, 0.20)
    poser(cloche, t0 + 0.02, -0.5 + i / 7, 0.13)

# 4. La plongée : un souffle qui enfle (300 → 2 600 Hz) jusqu’à ce que la touche remplisse l’écran
duree = 0.58
for pan in (-0.25, 0.25):
    s = souffle(duree, 300, 2600, 0.0, lambda t: (np.clip(t / 0.45, 0, 1) ** 2.2) * np.clip((duree - t) / 0.12, 0, 1))
    poser(s, PLONGEE, pan, 0.12)

# 5. L’arrivée : do majeur, doux (do5 mi5 sol5 do6, assez haut pour le haut-parleur de l’iPhone), qui s’éteint
for midi, g, pan in ((72, 0.07, -0.2), (76, 0.055, 0.2), (79, 0.05, 0.0), (84, 0.035, 0.0)):
    fr = note(midi)
    n = int(0.75 * SR)
    tt = np.arange(n) / SR
    voix = (np.sin(2 * np.pi * fr * tt) + 0.12 * np.sin(6 * np.pi * fr * tt)) * np.minimum(1, tt / 0.012) * np.exp(-tt / 0.28)
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
