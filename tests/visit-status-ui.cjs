const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=require('./page-source.cjs')('index.html');
function extract(a,b,start=0){const x=html.indexOf(a,start),y=html.indexOf(b,x);assert(x>=0&&y>x);return html.slice(x,y)}
const saveCode=extract('        async function saveMedicalRecordAndBackToWaiting()', '        async function saveMedicalRecordAndDirectCheckout()');
function waiting(fail){
 let cleared=0,switched=0,alerts=[],calls=[];
 const ctx={Error,medicalSaveBusy:false,ensureMedicalWeightForAction:async()=>true,medicalChiefComplaintWithTemperature:()=> '文字',currentPetId:'p',currentAppointmentId:'a',
 doctorVisitV51:{petId:'p',appointmentId:'a'},clinicClaimsV51:new Map([['p',{}]]),medicalViewBaselineV918:{},activeAppointmentsList:[{id:'p',status:'診間看診中'}],
 collectPrescriptionDetailsV75:()=>[],saveMedicalViaDjangoV5:async()=>({id:'r'}),
 medicalVisitRequestV6:async(...args)=>{calls.push(args);if(fail)throw Error('狀態已變更');return {appointment:{id:'a',status:'候診中'}}},
 alert:text=>alerts.push(text),clearMedicalFormInputs:()=>{cleared++},switchTab:()=>{switched++},renderAppointmentTable(){}};
 vm.createContext(ctx);vm.runInContext(saveCode,ctx);return {ctx,calls,alerts,get cleared(){return cleared},get switched(){return switched}};
}
const returnCode=extract('async function returnToWaitingWithoutSaveV75_4(){', "document.getElementById('genblueVersionV84')", html.indexOf('<script id="medicalReturnV918">'));
function withoutSave(fail,cancel=false){
 let cleared=0,calls=0,alerts=[];
 const ctx={Error,medicalSaveBusy:false,medicalReturnBusyV918:false,currentPetId:'p',currentAppointmentId:'a',doctorScopeV51:()=> 'A|u',
 doctorVisitV51:{scope:'A|u',petId:'p',appointmentId:'a'},medicalViewBaselineV918:null,
 document:{getElementById:()=>({value:cancel?'未存內容':''}),querySelectorAll:()=>[]},confirm:()=>false,
 medicalVisitRequestV6:async()=>{calls++;if(fail)throw Error('權限失效');return {appointment:{id:'a',status:'候診中'}}},
 clinicClaimsV51:new Map([['p',{}]]),activeAppointmentsList:[{id:'p',appointment_id:'a',status:'診間看診中'}],
 clearMedicalFormInputs:()=>{cleared++},switchTab(){},renderAppointmentTable(){},loadClinicDoctorsV51:async()=>{},loadAppointments:async()=>{},clinicRefreshStatusV50(){},alert:text=>alerts.push(text)};
 vm.createContext(ctx);vm.runInContext(returnCode,ctx);return {ctx,alerts,get calls(){return calls},get cleared(){return cleared}};
}
(async()=>{
 let s=waiting(true);await s.ctx.saveMedicalRecordAndBackToWaiting();assert.equal(s.cleared,0);assert.equal(s.switched,0);assert(s.alerts[0].includes('病歷已儲存，但返回候診未成功'));assert.equal(s.ctx.doctorVisitV51.petId,'p');assert.equal(s.ctx.medicalSaveBusy,false);
 s=waiting(false);await s.ctx.saveMedicalRecordAndBackToWaiting();assert.equal(s.cleared,1);assert.equal(s.switched,1);assert.deepEqual(s.calls[0],['waiting','a','p','r']);assert.equal(s.ctx.doctorVisitV51,null);assert.equal(s.ctx.clinicClaimsV51.size,0);
 s=withoutSave(true);assert.equal(await s.ctx.returnToWaitingWithoutSaveV75_4(),false);assert.equal(s.cleared,0);assert(s.alerts[0].includes('目前內容保留'));assert.equal(s.ctx.medicalSaveBusy,false);
 s=withoutSave(false);assert.equal(await s.ctx.returnToWaitingWithoutSaveV75_4(),true);assert.equal(s.cleared,1);assert.equal(s.ctx.doctorVisitV51,null);
 s=withoutSave(false,true);assert.equal(await s.ctx.returnToWaitingWithoutSaveV75_4(),false);assert.equal(s.calls,0);assert.equal(s.cleared,0);
 assert(!saveCode.includes("_supabase.from('appointments')"));assert(!returnCode.includes("_supabase.from('appointments')"));
 const archive=extract('        async function saveMedicalRecordOnlyAndArchive()', '        let medicalSaveBusy');assert(!archive.includes("_supabase.from('appointments')"));assert(archive.includes("medicalVisitRequestV6('complete-archive'"));
 console.log('Visit UI checks passed: success clears after confirmation, failed transition preserves form and claim, unsaved cancellation sends nothing, selected visit paths no longer directly update appointments.');
})().catch(e=>{console.error(e);process.exit(1)});
