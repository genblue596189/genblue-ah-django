
// v91.35：獨立 Google 日曆同步設定，不變更預約審核流程。
(function(){
 const panel=document.getElementById('online_booking');if(!panel)return;
 const root=document.createElement('details');root.className='card';root.id='google-calendar-v9135';root.hidden=true;
 root.innerHTML='<summary>Google 日曆同步（管理者）</summary><p>將已確認的線上預約同步到醫院專用日曆，約每5分鐘更新。顯示寵物、飼主姓名、醫師與預約事項；不通知飼主。取消時以紅色「已取消」保留。每筆暫以30分鐘顯示。</p><p>首次設定請搭配 google_calendar_v91_35.sql 與 Google 同步程式。產生設定會更換連線金鑰，舊設定立即失效。</p><button type="button" data-gcal="status">查看連線設定</button><button type="button" data-gcal="connect" style="background:#2563eb">產生 Google 連線設定</button><button type="button" data-gcal="disconnect" style="background:#b91c1c">停用連線</button><p data-gcal="message" role="status"></p><div data-gcal="setup" hidden><p>請在醫院 Google 帳號的 Apps Script 建立「設定.gs」，貼上下方內容，再執行 configureGenblue。此設定僅供自己的同步程式使用，請勿公開。</p><textarea data-gcal="code" readonly aria-label="Google 連線設定程式" style="width:100%;height:190px;font-family:monospace"></textarea><button type="button" data-gcal="copy">複製設定程式</button></div>';
 panel.append(root);const el=x=>root.querySelector('[data-gcal="'+x+'"]'),scope=()=>CURRENT_PROFILE?.role==='admin'&&CURRENT_USER?.id&&CURRENT_TENANT_ID?CURRENT_USER.id+'|'+CURRENT_TENANT_ID:'',message=x=>el('message').textContent=x;
 let seen='',busy=false;function reset(){el('code').value='';el('setup').hidden=true;message('');root.open=false;}
 function refresh(){const s=scope();if(s!==seen){seen=s;reset()}root.hidden=!s;}refresh();setInterval(refresh,1000);
 async function action(kind){if(busy)return;const expected=scope(),tenant=CURRENT_TENANT_ID;if(!expected)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{el('code').value='';el('setup').hidden=true;message('正在讀取連線設定…');let token=null;
 if(kind==='connect'){const bytes=crypto.getRandomValues(new Uint8Array(32));token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
 const {data,error}=await _supabase.rpc('google_calendar_admin_v9135',{p_action:kind,p_token:token});if(expected!==scope())return;
 if(error)throw Error(error.code==='PGRST202'?'請先執行 google_calendar_v91_35.sql，再重新開啟設定。':error.message);
 if(data?.tenant_id!==tenant)throw Error('院所回覆不符，請重新登入核對。');
 if(kind==='connect'){
 const url=String(_supabase.supabaseUrl||'').replace(/\/$/,''),key=String(_supabase.supabaseKey||'');if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error('無法取得目前專案的連線資訊。');
 if(key.split('.').length===3){let claim;try{claim=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch(e){throw Error('公開金鑰格式無法確認')};if(claim.role!=='anon')throw Error('同步僅能使用公開 anon 金鑰。');}
 const config={GB_URL:url,GB_ANON:key,GB_TOKEN:token,GB_TENANT:tenant};
 el('code').value='function configureGenblue() {\n  const p = PropertiesService.getScriptProperties();\n  const next = '+JSON.stringify(config,null,2)+';\n  const old = p.getProperties();\n  if (old.GB_TENANT && (old.GB_TENANT !== next.GB_TENANT || old.GB_URL !== next.GB_URL)) throw Error("此腳本已綁定其他醫院，請建立新的 Apps Script 專案");\n  p.setProperties(next);\n  console.log("連線設定已保存；接著執行 previewGenblueSync");\n}';
 el('setup').hidden=false;message('院內連線已啟用；仍需完成 Google 授權並啟動同步排程，才會出現在日曆。');
 }else message(data.enabled?'院內連線已啟用。Google 排程的執行結果請至 Apps Script「執行項目」核對。':'院內連線已停用；Google 日曆中原活動保留。');
 }catch(e){if(expected===scope())message('設定未完成：'+e.message)}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);refresh();}}
 ['status','connect','disconnect'].forEach(k=>el(k).onclick=()=>action(k));
 el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(el('code').value);message('已複製設定程式。')}catch(e){el('code').focus();el('code').select();message('請按 Ctrl+C 複製已選取的設定。')}};
 const version=document.getElementById('genblueVersionV84');if(version)version.textContent=' · v91.35';
})();

