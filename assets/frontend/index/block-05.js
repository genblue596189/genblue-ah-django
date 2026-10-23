var appointmentPetSearchLimit=30,appointmentPetSearchLastQuery='';
function appointmentPetSearchLabel(pet){return (pet.name||'未填姓名')+' · 飼主：'+(pet.owner_name||'未填姓名')+' · 新：'+(pet.system_code||'—')+'／舊：'+(pet.owner_code||'—');}
function clearAppointmentPetSearch(){
    const select=document.getElementById('appointmentPetSelect');select.replaceChildren(new Option('-- 請搜尋並選擇寵物 --',''));select.value='';delete select.dataset.selectedTenant;
    const input=document.getElementById('appointmentPetSearch');input.value='';input.disabled=false;document.getElementById('appointmentPetChosen').textContent='尚未選定寵物。';document.getElementById('appointmentPetResults').replaceChildren();document.getElementById('appointmentPetResults').hidden=true;appointmentPetSearchLastQuery='';
}
function invalidateAppointmentPetSearch(){
    if(editingAppointmentPetId)return;
    const select=document.getElementById('appointmentPetSelect');select.value='';delete select.dataset.selectedTenant;
    document.getElementById('appointmentPetChosen').textContent='輸入條件後按 Enter，再從結果選定寵物。';document.getElementById('appointmentPetResults').hidden=true;appointmentPetSearchLimit=30;
}
function chooseAppointmentPet(pet,editing=false){
    if(!CURRENT_TENANT_ID||(!editing&&editingAppointmentPetId))return;
    if(!editing){const current=allPetsListForDropdown.find(p=>p.id===pet.id&&p.owner_id===pet.owner_id);if(!current)return;pet=current;}
    const select=document.getElementById('appointmentPetSelect'),value=JSON.stringify(pet);
    select.replaceChildren(new Option('-- 請搜尋並選擇寵物 --',''),new Option(appointmentPetSearchLabel(pet),value));select.value=value;select.dataset.selectedTenant=CURRENT_TENANT_ID;
    document.getElementById('appointmentPetSearch').value=(pet.name||'')+' '+(pet.owner_name||'');document.getElementById('appointmentPetSearch').disabled=editing;
    document.getElementById('appointmentPetChosen').textContent='✓ 已選定：'+appointmentPetSearchLabel(pet);
    document.getElementById('appointmentPetResults').hidden=true;document.getElementById('appointmentPetSearchClear').disabled=editing;
}
function searchAppointmentPets(more=false){
    if(editingAppointmentPetId)return;
    const query=document.getElementById('appointmentPetSearch').value.trim().toLowerCase(),container=document.getElementById('appointmentPetResults');container.replaceChildren();container.hidden=false;
    if(!more||query!==appointmentPetSearchLastQuery)appointmentPetSearchLimit=30;appointmentPetSearchLastQuery=query;
    const status=document.createElement('p');status.className='appointment-search-status';container.append(status);
    if(!query){status.textContent='請輸入寵物名、飼主、電話、新編號或舊病歷號。';return;}
    const tokens=query.split(/\s+/).filter(Boolean),matched=allPetsListForDropdown.filter(p=>{const text=[p.name,p.owner_name,p.owner_mobile,p.owner_phone,p.system_code,p.owner_code,p.microchip].filter(Boolean).join(' ').toLowerCase();return tokens.every(token=>text.includes(token));});
    status.textContent=matched.length?'找到 '+matched.length+' 隻寵物。請核對飼主後點選；目前顯示前 '+Math.min(matched.length,appointmentPetSearchLimit)+' 筆。':'目前已載入的資料中查無符合病患；若背景仍在載入，完成後會更新結果。';
    const tenant=CURRENT_TENANT_ID;
    for(const pet of matched.slice(0,appointmentPetSearchLimit)){
        const button=document.createElement('button');button.type='button';button.className='appointment-pet-result';button.textContent=appointmentPetSearchLabel(pet)+'\n'+[pet.species,pet.breed,pet.owner_mobile,pet.owner_phone].filter(Boolean).join(' · ');
        button.addEventListener('click',()=>{if(tenant===CURRENT_TENANT_ID)chooseAppointmentPet(pet);});container.append(button);
    }
    if(matched.length>appointmentPetSearchLimit){const moreButton=document.createElement('button');moreButton.type='button';moreButton.className='journal-quiet';moreButton.textContent='顯示更多結果';moreButton.onclick=()=>{appointmentPetSearchLimit+=30;searchAppointmentPets(true);};container.append(moreButton);}
}
function onAppointmentPetSearchKey(event){if(event.key==='Enter'){event.preventDefault();searchAppointmentPets();}else if(event.key==='Escape'){document.getElementById('appointmentPetResults').hidden=true;}}
function syncAppointmentPetSearchSelection(){
    const select=document.getElementById('appointmentPetSelect');
    if(select.dataset.selectedTenant&&select.dataset.selectedTenant!==CURRENT_TENANT_ID){clearAppointmentPetSearch();return;}
    if(!document.getElementById('appointmentPetResults').hidden&&appointmentPetSearchLastQuery)searchAppointmentPets(true);
}
