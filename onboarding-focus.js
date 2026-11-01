/* L'accueil et la page pseudo partagent la même fenêtre modale. */
(() => {
  const dialog = document.getElementById('onboarding');
  if (!dialog) return;
  dialog.tabIndex = -1;
  const previousInert = new Map();
  let opened = false;
  let returnFocus = null;
  const focusDialog = () => dialog.focus({ preventScroll: true });
  function sync() {
    const active = dialog.classList.contains('on');
    if (active && !opened) {
      returnFocus = document.activeElement;
      opened = true;
      // Isoler aussi les éventuels éléments placés en dehors de #app.
      for (let node = dialog; node.parentElement; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling === node || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) continue;
          previousInert.set(sibling, sibling.inert);
          sibling.inert = true;
        }
        if (node.parentElement === document.body) break;
      }
      focusDialog();
    } else if (!active && opened) {
      opened = false;
      previousInert.forEach((value, element) => { element.inert = value; });
      previousInert.clear();
      if (returnFocus?.isConnected && returnFocus !== document.body && !returnFocus.closest('[inert]')) {
        returnFocus.focus({ preventScroll: true });
      }
      returnFocus = null;
    }
    // Une nouvelle étape remplace son contenu et peut supprimer le focus.
    if (active && !dialog.contains(document.activeElement)) focusDialog();
  }
  dialog.addEventListener('keydown', event => {
    if (!opened || event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); focusDialog(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
      event.preventDefault(); first.focus();
    }
  });
  new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  sync();
})();
