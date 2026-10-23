
async function queryDoctorDetailsV58(doctorId){
 if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可查閱醫師統計');return;}
 const select=document.getElementById('doctorStatsFilterV57');
 if(doctorId!==undefined){if(![...select.options].some(o=>o.value===doctorId)){alert('醫師清單已變更，請先查詢全院資料。');return;}select.value=doctorId;}
 document.getElementById('doctorStatsDetailPanelV58').open=true;
 await loadDoctorStatsV57(0);
}
var doctorStatsRequestV57=0,doctorStatsResultV57=null,doctorStatsOffsetV57=0,doctorCheckoutAttemptsV57=new Map();
function doctorStatsMoneyV57(n){return 'NT$ '+Number(n||0).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});}
function doctorStatsDateV57(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
function openDoctorStatsV57(){
 if(CURRENT_PROFILE?.role!=='admin')return;
 document.getElementById('doctorStatsDetailPanelV58').open=false;
 const start=document.getElementById('doctorStatsStartV57'),end=document.getElementById('doctorStatsEndV57');
 if(!end.value){end.value=doctorStatsDateV57(new Date());start.value=end.value.slice(0,8)+'01';}
 loadDoctorStatsV57(0);
}
function doctorStatsCellV57(row,text){const td=document.createElement('td');td.textContent=String(text??'—');row.append(td);return td;}
async function loadDoctorStatsV57(offset=0){
 if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可查閱醫師統計');return;}
 const start=document.getElementById('doctorStatsStartV57').value,end=document.getElementById('doctorStatsEndV57').value,select=document.getElementById('doctorStatsFilterV57'),filter=select.value||'all';
 const status=document.getElementById('doctorStatsStatusV57'),scope=doctorScopeV51(),request=++doctorStatsRequestV57;
 doctorStatsResultV57=null;document.getElementById('doctorStatsSummaryV57').replaceChildren();document.getElementById('doctorStatsDetailsV57').replaceChildren();document.getElementById('doctorStatsTotalsV57').textContent='';document.getElementById('doctorStatsPagingV57').textContent='';document.getElementById('doctorStatsPreviousV57').disabled=document.getElementById('doctorStatsNextV57').disabled=true;
 if(!start||!end||end<start||(Date.parse(end)-Date.parse(start))/86400000>365){status.textContent='請選擇 1 至 366 天的有效日期範圍。';return;}
 status.textContent='正在讀取完整統計…';
 try{
  const {data,error}=await _supabase.rpc('doctor_statistics_v57',{p_start:start,p_end:end,p_doctor:filter,p_offset:offset});if(error)throw error;
  if(request!==doctorStatsRequestV57||scope!==doctorScopeV51()||CURRENT_PROFILE?.role!=='admin')return;
  if(!Array.isArray(data?.summary)||!Array.isArray(data?.details))throw Error('統計資料格式不正確');
  doctorStatsResultV57=data;doctorStatsOffsetV57=offset;
  if(filter==='all'){const names=new Map(data.summary.filter(d=>d.doctor_id).map(d=>[d.doctor_id,d.doctor_name]));select.replaceChildren(new Option('全院醫師','all'));for(const [id,name] of names)select.append(new Option(name+'（'+id.slice(0,8)+'）',id));select.append(new Option('未歸屬／待核對','unassigned'));select.value='all';}
  let visits=0,invoices=0,gross=0,discount=0,net=0,voids=0;
  const detailDoctor=select.selectedOptions[0]?.textContent||'全院醫師';
  document.getElementById('doctorStatsDetailTitleV58').textContent='看診與帳單明細｜'+detailDoctor+'（點此展開／收合）';
  for(const d of data.summary){
   const tr=document.createElement('tr');doctorStatsCellV57(tr,d.doctor_name+(d.doctor_id?'（'+d.doctor_id.slice(0,8)+'）':''));for(const key of ['visit_count','invoice_count'])doctorStatsCellV57(tr,d[key]);for(const key of ['subtotal','discount','net'])doctorStatsCellV57(tr,doctorStatsMoneyV57(d[key]));doctorStatsCellV57(tr,d.void_count);
   const action=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='btn-secondary';button.style.cssText='padding:6px 10px;font-size:.82rem;white-space:nowrap';button.textContent=d.doctor_id?'查詢看診明細':'查詢未歸屬明細';button.addEventListener('click',()=>queryDoctorDetailsV58(d.doctor_id||'unassigned'));action.append(button);tr.append(action);
   document.getElementById('doctorStatsSummaryV57').append(tr);visits+=Number(d.visit_count);invoices+=Number(d.invoice_count);gross+=Number(d.subtotal);discount+=Number(d.discount);net+=Number(d.net);voids+=Number(d.void_count);
  }
  document.getElementById('doctorStatsTotalsV57').textContent='完成看診 '+visits+' 次　｜　有效帳單 '+invoices+' 筆　｜　折扣後門診結帳 '+doctorStatsMoneyV57(net)+'　｜　作廢 '+voids+' 筆';
  if(!data.summary.length){const tr=document.createElement('tr');const td=doctorStatsCellV57(tr,'此範圍沒有符合的醫師統計。');td.colSpan=8;document.getElementById('doctorStatsSummaryV57').append(tr);}
  for(const d of data.details){const tr=document.createElement('tr');doctorStatsCellV57(tr,new Date(d.event_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}));doctorStatsCellV57(tr,d.kind==='visit'?'完成看診':d.voided_at?'門診帳單（已作廢）':'門診帳單');doctorStatsCellV57(tr,d.doctor_name||'未歸屬／待核對');doctorStatsCellV57(tr,(d.owner_name||'未指定飼主')+'／'+(d.pet_name||'未指定寵物'));doctorStatsCellV57(tr,d.kind==='visit'?'—':doctorStatsMoneyV57(d.subtotal));doctorStatsCellV57(tr,d.kind==='visit'?'—':doctorStatsMoneyV57(d.discount));doctorStatsCellV57(tr,d.kind==='visit'?'—':d.voided_at?'不計入':doctorStatsMoneyV57(d.net));doctorStatsCellV57(tr,d.id+(d.void_reason?'；作廢原因：'+d.void_reason:''));document.getElementById('doctorStatsDetailsV57').append(tr);}
  document.getElementById('doctorStatsPagingV57').textContent=data.detail_count?'明細 '+(offset+1)+'–'+Math.min(offset+100,Number(data.detail_count))+'／'+data.detail_count+' 筆':'此範圍沒有明細';
  document.getElementById('doctorStatsPreviousV57').disabled=offset===0;document.getElementById('doctorStatsNextV57').disabled=offset+100>=Number(data.detail_count);
  status.textContent='✓ 統計已更新（台灣日期）；門診收入不含純商品零售。全院範圍內另有純商品零售 '+data.excluded_retail+' 筆。';
 }catch(e){if(scope===doctorScopeV51()&&request===doctorStatsRequestV57)status.textContent='無法讀取統計：'+(e.message||String(e))+'。請確認已執行 v57 醫師統計 SQL。';}
}
async function finishDoctorInvoiceV57(appointmentId){
 if(!appointmentId)return;
 if(currentAppointmentId===appointmentId)currentAppointmentId=null;
 activeAppointmentsList=activeAppointmentsList.filter(p=>p.appointment_id!==appointmentId);renderAppointmentTable(activeAppointmentsList);
 try{await loadAppointmentHistory('all');}catch(e){alert('帳單與完診已儲存；預約歷史畫面更新失敗，請按更新資料。');}
}
const inventoryCommitOriginalV57=commitInventoryCheckout;
commitInventoryCheckout=async function(details){
 if(details.p_category!=='門診')return inventoryCommitOriginalV57(details);
 if(inventoryCheckoutBusy)return null;inventoryCheckoutBusy=true;
 const scope=doctorScopeV51(),key=scope+'|'+(details.p_appointment_id||'manual:'+String(details.p_pet_id||'none'));
 let requestId=doctorCheckoutAttemptsV57.get(key);if(!requestId){requestId=crypto.randomUUID();doctorCheckoutAttemptsV57.set(key,requestId);}
 try{
  const {data,error}=await _supabase.rpc(details.p_medication_groups?'checkout_clinic_medicine_groups_v64':'checkout_clinic_doctor_v57',{...details,p_appointment_id:details.p_appointment_id||null,p_request_id:requestId});if(error)throw error;
  if(!data?.invoice_id)throw Error('未收到帳單儲存確認');
  if(scope!==doctorScopeV51())return null;
  if(data.voided)throw Error('這筆重試帳單已作廢，請先到財務管理核對，勿自動再收費');
  doctorCheckoutAttemptsV57.delete(key);
  const caches=await Promise.allSettled([loadItems(),loadMedicines()]);
  if(scope!==doctorScopeV51())return null;
  if(caches.some(r=>r.status==='rejected'))alert('結帳與完診已儲存，庫存畫面更新失敗；請按更新資料，勿重複結帳。');
  return data.invoice_id;
 }catch(e){if(scope===doctorScopeV51())alert('尚未確認門診結帳完成：'+(e.message||String(e))+'\n請保留本頁重試；同一請求不會重複建立帳單。不要重新建帳。');return null;}
 finally{inventoryCheckoutBusy=false;}
};

