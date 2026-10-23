
const movementStatusV9118=document.createElement('p');movementStatusV9118.id='movementStatusV9118';movementStatusV9118.setAttribute('role','status');movementStatusV9118.setAttribute('aria-live','polite');
const movementButtonV9118=document.getElementById('posMovementV77');movementButtonV9118.after(movementStatusV9118);
let movementBusyV9118=false;
const movementIdsV9118=['posMovementKindV77','posMovementAmountV77','posMovementReasonV77','posMovementReferenceV77','posMovementMethodV77'];
function movementNoticeV9118(text,error=false){movementStatusV9118.textContent=text;movementStatusV9118.style.color=error?'#b45309':'#15803d';}
movementButtonV9118.onclick=()=>{
 if(movementBusyV9118||posBusyV77)return;
 return posActionV77(async()=>{
  const scope=posScopeNowV77(),key=posKeyV77('movement');
  const old=JSON.parse(sessionStorage.getItem(key)||'null');
  const value=id=>document.getElementById(id).value;
  const data=old||{shift_id:posStateV77?.shift?.id,kind:value('posMovementKindV77'),amount:Number(value('posMovementAmountV77')),method:value('posMovementMethodV77'),reason:value('posMovementReasonV77').trim(),reference:value('posMovementReferenceV77').trim()};
  if(!data.shift_id)throw Error('請先開始今日工作');
  if(!Number.isFinite(data.amount)||data.amount<=0)throw Error('請填寫大於零的異動金額');
  if(!data.reason)throw Error('請填寫異動原因');
  if(data.kind==='refund'&&!data.reference)throw Error('請填寫退款帳單／憑證');
  const label=({in:'補入零鈔',out:'取出現金',refund:'記錄實際退款'})[data.kind];
  if(!label)throw Error('異動類型不正確');
  if(!old&&!confirm(label+'｜'+data.method+' '+posMoneyV77(data.amount)+'\n原因：'+data.reason+(data.reference?'\n帳單／憑證：'+data.reference:'')+'\n請確認已實際發生這筆款項。'))return;
  movementBusyV9118=true;movementButtonV9118.disabled=true;movementButtonV9118.textContent=old?'核對上次異動中…':'記錄中，請稍候…';
  const disabled=movementIdsV9118.map(id=>document.getElementById(id).disabled);movementIdsV9118.forEach(id=>document.getElementById(id).disabled=true);
  let saved=false;
  try{
   const request=old||posFrozenV77('movement',data);
   movementNoticeV9118(old?'正在核對上次異動，同一請求不會重複新增。':'正在記錄異動，請勿重複操作。');
   try{await posRpcV77('movement',request);}catch(error){if(posRejectedV77(error))sessionStorage.removeItem(key);throw error;}
   saved=true;sessionStorage.removeItem(key);
   if(scope!==posScopeNowV77())return;
   for(const id of ['posMovementAmountV77','posMovementReasonV77','posMovementReferenceV77'])document.getElementById(id).value='';
   document.getElementById('posMovementKindV77').selectedIndex=0;document.getElementById('posMovementMethodV77').selectedIndex=0;
   const success='✓ 已完成：'+label+'｜'+data.method+' '+posMoneyV77(data.amount)+'。請勿重複登錄。';
   movementNoticeV9118(success);document.getElementById('posMessageV77').textContent=success;
   try{const state=await posRefreshV77({fresh:true,required:true});if(scope===posScopeNowV77())movementNoticeV9118(success);}catch(error){if(scope===posScopeNowV77())movementNoticeV9118(success+' 當班畫面更新未完成，請按「更新資料」，不要重新登錄。',true);}
  }catch(error){
   if(scope===posScopeNowV77())movementNoticeV9118(sessionStorage.getItem(key)?'尚未確認結果：'+error.message+'。輸入保留；按「核對上次異動」會重試同一筆。':'未完成：'+error.message+'。請修正輸入後再送出。',true);
  }finally{
   movementBusyV9118=false;movementButtonV9118.disabled=false;
   movementIdsV9118.forEach((id,i)=>document.getElementById(id).disabled=disabled[i]);
   movementButtonV9118.textContent=!saved&&scope===posScopeNowV77()&&sessionStorage.getItem(key)?'核對上次異動（不重複新增）':'記錄異動';
  }
 });
};
document.getElementById('genblueVersionV84').textContent=' · v91.18';
