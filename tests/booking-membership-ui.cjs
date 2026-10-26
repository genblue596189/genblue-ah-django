// Run from the project root: node tests/booking-membership-ui.cjs
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('assets/frontend/booking/block-01.js','utf8').replace('updateBookingHoursV9127();load();','');
function setup(result,{fail=false,pet=''}={}){
 const elements=new Map(),widgets={},calls=[];
 class Element{
  constructor(){this.hidden=true;this.value='';this.checked=false;this.options=[];this.textContent='';}
  addEventListener(){} scrollIntoView(){} append(...options){this.options.push(...options);}
  replaceChildren(...options){this.options=options;this.value=options[0]?.value||'';}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};get('pet').value=pet;
 const context={URLSearchParams,Intl,Date,Number,Array,JSON,Promise,Error,AbortSignal,console,
  location:{origin:'https://clinic.test',search:'?clinic=genblue-ah'},navigator:{onLine:true},crypto:{randomUUID:()=> 'request-id'},
  setInterval(){},setTimeout,clearTimeout,Option:function(text,value){this.text=text;this.value=value;},
  document:{getElementById:get,addEventListener(){},createElement(){return {};},head:{append(){}}},
  liff:{init:async()=>{},isLoggedIn:()=>true,getIDToken:()=> 'line-id-token'},
  turnstile:{render:(selector,options)=>{widgets[selector]=options;return selector;},reset(){}},
  fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:!fail,json:async()=>fail?{error:'驗證失敗'}:result};}
 };context.window=context;context.GENBLUE_CONFIG={supabaseUrl:'https://db.test'};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,get,widgets,calls,run:code=>vm.runInContext(code,context)};
}
async function ready(t){await t.run("initializeBookingLineV1({liff_id:'liff',line_required:false})");t.context.bookingSiteKey='site';t.run('turnstileReady()');}
(async()=>{
 let t=setup({membership:'pending',pets:[{id:'unexpected',name:'should not display'}]});await ready(t);
 t.widgets['#captcha'].callback('submit-proof');await t.widgets['#member-captcha'].callback('member-proof');
 assert.equal(t.calls.length,1);assert.equal(t.calls[0].action,'identity');assert.equal(t.calls[0].token,'member-proof');
 assert.equal(t.run('token'),'submit-proof','identity must never consume the submission proof');
 assert.equal(t.get('member-pets-label').hidden,true);assert.equal(t.get('member-pets').options.length,0);
 assert.match(t.get('line-status').textContent,/首次使用請直接填寫/);
 await t.widgets['#member-captcha'].callback('duplicate');assert.equal(t.calls.length,1,'no duplicate automatic lookup');
 t=setup({membership:'verified',pets:[{id:'cat',name:'樂樂',species:'貓'}]});await ready(t);await t.widgets['#member-captcha'].callback('proof');
 assert.equal(t.get('member-pets-label').hidden,false);assert.equal(t.get('pet').value,'樂樂');assert.equal(t.run('bookingLineV1.petId'),'cat');
 t=setup({membership:'verified',pets:[{id:'cat',name:'樂樂',species:'貓'}]},{pet:'手動填寫'});await ready(t);await t.widgets['#member-captcha'].callback('proof');
 assert.equal(t.get('pet').value,'手動填寫','late lookup preserves typed data');assert.equal(t.run('bookingLineV1.petId'),null);
 t=setup({membership:'verified',pets:[{id:'a',name:'甲',species:'犬'},{id:'b',name:'乙',species:'貓'}]});await ready(t);await t.widgets['#member-captcha'].callback('proof');
 assert.equal(t.run('bookingLineV1.petId'),null);assert.equal(t.get('member-pets').options.length,3);
 t.get('member-pets').value='b';t.get('member-pets').onchange();assert.equal(t.get('pet').value,'乙');assert.equal(t.get('species').value,'貓');
 t=setup({membership:'verified',pets:[]});await ready(t);await t.widgets['#member-captcha'].callback('proof');assert.equal(t.get('member-pets-label').hidden,true);
 t=setup(null,{fail:true});await ready(t);await t.widgets['#member-captcha'].callback('bad');assert.equal(t.get('member-pets-label').hidden,true);assert.equal(t.get('member-retry').hidden,false);assert.match(t.get('line-status').textContent,/手動填寫/);
 assert.match(fs.readFileSync('assets/frontend/booking/style-01.css','utf8'),/\[hidden\]\{display:none!important\}/,'hidden labels must override label display styles');
 console.log('PASS booking membership: automatic lookup; separate verification proofs; pending/empty pets hidden; no duplicate lookup; single-pet selection; preserve typed data; multiple pets; safe failure');
})().catch(e=>{console.error(e);process.exit(1)});
