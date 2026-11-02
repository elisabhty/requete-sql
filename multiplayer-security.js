/* Ranked games use a server-owned identity and a verified SQL submission.
   This file contains no privileged key. The device secret stays out of broadcasts. */
(() => {
  window.REQUETE_SECURE_MULTIPLAYER = true;
  const localStart = jeuStart;
  const localRun = jeuRun;
  let opening = false;
  jeuStart = async function(code, host, cid, options = {}) {
    if (opening) return;
    let needName = false;
    // Practice remains available without a network or a reserved public name.
    if (options.solo && (!navigator.onLine || !psMien())) {
      return localStart(code, host, cid, {...options, secure:false});
    }
    opening = true;
    const entryScreen = document.querySelector('.screen.active');
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 10000);
    const button = document.querySelector('.screen.active .room-go');
    if (button) button.disabled = true;
    try {
      const before = Date.now();
      const response = await fetch(JEU_SB + '/rest/v1/rpc/jeu_identite_v2', {method:'POST',headers:{apikey:JEU_SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_cle:clsCle()}),signal:controller.signal});
      const identity = await response.json();
      if (!response.ok) throw Error(identity.message || 'Connexion indisponible.');
      if (document.querySelector('.screen.active') !== entryScreen) return;
      if (!identity?.pid || !identity?.pseudo) throw Error('Choisis ton pseudo pour rejoindre une salle.');
      identity.skew = identity.serverNow - (before + Date.now()) / 2;
      window.REQUETE_JEU_ID = identity;
      psAdopter(identity.pseudo);
      localStart(code, host, cid, {...options, secure:true});
    } catch (error) {
      const text = String(error?.message || 'La salle est indisponible. Vérifie ta connexion et réessaie.');
      // The public name is chosen during onboarding: never ask for it again before a room (2 November, 23:45).
      // The server has no name for this device yet: reserve it silently, then enter once more.
      if (/pseudo/.test(text) && !options.nameRetry && typeof psReserverPourSalle === 'function') needName = true;
      else lqInfo('Connexion à la salle', /pseudo/.test(text) ? 'Ton pseudo n’a pas pu être réservé. Réessaie dans un instant.' : text, '📶');
    } finally {
      clearTimeout(deadline);
      opening = false;
      if (button?.isConnected) button.disabled = false;
    }
    if (!needName) return;
    const reserved = await psReserverPourSalle().catch(() => false);
    if (reserved) return jeuStart(code, host, cid, {...options, nameRetry:true});
    lqInfo('Connexion à la salle', 'Ton pseudo n’a pas pu être réservé. Réessaie dans un instant.', '📶');
  };
  jeuRun = async function() {
    const game = JEU;
    if (!game?.ranked) return localRun();
    const n = jeuCur(), round = game.rounds[n];
    if (!round || game.verifying || jeuRoundDone(n) || round.found[game.me] != null || Date.now() < round.t1) return;
    const sql = document.getElementById('ed-lesson')?.value.trim();
    if (!sql) return;
    const request = game.pendingVerification;
    // A lost response retries the same attempt, never a second score or first-try bonus.
    const id = request?.n === n && request.sql === sql ? request.id : crypto.randomUUID();
    game.pendingVerification = {id,n,sql};
    game.verifying = true;
    const button = document.querySelector('#lesson-body .btn-run');
    if (button) setRunLoading(button, true);
    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(JEU_SB + '/functions/v1/jeu-verifier?forceFunctionRegion=eu-west-3', {
        method:'POST', headers:{apikey:JEU_SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({cle:clsCle(),salle:game.code,g:game.g,n,id,sql}), signal:controller.signal
      });
      const result = await response.json();
      if (JEU !== game || jeuCur() !== n) return;
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) game.pendingVerification = null;
        throw Error(result.error || 'La vérification est indisponible. Réessaie.');
      }
      game.pendingVerification = null;
      round.tries = (round.tries || 0) + 1;
      if (result.ok) {
        // The success is rendered only when read back from the trusted server history.
        game.t.sync?.();
      } else {
        setLessonOut(`<div class="feedback warn"><div class="fi">≈</div><div><b>Pas encore</b><p>${esc(result.error || 'Le résultat ne correspond pas à la consigne.')}</p></div></div>`);
        jeuEssaiRate(round);
        if(typeof coachRoomTick==='function')coachRoomTick();
        if(typeof coachKo==='function'){setLessonOut('');coachKo(result.error || 'Le résultat ne correspond pas à la consigne.');}
      }
    } catch (error) {
      if (JEU === game && jeuCur() === n) setLessonOut(errBox(error?.name === 'AbortError' ? 'La vérification prend du temps. Réessaie : tes points ne seront pas comptés deux fois.' : String(error?.message || 'Vérification indisponible. Réessaie.')));
    } finally {
      clearTimeout(timeout);
      game.verifying = false;
      if (button?.isConnected) setRunLoading(button, false);
    }
  };
})();
