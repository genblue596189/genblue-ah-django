
// Clear only the exact visit confirmed paid/completed; never another active patient.
function paidMedicalSnapshotV9117(){
 return {scope:doctorScopeV51(),tenant:CURRENT_TENANT_ID,petId:currentPetId,ownerId:currentOwnerId,
 appointmentId:currentAppointmentId||doctorVisitV51?.appointmentId||medicalProductReturnContext?.appointmentId||null,
 visit:doctorVisitV51};
}
function clearCompletedMedicalV9117(ctx){
 if(!ctx.petId||ctx.scope!==doctorScopeV51()||ctx.tenant!==CURRENT_TENANT_ID||ctx.petId!==currentPetId||ctx.ownerId!==currentOwnerId||ctx.visit!==doctorVisitV51)return false;
 const now=paidMedicalSnapshotV9117();if(ctx.appointmentId!==now.appointmentId)return false;
 if(doctorVisitV51?.petId===ctx.petId){clinicClaimsV51.delete(ctx.petId);doctorVisitV51=null;}
 currentAppointmentId=null;medicalViewBaselineV918=null;medicalProductReturnContext=null;
 for(const id of ['returnMedicalFromProducts','medicalProductContext']){const el=document.getElementById(id);if(el)el.hidden=true;}
 clearMedicalFormInputs();resetCurrentPetClinicalHistories();return true;
}
async function checkCompletedMedicalV9117(){
 const ctx=paidMedicalSnapshotV9117();if(!ctx.petId||!ctx.appointmentId)return;
 try{
  const {data,error}=await _supabase.from('appointments').select('id,status').eq('tenant_id',ctx.tenant).eq('pet_id',ctx.petId).eq('id',ctx.appointmentId).maybeSingle();
  if(!error&&data?.status==='已完成')clearCompletedMedicalV9117(ctx);
 }catch(error){console.warn('門診完成狀態尚未同步',error);}
}
const paidMedicalCommitOriginalV9117=commitInventoryCheckout;
commitInventoryCheckout=async function(details){
 const ctx=paidMedicalSnapshotV9117(),id=await paidMedicalCommitOriginalV9117.apply(this,arguments);
 if(id&&details.p_category==='門診'&&details.p_tenant_id===ctx.tenant&&details.p_pet_id===ctx.petId&&details.p_appointment_id&&details.p_appointment_id===ctx.appointmentId)clearCompletedMedicalV9117(ctx);
 return id;
};
const paidMedicalSwitchOriginalV9117=switchTab;
switchTab=function(tab,...args){
 const result=paidMedicalSwitchOriginalV9117.call(this,tab,...args);
 if(tab==='medical')void checkCompletedMedicalV9117();return result;
};
document.getElementById('genblueVersionV84').textContent=' · v91.17';
