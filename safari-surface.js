/* Le CSS choisit les couleurs selon la surface réellement présente. Un seul
   point met à jour les navigateurs avec theme-color et l'app Capacitor. */
(()=>{
  const root=document.documentElement;
  const meta=document.querySelector('meta[name="theme-color"]');
  const surfaces='.screen,#onboarding,#loader,.lv,.mu,.lst,.viz,.imp-sheet';
  let frame=0,lastNative='',sampleFrame=0;
  let sample=null,sampleBottom=null;
  const version=Number(navigator.userAgent.match(/Version\/(\d+)/)?.[1]||0);
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const native=window.Capacitor?.isNativePlatform?.();
  const glass=ios&&version>=26&&/Safari\//.test(navigator.userAgent)&&!installed&&!native;
  function sizeCanvas(){
    if(!glass)return;
    // Le clavier peut rendre la zone visible plus large que haute :
    // son ouverture ne doit pas être prise pour une rotation de l'iPhone.
    const angle=screen.orientation?.angle??window.orientation;
    const landscape=typeof angle==='number'?Math.abs(angle)%180===90:screen.width>screen.height;
    const height=Math.max(innerHeight,landscape?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height));
    root.style.setProperty('--browser-canvas-height',height+'px');
    root.classList.add('safari-glass');
  }
  sizeCanvas();
  // Safari 26 teinte ses barres avec le fond (background-color) de l'élément
  // fixe qui touche le bord : en haut comme en bas. Sans repère en bas, c'est
  // le fond de l'écran plein (.lv, la couleur du HAUT de son dégradé) qui
  // était lu : une bande plus claire derrière la barre d'adresse.
  // https://1ar.io/updates/safari-26-liquid-glass-web/
  function makeSample(id){
    const el=document.createElement('div');
    el.id=id;
    el.setAttribute('aria-hidden','true');
    document.body.appendChild(el);
    return el;
  }
  if(glass){
    sample=makeSample('browser-status-sample');
    sampleBottom=makeSample('browser-bottom-sample');
  }
  function refreshSample(color,bottom){
    if(!sample)return;
    sample.style.backgroundColor=color;
    if(sampleBottom&&bottom)sampleBottom.style.backgroundColor=bottom;
    if(sampleFrame)cancelAnimationFrame(sampleFrame);
    sample.style.height='13px';
    if(sampleBottom)sampleBottom.style.height='13px';
    // Présenter la géométrie modifiée avant de revenir à la hauteur normale.
    // Ce changement est sans pixels visibles (fond limité à un texte vide).
    sampleFrame=requestAnimationFrame(()=>{
      sampleFrame=requestAnimationFrame(()=>{sample.style.height='12px';if(sampleBottom)sampleBottom.style.height='12px';sampleFrame=0;});
    });
  }
  function sync(){
    frame=0;
    const css=getComputedStyle(root),color=css.getPropertyValue('--browser-top').trim(),bottom=css.getPropertyValue('--browser-bottom').trim();
    if(!color)return;
    // La zone système du haut lit le fond racine. Écrire l'aplat résolu
    // évite de conserver la teinte du chargement lors d'un changement d'écran.
    if(glass&&root.style.backgroundColor!==color)root.style.backgroundColor=color;
    if(meta&&meta.content!==color)meta.content=color;
    refreshSample(color,bottom);
    const status=window.Capacitor?.Plugins?.StatusBar;
    if(!status)return;
    const rgb=color.startsWith('#')?color.slice(1).match(/\w\w/g)?.map(c=>parseInt(c,16)):color.match(/[\d.]+/g)?.slice(0,3).map(Number);
    if(!rgb||rgb.length!==3)return;
    const style=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)<150?'DARK':'LIGHT';
    if(style===lastNative)return;
    lastNative=style;
    try{Promise.resolve(status.setStyle({style})).catch(()=>{lastNative='';});}catch(e){lastNative='';}
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync);};
  window.rqSyncBrowserChrome=schedule;
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'?r.target.matches(surfaces):
      [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&n.matches(surfaces))))schedule();
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
  addEventListener('pageshow',schedule);
  addEventListener('resize',()=>{sizeCanvas();schedule();},{passive:true});
  addEventListener('orientationchange',()=>{sizeCanvas();schedule();},{passive:true});
  if(glass)document.addEventListener('pointerup',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  sync();
})();
