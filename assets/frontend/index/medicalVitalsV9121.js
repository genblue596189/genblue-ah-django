
(function(){
 function confirmWeight(){try{medicalWeightConfirmedV9121={scope:medicalWeightScope(),weight:readMedicalWeightForSave()};}catch(e){medicalWeightConfirmedV9121=null;}}
 const input=document.getElementById('medicalPetWeightInput');
 input.addEventListener('input',confirmWeight);
 input.parentElement.querySelector('button[onclick="saveMedicalWeightOnBlur()"]')?.addEventListener('click',confirmWeight);
 document.getElementById('genblueVersionV84').textContent=' · v91.22';
})();
