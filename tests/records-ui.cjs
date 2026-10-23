const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../assets/frontend/index/fastOwnerPetV908.js','utf8');
const helper=source.slice(source.indexOf('async function ownerConfirmedInsertV908('),source.indexOf('async function saveIntegratedOwnerAndPet('));
const payload={id:'pet-uuid',tenant_id:'A',owner_id:'owner',name:'Money'};
function setup(){
 const calls=[];let scope='A|u';
 const context={CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},ownerScopeV908:()=>scope,
  _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})},from:()=>{throw Error('Unexpected direct SDK write')}},
  fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({data:payload,tenant_id:'A',user_id:'u'})}}};
 vm.createContext(context);vm.runInContext(helper,context);
 return {context,calls,setScope:value=>scope=value};
}
(async()=>{
 let s=setup();let row=await s.context.ownerConfirmedInsertV908('pets',payload,'A|u');
 assert.equal(row.id,payload.id);assert.equal(s.calls[0].url,'/api/records/pets/');
 assert.deepEqual(JSON.parse(s.calls[0].options.body),payload);
 assert.equal(s.calls[0].options.headers.Authorization,'Bearer token');
 await s.context.ownerConfirmedInsertV908('pets',payload,'A|u');
 assert.equal(JSON.parse(s.calls[1].options.body).id,payload.id,'retry retains the same UUID');
 s=setup();s.context.fetch=async()=>({ok:false,json:async()=>({error:'invalid',code:'GB_RECORD_REJECTED'})});
 await assert.rejects(s.context.ownerConfirmedInsertV908('pets',payload,'A|u'),e=>e.code==='GB_RECORD_REJECTED');
 s=setup();s.context.fetch=async()=>({ok:true,json:async()=>({data:payload,tenant_id:'B',user_id:'u'})});
 await assert.rejects(s.context.ownerConfirmedInsertV908('pets',payload,'A|u'));
 s=setup();s.context.fetch=async()=>{s.setScope('B|u');return {ok:true,json:async()=>({data:payload,tenant_id:'A',user_id:'u'})}};
 await assert.rejects(s.context.ownerConfirmedInsertV908('pets',payload,'A|u'));
 const core=fs.readFileSync(__dirname+'/../assets/frontend/index/block-01.js','utf8');
 const quick=core.slice(core.indexOf('async function saveQuickNewPet('),core.indexOf('let medicalProductReturnContext'));
 assert(quick.includes("ownerConfirmedInsertV908('pets',pet"));assert(!quick.includes(".from('pets').insert"));
 console.log('Records UI: bearer route, stable UUID, rejected input, stale clinic and same-owner modal passed');
})().catch(e=>{console.error(e);process.exitCode=1});
