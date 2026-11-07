#!/usr/bin/env python3
"""Le petit miaou de la salle dans l’île (Elisa, 7 novembre, 20 h 16, la planche « Ta salle vit dans l’île » : « Quand Léa entre,
l’île s’ouvre un instant, avec un petit miaou. »).

L’alerte poussée par le serveur quand un ami entre dans la salle (supabase/functions/jeu-ile) joue ce son ; l’app le range dans
Library/Sounds au lancement (RequeteWidgetPlugin.swift, RequeteSon), là où iOS cherche les sons des alertes. Synthétisé ici (aucun
enregistrement) : une voix de chaton, dont la hauteur monte puis retombe (« mi-a-ou »), et dont la bouche passe de « i » à « a » puis
à « ou » (trois formants qui glissent) ; un léger vibrato, une attaque douce, crête à -6 dB. Mono, 44,1 kHz, 16 bits, en WAV : un
format qu’iOS accepte pour les sons d’alerte (moins de 30 secondes).

    python3 tools/sons/miaou.py      # écrit assets/sons/miaou.wav
"""
import os
import wave

import numpy as np

SR = 44100
DUREE = 0.62
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
SORTIE = os.path.join(RACINE, 'assets', 'sons', 'miaou.wav')


def courbe(t, points):
    """Une valeur qui glisse d’un point à l’autre (interpolation en cosinus) : points = [(instant 0 à 1, valeur), …]."""
    x = np.array([p[0] for p in points])
    y = np.array([p[1] for p in points])
    i = np.clip(np.searchsorted(x, t, side='right') - 1, 0, len(x) - 2)
    u = (t - x[i]) / (x[i + 1] - x[i])
    u = (1 - np.cos(np.pi * np.clip(u, 0, 1))) / 2
    return y[i] + (y[i + 1] - y[i]) * u


def formants(f, f1, f2, f3):
    """La bouche : trois résonances (largeurs 110, 170, 260 Hz), plus un fond, pour une fréquence f."""
    pic = lambda c, l, a: a / (1 + ((f - c) / l) ** 2)
    return 0.06 + pic(f1, 110, 1.0) + pic(f2, 170, 0.55) + pic(f3, 260, 0.22)


def miaou():
    n = int(SR * DUREE)
    t = np.arange(n) / SR
    s = t / DUREE
    # La hauteur : le « mi » monte, le « a » culmine, le « ou » retombe ; un vibrato de 6 Hz qui s’installe
    f0 = courbe(s, [(0, 560), (0.18, 700), (0.38, 820), (0.62, 760), (0.85, 560), (1, 480)])
    vib = 1 + 0.012 * np.sin(2 * np.pi * 6.2 * t) * courbe(s, [(0, 0), (0.3, 0.4), (0.7, 1), (1, 1)])
    f0 = f0 * vib
    phase = 2 * np.pi * np.cumsum(f0) / SR
    # La bouche : « i » → « a » → « ou »
    f1 = courbe(s, [(0, 320), (0.25, 620), (0.45, 880), (0.7, 700), (1, 380)])
    f2 = courbe(s, [(0, 2300), (0.25, 1700), (0.45, 1300), (0.7, 1050), (1, 820)])
    f3 = courbe(s, [(0, 3100), (0.45, 2700), (1, 2450)])
    voix = np.zeros(n)
    for k in range(1, 15):
        fk = k * f0
        a = (1 / k ** 1.05) * formants(fk, f1, f2, f3) * (fk < SR / 2 - 500)
        voix += a * np.sin(k * phase)
    # Un souffle très léger au début (le « m » qui s’ouvre)
    bruit = np.random.default_rng(7).standard_normal(n) * 0.018 * courbe(s, [(0, 1), (0.15, 0.2), (1, 0)])
    voix += np.convolve(bruit, np.ones(6) / 6, mode='same')
    # L’enveloppe : attaque douce, un petit renflement au « a », extinction
    env = courbe(s, [(0, 0), (0.07, 0.75), (0.4, 1), (0.75, 0.8), (1, 0)])
    son = voix * env
    son = son / np.max(np.abs(son)) * 10 ** (-6 / 20)
    return (son * 32767).astype(np.int16)


if __name__ == '__main__':
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with wave.open(SORTIE, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(miaou().tobytes())
    print(SORTIE, os.path.getsize(SORTIE), 'octets')
