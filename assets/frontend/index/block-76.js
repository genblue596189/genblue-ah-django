
// v94: species-specific reference data and explicit group dispensing plans.
function medicineProfileV94(m){return m?.clinical_profile_v94||{species:'unset',dog:'',cat:'',other:'',methods:[]};}
function speciesReferenceV94(m,s){const p=medicineProfileV94(m),key=s==='犬'?'dog':s==='貓'?'cat':'other',allowed=p.species==='both'&&['犬','貓'].includes(s)||p.species===key;return {allowed,text:p[key]||'',species:p.species};}
function profileFormV94(prefix){const p={species:document.getElementById(prefix+'SpeciesV94').value,methods:prefix==='editMed'?(medicineProfileV94(loadedMedicinesMap[document.getElementById('editMedId').value]).methods||[]):[]};for(const k of ['dog','cat','other'])p[k]=document.getElementById(prefix+k+'V94').value.trim();return p;}
function fillProfileV94(prefix,m){const p=medicineProfileV94(m);document.getElementById(prefix+'SpeciesV94').value=p.species||'unset';for(const k of ['dog','cat','other'])document.getElementById(prefix+k+'V94').value=p[k]||'';document.querySelectorAll('#'+prefix+'ProfileV94 input[type=checkbox]').forEach(e=>e.checked=(p.methods||[]).includes(e.value));}
function installProfileV94(prefix,anchor){const box=document.createElement('fieldset');box.id=prefix+'ProfileV94';box.className='medicine-profile-v94';const title=document.createElement('legend');title.textContent='適用物種與劑量參考';box.append(title);function field(label,e){const l=document.createElement('label');l.textContent=label;l.append(e);box.append(l);}const s=document.createElement('select');s.id=prefix+'SpeciesV94';for(const [v,t] of [['unset','尚未設定'],['dog','犬'],['cat','貓'],['both','犬貓皆可'],['other','其他']])s.add(new Option(t,v));field('適用物種',s);for(const [k,t] of [['dog','犬'],['cat','貓'],['other','其他物種（請註明物種）']]){const e=document.createElement('textarea');e.id=prefix+k+'V94';e.maxLength=1000;e.rows=2;e.placeholder='由醫師填寫：劑量、單位、頻次及注意事項';field(t+'參考劑量／注意事項',e);}anchor.closest('.form-group').after(box);}
installProfileV94('med',document.getElementById('medRecDose'));installProfileV94('editMed',document.getElementById('editMedRecDose'));
const editProfileOriginalV94=openEditMedicineModal;openEditMedicineModal=function(id){const r=editProfileOriginalV94(id);if(loadedMedicinesMap[id])fillProfileV94('editMed',loadedMedicinesMap[id]);return r;};
function showReferenceV94(){const box=document.getElementById('medicineReferenceV94'),m=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];box.replaceChildren();if(!m)return;const p=medicineProfileV94(m),r=speciesReferenceV94(m,currentPetSpecies);box.style.color=r.allowed?'#17352a':'#b91c1c';for(const text of ['目前物種：'+(currentPetSpecies||'未指定')+'｜'+(r.allowed?'建檔適用物種相符':'注意：適用物種尚未設定或不相符，請醫師確認'), '本物種參考：'+(r.text||'尚未設定；請醫師自行確認劑量'), '舊版通用參考（未按物種核對）：'+(m.recommended_dose||'無')]){const e=document.createElement('p');e.textContent=text;box.append(e);}}
const reference=document.createElement('section');reference.id='medicineReferenceV94';reference.className='medicine-profile-v94';reference.setAttribute('role','status');document.getElementById('medUseDoseDisplay').closest('.form-group').after(reference);
function referenceDoseV945(m,species){const r=speciesReferenceV94(m,species);const text=r.allowed&&r.text.trim()?r.text:String(m?.recommended_dose||'');const match=text.match(/^\s*(\d+(?:\.\d+)?|\.\d+)\s*(mg\s*\/\s*kg|IU\s*\/\s*kg|ml\s*\/\s*kg|ml)\s*$/i);if(!match||!Number.isFinite(Number(match[1]))||Number(match[1])<=0)return null;const raw=match[2].replace(/\s/g,'').toLowerCase();return {value:Number(match[1]),unit:raw==='iu/kg'?'IU/kg':raw};}
const injectionUnitOriginalV945=injectionDefaultUnitV9113;injectionDefaultUnitV9113=function(m){return referenceDoseV945(m,currentPetSpecies)?.unit||injectionUnitOriginalV945(m);};
const selectOriginalV94=onMedicineSelectedForDoseCalculation;
onMedicineSelectedForDoseCalculation=function(...a){
 const result=selectOriginalV94.apply(this,a),m=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];
 if(m){const ref=referenceDoseV945(m,currentPetSpecies),route=prescriptionCalculationRouteV68(),input=document.getElementById('medCustomRecDose'),unit=document.getElementById('prescriptionDoseUnitV91');input.value='';
 if(ref&&(route?.calc!=='tablet'||ref.unit==='mg/kg')){input.value=String(ref.value);if(unit&&!unit.disabled)unit.value=ref.unit;}
 runDetailedMathCalculation();if(!input.value)document.getElementById('calculatedDoseResult').value='參考劑量為空、範圍值或單位不符，請醫師輸入確認後自動換算';}
 showReferenceV94();return result;
};
const resetOriginalV94=resetPrescriptionEntryAfterAdd;resetPrescriptionEntryAfterAdd=function(...a){const r=resetOriginalV94.apply(this,a);showReferenceV94();return r;};
const addOriginalV94=addDetailedPrescriptionItem;addDetailedPrescriptionItem=function(...a){const m=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];if(m&&!speciesReferenceV94(m,currentPetSpecies).allowed&&!confirm('此藥適用物種未設定或與目前寵物不符。醫師是否已確認仍要加入？'))return;
const state=dispensingNowV75(),g=state.groups.get(state.active),rows=dispensingRowsV75().filter(row=>dispensingRowMetaV75(row).id===g.id);if(rows.length&&(String(g.frequency)!==document.getElementById('medFrequencyDetail').value||String(g.days)!==document.getElementById('medDays').value)){alert('本組已有不同頻次或天數的用藥。若要另開不同療程，請先按「完成本組」，再於下一組開藥。');return;}
return addOriginalV94.apply(this,a);};
function planTotalV94(p,f,d){if(!p||!(p.mode==='total'||Object.prototype.hasOwnProperty.call(p,'total')))return null;const total=Number(p.total);return Number.isFinite(total)&&total>0&&total<=1000000?total:null;}
function planTextV94(g){const p=g.preparation_v94,total=planTotalV94(p,g.frequency,g.days);if(!p?.form||p.form==='未指定')return '';const unit=p.form==='調製藥水'?'ml':p.form==='磨粉分包'?'包':p.form==='膠囊'?'粒':'顆';const freq=Number(g.frequency)===0?'需要時使用':Number(g.frequency)===.5?'隔日一次':'每日 '+g.frequency+' 次';return '配製：'+p.form+'；本組療程：'+freq+'，'+g.days+' 天；'+(total===null?'交付總量待確認（不從舊版每次量推算）':p.form==='調製藥水'?'調製至總量 '+total+' ml':'交付總量 '+total+' '+unit)+(p.notes?'；載體／濃度／保存及交代：'+p.notes:'');}
const metaOriginalV94=dispensingMetaV75;dispensingMetaV75=function(value){const g=metaOriginalV94(value),p=value?.preparation_v94;if(p&&typeof p==='object')g.preparation_v94={form:String(p.form||'未指定').slice(0,20),per:String(p.per||'').slice(0,20),mode:p.mode==='total'||Object.prototype.hasOwnProperty.call(p,'total')?'total':'per',...(Object.prototype.hasOwnProperty.call(p,'total')?{total:String(p.total??'').slice(0,20)}:{}),notes:String(p.notes||'').slice(0,500)};return g;};
const labelOriginalV94=dispensingGroupLabelV75;dispensingGroupLabelV75=function(g){const t=planTextV94(g);return labelOriginalV94(g)+(t?'｜'+t:'');};
function instructionPhraseV943(frequency,days,food){const f=Number(frequency),d=Number(days);if(!['飯後服用','飯前服用','隨餐服用','不限飯前飯後'].includes(food))throw Error('請選服用時機');if(!Number.isInteger(d)||d<=0)throw Error('請先填寫正整數天數');if(f===0)return '需要時使用，共'+d+'天，'+food;if(f===0.5)return '隔日一次，共'+d+'天，'+food;if(!Number.isFinite(f)||f<=0)throw Error('請先選有效的用藥頻次');return '每日'+f+'次，連續'+d+'天，'+food;}
// Update only an unambiguous duration phrase; retain all other medical instructions.
function replaceInstructionDaysV1(text,days){
 const value=String(text||''),n=Number(days);if(!Number.isInteger(n)||n<=0)return {text:value,matched:false};
 const pattern=/(連續|共)(\s*)[0-9]+(\s*)天/g, found=[...value.matchAll(pattern)];
 if(found.length!==1)return {text:value,matched:false};
 return {text:value.replace(pattern,(_,label,space1,space2)=>label+space1+n+space2+'天'),matched:true};
}
const unifiedNoteV942=document.getElementById('medPrescribeNote');
const unifiedNoteOriginalGroupV942=unifiedNoteV942.closest('.form-group');
function persistUnifiedNoteV942(){if(!medicalEditAllowedV53())return;const state=dispensingNowV75(),g=state.groups.get(state.active);if(!g)return;g.instruction=unifiedNoteV942.value;if(g.preparation_v94)g.preparation_v94.notes='';for(const row of dispensingRowsV75())if(dispensingRowMetaV75(row).id===g.id)row.querySelector('.prescribe-note').value=g.instruction;updateDispensingRowsMetaV75(g);collectCurrentMedicalState();}
unifiedNoteV942.addEventListener('change',persistUnifiedNoteV942);
function renderPlanV94(){
 const box=document.getElementById('preparationV94');if(!box)return;
 // Move the original instruction control; keep its id and existing event handlers.
 unifiedNoteV942.remove();box.replaceChildren();
 const state=dispensingNowV75(),g=state.groups.get(state.active);if(!g)return;box.dataset.groupV949=g.id;box.dataset.scopeV949=dispensingScopeV75();
 const p=g.preparation_v94||{form:'未指定',per:'',notes:''};
 if(p.notes){const prior=g.instruction||'';g.instruction=prior.includes(p.notes)?prior:prior+(prior?'；':'')+p.notes;unifiedNoteV942.value=g.instruction;g.preparation_v94={...p,notes:''};for(const row of dispensingRowsV75())if(dispensingRowMetaV75(row).id===g.id)row.querySelector('.prescribe-note').value=g.instruction;updateDispensingRowsMetaV75(g);}
 const title=document.createElement('h4');title.textContent='本組配藥方式與交付量（'+g.name+'）';box.append(title);
 const form=document.createElement('select');form.id='preparationFormV949';for(const t of ['未指定','膠囊','調製藥水','磨粉分包','原錠／顆粒直接給'])form.add(new Option(t,t));form.value=p.form;
 const per=document.createElement('input');per.id='preparationTotalV948';per.type='number';per.min='.0001';per.step='any';per.value=planTotalV94(p,g.frequency,g.days)??'';
 const frequency=document.createElement('select');frequency.id='preparationFrequencyV948';for(const [v,t] of [['1','每日1次'],['2','每日2次'],['3','每日3次'],['4','每日4次'],['0.5','隔日一次'],['0','需要時使用（PRN）']])frequency.add(new Option(t,v));if(![...frequency.options].some(o=>o.value===String(g.frequency)))frequency.add(new Option('原設定：'+g.frequency,String(g.frequency)));frequency.value=String(g.frequency);
 const days=document.createElement('input');days.id='preparationDaysV948';days.type='number';days.min='1';days.step='1';days.value=g.days;

 unifiedNoteV942.placeholder='例如：一天兩次，連續5天，飯後服用；另註明載體、調製濃度及保存方式';
 for(const [t,e] of [['本組配藥方式',form],['交付總量（藥水 ml／膠囊粒／分包包／直接給顆）',per],['本組給藥頻次',frequency],['本組療程天數',days],['用法／調製／保存及交代',unifiedNoteV942]]){const l=document.createElement('label');l.textContent=t;l.append(e);box.append(l);}
 const shortcuts=document.createElement('div');shortcuts.className='instruction-shortcuts-v943';
 const food=document.createElement('select');food.setAttribute('aria-label','服用時機');for(const t of ['飯後服用','飯前服用','隨餐服用','不限飯前飯後'])food.add(new Option(t,t));
 const apply=document.createElement('button');apply.type='button';apply.className='btn-secondary';apply.textContent='帶入用法句';apply.disabled=!medicalEditAllowedV53();
 const preview=document.createElement('span');preview.textContent='依本組頻次、天數帶入；帶入後可自行修改。';
 apply.onclick=()=>{if(!medicalEditAllowedV53())return;try{const phrase=instructionPhraseV943(frequency.value,days.value,food.value);const old=unifiedNoteV942.value.trim();const match=old.match(/^(?:(?:一天|每日|每天)[^，,；;]*[，,]\s*(?:連續|共)?[^，,；;]*天[，,]\s*(?:飯後服用|飯前服用|隨餐服用|不限飯前飯後)|(?:需要時使用|隔日一次)[^；;]*)([；;][\s\S]*)?$/);if(old&&!match&&!confirm('目前已有自訂醫囑，是否以選定的用法句取代？請先確認需保留的調製與保存交代。'))return;unifiedNoteV942.value=phrase+(match?.[1]||'');persistUnifiedNoteV942();unifiedNoteV942.focus();}catch(e){alert(e.message);}};
 shortcuts.append(food,apply,preview);box.insertBefore(shortcuts,unifiedNoteV942.parentElement);
 const syncStatus=document.createElement('p');syncStatus.setAttribute('role','status');syncStatus.style.cssText='color:#b45309;font-size:.85rem';box.append(syncStatus);
 const syncDays=()=>{
  if(!medicalEditAllowedV53()||!Number.isInteger(Number(days.value))||Number(days.value)<=0)return;
  if(box.dataset.scopeV949!==dispensingScopeV75()||box.dataset.groupV949!==dispensingNowV75().active)return;
  const active=dispensingNowV75().groups.get(dispensingNowV75().active);if(!active)return;
  const shared=replaceInstructionDaysV1(unifiedNoteV942.value,days.value);let needsReview=!shared.matched;
  if(shared.matched){unifiedNoteV942.value=shared.text;active.instruction=shared.text;}
  for(const row of dispensingRowsV75())if(dispensingRowMetaV75(row).id===active.id){const input=row.querySelector('.prescribe-note');if(!input)continue;const result=replaceInstructionDaysV1(input.value,days.value);if(result.matched)input.value=result.text;else needsReview=true;}
  updateDispensingRowsMetaV75(active);
  syncStatus.textContent=needsReview?'部分自訂用法無法辨識天數，請核對下方用法後再儲存。':'';
 };
 days.addEventListener('input',syncDays);days.addEventListener('change',syncDays);
 // The course may already have been selected before this panel is built.
 if(currentPetId)syncDays();
 const summary=document.createElement('p');const refresh=()=>summary.textContent=planTextV94({...g,frequency:frequency.value,days:days.value,preparation_v94:{form:form.value,mode:'total',total:per.value,notes:''}})||'請選本組配藥方式。';refresh();box.append(summary);
 const hint=document.createElement('p');hint.textContent='交付總量直接填寫，不再乘上頻次或天數。藥水是調製至該體積，不是另加相同量的糖水。本組頻次、天數可修改；修改療程後請核對醫囑及每種原藥數量，系統不會自動改動已加入的原藥顆數。';box.append(hint);
 for(const e of [form,per,frequency,days]){e.disabled=!medicalEditAllowedV53();e.addEventListener('input',()=>{commitPreparationV949();refresh();});e.onchange=()=>{if(!medicalEditAllowedV53())return;if(!Number.isInteger(Number(days.value))||Number(days.value)<=0){alert('本組天數請填正整數');return;}commitPreparationV949();if(!injectionEntryModeV70){document.getElementById('medFrequencyDetail').value=frequency.value;document.getElementById('medDays').value=days.value;runDetailedMathCalculation();}collectCurrentMedicalState();refresh();};}
 unifiedNoteV942.disabled=!medicalEditAllowedV53();
 if(unifiedNoteOriginalGroupV942&&!unifiedNoteOriginalGroupV942.contains(box))unifiedNoteOriginalGroupV942.remove();
}
function commitPreparationV949(){
 const box=document.getElementById('preparationV94');if(!box||box.dataset.scopeV949!==dispensingScopeV75()||!medicalEditAllowedV53())return;
 const state=dispensingNowV75(),g=state.groups.get(state.active);if(!g||box.dataset.groupV949!==g.id)return;
 const form=document.getElementById('preparationFormV949'),total=document.getElementById('preparationTotalV948'),frequency=document.getElementById('preparationFrequencyV948'),days=document.getElementById('preparationDaysV948');if(!form||!total||!frequency||!days)return;
 g.preparation_v94={form:form.value,mode:'total',total:total.value,notes:''};g.form=form.value;g.frequency=frequency.value;g.days=days.value;updateDispensingRowsMetaV75(g);
}
const preparationCollectOriginalV949=collectPrescriptionDetailsV75;
collectPrescriptionDetailsV75=function(...args){commitPreparationV949();return preparationCollectOriginalV949.apply(this,args);};
const planBox=document.createElement('section');planBox.id='preparationV94';planBox.className='medicine-profile-v94';document.getElementById('prescriptionItemsContainer').before(planBox);
const renderOriginalV94=renderDispensingControlsV75;renderDispensingControlsV75=function(...a){const r=renderOriginalV94.apply(this,a);renderPlanV94();return r;};
renderPlanV94();


const djangoFinalLabel20261022=document.getElementById("genblueVersionV84");
if(djangoFinalLabel20261022)djangoFinalLabel20261022.textContent=" · Django 整合版 2026-10-22";
