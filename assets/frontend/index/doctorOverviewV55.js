
function doctorCardTextV55(pet){
 const claim=clinicClaimsV51.get(pet.id),active=claim&&claim.appointment_id===pet.appointment_id?claim:null;
 if(active)return '接診醫師：'+(active.clinician_name||clinicDoctorsV51.find(d=>d.id===active.clinician_id)?.name||'待確認');
 const name=pet.doctor&&pet.doctor!=='不指定'?pet.doctor:clinicDoctorsV51.find(d=>d.id===pet.assigned_doctor_id)?.name;
 if(pet.status==='診間看診中')return '接診醫師：'+(name||'未確認，請更新資料');
 return name?'指定醫師：'+name:'尚未指定醫師';
}
const doctorOriginalChoicesV55=renderDoctorChoicesV51;
renderDoctorChoicesV51=function(){
 doctorOriginalChoicesV55();const filter=document.getElementById('clinicDoctorFilterV51');
 if(CURRENT_PROFILE?.role==='admin'){filter.replaceChildren(new Option('全院醫師（管理者）','all'));filter.value='all';filter.disabled=true;filter.title='管理者固定顯示全院候診與接診，不依醫師隱藏病患。';}
 else{filter.disabled=false;filter.removeAttribute('title');}
};
const doctorOriginalFilterV55=filterDoctorWaitingV51;
filterDoctorWaitingV51=function(rows){return CURRENT_PROFILE?.role==='admin'?rows:doctorOriginalFilterV55(rows);};
doctorWaitingLabelV51=function(pet){return escapeLabText(doctorCardTextV55(pet));};

