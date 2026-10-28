// Local checks of the exact return-to-consultation functions retained from GitHub.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/frontend/index/block-01.js','utf8');
const start=source.indexOf('        function checkoutInvoiceSnapshotV1()');
const end=source.indexOf('        async function saveMedicalRecordAndDirectCheckout()',start);
assert(start>=0&&end>start);
function setup(mode='ok'){
 const alerts=[],nodes={},storage=new Map();let cleared=0,restored=0,lookups=0;
 const node=id=>nodes[id]??=( {value:id==='invoiceOwnerSelect'?'owner':id==='invoiceDiscount'?'0':'',hidden:false,replaceChildren(){cleared++;}} );
 const visit={appointmentId:'visit',claimId:'claim'};
 const state={chiefComplaint:'original',prescriptions:[{custom_dose:'0.33 ml',quantity:.33}]};
 const ctx={JSON,Error,structuredClone,document:{getElementById:node,querySelectorAll:()=>[]},
 doctorScopeV51:()=>ctx.scope,scope:'clinic|doctor',doctorVisitV51:visit,clinicalInvoiceContext:{appointmentId:'visit'},
 clinicDjangoRpcV4:async()=>{lookups++;return {data:mode==='claim-lost'?false:true};},
 posRefreshV77:async()=>{if(mode==='network')throw Error('unconfirmed');if(mode==='scope-changed')ctx.scope='another-clinic';return {pending:mode==='pending'?[{appointment_id:'visit'}]:[],pharmacy_holds_v9133:mode==='pharmacy-hold'?[{appointment_id:'visit'}]:[]};},
 sessionStorage:{getItem:k=>storage.get(k)||null},posKeyV77:k=>k,familyHasAppointmentV74:()=>mode==='family',
 alert:s=>alerts.push(s),confirm:()=>mode!=='cancel-confirm',calculateInvoiceTotal:()=>{},
 restoreMedicalState:()=>{restored++;assert.deepEqual(JSON.parse(JSON.stringify(ctx.medicalStateCache)),state);},switchTab:t=>ctx.tab=t};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 ctx.checkoutReturnDraftV1={scope:ctx.scope,visit,petId:'pet',petName:'pet-name',microchip:'chip',weight:4.2,ownerId:'owner',birthday:'birthday',gender:'female',species:'cat',breed:'breed',state,weightConfirmation:null,vitalsDraft:null,invoiceSnapshot:ctx.checkoutInvoiceSnapshotV1()};
 if(mode==='direct'||mode==='stage')storage.set(mode==='direct'?'direct':'stage:visit','uncertain-original-request');
 if(mode==='cancel-confirm')ctx.checkoutReturnDraftV1.invoiceSnapshot='changed';
 return {ctx,alerts,get cleared(){return cleared},get restored(){return restored},get lookups(){return lookups}};
}
(async()=>{
 let x=setup();await x.ctx.returnMedicalFromCheckoutV1();assert.equal(x.ctx.tab,'medical');assert.equal(x.ctx.currentPetId,'pet');assert.equal(x.ctx.currentAppointmentId,'visit');assert.equal(x.ctx.doctorVisitV51.claimId,'claim');assert.equal(x.restored,1);assert.equal(x.ctx.checkoutReturnDraftV1,null);assert(x.cleared>0);
 for(const mode of ['direct','stage','family','claim-lost','pending','pharmacy-hold','network','cancel-confirm','scope-changed']){
  x=setup(mode);await x.ctx.returnMedicalFromCheckoutV1();assert.equal(x.cleared,0,mode);assert.equal(x.restored,0,mode);assert(x.ctx.checkoutReturnDraftV1,mode);assert.notEqual(x.ctx.tab,'medical',mode);
 }
 console.log('10 checkout-return scenarios passed: original visit/prescription restoration; uncertain direct/stage/family, claim loss, pending/pharmacy, network, cancellation and changed scope preserve billing state.');
})().catch(error=>{console.error(error);process.exitCode=1;});
