/* Elisa, 7 novembre, 20 h 44 (« compile swift je suis sur mac ») : « npm run ios:verif » compile l’app et ses widgets sur le Mac,
   sans signer ni envoyer, et garde le journal là où Claude peut le lire (ios/verif-swift.log, dans le dossier connecté). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const lire = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('npm run ios:verif : la préparation de TestFlight, puis une fabrication sans signature, le journal dans ios/', () => {
  const pkg = JSON.parse(lire('package.json'));
  assert.equal(pkg.scripts['ios:verif'], 'npm run build:www && npx cap sync ios && bash scripts/ios-ecran-lancement.sh && node scripts/ios-widget.mjs && bash scripts/ios-verif.sh');
  const s = lire('scripts/ios-verif.sh');
  for (const k of ['cd "$(dirname "$0")/../ios/App"', 'journal=../verif-swift.log', "-destination 'generic/platform=iOS'", 'CODE_SIGNING_ALLOWED=NO build > "$journal" 2>&1',
    'grep -E "error:" "$journal" | sort -u | head -30'])
    assert.ok(s.includes(k), k);
  assert.ok(!/exportArchive|altool|upload/.test(s), 'rien n’est envoyé');
  assert.ok(lire('IOS.md').includes('`cd ~/SQL && git pull --ff-only && npm run ios:verif`'));
});
