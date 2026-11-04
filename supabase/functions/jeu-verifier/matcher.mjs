function normCell(v){return typeof v==='number'?Math.round(v*1000)/1000:(typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)?Math.round(Number(v)*1000)/1000:v);}
// sql.js exec() drops column metadata when SELECT returns zero rows.
// Challenge validation still needs the expected number of columns in that case.
function execChallengeResult(database,sql){
  /* La requête passe par sqlCompat, comme dans la console et sur le serveur : EXTRACT, ::, ILIKE, FETCH FIRST… (4 novembre). Sur le
     serveur, matcher.mjs ne connaît pas sqlCompat (typeof) : rien ne change, la requête y est déjà traduite par safeSelect. */
  const statement=database.prepare(typeof sqlCompat==='function'?sqlCompat(sql):sql);
  try{
    const columns=statement.getColumnNames(),values=[];
    while(statement.step())values.push(statement.get());
    return columns.length?[{columns,values}]:[];
  }finally{statement.free();}
}
function normalize(result,ordered){
  if(!result||result.length===0)return "∅";
  const rows=result[0].values.map(r=>JSON.stringify(r.map(normCell)));
  return JSON.stringify(ordered?rows:rows.slice().sort());
}
// Order matters only when the exercise explicitly asks for an ordered result.
const ORDERED_LESSONS=new Set([11,12,76,77,73,74,79,78]);
function exerciseRequiresOrder(lesson,isChallenge=false){
  return isChallenge?!!lesson.ordered:ORDERED_LESSONS.has(lesson.id);
}
function exerciseResultsMatch(actual,expected,lesson,isChallenge=false){
  if((actual||[]).length!==(expected||[]).length)return false;
  if(!isChallenge&&lesson.id===2){
    const labels=result=>JSON.stringify((result&&result[0]?result[0].columns:[]).map(c=>String(c).toLowerCase()));
    if(labels(actual)!==labels(expected))return false;
  }
  const ordered=exerciseRequiresOrder(lesson,isChallenge);
  return (expected||[]).every((result,i)=>isChallenge?memeResultatColonnesLibres(actual[i],result,ordered):normalize([actual[i]],ordered)===normalize([result],ordered));
}
/* Défis (Elisa, 1er novembre, 0 h 49 : « comment on va savoir qu’une requête est juste pour l’user car il peut renommer avec des
   alias etc ? […] pareil avec les jointures qui peuvent s’inverser » → « corrige ») : on compare déjà le résultat, jamais le texte
   (alias, noms de colonnes, ordre des jointures, LEFT JOIN ou NOT EXISTS n’y changent rien). Les colonnes peuvent maintenant
   venir dans n’importe quel ordre : SELECT nom, prenom vaut SELECT prenom, nom. On cherche un ordre des colonnes de l’utilisateur
   qui redonne exactement le résultat attendu (lignes triées ou non selon le défi) ; seules sont essayées les colonnes qui ont les
   mêmes valeurs qu’une colonne attendue. */
function memeResultatColonnesLibres(a,e,ordered){
  if(!a||!e||!a.columns||!e.columns||a.columns.length!==e.columns.length||a.values.length!==e.values.length)return false;
  if(normalize([a],ordered)===normalize([e],ordered))return true;
  const n=e&&e.columns?e.columns.length:0;
  if(!a||!a.columns||a.columns.length!==n||a.values.length!==e.values.length||n<2||n>10)return false;
  const sig=(r,j)=>JSON.stringify(r.values.map(l=>JSON.stringify(normCell(l[j]))).sort());
  const sa=a.columns.map((_,j)=>sig(a,j)),cand=e.columns.map((_,j)=>{const s=sig(e,j);return sa.map((x,i)=>x===s?i:-1).filter(i=>i>=0);});
  if(cand.some(c=>!c.length))return false;
  const cible=normalize([e],ordered),pris=new Array(n).fill(false),perm=[];
  const essai=j=>{
    if(j===n)return normalize([{columns:perm.map(i=>a.columns[i]),values:a.values.map(l=>perm.map(i=>l[i]))}],ordered)===cible;
    for(const i of cand[j])if(!pris[i]){pris[i]=true;perm.push(i);if(essai(j+1))return true;perm.pop();pris[i]=false;}
    return false;
  };
  return essai(0);
}
/* Tri des textes (4 novembre) : SQLite compare octet par octet, « SkyWings » passe avant « Skyline » et « de Vries » après « Zola ».
   Un joueur qui trie sans tenir compte des majuscules (LOWER(nom), nom COLLATE NOCASE) a aussi raison : quand l’ordre ne correspond
   pas, on compare aussi à la solution triée sans la casse (chaque clé du dernier ORDER BY suivie de COLLATE NOCASE). */
function solSansCasse(sol){
  const s=String(sol).replace(/;\s*$/,'');let d=0,q=null,pos=-1;
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(q){if(ch===q){if(s[i+1]===q){i++;continue;}q=null;}continue;}
    if(ch==="'"||ch==='"'){q=ch;continue;}
    if(ch==='(')d++;else if(ch===')')d--;
    else if(!d&&/^ORDER\s+BY\b/i.test(s.slice(i,i+12))&&!/\w/.test(s[i-1]||' '))pos=i;}
  if(pos<0)return null;
  const debut=pos+/^ORDER\s+BY/i.exec(s.slice(pos))[0].length;
  const lim=/\s+LIMIT\s+\d+(?:\s*(?:,|OFFSET)\s*\d+)?\s*$/i.exec(s.slice(debut)),fin=lim?debut+lim.index:s.length;
  const cles=[];let a=debut;d=0;q=null;
  for(let i=debut;i<=fin;i++){const ch=s[i];
    if(i<fin&&q){if(ch===q)q=null;continue;}
    if(i<fin&&(ch==="'"||ch==='"')){q=ch;continue;}
    if(ch==='(')d++;else if(ch===')')d--;
    if(i===fin||(ch===','&&!d)){cles.push(s.slice(a,i).trim());a=i+1;}}
  if(cles.some(k=>!k||/\bCOLLATE\b|\bNULLS\b/i.test(k)))return null;
  return s.slice(0,debut)+' '+cles.map(k=>{const m=/^([\s\S]*?)(\s+(?:ASC|DESC))?$/i.exec(k);return `${m[1]} COLLATE NOCASE${m[2]||''}`;}).join(', ')+s.slice(fin);
}
/* Le verdict d’un défi : le résultat de la solution, ou, pour un défi trié, celui de la solution triée sans la casse. */
function resultatsDefiEgaux(userRes,solRes,c,execSol){
  if(exerciseResultsMatch(userRes,solRes,c,true))return true;
  if(!c||!c.ordered||typeof execSol!=='function')return false;
  if(!exerciseResultsMatch(userRes,solRes,Object.assign({},c,{ordered:false}),true))return false;   // d’autres lignes : inutile d’aller plus loin
  const alt=solSansCasse(c.sol);if(!alt)return false;
  let r;try{r=execSol(alt);}catch(e){return false;}
  return JSON.stringify(r)!==JSON.stringify(solRes)&&exerciseResultsMatch(userRes,r,c,true);
}

export {exerciseResultsMatch,execChallengeResult,resultatsDefiEgaux};
