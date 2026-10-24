const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/frontend/index/multiDoctorV51.js'),'utf8');
const start=source.indexOf('const doctorOriginalEnsureVitalsV51=');
const end=source.indexOf('const doctorOriginalRenderV51=',start);
assert(start>=0&&end>start);
async function run(options,preflight=true,vitals=true,change=false){
 let checks=0;
 const ctx={doctorVisitV51:{petId:'p'},currentPetId:'p',doctorScopeV51:()=> 'A|u',verifyDoctorVisitV51:async()=>{checks++;return preflight;},ensureMedicalWeightForAction:async()=>{if(change)ctx.doctorVisitV51={petId:'p'};return vitals;}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 return {ok:await ctx.ensureMedicalWeightForAction(options),checks};
}
(async()=>{
 assert.deepEqual(await run({verifiedByMedicalSave:true}),{ok:true,checks:1});
 assert.deepEqual(await run(),{ok:true,checks:2});
 assert.deepEqual(await run({verifiedByMedicalSave:true},false),{ok:false,checks:1});
 assert.deepEqual(await run({verifiedByMedicalSave:true},true,false),{ok:false,checks:1});
 assert.deepEqual(await run({verifiedByMedicalSave:true},true,true,true),{ok:false,checks:1});
 const page=fs.readFileSync(path.join(root,'assets/frontend/index/block-01.js'),'utf8');
 const a=page.indexOf('async function saveMedicalRecordAndDirectCheckout()'),b=page.indexOf('function appointmentLocalInputValue',a),body=page.slice(a,b);
 assert(body.includes('ensureMedicalWeightForAction({verifiedByMedicalSave:true})'));
 assert(body.indexOf('ensureMedicalWeightForAction(')<body.indexOf("saveMedicalViaDjangoV5('checkout'"));
 assert(body.indexOf("saveMedicalViaDjangoV5('checkout'")<body.indexOf("switchTab('invoices')"));
 console.log('Checkout speed: one preflight only for Django save; other callers retain two; failures and changed claim block navigation.');
})().catch(e=>{console.error(e);process.exit(1)});
