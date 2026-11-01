function normCell(v){return typeof v==='number'?Math.round(v*1000)/1000:(typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)?Math.round(Number(v)*1000)/1000:v);}
// sql.js exec() drops column metadata when SELECT returns zero rows.
// Challenge validation still needs the expected number of columns in that case.
function execChallengeResult(database,sql){
  const statement=database.prepare(sql);
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

export {exerciseResultsMatch,execChallengeResult};
