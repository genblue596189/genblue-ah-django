const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
const a=html.indexOf('        async function addSelectedGlobalPetsV73()'),b=html.indexOf('        // 一鍵資料備份',a);
const code=html.slice(a,b);
function setup(fail=false){
 const elements={globalSearchResultsStatus:{textContent:''},globalSearchInput:{value:'money',focus(){}},globalSearchOwnerInput:{value:'林'}};
 let called=[],closed=false;
 const ctx={Map,Set,Error,globalRegistrationBusyV73:false,globalSelectedPetsV73:new Set(['p1','p2']),
 globalSearchMatches:new Map([['p1',{id:'p1',name:'one',owner_id:'o'}],['p2',{id:'p2',name:'two',owner_id:'o'}]]),
 globalCanRegisterV73:()=>true,globalSearchScopeV73:'A|u',globalSearchScopeNowV73:()=> 'A|u',globalSearchRequest:1,
 globalOwnerIdV73:p=>p.owner_id,document:{getElementById:id=>elements[id]},alert:()=>{throw Error('unexpected alert')},
 setGlobalRegistrationBusyV73:value=>{ctx.globalRegistrationBusyV73=value},
 registerGlobalPetV73:async id=>{called.push(id);if(fail&&id==='p2')throw Error('network uncertain');return {kind:'added',name:id}},
 activeAppointmentsList:[],switchTab(){},renderAppointmentTable(){},renderGlobalSearchResultsV73(){},closeGlobalSearchResults(){closed=true;}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,elements,called,get closed(){return closed}};
}
(async()=>{
 let s=setup();await s.ctx.addSelectedGlobalPetsV73();assert.deepEqual(s.called,['p1','p2']);assert(s.closed);assert.equal(s.ctx.globalRegistrationBusyV73,false);
 s=setup(true);await s.ctx.addSelectedGlobalPetsV73();assert.deepEqual(s.called,['p1','p2']);assert(!s.closed);assert(s.elements.globalSearchResultsStatus.textContent.includes('未確認成功 1 隻'));assert(s.elements.globalSearchResultsStatus.textContent.includes('network uncertain'));assert.equal(s.ctx.globalRegistrationBusyV73,false);
 console.log('Same-owner batch checks passed: all-success cleanup and partial-failure feedback.');
})().catch(e=>{console.error(e);process.exit(1)});
