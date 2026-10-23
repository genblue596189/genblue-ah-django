
// v92_4：預設精簡月曆；同時載入原有醫院與線上預約專用 Google 日曆。
(function(){
 const panel=document.getElementById('online_booking');if(!panel)return;
 const root=document.createElement('details');root.id='googleCalendarEmbedV9136';root.className='card';root.hidden=true;
 root.innerHTML='<summary style="font-size:1.1rem;font-weight:700;color:#1d4ed8;cursor:pointer">📅 Google 日曆（系統內查看）</summary><details data-gce="settings"><summary>設定要顯示的 Google 日曆</summary><p>若原有行程與線上預約分別放在不同日曆，請把兩個日曆 ID 都加入，每行一個。Google 日曆 → 設定 → 選擇日曆 → 整合日曆 → 複製「日曆 ID」。線上預約的專用日曆名稱為「醫院名稱｜已確認預約」。</p><form data-gce="form"><label>Google 日曆 ID（每行一個，也可貼官方內嵌網址）<textarea data-gce="input" rows="3" autocomplete="off" spellcheck="false" placeholder="原有醫院日曆 ID&#10;線上預約專用日曆 ID" required style="width:100%;max-width:760px;min-height:90px"></textarea></label><div><button type="submit" style="background:#2563eb">儲存並顯示日曆</button><button type="button" data-gce="clear" style="background:#b91c1c">清除本機顯示設定</button></div></form><p>此設定保存於目前瀏覽器，依院所與登入帳號分開。只影響畫面顯示，不會更換同步金鑰或重新建立日曆。</p></details><div data-gce="tools" hidden style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label>顯示方式 <select data-gce="mode" aria-label="Google 日曆顯示方式"><option value="MONTH">月（精簡）</option><option value="WEEK">週</option><option value="AGENDA">預約清單</option></select></label><button type="button" data-gce="reload">重新載入日曆</button><button type="button" data-gce="collapse">收合日曆</button></div><p data-gce="message" role="status" aria-live="polite" style="margin:8px 0"></p><div data-gce="frame" style="overflow:auto;max-width:100%"></div><p data-gce="help" hidden style="color:#64748b;font-size:13px;margin:8px 0">請使用有這些日曆權限的 Google 帳號。月曆顯示「還有幾個」時，點選即可查看當天更多活動。若仍缺線上預約，請核對專用日曆 ID、當天日期及 Google 同步排程的執行結果。預約改期與取消仍請在院務系統操作。</p>';
 const heading=panel.querySelector('h1,h2');if(heading)heading.after(root);else panel.prepend(root);
 const el=n=>root.querySelector('[data-gce="'+n+'"]');let seen='',calendarIds=[],mode='MONTH',loading=false;
 const allowed=()=>!!CURRENT_USER?.id&&!!CURRENT_TENANT_ID&&(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_appointment??['staff','doctor'].includes(CURRENT_PROFILE?.role)));
 const scope=()=>allowed()?JSON.stringify([String(_supabase.supabaseUrl||''),String(CURRENT_TENANT_ID),CURRENT_USER.id]):'';
 const key=()=> 'genblue-google-embed-v9136:'+scope();
 function parseCalendarIds(text){
  const ids=[];for(const token of String(text||'').trim().split(/[\s,]+/).filter(Boolean)){
   let candidates=[token];if(/^https?:/i.test(token)){
    let url;try{url=new URL(token)}catch(e){throw Error('日曆網址格式不正確')}
    if(url.protocol!=='https:'||url.hostname!=='calendar.google.com'||url.port||url.username||url.password||url.pathname!=='/calendar/embed')throw Error('請貼上 Google 日曆 ID 或官方內嵌網址');
    candidates=url.searchParams.getAll('src');if(!candidates.length)throw Error('內嵌網址沒有日曆 ID');
   }
   for(const id of candidates){if(id.length>320||!/^[a-zA-Z0-9._%+\-#]+@[a-zA-Z0-9.\-]+$/.test(id))throw Error('請貼上「日曆 ID」（每行一個），不是私人 iCal 網址、HTML 程式碼或連線金鑰');if(!ids.includes(id))ids.push(id)}
  }
  if(!ids.length)throw Error('請先輸入至少一個 Google 日曆 ID');if(ids.length>5)throw Error('一次最多顯示5個 Google 日曆');return ids;
 }
 function unload(){el('frame').replaceChildren();el('help').hidden=true;}
 // 保留第一個 id 欄位，舊版程式仍可讀取原有日曆。
 function remember(){try{localStorage.setItem(key(),JSON.stringify({version:1,embed_version:924,id:calendarIds[0],ids:calendarIds,mode:mode}));return true}catch(e){return false}}
 function render(force=false){
  if(!root.open||!allowed()||seen!==scope()||!panel.classList.contains('active')){unload();return;}
  el('tools').hidden=!calendarIds.length;
  if(!calendarIds.length){unload();el('settings').open=true;el('message').textContent='請先設定醫院及線上預約專用日曆 ID。';return;}
  const url=new URL('https://calendar.google.com/calendar/embed');for(const id of calendarIds)url.searchParams.append('src',id);
  for(const [k,v]of Object.entries({ctz:'Asia/Taipei',mode:mode,hl:'zh_TW',showPrint:'0',showCalendars:'1',showTz:'0'}))url.searchParams.set(k,v);
  let frame=el('frame').querySelector('iframe');if(!frame){frame=document.createElement('iframe');frame.title='醫院與線上預約 Google 日曆';frame.setAttribute('referrerpolicy','no-referrer');el('frame').append(frame);}
  frame.style.cssText='border:0;width:100%;min-width:500px;height:'+(mode==='WEEK'?'680px':'520px');
  if(force||frame.getAttribute('src')!==url.href)frame.setAttribute('src',url.href);
  el('help').hidden=false;el('message').textContent='目前設定載入 '+calendarIds.length+' 個日曆。'+(calendarIds.length===1?'若原有行程與線上預約分屬不同日曆，請在設定加入另一個日曆 ID。':'')+'實際活動及存取權限以 Google 畫面為準。';
 }
 function refresh(){
  const s=scope();if(s!==seen){seen=s;loading=true;unload();root.open=false;calendarIds=[];mode='MONTH';el('input').value='';el('message').textContent='';el('tools').hidden=true;el('settings').open=false;
   if(s){try{const c=JSON.parse(localStorage.getItem(key())||'null');if(c?.version===1){const ids=Array.isArray(c.ids)?c.ids.join('\n'):c.id;calendarIds=parseCalendarIds(ids);mode=c.embed_version===924&&['WEEK','MONTH','AGENDA'].includes(c.mode)?c.mode:c.mode==='AGENDA'?'AGENDA':'MONTH';el('input').value=calendarIds.join('\n')}}catch(e){calendarIds=[];el('message').textContent='尚未取得本機日曆設定，請展開設定重新輸入。';}}
   el('mode').value=mode;loading=false;
  }root.hidden=!s;
 }
 root.addEventListener('toggle',e=>{if(e.target!==root||loading)return;render();});
 el('form').onsubmit=e=>{e.preventDefault();if(!allowed()||scope()!==seen)return;try{const next=parseCalendarIds(el('input').value);calendarIds=next;el('input').value=next.join('\n');const saved=remember();el('settings').open=false;render();if(!saved)el('message').textContent+=' 瀏覽器無法保存設定，下次需重新輸入。'}catch(err){el('message').textContent=err.message;}};
 el('mode').onchange=()=>{if(!allowed()||scope()!==seen)return;mode=['WEEK','MONTH','AGENDA'].includes(el('mode').value)?el('mode').value:'MONTH';const saved=remember();render();if(!saved)el('message').textContent+=' 瀏覽器無法保存本機設定。';};
 el('reload').onclick=()=>render(true);el('collapse').onclick=()=>{root.open=false;unload();};
 el('clear').onclick=()=>{if(!allowed()||scope()!==seen)return;let removed=true;try{localStorage.removeItem(key())}catch(e){removed=false}calendarIds=[];el('input').value='';unload();el('tools').hidden=true;el('settings').open=true;el('message').textContent=removed?'本機顯示設定已清除，Google 預約同步與原日曆保留。':'本次顯示已清除，但瀏覽器未允許刪除保存設定。';};
 const originalSwitch=switchTab;switchTab=function(tab,...args){if(tab!=='online_booking'){root.open=false;unload()}const result=originalSwitch.call(this,tab,...args);refresh();return result;};
 const originalLogout=logoutSupabase;logoutSupabase=function(...args){root.open=false;unload();root.hidden=true;el('input').value='';return originalLogout.apply(this,args);};
 refresh();setInterval(refresh,1000);
 const version=document.getElementById('genblueVersionV84');if(version)version.textContent=' · v94_9';
})();

