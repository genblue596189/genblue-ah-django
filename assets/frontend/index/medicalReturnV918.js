
let medicalReturnBusyV918=false,medicalViewBaselineV918=null;
function medicalReturnSnapshotV918(){
 const value=id=>document.getElementById(id)?.value||'';
 return JSON.stringify({diagnosis:value('medicalDiagnosis'),weight:value('medicalPetWeightInput'),temperature:value('medicalTemperatureInput'),
 rows:[...document.querySelectorAll('#prescriptionItemsContainer .prescription-item-row')].map(row=>[...row.querySelectorAll('input,select')].map(x=>x.value)),
 selected:value('medSelectDropdown'),dose:value('medSelectDropdown')?value('medCustomRecDose'):''});
}
const medicalStartOriginalV918=startDoctorConsultationV51;
startDoctorConsultationV51=async function(...args){
 const prior=doctorVisitV51,result=await medicalStartOriginalV918.apply(this,args);
 if(doctorVisitV51&&doctorVisitV51.petId===args[0]?.[0]&&(prior!==doctorVisitV51||!medicalViewBaselineV918))medicalViewBaselineV918={visit:doctorVisitV51,snapshot:medicalReturnSnapshotV918()};
 return result;
};
async function returnToWaitingWithoutSaveV75_4(){
 if(medicalSaveBusy||medicalReturnBusyV918){alert('病歷操作正在進行，請等完成後再返回。');return false;}
 const visit=doctorVisitV51,scope=doctorScopeV51();
 if(!currentPetId){switchTab('appointments');return true;}
 if(!visit||visit.scope!==scope||visit.petId!==currentPetId){alert('無法確認本次看診占用，請更新候診名單後確認；目前輸入保留。');return false;}
 const baseline=medicalViewBaselineV918;
 const changed=baseline?.visit===visit?baseline.snapshot!==medicalReturnSnapshotV918():!!document.getElementById('medicalDiagnosis').value.trim()||document.querySelectorAll('#prescriptionItemsContainer .prescription-item-row').length>0;
 if(changed&&!confirm('目前有未儲存的修改。確定不儲存並返回候診？本次未儲存的輸入將清空。'))return false;
 medicalReturnBusyV918=true;medicalSaveBusy=true;
 const valid=()=>scope===doctorScopeV51()&&doctorVisitV51===visit&&currentPetId===visit.petId;
 try{
  const transition=await medicalVisitRequestV6('waiting',visit.appointmentId,visit.petId);
  const response={data:transition.appointment,error:null};
  if(!valid())return false;if(response.error)throw response.error;if(response.data?.id!==visit.appointmentId)throw Error('未取得返回候診的確認');
  clinicClaimsV51.delete(visit.petId);doctorVisitV51=null;currentAppointmentId=null;medicalViewBaselineV918=null;
  const row=activeAppointmentsList.find(p=>p.appointment_id===visit.appointmentId);if(row)row.status='候診中';
  clearMedicalFormInputs();switchTab('appointments');renderAppointmentTable(activeAppointmentsList);
  try{await loadClinicDoctorsV51();await loadAppointments();}catch(error){clinicRefreshStatusV50('已返回候診；名單更新未完成，請按更新名單。',true);}
  return true;
 }catch(error){if(valid())alert('返回候診未完成：'+error.message+'。目前內容保留，請重試或更新名單確認。');return false;}
 finally{medicalReturnBusyV918=false;medicalSaveBusy=false;}
}
document.getElementById('genblueVersionV84').textContent=' · v91.11';
