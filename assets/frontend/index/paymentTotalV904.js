
// v90.4: total and per-method checks must both match; drawer funds are not revenue.
function paymentCentsV904(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>90000000000||Math.abs(n*100-Math.round(n*100))>.000001)return null;return Math.round(n*100);}
function paymentCheckV904(day,count,actual,proofs={}){
 if(!day||!Array.isArray(day.methods))return {status:'unavailable',message:'尚未取得今日各付款方式資料，請更新今日工作。'};
 const methods=['現金','信用卡','轉帳','行動支付'],system=methods.map(method=>paymentCentsV904(day.methods.find(m=>m.method===method)?.total??0));
 const expectedCash=paymentCentsV904(day.expected),cash=paymentCentsV904(count);
 if(system.includes(null)||expectedCash===null)return {status:'unavailable',message:'今日金流資料不完整，請更新今日工作。'};
 const values=[cash,...methods.slice(1).map(m=>paymentCentsV904(actual[m]))],missing=methods.filter((m,i)=>values[i]===null);
 const diffs=methods.map((method,i)=>({method,diff:values[i]===null?null:values[i]-(i===0?expectedCash:system[i])}));
 const mismatches=diffs.filter(d=>d.diff!==null&&d.diff!==0),offset=expectedCash-system[0],expected=system.reduce((a,b)=>a+b,0);
 const complete=missing.length===0,received=complete?values.reduce((a,b)=>a+b,0)-offset:null,difference=complete?received-expected:null;
 const evidence=methods.slice(1).filter(method=>((day.receipts||[]).some(r=>r.method===method&&!r.verified)||Number(day.methods.find(m=>m.method===method)?.pending_count||0)>0)&&!String(proofs[method]||'').trim());
 const status=mismatches.length||difference!==null&&difference!==0?'mismatch':!complete?'incomplete':evidence.length?'evidence':'matched';
 return {status,expected,received,difference,offset,diffs,mismatches,missing,evidence};
}
function paymentRenderTotalV904(count){
 const day=posStateV77?.day,actual={},proofs={};
 for(let idx=1;idx<4;idx++){actual[posMethodsV845[idx]]=document.getElementById('posActualV845_'+idx)?.value??'';proofs[posMethodsV845[idx]]=document.getElementById('posEvidenceV845_'+idx)?.value??'';}
 const check=paymentCheckV904(day,count,actual,proofs),money=c=>posMoneyV77(c/100);
 for(const id of ['posPaymentTotalTopV904','posPaymentTotalBottomV904']){
  const box=document.getElementById(id);if(!box)continue;box.replaceChildren();box.hidden=!day;if(!day)continue;
  box.append(posNodeV77('strong','全部付款方式總核對（現金＋刷卡＋轉帳＋行動支付）'));
  if(check.status==='unavailable'){box.append(posNodeV77('p',check.message));continue;}
  box.append(posNodeV77('p','系統今日淨收款合計：'+money(check.expected)));
  if(check.received!==null)box.append(posNodeV77('p','實際核對合計：'+money(check.received)+'｜總差額：'+(check.difference>0?'+':'')+money(check.difference)));
  else box.append(posNodeV77('p','實際核對合計尚未完成；未填／無效金額：'+check.missing.join('、')));
  const message=posNodeV77('p');message.style.fontWeight='700';
  if(check.status==='matched'){message.textContent='✓ 整體及各付款方式均相符；仍需按「確認今日入帳」保存核對。';message.style.color='#15803d';}
  else{
   message.style.color=check.status==='incomplete'?'#b45309':'#dc2626';
   message.textContent=check.status==='mismatch'?(check.difference===0?'總金額相同，但付款方式不符，整體仍待處理。':'整體收款核對不符，請查明差額。'):check.status==='evidence'?'金額相符，但核對憑證未填，尚未完成核對。':'尚未完成全部付款方式核對。';
  }box.append(message);
  for(const diff of check.mismatches){const p=posNodeV77('p',diff.method+'差額：'+(diff.diff>0?'+':'')+money(diff.diff));p.style.color='#dc2626';box.append(p);}
  if(check.evidence.length)box.append(posNodeV77('p','缺少核對憑證：'+check.evidence.join('、')));
  const note=posNodeV77('p','合計已扣除錢櫃中的備用金及補入／取出等非營收異動（淨額 '+money(check.offset)+'）。核對欄不會改寫帳單付款方式；若金額填錯付款方式，請核對原帳單。');note.style.cssText='font-size:.8rem;color:#64748b';box.append(note);
 }
 const cashLabel=document.getElementById('posDifferenceV845_0');
 if(cashLabel&&cashLabel.textContent.includes('｜相符'))cashLabel.textContent=cashLabel.textContent.replace('｜相符','｜僅現金相符，整體見總核對');
 return check;
}
const paymentCountOriginalV904=posCountUpdateV77;
posCountUpdateV77=function(...args){const count=paymentCountOriginalV904.apply(this,args);paymentRenderTotalV904(count);return count;};
const paymentDifferenceOriginalV904=posDifferencesV845;
posDifferencesV845=function(...args){const result=paymentDifferenceOriginalV904.apply(this,args);paymentRenderTotalV904(paymentCountOriginalV904());return result;};
function paymentMountV904(){
 for(const [id,anchor] of [['posPaymentTotalTopV904',document.getElementById('posVerifyStatusV845')],['posPaymentTotalBottomV904',document.getElementById('posCountTotalV77')]]){
  if(!anchor)continue;const box=posNodeV77('div');box.id=id;box.className='pos-payment-total-v904';box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.hidden=true;anchor.after(box);
 }
 for(let i=1;i<4;i++)document.getElementById('posEvidenceV845_'+i)?.addEventListener('input',()=>posDifferencesV845());
 posDifferencesV845();document.getElementById('genblueVersionV84').textContent=' · v90.4';
}
paymentMountV904();
