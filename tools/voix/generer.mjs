#!/usr/bin/env node
/* Voix off des cours vidéo, générée avec ElevenLabs.
   À lancer sur le Mac, depuis le dossier requete-sql :   node tools/voix/generer.mjs
   La première fois, le script demande la clé API ElevenLabs (rien ne s’affiche pendant qu’on la colle) et la garde
   dans ~/.config/requete/elevenlabs.key, hors du dépôt : elle ne part jamais sur GitHub.

   Il lit tools/voix/<cours>.json (voix, modèle, textes) et range chaque fichier dans tools/voix/sortie/<cours>/ (hors Git) :
   <id>.mp3 et <id>.json (le texte et le minutage de chaque caractère, qui sert à caler les légendes sur la voix).
   Un fichier déjà généré n’est pas refait : relancer le script ne dépense rien de plus.

   Options : <cours> (par défaut le seul fichier .json du dossier), --refaire ch06,at2 (regénère ces fichiers),
   --tout (regénère tout), --oui (ne demande pas de confirmation), --cle (redemande la clé API). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

const API = process.env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io';   // autre adresse : pour les tests seulement
const DIR = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(os.homedir(), '.config', 'requete', 'elevenlabs.key');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i >= 0 ? (args[i + 1] || '') : null; };
const nb = n => n.toLocaleString('fr-FR');
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (typeof fetch !== 'function') {
  console.log('Ce script demande Node 18 ou plus récent (node --version pour voir le tien).');
  process.exit(1);
}

function question(q, hidden = false){
  return new Promise(res => {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY});
    if (hidden) {
      rl._writeToOutput = s => { if (!rl.muted) rl.output.write(s); else if (/[\r\n]/.test(s)) rl.output.write('\n'); };
    }
    rl.question(q, a => { rl.close(); res(a); });
    rl.muted = hidden;
  });
}

async function apiKey(){
  if (process.env.ELEVENLABS_API_KEY && !flag('--cle')) return process.env.ELEVENLABS_API_KEY.trim();
  if (!flag('--cle')) { try { const k = fs.readFileSync(KEY_FILE, 'utf8').trim(); if (k) return k; } catch (e) {} }
  console.log('\nCrée une clé sur elevenlabs.io : Developers (menu de gauche) › API Keys › Create Key,');
  console.log('avec l’accès « Text to Speech ». Copie-la, puis colle-la ici.');
  const k = (await question('Clé API ElevenLabs (elle ne s’affiche pas) : ', true)).trim();
  if (!k) { console.log('Aucune clé collée : rien n’est fait.'); process.exit(1); }
  fs.mkdirSync(path.dirname(KEY_FILE), {recursive: true, mode: 0o700});
  fs.writeFileSync(KEY_FILE, k + '\n', {mode: 0o600});
  return k;
}

function forget(){ try { fs.unlinkSync(KEY_FILE); } catch (e) {} }

async function detail(r){
  const t = await r.text().catch(() => '');
  try { const j = JSON.parse(t); const d = j.detail || j; return typeof d === 'string' ? d : (d.message || d.status || t); } catch (e) { return t.slice(0, 300); }
}

/* Une requête, retentée en cas de surcharge (429) ou d’erreur du serveur (5xx, coupure réseau). */
async function call(key, url, init){
  for (let n = 0; ; n++) {
    let r = null, err = null;
    try { r = await fetch(API + url, Object.assign({}, init, {headers: Object.assign({'xi-api-key': key}, init.headers || {})})); }
    catch (e) { err = e; }
    if (r && r.status !== 429 && r.status < 500) return r;
    if (n >= 4) { if (r) return r; throw err; }
    const wait = r && r.headers.get('retry-after') ? Math.min(30, +r.headers.get('retry-after') || 2) * 1000 : 2000 * 2 ** n;
    process.stdout.write(`(${r ? 'serveur occupé' : 'réseau'}, nouvel essai dans ${Math.round(wait / 1000)} s) `);
    await sleep(wait);
  }
}

async function main(){
  const jobs = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
  const name = args.find(a => !a.startsWith('--') && jobs.includes(a.replace(/\.json$/, '') + '.json') && args[args.indexOf(a) - 1] !== '--refaire');
  const file = name ? name.replace(/\.json$/, '') + '.json' : (jobs.length === 1 ? jobs[0] : null);
  if (!file) { console.log('Quel cours ? ' + jobs.map(f => f.replace(/\.json$/, '')).join(', ')); process.exit(1); }
  const job = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const out = path.join(DIR, 'sortie', job.cours);
  fs.mkdirSync(out, {recursive: true});

  const redo = new Set((opt('--refaire') || '').split(',').map(s => s.trim()).filter(Boolean));
  const done = el => fs.existsSync(path.join(out, el.id + '.mp3')) && fs.existsSync(path.join(out, el.id + '.json'));
  const todo = job.elements.filter(el => flag('--tout') || redo.has(el.id) || !done(el));
  console.log(`\nVoix off · ${job.titre} · voix ${job.voix.nom} (${job.modele})`);
  if (!todo.length) { console.log('Tout est déjà généré dans tools/voix/sortie/' + job.cours + '. Rien à faire.'); return; }

  const key = await apiKey();
  /* Crédits restants (une clé limitée à « Text to Speech » ne peut pas les lire : on s’en passe). */
  let left = null;
  const s = await call(key, '/v1/user/subscription', {method: 'GET'});
  if (s.ok) { const j = await s.json(); left = (j.character_limit || 0) - (j.character_count || 0); }
  else if (s.status === 401) {
    const d = await detail(s);
    if (!/permission/i.test(d)) { forget(); console.log('\nElevenLabs refuse cette clé (' + d + '). Relance le script et colle une autre clé.'); process.exit(1); }
  }
  const cost = todo.reduce((a, el) => a + el.texte.length, 0);
  console.log(`À générer : ${todo.length} fichier${todo.length > 1 ? 's' : ''}, environ ${nb(cost)} crédits` + (left != null ? ` (il t’en reste ${nb(left)}).` : '.'));
  if (left != null && left < cost) { console.log('Pas assez de crédits ce mois-ci : rien n’est fait.'); process.exit(1); }
  if (!flag('--oui')) {
    const a = (await question('On y va ? (o/n) ')).trim().toLowerCase();
    if (!a.startsWith('o') && !a.startsWith('y')) { console.log('D’accord, rien n’est fait.'); return; }
  }

  /* Trois façons de demander, de la plus complète à la plus simple : avec le minutage et la continuité entre chapitres
     (texte d’avant et d’après, langue) ; avec le minutage seul ; l’audio seul, puis l’alignement forcé d’ElevenLabs.
     Une façon refusée par le modèle (400, 422) passe à la suivante, et la suivante reste retenue pour les fichiers d’après. */
  let level = 0, ok = 0;
  const q = `?output_format=${encodeURIComponent(job.format || 'mp3_44100_128')}`;
  for (const el of todo) {
    process.stdout.write(`  ${el.id.padEnd(8)} `);
    const full = {text: el.texte, model_id: job.modele, language_code: job.langue};
    if (el.avant) full.previous_text = el.avant;
    if (el.apres) full.next_text = el.apres;
    const min = {text: el.texte, model_id: job.modele};
    let audio = null, rec = null, r = null, why = '';
    for (let lv = level; lv < 3 && !audio; lv++) {
      const body = JSON.stringify(lv === 0 ? full : min);
      r = await call(key, `/v1/text-to-speech/${job.voix.id}${lv < 2 ? '/with-timestamps' : ''}${q}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body});
      if (r.ok) {
        level = lv;
        if (lv < 2) {
          const j = await r.json();
          audio = Buffer.from(j.audio_base64, 'base64');
          rec = {alignment: j.alignment || null, normalized_alignment: j.normalized_alignment || null};
        } else {
          audio = Buffer.from(await r.arrayBuffer());
          rec = {alignment: null, why};
          const fd = new FormData();
          fd.append('file', new Blob([audio], {type: 'audio/mpeg'}), el.id + '.mp3');
          fd.append('text', el.texte.replace(/\[[^\]]*\]\s*/g, ''));
          const fa = await call(key, '/v1/forced-alignment', {method: 'POST', body: fd});
          if (fa.ok) rec.forced = await fa.json();
        }
      } else if (r.status === 400 || r.status === 422) {
        why = await detail(r);
      } else break;
    }
    if (!audio) {
      const d = r && !r.ok && r.status !== 400 && r.status !== 422 ? await detail(r) : why;
      console.log('échec : ' + d);
      if (r && r.status === 401) { forget(); console.log('\nElevenLabs refuse cette clé. Relance le script et colle une autre clé (avec l’accès « Text to Speech »).'); process.exit(1); }
      if (/quota|credits|limit/i.test(d)) { console.log('\nPlus assez de crédits : arrêt. Ce qui est déjà généré est gardé.'); process.exit(1); }
      continue;
    }
    fs.writeFileSync(path.join(out, el.id + '.mp3'), audio);
    fs.writeFileSync(path.join(out, el.id + '.json'), JSON.stringify(Object.assign({id: el.id, texte: el.texte, phrases: el.phrases || null,
      voix: job.voix, modele: job.modele, niveau: level, request_id: r.headers.get('request-id') || null, cree: new Date().toISOString()}, rec)));
    ok++;
    console.log(`ok (${Math.round(audio.length / 1024)} Ko)`);
  }
  const all = job.elements.every(done);
  fs.writeFileSync(path.join(out, '_etat.json'), JSON.stringify({cours: job.cours, complet: all, faits: job.elements.filter(done).map(e => e.id), fini: new Date().toISOString()}));
  console.log(all ? `\nC’est fini : ${job.elements.length} fichiers dans tools/voix/sortie/${job.cours}. Tu peux le dire à Claude.`
    : `\n${ok} fichier${ok > 1 ? 's' : ''} généré${ok > 1 ? 's' : ''}, il en manque : relance la même commande pour finir (seuls les manquants seront faits).`);
}

main().catch(e => { console.log('\nErreur : ' + (e && e.message || e)); process.exit(1); });
