
function vaccineIntervalV9114(name,days){
 const value=String(name||'').normalize('NFKC');
 const month=/(?:一個月|一月期|1個月|1月期|一個月期|1個月期)/.test(value),year=/(?:一年|1年)/.test(value);
 if(month&&year)return null;if(month)return {months:1};if(year)return {months:12};
 const n=Number(days);return Number.isInteger(n)&&n>0&&n<=3650?{days:n}:null;
}
function vaccineDueDateV9114(date,interval){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!interval)return '';
 const original=new Date(date+'T12:00:00Z');if(!Number.isFinite(original.getTime())||original.toISOString().slice(0,10)!==date)return '';
 if(interval.months){const day=original.getUTCDate();original.setUTCDate(1);original.setUTCMonth(original.getUTCMonth()+interval.months);const last=new Date(Date.UTC(original.getUTCFullYear(),original.getUTCMonth()+1,0)).getUTCDate();original.setUTCDate(Math.min(day,last));}
 else original.setUTCDate(original.getUTCDate()+interval.days);
 return original.toISOString().slice(0,10);
}
function syncVaccineDueV9114(fromSelection=false){
 const select=document.getElementById('vacTypeSelect'),administered=document.getElementById('vacAdministeredDate'),due=document.getElementById('vacNextDueDate'),hint=document.getElementById('vaccineDueHintV9114');
 if(!select.value){if(fromSelection)due.value='';hint.textContent='選擇疫苗後依本次施打日期帶入，可手動修改。';return;}
 if(!administered.value&&fromSelection)administered.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
 const interval=vaccineIntervalV9114(select.value,select.selectedOptions[0]?.dataset.intervalDays),date=vaccineDueDateV9114(administered.value,interval);
 if(date){due.value=date;hint.textContent='已依本次施打日期帶入'+(interval.months===1?'一個月':interval.months===12?'一年':interval.days+'天')+'後日期，可手動修改。';}
 else{if(fromSelection)due.value='';hint.textContent=interval?'請填寫有效的本次施打日期。':'此疫苗未設定明確間隔，請手動填寫下次日期。';}
}
document.getElementById('vacTypeSelect').addEventListener('change',()=>syncVaccineDueV9114(true));
document.getElementById('vacAdministeredDate').addEventListener('change',()=>syncVaccineDueV9114());
document.getElementById('genblueVersionV84').textContent=' · v91.14';
