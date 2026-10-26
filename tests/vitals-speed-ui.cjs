const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
async function check(kind,file){
 let value='4.2',writes=0,fail=false,release=null;
 const response=async()=>{writes++;if(release)await new Promise(r=>release(r));if(fail)return {error:Error('unconfirmed')};return {data:{id:'p',weight:Number(value),latest_temperature:Number(value),temperature_measured_at:'2026-10-26T01:00:00Z'}};};
 const query={update:()=>query,eq:()=>query,select:()=>query,single:response};
 const ctx={CURRENT_TENANT_ID:'A',CURRENT_USER:{id:'u'},currentPetId:'p',doctorVisitV51:{id:1},medicalWeightScope:()=> 'A|u|p',roundPetWeight:Number,allPetsListForDropdown:[],activeAppointmentsList:[],globalOwnersPetsData:[],medicalStateCache:{},renderAppointmentTable:()=>{},document:{getElementById:()=>({value,style:{}})},_supabase:{from:()=>query,rpc:()=>query}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/frontend/index',file),'utf8'),ctx);
 const save=()=>ctx['persistMedical'+kind]();
 await save();await save();assert.equal(writes,1,'unchanged confirmed value reuses success');
 value='5';await save();assert.equal(writes,2,'changed value writes');
 ctx.doctorVisitV51={id:2};await save();assert.equal(writes,3,'new consultation writes even same value');
 value='6';fail=true;await assert.rejects(save());await assert.rejects(save());assert.equal(writes,5,'failure never cached');
 value='5';fail=false;await save();assert.equal(writes,6,'uncertain change invalidates earlier success');
 value='7';let unblock;release=r=>{unblock=r;};const pending=save();const duplicate=save();await Promise.resolve();unblock();await Promise.all([pending,duplicate]);assert.equal(writes,7,'inflight duplicates share one write');
}
(async()=>{await check('Weight','medicalWeightV42.js');await check('Temperature','medicalTemperatureV43.js');console.log('Vitals: successful same-visit reuse, changed values/visits, failed writes and inflight deduplication passed.');})().catch(e=>{console.error(e);process.exit(1)});
