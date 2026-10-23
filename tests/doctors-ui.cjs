const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
function extract(start,end){let a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a);return html.slice(a,b)}
const helper=extract('async function clinicDjangoRpcV4(', 'function doctorScopeV51()');
function bridge(){
 let calls=[];
 const ctx={Error,JSON,encodeURIComponent,CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},doctorScopeV51:()=>ctx.CURRENT_TENANT_ID+'|'+ctx.CURRENT_USER.id,
 _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'t',user:{id:'u'}}},error:null})}},
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({tenant_id:'A',user_id:'u',data:false})}}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);return {ctx,calls};
}
const startCode=extract('async function startDoctorConsultationV51(', 'startConsultationById=function');
function consultation(result){
 let opened=0,alerts=[];
 const ctx={Error,CURRENT_USER:{id:'u'},doctorScopeV51:()=> 'A|u',doctorOpeningV51:false,doctorVisitV51:null,currentPetId:null,
 activeAppointmentsList:[],clinicClaimsV51:new Map(),clinicDjangoRpcV4:async()=>({data:result,error:null}),
 loadClinicDoctorsV51:async()=>{},loadAppointments:async()=>{},alert:text=>alerts.push(text),
 doctorOriginalStartV51:async(...args)=>{opened++;ctx.currentPetId=args[0]},
 waitingPetFromAppointment:(pet,a)=>({...pet,appointment_id:a.id}),
 document:{getElementById:()=>({textContent:''})},switchTab(){},renderAppointmentTable(){}
 };
 vm.createContext(ctx);vm.runInContext(startCode,ctx);return {ctx,alerts,get opened(){return opened}};
}
const saveCode=extract('async function saveWaitingDoctorV54()', '\n\n</script>\n<script id="doctorOverviewV55">');
function assignment(result){
 let status='',rendered=0;
 const row={id:'p',appointment_id:'a',doctor:'old',assigned_doctor_id:'d0'};
 const state={scope:'A|u',appointmentId:'a',petId:'p',expectedId:'d0',expectedName:'old',saving:false};
 const elements={waitingDoctorSelectV54:{value:'d1'},waitingDoctorSaveV54:{disabled:false},waitingDoctorCloseV54:{disabled:false}};
 const ctx={Error,waitingDoctorV54:state,waitingDoctorValidV54:()=>true,
 document:{getElementById:id=>elements[id]},waitingDoctorStatusV54:text=>{status=text},
 clinicDjangoRpcV4:async()=>({data:result,error:null}),activeAppointmentsList:[row],renderAppointmentTable:()=>{rendered++}};
 vm.createContext(ctx);vm.runInContext(saveCode,ctx);return {ctx,row,state,get status(){return status},get rendered(){return rendered}};
}
(async()=>{
 let b=bridge();let r=await b.ctx.clinicDjangoRpcV4('verify_clinic_visit_v51',{p_pet_id:'p',p_claim_id:'c'});
 assert.equal(r.data,false);assert.equal(b.calls[0].options.headers.Authorization,'Bearer t');assert.equal(b.calls[0].options.method,'POST');
 b=bridge();b.ctx.fetch=async()=>({ok:true,json:async()=>({tenant_id:'B',user_id:'u',data:{}})});await assert.rejects(b.ctx.clinicDjangoRpcV4('clinic_doctor_state_v51'));
 b=bridge();b.ctx.fetch=async()=>{b.ctx.CURRENT_TENANT_ID='B';return {ok:true,json:async()=>({tenant_id:'A',user_id:'u',data:{}})}};await assert.rejects(b.ctx.clinicDjangoRpcV4('clinic_doctor_state_v51'));
 b=bridge();b.ctx.fetch=async()=>({ok:false,json:async()=>({error:'沒有權限'})});await assert.rejects(b.ctx.clinicDjangoRpcV4('release_clinic_visit_v51'),/沒有權限/);
 let c=consultation({ok:false,reason:'busy',name:'醫師乙'});await c.ctx.startDoctorConsultationV51(['p'],'a');assert.equal(c.opened,0);assert.equal(c.ctx.currentPetId,null);assert(c.alerts[0].includes('未開啟或清空'));assert.equal(c.ctx.doctorOpeningV51,false);
 c=consultation({ok:true,claim_id:'c',name:'醫師甲',appointment:{id:'a',pet_id:'p',status:'診間看診中'}});await c.ctx.startDoctorConsultationV51(['p'],'a');assert.equal(c.opened,1);assert.equal(c.ctx.doctorVisitV51.claimId,'c');assert.equal(c.ctx.doctorOpeningV51,false);
 let s=assignment({ok:false,reason:'conflict'});await s.ctx.saveWaitingDoctorV54();assert.equal(s.row.doctor,'old');assert(s.status.includes('沒有覆蓋'));assert.equal(s.state.saving,false);
 s=assignment({ok:true,appointment:{id:'a',pet_id:'p',status:'候診中',doctor:'醫師甲',assigned_doctor_id:'d1'}});await s.ctx.saveWaitingDoctorV54();assert.equal(s.row.assigned_doctor_id,'d1');assert.equal(s.rendered,1);assert.equal(s.state.saving,false);
 const names=['clinic_doctor_state_v51','verify_clinic_visit_v51','release_clinic_visit_v51','claim_clinic_visit_v51','waiting_doctor_state_v54','assign_waiting_doctor_v54'];
 for(const name of names)assert(!html.includes("_supabase.rpc('"+name+"'"));
 console.log('Doctor UI checks passed: bearer bridge, stale clinic, rejection, busy preserves form, successful claim, assignment conflict, successful assignment, all six RPC names migrated.');
})().catch(e=>{console.error(e);process.exit(1)});
