const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
const start=html.indexOf('        async function registerGlobalPetV73('),end=html.indexOf('        async function addGlobalSearchPetToWaiting',start);
const code=html.slice(start,end);
function setup(replies,confirm=true){
 let calls=[],confirmCount=0;
 const ctx={Map,Set,Error,JSON,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
 CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},globalSearchRequest:1,globalSearchScopeV73:'A|u',
 globalSearchMatches:new Map([['p',{id:'p',name:'money'}]]),globalWaitingSaveBusy:new Set(),globalRegistrationRequestsDjango:new Map(),globalSelectedPetsV73:new Set(['p']),
 globalSearchScopeNowV73:()=>ctx.CURRENT_TENANT_ID+'|u',globalCanRegisterV73:()=>true,appointmentsLoadRequest:0,activeAppointmentsList:[],
 document:{getElementById:id=>({value:id==='globalVisitPurposeV74'?'疫苗':'夜診'})},
 _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'t',user:{id:'u'}}},error:null})}},
 confirm:()=>{confirmCount++;return confirm},waitingPetFromAppointment:(pet,a)=>({...pet,appointment_id:a.id,status:a.status}),
 fetch:async(url,options)=>{calls.push({url,options});const r=replies.shift();if(r instanceof Error)throw r;return {status:r.status||200,ok:!r.status||r.status<400,json:async()=>r.body}}
 };
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,calls,get confirmCount(){return confirmCount;}};
}
const success={body:{kind:'added',user_id:'u',appointment:{id:'a',pet_id:'p',tenant_id:'A',status:'候診中'}}};
const early={status:409,body:{code:'early_check_in',appointment:{id:'a',scheduled_at:'2099-01-01T00:00:00Z'}}};
(async()=>{
 let s=setup([success]);let result=await s.ctx.registerGlobalPetV73('p',1,'A|u');
 assert.equal(result.kind,'added');assert.equal(s.calls.length,1);assert.equal(s.calls[0].options.method,'POST');
 assert.equal(JSON.parse(s.calls[0].options.body).purpose,'疫苗');assert.equal(JSON.parse(s.calls[0].options.body).session,'夜診');
 assert.equal(s.ctx.activeAppointmentsList.length,1);assert.equal(s.ctx.globalWaitingSaveBusy.size,0);
 s=setup([early,success]);await s.ctx.registerGlobalPetV73('p',1,'A|u');assert.equal(s.confirmCount,1);assert.equal(s.calls.length,2);
 const first=JSON.parse(s.calls[0].options.body),second=JSON.parse(s.calls[1].options.body);assert.equal(first.request_id,second.request_id);assert.equal(second.confirm_early.id,'a');
 s=setup([early],false);result=await s.ctx.registerGlobalPetV73('p',1,'A|u');assert.equal(result.kind,'skipped');assert.equal(s.calls.length,1);assert.equal(s.ctx.activeAppointmentsList.length,0);
 s=setup([new Error('network failed'),success]);await assert.rejects(s.ctx.registerGlobalPetV73('p',1,'A|u'));assert.equal(s.ctx.globalRegistrationRequestsDjango.size,1);
 await s.ctx.registerGlobalPetV73('p',1,'A|u');assert.equal(JSON.parse(s.calls[0].options.body).request_id,JSON.parse(s.calls[1].options.body).request_id);
 s=setup([success]);s.ctx.CURRENT_TENANT_ID='B';await assert.rejects(s.ctx.registerGlobalPetV73('p',1,'A|u'));assert.equal(s.calls.length,0);
 s=setup([{body:{...success.body,appointment:{...success.body.appointment,tenant_id:'B'}}}]);await assert.rejects(s.ctx.registerGlobalPetV73('p',1,'A|u'));assert.equal(s.ctx.activeAppointmentsList.length,0);
 assert(!code.includes(".from('appointments')"));
 console.log('Registration UI checks passed: single POST, early confirmation/cancel, stable retry ID, changed clinic, wrong-tenant rejection, busy cleanup.');
})().catch(e=>{console.error(e);process.exit(1)});
