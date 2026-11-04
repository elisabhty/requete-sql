// Retours d’Elisa, 4 novembre, 18 h 41 : « échec export failed ». L’archive était bonne (** ARCHIVE SUCCEEDED **), c’est
// l’envoi depuis le Terminal qui bloquait : « error: exportArchive Failed to Use Accounts ». Le script ouvre alors l’archive
// dans l’Organizer d’Xcode et dit quoi cliquer, au lieu de finir sur le pavé d’erreur de npm.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT = new URL('../scripts/ios-testflight.sh', import.meta.url);
const sh = fs.readFileSync(SCRIPT, 'utf8');
const ios = fs.readFileSync(new URL('../IOS.md', import.meta.url), 'utf8');

/* Un faux dépôt : le script, un projet iOS avec une équipe, et de faux xcodebuild / open qui notent ce qu’on leur demande */
function lancer(exportOk) {
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-testflight-'));
  try {
    fs.mkdirSync(path.join(t, 'scripts'));
    fs.copyFileSync(SCRIPT, path.join(t, 'scripts/ios-testflight.sh'));
    fs.mkdirSync(path.join(t, 'ios/App/App.xcodeproj'), { recursive: true });
    fs.writeFileSync(path.join(t, 'ios/App/App.xcodeproj/project.pbxproj'), 'DEVELOPMENT_TEAM = RN77C85JG4;\n');
    const bin = path.join(t, 'bin'), journal = path.join(t, 'journal.txt');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'xcodebuild'), `#!/bin/bash
echo "xcodebuild $*" >> "${journal}"
case " $* " in
  *" archive "*) echo "** ARCHIVE SUCCEEDED **"; exit 0 ;;
  *" -exportArchive "*) ${exportOk ? 'echo "** EXPORT SUCCEEDED **"; exit 0' : 'echo "error: exportArchive Failed to Use Accounts" >&2; echo "** EXPORT FAILED **"; exit 70'} ;;
esac
exit 1
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'open'), `#!/bin/bash\necho "open $* (depuis $PWD)" >> "${journal}"\n`, { mode: 0o755 });
    const r = spawnSync('bash', [path.join(t, 'scripts/ios-testflight.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8'
    });
    return { code: r.status, out: r.stdout + r.stderr, journal: fs.readFileSync(journal, 'utf8') };
  } finally {
    fs.rmSync(t, { recursive: true, force: true });
  }
}

test('18 h 41 : si l’envoi échoue, Xcode s’ouvre sur l’archive avec les trois clics à faire', () => {
  execFileSync('bash', ['-n', new URL(SCRIPT).pathname]);
  const r = lancer(false);
  assert.equal(r.code, 0, 'les consignes restent les dernières lignes (pas d’erreur npm par-dessous)');
  assert.ok(r.out.includes('** ARCHIVE SUCCEEDED **') && r.out.includes('Failed to Use Accounts'));
  assert.ok(r.out.includes('Pas encore envoyée : Xcode s’ouvre sur l’archive. Clique « Distribute App », choisis « App Store Connect », puis « Distribute ».'));
  assert.ok(!r.out.includes('Envoyé. Apple prépare la version'), 'ne prétend pas que c’est parti');
  assert.match(r.journal, /^open build\/Requete\.xcarchive \(depuis .*\/ios\/App\)$/m, 'l’archive tout juste fabriquée');
  assert.match(r.journal, /-exportOptionsPlist \.\.\/\.\.\/scripts\/ios-export-options\.plist -exportPath build\/envoi -allowProvisioningUpdates/);
});

test('18 h 41 : quand l’envoi marche, rien ne change (pas d’Xcode ouvert)', () => {
  const r = lancer(true);
  assert.equal(r.code, 0);
  assert.ok(r.out.includes('Envoyé. Apple prépare la version : elle arrive dans TestFlight d’ici 10 à 30 minutes (un e-mail le dit).'));
  assert.ok(!r.journal.includes('open '), 'Xcode reste fermé');
  assert.ok(!r.out.includes('Distribute App'));
});

test('18 h 41 : IOS.md explique l’erreur et la marche à suivre', () => {
  assert.ok(sh.includes('if ! xcodebuild -exportArchive -archivePath build/Requete.xcarchive \\'));
  assert.ok(ios.includes('`error: exportArchive Failed to Use Accounts`'));
  assert.ok(ios.includes('« Distribute App » › « App Store Connect » › « Distribute »'));
});
