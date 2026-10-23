
// v93_1: link to the existing registration form without clearing its contents.
function openHomeRegistrationV931(){
 switchTab('owners_pets');
 const panel=document.getElementById('owners_pets');
 if(!panel?.classList.contains('active'))return;
 const owner=document.getElementById('intOwnerName'),pet=document.getElementById('intPetName');
 (owner?.closest('.card')||panel).scrollIntoView?.({behavior:'smooth',block:'start'});
 const first=owner&&!owner.readOnly&&!owner.disabled?owner:pet;
 first?.focus({preventScroll:true});
}

