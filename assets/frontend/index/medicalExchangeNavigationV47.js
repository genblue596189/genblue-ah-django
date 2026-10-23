
/* Keep the mounted medical form while visiting the diagnostic import center. */
var medicalExchangeReturnContext=null;
function medicalExchangeScope(){return CURRENT_TENANT_ID&&CURRENT_USER?.id?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function syncMedicalExchangeReturn(){
 const context=medicalExchangeReturnContext;
 const valid=!!context&&context.scope===medicalExchangeScope()&&context.petId===currentPetId;
 const bar=document.getElementById('medicalExchangeReturnBar');
 bar.hidden=!valid;
 if(!valid){medicalExchangeReturnContext=null;return;}
 document.getElementById('medicalExchangeContext').textContent='目前門診：'+context.petName+'。返回時保留病歷、處方與尚未完成的輸入。';
}
function goToDiagnosticExchangeFromMedical(){
 if(!currentPetId||!medicalExchangeScope()){alert('請先選擇目前看診的寵物。');return false;}
 medicalExchangeReturnContext={scope:medicalExchangeScope(),petId:currentPetId,petName:currentPetName||document.getElementById('cardPetName').textContent,scrollY:window.scrollY};
 switchTab('diagnostic_exchange');
 requestAnimationFrame(()=>{if(medicalExchangeReturnContext&&medicalExchangeReturnContext.scope===medicalExchangeScope()&&document.getElementById('diagnostic_exchange').classList.contains('active'))document.getElementById('diagnosticImportCardV47').scrollIntoView({block:'start'});});
 return true;
}
function backToMedicalFromDiagnosticExchange(){
 const context=medicalExchangeReturnContext;
 if(!context||context.scope!==medicalExchangeScope()||context.petId!==currentPetId){syncMedicalExchangeReturn();alert('目前看診或登入帳號已變更，請重新從門診開啟檢驗／影像中心。');return false;}
 switchTab('medical');
 requestAnimationFrame(()=>{if(context.scope===medicalExchangeScope()&&context.petId===currentPetId&&document.getElementById('medical').classList.contains('active'))window.scrollTo({top:context.scrollY,behavior:'instant'});});
 return true;
}
const medicalExchangeOriginalSwitchTabV47=switchTab;
switchTab=function(tabId){medicalExchangeOriginalSwitchTabV47(tabId);syncMedicalExchangeReturn();};

