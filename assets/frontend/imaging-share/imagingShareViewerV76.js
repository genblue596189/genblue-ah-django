
const PROJECT_URL=window.GENBLUE_CONFIG.supabaseUrl;
const ENDPOINT=PROJECT_URL+'/functions/v1/imaging-share-v76';
const TOKEN=location.hash.slice(1),$=id=>document.getElementById(id);
let shared=null,index=0,loadedAt=0,busy=false,expiryTimer=null,downloadBusy=false;
function status(text){$('status').textContent=text;}
function scheduleExpiry(){if(expiryTimer)clearTimeout(expiryTimer);if(!shared)return;const remaining=new Date(shared.expires_at)-new Date();if(remaining<=0){fail('這份分享已到期。',false);return;}expiryTimer=setTimeout(scheduleExpiry,Math.min(2147483647,remaining));}
function reset(){shared=null;$('viewer').hidden=true;$('xray').removeAttribute('src');$('choices').replaceChildren();$('patient').textContent='';$('expiry').textContent='';if(expiryTimer)clearTimeout(expiryTimer);}
function fail(text,retry=true){reset();status(text);$('retry').hidden=!retry;}
function dateText(v){const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('zh-TW'):'未填日期';}
function validImage(a){try{const u=new URL(a.url);return ['image/jpeg','image/png'].includes(a.mime)&&u.protocol==='https:'&&u.origin===new URL(PROJECT_URL).origin;}catch{return false;}}
async function load(keepIndex=true){
 if(busy)return false;if(!/^[0-9a-f]{64}$/.test(TOKEN)){fail('連結不完整，請重新掃描醫院提供的 QR Code。',false);return false;}
 busy=true;$('retry').hidden=true;status('正在讀取分享影像…');
 try{
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN}),cache:'no-store',referrerPolicy:'no-referrer'});
  let data;try{data=await response.json();}catch{throw Error('分享服務尚未啟用，請聯絡醫院。');}
  if(!response.ok){fail(data.error||'這份分享不存在、已到期或已停止。',response.status>=500);return false;}
  if(!data||!Array.isArray(data.images)||!data.images.length||data.images.length>20||!data.images.every(validImage)||!Number.isFinite(new Date(data.expires_at).getTime()))throw Error('影像資料不完整，請聯絡醫院。');
  if(new Date(data.expires_at)<=new Date()){fail('這份分享已到期。',false);return false;}
  shared=data;loadedAt=Date.now();index=keepIndex?Math.min(index,data.images.length-1):0;
  $('patient').textContent='寵物：'+data.pet_name+'｜共 '+data.images.length+' 張 X 光';$('expiry').textContent='分享到期：'+dateText(data.expires_at);
  $('choices').replaceChildren();data.images.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.onclick=()=>choose(i);$('choices').appendChild(b);});
  $('viewer').hidden=false;show();scheduleExpiry();return true;
 }catch(e){fail(e.message||'網路連線失敗，請稍後再試。');return false;}
 finally{busy=false;}
}
function show(){if(!shared)return;const a=shared.images[index];$('info').textContent=a.label+'｜'+dateText(a.study_date)+'｜'+(a.body_part||'未填部位');$('zoom').value='100';$('xray').style.width='100%';$('xray').src=a.url;$('xray').alt=a.label;[...$('choices').children].forEach((b,i)=>b.classList.toggle('active',i===index));$('prev').disabled=index===0;$('next').disabled=index===shared.images.length-1;status('影像載入中…');}
async function choose(i){if(!shared||busy)return;index=Math.max(0,Math.min(i,shared.images.length-1));if(Date.now()-loadedAt>45000)await load();else show();}
$('xray').onload=()=>status('可使用放大滑桿查看細節，也可下載影像。');
$('xray').onerror=()=>status('影像暫時無法開啟，請按「重新載入」。');
$('zoom').oninput=()=>{$('xray').style.width=$('zoom').value+'%';};
$('prev').onclick=()=>choose(index-1);$('next').onclick=()=>choose(index+1);$('reload').onclick=()=>load();$('retry').onclick=()=>load();
$('download').onclick=async()=>{if(!shared||busy||downloadBusy)return;downloadBusy=true;$('download').disabled=true;try{if(!await load())return;const a=shared.images[index],response=await fetch(a.url,{cache:'no-store',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('下載失敗，請重新載入後再試。');const blob=await response.blob();if(!['image/jpeg','image/png'].includes(blob.type))throw Error('影像檔案類型不正確，請聯絡醫院。');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='X光影像_'+(index+1)+(a.mime==='image/png'?'.png':'.jpg');document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('已送出下載，請查看手機或電腦的下載檔案。');}catch(e){status(e.message);}finally{downloadBusy=false;$('download').disabled=false;}};
load(false);
