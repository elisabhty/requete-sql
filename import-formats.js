/* Import de fichiers dans la console (Elisa, 29 octobre, 18 h 19 : « pouvoir importer des fichiers Excel et tous les types possibles »).
   Sans bibliothèque, pour rester hors ligne et léger : les classeurs Excel (.xlsx, .xlsm, et l’ancien format .xls), OpenDocument (.ods,
   LibreOffice), les bases SQLite (.db, .sqlite), et le texte délimité (virgule, point-virgule d’Excel en français, tabulation, barre verticale),
   en UTF-8 ou en Windows-1252. Chaque feuille devient une matrice de lignes ; la page en fait des tables.
   ImportFormats.sniff(octets, nom)        → 'sqlite' | 'zip' | 'cfb' | 'text'
   ImportFormats.readWorkbook(octets, nom) → Promise<{sheets: [{name, rows: [[valeur…]…]}]}>
   ImportFormats.decodeText(octets)        → texte (UTF-8, sinon Windows-1252)
   ImportFormats.detectEncoding(octets)    → {encoding, text, repaired}
   ImportFormats.parseDelimited(texte)     → {delimiter, rows}
   Elisa, 31 octobre, 8 h 37 : « pour l’import de fichier, détecter automatiquement l’encodage pour mettre sous forme de colonnes, bien
   formatées (UTF-8, etc.) ». L’encodage se lit sur la marque d’ordre des octets (UTF-8, UTF-16, UTF-32), sinon sur le contenu : UTF-16
   sans marque (un octet nul sur deux, l’export « Texte Unicode » d’Excel), UTF-8 valide (réparé s’il a été lu deux fois : « Ã© »),
   sinon Windows-1252 ou Mac Roman, le plus lisible des deux. Les fins de ligne Windows, Unix et anciens Mac, la ligne « sep=; »
   d’Excel et les espaces autour des cellules sont pris en charge. */
(function (root) {
  'use strict';
  const u8 = b => (b instanceof Uint8Array ? b : new Uint8Array(b));
  const view = b => new DataView(b.buffer, b.byteOffset, b.byteLength);
  const utf8 = new TextDecoder('utf-8');

  function sniff(bytes, name) {
    const b = u8(bytes);
    if (b.length >= 16 && utf8.decode(b.subarray(0, 15)) === 'SQLite format 3') return 'sqlite';
    if (b[0] === 0x50 && b[1] === 0x4B && b[2] === 3 && b[3] === 4) return 'zip';
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return 'cfb';
    return 'text';
  }

  /* ---------- Texte : l’encodage ---------- */
  const dec = (label, b, fatal) => { try { return new TextDecoder(label, fatal ? {fatal: true} : undefined).decode(b); } catch (e) { return null; } };
  /* UTF-16 gros-boutiste : les octets inversés deux à deux, puis lus en petit-boutiste (au cas où le décodeur ne le connaît pas). */
  const utf16be = b => dec('utf-16be', b) ?? dec('utf-16le', b.slice(0, b.length & ~1).map((x, i, a) => a[i ^ 1])) ?? '';
  /* Windows-1252, octet par caractère : de quoi relire un texte UTF-8 qui a été lu (et réenregistré) en Windows-1252. */
  const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
  const cpByte = ch => { const c = ch.charCodeAt(0); if (c < 0x80 || (c >= 0xA0 && c <= 0xFF)) return c; const i = CP1252.indexOf(ch); return i < 0 ? -1 : 0x80 + i; };
  const MOJI = /Ã[\u00A0-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u02C6\u02DC\u2013-\u2026\u2030\u2039\u203A\u20AC\u2122]|Â[\u00A0-\u00BF]|â€/g;
  function repairMojibake(s) {
    const hits = (s.match(MOJI) || []).length;
    if (!hits) return {text: s, repaired: false};
    const bytes = [];
    for (const ch of s) { const v = cpByte(ch); if (v < 0) return {text: s, repaired: false}; bytes.push(v); }
    const fixed = dec('utf-8', new Uint8Array(bytes), true);
    if (fixed == null || (fixed.match(MOJI) || []).length >= hits) return {text: s, repaired: false};
    return {text: fixed, repaired: true};
  }
  /* Un texte français bien lu : des lettres accentuées ; mal lu : des caractères de contrôle ou des symboles rares. */
  const frScore = s => (s.match(/[éèêëàâäîïôöûüùçœæÉÈÊÀÂÎÔÛÇŒ]/g) || []).length * 2 - (s.match(/[\u0080-\u009F]/g) || []).length * 3
    - (s.match(/[ŽžŠšˆ‡†ƒ‰‹›˜™ÐÞþ¤¦¨¯´¸¬]/g) || []).length * 2;
  function detectEncoding(bytes) {
    const b = u8(bytes);
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return {encoding: 'UTF-8', text: dec('utf-8', b.subarray(3)) ?? '', repaired: false};
    if (b[0] === 0xFF && b[1] === 0xFE && b[2] === 0 && b[3] === 0) return {encoding: 'UTF-32', text: dec('utf-32le', b.subarray(4)) ?? '', repaired: false};
    if (b[0] === 0xFF && b[1] === 0xFE) return {encoding: 'UTF-16', text: dec('utf-16le', b.subarray(2)) ?? '', repaired: false};
    if (b[0] === 0xFE && b[1] === 0xFF) return {encoding: 'UTF-16', text: utf16be(b.subarray(2)), repaired: false};
    /* Sans marque : un octet nul sur deux, c’est de l’UTF-16 (texte latin) */
    const n = Math.min(b.length, 8192);
    if (n >= 4) {
      let even = 0, odd = 0;
      for (let i = 0; i < n; i++) if (b[i] === 0) { if (i & 1) odd++; else even++; }
      if (odd > n * 0.3 && even < n * 0.05) return {encoding: 'UTF-16', text: dec('utf-16le', b) ?? '', repaired: false};
      if (even > n * 0.3 && odd < n * 0.05) return {encoding: 'UTF-16', text: utf16be(b), repaired: false};
    }
    const u = dec('utf-8', b, true);
    if (u != null) { const r = repairMojibake(u); return {encoding: 'UTF-8', text: r.text, repaired: r.repaired}; }
    /* Pas de l’UTF-8 : Windows-1252 (Excel en français) ou Mac Roman (anciens Mac), le plus lisible des deux */
    const w = dec('windows-1252', b) ?? utf8.decode(b), m = dec('macintosh', b);
    if (m != null && frScore(m) > frScore(w)) return {encoding: 'Mac Roman', text: m, repaired: false};
    return {encoding: 'Windows-1252', text: w, repaired: false};
  }
  function decodeText(bytes) {
    return detectEncoding(bytes).text.replace(/^\uFEFF/, '');
  }
  const outsideQuotes = (line, d) => { let n = 0, q = false; for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return n; };
  /* La ligne « sep=; » qu’Excel ajoute parfois en tête : elle donne le séparateur, et n’est pas une ligne de données. */
  const SEP_LINE = /^\uFEFF?sep=(.)[ \t]*(?:\r\n|\r|\n)/i;
  function detectDelimiter(text) {
    const t = String(text), hint = SEP_LINE.exec(t);
    if (hint) return hint[1];
    const lines = t.split(/\r\n|\r|\n/).filter(l => l.trim()).slice(0, 40);
    let best = ',', score = 0;
    for (const d of ['\t', ';', ',', '|']) {
      const counts = lines.map(l => outsideQuotes(l, d)), first = counts[0];
      if (!first) continue;
      /* Le même nombre de séparateurs sur le plus de lignes possible ; à égalité, le plus de colonnes */
      const s = counts.filter(c => c === first).length * 1000 + first;
      if (s > score) { score = s; best = d; }
    }
    return best;
  }
  const DELIM_NAME = {',': 'virgule', ';': 'point-virgule', '\t': 'tabulation', '|': 'barre verticale'};
  function parseDelimited(text, delimiter) {
    let s = String(text).replace(/^\uFEFF/, '');
    const d = delimiter || detectDelimiter(s);
    s = s.replace(SEP_LINE, '').replace(/\r\n?/g, '\n');
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
        continue;
      }
      if (ch === '"' && cell === '') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    /* Les espaces autour d’une cellule (« Paris ; 12 ») ne font pas partie de la valeur */
    return {delimiter: d, delimiterName: DELIM_NAME[d] || d, rows: rows.filter(r => r.some(c => String(c).trim() !== '')).map(r => r.map(c => c.replace(/^[ \t\u00A0]+|[ \t\u00A0]+$/g, '')))};
  }

  /* ---------- Dates des tableurs : un nombre de jours depuis le 30 décembre 1899 (ou le 1er janvier 1904) ---------- */
  const BUILTIN_DATES = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  function isDateFormat(code) {
    if (!code) return false;
    const s = String(code).replace(/"[^"]*"|\[[^\]]*\]|\\.|_.|\*./g, '');
    return /[dmyhs]/i.test(s) && !/general/i.test(s);
  }
  const p2 = n => String(n).padStart(2, '0');
  function serialToIso(x, d1904) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round((x + (d1904 ? 1462 : 0)) * 86400000));
    const time = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
    if (x >= 0 && x < 1) return time;
    const day = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
    return time === '00:00:00' ? day : `${day} ${time}`;
  }

  /* ---------- XML, sans DOMParser (et donc aussi dans les tests) ---------- */
  const ENT = {lt: '<', gt: '>', amp: '&', quot: '"', apos: "'"};
  const unent = s => String(s).replace(/&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|amp|quot|apos));/gi,
    (m, h, d, n) => (h ? String.fromCodePoint(parseInt(h, 16)) : d ? String.fromCodePoint(+d) : ENT[n.toLowerCase()]));
  function attrs(tag) {
    const o = {};
    String(tag).replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (m, k, a, b) => { o[k] = unent(a != null ? a : b); return m; });
    return o;
  }
  const colIndex = ref => { const m = /^([A-Z]+)/i.exec(ref || ''); if (!m) return -1; let n = 0; for (const c of m[1].toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };

  /* ---------- ZIP (xlsx, ods) ---------- */
  async function unzip(bytes) {
    const b = u8(bytes), v = view(b);
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('archive illisible');
    const files = new Map();
    let p = v.getUint32(e + 16, true);
    for (let k = 0, n = v.getUint16(e + 10, true); k < n && v.getUint32(p, true) === 0x02014b50; k++) {
      const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
      files.set(utf8.decode(b.subarray(p + 46, p + 46 + nl)), {method: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), off: v.getUint32(p + 42, true)});
      p += 46 + nl + xl + cl;
    }
    async function read(name) {
      const f = files.get(name.replace(/^\//, ''));
      if (!f) return null;
      const start = f.off + 30 + v.getUint16(f.off + 26, true) + v.getUint16(f.off + 28, true), data = b.subarray(start, start + f.size);
      if (f.method === 0) return data;
      if (f.method !== 8) throw new Error('compression non prise en charge');
      if (typeof DecompressionStream === 'undefined') throw new Error('cet appareil ne sait pas ouvrir les classeurs : mets-le à jour, ou enregistre le fichier en CSV');
      const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
      return new Uint8Array(await out.arrayBuffer());
    }
    return {files, read, text: async name => { const d = await read(name); return d ? utf8.decode(d) : null; }};
  }

  /* ---------- Excel .xlsx / .xlsm ---------- */
  const xmlText = inner => {
    let s = '';
    String(inner).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').replace(/<t\b[^>]*>([\s\S]*?)<\/t>/g, (m, t) => { s += unent(t); return m; });
    return s;
  };
  async function readXlsx(z) {
    const wb = await z.text('xl/workbook.xml');
    if (!wb) throw new Error('classeur Excel illisible');
    const d1904 = /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(wb);
    const rels = {};
    ((await z.text('xl/_rels/workbook.xml.rels')) || '').replace(/<Relationship\b[^>]*>/g, t => { const a = attrs(t); rels[a.Id] = a.Target; return t; });
    const sst = [];
    ((await z.text('xl/sharedStrings.xml')) || '').replace(/<si\b[^>]*>([\s\S]*?)<\/si>/g, (m, inner) => { sst.push(xmlText(inner)); return m; });
    const styles = (await z.text('xl/styles.xml')) || '', fmts = {};
    styles.replace(/<numFmt\b[^>]*>/g, t => { const a = attrs(t); fmts[a.numFmtId] = a.formatCode; return t; });
    const xfs = [], cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles);
    if (cellXfs) cellXfs[1].replace(/<xf\b[^>]*>/g, t => { const id = +(attrs(t).numFmtId || 0); xfs.push(BUILTIN_DATES.has(id) || isDateFormat(fmts[id])); return t; });
    const sheets = [];
    for (const t of wb.match(/<sheet\b[^>]*>/g) || []) {
      const a = attrs(t);
      if (a.state === 'hidden' || a.state === 'veryHidden') continue;
      let target = rels[a['r:id']] || '';
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const xml = await z.text(target);
      if (!xml) continue;
      const rows = [];
      let auto = 0;
      xml.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, ra, inner) => {
        const r = +(attrs(ra).r || 0) - 1, ri = r >= 0 ? r : auto;
        auto = ri + 1;
        const row = [];
        let col = 0;
        String(inner || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mc, ca, ci) => {
          const c = attrs(ca), k = c.r ? colIndex(c.r) : col;
          col = k + 1;
          const v = /<v>([\s\S]*?)<\/v>/.exec(ci || ''), raw = v ? unent(v[1]) : null, type = c.t || 'n';
          let val = null;
          if (type === 's') val = raw == null ? null : sst[+raw];
          else if (type === 'inlineStr') { const is = /<is>([\s\S]*?)<\/is>/.exec(ci || ''); val = is ? xmlText(is[1]) : null; }
          else if (type === 'str') val = raw;
          else if (type === 'b') val = raw == null ? null : (raw === '1' || raw === 'true' ? 1 : 0);
          else if (type === 'e') val = null;
          else if (type === 'd') val = raw ? raw.replace('T', ' ').replace(/ 00:00:00(?:\.0+)?Z?$/, '').replace(/Z$/, '') : null;
          else if (raw != null && raw !== '') { const n = +raw; val = xfs[+(c.s || 0)] ? serialToIso(n, d1904) : n; }
          if (val != null && val !== '') row[k] = val;
          return mc;
        });
        if (row.length) rows[ri] = row;
        return m;
      });
      sheets.push({name: a.name || 'Feuille' + (sheets.length + 1), rows: Array.from(rows, r => r || [])});
    }
    return sheets;
  }

  /* ---------- OpenDocument .ods ---------- */
  const odsText = inner => String(inner).replace(/<text:s\b([^>]*)\/>/g, (m, a) => ' '.repeat(+(attrs(a)['text:c'] || 1)))
    .replace(/<text:tab\b[^>]*\/>/g, '\t').replace(/<text:line-break\b[^>]*\/>/g, '\n').replace(/<\/text:p>\s*<text:p\b[^>]*>/g, '\n').replace(/<[^>]+>/g, '');
  function odsValue(a, inner) {
    const t = a['office:value-type'];
    if (t === 'float' || t === 'percentage' || t === 'currency') return +a['office:value'];
    if (t === 'boolean') return a['office:boolean-value'] === 'true' ? 1 : 0;
    if (t === 'date') { const d = a['office:date-value'] || ''; return d.replace('T', ' ').replace(/ 00:00:00(?:\.0+)?$/, '').replace(/\.\d+$/, ''); }
    if (t === 'time') { const m = /PT(\d+)H(\d+)M([\d.]+)S/.exec(a['office:time-value'] || ''); return m ? `${p2(+m[1])}:${p2(+m[2])}:${p2(Math.floor(+m[3]))}` : null; }
    const s = unent(odsText(inner || ''));
    return s === '' ? null : s;
  }
  async function readOds(z) {
    const xml = await z.text('content.xml');
    if (!xml) throw new Error('classeur OpenDocument illisible');
    const sheets = [];
    xml.replace(/<table:table(\s[^>]*)?>([\s\S]*?)<\/table:table>/g, (m, ta, body) => {
      const rows = [];
      body.replace(/<table:table-row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-row>)/g, (mr, ra, rinner) => {
        const row = [];
        let col = 0;
        String(rinner || '').replace(/<table:(?:covered-)?table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:(?:covered-)?table-cell>)/g, (mc, ca, cinner) => {
          const a = attrs(ca), rep = Math.max(1, +(a['table:number-columns-repeated'] || 1)), val = odsValue(a, cinner);
          if (val != null && val !== '') for (let k = 0; k < Math.min(rep, 1024); k++) row[col + k] = val;
          col += rep;
          return mc;
        });
        const rep = Math.max(1, +(attrs(ra)['table:number-rows-repeated'] || 1));
        if (row.length) for (let k = 0; k < Math.min(rep, 100000); k++) rows.push(row.slice());
        else rows.push(...Array(Math.min(rep, 2)).fill([]));
        return mr;
      });
      sheets.push({name: attrs(ta || '')['table:name'] || 'Feuille' + (sheets.length + 1), rows});
      return m;
    });
    return sheets;
  }

  /* ---------- Excel 97-2003 .xls : un fichier composé (CFB) qui contient le flux « Workbook » au format BIFF8 ---------- */
  function cfbStream(bytes, wanted) {
    const b = u8(bytes), v = view(b);
    const ss = 1 << v.getUint16(30, true), mss = 1 << v.getUint16(32, true), cutoff = v.getUint32(56, true);
    const sectorAt = s => (s + 1) * ss;
    const difat = [];
    for (let k = 0; k < 109; k++) { const s = v.getInt32(76 + k * 4, true); if (s >= 0) difat.push(s); }
    for (let s = v.getInt32(68, true), n = v.getUint32(72, true); s >= 0 && n-- > 0;) {
      for (let k = 0; k < ss / 4 - 1; k++) { const x = v.getInt32(sectorAt(s) + k * 4, true); if (x >= 0) difat.push(x); }
      s = v.getInt32(sectorAt(s) + ss - 4, true);
    }
    const fat = [];
    difat.forEach(s => { for (let k = 0; k < ss / 4; k++) fat.push(v.getInt32(sectorAt(s) + k * 4, true)); });
    const chain = (start, table) => { const out = []; for (let s = start, guard = 0; s >= 0 && guard < 1e6; guard++) { out.push(s); s = table[s]; } return out; };
    const readChain = (start, size) => {
      const out = new Uint8Array(size); let o = 0;
      for (const s of chain(start, fat)) { const n = Math.min(ss, size - o); if (n <= 0) break; out.set(b.subarray(sectorAt(s), sectorAt(s) + n), o); o += n; }
      return out;
    };
    const dirStart = v.getInt32(48, true), dirs = chain(dirStart, fat);
    const dirBytes = new Uint8Array(dirs.length * ss);
    dirs.forEach((s, k) => dirBytes.set(b.subarray(sectorAt(s), sectorAt(s) + ss), k * ss));
    const dv = view(dirBytes), entries = [];
    for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
      const nl = dv.getUint16(o + 64, true);
      entries.push({name: new TextDecoder('utf-16le').decode(dirBytes.subarray(o, o + Math.max(0, nl - 2))), type: dirBytes[o + 66], start: dv.getInt32(o + 116, true), size: dv.getUint32(o + 120, true)});
    }
    const e = entries.find(x => x.type === 2 && wanted.includes(x.name));
    if (!e) return null;
    if (e.size >= cutoff) return readChain(e.start, e.size);
    const rootE = entries.find(x => x.type === 5), mini = readChain(rootE.start, rootE.size);
    const mfat = [], mfStart = v.getInt32(60, true);
    if (mfStart >= 0) chain(mfStart, fat).forEach(s => { for (let k = 0; k < ss / 4; k++) mfat.push(v.getInt32(sectorAt(s) + k * 4, true)); });
    const out = new Uint8Array(e.size); let o = 0;
    for (const s of chain(e.start, mfat)) { const n = Math.min(mss, e.size - o); if (n <= 0) break; out.set(mini.subarray(s * mss, s * mss + n), o); o += n; }
    return out;
  }
  function readXls(bytes) {
    const wbk = cfbStream(bytes, ['Workbook', 'Book']);
    if (!wbk) throw new Error('classeur Excel illisible');
    const v = view(wbk);
    const recs = [];
    for (let o = 0; o + 4 <= wbk.length;) { const type = v.getUint16(o, true), len = v.getUint16(o + 2, true); recs.push({type, off: o, data: wbk.subarray(o + 4, o + 4 + len)}); o += 4 + len; }
    const latin = new TextDecoder('windows-1252'), u16 = new TextDecoder('utf-16le');
    // Une chaîne BIFF8 peut se poursuivre dans les enregistrements CONTINUE : le lecteur passe d’un morceau à l’autre.
    function reader(parts) {
      let i = 0, o = 0;
      const cur = () => parts[i];
      const need = () => { while (i < parts.length && o >= parts[i].length) { i++; o = 0; } };
      return {
        u8() { need(); return cur()[o++]; },
        u16() { const a = this.u8(), b2 = this.u8(); return a | (b2 << 8); },
        u32() { return (this.u16() | (this.u16() << 16)) >>> 0; },
        skip(n) { while (n > 0) { need(); if (i >= parts.length) return; const k = Math.min(n, cur().length - o); o += k; n -= k; } },
        str(cch, high, cont) {
          let s = '';
          while (cch > 0) {
            if (o >= (cur() || []).length) { i++; o = 0; if (cont && i < parts.length) high = parts[i][o++] & 1; }
            if (i >= parts.length) break;
            const avail = high ? Math.floor((cur().length - o) / 2) : cur().length - o, k = Math.min(cch, avail);
            s += high ? u16.decode(cur().subarray(o, o + k * 2)) : latin.decode(cur().subarray(o, o + k));
            o += high ? k * 2 : k; cch -= k;
          }
          return s;
        },
        unicode(lenBytes, cont) {
          const cch = lenBytes === 1 ? this.u8() : this.u16(), fl = this.u8();
          const runs = fl & 8 ? this.u16() : 0, ext = fl & 4 ? this.u32() : 0;
          const s = this.str(cch, fl & 1, cont);
          this.skip(runs * 4 + ext);
          return s;
        }
      };
    }
    const one = d => reader([d]);
    let d1904 = false;
    const fmts = {}, xfs = [], sst = [], sheetsMeta = [];
    for (let k = 0; k < recs.length; k++) {
      const r = recs[k];
      if (r.type === 0x0022) d1904 = r.data[0] === 1;
      else if (r.type === 0x041E) { const rd = one(r.data), id = rd.u16(); fmts[id] = rd.unicode(2); }
      else if (r.type === 0x00E0) xfs.push(view(r.data).getUint16(2, true));
      else if (r.type === 0x0085) { const rd = one(r.data), pos = rd.u32(); rd.u8(); const dt = rd.u8(); sheetsMeta.push({pos, dt, name: rd.unicode(1)}); }
      else if (r.type === 0x00FC) {
        const parts = [r.data];
        while (recs[k + 1] && recs[k + 1].type === 0x003C) parts.push(recs[++k].data);
        const rd = reader(parts); rd.u32(); const n = rd.u32();
        for (let j = 0; j < n; j++) { try { sst.push(rd.unicode(2, true)); } catch (e) { break; } }
      }
      else if (r.type === 0x000A) break;   // fin du classeur : viennent les feuilles
    }
    const isDate = ixfe => { const f = xfs[ixfe]; return f != null && (BUILTIN_DATES.has(f) || isDateFormat(fmts[f])); };
    const num = (x, ixfe) => (isDate(ixfe) ? serialToIso(x, d1904) : x);
    const rk = (x, ixfe) => {
      let n;
      if (x & 2) n = x >> 2;
      else { const t = new DataView(new ArrayBuffer(8)); t.setUint32(4, x & 0xFFFFFFFC, true); n = t.getFloat64(0, true); }
      return num(x & 1 ? n / 100 : n, ixfe);
    };
    const sheets = [];
    for (const meta of sheetsMeta) {
      if (meta.dt !== 0) continue;
      let k = recs.findIndex(r => r.off === meta.pos);
      if (k < 0) continue;
      const rows = [], put = (r, c, val) => { if (val == null || val === '') return; (rows[r] = rows[r] || [])[c] = val; };
      let pendingStr = null;
      for (k++; k < recs.length && recs[k].type !== 0x000A; k++) {
        const {type, data} = recs[k], dv = view(data);
        if (type === 0x00FD) put(dv.getUint16(0, true), dv.getUint16(2, true), sst[dv.getUint32(6, true)]);
        else if (type === 0x0203) put(dv.getUint16(0, true), dv.getUint16(2, true), num(dv.getFloat64(6, true), dv.getUint16(4, true)));
        else if (type === 0x027E) put(dv.getUint16(0, true), dv.getUint16(2, true), rk(dv.getUint32(6, true), dv.getUint16(4, true)));
        else if (type === 0x00BD) {
          const r = dv.getUint16(0, true), c0 = dv.getUint16(2, true), n = (data.length - 6) / 6;
          for (let j = 0; j < n; j++) put(r, c0 + j, rk(dv.getUint32(4 + j * 6 + 2, true), dv.getUint16(4 + j * 6, true)));
        }
        else if (type === 0x0204) { const rd = one(data.subarray(6)); put(dv.getUint16(0, true), dv.getUint16(2, true), rd.unicode(2)); }
        else if (type === 0x0205) { if (!data[7]) put(dv.getUint16(0, true), dv.getUint16(2, true), data[6] ? 1 : 0); }
        else if (type === 0x0006) {
          const r = dv.getUint16(0, true), c = dv.getUint16(2, true);
          if (dv.getUint16(12, true) === 0xFFFF) {
            if (data[6] === 0) pendingStr = [r, c];
            else if (data[6] === 1) put(r, c, data[8] ? 1 : 0);
          } else put(r, c, num(dv.getFloat64(6, true), dv.getUint16(4, true)));
        }
        else if (type === 0x0207 && pendingStr) { put(pendingStr[0], pendingStr[1], one(data).unicode(2)); pendingStr = null; }
      }
      sheets.push({name: meta.name, rows: Array.from(rows, r => r || [])});
    }
    return sheets;
  }

  async function readWorkbook(bytes, name) {
    const kind = sniff(bytes, name);
    if (kind === 'cfb') return {sheets: readXls(bytes), format: 'xls'};
    if (kind !== 'zip') throw new Error('ce fichier n’est pas un classeur');
    const z = await unzip(bytes);
    if (z.files.has('xl/workbook.xml')) return {sheets: await readXlsx(z), format: 'xlsx'};
    if (z.files.has('content.xml')) return {sheets: await readOds(z), format: 'ods'};
    if ([...z.files.keys()].some(n => /^Index\//.test(n))) throw new Error('un fichier Numbers s’exporte d’abord : Fichier › Exporter vers › Excel, puis importe le fichier .xlsx');
    throw new Error('archive sans classeur reconnu');
  }

  root.ImportFormats = {sniff, decodeText, detectEncoding, repairMojibake, detectDelimiter, parseDelimited, readWorkbook, serialToIso, isDateFormat};
})(typeof window !== 'undefined' ? window : globalThis);
