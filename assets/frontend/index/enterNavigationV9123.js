
(function(){
 const selector='input,select,textarea';
 const ownerOrder=['intOwnerCode','intOwnerName','intOwnerMobile','intOwnerPhone','intOwnerEmail','intOwnerAddress','intOwnerNotes','intPetName','intPetMicrochip','intPetBirthday','intPetSpecies','intPetBreed','intPetGender','intPetWeight'];
 function usable(el){return !!el&&el.matches(selector)&&!el.disabled&&!el.readOnly&&!el.matches(':disabled')&&el.tabIndex>=0&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0&&!['hidden','button','submit','reset','file','checkbox','radio','range','color'].includes(el.type)&&getComputedStyle(el).visibility!=='hidden';}
 function reserved(el,root){
  if(el.dataset.enterNav==='off'||el.closest('[data-enter-nav="off"]'))return true;
  if(el.matches('[type="search"],[role="combobox"],[list],.lab-result-input'))return true;
  if(/search|query|filter/i.test(el.id+' '+el.name)||/搜尋|查詢|關鍵字/.test(el.placeholder||''))return true;
  // Existing field/section keyboard actions own Enter (search, selection, save, etc.).
  for(let node=el;node&&node!==root.parentElement;node=node.parentElement){if(node.hasAttribute('onkeydown')||node.hasAttribute('onkeypress')||typeof node.onkeydown==='function'||typeof node.onkeypress==='function')return true;if(node===root)break;}
  return false;
 }
 function focus(el){el.focus();if(el.tagName==='INPUT'&&['text','tel','email','url','number','password'].includes(el.type))try{el.select();}catch(e){}}
 document.addEventListener('keydown',function(e){
  if(e.defaultPrevented||e.key!=='Enter'||e.isComposing||e.keyCode===229||e.repeat||e.altKey||e.metaKey)return;
  const source=e.target;if(!source?.matches?.(selector)||!usable(source))return;
  // Ordinary Enter remains a newline in medical notes and other multiline text.
  if(source.tagName==='TEXTAREA'?!e.ctrlKey:e.ctrlKey)return;
  if(source.closest('#authScreen'))return;
  const surface=source.closest('[role="dialog"],dialog,.modal-overlay,.modal,.tab-content');if(!surface)return;
  const root=source.closest('form,.card')||surface;
  if(reserved(source,root))return;
  let fields;
  if(ownerOrder.includes(source.id)||source.id==='newBreedCustomInput'){
   fields=ownerOrder.map(id=>document.getElementById(id)).filter(usable);
   if(source.id==='newBreedCustomInput'){const next=document.getElementById('intPetGender');e.preventDefault();if(usable(next))focus(next);return;}
  }else fields=Array.from(root.querySelectorAll(selector)).filter(usable);
  const index=fields.indexOf(source);if(index<0)return;
  e.preventDefault(); // Never implicitly submit or charge when the last field is reached.
  const next=fields[index+(e.shiftKey?-1:1)];
  if(next){focus(next);return;}
  if(!e.shiftKey&&source.id==='intPetWeight'){
   const save=document.querySelector('#owners_pets button[onclick="saveIntegratedOwnerAndPet(\'save_only\')"]');
   if(save&&!save.disabled&&save.getClientRects().length)save.focus();
  }
 });
 const hint=document.createElement('p');hint.style.cssText='font-size:.85rem;color:#475569;margin:8px 0';hint.textContent='鍵盤操作：Enter 下一欄、Shift＋Enter 上一欄；下拉選項可用方向鍵選擇。最後一欄會移到「僅儲存資料」，請確認後再按 Enter。';
 document.getElementById('intOwnerName').closest('.card')?.prepend(hint);
 document.getElementById('genblueVersionV84').textContent=' · v91.31';
})();
