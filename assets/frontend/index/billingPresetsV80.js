
/* v80: reusable manual POS charges; existing clinical charges and blank rows remain. */
const billingPresetsV80={scope:'',items:[],selected:new Set(),loading:false,saving:false,revision:0};
function billingPresetScopeV80(){return CURRENT_TENANT_ID+'|'+CURRENT_USER?.id;}
function billingPresetStatusV80(text,error=false){const e=document.getElementById('bp80-status');e.textContent=text;e.style.color=error?'#b42318':'#476343';}
function billingPresetValidateV80(items){
 if(!Array.isArray(items)||items.length>200)throw Error('常用項目最多 200 筆');const ids=new Set();
 for(const x of items){if(!x||typeof x.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x.id)||ids.has(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>100||typeof x.code!=='string'||x.code.length>30||typeof x.category!=='string'||!x.category.trim()||x.category.length>50||typeof x.price!=='number'||!Number.isFinite(x.price)||x.price<0||x.price>99999999.99||Math.abs(x.price*100-Math.round(x.price*100))>1e-5)throw Error('請核對名稱、分類、代碼與金額（最多兩位小數）');ids.add(x.id);}return items;
}
function billingPresetExistsV80(item){return [...document.querySelectorAll('#invoiceItemsList .list-row')].some(row=>row.dataset.billingPresetV80===item.id||(row.querySelector('.invoice-name')?.value.trim()===item.name&&Number(row.querySelector('.invoice-price')?.value)===item.price));}
function billingPresetRenderV80(){
 const state=billingPresetsV80,box=document.getElementById('bp80-list');box.replaceChildren();document.getElementById('bp80-settings').hidden=CURRENT_PROFILE?.role!=='admin';document.getElementById('bp80-settings-fields').disabled=state.loading||state.saving;
 const category=document.getElementById('bp80-category'),old=category.value;category.replaceChildren();const option=(value,text)=>{const e=document.createElement('option');e.value=value;e.textContent=text;category.appendChild(e);};option('','全部分類');for(const value of [...new Set(state.items.map(x=>x.category))])option(value,value);category.value=[...category.options].some(o=>o.value===old)?old:'';
 const query=document.getElementById('bp80-query').value.trim().toLowerCase(),cat=category.value;
 const filtered=state.items.filter(x=>(!cat||x.category===cat)&&(!query||[x.name,x.code,x.category].some(v=>v.toLowerCase().includes(query))));
 for(const item of filtered){const row=document.createElement('label');row.style.cssText='display:flex;gap:12px;align-items:center;padding:10px 5px;border-bottom:1px solid #dae2d3;cursor:pointer';const check=document.createElement('input');check.type='checkbox';check.style.width='auto';const exists=billingPresetExistsV80(item);check.checked=state.selected.has(item.id)&&!exists;check.disabled=exists||state.loading||state.saving;check.onchange=()=>{check.checked?state.selected.add(item.id):state.selected.delete(item.id);};const text=document.createElement('span');text.style.flex='1';text.textContent=(item.code?item.code+'｜':'')+item.name;const price=document.createElement('span');price.textContent='NT$ '+item.price.toLocaleString('zh-TW')+(exists?'（已在帳單）':'');if(exists)state.selected.delete(item.id);row.append(check,text,price);box.appendChild(row);}
 if(!state.items.length)box.textContent='尚無常用項目。管理者可展開下方「設定常用收費清單」新增，或從目前手動明細帶入。';else if(!filtered.length)box.textContent='沒有符合的常用項目。';
}
function billingPresetResetV80(){const state=billingPresetsV80;state.revision++;state.scope='';state.items=[];state.selected.clear();state.loading=false;state.saving=false;document.getElementById('bp80-editor').replaceChildren();billingPresetRenderV80();}
async function billingPresetLoadV80(){
 if(!familyAllowedV74()){billingPresetStatusV80('此帳號沒有結帳權限。',true);return;}
 if(billingPresetsV80.loading)return;
 if(billingPresetsV80.saving){billingPresetStatusV80('請等候清單儲存完成。');return;}
 const scope=billingPresetScopeV80(),state=billingPresetsV80;if(state.scope===scope&&billingPresetDraftChangedV801()){billingPresetStatusV80('有尚未儲存的項目，請先儲存常用清單再重新讀取。',true);return;}if(state.scope!==scope)billingPresetResetV80();state.scope=scope;state.loading=true;const rev=++state.revision;
 billingPresetRenderV80();billingPresetStatusV80('正在讀取常用收費清單…');
 try{const {data,error}=await _supabase.rpc('manage_billing_presets_v80',{p_action:'list'});if(scope!==billingPresetScopeV80()||rev!==state.revision)return;if(error)throw error;if(data?.tenant_id!==CURRENT_TENANT_ID)throw Error('院所資料不符');state.items=billingPresetValidateV80(data.items);state.selected.clear();billingPresetRenderV80();billingPresetEditorV80();billingPresetStatusV80('勾選常用項目，再按「加入勾選項目」；加入後可修改這次的數量與金額。');}
 catch(e){if(scope===billingPresetScopeV80()&&rev===state.revision)billingPresetStatusV80('讀取失敗：'+e.message+'。原本的增加收費細項仍可使用。',true);}
 finally{if(scope===billingPresetScopeV80()&&rev===state.revision){state.loading=false;billingPresetRenderV80();}}
}
function billingPresetOpenV80(){const panel=document.getElementById('bp80-panel');panel.open=true;if(billingPresetsV80.scope!==billingPresetScopeV80())billingPresetLoadV80();panel.scrollIntoView({block:'nearest'});}
function billingPresetApplyV80(){
 const state=billingPresetsV80;if(!familyAllowedV74()||state.scope!==billingPresetScopeV80()||state.loading||state.saving||inventoryCheckoutBusy||familyStateNowV74()?.pending){billingPresetStatusV80('請先完成讀取或目前的結帳操作。',true);return;}
 const items=state.items.filter(x=>state.selected.has(x.id));if(!items.length){billingPresetStatusV80('請先勾選要加入的常用項目。',true);return;}
 let count=0;for(const item of items){if(billingPresetExistsV80(item))continue;addInvoiceRow();const list=document.getElementById('invoiceItemsList'),row=list.lastElementChild;row.dataset.billingPresetV80=item.id;row.querySelector('.invoice-name').value=item.name;row.querySelector('.invoice-qty').value='1';row.querySelector('.invoice-price').value=String(item.price);row.querySelector('.invoice-name').dispatchEvent(new Event('input',{bubbles:true}));count++;}
 state.selected.clear();calculateInvoiceTotal();billingPresetRenderV80();billingPresetStatusV80('已加入 '+count+' 個項目；請核對本次數量及金額。');
}
function billingPresetEditorRowV80(item={id:crypto.randomUUID(),name:'',code:'',category:'一般處置',price:''}){
 const row=document.createElement('div');row.dataset.id=item.id;row.style.cssText='display:grid;grid-template-columns:1fr 1.2fr 2fr 1fr auto auto;gap:8px;margin:8px 0';
 for(const [key,label] of [['code','代碼（選填）'],['category','分類'],['name','項目名稱'],['price','預設金額']]){const input=document.createElement('input');input.dataset.field=key;input.setAttribute('aria-label',label);input.placeholder=label;input.value=String(item[key]);input.type=key==='price'?'number':'text';input.style.minWidth='0';if(key==='price'){input.min='0';input.step='.01';}else input.maxLength={code:30,category:50,name:100}[key];row.appendChild(input);}
 const saved=billingPresetsV80.items.some(x=>x.id===item.id);row.dataset.saved=saved?'1':'0';
 const edit=document.createElement('button');edit.type='button';edit.className='btn-secondary';edit.textContent=saved?'修改':'新增項目';edit.disabled=!saved;edit.onclick=()=>{for(const input of row.querySelectorAll('input'))input.readOnly=false;edit.textContent='編輯中';row.querySelector('[data-field="name"]').focus();};for(const input of row.querySelectorAll('input'))input.readOnly=saved;row.appendChild(edit);
 const remove=document.createElement('button');remove.type='button';remove.className='btn-danger';remove.textContent='刪除';remove.onclick=()=>row.remove();row.appendChild(remove);document.getElementById('bp80-editor').appendChild(row);return row;
}
function billingPresetEditorV80(){const editor=document.getElementById('bp80-editor');editor.replaceChildren();for(const item of billingPresetsV80.items)billingPresetEditorRowV80(item);billingPresetEditorRowV80();}
function billingPresetImportInvoiceV80(){
 if(CURRENT_PROFILE?.role!=='admin')return;
 const rows=[...document.querySelectorAll('#invoiceItemsList .list-row')].filter(row=>!row.dataset.serviceChargeId&&!row.dataset.medicineId&&!row.dataset.medicationGroupV64);
 const existing=new Set([...document.querySelectorAll('#bp80-editor [data-field="name"]')].map(e=>e.value.trim()));let count=0;
 for(const row of rows){const name=row.querySelector('.invoice-name')?.value.trim(),priceText=row.querySelector('.invoice-price')?.value;if(!name||!priceText||existing.has(name)||/檢驗|X\s*光|快篩|疫苗|超音波|生化|血球/.test(name))continue;const price=Number(priceText);if(!Number.isFinite(price)||price<0)continue;billingPresetEditorRowV80({id:crypto.randomUUID(),name,code:'',category:'一般處置',price});existing.add(name);count++;}
 billingPresetStatusV80('已帶入 '+count+' 筆手動明細到設定草稿，請核對後按「儲存常用清單」。');
}
function billingPresetReadEditorV80(){const items=[];for(const row of document.getElementById('bp80-editor').children){const value=key=>row.querySelector('[data-field="'+key+'"]').value.trim();if(!value('name')&&!value('code')&&!value('price'))continue;if(!value('price'))throw Error('請填預設金額，免費請填 0');items.push({id:row.dataset.id,name:value('name'),code:value('code'),category:value('category'),price:Number(value('price'))});}return billingPresetValidateV80(items);}
function billingPresetDraftChangedV801(){try{return JSON.stringify(billingPresetReadEditorV80())!==JSON.stringify(billingPresetsV80.items);}catch{return true;}}
function billingPresetAddV801(){
 const editor=document.getElementById('bp80-editor');let row=[...editor.children].find(r=>r.dataset.saved==='0'&&['name','code','price'].every(k=>!r.querySelector('[data-field="'+k+'"]').value.trim()));
 if(!row)row=billingPresetEditorRowV80();row.querySelector('[data-field="name"]').focus();row.scrollIntoView({block:'nearest'});billingPresetStatusV80('請在「新增項目」列填名稱及金額，再按儲存。既有項目需按「修改」才會變更。');
}
async function billingPresetSaveV80(){
 const state=billingPresetsV80;if(CURRENT_PROFILE?.role!=='admin'||state.scope!==billingPresetScopeV80()||state.loading||state.saving)return;
 let items;try{items=billingPresetReadEditorV80();}catch(e){billingPresetStatusV80(e.message,true);return;}
 const scope=billingPresetScopeV80(),rev=state.revision;state.saving=true;document.getElementById('bp80-save').disabled=true;billingPresetRenderV80();
 try{const {data,error}=await _supabase.rpc('manage_billing_presets_v80',{p_action:'save',p_items:items,p_expected:state.items});if(scope!==billingPresetScopeV80()||rev!==state.revision)return;if(error)throw error;if(!data?.saved||data.tenant_id!==CURRENT_TENANT_ID)throw Error('伺服器尚未確認儲存');state.items=billingPresetValidateV80(data.items);state.selected.clear();billingPresetEditorV80();billingPresetRenderV80();document.getElementById('bp80-query').value='';document.getElementById('bp80-category').value='';billingPresetRenderV80();billingPresetStatusV80('已儲存 '+state.items.length+' 筆常用項目。下方空白「新增項目」列可繼續加第二、第三筆；修改舊項目請按該列「修改」。');}
 catch(e){if(scope===billingPresetScopeV80()&&rev===state.revision)billingPresetStatusV80('尚未確認儲存：'+e.message+'。設定草稿仍保留。',true);}
 finally{if(scope===billingPresetScopeV80()&&rev===state.revision){state.saving=false;document.getElementById('bp80-save').disabled=false;billingPresetRenderV80();}}
}
const billingPresetSwitchV80=switchTab;switchTab=function(tab,...rest){if(billingPresetsV80.scope&&billingPresetsV80.scope!==billingPresetScopeV80())billingPresetResetV80();if(tab==='invoices')billingPresetsV80.selected.clear();const result=billingPresetSwitchV80.call(this,tab,...rest);if(tab==='invoices')billingPresetRenderV80();return result;};
const billingPresetLogoutV80=logoutSupabase;logoutSupabase=async function(...args){billingPresetResetV80();return billingPresetLogoutV80.apply(this,args);};
new MutationObserver(()=>{if(billingPresetsV80.items.length)billingPresetRenderV80();}).observe(document.getElementById('invoiceItemsList'),{childList:true});
document.getElementById('invoiceItemsList').addEventListener('input',()=>{if(billingPresetsV80.items.length)billingPresetRenderV80();});

