# Captures Google Play tirées des captures App Store 6,3 pouces (1206 × 2622), 27 novembre 2026 :
# l'île dynamique et les icônes d'iOS remplacées par la caméra ronde et les icônes d'Android, haut et bas recadrés (1206 × 2400).
# Usage : python3 tools/google-play/captures-android.py <dossier des PNG App Store> [dossier de sortie, google-play/captures/]
from PIL import Image, ImageDraw
import numpy as np, os, sys
SRC=os.path.join(sys.argv[1],'') if len(sys.argv)>1 else sys.exit('Indique le dossier des captures App Store (6.3-PNG).')
OUT=os.path.join(sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','google-play','captures'),'')
os.makedirs(OUT,exist_ok=True)
S=4  # suréchantillonnage pour des bords nets
def couche(bg, fg):
    """Les éléments d'Android de la barre d'état (caméra ronde, Wi-Fi, réseau, batterie), dessinés à 4x puis réduits."""
    x0,y0,x1,y1 = 560,700,950,762           # zone redessinée (coordonnées de l'image d'origine)
    w,h = (x1-x0)*S,(y1-y0)*S
    L = Image.new('RGBA',(w,h),(0,0,0,0)); d = ImageDraw.Draw(L)
    P = lambda x,y:((x-x0)*S,(y-y0)*S)
    # caméra ronde (au centre de l'écran, entre 178 et 1028)
    cx,cy,r = 603,732,16
    d.ellipse([*P(cx-r,cy-r),*P(cx+r,cy+r)], fill=(8,8,12,255))
    d.ellipse([*P(cx-6,cy-6),*P(cx+6,cy+6)], fill=(28,30,44,255))
    base,haut = 745,720
    # batterie (verticale)
    bx0,bx1 = 917,931
    d.rounded_rectangle([*P(bx0,haut+3),*P(bx1,base)], radius=3*S, fill=fg)
    d.rectangle([*P(bx0+4,haut),*P(bx1-4,haut+4)], fill=fg)
    # réseau mobile (triangle)
    sx1 = bx0-11; sx0 = sx1-24
    d.polygon([P(sx0,base),P(sx1,base),P(sx1,base-24)], fill=fg)
    # Wi-Fi (éventail)
    wr = 25; wcx = sx0-11-int(wr*0.71)
    d.pieslice([*P(wcx-wr,base-wr),*P(wcx+wr,base+wr)], 225, 315, fill=fg)
    L = L.resize((x1-x0,y1-y0), Image.LANCZOS)
    return L,(x0,y0)
def android(f):
    im = Image.open(SRC+f).convert('RGB')
    a = np.array(im).astype(int)
    bg = tuple(int(v) for v in a[700,450])
    box = a[719:745,286:353].reshape(-1,3)
    dist = np.abs(box-np.array(bg)).sum(axis=1)
    fg = tuple(int(v) for v in box[dist.argmax()])+(255,)
    d = ImageDraw.Draw(im)
    d.rectangle([460,676,748,770], fill=bg)     # l'île de l'iPhone
    d.rectangle([754,706,956,760], fill=bg)     # les icônes d'iOS
    L,pos = couche(bg,fg)
    im = im.convert('RGBA'); im.alpha_composite(L,pos); im = im.convert('RGB')
    im = im.crop((0,70,1206,2470))               # 1206 × 2400 : au plus deux fois plus haute que large (règle de Google Play)
    nom = f.replace('Requete-','Requete-android-').replace('-63-','-').replace('.png','.jpg')
    im.save(OUT+nom, quality=92, optimize=True)
    return nom, im.size, os.path.getsize(OUT+nom), bg, fg
for f in sorted(os.listdir(SRC)):
    if f.endswith('.png'): print(*android(f))
