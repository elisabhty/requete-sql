/* Le CSS choisit les couleurs selon la surface réellement présente. Un seul
   point met à jour les navigateurs avec theme-color et l'app Capacitor. */
(()=>{
  const root=document.documentElement;
  const meta=document.querySelector('meta[name="theme-color"]');
  const surfaces='.screen,#onboarding,#loader,.lv,.mu,.lst,.viz,.imp-sheet';
  let frame=0,lastNative='';
  function sync(){
    frame=0;
    const css=getComputedStyle(root),color=css.getPropertyValue('--browser-top').trim();
    if(!color)return;
    if(meta&&meta.content!==color)meta.content=color;
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
  addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  sync();
})();
