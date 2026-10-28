const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
function extract(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert(start>=0&&end>start);return html.slice(start,end)}
const helper=extract('        const medicalDjangoAttemptsV5=', '        const archiveOnlyAttempts=');
function setup(){
 let calls=[],uuid=0;
 const ctx={Error,JSON,Map,crypto:{randomUUID:()=> 'record-'+(++uuid)},CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},currentPetId:'p',
 doctorScopeV51:()=>ctx.CURRENT_TENANT_ID+'|u',doctorVisitV51:{scope:'A|u',petId:'p',claimId:'c',appointmentId:'a'},
 _supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'u'},access_token:'t'}},error:null})}},
 fetch:async(url,opts)=>{const payload=JSON.parse(opts.body);calls.push({url,opts,payload});return {ok:true,json:async()=>({tenant_id:'A',user_id:'u',data:{id:payload.request_id,pet_id:payload.pet_id,row_version:(payload.expected_version||0)+1}})}}};
 vm.createContext(ctx);vm.runInContext(helper,ctx);return {ctx,calls};
}
function failureContext(code){
 let cleared=0,alerts=[],updates=0;
 const ctx={Error,structuredClone,collectCurrentMedicalState:()=>{},doctorScopeV51:()=> 'A|u',doctorVisitV51:{claimId:'c',appointmentId:'a'},currentPetName:'pet',currentPetMicrochip:'',currentPetWeight:4,currentOwnerId:'o',currentPetBirthday:'',currentPetGender:'',currentPetSpecies:'',currentPetBreed:'',medicalStateCache:{},medicalWeightConfirmedV9121:null,medicalVitalsDraftV9132:null,medicalSaveBusy:false,ensureMedicalWeightForAction:async()=>true,medicalChiefComplaintWithTemperature:()=> '尚未儲存文字',currentPetId:'p',currentAppointmentId:'a',
 collectPrescriptionDetailsV75:()=>[{custom_dose:'0.33 ml',quantity:0.33}],prepareMedicationGroupsV64:()=>[],
 saveMedicalViaDjangoV5:async()=>{throw Error('server rejected')},
 alert:text=>alerts.push(text),clearMedicalFormInputs:()=>{cleared++},_supabase:{from:()=>{updates++;throw Error('unexpected write')}},
 document:{getElementById:()=>{throw Error('unexpected form change')}},switchTab:()=>{throw Error('unexpected navigation')}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,alerts,get cleared(){return cleared},get updates(){return updates}};
}
(async()=>{
 let s=setup();const rx=[{custom_dose:'0.5 mg/kg',quantity:'2.5'},{custom_dose:'0.33 ml',quantity:0.33,dispense_volume:'30 ml'}];
 await s.ctx.saveMedicalViaDjangoV5('waiting','原始病歷文字',rx);
 assert.equal(s.calls.length,1);assert.deepEqual(s.calls[0].payload.prescriptions,rx);assert.equal(s.calls[0].payload.chief,'原始病歷文字');assert.equal(s.calls[0].opts.headers.Authorization,'Bearer t');
 await s.ctx.saveMedicalViaDjangoV5('waiting','原始病歷文字',rx);assert.equal(s.calls[0].payload.request_id,s.calls[1].payload.request_id);
 await s.ctx.saveMedicalViaDjangoV5('waiting','新內容',rx);assert.equal(s.calls[1].payload.request_id,s.calls[2].payload.request_id);assert.match(s.calls[2].url,/revise/);assert.equal(s.calls[2].payload.expected_version,2);
 s=setup();const good=s.ctx.fetch;let once=true;s.ctx.fetch=async(...args)=>{if(once){once=false;throw Error('network uncertain')}return good(...args)};
 await assert.rejects(s.ctx.saveMedicalViaDjangoV5('checkout','文字',rx));await s.ctx.saveMedicalViaDjangoV5('checkout','文字',rx);assert.equal(s.calls[0].payload.request_id,'record-1');
 s=setup();s.ctx.fetch=async()=>({ok:true,json:async()=>({tenant_id:'B',user_id:'u',data:{id:'record-1',pet_id:'p'}})});await assert.rejects(s.ctx.saveMedicalViaDjangoV5('waiting','文字',[]));
 for(const [name,code] of [
 ['saveMedicalRecordAndBackToWaiting',extract('        async function saveMedicalRecordAndBackToWaiting()', '        async function saveMedicalRecordAndDirectCheckout()')],
 ['saveMedicalRecordAndDirectCheckout',extract('        async function saveMedicalRecordAndDirectCheckout()', '        function appointmentLocalInputValue(')]]){
  const f=failureContext(code);await f.ctx[name]();assert.equal(f.cleared,0);assert.equal(f.updates,0);assert(f.alerts[0].includes('保留畫面'));assert.equal(f.ctx.medicalSaveBusy,false);
 }
 assert(!html.includes("_supabase.from('medical_records').insert("));
 assert(!html.includes("_supabase.rpc('save_archive_medical_v53'"));
 console.log('Medical UI checks passed: unchanged doses/units, stable retry UUID, changed content revises same UUID with expected version, stale clinic rejected, failed save retains form and prevents navigation/state writes.');
})().catch(e=>{console.error(e);process.exit(1)});
