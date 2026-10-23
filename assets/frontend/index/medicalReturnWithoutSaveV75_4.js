
function returnToWaitingWithoutSaveV75_4(){
 if(medicalSaveBusy){alert('病歷正在儲存，請等這次儲存完成。');return;}
 if(currentPetId)collectCurrentMedicalState();
 switchTab('appointments');
}
