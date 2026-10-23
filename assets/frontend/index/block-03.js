var breedPictureTenant='',breedPictureReady=false,breedPictureEntries=new Map(),breedPictureCache=new Map(),breedPicturePending=new Map(),breedPictureGeneration=0,breedPictureDraft='',breedPictureBusy=false,breedPicturePreviewToken=0,breedPictureGalleryLimit=12;
function breedPictureKey(species,breed){
    let sp=String(species||'').trim().toLowerCase(),name=String(breed||'').trim().toLowerCase().replace(/\s+/g,'');
    if(['貓','猫','cat','feline'].includes(sp))sp='貓';if(['犬','狗','dog','canine'].includes(sp))sp='犬';
    if(sp==='貓'&&['英短','英國短毛','英国短毛','英國短毛貓','英国短毛猫','britishshorthair'].includes(name))name='英國短毛貓';
    return sp+'\u001f'+name;
}
function breedPictureMessage(message,error=false){const n=document.getElementById('breedPictureMessage');if(n){n.textContent=message;n.style.color=error?'#b45344':'#627b58';}}
function resetBreedPictureCache(){breedPictureGeneration++;breedPictureTenant='';breedPictureReady=false;breedPictureEntries.clear();breedPictureCache.clear();breedPicturePending.clear();breedPictureDraft='';breedPicturePreviewToken++;}
async function loadBreedPictures(){
    const tenant=CURRENT_TENANT_ID,generation=++breedPictureGeneration;breedPictureTenant=tenant;breedPictureReady=false;breedPictureEntries.clear();breedPictureCache.clear();breedPicturePending.clear();
    if(!tenant)return;
    try{
        const {data,error}=await _supabase.from('breed_images').select('species,breed_name,updated_at').eq('tenant_id',tenant);
        if(tenant!==CURRENT_TENANT_ID||generation!==breedPictureGeneration)return;
        if(error)throw error;
        for(const entry of data||[])breedPictureEntries.set(breedPictureKey(entry.species,entry.breed_name),entry);
        breedPictureReady=true;refreshManagedBreedAvatars();
        breedPictureMessage('品種圖片已載入。');
    }catch(error){if(tenant!==CURRENT_TENANT_ID||generation!==breedPictureGeneration)return;breedPictureMessage('品種圖片尚未啟用或無法讀取。請先執行「01_品種圖片管理_v28.sql」，若已執行請重試。'+(error.message?'（'+error.message+'）':''),true);refreshManagedBreedAvatars();}
    if(document.getElementById('breed_images')?.classList.contains('active'))renderBreedPictureManager();
}
async function fetchBreedPicture(entry){
    const tenant=breedPictureTenant,generation=breedPictureGeneration,key=breedPictureKey(entry.species,entry.breed_name),version=entry.updated_at;
    if(!tenant||tenant!==CURRENT_TENANT_ID)return null;
    const cache=breedPictureCache.get(key);if(cache&&cache.version===version)return cache.src;
    if(breedPicturePending.has(key))return breedPicturePending.get(key);
    const pending=(async()=>{
        try{const {data,error}=await _supabase.from('breed_images').select('image_data,updated_at').eq('tenant_id',tenant).eq('species',entry.species).eq('breed_name',entry.breed_name).maybeSingle();
            if(error||!data||tenant!==CURRENT_TENANT_ID||generation!==breedPictureGeneration||breedPictureEntries.get(key)?.updated_at!==version||data.updated_at!==version)return null;
            if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image_data)||data.image_data.length>140000)return null;
            breedPictureCache.set(key,{version,src:data.image_data});return data.image_data;
        }catch(e){return null;}finally{if(breedPicturePending.get(key)===pending)breedPicturePending.delete(key);}
    })();breedPicturePending.set(key,pending);return pending;
}
function setJournalAvatar(node,breed,species){
    node.dataset.journalBreed=breed||'';node.dataset.journalSpecies=species||'';
    const key=breedPictureKey(species,breed),entry=breedPictureTenant===CURRENT_TENANT_ID?breedPictureEntries.get(key):null;
    node.dataset.breedPictureToken=key+'|'+(entry?.updated_at||'default');
    setJournalDefaultAvatar(node,breed,species);
    if(!entry)return;
    const tenant=breedPictureTenant,token=node.dataset.breedPictureToken;
    fetchBreedPicture(entry).then(src=>{if(src&&tenant===CURRENT_TENANT_ID&&node.dataset.breedPictureToken===token){const img=document.createElement('img');img.src=src;img.alt=String(breed||'品種')+'品種示意（非病患本人）';node.replaceChildren(img);}});
}
function refreshManagedBreedAvatars(){document.querySelectorAll('[data-journal-breed]').forEach(n=>setJournalAvatar(n,n.dataset.journalBreed,n.dataset.journalSpecies));}
async function openBreedPictureManager(){if(CURRENT_PROFILE?.role!=='admin')return;await loadBreedPictures();renderBreedPictureManager();}
function renderBreedPictureManager(){
    if(CURRENT_PROFILE?.role!=='admin')return;
    const select=document.getElementById('breedPictureSpecies'),selected=select.value;select.replaceChildren();
    for(const name of Object.keys(speciesBreedsMap)){const op=document.createElement('option');op.value=name;op.textContent=name;select.append(op);}
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    updateBreedPictureOptions();
}
function updateBreedPictureOptions(){
    const species=document.getElementById('breedPictureSpecies').value,select=document.getElementById('breedPictureBreed'),old=select.value;select.replaceChildren();
    const names=new Set(speciesBreedsMap[species]||[]);for(const e of breedPictureEntries.values())if(e.species===species)names.add(e.breed_name);
    for(const name of names){const op=document.createElement('option');op.value=name;op.textContent=name;select.append(op);}
    if([...select.options].some(o=>o.value===old))select.value=old;
    resetBreedPictureDraft();renderBreedPictureGallery();
}
function resetBreedPictureDraft(){
    breedPictureDraft='';breedPicturePreviewToken++;document.getElementById('breedPictureFile').value='';
    const preview=document.getElementById('breedPicturePreview');setJournalAvatar(preview,document.getElementById('breedPictureBreed').value,document.getElementById('breedPictureSpecies').value);
    document.getElementById('breedPictureDraftNote').textContent='目前使用的品種示意；選擇檔案後請按儲存。';
    document.getElementById('breedPictureSave').disabled=breedPictureBusy||!breedPictureReady;
}
async function compressBreedPicture(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('請選擇 PNG、JPG 或 WebP 圖片。');
    if(file.size>10*1024*1024)throw new Error('圖片請小於 10 MB。');
    const url=URL.createObjectURL(file);
    try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('無法讀取此圖片，請換一張。'));img.src=url;});
        if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>40000000)throw new Error('圖片尺寸太大，請先縮小。');
        let edge=512;for(let i=0;i<7;i++){const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const src=canvas.toDataURL('image/webp',0.82);if(src.length<=120000)return src;edge=Math.round(edge*.8);}
        throw new Error('圖片仍過大，請換一張較小的圖片。');
    }finally{URL.revokeObjectURL(url);}
}
async function previewBreedPictureFile(){
    if(CURRENT_PROFILE?.role!=='admin'||breedPictureBusy)return;
    const token=++breedPicturePreviewToken,file=document.getElementById('breedPictureFile').files[0];breedPictureDraft='';if(!file)return;
    try{const src=await compressBreedPicture(file);if(token!==breedPicturePreviewToken)return;breedPictureDraft=src;
        const img=document.createElement('img');img.src=src;img.alt='待儲存的品種圖片';document.getElementById('breedPicturePreview').replaceChildren(img);
        document.getElementById('breedPictureDraftNote').textContent='圖片已準備好，尚未儲存。';breedPictureMessage('預覽完成，請按「儲存品種圖片」。');
    }catch(error){if(token===breedPicturePreviewToken)breedPictureMessage(error.message,true);}
}
function setBreedPictureBusy(busy){breedPictureBusy=busy;for(const id of ['breedPictureSpecies','breedPictureBreed','breedPictureFile','breedPictureSave'])document.getElementById(id).disabled=busy||id==='breedPictureSave'&&!breedPictureReady;document.querySelectorAll('#breedPictureGallery button').forEach(n=>n.disabled=busy);}
async function saveBreedPicture(){
    if(CURRENT_PROFILE?.role!=='admin'||breedPictureBusy)return;
    if(!breedPictureReady||breedPictureTenant!==CURRENT_TENANT_ID){breedPictureMessage('請先啟用品種圖片資料表並重新載入。',true);return;}
    if(!breedPictureDraft){breedPictureMessage('請先選擇要上傳的圖片。',true);return;}
    const tenant=CURRENT_TENANT_ID,species=document.getElementById('breedPictureSpecies').value,breed=document.getElementById('breedPictureBreed').value,src=breedPictureDraft;
    if(!species||!breed)return;
    const prior=breedPictureEntries.get(breedPictureKey(species,breed)),storedName=prior?.breed_name||breed,storedSpecies=prior?.species||species;
    setBreedPictureBusy(true);breedPictureMessage('正在儲存圖片…');
    try{const {data,error}=await _supabase.from('breed_images').upsert({tenant_id:tenant,species:storedSpecies,breed_name:storedName,image_data:src,updated_at:new Date().toISOString()},{onConflict:'tenant_id,species,breed_name'}).select('species,breed_name,updated_at').single();
        if(error)throw error;if(!data)throw new Error('沒有收到儲存確認，請重新載入確認。');if(tenant!==CURRENT_TENANT_ID)return;
        const key=breedPictureKey(species,breed);breedPictureEntries.set(key,data);breedPictureCache.set(key,{version:data.updated_at,src});breedPictureDraft='';breedPicturePreviewToken++;
        document.getElementById('breedPictureFile').value='';refreshManagedBreedAvatars();renderBreedPictureGallery();
        document.getElementById('breedPictureDraftNote').textContent='已儲存，候診卡與門診會套用這張圖片。';breedPictureMessage('✓ 已儲存「'+breed+'」圖片，候診與門診已同步。');
    }catch(error){if(tenant===CURRENT_TENANT_ID)breedPictureMessage('儲存失敗：'+error.message,true);}finally{setBreedPictureBusy(false);}
}
async function removeBreedPicture(species,breed){
    if(CURRENT_PROFILE?.role!=='admin'||breedPictureBusy||breedPictureTenant!==CURRENT_TENANT_ID)return;
    const key=breedPictureKey(species,breed),entry=breedPictureEntries.get(key);if(!entry)return;
    if(!confirm('移除「'+breed+'」的品種圖片？品種及寵物資料會保留，圖卡回復預設圖示。'))return;
    const tenant=CURRENT_TENANT_ID;setBreedPictureBusy(true);
    try{const {data,error}=await _supabase.from('breed_images').delete().eq('tenant_id',tenant).eq('species',entry.species).eq('breed_name',entry.breed_name).eq('updated_at',entry.updated_at).select('species,breed_name');
        if(error)throw error;if(!data||data.length!==1)throw new Error('圖片可能已被更換，請重新載入再確認。');if(tenant!==CURRENT_TENANT_ID)return;
        breedPictureEntries.delete(key);breedPictureCache.delete(key);refreshManagedBreedAvatars();renderBreedPictureGallery();resetBreedPictureDraft();breedPictureMessage('✓ 已移除圖片，品種及寵物資料保留。');
    }catch(error){if(tenant===CURRENT_TENANT_ID)breedPictureMessage('移除失敗：'+error.message,true);}finally{setBreedPictureBusy(false);}
}
function renderBreedPictureGallery(){
    const container=document.getElementById('breedPictureGallery');container.replaceChildren();
    const species=document.getElementById('breedPictureSpecies').value,entries=[...breedPictureEntries.values()].filter(e=>e.species===species);
    for(const entry of entries.slice(0,breedPictureGalleryLimit)){const tile=document.createElement('article');tile.className='breed-picture-tile';const avatar=document.createElement('div');avatar.className='breed-picture-thumb';setJournalAvatar(avatar,entry.breed_name,entry.species);
        const name=document.createElement('p');name.textContent=entry.breed_name;const button=document.createElement('button');button.type='button';button.className='btn-danger';button.textContent='移除圖片';button.disabled=breedPictureBusy;button.onclick=()=>removeBreedPicture(entry.species,entry.breed_name);tile.append(avatar,name,button);container.append(tile);}
    if(!entries.length){const p=document.createElement('p');p.textContent='此種類還沒有自行上傳的品種圖片。';container.append(p);}
    document.getElementById('breedPictureMore').hidden=entries.length<=breedPictureGalleryLimit;
}
function showMoreBreedPictures(){breedPictureGalleryLimit+=12;renderBreedPictureGallery();}
