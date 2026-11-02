import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../safari-surface.js',import.meta.url),'utf8');
const safari='Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Version/26.5 Mobile/15E148 Safari/604.1';
function browser({ua=safari,standalone=false,native=false,orientation=0,touchPoints=5}={}){
  const classes=new Set(),properties=new Map(),events={},frames=[];
  const root={style:{setProperty:(k,v)=>properties.set(k,v)},classList:{add:k=>classes.add(k)}};
  const meta={content:'#F4F2FC'};
  let top='#6E50F6',mutation;
  const context={navigator:{userAgent:ua,maxTouchPoints:touchPoints},screen:{width:402,height:874,orientation:{angle:orientation}},innerWidth:402,innerHeight:714,
    document:{documentElement:root,body:{},querySelector:()=>meta,addEventListener(){}},
    getComputedStyle:()=>({getPropertyValue:()=>top}),matchMedia:()=>({matches:standalone}),
    MutationObserver:class{constructor(cb){mutation=cb}observe(){}},
    requestAnimationFrame:cb=>(frames.push(cb),frames.length),addEventListener:(k,cb)=>events[k]=cb,
    Capacitor:{isNativePlatform:()=>native}};
  context.window=context;vm.runInNewContext(source,context);
  return {context,classes,properties,root,meta,events,mutation:()=>mutation([{type:'attributes',target:{matches:()=>true}}]),color:c=>top=c,flush:()=>{while(frames.length)frames.shift()()}};
}
test('Safari iPhone : le décor couvre la hauteur physique, même avec les commandes du navigateur ouvertes',()=>{
  const b=browser();assert(b.classes.has('safari-glass'));assert.equal(b.properties.get('--browser-canvas-height'),'874px');
  assert.equal(b.meta.content,'#6E50F6');assert.equal(b.root.style.backgroundColor,'#6E50F6');
});
test('le clavier ne doit pas être confondu avec une rotation',()=>{
  const b=browser();b.context.innerHeight=300;b.events.resize();b.flush();assert.equal(b.properties.get('--browser-canvas-height'),'874px');
  b.context.screen.orientation.angle=90;b.context.innerWidth=874;b.context.innerHeight=300;b.events.orientationchange();b.flush();assert.equal(b.properties.get('--browser-canvas-height'),'402px');
});
test('le retour à un écran clair rétablit la couleur racine et theme-color',()=>{
  const b=browser();b.color('#F4F2FC');b.mutation();b.flush();assert.equal(b.meta.content,'#F4F2FC');assert.equal(b.root.style.backgroundColor,'#F4F2FC');
});
test('le traitement Safari ne modifie ni le mode installé, ni Capacitor, ni les autres navigateurs',()=>{
  for(const options of [{standalone:true},{native:true},{ua:safari.replace('Version/26.5','Version/18.5')},{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/26.5 Safari/605.1.15',touchPoints:0},{ua:safari.replace('Version/26.5','CriOS/140.0')}]){
    const b=browser(options);assert(!b.classes.has('safari-glass'));assert.equal(b.properties.size,0);
  }
});
