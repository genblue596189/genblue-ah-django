
var waitingDoctorV54=null,waitingDoctorRequestV54=0;
function waitingDoctorAllowedV54(){return CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_appointment??['staff','doctor'].includes(CURRENT_PROFILE?.role));}
function waitingDoctorActionV54(pet){return waitingDoctorAllowedV54()&&pet.status==='候診中'&&pet.appointment_id?`<button type="button" class="btn-secondary" style="padding:4px 8px;font-size:.8rem" onclick='openWaitingDoctorV54(${escapeLabText(JSON.stringify(pet.appointment_id))})'>${pet.assigned_doctor_id||pet.doctor?'更換醫師':'指定醫師'}</button>`:'';}
function waitingDoctorStatusV54(text,failed=false){const el=document.getElementById('waitingDoctorStatusV54');el.textContent=text;el.style.color=failed?'#b45309':'#047857';}
function waitingDoctorValidV54(state){return state===waitingDoctorV54&&state.scope===doctorScopeV51();}
function closeWaitingDoctorV54(){if(waitingDoctorV54?.saving)return;waitingDoctorRequestV54++;waitingDoctorV54=null;document.getElementById('waitingDoctorModalV54').style.display='none';}
async function openWaitingDoctorV54(appointmentId){
 if(!waitingDoctorAllowedV54())return;if(waitingDoctorV54?.saving)return;
 if(waitingDoctorV54?.appointmentId===appointmentId&&waitingDoctorValidV54(waitingDoctorV54)&&document.getElementById('waitingDoctorModalV54').style.display==='flex')return;
 const scope=doctorScopeV51(),request=++waitingDoctorRequestV54,row=activeAppointmentsList.find(p=>p.appointment_id===appointmentId);if(!scope||!row)return;
 // Open the blocking surface synchronously, before either network request.
 waitingDoctorV54={scope,appointmentId,petId:row.id,loading:true,saving:false};
 const loadingSelect=document.getElementById('waitingDoctorSelectV54');
 loadingSelect.replaceChildren(new Option('正在載入醫師名單…',''));loadingSelect.disabled=true;
 document.getElementById('waitingDoctorPatientV54').textContent=(row.name||'此寵物')+' · 飼主：'+(row.owner_name||'關聯飼主');
 document.getElementById('waitingDoctorSaveV54').disabled=true;
 document.getElementById('waitingDoctorCloseV54').disabled=false;
 waitingDoctorStatusV54('正在載入醫師與候診狀態，請稍候；可關閉後稍後再指定。');
 document.getElementById('waitingDoctorModalV54').style.display='flex';
 try{
  const [,response]=await Promise.all([loadClinicDoctorsV51(),clinicDjangoRpcV4('waiting_doctor_state_v54',{p_appointment_id:appointmentId})]);
  if(scope!==doctorScopeV51()||request!==waitingDoctorRequestV54)return;
  const {data,error}=response;if(error)throw error;
  const a=data?.appointment;if(!a||a.id!==appointmentId||a.pet_id!==row.id||a.status!=='候診中')throw Error('候診狀態不符，請按更新資料後確認。');
  waitingDoctorV54={scope,appointmentId,petId:row.id,expectedId:a.assigned_doctor_id??null,expectedName:a.doctor??null,loading:false,saving:false};
  const select=document.getElementById('waitingDoctorSelectV54');select.replaceChildren(new Option('暫不指定／由現場接診',''));
  for(const doctor of clinicDoctorsV51)select.append(new Option(doctor.name,doctor.id));
  if(a.assigned_doctor_id&&clinicDoctorsV51.some(d=>d.id===a.assigned_doctor_id))select.value=a.assigned_doctor_id;
  else if(a.assigned_doctor_id||a.doctor){const legacy=new Option((a.doctor||'原指定醫師')+'（保留原指定，或重新選擇）','keep');select.append(legacy);select.value='keep';}
  document.getElementById('waitingDoctorPatientV54').textContent=(row.name||'此寵物')+' · 飼主：'+(row.owner_name||'關聯飼主');
  waitingDoctorStatusV54('掛號／報到已完成。現在可依飼主意願指定醫師，或暫不指定。');document.getElementById('waitingDoctorSaveV54').disabled=false;select.disabled=false;document.getElementById('waitingDoctorCloseV54').disabled=false;document.getElementById('waitingDoctorModalV54').style.display='flex';
 }catch(e){if(scope===doctorScopeV51()&&request===waitingDoctorRequestV54){waitingDoctorStatusV54('醫師資料尚未確認：'+e.message+'。掛號／報到已保留，可關閉後從候診卡重新指定。',true);document.getElementById('waitingDoctorSaveV54').disabled=true;}}
}
async function saveWaitingDoctorV54(){
 const state=waitingDoctorV54;if(!state||state.loading||state.saving)return;if(!waitingDoctorValidV54(state)){waitingDoctorStatusV54('登入身分已變更，請重新開啟指定醫師。',true);return;}
 const select=document.getElementById('waitingDoctorSelectV54'),value=select.value;if(value==='keep'){closeWaitingDoctorV54();return;}
 state.saving=true;select.disabled=true;document.getElementById('waitingDoctorSaveV54').disabled=true;document.getElementById('waitingDoctorCloseV54').disabled=true;waitingDoctorStatusV54('正在儲存指定醫師…');
 try{
  const {data,error}=await clinicDjangoRpcV4('assign_waiting_doctor_v54',{p_appointment_id:state.appointmentId,p_doctor_id:value||null,p_expected_doctor_id:state.expectedId,p_expected_doctor:state.expectedName});if(error)throw error;if(!waitingDoctorValidV54(state))return;
  if(!data?.ok){if(data?.reason==='conflict')throw Error('另一位同事已更改指定醫師；這次沒有覆蓋。請關閉後重新開啟核對');throw Error('未確認指定醫師已儲存');}
  const a=data.appointment;if(a?.id!==state.appointmentId||a.pet_id!==state.petId||a.status!=='候診中')throw Error('未取得正確的候診儲存結果');
  state.expectedId=a.assigned_doctor_id??null;state.expectedName=a.doctor??null;
  const row=activeAppointmentsList.find(p=>p.appointment_id===state.appointmentId);if(row)Object.assign(row,{doctor:a.doctor||'',assigned_doctor_id:a.assigned_doctor_id||null});renderAppointmentTable(activeAppointmentsList);
  waitingDoctorStatusV54(a.assigned_doctor_id?'✓ 已指定：'+a.doctor:'✓ 已儲存：暫不指定醫師');
 }catch(e){if(waitingDoctorValidV54(state))waitingDoctorStatusV54('指定醫師未確認：'+e.message+'。掛號／報到仍保留。',true);}
 finally{state.saving=false;if(state===waitingDoctorV54){select.disabled=false;document.getElementById('waitingDoctorSaveV54').disabled=false;document.getElementById('waitingDoctorCloseV54').disabled=false;}}
}

