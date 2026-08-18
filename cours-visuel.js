/* ============================================================
   cours-visuel.js — illustrations animées + repères pédagogiques
   pour la slide « Cours ». Couche additive : n'altère aucune
   fonction existante, se branche via MutationObserver.
   ============================================================ */
(function(){
  'use strict';

  var A = '#5B5BD6', A2 = '#7A6FF0', OK = '#0E7C4A', OKS = '#DFF3E8',
      WARN = '#B45309', WARNS = '#FDF0E0', DIM = '#A9A9B6', LINE = 'rgba(60,60,67,.14)';

  /* ---------- helpers SVG ---------- */
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // Petite table stylisée
  function tbl(o){
    var colW = o.colW || 44, rowH = o.rowH || 19, headH = o.headH || 19,
        head = o.head || [], data = o.data || [], x = o.x || 0, y = o.y || 0,
        hi = o.hi, r = 8, s = '';
    var ws = o.colWs || head.map(function(){ return colW; });
    var offs = [], acc = 0;
    ws.forEach(function(v){ offs.push(acc); acc += v; });
    var w = acc, h = headH + rowH * data.length;
    s += '<g'+(o.anim?' data-anim="'+o.anim+'"':'')+(o.style?' style="'+o.style+'"':'')+'>';
    s += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="#fff" stroke="'+LINE+'"/>';
    // colonne mise en avant
    if (hi != null) {
      s += '<rect x="'+(x+offs[hi])+'" y="'+y+'" width="'+ws[hi]+'" height="'+h+'" rx="6" fill="'+A+'" opacity=".10" data-anim="pulse"/>';
    }
    // entête
    s += '<path d="M'+x+' '+(y+r)+'a'+r+' '+r+' 0 0 1 '+r+' -'+r+'h'+(w-2*r)+'a'+r+' '+r+' 0 0 1 '+r+' '+r+'v'+(headH-r)+'h-'+w+'z" fill="#F1F0FB"/>';
    head.forEach(function(t,i){
      s += '<text class="cv-lab" x="'+(x+offs[i]+9)+'" y="'+(y+13)+'" fill="'+(hi===i?A:'#8E8E9A')+'">'+esc(t).toUpperCase()+'</text>';
    });
    data.forEach(function(row,ri){
      var ry = y + headH + rowH*ri;
      if (ri) s += '<line x1="'+x+'" y1="'+ry+'" x2="'+(x+w)+'" y2="'+ry+'" stroke="'+LINE+'"/>';
      if (o.dimRows && o.dimRows.indexOf(ri) >= 0)
        s += '<rect x="'+(x+1)+'" y="'+(ry+1)+'" width="'+(w-2)+'" height="'+(rowH-2)+'" fill="#F4F4F7"/>';
      if (o.okRows && o.okRows.indexOf(ri) >= 0)
        s += '<rect x="'+(x+1)+'" y="'+(ry+1)+'" width="'+(w-2)+'" height="'+(rowH-2)+'" fill="'+OKS+'"/>';
      row.forEach(function(t,ci){
        var dim = (o.dimRows && o.dimRows.indexOf(ri) >= 0);
        s += '<text class="cv-mono" x="'+(x+offs[ci]+9)+'" y="'+(ry+13)+'" fill="'+(dim?DIM:'#2B2B33')+'">'+esc(t)+'</text>';
      });
    });
    s += '</g>';
    return { s: s, w: w, h: h };
  }

  function arrow(x, y, len, color){
    len = len || 26; color = color || A;
    return '<g data-anim="fade" style="animation-delay:.35s">'
      + '<line x1="'+x+'" y1="'+y+'" x2="'+(x+len-7)+'" y2="'+y+'" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/>'
      + '<path d="M'+(x+len-8)+' '+(y-4)+'l5 4-5 4" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>';
  }

  function chip(x, y, w, t, fill, ink, delay){
    return '<g data-anim="pop" style="animation-delay:'+(delay||0)+'s">'
      + '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="21" rx="7" fill="'+fill+'"/>'
      + '<text class="cv-mono" x="'+(x+9)+'" y="'+(y+14)+'" fill="'+ink+'">'+esc(t)+'</text></g>';
  }

  function svg(inner, h){
    return '<svg class="cv-hero-stage" viewBox="0 0 320 '+(h||132)+'" role="img" aria-hidden="true">'+inner+'</svg>';
  }

  /* ---------- bibliothèque de scènes ---------- */
  var SCENES = {

    select: function(){
      var t = tbl({ x:6, y:20, head:['id','nom','ville'], colW:46,
        data:[['1','Sophie','Paris'],['2','Lucas','Lyon'],['3','Emma','Paris']], hi:1 });
      var r = tbl({ x:224, y:20, head:['nom'], colW:74,
        data:[['Sophie'],['Lucas'],['Emma']], anim:'pop', style:'animation-delay:.5s' });
      return {
        kw:'SELECT', say:'Choisir les colonnes à afficher',
        cap:'La table garde toutes ses colonnes. <b>SELECT</b> décide seulement de celles qui sortent.',
        svg: svg(t.s + arrow(172, 58, 40) + r.s + '<text class="cv-lab" x="166" y="42" fill="'+A+'">SELECT nom</text>')
      };
    },

    where: function(){
      var t = tbl({ x:6, y:14, head:['nom','ville'], colW:64,
        data:[['Sophie','Paris'],['Lucas','Lyon'],['Emma','Paris'],['Adam','Lyon']],
        okRows:[0,2], dimRows:[1,3] });
      var r = tbl({ x:210, y:24, head:['nom'], colW:76,
        data:[['Sophie'],['Emma']], anim:'pop', style:'animation-delay:.55s' });
      var sieve = '<g data-anim="fade" style="animation-delay:.25s">'
        + '<rect x="142" y="46" width="48" height="24" rx="8" fill="'+A+'"/>'
        + '<text class="cv-mono" x="149" y="61" fill="#fff">WHERE</text></g>';
      return {
        kw:'WHERE', say:'Ne garder que les bonnes lignes',
        cap:'Chaque ligne passe le test. Celles qui répondent <b>vrai</b> restent, les autres disparaissent.',
        svg: svg(t.s + arrow(136, 58, 6) + sieve + arrow(192, 58, 16) + r.s
          + '<text class="cv-lab" x="140" y="84" fill="'+DIM+'">ville = Paris</text>')
      };
    },

    orderby: function(){
      var vals = [34, 12, 52, 22, 44], sorted = vals.slice().sort(function(a,b){return a-b;});
      function bars(x, arr, color, delay){
        return arr.map(function(v,i){
          return '<g data-anim="drop" style="animation-delay:'+(delay+i*.08)+'s">'
            + '<rect x="'+(x+i*20)+'" y="'+(104-v)+'" width="13" height="'+v+'" rx="4" fill="'+color+'"/></g>';
        }).join('');
      }
      return {
        kw:'ORDER BY', say:'Ranger le résultat',
        cap:'Les mêmes lignes, dans un <b>ordre choisi</b> — croissant par défaut, <code>DESC</code> pour l’inverse.',
        svg: svg(bars(14, vals, '#C9C8DA', .1) + arrow(140, 70, 34)
          + bars(200, sorted, A, .6)
          + '<text class="cv-lab" x="14" y="120" fill="'+DIM+'">EN VRAC</text>'
          + '<text class="cv-lab" x="200" y="120" fill="'+A+'">TRIÉ</text>')
      };
    },

    limit: function(){
      var t = tbl({ x:60, y:10, head:['produit','prix'], colW:70,
        data:[['Clavier','49'],['Souris','25'],['Écran','199'],['Câble','9'],['Housse','19']],
        dimRows:[2,3,4] });
      var cut = '<g data-anim="fade" style="animation-delay:.5s">'
        + '<line x1="46" y1="'+(10+19+19*2)+'" x2="214" y2="'+(10+19+19*2)+'" stroke="'+A+'" stroke-width="2" stroke-dasharray="5 5"/>'
        + '<rect x="222" y="'+(10+19+19*2-11)+'" width="62" height="22" rx="8" fill="'+A+'"/>'
        + '<text class="cv-mono" x="230" y="'+(10+19+19*2+4)+'" fill="#fff">LIMIT 2</text></g>';
      return {
        kw:'LIMIT', say:'S’arrêter après N lignes',
        cap:'SQL coupe le résultat <b>après</b> le tri : très pratique pour un top 3.',
        svg: svg(t.s + cut, 118)
      };
    },

    distinct: function(){
      var src = ['Paris','Lyon','Paris','Lyon','Paris'];
      var s = src.map(function(v,i){ return chip(16, 12+i*23, 78, v, '#EFEEF7', '#4A4A57', .06*i); }).join('');
      var out = ['Paris','Lyon'].map(function(v,i){
        return chip(216, 40+i*26, 82, v, '#E7E6FA', A, .6+.12*i); }).join('');
      return {
        kw:'DISTINCT', say:'Une valeur, une seule fois',
        cap:'Les doublons fusionnent : il reste la <b>liste des valeurs différentes</b>.',
        svg: svg(s + arrow(120, 62, 76) + out
          + '<text class="cv-lab" x="16" y="136" fill="'+DIM+'">5 LIGNES</text>'
          + '<text class="cv-lab" x="216" y="136" fill="'+A+'">2 VALEURS</text>', 146)
      };
    },

    agg: function(){
      var s = ['49','25','199','9'].map(function(v,i){
        return chip(16, 14+i*24, 56, v, '#EFEEF7', '#4A4A57', .06*i); }).join('');
      var funnel = '<g data-anim="fade" style="animation-delay:.4s">'
        + '<path d="M104 26 h74 l-24 30 v22 l-26 10 v-32z" fill="'+A+'" opacity=".12"/>'
        + '<path d="M104 26 h74 l-24 30 v22 l-26 10 v-32z" fill="none" stroke="'+A+'" stroke-width="1.6"/></g>';
      return {
        kw:'AGRÉGATS', say:'Plusieurs lignes → un seul nombre',
        cap:'Une fonction d’agrégat <b>résume une colonne entière</b> en une seule valeur.',
        svg: svg(s + funnel + arrow(190, 62, 26)
          + '<g data-anim="pop" style="animation-delay:.75s">'
          + '<rect x="228" y="38" width="80" height="48" rx="14" fill="'+A+'"/>'
          + '<text x="248" y="70" font-family="var(--mono)" font-size="21" font-weight="700" fill="#fff">282</text></g>'
          + '<text class="cv-lab" x="228" y="102" fill="'+A+'">SUM(prix)</text>', 118)
      };
    },

    groupby: function(){
      var cols = ['#7A6FF0','#0E9E7E','#E08A2B'];
      var scatter = [[20,18,0],[62,34,1],[36,58,2],[86,16,0],[24,88,1],[74,66,2],[100,44,0]];
      var s = scatter.map(function(p,i){
        return '<circle cx="'+(p[0]+8)+'" cy="'+(p[1]+14)+'" r="7" fill="'+cols[p[2]]+'" data-anim="pop" style="animation-delay:'+(.05*i)+'s"/>';
      }).join('');
      var buckets = cols.map(function(c,i){
        var x = 196 + i*40;
        return '<g data-anim="drop" style="animation-delay:'+(.5+.12*i)+'s">'
          + '<rect x="'+x+'" y="34" width="32" height="58" rx="10" fill="'+c+'" opacity=".14"/>'
          + '<rect x="'+x+'" y="34" width="32" height="58" rx="10" fill="none" stroke="'+c+'"/>'
          + '<circle cx="'+(x+16)+'" cy="'+72+'" r="7" fill="'+c+'"/>'
          + '<circle cx="'+(x+16)+'" cy="'+56+'" r="7" fill="'+c+'" opacity="'+(i===2?'0':'1')+'"/></g>';
      }).join('');
      return {
        kw:'GROUP BY', say:'Rassembler les lignes qui se ressemblent',
        cap:'Les lignes se rangent par <b>valeur commune</b> — puis chaque paquet donne une ligne de résultat.',
        svg: svg(s + arrow(140, 62, 40) + buckets
          + '<text class="cv-lab" x="14" y="120" fill="'+DIM+'">LIGNES BRUTES</text>'
          + '<text class="cv-lab" x="196" y="112" fill="'+A+'">3 GROUPES</text>')
      };
    },

    having: function(){
      var cols = ['#7A6FF0','#0E9E7E','#E08A2B'], n = [4,1,3];
      var s = cols.map(function(c,i){
        var x = 30 + i*54, ko = n[i] < 2;
        return '<g data-anim="drop" style="animation-delay:'+(.1*i)+'s"'+(ko?' opacity=".35"':'')+'>'
          + '<rect x="'+x+'" y="26" width="40" height="62" rx="12" fill="'+c+'" opacity=".16"/>'
          + '<rect x="'+x+'" y="26" width="40" height="62" rx="12" fill="none" stroke="'+c+'"/>'
          + '<text class="cv-mono" x="'+(x+15)+'" y="63" font-size="15" fill="'+c+'">'+n[i]+'</text>'
          + (ko?'<line x1="'+x+'" y1="26" x2="'+(x+40)+'" y2="88" stroke="'+'#C8364F'+'" stroke-width="2" stroke-linecap="round"/>':'')
          + '</g>';
      }).join('');
      return {
        kw:'HAVING', say:'Filtrer les groupes, pas les lignes',
        cap:'<b>WHERE</b> filtre avant le regroupement. <b>HAVING</b> filtre les groupes déjà formés.',
        svg: svg(s + arrow(200, 58, 30)
          + '<g data-anim="fade" style="animation-delay:.6s"><rect x="240" y="44" width="70" height="26" rx="9" fill="'+A+'"/>'
          + '<text class="cv-mono" x="248" y="61" fill="#fff">COUNT ≥ 2</text></g>'
          + '<text class="cv-lab" x="30" y="106" fill="'+DIM+'">GROUPES</text>', 118)
      };
    },

    join: function(opt){
      opt = opt || {};
      var l = tbl({ x:4, y:16, head:['id','nom'], colWs:[28,62],
        data:[['1','Sophie'],['2','Lucas'],['3','Emma']] });
      var r = tbl({ x:192, y:16, head:['client_id','produit'], colWs:[62,62],
        data:[['1','Clavier'],['1','Souris'],['2','Écran']] });
      var links = [[16+19+9, 16+19+9],[16+19+9, 16+19+28],[16+19+28, 16+19+47]];
      var paths = links.map(function(p,i){
        var y1 = p[0], y2 = p[1];
        return '<path d="M96 '+y1+' C 146 '+y1+', 146 '+y2+', 190 '+y2+'" fill="none" stroke="'+A+'" '
          + 'stroke-width="2" stroke-linecap="round" opacity=".75" data-anim="dash" '
          + 'style="--cv-len:120;animation-delay:'+(.3+i*.22)+'s"/>';
      }).join('');
      var miss = opt.left
        ? '<g data-anim="pop" style="animation-delay:1.1s"><rect x="112" y="'+(16+19+47)+'" width="52" height="20" rx="7" fill="'+WARNS+'"/>'
          + '<text class="cv-mono" x="122" y="'+(16+19+61)+'" fill="'+WARN+'">NULL</text></g>'
        : '';
      return {
        kw: opt.kw || 'JOIN',
        say: opt.left ? 'Garder toutes les lignes de gauche' : 'Relier deux tables par une colonne',
        cap: opt.left
          ? 'Une ligne de gauche sans correspondance reste affichée — avec des <b>NULL</b> à droite.'
          : 'La condition <b>ON</b> dit quelle colonne pointe vers l’autre. Une ligne par correspondance.',
        svg: svg(l.s + paths + r.s + miss
          + '<text class="cv-lab" x="'+(opt.left?100:112)+'" y="'+(opt.left?122:100)+'" fill="'+A+'">ON id = client_id</text>',
          opt.left ? 130 : 118)
      };
    },

    write: function(kind){
      var isDel = kind === 'delete', isUp = kind === 'update';
      var t = tbl({ x:66, y:16, head:['id','nom'], colW:92,
        data:[['1','Sophie'],['2','Lucas'],['3', isUp ? 'Emma L.' : 'Emma']],
        dimRows: isDel ? [1] : [] });
      var mark = isDel
        ? '<line x1="70" y1="'+(16+19+28)+'" x2="248" y2="'+(16+19+28)+'" stroke="#C8364F" stroke-width="2" data-anim="fade" style="animation-delay:.5s"/>'
        : isUp
          ? '<rect x="66" y="'+(16+19+38)+'" width="184" height="19" fill="'+A+'" opacity=".12" data-anim="pulse"/>'
          : '<g data-anim="drop" style="animation-delay:.5s"><rect x="66" y="'+(16+19+57)+'" width="184" height="20" rx="7" fill="'+OKS+'"/>'
            + '<text class="cv-mono" x="76" y="'+(16+19+71)+'" fill="'+OK+'">4   Adam</text></g>';
      return {
        kw: isDel ? 'DELETE' : isUp ? 'UPDATE' : 'INSERT',
        say: isDel ? 'Retirer des lignes' : isUp ? 'Modifier des lignes' : 'Ajouter une ligne',
        cap: isDel || isUp
          ? 'Sans <b>WHERE</b>, l’opération touche <b>toute la table</b>. C’est l’erreur classique.'
          : 'Les valeurs suivent l’ordre des colonnes déclarées.',
        svg: svg(t.s + mark, 118)
      };
    },

    table: function(){
      var t = tbl({ x:62, y:14, head:['id','nom','ville'], colW:64,
        data:[['1','Sophie','Paris'],['2','Lucas','Lyon'],['3','Emma','Paris']] });
      return {
        kw:'TABLE', say:'Des lignes, des colonnes',
        cap:'Une table, c’est une grille : chaque <b>ligne</b> est un enregistrement, chaque <b>colonne</b> une information.',
        svg: svg('<g data-anim="fade" style="animation-delay:.35s">'
          + '<path d="M62 12 v-6 h194 v6" fill="none" stroke="'+A+'" stroke-width="1.4" opacity=".55"/>'
          + '<text class="cv-lab" x="126" y="-2" fill="'+A+'">3 COLONNES</text></g>'
          + t.s
          + '<g data-anim="fade" style="animation-delay:.5s">'
          + '<path d="M56 34 h-8 v58 h8" fill="none" stroke="'+A+'" stroke-width="1.4" opacity=".55"/>'
          + '<text class="cv-lab" x="0" y="66" fill="'+A+'">3 LIGNES</text></g>', 104)
      };
    },

    branch: function(isCoalesce){
      var src = ['199','25','9'];
      var s2 = src.map(function(v,i){ return chip(10, 20+i*30, 46, v, '#EFEEF7', '#4A4A57', .06*i); }).join('');
      var dia = '<g data-anim="fade" style="animation-delay:.35s">'
        + '<path d="M120 62 L152 34 L184 62 L152 90 Z" fill="'+A+'" opacity=".12"/>'
        + '<path d="M120 62 L152 34 L184 62 L152 90 Z" fill="none" stroke="'+A+'" stroke-width="1.6"/>'
        + '<text class="cv-lab" x="132" y="66" fill="'+A+'">'+(isCoalesce?'NULL ?':'WHEN')+'</text></g>';
      var out = '<g data-anim="pop" style="animation-delay:.7s">'
        + '<rect x="212" y="26" width="96" height="24" rx="8" fill="'+OKS+'"/>'
        + '<text class="cv-mono" x="222" y="42" fill="'+OK+'">'+(isCoalesce?'valeur':'« cher »')+'</text></g>'
        + '<g data-anim="pop" style="animation-delay:.9s">'
        + '<rect x="212" y="72" width="96" height="24" rx="8" fill="'+WARNS+'"/>'
        + '<text class="cv-mono" x="222" y="88" fill="'+WARN+'">'+(isCoalesce?'0 par défaut':'« abordable »')+'</text></g>';
      return {
        kw: isCoalesce ? 'COALESCE' : 'CASE',
        say: isCoalesce ? 'Remplacer les valeurs manquantes' : 'Une colonne qui dépend d’une condition',
        cap: isCoalesce
          ? 'Si la valeur est <b>NULL</b>, SQL prend la suivante que tu proposes.'
          : 'Chaque ligne est testée : la première condition vraie donne la valeur affichée.',
        svg: svg(s2 + dia + out, 118)
      };
    },

    generic: function(kw){
      var t = tbl({ x:26, y:56, head:['nom','ville'], colW:74,
        data:[['Sophie','Paris'],['Lucas','Lyon']] });
      var code = (String(kw||'').match(/^[A-Z\s*]{2,12}$/) ? kw : 'SELECT');
      return {
        kw: kw || 'SQL', say:'Poser une question à la base',
        cap:'Tu écris une question, la base répond par un <b>tableau de lignes</b>.',
        svg: svg('<g data-anim="slide"><rect x="20" y="10" width="186" height="34" rx="11" fill="#1A1A28"/>'
          + '<text class="cv-mono" x="32" y="31" fill="#B79CFF">'+esc(code)+'</text>'
          + '<text class="cv-mono" x="'+(38+code.length*6)+'" y="31" fill="#E9E9F2">…</text>'
          + '<rect x="192" y="19" width="2" height="16" fill="#E9E9F2" data-anim="blink"/></g>'
          + arrow(216, 27, 26) + t.s, 118)
      };
    }
  };

  /* ---------- choix de la scène selon la leçon ---------- */
  function pickScene(title){
    var t = (title || '').toUpperCase();
    var m = [
      [/LEFT\s*JOIN|SANS CORRESPONDANCE/,      function(){ return SCENES.join({ left:true, kw:'LEFT JOIN' }); }],
      [/RIGHT|FULL/,                            function(){ return SCENES.join({ left:true, kw:'RIGHT · FULL' }); }],
      [/JOIN|RELIER|PLUSIEURS TABLES|CL[ÉE]\s+(PRIMAIRE|[ÉE]TRANG)/,
        function(){ return SCENES.join({ kw: t.indexOf('INNER')>=0 ? 'INNER JOIN' : 'JOIN' }); }],
      [/GROUP\s*BY|REGROUP/,                    SCENES.groupby],
      [/HAVING/,                                SCENES.having],
      [/COUNT|SUM|AVG|MIN|MAX|MOYENNE|AGR[ÉE]G/, SCENES.agg],
      [/DISTINCT|DOUBLON/,                      SCENES.distinct],
      [/LIMIT|TOP\b/,                           SCENES.limit],
      [/ORDER\s*BY|TRIER|TRI\b/,                SCENES.orderby],
      [/COALESCE/,                              function(){ return SCENES.branch(true); }],
      [/CASE|CONDITIONNEL/,                     function(){ return SCENES.branch(false); }],
      [/WHERE|FILTR|COMPAR|SEUIL|AND\b|OR\b|NOT\b|LIKE|BETWEEN|IN\b|NULL/, SCENES.where],
      [/INSERT|AJOUT/,                          function(){ return SCENES.write('insert'); }],
      [/UPDATE|MODIFI/,                         function(){ return SCENES.write('update'); }],
      [/DELETE|SUPPRIM/,                        function(){ return SCENES.write('delete'); }],
      [/SELECT|COLONNE|AS\b|ALIAS/,             SCENES.select],
      [/TABLE|BASE|DONN[ÉE]ES|AVANT DE COMMENCER|LIGNE|COLONNE/, SCENES.table]
    ];
    for (var i = 0; i < m.length; i++) if (m[i][0].test(t)) { try { return m[i][1](); } catch(e){} }
    return SCENES.generic(title);
  }

  /* ---------- icônes de section ---------- */
  var I = {
    situation:'<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/><path d="M9 21h6"/>',
    probleme:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.8 12.2 8.7-8.7"/><path d="m16.5 6.5 2 2"/>',
    pourquoi:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    teste:'<path d="M8 5.5v13l11-6.5z"/>',
    anat:'<path d="M12 3 5 12l7 9 7-9z"/>',
    piege:'<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    reflexe:'<path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>'
  };
  function ico(tone){
    return '<span class="cv-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (I[tone] || I.probleme) + '</svg></span>';
  }
  function toneVars(tone){
    return '--cv-c:var(--cv-'+tone+');--cv-s:var(--cv-'+tone+'-soft);--cv-l:var(--cv-'+tone+'-line);';
  }
  function toneFromText(txt){
    var t = (txt || '').toLowerCase();
    if (/situation/.test(t)) return 'situation';
    if (/pourquoi|se passe|suis ce/.test(t)) return 'pourquoi';
    if (/teste|essaie|essaye/.test(t)) return 'teste';
    if (/expliqu|anatomie|requ[êe]te expliqu/.test(t)) return 'anat';
    if (/erreur|pi[èe]ge/.test(t)) return 'piege';
    if (/r[ée]flexe|retenir|m[ée]mo/.test(t)) return 'reflexe';
    return 'probleme';
  }

  /* ---------- décoration d'une leçon ---------- */
  var lastKey = '';

  function decorate(){
    var rich = document.querySelector('#lesson-body .lesson-rich');
    if (!rich) { lastKey = ''; return; }
    var h1 = rich.querySelector('h1');
    var key = (h1 ? h1.textContent : '') + '|' + rich.children.length;
    if (rich.getAttribute('data-cv-key') === key) return;
    rich.setAttribute('data-cv-key', key);
    lastKey = key;

    /* — 1. bandeau illustré — */
    if (h1 && !rich.querySelector('.cv-hero')) {
      var sc = pickScene(h1.textContent || '');
      var hero = document.createElement('div');
      hero.className = 'cv-hero';
      hero.innerHTML =
        '<div class="cv-hero-top"><span class="cv-hero-kw">' + esc(sc.kw) + '</span>'
        + '<span class="cv-hero-say">' + esc(sc.say) + '</span></div>'
        + sc.svg
        + '<p class="cv-hero-cap">' + sc.cap + '</p>';
      h1.insertAdjacentElement('afterend', hero);
    }

    /* — 2. sections colorées — */
    rich.querySelectorAll('.concept-block, .lesson-lead').forEach(function(b){
      if (b.hasAttribute('data-cv')) return;
      var eye = b.querySelector('.h2-eye');
      var txt = b.querySelector('.h2-txt');
      var tone = b.classList.contains('reflex-end') ? 'reflexe'
               : b.classList.contains('lesson-lead') ? 'situation'
               : toneFromText((eye ? eye.textContent : '') || (txt ? txt.textContent : ''));
      b.setAttribute('data-cv', tone);
      b.setAttribute('style', (b.getAttribute('style') || '') + toneVars(tone));
      if (eye && !eye.querySelector('.cv-ico')) eye.insertAdjacentHTML('afterbegin', ico(tone));
      else if (!eye && txt) {
        var h2 = txt.parentNode;
        var e = document.createElement('span');
        e.className = 'h2-eye';
        e.innerHTML = ico(tone) + (tone === 'reflexe' ? 'À retenir' : 'Point clé');
        h2.insertBefore(e, txt);
      }
    });

    rich.querySelectorAll('.piege').forEach(function(p){
      if (p.hasAttribute('data-cv')) return;
      p.setAttribute('data-cv', 'piege');
      p.setAttribute('style', (p.getAttribute('style') || '') + toneVars('piege'));
    });

    rich.querySelectorAll('.sect-label').forEach(function(sl){
      if (sl.hasAttribute('data-cv')) return;
      var tone = toneFromText(sl.textContent);
      sl.setAttribute('data-cv', tone);
      sl.setAttribute('style', (sl.getAttribute('style') || '') + toneVars(tone));
      var i = sl.querySelector('i');
      if (i && /^[\d◆✓•·]?$/.test((i.textContent || '').trim()))
        i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
          + 'stroke-linecap="round" stroke-linejoin="round">' + (I[tone] || I.probleme) + '</svg>';
    });

    /* — 3. coach mascotte sur « Le réflexe » — */
    var reflex = rich.querySelector('.reflex-end');
    if (reflex && !reflex.querySelector('.cv-coach')) {
      var note = reflex.querySelector('.memory-rule + p, p:last-of-type');
      var tip = note ? note.textContent.trim() : '';
      if (tip) {
        var coach = document.createElement('div');
        coach.className = 'cv-coach';
        coach.innerHTML = '<img src="assets/mascotte-requete.png" alt="" loading="lazy">'
          + '<p class="cv-coach-txt"><span class="cv-coach-lab">Le conseil</span>' + esc(tip) + '</p>';
        note.replaceWith(coach);
      }
    }

    /* — 4. mots-clés SQL repérables dans le texte — */
    rich.querySelectorAll('.concept-block p code, .situation-body code, .cv-hero-cap code').forEach(function(c){
      if (/^[A-Z][A-Z_ ]{1,14}$/.test((c.textContent || '').trim())) c.classList.add('cv-kw');
    });

    /* — 4bis. mini-tables : supprime la colonne fantôme — */
    rich.querySelectorAll('.mini-grid').forEach(function(g){
      if (g.hasAttribute('data-cv-fix')) return;
      g.setAttribute('data-cv-fix', '1');
      var rows = g.querySelectorAll(':scope > div');
      if (!rows.length) return;
      var n = rows[0].children.length;
      while (n > 1) {
        var empty = true;
        rows.forEach(function(r){
          var c = r.children[n - 1];
          if (c && (c.textContent || '').trim()) empty = false;
        });
        if (!empty) break;
        rows.forEach(function(r){ if (r.children[n - 1]) r.children[n - 1].remove(); });
        n--;
      }
      var tpl = n === 1 ? '1fr' : '34px' + ' 1fr'.repeat(n - 1);
      rows.forEach(function(r){ r.style.gridTemplateColumns = tpl; });
    });

    /* — 5. barre de lecture — */
    if (!rich.querySelector('.cv-read')) {
      var bar = document.createElement('div');
      bar.className = 'cv-read';
      bar.innerHTML = '<i></i>';
      rich.insertAdjacentElement('afterbegin', bar);
    }

    setupSpy(rich);
  }

  /* ---------- suivi de lecture + sommaire actif ---------- */
  var spyObs = null, spyScroll = null;

  function setupSpy(rich){
    var scr = document.getElementById('scr-lesson');
    if (!scr) return;
    if (spyObs) { spyObs.disconnect(); spyObs = null; }
    if (spyScroll) { scr.removeEventListener('scroll', spyScroll); spyScroll = null; }

    var fill = rich.querySelector('.cv-read i');
    var nav = (rich.parentNode && rich.parentNode.parentNode)
      ? rich.parentNode.parentNode.querySelector('.ls-nav') : null;
    var lastY = scr.scrollTop, acc = 0;
    spyScroll = function(){
      if (fill) {
        var max = scr.scrollHeight - scr.clientHeight;
        fill.style.width = (max > 40 ? Math.min(100, Math.max(0, scr.scrollTop / max * 100)) : 0) + '%';
      }
      if (nav) {
        var y = scr.scrollTop, d = y - lastY, bottom = scr.scrollHeight - scr.clientHeight - y;
        acc = (d > 0) === (acc > 0) ? acc + d : d;
        lastY = y;
        if (y < 120 || bottom < 260 || acc < -40) nav.classList.remove('cv-cta-hide');
        else if (acc > 90) nav.classList.add('cv-cta-hide');
      }
    };
    scr.addEventListener('scroll', spyScroll, { passive:true });
    spyScroll();

    var targets = rich.querySelectorAll('.som-target');
    if (!targets.length || typeof IntersectionObserver === 'undefined') return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
    spyObs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        var id = e.target.id;
        rich.querySelectorAll('.som-item').forEach(function(b){
          b.classList.toggle('cv-now', b.getAttribute('data-t') === id);
        });
        if (!reduce) {
          var host = e.target.closest('.concept-block') || e.target.parentNode;
          if (host && host.querySelectorAll) host.querySelectorAll('.cv-kw').forEach(function(k, i){
            if (k.dataset.cvLit) return;
            k.dataset.cvLit = '1';
            setTimeout(function(){ k.classList.add('cv-lit'); }, 90 * i);
          });
        }
      });
    }, { root: scr, rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    targets.forEach(function(t){ spyObs.observe(t); });
  }

  /* ---------- branchement ---------- */
  function boot(){
    var body = document.getElementById('lesson-body');
    if (!body) { setTimeout(boot, 300); return; }
    var t = null;
    new MutationObserver(function(){
      clearTimeout(t);
      t = setTimeout(decorate, 40);
    }).observe(body, { childList:true, subtree:true });
    decorate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
