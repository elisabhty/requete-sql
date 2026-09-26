/* Requête — comportements du système de design premium.

   1. Barre de titre compacte : sur chaque rubrique, quand le grand titre
      sort de l'écran, une barre en verre dépoli affiche le titre en petit
      (comme les apps iOS). Le bouton retour y reste accroché.
   2. Transitions de navigation : une sous-page (Défis, Console, Notes…)
      arrive par la droite, le retour la fait revenir par la gauche, un
      changement d'onglet se fait en fondu court.

   Rien ici ne modifie le contenu : on ajoute une barre décorative
   (aria-hidden) et des classes sur les écrans. */
(function(){
  'use strict';
  var SKIP={'scr-learn':1,'scr-lesson':1};
  var SUB={'scr-defis':1,'scr-console':1,'scr-notes':1,'scr-collection':1,'scr-entretien':1};
  var THRESHOLD=52;

  function titleOf(screen){
    var h=screen.querySelector('.lgtitle h1');
    return h?h.textContent.trim():'';
  }

  function ensureBar(screen){
    if(SKIP[screen.id])return null;
    var bar=screen.querySelector(':scope>.p-bar');
    if(bar)return bar;
    bar=document.createElement('div');
    bar.className='p-bar';
    bar.setAttribute('aria-hidden','true');
    bar.innerHTML='<span class="p-bar-title"></span>';
    screen.insertBefore(bar,screen.firstChild);
    return bar;
  }

  function update(screen){
    if(!screen||SKIP[screen.id])return;
    var bar=ensureBar(screen);
    var on=screen.scrollTop>THRESHOLD;
    if(on){
      var t=titleOf(screen);
      var span=bar.firstChild;
      if(span.textContent!==t)span.textContent=t;
    }
    if(screen.classList.contains('p-scrolled')!==on)screen.classList.toggle('p-scrolled',on);
  }

  var pending=null;
  document.addEventListener('scroll',function(e){
    var s=e.target;
    if(!s||!s.classList||!s.classList.contains('screen'))return;
    if(pending)return;
    pending=requestAnimationFrame(function(){pending=null;update(s);});
  },{capture:true,passive:true});

  /* Transitions : on observe l'écran actif plutôt que de toucher à
     switchTab, pour rester compatible avec tous les chemins de navigation. */
  var prev=null,backNext=false;
  window.pNavBack=function(){backNext=true;setTimeout(function(){backNext=false;},400);};
  function onActive(screen){
    if(!screen||screen===prev)return;
    var from=prev;prev=screen;
    if(!from||document.body.classList.contains('nav-restoring'))return;
    var kind='p-enter-fade';
    if(backNext||(SUB[from.id]&&!SUB[screen.id]))kind='p-enter-back';
    else if(SUB[screen.id])kind='p-enter-push';
    backNext=false;
    screen.classList.remove('p-enter-fade','p-enter-push','p-enter-back');
    void screen.offsetWidth;
    screen.classList.add(kind);
    setTimeout(function(){screen.classList.remove(kind);},420);
    update(screen);
  }
  function init(){
    var screens=document.querySelectorAll('.screen');
    screens.forEach(ensureBar);
    prev=document.querySelector('.screen.active');
    var mo=new MutationObserver(function(list){
      for(var i=0;i<list.length;i++){
        var t=list[i].target;
        if(t.classList.contains('active')&&t!==prev){onActive(t);return;}
      }
    });
    screens.forEach(function(s){mo.observe(s,{attributes:true,attributeFilter:['class']});});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
