const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=require('./page-source.cjs')('index.html');
const source=html.slice(html.indexOf('let prescriptionMathRequest='),html.indexOf('        function resetPrescriptionEntryAfterAdd()'));
const elements={calculatedDoseResult:{},medPrescribeQty:{},medSelectDropdown:{value:'med'},medCustomRecDose:{value:'100'},medFrequencyDetail:{value:'2'},medDays:{value:'14'},prescriptionDoseUnitV91:{value:'IU/kg'}};
let timer,requests=[];
const context={document:{getElementById:id=>elements[id]},loadedMedicinesMap:{med:{id:'med'}},currentPetWeight:12.8,currentPetId:'pet1',CURRENT_TENANT_ID:'tenant1',
 prescriptionCalculationRouteV68:()=>({name:'皮下注射',kind:'injection',calc:'ratio'}),
 setTimeout:fn=>(timer=fn,1),clearTimeout:()=>{timer=null},
 _supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},
 fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))};
vm.createContext(context);vm.runInContext(source,context);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 context.runDetailedMathCalculation();assert.equal(elements.medPrescribeQty.value,'');
 timer();await tick();assert.equal(requests.length,1);
 elements.medCustomRecDose.value='200';context.runDetailedMathCalculation();timer();await tick();
 requests[1].resolve({ok:true,json:async()=>({quantity:'0.384',display:'new'})});await tick();
 assert.equal(elements.medPrescribeQty.value,'0.384');
 requests[0].resolve({ok:true,json:async()=>({quantity:'0.192',display:'old'})});await tick();
 assert.equal(elements.medPrescribeQty.value,'0.384','old response cannot overwrite current calculation');
 context.runDetailedMathCalculation();timer();await tick();context.currentPetId='pet2';
 requests[2].resolve({ok:true,json:async()=>({quantity:'999',display:'wrong patient'})});await tick();
 assert.equal(elements.medPrescribeQty.value,'','previous patient response is discarded');
 context.runDetailedMathCalculation();timer();await tick();
 requests[3].resolve({ok:false,json:async()=>({error:'not allowed'})});await tick();
 assert.equal(elements.medPrescribeQty.value,'');assert.equal(elements.calculatedDoseResult.value,'not allowed');
 assert(html.includes("if(prescriptionMathPending){alert("));
 console.log('Prescription UI: stale response, patient switch, errors and pending guard passed');
})().catch(e=>{console.error(e);process.exitCode=1});
