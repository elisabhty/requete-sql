/* Un faux #loader pour jouer le script de l’ouverture de l’appli iOS (index.html, après #loader) dans un bac à sable :
   il garde le HTML inséré, et donne aux points (.in-d), aux cases (.in-k) et aux lettres (.in-l) la place qu’ils auraient
   sur un écran de largeur × hauteur (ludique.css, 37 bis). Utilisé par les tests de l’ouverture. */
export function fauxLoader({ largeur = 430, hauteur = 932, log = [] } = {}) {
  const u = Math.max(largeur, hauteur) / 2732, cy = hauteur / 2 - 14 * u;
  const cls = new Set(), html = [], cache = {};
  const style = () => ({ setProperty(k, v) { this[k] = v; } });
  const el = (r) => ({ style: style(), getBoundingClientRect: () => r, rect: r });
  const carre = (x, y, c) => el({ left: x - c / 2, top: y - c / 2, width: c, height: c });
  const nom = { textContent: 'Requête', innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const L = {
    html, log, cls, nom, u, largeur, hauteur, style: style(),
    classList: { add: (...c) => c.forEach(x => { cls.add(x); log.push('+' + x); }), remove: c => { cls.delete(c); log.push('-' + c); }, contains: c => cls.has(c) },
    querySelector: q => (q === '.ld-name' ? nom : null),
    insertAdjacentHTML: (w, h) => html.push(h),
    querySelectorAll: q => {
      if (cache[q]) return cache[q];
      const tout = html.join('');
      if (q === '.in-d') cache[q] = [...tout.matchAll(/class="in-d"[^>]*?left:([\d.]+)%;top:([\d.]+)%/g)].map(m => carre(m[1] / 100 * largeur, m[2] / 100 * hauteur, 30 * u));
      else if (q === '.in-k') cache[q] = [...tout.matchAll(/class="in-k"[^>]*?--c:(\d);--r:(\d)/g)].map(m => carre(largeur / 2 + (-192 + 128 * m[1]) * u, cy + (-192 + 128 * m[2]) * u, 112 * u));
      else if (q === '.in-l') cache[q] = [...nom.innerHTML.matchAll(/class="in-l"/g)].map((m, j) => el({ left: largeur / 2 - 60 + 17 * j, top: hauteur / 2 + 330 * u, width: 16, height: 30 }));
      else return [];
      return cache[q];
    }
  };
  return L;
}
