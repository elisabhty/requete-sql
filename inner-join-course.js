/* Presentation and guided relationship for INNER JOIN's course only. */
window.initInnerJoinCourse = function () {
  const root = document.querySelector('.inner-editorial .lesson-rich');
  if (!root) return;
  const intro = root.querySelector('.situation-body .pk-rel');
  if (intro) intro.outerHTML = '<p class="inner-needs"><b>Le nom</b>, pour identifier le client.<br><b>L’e-mail</b>, pour lui envoyer le questionnaire.</p>';

  const follow = root.querySelector('.join-follow');
  if (follow) {
    const block = follow.closest('.fn-use');
    block.innerHTML = `<h3 class="inner-chapter">Suivons une commande</h3>
      <p>La commande n°5 contient <code>client_id = 4</code>. Ce numéro nous indique quel client chercher dans la table <code>clients</code>.</p>
      <p>Suivons ce lien pour retrouver son nom, puis son e-mail.</p>
      <figure class="inner-link-demo" data-stage="0">
        <div class="inner-tables">
          <table aria-label="Extrait de commandes"><caption>commandes</caption><thead><tr><th scope="col">id</th><th scope="col">client_id</th></tr></thead><tbody><tr><td>5</td><td class="inner-key-from">4</td></tr></tbody></table>
          <span class="inner-equals" aria-label="correspond à">=</span>
          <table aria-label="Extrait de clients"><caption>clients</caption><thead><tr><th scope="col">id</th><th scope="col">nom</th></tr></thead><tbody><tr><td class="inner-key-to">4</td><td class="inner-person">Nathan</td></tr></tbody></table>
        </div>
        <p class="inner-on"><code>ON commandes.client_id = clients.id</code></p>
        <div class="inner-demo-actions"><button type="button" class="inner-play">Voir le lien</button><button type="button" class="inner-step">Étape suivante</button><span class="inner-stage-count">1 / 3</span></div>
        <figcaption role="status" aria-live="polite" aria-atomic="true">1. Dans commandes, client_id = 4 est notre point de départ.</figcaption>
      </figure>
      <p>Le <code>client_id</code> de la commande correspond à l’<code>id</code> de Nathan. Sa ligne contient aussi son e-mail : <code>nathan@mail.fr</code>.</p>
      <p>Nous venons de faire la correspondance à la main. Mais répéter cette recherche pour chaque commande serait fastidieux. Comment demander à SQL de le faire pour nous ?</p>`;
    const demo = block.querySelector('.inner-link-demo');
    const play = demo.querySelector('.inner-play');
    const step = demo.querySelector('.inner-step');
    const captions = [
      '1. Dans commandes, client_id = 4 est notre point de départ.',
      '2. Dans clients, on retrouve la ligne dont id = 4. Les deux valeurs correspondent.',
      '3. Cette ligne appartient à Nathan. Son e-mail est nathan@mail.fr.'
    ];
    let stage = 0, timer = null;
    function stop() { clearTimeout(timer); timer = null; play.textContent = 'Rejouer le lien'; }
    function show(value) {
      stage = value;
      demo.dataset.stage = String(value);
      demo.querySelector('figcaption').textContent = captions[value];
      demo.querySelector('.inner-stage-count').textContent = `${value + 1} / 3`;
      step.textContent = value === 2 ? 'Revenir au début' : 'Étape suivante';
    }
    function advance() {
      if (!demo.isConnected) { stop(); return; }
      show(stage + 1);
      if (stage < 2) timer = setTimeout(advance, 1800);
      else stop();
    }
    play.addEventListener('click', () => {
      if (timer) { stop(); return; }
      show(0);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { show(2); return; }
      play.textContent = 'Mettre en pause';
      timer = setTimeout(advance, 1800);
    });
    step.addEventListener('click', () => { stop(); show((stage + 1) % 3); });
  }
  // Remove decorative emoji in headings, keeping all teaching prose intact.
  root.querySelectorAll('.pt-syntax-h,.sit-memo-lab,.h2-txt').forEach(el => {
    el.querySelectorAll('i[aria-hidden]').forEach(icon => icon.remove());
    for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/^[\s🔎🔗🎯🧩💡🧾⭐]+/u, '');
  });
  const toc = root.querySelector('.sommaire');
  if (toc) {
    const details = document.createElement('details');
    details.className = 'inner-toc';
    const summary = document.createElement('summary');
    summary.textContent = 'Sommaire du cours';
    toc.before(details);
    details.append(summary, toc);
    toc.querySelector('.sommaire-t')?.remove();
    toc.addEventListener('click', e => { if (e.target.closest('.som-item')) details.open = false; }, true);
  }
};
