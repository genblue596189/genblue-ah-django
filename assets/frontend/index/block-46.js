
/* v80.2: browser back/forward follows authorized in-app tabs. */
const navigationV802={session:crypto.randomUUID(),scope:'',applying:false};
function navigationScopeV802(){return CURRENT_USER?.id&&CURRENT_TENANT_ID?CURRENT_TENANT_ID+'|'+CURRENT_USER.id:'';}
function navigationActiveV802(){return document.querySelector('.tab-content.active')?.id||'appointments';}
function navigationStateV802(tab){return {genblueV802:true,session:navigationV802.session,scope:navigationScopeV802(),tab,pet:typeof currentPetId==='undefined'?null:currentPetId||null};}
function navigationReplaceV802(tab){try{history.replaceState(navigationStateV802(tab),'');}catch{}}
const navigationSwitchV802=switchTab;
switchTab=function(tab,...args){
 const scope=navigationScopeV802(),before=navigationActiveV802();
 if(scope&&scope!==navigationV802.scope){navigationV802.scope=scope;navigationV802.session=crypto.randomUUID();navigationReplaceV802(before);}
 const result=navigationSwitchV802.call(this,tab,...args),after=navigationActiveV802();
 if(scope&&!navigationV802.applying&&after!==before){try{history.pushState(navigationStateV802(after),'');}catch{}}
 return result;
};
window.addEventListener('popstate',event=>{
 const scope=navigationScopeV802();if(!scope)return;
 const state=event.state;let tab='appointments';
 if(state?.genblueV802&&state.session===navigationV802.session&&state.scope===scope&&document.getElementById(state.tab)?.classList.contains('tab-content')){
  const patientBound=['medical','invoices','vaccines'];
  if(!patientBound.includes(state.tab)||state.pet===(typeof currentPetId==='undefined'?null:currentPetId||null))tab=state.tab;
 }
 navigationV802.applying=true;
 try{switchTab(tab);if(navigationActiveV802()!==tab)switchTab('appointments');navigationReplaceV802(navigationActiveV802());}
 finally{navigationV802.applying=false;}
});

