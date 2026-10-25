// v27: presentation only; all writes and role checks remain in the existing v20 functions.
var journalScheduleFutureMode=false;
function updateJournalPageLayout(tabId){
    const search=document.getElementById('journalLiveSearch');
    const dock=document.getElementById('journalHomeSearchDock');
    if(search&&dock&&search.parentElement!==dock)dock.appendChild(search);
    if(search)search.hidden=tabId!=='appointments';
    const headerDock=document.getElementById('journalHeaderSearchDock');if(headerDock)headerDock.hidden=true;
    if(tabId!=='appointments' && typeof closeGlobalSearchResults==='function')closeGlobalSearchResults();
    const nav=document.getElementById('nav-'+tabId),more=document.getElementById('journalMoreNav');
    if(nav&&more&&more.contains(nav))more.open=true;
    updateJournalClinicHeading();
}
function updateJournalClinicHeading(){
    const name=document.getElementById('sidebarBrandTitle')?.textContent.replace(/管理系統.*$/,'').trim();
    const heading=document.getElementById('journalClinicName');if(heading)heading.textContent=(name||'動物醫院')+' · 毛孩工作手帳';
}
function openJournalAppointmentForm(){
    const form=document.getElementById('journalAppointmentForm');form.open=true;
    form.scrollIntoView({behavior:'smooth',block:'start'});
    document.getElementById('appointmentPetSearch').focus();
}
function journalLocalDateKey(value){
    const date=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function setJournalScheduleMode(future){journalScheduleFutureMode=!!future;renderJournalSchedule();}
function renderJournalSchedule(){
    const rows=document.getElementById('journalScheduleRows');if(!rows)return;
    const today=journalLocalDateKey(new Date()),all=Array.isArray(activeAppointmentsList)?activeAppointmentsList:[];
    // Pending-payment visits remain active in the database, but are no longer waiting.
    const pendingIds=new Set((typeof posStateV77!=='undefined'?posStateV77?.pending||[]:[]).map(q=>q.appointment_id||q.draft?.billingAppointmentId).filter(Boolean));
    const familyDrafts=typeof familyStateNowV74==='function'?familyStateNowV74()?.entries||[]:[];
    for(const entry of familyDrafts)pendingIds.add(entry.billingAppointmentId);
    document.getElementById('journalWaitingCount').textContent=all.filter(p=>(p.status||'候診中')==='候診中'&&!pendingIds.has(p.appointment_id)).length;
    const scheduled=all.filter(p=>p.status==='已預約'&&p.appointment_time&&journalLocalDateKey(p.appointment_time));
    document.getElementById('journalTodayCount').textContent=scheduled.filter(p=>journalLocalDateKey(p.appointment_time)===today).length;
    document.getElementById('journalScheduleToday').setAttribute('aria-pressed',String(!journalScheduleFutureMode));
    document.getElementById('journalScheduleFuture').setAttribute('aria-pressed',String(journalScheduleFutureMode));
    rows.replaceChildren();
    const patients=scheduled.filter(p=>journalScheduleFutureMode?journalLocalDateKey(p.appointment_time)>today:journalLocalDateKey(p.appointment_time)===today).sort((a,b)=>new Date(a.appointment_time)-new Date(b.appointment_time));
    if(!patients.length){const empty=document.createElement('p');empty.className='journal-empty';empty.textContent=journalScheduleFutureMode?'接下來尚無未報到預約。':'今天尚無未報到預約。';rows.appendChild(empty);return;}
    for(const patient of patients){
        const row=document.createElement('div');row.className='journal-schedule-row';row.dataset.appointmentKey=appointmentKey(patient);
        const date=new Date(patient.appointment_time),time=document.createElement('time');time.dateTime=date.toISOString();time.textContent=(journalScheduleFutureMode?date.toLocaleDateString([], {month:'2-digit',day:'2-digit'})+'\n':'')+date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        const info=document.createElement('div'),name=document.createElement('b'),dot=document.createElement('span');dot.className='journal-dot';name.append(dot,document.createTextNode((patient.name||'未填姓名')+' · '+(patient.owner_name||'關聯飼主')));
        const note=document.createElement('p');note.textContent=(patient.session||'上午診')+' · '+doctorCardTextV55(patient)+' · 預約尚未報到';
        const actions=document.createElement('div');actions.className='journal-schedule-actions';
        const key=appointmentKey(patient);
        for(const [fn,label,cls] of [['editAppointment','修改','btn-secondary'],['checkInAppointment','報到 ↗','btn-success'],[patient.appointment_id?'cancelAppointment':'removeAppointment','取消','btn-danger']]){
            const button=document.createElement('button');button.type='button';button.className=cls;button.textContent=label;
            button.setAttribute('onclick',fn+'('+JSON.stringify(key)+')');actions.appendChild(button);
        }
        info.append(name,note,actions);row.append(time,info);rows.appendChild(row);
    }
}
updateJournalPageLayout(document.querySelector('.tab-content.active')?.id||'appointments');
new MutationObserver(updateJournalClinicHeading).observe(document.getElementById('sidebarBrandTitle'),{subtree:true,childList:true,characterData:true});
