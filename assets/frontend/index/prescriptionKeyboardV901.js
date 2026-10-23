
// v90.1: keyboard navigation selects the same medicine as the existing mouse action.
let prescriptionActiveIndexV901=-1;
function prescriptionResultRowsV901(){return Array.from(document.getElementById('prescriptionMedicineResults').querySelectorAll('button'));}
function prescriptionHighlightV901(index){
 const rows=prescriptionResultRowsV901(),input=document.getElementById('prescriptionMedicineSearch');
 prescriptionActiveIndexV901=index>=0&&index<rows.length?index:-1;
 rows.forEach((row,n)=>{const active=n===prescriptionActiveIndexV901;row.classList.toggle('rx-keyboard-active-v901',active);row.setAttribute('aria-selected',String(active));});
 const active=rows[prescriptionActiveIndexV901];if(active){input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');
}
function prescriptionCloseV901(){
 const results=document.getElementById('prescriptionMedicineResults');results.style.display='none';prescriptionHighlightV901(-1);document.getElementById('prescriptionMedicineSearch').setAttribute('aria-expanded','false');
}
const prescriptionFilterOriginalV901=filterPrescriptionMedicines;
filterPrescriptionMedicines=function(...args){
 const result=prescriptionFilterOriginalV901.apply(this,args),input=document.getElementById('prescriptionMedicineSearch'),results=document.getElementById('prescriptionMedicineResults');
 prescriptionHighlightV901(-1);input.setAttribute('aria-expanded',String(results.style.display!=='none'));
 prescriptionResultRowsV901().forEach((row,n)=>{row.id='prescriptionOptionV901_'+n;row.setAttribute('role','option');row.setAttribute('tabindex','-1');row.onmouseenter=()=>prescriptionHighlightV901(n);row.onmouseleave=()=>{};row.addEventListener('pointerdown',e=>e.preventDefault());});return result;
};
const prescriptionSelectOriginalV901=selectPrescriptionMedicine;
selectPrescriptionMedicine=function(...args){const result=prescriptionSelectOriginalV901.apply(this,args);prescriptionCloseV901();return result;};
function prescriptionKeydownV901(e){
 if(e.isComposing||e.keyCode===229||e.altKey||e.ctrlKey||e.metaKey)return;
 if(!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key))return;
 const results=document.getElementById('prescriptionMedicineResults');
 if(e.key==='Escape'){if(results.style.display==='none')return;e.preventDefault();e.stopImmediatePropagation();prescriptionCloseV901();return;}
 if(e.key==='Enter'){
  // Require a highlighted result: Enter never silently chooses an unreviewed drug.
  e.preventDefault();e.stopImmediatePropagation();const rows=prescriptionResultRowsV901();
  if(results.style.display!=='none'&&prescriptionActiveIndexV901>=0&&rows[prescriptionActiveIndexV901]){
   rows[prescriptionActiveIndexV901].click();
   if(document.getElementById('medSelectDropdown').value){const dose=document.getElementById('medCustomRecDose');dose.focus();dose.select();}
  }return;
 }
 e.preventDefault();e.stopImmediatePropagation();if(results.style.display==='none')filterPrescriptionMedicines();
 const rows=prescriptionResultRowsV901();if(!rows.length)return;
 const next=e.key==='ArrowDown'?(prescriptionActiveIndexV901+1)%rows.length:(prescriptionActiveIndexV901<0?rows.length-1:(prescriptionActiveIndexV901+rows.length-1)%rows.length);
 prescriptionHighlightV901(next);
}
const prescriptionInputV901=document.getElementById('prescriptionMedicineSearch');
prescriptionInputV901.setAttribute('role','combobox');prescriptionInputV901.setAttribute('aria-autocomplete','list');prescriptionInputV901.setAttribute('aria-haspopup','listbox');prescriptionInputV901.setAttribute('aria-controls','prescriptionMedicineResults');prescriptionInputV901.setAttribute('aria-expanded','false');
document.getElementById('prescriptionMedicineResults').setAttribute('role','listbox');document.getElementById('prescriptionMedicineResults').setAttribute('aria-label','符合搜尋的藥品');
prescriptionInputV901.addEventListener('keydown',prescriptionKeydownV901,true);
prescriptionInputV901.addEventListener('blur',prescriptionCloseV901);
const prescriptionResetOriginalV901=resetPrescriptionEntryAfterAdd;
resetPrescriptionEntryAfterAdd=function(...args){prescriptionCloseV901();return prescriptionResetOriginalV901.apply(this,args);};
document.getElementById('genblueVersionV84').textContent=' · v90.1';
