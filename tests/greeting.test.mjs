import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
let hour=11;
const title={},subtitle={};
const ctx=vm.createContext({state:{name:''},Date:class{getHours(){return hour;}},document:{querySelector:()=>title,getElementById:()=>subtitle}});
vm.runInContext(html.slice(html.indexOf('function greetingForHour('),html.indexOf('function renderStartCta(')),ctx);
for(const [h,expected] of [[0,'Bonjour'],[11,'Bonjour'],[12,'Bon après-midi'],[17,'Bon après-midi'],[18,'Bonsoir'],[23,'Bonsoir']]){
 hour=h;ctx.state.name='';ctx.renderGreeting();
 assert.equal(title.textContent,expected);assert.equal(subtitle.textContent,'À toi de jouer.');assert.equal(subtitle.hidden,false);
 ctx.state.name=' Elisa ';ctx.renderGreeting();assert.equal(title.textContent,expected+', Elisa');assert.equal(subtitle.hidden,true);assert.equal(subtitle.textContent,'');
}
console.log('Salutations : seuils horaires et prénom cohérents, sans doublon.');
