
// v90.5: saved close-of-day evidence is read-only; untouched empty controls are not a failed review.
let paymentEditScopeV905='',paymentEditedV905=false;
function paymentClosedScopeV905(){return JSON.stringify([posScopeNowV77(),posStateV77?.day?.business_date,posStateV77?.shift?.id||null,posStateV77?.review_shift?.id||null]);}
function paymentSavedCheckV905(state,touched,edited){
 if(!state?.day||state.shift||!state.review_shift||touched||edited)return null;
 const review=state.drawer_review,saved=review?.saved,data=saved?.data;
 if(!data?.actual)return {kind:'unavailable',saved,review};
 if(review.count_current!==true)return {kind:'stale',saved,review};
 const check=paymentCheckV904(state.day,data.actual['現金'],data.actual,data.evidence||{});
 const expected=paymentCentsV904(data.expected);
 if(expected===null||expected!==paymentCentsV904(state.day.expected))return {kind:'stale',saved,review};
 return {kind:'saved',saved,review,check};
}
function paymentShowSavedV905(result){
 const money=c=>posMoneyV77(c/100),check=result.check,saved=result.saved;
 for(const id of ['posPaymentTotalTopV904','posPaymentTotalBottomV904']){
  const box=document.getElementById(id);if(!box)continue;box.hidden=false;box.replaceChildren();box.append(posNodeV77('strong','今日已下班｜已保存的付款核對'));
  if(result.kind==='unavailable'){box.append(posNodeV77('p','新的核對欄位目前空白，不代表今日結帳未完成。請展開「錢櫃計算與核對紀錄」查看原下班清點；此頁尚未取得完整核對明細。'));continue;}
  if(result.kind==='stale'){const p=posNodeV77('p','原下班核對紀錄已保存，但目前金流與上次清點已有異動；請重新清點並補核對，勿重新收款。');p.style.color='#b45309';box.append(p);continue;}
  box.append(posNodeV77('p','系統今日淨收款合計：'+money(check.expected)));
  if(check.received!==null)box.append(posNodeV77('p','上次保存的實際核對合計：'+money(check.received)+'｜總差額：'+(check.difference>0?'+':'')+money(check.difference)));
  const status=posNodeV77('p');status.style.fontWeight='700';
  if(check.status==='matched'){status.textContent='✓ 已保存的整體及各付款方式均相符，不需重複結帳或核對。';status.style.color='#15803d';}
  else{status.textContent=check.status==='mismatch'?'原下班已保存，但付款方式仍有差額待處理；請補核對，勿重複收款。':'原下班已保存；核對明細或憑證尚未完整，請查看已保存紀錄後補核對。';status.style.color='#b45309';}
  box.append(status);
  for(const d of check.mismatches||[])box.append(posNodeV77('p',d.method+'差額：'+money(d.diff)));
  if(saved.created_at)box.append(posNodeV77('p','保存時間：'+new Date(saved.created_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})));
  const note=posNodeV77('p','以下空白欄位供需要時重新清點或下班後補核對使用，不會清除已保存紀錄。');note.style.cssText='font-size:.8rem;color:#64748b';box.append(note);
 }
 const cash=document.getElementById('posDifferenceV845_0'),count=document.getElementById('posCountTotalV77');
 if(result.kind==='saved'&&check.diffs[0]?.diff===0){
  if(cash){cash.textContent='已保存的現金核對相符：'+posMoneyV77(saved.data.actual['現金']);cash.style.color='#15803d';}
  if(count){count.textContent='上次已保存現金清點 '+posMoneyV77(saved.data.actual['現金'])+'｜目前錢櫃仍相符；新的清點欄尚未填寫。';count.style.color='#15803d';}
 }else if(count){count.textContent='今日已下班，原清點紀錄保留；新的清點欄目前空白。';count.style.color='#64748b';}
}
const paymentRenderBeforeV905=paymentRenderTotalV904;
paymentRenderTotalV904=function(count){
 const scope=paymentClosedScopeV905();if(scope!==paymentEditScopeV905){paymentEditScopeV905=scope;paymentEditedV905=false;}
 const result=paymentSavedCheckV905(posStateV77,posCountTouchedV849,paymentEditedV905);
 if(result){paymentShowSavedV905(result);return result.check||result;}
 return paymentRenderBeforeV905(count);
};
function paymentMarkEditedV905(){paymentEditScopeV905=paymentClosedScopeV905();paymentEditedV905=true;}
for(const n of posDenomsV77)document.getElementById('posDenom'+n+'V77')?.addEventListener('input',paymentMarkEditedV905,true);
for(let i=1;i<4;i++)for(const prefix of ['posActualV845_','posEvidenceV845_'])document.getElementById(prefix+i)?.addEventListener('input',paymentMarkEditedV905,true);
const paymentClearBeforeV905=posClearCountFormV856;
posClearCountFormV856=function(...args){paymentEditedV905=false;return paymentClearBeforeV905.apply(this,args);};
posDifferencesV845();document.getElementById('genblueVersionV84').textContent=' · v90.5';
