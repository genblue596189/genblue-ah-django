
        const { createClient } = supabase;
        const SUPABASE_URL = window.GENBLUE_CONFIG.supabaseUrl;
        const SUPABASE_ANON_KEY = window.GENBLUE_CONFIG.publishableKey;
        const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true}});
        let CURRENT_TENANT_ID = null;
        let CURRENT_USER = null;
        let CURRENT_PROFILE = null;
        let CURRENT_TRIAL_END = null;

        let currentPetId = "";
        let currentPetMicrochip = "";
        let currentPetName = "";
        let currentPetWeight = 0; 
        let currentOwnerId = "";
        let currentPetBirthday = "";
        let currentPetGender = "";
        let currentPetSpecies = "";
        let currentPetBreed = "";

        let loadedMedicinesMap = {}; 
        let loadedItemsMap = {};
        let globalOwnersPetsData = []; 
        let activeAppointmentsList = []; 
        let currentAppointmentFilter = 'all';
        let editingAppointmentPetId = null;
        let currentAppointmentId = null;
        let allPetsListForDropdown = [];
        let allOwnersListForDropdown = [];
        let allLabReportsCache = []; 
        let allRapidReportsCache = [];
        let allVaccinationCache = []; 
        let allInpatientsCache = [];
        let loadedRapidTypesMap = {};

        let customItemCategories = ["一般商品", "保健品", "洗劑", "玩具", "零食"];
        let customMedicineCategories = ["一般藥品", "抗生素", "心臟用藥", "消化道用藥", "關節用藥", "利尿劑", "急救針劑", "類固醇/消炎針"];
        
        let speciesBreedsMap = {
            "犬": ["混種犬", "瑪爾濟斯", "貴賓狗", "吉娃娃", "柴犬", "黃金獵犬", "法國鬥牛犬", "博美犬", "拉布拉多"],
            "貓": ["混種貓", "英國短毛", "美國短毛", "布偶貓", "波斯貓", "曼赤肯", "蘇格蘭摺耳貓", "暹羅貓"],
            "兔": ["迷你兔", "獅子兔", "垂耳兔", "道奇兔", "安哥拉兔", "混種兔"],
            "鼠": ["黃金鼠 (倉鼠)", "三線鼠", "一線鼠", "天竺鼠", "龍貓", "其他鼠"],
            "豬": ["迷你豬 (小威豬)", "越南腹興豬", "大白豬"],
            "其他": ["其他品種"]
        };

        let searchMedRecordsCache = [];
        let searchPrescriptionMedicinesCache = [];
        let searchSalesCache = [];

        let medicalStateCache = {
            chiefComplaint: "",
            temperature: "",
            weight: 0,
            prescriptions: []
        };

        let clinicSettings = {
            name: "吉布動物醫院",
            director: "張劍明",
            phone: "02-8888-9999",
            address: "台北市中正區動物路一段88號"
        };

        async function initializeApp() {
    await loadClinicDoctorsV51();
    applyRolePermissions();
    const tenantInput = document.getElementById('clinicTenantId');

    if (tenantInput) {
        tenantInput.value = CURRENT_TENANT_ID || '';
    }

    const tenantBadge = document.getElementById('currentTenantBadge');

    if (tenantBadge) {
        tenantBadge.textContent =
            `醫院代碼 (tenant_id): ${CURRENT_TENANT_ID || ''}`+
            (CURRENT_TRIAL_END ? `｜試用至 ${new Date(CURRENT_TRIAL_END).toLocaleDateString('zh-TW')}` : '');
    }
        
    const todayStr = new Date().toISOString().split('T')[0];

            document.getElementById('vacNextDueDate').value = '';

            await loadCategoriesFromSupabase();
            await loadBreedsFromSupabase();
            await loadBreedPictures();

            loadClinicSettingsFromSupabase();
            loadOwnersAndPetsIntegrated();
            loadItems(); 
            loadMedicines(); 
            loadAppointments();
            loadVaccineTypes();
            loadRapidTypes();
            loadPetVaccines();
            loadLabReportsList();
            renderLabSpeciesTemplates();
            loadRapidReportsList();
            loadInpatientsList();
            calculateProductTotal();
            calculateInvoiceTotal();

            loadSearchCenterData();
            updateCategoryDropdowns();
            onSpeciesChanged();

            const vacInput = document.getElementById('vacPetSearchInput');
            if (vacInput) {
                vacInput.addEventListener('input', function(e) {
                    const val = e.target.value;
                    const datalist = document.getElementById('vacPetDatalist');
                    const options = datalist.querySelectorAll('option');
                    let foundId = "";
                    options.forEach(opt => {
                        if (opt.value === val) {
                            foundId = opt.dataset.petId;
                        }
                    });
                    document.getElementById('selectedVacPetId').value = foundId;
                });
            }

            const labInput = document.getElementById('labPetSearchInput');
            if(labInput){labInput.removeAttribute('oninput');labInput.oninput=()=>{void onLabPetSelectedForTrend();};}

            const rapidInput = document.getElementById('rapidPetSearchInput');
            if (rapidInput) {
                rapidInput.addEventListener('input', function(e) {
                    const val = e.target.value;
                    const datalist = document.getElementById('rapidPetDatalist');
                    const options = datalist.querySelectorAll('option');
                    let foundId = "";
                    options.forEach(opt => {
                        if (opt.value === val) {
                            foundId = opt.dataset.petId;
                        }
                    });
                    document.getElementById('selectedRapidPetId').value = foundId;
                    updateRapidItemsForPet();
                });
            }
        }

        function staffMessage(value, failed=false) {
            const node=document.getElementById('staffActionMessage');
            if (node) { node.textContent=value; node.style.color=failed?'#dc2626':'#059669'; }
        }
        async function staffInvoke(body) {
            const {data,error}=await _supabase.functions.invoke('manage-staff',{body});
            if (error) {
                let message=error.message;
                if (error.context && typeof error.context.clone === 'function') {
                    try {
                        const response=await error.context.clone().json();
                        if (typeof response?.error === 'string') message=response.error;
                    } catch (_) { /* Keep the original network error. */ }
                }
                throw new Error(message);
            }
            if (data?.error) throw new Error(data.error);
            return data;
        }
        async function loadStaffMembers() {
            if (CURRENT_PROFILE?.role !== 'admin') return;
            const staffNameScopeV56=doctorScopeV51();
            const body=document.getElementById('staffMembersBody');
            body.replaceChildren();
            try {
                const data=await staffInvoke({action:'list'});
                if(staffNameScopeV56!==doctorScopeV51())return;
                if (!Array.isArray(data?.users)) throw new Error('人員函式沒有回傳清單；請確認 manage-staff 已貼入完整程式。');
                let clinicianFlags=null,clinicianFlagsError='';
                try{const response=await _supabase.rpc('staff_clinician_flags_v52');if(response.error)throw response.error;clinicianFlags=new Map((response.data||[]).map(p=>[p.user_id,!!p.is_consulting_doctor]));}
                catch(e){clinicianFlagsError='請先安裝 v52 接診醫師設定 SQL：'+(e.message||String(e));}
                let staffNamesV56=null,staffNamesErrorV56='';
                try{const r=await _supabase.rpc('staff_display_names_v56');if(r.error)throw r.error;if(!Array.isArray(r.data))throw Error('人員姓名資料格式不正確');staffNamesV56=new Map(r.data.map(p=>[p.user_id,p.display_name]));}
                catch(e){staffNamesErrorV56='請先執行 v56 人員顯示名稱 SQL：'+(e.message||String(e));}
                if(staffNameScopeV56!==doctorScopeV51())return;
                const users=data.users.map(m=>({...m,display_name:staffNamesV56?.has(m.user_id)?staffNamesV56.get(m.user_id):m.display_name}));
                if (!users.length) { body.textContent='尚無人員資料'; return; }
                for (const member of users) {
                    const card=document.createElement('section');card.className='staff-card';
                    const head=document.createElement('div');head.className='staff-card-head';
                    const identity=document.createElement('div');identity.className='staff-card-identity';
                    const name=document.createElement('strong');name.textContent=member.display_name||'未命名人員';
                    const role=document.createElement('span');role.className='staff-role-tag';
                    role.textContent=({admin:'管理者',doctor:'醫師',staff:'櫃台／一般人員'})[member.role]||member.role||'';
                    const email=document.createElement('span');email.className='staff-card-email';email.textContent=member.email||'';
                    identity.append(name,role,email);
                    const meta=document.createElement('div');meta.className='staff-card-meta';
                    meta.textContent='建立時間：'+(member.created_at?new Date(member.created_at).toLocaleString('zh-TW'):'—');
                    head.append(identity,meta);card.appendChild(head);
                    appendStaffNameV56(card,member,staffNamesV56,staffNamesErrorV56);
                    appendStaffClinicianV52(card,member,clinicianFlags,clinicianFlagsError);
                    const permissionCell=document.createElement('div');
                    if (member.role==='admin') permissionCell.textContent='管理者：全部權限';
                    else {
                        permissionCell.className='staff-permission-grid';
                        const defaults={
                            permission_appointment:true,
                            permission_clinical:member.role==='doctor',
                            permission_operational:member.role==='staff',
                            permission_checkout:member.role==='staff'||(member.role==='doctor'&&!!member.can_checkout)
                        };
                        const labels={permission_appointment:'掛號',permission_clinical:'病歷編輯',
                            permission_operational:'飼主／寵物資料',permission_checkout:'結帳與報表'};
                        const controls={};
                        const status=document.createElement('span');status.className='staff-permission-status';
                        status.setAttribute('role','status');status.setAttribute('aria-live','polite');
                        const setStatus=(message,color)=>{status.textContent=message;status.style.color=color;};
                        for (const [key,label] of Object.entries(labels)) {
                            const wrap=document.createElement('label');
                            const check=document.createElement('input'); check.type='checkbox';
                            check.checked=typeof member[key]==='boolean'?member[key]:defaults[key];
                            check.addEventListener('change',()=>setStatus('⚠ 尚未儲存','#b45309'));
                            controls[key]=check; wrap.append(check,document.createTextNode(label));
                            permissionCell.appendChild(wrap);
                        }
                        card.appendChild(permissionCell);
                        const save=document.createElement('button');save.type='button';save.className='btn-secondary';
                        save.textContent='儲存權限';
                        save.addEventListener('click',async()=>{
                            const changes={action:'set-permissions',user_id:member.user_id};
                            for (const key of Object.keys(labels)) changes[key]=controls[key].checked;
                            save.disabled=true;save.textContent='儲存中…';
                            for(const check of Object.values(controls)) check.disabled=true;
                            setStatus('正在儲存…','#475569');
                            try {
                                await staffInvoke(changes);
                                setStatus('✓ 已儲存，請該員工重新登入','#047857');
                            } catch(e) { setStatus('儲存失敗：'+(e.message||String(e)),'#dc2626'); }
                            finally { save.disabled=false;save.textContent='儲存權限';for(const check of Object.values(controls)) check.disabled=false; }
                        });
                        const permissionActions=document.createElement('div');permissionActions.className='staff-permission-actions';
                        permissionActions.append(save,status);card.appendChild(permissionActions);
                    }
                    if (member.role==='admin') card.appendChild(permissionCell);
                    const managementCell=document.createElement('div');managementCell.className='staff-card-actions';
                    if (member.role!=='admin' && member.user_id!==CURRENT_USER?.id) {
                        const resetPassword=document.createElement('input');
                        resetPassword.type='password'; resetPassword.autocomplete='new-password';
                        resetPassword.minLength=8; resetPassword.maxLength=72;
                        resetPassword.placeholder='新密碼（8 字元以上）';
                        resetPassword.setAttribute('aria-label',`設定 ${member.display_name||member.email} 的新密碼`);
                        managementCell.appendChild(resetPassword);
                        const reset=document.createElement('button');
                        reset.type='button'; reset.className='btn-secondary'; reset.textContent='重設密碼';
                        reset.addEventListener('click',async()=>{
                            const password=resetPassword.value;
                            if (password.length<8 || password.length>72) { staffMessage('密碼需 8 至 72 字元',true); return; }
                            if (!confirm(`確定重設 ${member.email} 的登入密碼？`)) return;
                            reset.disabled=true;
                            try { await staffInvoke({action:'reset-password',user_id:member.user_id,password}); resetPassword.value=''; staffMessage('密碼已重設，請私下告知員工。'); }
                            catch(e) { staffMessage(e.message||String(e),true); }
                            finally { reset.disabled=false; }
                        });
                        managementCell.appendChild(reset);
                        const remove=document.createElement('button');
                        remove.type='button'; remove.className='btn-secondary'; remove.textContent='移除員工';
                        remove.addEventListener('click',async()=>{
                            if (!confirm(`確定移除 ${member.display_name||member.email}（${member.email}）？\n此人員將不能再登入，病歷及收費紀錄會保留。`)) return;
                            remove.disabled=true;
                            try { await staffInvoke({action:'remove',user_id:member.user_id}); staffMessage('人員已移除，無法再登入。'); await loadStaffMembers(); }
                            catch(e) { staffMessage(e.message||String(e),true); remove.disabled=false; }
                        });
                        managementCell.appendChild(remove);
                    }
                    if (managementCell.childNodes.length) card.appendChild(managementCell);
                    body.appendChild(card);
                }
            } catch(e) { body.textContent='無法載入人員；請確認伺服端 manage-staff 已部署。'; staffMessage(e.message||String(e),true); }
        }
        async function createStaffMember() {
            if (CURRENT_PROFILE?.role !== 'admin') { staffMessage('只有管理者可新增人員',true); return; }
            const display_name=document.getElementById('newStaffName').value.trim();
            const email=document.getElementById('newStaffEmail').value.trim();
            const password=document.getElementById('newStaffPassword').value;
            const role=document.getElementById('newStaffRole').value;
            if (!display_name || !email || !document.getElementById('newStaffEmail').checkValidity() || password.length<8 || password.length>72) {
                staffMessage('請填入姓名、有效 Email 及 8 至 72 字元的初始密碼',true); return;
            }
            if (!confirm(`確定建立 ${display_name}（${email}）的${role==='doctor'?'醫師':'櫃台／一般人員'}帳號？`)) return;
            const button=document.getElementById('staffInviteButton'); button.disabled=true;
            try {
                const can_checkout=role==='doctor' && document.getElementById('newDoctorCheckout').checked;
                await staffInvoke({action:'create',display_name,email,password,role,can_checkout});
                document.getElementById('newStaffName').value='';
                document.getElementById('newStaffEmail').value='';
                document.getElementById('newStaffPassword').value='';
                document.getElementById('newDoctorCheckout').checked=false;
                staffMessage('員工帳號已建立，可使用 Email 與初始密碼登入。');
                await loadStaffMembers();
            } catch(e) { staffMessage(e.message||String(e),true); }
            finally { button.disabled=false; }
        }

        async function changeMyPassword(event) {
            event.preventDefault();
            const newField=document.getElementById('myNewPassword');
            const confirmField=document.getElementById('myConfirmPassword');
            const button=document.getElementById('myPasswordButton');
            const message=document.getElementById('myPasswordMessage');
            const password=newField.value;
            if (password.length<8 || password.length>72 || password!==confirmField.value) {
                message.textContent='請輸入 8 至 72 字元的密碼，並確認兩次輸入一致。';
                message.style.color='#dc2626'; return;
            }
            button.disabled=true;
            message.textContent='正在修改密碼…';
            message.style.color='#475569';
            let updated=false;
            try {
                const {error}=await _supabase.auth.updateUser({password});
                if (error) throw error;
                updated=true;
                newField.value=''; confirmField.value='';
                message.textContent='密碼已修改，正在返回登入畫面。';
                message.style.color='#059669';
                await logoutSupabase();
            } catch(e) {
                message.textContent=(updated?'密碼已修改，但無法自動登出；請手動登出。':'修改密碼失敗：')+(e.message||String(e));
                message.style.color='#dc2626';
            } finally { button.disabled=false; }
        }

        function applyRolePermissions() {
    const clinicNav = document.getElementById('nav-clinic');
    const auditNav = document.getElementById('nav-audit_logs');
    const staffNav = document.getElementById('nav-staff_management');

    const isAdmin = CURRENT_PROFILE?.role === 'admin';
    document.getElementById('nav-breed_images').style.display = isAdmin ? '' : 'none';
    document.getElementById('nav-backup').style.display = isAdmin ? '' : 'none';
    document.getElementById('nav-doctor_statistics').style.display = isAdmin ? '' : 'none';
    let roleBadge=document.getElementById('genblueRoleBadge');
    if (!roleBadge) {
        roleBadge=document.createElement('span');
        roleBadge.id='genblueRoleBadge';
        roleBadge.style.cssText='display:inline-block;margin-left:12px;padding:5px 9px;background:#e0f2fe;color:#075985;border-radius:7px;font-size:13px;font-weight:700;';
        document.querySelector('.header-left h3')?.appendChild(roleBadge);
    }
    const roleLabel=({admin:'管理者',doctor:'醫師',staff:'櫃台／一般員工'})[CURRENT_PROFILE?.role]||'未設定';
    roleBadge.textContent=`登入角色：${roleLabel}`;
    const canClinical=isAdmin || (CURRENT_PROFILE?.permission_clinical ?? (CURRENT_PROFILE?.role==='doctor'));
    const canBill=isAdmin || (CURRENT_PROFILE?.permission_checkout ??
        (CURRENT_PROFILE?.role==='staff' || (CURRENT_PROFILE?.role==='doctor' && CURRENT_PROFILE?.can_checkout===true)));
    document.body.classList.toggle('role-no-clinical', !canClinical);
    document.body.classList.toggle('role-no-operational', !(isAdmin ||
        (CURRENT_PROFILE?.permission_operational ?? (CURRENT_PROFILE?.role==='staff'))));
    document.body.classList.toggle('role-no-appointment', !(isAdmin ||
        (CURRENT_PROFILE?.permission_appointment ?? (CURRENT_PROFILE?.role==='staff'||CURRENT_PROFILE?.role==='doctor'))));
    document.body.classList.toggle('role-nonadmin', !isAdmin);
    const medicalPanel=document.getElementById('medical');
    if (medicalPanel) {
        for (const control of medicalPanel.querySelectorAll('input, textarea, select')) {
            if (!('originalReadonly' in control.dataset)) control.dataset.originalReadonly=control.readOnly?'true':'false';
            if (!('originalDisabled' in control.dataset)) control.dataset.originalDisabled=control.disabled?'true':'false';
            if (!canClinical) {
                if (control instanceof HTMLSelectElement) control.disabled=true;
                else control.readOnly=true;
            } else {
                control.disabled=control.dataset.originalDisabled==='true';
                if (!(control instanceof HTMLSelectElement)) control.readOnly=control.dataset.originalReadonly==='true';
            }
        }
    }
    for (const tabId of ['medical','lab_tests','rapid_tests','vaccines','inpatients','diagnostic_exchange']) {
        const panel=document.getElementById(tabId);
        if (!panel) continue;
        let hint=panel.querySelector('.staff-clinical-hint');
        if (!hint) {
            hint=document.createElement('p');
            hint.className='staff-clinical-hint';
            hint.style.cssText='padding:10px 14px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-weight:600;margin:10px 0;';
            hint.textContent='目前帳號可查看臨床資料，但沒有病歷編輯權限。';
            panel.prepend(hint);
        }
        hint.style.display=!canClinical?'':'none';
    }

    if (clinicNav) {
        clinicNav.style.display = isAdmin ? '' : 'none';
    }

    if (auditNav) {
        auditNav.style.display = isAdmin ? '' : 'none';
    }
    if (staffNav) staffNav.style.display = isAdmin ? '' : 'none';
    for (const id of ['nav-regulatory_reports']) {
        const nav=document.getElementById(id); if (nav) nav.style.display=isAdmin?'':'none';
    }
    for (const id of ['nav-invoices','nav-reports']) {
        const nav=document.getElementById(id); if (nav) nav.style.display=(canBill || (id==='nav-invoices' && canClinical))?'':'none';
    }
}

       
        // ==========================================
// Supabase Authentication
// ==========================================

function setAuthMessage(message, isError = true) {
    const el = document.getElementById('authMessage');
    if (!el) return;

    el.textContent = message;
    el.style.color = isError ? '#dc2626' : '#059669';
}

function showAuthScreen() {
    const screen = document.getElementById('authScreen');
    if (screen) {
        screen.style.display = 'flex';
    }
}

function hideAuthScreen() {
    const screen = document.getElementById('authScreen');
    if (screen) {
        screen.style.display = 'none';
    }
}

async function loadCurrentUserProfile() {
    const {data:{session},error}=await _supabase.auth.getSession();
    if(error)throw error;
    if(!session)return null;
    const response=await fetch('/api/session/',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'無法確認登入狀態。');
    CURRENT_USER=result.user;
    CURRENT_PROFILE=result.profile;
    CURRENT_TENANT_ID=result.profile.tenant_id;
    CURRENT_TRIAL_END=result.trial_end;
    return CURRENT_PROFILE;
}

async function handleSupabaseLogin() {
    const emailInput = document.getElementById('authEmail');
    const passwordInput = document.getElementById('authPassword');
    const button = document.getElementById('authLoginButton');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        setAuthMessage('請輸入 Email 與密碼。');
        return;
    }

    button.disabled = true;
    button.textContent = '登入中...';
    setAuthMessage('');

    try {
        const { error } = await _supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        await loadCurrentUserProfile();

        setAuthMessage('登入成功，正在載入系統...', false);

        hideAuthScreen();

        await initializeApp();

    } catch (error) {
        console.error('登入失敗：', error);

        setAuthMessage(
            '登入失敗：' + (error.message || '帳號或密碼錯誤')
        );

        button.disabled = false;
        button.textContent = '登入系統';
    }
}

async function logoutSupabase() {
    window.clearOfflineCloudV1?.();
    resetBreedPictureCache();
    cancelClinicBackup();
    closeGlobalSearchResults();
    forgetGlobalRecentSearchV73();
    resetLegacyMedicalArchive();
    const { error } = await _supabase.auth.signOut();

    if (error) {
        alert('登出失敗：' + error.message);
        return;
    }

    CURRENT_USER = null;
    CURRENT_PROFILE = null;
    CURRENT_TENANT_ID = null;

    location.reload();
}

let authRestoreBusyV50=false;
function setAuthRestoreModeV50(mode){
 const fields=document.getElementById('authLoginFieldsV50'),retry=document.getElementById('authRetryRestoreV50');
 fields.hidden=mode!=='login';retry.hidden=mode!=='retry';retry.disabled=mode==='checking';
 document.getElementById('authIntroV50').textContent=mode==='login'?'請登入您的帳號':mode==='checking'?'正在恢復登入狀態…':'登入恢復尚未完成，可重試連線';
}
async function bootstrapAuthentication(){
 if(authRestoreBusyV50)return;
 authRestoreBusyV50=true;showAuthScreen();setAuthRestoreModeV50('checking');setAuthMessage('');
 try{
  const {data,error}=await _supabase.auth.getSession();if(error)throw error;
  if(!data?.session){setAuthRestoreModeV50('login');return;}
  // Keep server-side identity, clinic permission and trial checks before entry.
  const profile=await loadCurrentUserProfile();if(!profile)throw Error('登入狀態無法驗證，請重試或重新登入');
  await initializeApp();
  hideAuthScreen();
 }catch(error){
  console.error('載入登入狀態失敗：',error);
  // A failed profile/network request must not erase a still-valid stored session.
  showAuthScreen();setAuthRestoreModeV50('retry');
  setAuthMessage('暫時無法恢復登入或確認醫院權限：'+(error.message||'請稍後重試')+'。請按「重試恢復登入」。');
 }finally{authRestoreBusyV50=false;}
}

// Enter 鍵直接登入
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Enter' || event.isComposing || event.keyCode===229 || event.repeat) return;

    const authScreen = document.getElementById('authScreen');

    if (
        authScreen &&
        authScreen.style.display !== 'none' && !document.getElementById('authLoginFieldsV50').hidden
    ) {
        handleSupabaseLogin();
    }
});

// 啟動 Supabase Authentication
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapAuthentication,{once:true});else bootstrapAuthentication();

        function updateLiveAgeDisplay() {
            const birthdayInput = document.getElementById('intPetBirthday').value;
            const labelEl = document.getElementById('petBirthdayLabel');
            if (!labelEl) return;

            if (!birthdayInput) {
                labelEl.innerText = "出生日期 (日曆選單)";
                return;
            }

            const ageStr = calculateAge(birthdayInput);
            labelEl.innerHTML = `出生日期 (日曆選單) <span style="color: #0369a1; font-weight: bold; margin-left: 6px;">👉 目前年紀：${ageStr}</span>`;
        }

        async function loadBreedsFromSupabase() {
            const { data, error } = await _supabase
                .from('breeds')
                .select('*')
                .eq('tenant_id', CURRENT_TENANT_ID);

            if (!error && data && data.length > 0) {
                data.forEach(item => {
                    const sp = item.species;
                    const bName = item.breed_name;
                    if (!speciesBreedsMap[sp]) {
                        speciesBreedsMap[sp] = [];
                    }
                    if (!speciesBreedsMap[sp].includes(bName)) {
                        speciesBreedsMap[sp].push(bName);
                    }
                });
            }
        }

        function onSpeciesChanged() {
            const speciesSelect = document.getElementById('intPetSpecies');
            const breedSelect = document.getElementById('intPetBreed');
            if (!speciesSelect || !breedSelect) return;

            const selectedSpecies = speciesSelect.value;
            const availableBreeds = speciesBreedsMap[selectedSpecies] || ["其他品種"];

            breedSelect.innerHTML = '';
            availableBreeds.forEach(breed => {
                const opt = document.createElement('option');
                opt.value = breed;
                opt.textContent = breed;
                breedSelect.appendChild(opt);
            });
        }

        async function addNewBreedOption() {
            const speciesSelect = document.getElementById('intPetSpecies');
            const input = document.getElementById('newBreedCustomInput');
            const newBreed = input.value.trim();
            
            if (!newBreed) { alert('請輸入要新增的品種名稱！'); return; }

            const currentSpecies = speciesSelect.value;
            if (!speciesBreedsMap[currentSpecies]) {
                speciesBreedsMap[currentSpecies] = [];
            }

            if (speciesBreedsMap[currentSpecies].includes(newBreed)) {
                alert('此品種在此種類下已經存在！');
                return;
            }

            const { error } = await _supabase.from('breeds').insert([{
                tenant_id: CURRENT_TENANT_ID,
                species: currentSpecies,
                breed_name: newBreed
            }]);

            if (error) {
                alert('同步寫入 Supabase 品種失敗：' + error.message);
                return;
            }

            speciesBreedsMap[currentSpecies].push(newBreed);
            input.value = '';
            
            onSpeciesChanged();
            document.getElementById('intPetBreed').value = newBreed;
            alert(`成功在「${currentSpecies}」分類下新增品種：「${newBreed}」並已同步永久儲存至 Supabase！`);
        }

        async function loadCategoriesFromSupabase() {
            const { data, error } = await _supabase.from('categories').select('*').eq('tenant_id', CURRENT_TENANT_ID);
            if (!error && data && data.length > 0) {
                const itemCats = data.filter(c => c.type === 'item').map(c => c.name);
                const medCats = data.filter(c => c.type === 'medicine').map(c => c.name);

                if (itemCats.length > 0) {
                    itemCats.forEach(c => { if (!customItemCategories.includes(c)) customItemCategories.push(c); });
                }
                if (medCats.length > 0) {
                    medCats.forEach(c => { if (!customMedicineCategories.includes(c)) customMedicineCategories.push(c); });
                }
            }
        }

        function updateCategoryDropdowns() {
            const itemSel = document.getElementById('itemCategory');
            if(itemSel) {
                const currentVal = itemSel.value;
                itemSel.innerHTML = '';
                customItemCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    itemSel.appendChild(opt);
                });
            }

            const editItemSel = document.getElementById('editItemCategorySelect');
            if(editItemSel) {
                const currentVal = editItemSel.value;
                editItemSel.innerHTML = '';
                customItemCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    editItemSel.appendChild(opt);
                });
            }

            const searchSalesCatFilter = document.getElementById('searchSalesCategoryFilter');
            if(searchSalesCatFilter) {
                const currentVal = searchSalesCatFilter.value;
                searchSalesCatFilter.innerHTML = '<option value="">-- 所有商品分類 --</option>';
                customItemCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    searchSalesCatFilter.appendChild(opt);
                });
            }

            const medSel = document.getElementById('medCalcFormula');
            if(medSel) {
                const currentVal = medSel.value;
                medSel.innerHTML = '';
                customMedicineCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    medSel.appendChild(opt);
                });
            }

            const editMedSel = document.getElementById('editMedCalcFormula');
            if(editMedSel) {
                const currentVal = editMedSel.value;
                editMedSel.innerHTML = '';
                customMedicineCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    editMedSel.appendChild(opt);
                });
            }

            const searchMedCatFilter = document.getElementById('searchMedCategoryFilter');
            if(searchMedCatFilter) {
                const currentVal = searchMedCatFilter.value;
                searchMedCatFilter.innerHTML = '<option value="">-- 所有藥品分類 --</option>';
                customMedicineCategories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    if(cat === currentVal) opt.selected = true;
                    searchMedCatFilter.appendChild(opt);
                });
            }
        }

        async function addNewItemCategory() {
            const input = document.getElementById('newItemCustomCategory');
            const newCat = input.value.trim();
            if(!newCat) { alert('請輸入要新增的商品分類名稱！'); return; }
            if(customItemCategories.includes(newCat)) { alert('此商品分類已經存在！'); return; }

            const { error } = await _supabase.from('categories').insert([{
                tenant_id: CURRENT_TENANT_ID,
                name: newCat,
                type: 'item'
            }]);

            if (error) {
                alert('寫入 Supabase 失敗：' + error.message);
                return;
            }

            customItemCategories.push(newCat);
            input.value = '';
            updateCategoryDropdowns();
            alert(`成功新增商品分類：「${newCat}」並已儲存至 Supabase！`);
        }

        async function addNewMedicineCategory() {
            const input = document.getElementById('newMedCustomCategory');
            const newCat = input.value.trim();
            if(!newCat) { alert('請輸入要新增的藥品分類名稱！'); return; }
            if(customMedicineCategories.includes(newCat)) { alert('此藥品分類已經存在！'); return; }

            const { error } = await _supabase.from('categories').insert([{
                tenant_id: CURRENT_TENANT_ID,
                name: newCat,
                type: 'medicine'
            }]);

            if (error) {
                alert('寫入 Supabase 失敗：' + error.message);
                return;
            }

            customMedicineCategories.push(newCat);
            input.value = '';
            updateCategoryDropdowns();
            alert(`成功新增藥品分類：「${newCat}」並已儲存至 Supabase！`);
        }

        const historySearchPairs = [
            ['searchMedTableBody','searchMedKeyword'], ['searchVacTableBody','searchVacKeyword'],
            ['searchMedUsageTableBody','searchMedUsageKeyword'], ['searchSalesTableBody','searchSalesKeyword'],
            ['integratedTableBody','ownerPetTableSearch'],
            ['petVaccineTableBody','vacReportTableSearch'], ['labReportsTableBody','labReportTableSearch'],
            ['rapidReportsTableBody','rapidReportTableSearch']
        ];
        function collapseHistoryUntilSearch(tbody, inputId) {
            const input = document.getElementById(inputId);
            const hidden = !input || !input.value.trim();
            tbody.closest('table').style.display = hidden ? 'none' : '';
            return hidden;
        }
        function resetHistorySearches(container) {
            if (!container) return;
            historySearchPairs.forEach(([bodyId, inputId]) => {
                const input = document.getElementById(inputId);
                const body = document.getElementById(bodyId);
                if (input && container.contains(input)) {
                    input.value = '';
                    if (body) { body.innerHTML = ''; body.closest('table').style.display = 'none'; }
                }
            });
        }
        document.addEventListener('DOMContentLoaded', () => {
            historySearchPairs.forEach(([bodyId]) => {
                const body = document.getElementById(bodyId);
                if (body) body.closest('table').style.display = 'none';
            });
        });

        function filterAuditByDate() {
            const start = document.getElementById('auditStartDate').value;
            const end = document.getElementById('auditEndDate').value;
            const tbody = document.getElementById('auditTableBody');
            const table = tbody.closest('table');
            const hint = document.getElementById('auditDateHint');
            if (!start || !end) {
                table.style.display = 'none';
                hint.textContent = '請選擇起始日與終止日查詢操作紀錄。';
                hint.style.display = '';
                return;
            }
            if (start > end) {
                table.style.display = 'none';
                hint.textContent = '起始日不能晚於終止日。';
                hint.style.display = '';
                return;
            }
            let count = 0;
            tbody.querySelectorAll('tr').forEach(row => {
                const date = row.cells[0]?.textContent.trim().slice(0, 10).replace(/\//g, '-');
                const match = !!date && date >= start && date <= end;
                row.style.display = match ? '' : 'none';
                if (match) count++;
            });
            table.style.display = count ? '' : 'none';
            hint.textContent = '此日期範圍內沒有操作紀錄。';
            hint.style.display = count ? 'none' : '';
        }
        document.addEventListener('DOMContentLoaded', () => {
            const tbody = document.getElementById('auditTableBody');
            if (tbody) tbody.closest('table').style.display = 'none';
        });

        function switchTab(tabId) {
            if(tabId==='lab_tests')tabId='diagnostic_exchange'; // 舊入口轉至整合中心
            if(tabId==='online_booking'){if(!waitingDoctorAllowedV54()){alert('此帳號沒有掛號／預約管理權限');return;}setTimeout(openOnlineBookingV59,0);}
            if (['staff_management','audit_logs','clinic','backup','breed_images','doctor_statistics'].includes(tabId) && CURRENT_PROFILE?.role !== 'admin') { alert('需要管理者權限'); return; }
            if (tabId==='regulatory_reports' && CURRENT_PROFILE?.role!=='admin') { alert('需要管理者權限'); return; }
            if ((tabId==='reports' || (tabId==='invoices' && !posMedicalV77())) &&
                !(CURRENT_PROFILE?.role==='admin' || (CURRENT_PROFILE?.permission_checkout ??
                    (CURRENT_PROFILE?.role==='staff' || (CURRENT_PROFILE?.role==='doctor' && CURRENT_PROFILE?.can_checkout===true))))) {
                alert('此帳號沒有結帳權限'); return;
            }
            if (tabId === 'breed_images') setTimeout(openBreedPictureManager, 0);
            if (tabId === 'doctor_statistics') setTimeout(openDoctorStatsV57, 0);
            if (tabId === 'staff_management') setTimeout(loadStaffMembers, 0);
            if (tabId === 'diagnostic_exchange') setTimeout(() => { loadDiagnosticExchangeCenter(); populateDxPetChoices(); }, 0);
            if (document.getElementById('audit_logs').classList.contains('active')) {
                document.getElementById('auditStartDate').value = '';
                document.getElementById('auditEndDate').value = '';
                filterAuditByDate();
            }
            const appointmentHistoryPanel = document.getElementById('appointmentHistoryPanel');
            if (appointmentHistoryPanel) appointmentHistoryPanel.open = false;
            document.querySelectorAll('.tab-content.active').forEach(resetHistorySearches);
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
            
            document.getElementById(tabId).classList.add('active');
            updateJournalPageLayout(tabId);
            const activeNav = document.getElementById('nav-' + tabId);
            if(activeNav) {
                activeNav.classList.add('active');
            }
            if(tabId === 'reports') {
                fetchFinancialReport();
            }
            if(tabId === 'regulatory_reports') {
                initRegulatoryCenterDates();
                loadRegulatoryCenter();
                loadRegulatoryReportHistory();
            }
            if(tabId === 'medical') for(const kind of ['rapid','cbc','bio','imaging'])refreshOpenCurrentPetHistory(kind);
            if(tabId === 'vaccines') loadPetVaccines();
            if(tabId === 'search_center') {
                loadSearchCenterData();
            }
            if(tabId === 'inpatients') {
                loadInpatientsList();
            }
        }

        function switchSearchSubTab(subTabId) {
            document.querySelectorAll('.search-subtab-content').forEach(resetHistorySearches);
            document.querySelectorAll('.search-subtab-content').forEach(el => el.style.display = 'none');
            document.getElementById('subtab_' + subTabId).style.display = 'block';

            document.getElementById('btnSearchMedHistory').style.background = '#64748b';
            document.getElementById('btnSearchVaccines').style.background = '#64748b';
            document.getElementById('btnSearchMedicines').style.background = '#64748b';
            document.getElementById('btnSearchSales').style.background = '#64748b';

            if(subTabId === 'med_history') document.getElementById('btnSearchMedHistory').style.background = 'var(--primary-color)';
            if(subTabId === 'vaccines_history') document.getElementById('btnSearchVaccines').style.background = 'var(--primary-color)';
            if(subTabId === 'medicines_usage') document.getElementById('btnSearchMedicines').style.background = 'var(--primary-color)';
            if(subTabId === 'sales_history') document.getElementById('btnSearchSales').style.background = 'var(--primary-color)';
        }

        let searchCenterLoadRequest=0;
        async function loadRetailSalesWithRelations(tenant,request) {
            const invoices=[];
            for (let offset=0;;offset+=1000) {
                const {data,error}=await _supabase.from('invoices')
                    .select('*, owners(id,name,mobile,phone,owner_code,system_code), invoice_items(*)')
                    .eq('tenant_id',tenant)
                    .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
                if (error) throw error;
                if (tenant!==CURRENT_TENANT_ID || request!==searchCenterLoadRequest) return null;
                invoices.push(...(data||[]));
                if (!data || data.length<1000) break;
            }
            const ids=[...new Set(invoices.map(i=>i.pet_id).filter(Boolean))],pets=new Map();
            for (let offset=0;offset<ids.length;offset+=200) {
                const {data,error}=await _supabase.from('pets').select('id,name').eq('tenant_id',tenant).in('id',ids.slice(offset,offset+200));
                if (error) throw error;
                if (tenant!==CURRENT_TENANT_ID || request!==searchCenterLoadRequest) return null;
                for (const pet of data||[]) pets.set(pet.id,pet);
            }
            const splits=new Map();
            for(let offset=0;offset<invoices.length;offset+=200){const batch=invoices.slice(offset,offset+200),reply=await posRpcV77('finance_status',{invoice_ids:batch.map(i=>i.id)});
                if(tenant!==CURRENT_TENANT_ID||request!==searchCenterLoadRequest)return null;
                if(reply.tenant_id!==String(tenant)||!Array.isArray(reply.statuses)||reply.statuses.length!==batch.length)throw Error('商品分類回覆不完整');
                for(const status of reply.statuses){if(status.revenue_split?.version!==853)throw Error('請先執行 v85_3 門診商品收入分類 SQL');splits.set(status.invoice_id,status);}}
            return invoices.filter(i=>splits.get(i.id)?.revenue_split?.has_product).map(i=>{const split=splits.get(i.id).revenue_split;return {...i,category:split.has_clinic?'門診追加商品':i.category||'一般商品',total_amount:split.product_total,items:split.product_lines?.length?split.product_lines:i.invoice_items||[],pets:pets.get(i.pet_id)||null};});
        }

        async function loadSearchCenterData() {
            const tenant=CURRENT_TENANT_ID,request=++searchCenterLoadRequest;
            if (!tenant) return;
            const { data: medData } = await _supabase.from('medical_records').select('*, pets(name, microchip)').eq('tenant_id', tenant).order('created_at', { ascending: false });
            if (tenant!==CURRENT_TENANT_ID || request!==searchCenterLoadRequest) return;
            searchMedRecordsCache = medData || [];
            filterSearchMedHistory();

            await loadPetVaccines();
            if (tenant!==CURRENT_TENANT_ID || request!==searchCenterLoadRequest) return;

            const { data: dbMedicines } = await _supabase.from('medicines').select('name, calculated_dose').eq('tenant_id', tenant);
            if (tenant!==CURRENT_TENANT_ID || request!==searchCenterLoadRequest) return;
            const medCategoryMap = {};
            if (dbMedicines) {
                dbMedicines.forEach(m => { medCategoryMap[m.name] = m.calculated_dose || '一般藥品'; });
            }

            searchPrescriptionMedicinesCache = [];
            if (searchMedRecordsCache.length > 0) {
                searchMedRecordsCache.forEach(rec => {
                    if (rec.prescription_details && rec.prescription_details.length > 0) {
                        rec.prescription_details.forEach(p => {
                            const category = medCategoryMap[p.medicine_name] || '一般藥品';
                            searchPrescriptionMedicinesCache.push({
                                created_at: rec.created_at,
                                pet_name: rec.pets ? rec.pets.name : '未知寵物',
                                pet_chip: rec.pets ? rec.pets.microchip : '',
                                medicine_name: p.medicine_name,
                                category: category,
                                custom_dose: normalizePrescriptionDoseV91(p) || '-',
                                quantity: p.quantity || 1,
                                instruction: p.instruction || '-'
                            });
                        });
                    }
                });
            }
            filterSearchMedicinesUsage();

            try {
                const sales=await loadRetailSalesWithRelations(tenant,request);
                if (sales===null) return;
                searchSalesCache=sales;
            } catch(error) {
                if (tenant===CURRENT_TENANT_ID && request===searchCenterLoadRequest) alert('商品銷售紀錄讀取失敗：'+error.message+'。請重新查詢；目前保留上次成功結果。');
                return;
            }

            filterSearchSales();
        }

        function renderSearchMedHistory(dataList) {
            const tbody = document.getElementById('searchMedTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'searchMedKeyword')) return;
            if(!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">尚無歷史病歷紀錄</td></tr>`;
                return;
            }
            dataList.forEach(rec => {
                const petName = rec.pets ? rec.pets.name : '未知寵物';
                const chip = rec.pets && rec.pets.microchip ? `[${rec.pets.microchip}]` : '';
                let rxSummary = '';
                if(rec.prescription_details && rec.prescription_details.length > 0) {
                    rec.prescription_details.forEach(p => { rxSummary += `${p.medicine_name} (${p.quantity}) | `; });
                } else { rxSummary = '無處方用藥'; }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(rec.created_at).toLocaleString()}</td>
                    <td><b>${petName}</b> <small style="color:#64748b;">${chip}</small></td>
                    <td>${rec.chief_complaint || '無主訴'}</td>
                    <td><small style="color:#475569;">${rxSummary}</small></td>
                    <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick='openMedicalDetailModal(${JSON.stringify(rec)})'>檢視</button></td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterSearchMedHistory() {
            const kw = document.getElementById('searchMedKeyword').value.trim().toLowerCase();
            if(!kw) { renderSearchMedHistory(searchMedRecordsCache); return; }
            const filtered = searchMedRecordsCache.filter(r => {
                const pName = (r.pets && r.pets.name ? r.pets.name : '').toLowerCase();
                const chief = (r.chief_complaint || '').toLowerCase();
                return pName.includes(kw) || chief.includes(kw);
            });
            renderSearchMedHistory(filtered);
        }

        function vaccineIdentityHtml(v) {
            const e=escapeCheckoutText;
            const codes=[v.owner_system_code?'新：'+v.owner_system_code:'',v.owner_code?'舊：'+v.owner_code:''].filter(Boolean).join('／');
            return '<b>'+e(v.pet_name)+(v.pet_species?'（'+e(v.pet_species)+'）':'')+'</b><br><small>飼主：'+e(v.owner_name||'飼主資料無法讀取')+
                (codes?' ['+e(codes)+']':'')+'<br>電話：'+e([v.owner_mobile,v.owner_phone].filter(Boolean).join('／')||'無電話')+'<br>晶片：'+e(v.pet_microchip||'無')+'</small>';
        }
        function currentClinicVaccineRows() {return allVaccinationCache.filter(v=>v.tenant_id===CURRENT_TENANT_ID);}
        function filterVaccineRecords(keyword) {
            const terms=keyword.trim().toLowerCase().split(/\s+/u).filter(Boolean);
            return currentClinicVaccineRows().filter(v=>{
                const values=[v.pet_name,v.pet_species,v.pet_microchip,v.vaccine_name,v.notes,v.last_date,v.next_due_date,
                    v.owner_name,v.owner_mobile,v.owner_phone,v.owner_code,v.owner_system_code].map(x=>String(x||'').toLowerCase());
                return terms.every(term=>values.some(value=>value.includes(term)));
            });
        }
        function vaccineRecordCells(v) {
            return '<td>'+vaccineIdentityHtml(v)+'</td><td><b>'+escapeCheckoutText(v.vaccine_name||'未指定疫苗')+'</b></td>'+ 
                '<td>'+escapeCheckoutText(v.last_date||'未填日期')+'</td><td>'+escapeCheckoutText(v.next_due_date||'未設定')+'</td><td>'+escapeCheckoutText(v.notes||'-')+'</td>';
        }
        function renderSearchVaccines(dataList) {
            const tbody=document.getElementById('searchVacTableBody');if(!tbody)return;tbody.innerHTML='';
            if(collapseHistoryUntilSearch(tbody,'searchVacKeyword'))return;
            if(!dataList?.length){tbody.innerHTML='<tr><td colspan="5">查無符合的疫苗施打紀錄。</td></tr>';return;}
            for(const v of dataList){const tr=document.createElement('tr');tr.innerHTML=vaccineRecordCells(v);tbody.appendChild(tr);}
        }
        function filterSearchVaccines() {renderSearchVaccines(filterVaccineRecords(document.getElementById('searchVacKeyword').value));}

        function renderSearchMedicinesUsage(dataList) {
            const tbody = document.getElementById('searchMedUsageTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'searchMedUsageKeyword')) return;
            if(!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">尚無任何處方用藥開立紀錄</td></tr>`;
                return;
            }
            dataList.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(item.created_at).toLocaleString()}</td>
                    <td><b>${item.pet_name}</b> <small style="color:#64748b;">${item.pet_chip ? '[' + item.pet_chip + ']' : ''}</small></td>
                    <td><b>${item.medicine_name}</b></td>
                    <td><span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${item.category}</span></td>
                    <td>劑量: ${item.custom_dose} | 數量: <b>${item.quantity}</b></td>
                    <td><small style="color: #475569;">${item.instruction}</small></td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterSearchMedicinesUsage() {
            const kw = document.getElementById('searchMedUsageKeyword').value.trim().toLowerCase();
            const filtered = kw ? searchPrescriptionMedicinesCache.filter(item =>
                [item.medicine_name, item.pet_name, item.pet_chip, item.category]
                    .some(value => String(value || '').toLowerCase().includes(kw))
            ) : [];
            renderSearchMedicinesUsage(filtered);
        }

        function renderSearchSales(dataList) {
            const tbody = document.getElementById('searchSalesTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'searchSalesKeyword')) return;
            if(!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">尚無商品銷售紀錄（含門診追加商品）</td></tr>`;
                return;
            }
            dataList.forEach(inv => {
                const ownerName = financialOwnerDisplay(inv);
                const petName = inv.pets ? ` 🐾 <b>${escapeCheckoutText(inv.pets.name)}</b>` : '';
                const category = inv.category || '一般商品';
                
                let itemsSummary = '';
                if (inv.items && inv.items.length > 0) {
                    inv.items.forEach(it => {
                        const unitPrice = it.unit_price !== undefined ? it.unit_price : (it.price || 0);
                        itemsSummary += `• <b>${escapeCheckoutText(it.item_name)}</b> (數量: ${it.quantity} | 單價: NT$ ${unitPrice})<br>`;
                    });
                } else {
                    itemsSummary = '<span style="color:#ef4444;">無明細記錄</span>';
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(inv.created_at).toLocaleString()}</td>
                    <td><b>${ownerName}</b>${petName}</td>
                    <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${category}</span></td>
                    <td>${itemsSummary}</td>
                    <td><b>NT$ ${(parseFloat(inv.total_amount) || 0).toLocaleString()}</b>${inv.voided_at ? ' <span style="color:#dc2626">已作廢</span>' : ''}</td>
                    <td>${inv.voided_at ? '原因：'+escapeCheckoutText(inv.void_reason||'-') : '帳款處理請至開班／交班／下班'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        function escapeCheckoutText(value) {
            return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
        }

        async function voidInvoice(invoiceId, options = {}) {
            const scope=posScopeNowV77();
            const reason = prompt('請填寫作廢原因（原帳單會保留，已扣的庫存會回補）：');
            if (reason === null) return null;
            if (reason.trim().length < 2) { alert('請填寫至少兩字的作廢原因'); return null; }
            if (!confirm('確定作廢這筆交易並回補庫存？\n請確認原單的藥品／商品已退回，或尚未實際交付。未退回時請取消，不可回補庫存。')) return null;
            try {
                await posRpcV77('void_safe_v854',{invoice_id:invoiceId,reason:reason.trim(),stock_return_confirmed:true});
            } catch (error) {
                if(scope===posScopeNowV77())alert('尚未確認作廢完成：'+error.message+'。請重新查詢原帳單狀態後再操作。');
                return null;
            }
            if(scope!==posScopeNowV77())return null;
            const result={invoiceId,reason:reason.trim()};
            if(options.refresh===false)return result;
            alert('帳單已作廢，已扣的庫存已回補。退款請依原付款方式另行處理。');
            const refreshed=await Promise.allSettled([loadItems(),loadMedicines(),loadSearchCenterData(),fetchFinancialReport()]);
            if(scope===posScopeNowV77()&&refreshed.some(r=>r.status==='rejected'))alert('作廢已完成，部分畫面未更新，請更新資料；勿重新作廢或重複退款。');
            return result;
        }

        function filterSearchSales() {
            const kw = document.getElementById('searchSalesKeyword').value.trim().toLowerCase();
            const filtered = kw ? searchSalesCache.filter(inv => {
                const owner = inv.owners || {};
                const pet = inv.pets || {};
                return [inv.category || '一般商品', owner.name, owner.mobile, owner.phone, owner.owner_code, owner.system_code,
                    pet.name, ...(inv.items || []).map(item => item.item_name)]
                    .some(value => String(value || '').toLowerCase().includes(kw));
            }) : [];
            renderSearchSales(filtered);
        }

        async function loadClinicSettingsFromSupabase() {
            const { data, error } = await _supabase
                .from('clinic_settings')
                .select('*')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .maybeSingle();

            if (!error && data) {
                clinicSettings.name = data.clinic_name || "吉布動物醫院";
                clinicSettings.director = data.director || "張劍明";
                clinicSettings.phone = data.phone || "02-8888-9999";
                clinicSettings.address = data.address || "台北市地址";
            } else if (!data) {
                clinicSettings.name = '動物醫院';
                clinicSettings.director = '';
                clinicSettings.phone = '';
                clinicSettings.address = '';
            }

            renderPrescriptionRoutesV66(data?.prescription_routes||[]);
            document.getElementById('clinicNameSet').value = clinicSettings.name;
            document.getElementById('clinicDirectorSet').value = clinicSettings.director;
            document.getElementById('clinicPhoneSet').value = clinicSettings.phone;
            document.getElementById('clinicAddressSet').value = clinicSettings.address;
            document.getElementById('sidebarBrandTitle').innerText = clinicSettings.name + "管理系統 genblue設計版權所有";
        }

        async function saveClinicSettings() {
            const name = document.getElementById('clinicNameSet').value.trim() || "吉布動物醫院";
            const director = document.getElementById('clinicDirectorSet').value.trim() || "張劍明";
            const phone = document.getElementById('clinicPhoneSet').value.trim() || "02-8888-9999";
            const address = document.getElementById('clinicAddressSet').value.trim() || "";

            const { error } = await _supabase
                .from('clinic_settings')
                .upsert({
                    tenant_id: CURRENT_TENANT_ID,
                    clinic_name: name,
                    director: director,
                    phone: phone,
                    address: address,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_id' });

            if (error) {
                alert('更新醫院設定失敗：' + error.message);
                return;
            }

            clinicSettings.name = name;
            clinicSettings.director = director;
            clinicSettings.phone = phone;
            clinicSettings.address = address;

            document.getElementById('sidebarBrandTitle').innerText = clinicSettings.name + "管理系統 genblue設計版權所有";
            alert('醫院設定已成功同步寫入 Supabase 資料庫！');
        }

        function calculateAge(birthdayStr) {
            if (!birthdayStr) return '未知年紀';
            const birthDate = new Date(birthdayStr);
            const today = new Date();

            let years = today.getFullYear() - birthDate.getFullYear();
            let months = today.getMonth() - birthDate.getMonth();
            let days = today.getDate() - birthDate.getDate();

            if (days < 0) {
                months--;
                const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                days += prevMonth.getDate();
            }
            if (months < 0) {
                years--;
                months += 12;
            }

            let result = '';
            if (years > 0) result += `${years} 歲 `;
            if (months > 0 || years > 0) result += `${months} 個月 `;
            result += `${days} 天`;
            return result.trim();
        }

        let vaccineTypesFeeScope20261026="", vaccineTypesFeeRows20261026=[];
        async function loadVaccineTypes() {
            const feeScope=CURRENT_TENANT_ID+"|"+CURRENT_USER?.id;
            vaccineTypesFeeScope20261026="";vaccineTypesFeeRows20261026=[];
            const defaultVaccines = [
                { name: "犬八合一", target: "犬", interval: 365 },
                { name: "犬十合一", target: "犬", interval: 365 },
                { name: "貓三合一", target: "貓", interval: 365 },
                { name: "貓四合一", target: "貓", interval: 365 },
                { name: "貓五合一", target: "貓", interval: 365 },
                { name: "貓白血病疫苗", target: "貓", interval: 365 },
                { name: "心絲蟲疫苗", target: "通用", interval: 365 }
            ];

            let { data, error } = await _supabase.from('vaccine_types').select('*').eq('tenant_id', CURRENT_TENANT_ID);
            
            if(feeScope!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)return;
            if(error){alert('讀取疫苗種類失敗：'+error.message);return;}
            if ((!data || data.length === 0)&&CURRENT_PROFILE?.role==='admin') {
                for (let v of defaultVaccines) {
                    await _supabase.from('vaccine_types').insert([{ tenant_id: CURRENT_TENANT_ID, name: v.name, target: v.target, interval_days: v.interval }]);
                }
                const res = await _supabase.from('vaccine_types').select('*').eq('tenant_id', CURRENT_TENANT_ID);
                if(res.error){alert('讀取疫苗種類失敗：'+res.error.message);return;}
                data = res.data || [];
            }
            if(feeScope!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)return;
            vaccineTypesFeeRows20261026=data||[];vaccineTypesFeeScope20261026=feeScope;
            document.getElementById('vaccineFeeEditor20261026')?.replaceChildren();

            const vacTypeSelect = document.getElementById('vacTypeSelect');
            if(vacTypeSelect) vacTypeSelect.innerHTML = '<option value="">-- 請選擇疫苗 --</option>';

            data.forEach(vt => {
                if(vacTypeSelect) {
                    const opt = document.createElement('option');
                    opt.value = vt.name;
                    opt.dataset.intervalDays=String(vt.interval_days??'');
                    opt.dataset.vaccineTypeId=vt.id;opt.dataset.defaultFee=vt.default_fee==null?'':String(vt.default_fee);
                    opt.textContent = `${vt.name} (${vt.target}用)`;
                    vacTypeSelect.appendChild(opt);
                }
            });
            if(typeof renderVaccineFeeSettings20261026==='function')renderVaccineFeeSettings20261026();
        }

        let vaccineTypeSaveBusy20261026=false;
        async function saveNewVaccineType() {
            if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可設定疫苗項目與標準費用。');return;}
            if(vaccineTypeSaveBusy20261026)return;
            const nameInput = document.getElementById('newVaccineTypeName');
            const targetSelect = document.getElementById('newVaccineTypeTarget');
            const intervalInput = document.getElementById('newVaccineInterval');

            const name = nameInput.value.trim();
            const target = targetSelect.value;
            const interval_days = Number(intervalInput.value);
            let default_fee;try{default_fee=vaccineFeeValue20261026(document.getElementById('newVaccineDefaultFee').value);if(default_fee===null)throw Error('請填標準費用，免費請填 0。');if(!Number.isInteger(interval_days)||interval_days<1||interval_days>3650)throw Error('施打間隔請填1至3650天。');}catch(e){alert(e.message);return;}

            if (!name) { alert('請輸入疫苗名稱！'); return; }

            const scope=CURRENT_TENANT_ID+'|'+CURRENT_USER?.id;vaccineTypeSaveBusy20261026=true;
            try{
                const {data,error}=await _supabase.from('vaccine_types').insert([{tenant_id:CURRENT_TENANT_ID,name,target,interval_days,default_fee}]).select('id').single();
                if(scope!==CURRENT_TENANT_ID+'|'+CURRENT_USER?.id)return;
                if(error||!data?.id)throw Error(error?.message||'伺服器未確認新增結果，請重新讀取核對，勿重複新增。');
                alert(`成功新增疫苗種類：「${name}」！`);nameInput.value='';intervalInput.value='365';document.getElementById('newVaccineDefaultFee').value='';
                await loadVaccineTypes();
            }catch(e){alert('新增疫苗種類未確認：'+e.message);}
            finally{vaccineTypeSaveBusy20261026=false;}
        }

        async function loadRapidTypes() {
            const defaultRapid = [
                { name: "犬四合一快篩", target: "犬", sub_items: "心絲蟲, 萊姆病, 艾利希體, 焦蟲" },
                { name: "貓瘟快篩 (FPV Ag)", target: "貓", sub_items: "" },
                { name: "貓愛滋抗體 (FIV Ab)", target: "貓", sub_items: "" },
                { name: "貓白血病抗原 (FeLV Ag)", target: "貓", sub_items: "" },
                { name: "犬心絲蟲抗原 (HW Ag)", target: "犬", sub_items: "" }
            ];

            let { data, error } = await _supabase.from('rapid_types').select('*').eq('tenant_id', CURRENT_TENANT_ID);
            
            if (!data || data.length === 0) {
                for (let r of defaultRapid) {
                    await _supabase.from('rapid_types').insert([{ tenant_id: CURRENT_TENANT_ID, name: r.name, target: r.target, sub_items: r.sub_items }]);
                }
                const res = await _supabase.from('rapid_types').select('*').eq('tenant_id', CURRENT_TENANT_ID);
                data = res.data || [];
            }

            loadedRapidTypesMap = {};
            const rapidTestItemSelect = document.getElementById('rapidTestItem');
            if(rapidTestItemSelect) rapidTestItemSelect.innerHTML = '<option value="">-- 請選擇快篩項目 --</option>';

            data.forEach(rt => { loadedRapidTypesMap[rt.name] = rt; });
            refreshRapidFeeSettings();
            updateRapidItemsForPet();
        }

        function updateRapidItemsForPet() {
            const select = document.getElementById('rapidTestItem');
            if (!select) return;
            const petId = document.getElementById('selectedRapidPetId')?.value;
            const pet = allPetsListForDropdown.find(item => item.id === petId);
            const previous = select.value;
            select.replaceChildren(new Option('-- 請選擇快篩項目 --', ''));
            Object.values(loadedRapidTypesMap).forEach(rt => {
                if (pet && (rt.target === pet.species || rt.target === '通用')) {
                    select.add(new Option(`${rt.name} (${rt.target}用)`, rt.name));
                }
            });
            select.value = [...select.options].some(opt => opt.value === previous) ? previous : '';
            onRapidItemSelected();
        }

        async function saveNewRapidType() {
            if(rapidNewTypeSaveBusy)return;
            if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可以新增快篩項目。');return;}
            const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id;
            if(!tenant||!user)return;
            const name=document.getElementById('newRapidTypeName').value.trim();
            const target=document.getElementById('newRapidTypeTarget').value;
            const sub_items=document.getElementById('newRapidSubItems').value.trim();
            const rawFee=document.getElementById('newRapidDefaultFee').value;
            if(!name){alert('請輸入快篩項目名稱！');return;}
            if(loadedRapidTypesMap[name]){alert('已有同名快篩，請選用既有項目並儲存其預設費用。');return;}
            let fee;try{fee=parseRapidDefaultFee(rawFee,true);}catch(e){alert(e.message);return;}
            const payload={tenant_id:tenant,name,target,sub_items};
            if(fee!==null)payload.default_fee=fee;
            rapidNewTypeSaveBusy=true;
            try{
                const {error}=await _supabase.from('rapid_types').insert([payload]);
                if(error)throw error;
                if(tenant!==CURRENT_TENANT_ID||user!==CURRENT_USER?.id)return;
                alert('快篩種類已成功建立！');
                if(document.getElementById('newRapidTypeName').value.trim()===name&&document.getElementById('newRapidDefaultFee').value===rawFee&&document.getElementById('newRapidSubItems').value.trim()===sub_items&&document.getElementById('newRapidTypeTarget').value===target){
                    document.getElementById('newRapidTypeName').value='';
                    document.getElementById('newRapidSubItems').value='';
                    document.getElementById('newRapidDefaultFee').value='';
                }
                await loadRapidTypes();
            }catch(e){alert('新增快篩種類失敗：'+e.message+'；若已填費用，請確認已執行快篩預設費用 SQL。');}
            finally{rapidNewTypeSaveBusy=false;}
        }

        function parseRapidComponents(value) {
            const items=Array.isArray(value)?value:String(value||'').split(/[,，、;；\n\r]+/);
            return [...new Set(items.map(x=>String(x).trim()).filter(Boolean))];
        }
        function renderRapidComponents(names, previous={}) {
            const container=document.getElementById('rapidSubResultsList');container.replaceChildren();
            for(const name of names){
                const box=document.createElement('div');box.className='form-group';
                const label=document.createElement('label');label.textContent=name+' 結果';
                const select=document.createElement('select');select.className='rapid-sub-result-select';select.dataset.subname=name;
                for(const [value,text] of [['','-- 請選擇結果 --'],['陰性 (Negative)','陰性 (Negative)'],['陽性 (Positive)','陽性 (Positive)'],['無效 (Invalid)','無效 (Invalid)']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}
                select.value=previous[name]||'';select.onchange=()=>{select.style.color=select.value.includes('Positive')?'#dc2626':select.value.includes('Negative')?'#059669':'';};select.onchange();
                box.append(label,select);container.append(box);
            }
        }
        function onRapidItemSelected(forceFee=false) {
            applyRapidDefaultFee(forceFee);
            const name=document.getElementById('rapidTestItem').value,rt=loadedRapidTypesMap[name];
            document.getElementById('rapidComponentsEditor').hidden=!rt;
            document.getElementById('rapidComponentsInput').value=rt?parseRapidComponents(rt.sub_items).join('、'):'';
            if(!rt){document.getElementById('rapidSubResultsList').textContent='請先選擇快篩項目…';return;}
            const names=parseRapidComponents(rt.sub_items);renderRapidComponents(names.length?names:[rt.name]);
        }
        function applyRapidComponents() {
            const rt=loadedRapidTypesMap[document.getElementById('rapidTestItem').value];if(!rt)return;
            const names=parseRapidComponents(document.getElementById('rapidComponentsInput').value);
            const previous=Object.fromEntries(Array.from(document.querySelectorAll('.rapid-sub-result-select'),s=>[s.dataset.subname,s.value]));
            renderRapidComponents(names.length?names:[rt.name],previous);
        }
        let rapidComponentsSaveBusy=false;
        async function saveRapidComponentsDefinition() {
            if(rapidComponentsSaveBusy)return;
            if(CURRENT_PROFILE?.role!=='admin'){alert('只有管理者可以修改快篩主檔；本次仍可使用子項目結果。');return;}
            const tenant=CURRENT_TENANT_ID,name=document.getElementById('rapidTestItem').value,rt=loadedRapidTypesMap[name];if(!rt)return;
            const names=parseRapidComponents(document.getElementById('rapidComponentsInput').value);
            rapidComponentsSaveBusy=true;
            try{
                const {data,error}=await _supabase.from('rapid_types').update({sub_items:names.join(', ')}).eq('tenant_id',tenant).eq('id',rt.id).select('id').single();
                if(error||!data)throw error||new Error('未更新任何資料');
                if(tenant!==CURRENT_TENANT_ID)return;
                rt.sub_items=names.join(', ');if(document.getElementById('rapidTestItem').value===name)applyRapidComponents();
                alert('子項目設定已儲存；舊報告不會被改寫。');
            }catch(e){alert('子項目設定儲存失敗：'+e.message);}finally{rapidComponentsSaveBusy=false;}
        }

        function filterVaccinePetDropdown() {
            const datalist = document.getElementById('vacPetDatalist');
            if (!datalist) return;
            datalist.innerHTML = '';
            allPetsListForDropdown.forEach(pet => {
                const opt = document.createElement('option');
                const codeStr = pet.owner_code ? `[編號:${pet.owner_code}] ` : '';
                opt.value = `${pet.name} (${codeStr}飼主: ${pet.owner_name} / 晶片: ${pet.microchip || '無'})`;
                opt.dataset.petId = pet.id;
                datalist.appendChild(opt);
            });
        }

        function filterLabPetDropdown() {
            const datalist = document.getElementById('labPetDatalist');
            if (!datalist) return;
            datalist.innerHTML = '';
            allPetsListForDropdown.forEach(pet => {
                const opt = document.createElement('option');
                const codeStr = pet.owner_code ? `[編號:${pet.owner_code}] ` : '';
                opt.value = `${pet.name} (${codeStr}飼主: ${pet.owner_name} / 晶片: ${pet.microchip || '無'})`;
                opt.dataset.petId = pet.id;
                datalist.appendChild(opt);
            });
        }

        function filterRapidPetDropdown() {
            const datalist = document.getElementById('rapidPetDatalist');
            if (!datalist) return;
            datalist.innerHTML = '';
            allPetsListForDropdown.forEach(pet => {
                const opt = document.createElement('option');
                const codeStr = pet.owner_code ? `[編號:${pet.owner_code}] ` : '';
                opt.value = `${pet.name} (${codeStr}飼主: ${pet.owner_name} / 晶片: ${pet.microchip || '無'})`;
                opt.dataset.petId = pet.id;
                datalist.appendChild(opt);
            });
        }

        let clinicalInvoiceContext = null;
        const serviceChargesPaidInSession = new Set();
        let vaccineRecordSaveBusy = false;
        let rapidRecordSaveBusy = false;
        function serviceDraftKey(tenantId=CURRENT_TENANT_ID) { return 'genblue-service-drafts-v1:'+tenantId; }
        function readServiceDrafts(tenantId=CURRENT_TENANT_ID) {
            const raw=localStorage.getItem(serviceDraftKey(tenantId));
            if (!raw) return [];
            const data=JSON.parse(raw);
            if (!Array.isArray(data)) throw new Error('待收費暫存格式錯誤，請先保留此瀏覽器資料。');
            for (const item of data) if (serviceChargesPaidInSession.has(tenantId+':'+item.id)) item.state='paid';
            return data;
        }
        function writeServiceDrafts(data,tenantId=CURRENT_TENANT_ID) { localStorage.setItem(serviceDraftKey(tenantId),JSON.stringify(data)); }
        function prepareServiceCharge(field,petId,kind,name) {
            const raw=document.getElementById(field).value.trim(), amount=Number(raw);
            if (!raw || !Number.isFinite(amount) || amount<0 || amount>99999999.99 || Math.abs(amount*100-Math.round(amount*100))>0.000001) throw new Error('請填寫有效的本次費用，免費請填 0；金額最多兩位小數。');
            if (!CURRENT_TENANT_ID) throw new Error('請先登入醫院帳號。');
            const pet=allPetsListForDropdown.find(p=>p.id===petId);
            if (!pet?.owner_id) throw new Error('找不到此寵物的飼主資料，請重新選取。');
            const charge={id:crypto.randomUUID(),tenantId:CURRENT_TENANT_ID,petId,ownerId:pet.owner_id,kind,name:name.slice(0,140),amount,state:'saving',createdAt:new Date().toISOString()};
            const drafts=readServiceDrafts(); drafts.push(charge); writeServiceDrafts(drafts);
            return charge;
        }
        function cancelServiceCharge(charge) {
            if (!charge) return;
            writeServiceDrafts(readServiceDrafts(charge.tenantId).filter(x=>x.id!==charge.id),charge.tenantId);
        }
        function finishServiceCharge(charge,recordId) {
            const drafts=readServiceDrafts(charge.tenantId), item=drafts.find(x=>x.id===charge.id);
            if (!item) throw new Error('待收費暫存遺失，請先保留畫面。');
            item.recordId=String(recordId); item.state='ready'; writeServiceDrafts(drafts,charge.tenantId);
            renderClinicalServiceCharges();
        }
        function renderClinicalServiceCharges() {
            const box=document.getElementById('clinicalServiceChargeSummary'); if (!box) return;
            box.replaceChildren();
            const scoped=readServiceDrafts().filter(x=>x.petId===currentPetId && x.tenantId===CURRENT_TENANT_ID);
            const drafts=scoped.filter(x=>x.state==='ready');
            if (scoped.some(x=>x.state==='saving')) { const warning=document.createElement('p'); warning.style.color='#b45309'; warning.textContent='有登記結果尚未確認的費用，未自動帶入帳單。請核對已儲存的檢驗／疫苗紀錄及帳單，勿重複登記。'; box.appendChild(warning); }
            if (!scoped.length) { box.textContent='此寵物尚無待收費項目。'; return; }
            for (const item of drafts) { const row=document.createElement('div'); row.textContent=item.name+'：NT$ '+item.amount.toLocaleString(); box.appendChild(row); }
        }
        function attachServiceChargesToInvoice(petId) {
            const pet=allPetsListForDropdown.find(p=>p.id===petId); if (!pet) return;
            clinicalInvoiceContext={tenantId:CURRENT_TENANT_ID,petId,petName:pet.name,ownerId:pet.owner_id,appointmentId:currentAppointmentId||null};
            const container=document.getElementById('invoiceItemsList');
            const present=new Set(Array.from(container.querySelectorAll('[data-service-charge-id]')).map(x=>x.dataset.serviceChargeId));
            for (const charge of readServiceDrafts().filter(x=>x.state==='ready' && x.petId===petId && x.tenantId===CURRENT_TENANT_ID)) {
                if (present.has(charge.id)) continue;
                const row=document.createElement('div'); row.className='list-row'; row.dataset.serviceChargeId=charge.id;
                const name=document.createElement('input'); name.className='invoice-name'; name.value=charge.name; name.type='text';
                const qty=document.createElement('input'); qty.className='invoice-qty'; qty.type='number'; qty.value='1'; qty.oninput=calculateInvoiceTotal;
                const price=document.createElement('input'); price.className='invoice-price'; price.type='number'; price.min='0'; price.step='0.01'; price.value=String(charge.amount); price.oninput=calculateInvoiceTotal;
                const remove=document.createElement('button'); remove.className='btn-danger'; remove.textContent='移出本次帳單'; remove.onclick=()=>{row.remove();calculateInvoiceTotal();};
                row.append(name,qty,price,remove); container.appendChild(row);
            }
        }
        function markServiceChargesPaid(ids,invoiceId) {
            const drafts=readServiceDrafts();
            for (const item of drafts) if (ids.includes(item.id)) { serviceChargesPaidInSession.add(CURRENT_TENANT_ID+':'+item.id); item.state='paid'; item.invoiceId=invoiceId; }
            writeServiceDrafts(drafts);
        }
        function removePendingServiceRecord(kind,recordId) {
            writeServiceDrafts(readServiceDrafts().filter(x=>!(x.kind===kind && x.recordId===String(recordId) && x.state!=='paid')));
            renderClinicalServiceCharges();
        }

        async function recordPetVaccine(returnToMedical=false) {
            if (vaccineRecordSaveBusy) return;
            const petId=document.getElementById('selectedVacPetId').value;
            const vaccineName=document.getElementById('vacTypeSelect').value;
            const administeredDate=document.getElementById('vacAdministeredDate').value;
            const nextDueDate=document.getElementById('vacNextDueDate').value;
            const notes=document.getElementById('vacNotes').value;
            if (!petId || !vaccineName || !administeredDate) { alert('請完整選擇寵物、疫苗種類與施打日期！'); return; }
            let charge; vaccineRecordSaveBusy=true;
            try {
                const rabiesDetails=await collectRabiesDetails(petId,vaccineName);
                charge=prepareServiceCharge('vacServiceFee',petId,'vaccine','疫苗：'+vaccineName);
                const {data,error}=await _supabase.from('vaccination_records').insert([{tenant_id:CURRENT_TENANT_ID,pet_id:petId,vaccine_name:vaccineName,last_date:administeredDate,next_due_date:nextDueDate||null,notes:notes||'',...(rabiesDetails?{rabies_details:rabiesDetails}:{})}]).select('id').single();
                if (error) { cancelServiceCharge(charge); alert('紀錄儲存失敗：'+error.message); return; }
                if(rabiesDetails)rememberRabiesDefaultsV9112(rabiesDetails);
                finishServiceCharge(charge,data.id);
                document.getElementById('vacTypeSelect').value='';
                clearRabiesFields();
                document.getElementById('vacNextDueDate').value='';
                document.getElementById('vacNotes').value='';
                document.getElementById('vacServiceFee').value='';
                if(typeof updateVaccineFeeHint20261026==='function')updateVaccineFeeHint20261026();
                await loadPetVaccines();
                alert('疫苗紀錄已儲存，費用已加入此寵物待收費清單。');
                if (returnToMedical) backToMedicalFromVaccine();
            } catch(error) { alert('疫苗登記未完成或結果待確認：'+error.message+'。請保留畫面，勿重複按儲存。'); }
            finally { vaccineRecordSaveBusy=false; }
        }

        function syncMedicalHistoryButton(panelId) {
            const panel=document.getElementById(panelId),button=document.getElementById('historyToggle_'+panelId);
            if(!panel||!button)return;
            button.setAttribute('aria-expanded',String(panel.open));
            button.textContent=(panel.open?'▼ ':'▶ ')+button.dataset.label;
        }
        function toggleMedicalHistoryPanel(panelId) {
            const panel=document.getElementById(panelId);if(!panel)return;
            panel.open=!panel.open;syncMedicalHistoryButton(panelId);
        }

        const currentPetHistoryRequests=new Map();
        function resetCurrentPetClinicalHistories() {
            for (const kind of ['rapid','cbc','bio','imaging']) {
                currentPetHistoryRequests.set(kind,(currentPetHistoryRequests.get(kind)||0)+1);
                const panel=document.getElementById('medicalHistoryPanel_'+kind);if(panel)panel.open=false;
                const box=document.getElementById('medicalHistoryContent_'+kind);if(box)box.textContent=currentPetId?'點擊展開查詢目前寵物紀錄。':'請先選擇寵物。';
            }
        }
        async function queryCurrentPetHistoryPages(table,petId,tenant,kind) {
            const rows=[];
            for(let offset=0;;offset+=1000) {
                let q=_supabase.from(table).select('*').eq('tenant_id',tenant).eq('pet_id',petId);
                if(table==='lab_reports') q=kind==='cbc'?q.eq('test_type','CBC全血球'):q.neq('test_type','CBC全血球');
                if(table==='lab_tests') q=q.in('test_category',['數位 X 光影像','超音波掃描','X光','X 光','超音波','影像']);
                const {data,error}=await q.order(table==='imaging_studies'?'study_date':'created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
                if(error)throw error;
                if(tenant!==CURRENT_TENANT_ID||petId!==currentPetId)return null;
                rows.push(...(data||[]));if(!data||data.length<1000)return rows;
            }
        }
        function currentPetHistoryIdentity(pet) {
            const owner=pet.owners||{},codes=[owner.system_code?'新：'+owner.system_code:'',owner.owner_code?'舊：'+owner.owner_code:''].filter(Boolean).join('／');
            return '寵物：'+pet.name+'（'+(pet.species||'未填物種')+'）｜飼主：'+(owner.name||'飼主資料無法讀取')+
                (codes?' ['+codes+']':'')+'｜電話：'+([owner.mobile,owner.phone].filter(Boolean).join('／')||'無電話');
        }
        function renderCurrentPetRapidReport(record) {
            const e=escapeCheckoutText;let results=record.result;
            if(typeof results==='string') {try{results=JSON.parse(results);}catch{results={'結果':results};}}
            if(!results||typeof results!=='object'||Array.isArray(results))results={'結果':results??'未填'};
            let text='<h4>'+e(record.test_item||'快篩')+'</h4><p>檢驗時間：'+e(new Date(record.created_at).toLocaleString())+'｜批號：'+e(record.batch_no||'未填')+'</p>';
            for(const [name,value]of Object.entries(results)){const result=String(value??'未填');text+='<p><b>'+e(name)+'</b>：<span style="color:'+(result.includes('陽性')?'#dc2626':'#334155')+';font-weight:bold">'+e(result)+'</span></p>';}
            return text+'<p>備註：'+e(record.notes||'-')+'</p>';
        }
        function appendPatientImageRecord(container,record,nativeStudy=false) {
            const item=document.createElement('div');item.style.cssText='padding:12px 0;border-bottom:1px solid #e2e8f0;';
            const title=document.createElement('h4');title.textContent=nativeStudy?(record.modality||'影像'):(record.test_category||'影像／附件');item.appendChild(title);
            const info=document.createElement('p');info.textContent='日期：'+new Date(record.study_date||record.created_at).toLocaleString()+
                (nativeStudy?'｜部位：'+(record.body_part||'未填')+'｜拍攝方向：'+(record.views||'未填')+'｜醫師：'+(record.veterinarian_name||'未填'):'');item.appendChild(info);
            if(nativeStudy){const interpretation=document.createElement('p');interpretation.textContent='判讀：'+(record.interpretation||'未填')+'；臨床備註：'+(record.clinical_note||'未填');item.appendChild(interpretation);}
            if(record.file_url){
                let url;try{url=new URL(record.file_url);if(!['https:','http:'].includes(url.protocol))url=null;}catch{url=null;}
                if(url){
                    if(/\.(png|jpe?g|gif|webp)$/i.test(url.pathname)){const image=document.createElement('img');image.src=url.href;image.alt='此寵物影像';image.loading='lazy';image.style.cssText='max-width:100%;max-height:600px;object-fit:contain;';item.appendChild(image);}
                    else if(/\.pdf$/i.test(url.pathname)){const frame=document.createElement('iframe');frame.src=url.href;frame.title='此寵物影像報告';frame.setAttribute('sandbox','');frame.style.cssText='width:100%;height:600px;border:1px solid #e2e8f0;';item.appendChild(frame);}
                    const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='開啟原始附件（另開視窗）';item.appendChild(link);
                } else {const note=document.createElement('p');note.textContent='附件連結格式無法預覽，請確認原始檔案。';item.appendChild(note);}
            }
            container.appendChild(item);
            if(nativeStudy)appendPrivateImageAssetsV61(item,record);
        }
        async function loadCurrentPetClinicalHistory(kind) {
            if(!['rapid','cbc','bio','imaging'].includes(kind))return;
            const tenant=CURRENT_TENANT_ID,petId=currentPetId,box=document.getElementById('medicalHistoryContent_'+kind);if(!box)return;
            if(!petId||!tenant){box.textContent='請先選擇寵物。';return;}
            const request=(currentPetHistoryRequests.get(kind)||0)+1;currentPetHistoryRequests.set(kind,request);box.textContent='讀取中…';
            const valid=()=>tenant===CURRENT_TENANT_ID&&petId===currentPetId&&currentPetHistoryRequests.get(kind)===request;
            try {
                const {data:pet,error:petError}=await _supabase.from('pets').select('id,name,species,owners(name,mobile,phone,owner_code,system_code)').eq('tenant_id',tenant).eq('id',petId).single();
                if(petError||!pet)throw petError||new Error('寵物資料無法讀取');if(!valid())return;
                const table=kind==='rapid'?'rapid_test_records':kind==='imaging'?'lab_tests':'lab_reports';
                const rows=await queryCurrentPetHistoryPages(table,petId,tenant,kind);if(!valid()||rows===null)return;
                let studies=[];
                // v61: imaging tables use text clinic IDs with tenant-scoped RLS.
                const imagingSupported=!!tenant;
                if(kind==='imaging'&&imagingSupported){studies=await queryCurrentPetHistoryPages('imaging_studies',petId,tenant,kind);if(!valid()||studies===null)return;}
                box.replaceChildren();const identity=document.createElement('p');identity.textContent=currentPetHistoryIdentity(pet);box.appendChild(identity);
                if(!rows.length&&!studies.length){const empty=document.createElement('p');empty.textContent='此寵物尚無已儲存的'+({rapid:'快篩',cbc:'CBC 血球',bio:'血清生化',imaging:'影像／附件'}[kind])+'紀錄。';box.appendChild(empty);}
                for(const record of rows){
                    if(kind==='imaging'){appendPatientImageRecord(box,record);continue;}
                    const item=document.createElement('div');item.style.cssText='padding:12px 0;border-bottom:1px solid #e2e8f0;';
                    item.innerHTML=kind==='rapid'?renderCurrentPetRapidReport(record):buildLabReportHtml({...record,pets:{name:pet.name,species:pet.species}});box.appendChild(item);
                }
                for(const record of studies)appendPatientImageRecord(box,record,true);
                if(kind==='imaging'&&!imagingSupported){const note=document.createElement('p');note.textContent='目前顯示院內已儲存的影像附件；儀器影像中心尚未接通此醫院代碼。';box.appendChild(note);}
            }catch(error){if(valid()){box.textContent='讀取失敗：'+error.message+'。';const retry=document.createElement('button');retry.textContent='重新讀取';retry.onclick=()=>loadCurrentPetClinicalHistory(kind);box.appendChild(retry);}}
        }
        function refreshOpenCurrentPetHistory(kind){if(document.getElementById('medicalHistoryPanel_'+kind)?.open)loadCurrentPetClinicalHistory(kind);}

        let vaccineLoadRequest=0;
        async function loadPetVaccines() {
            const tenant=CURRENT_TENANT_ID,request=++vaccineLoadRequest;if(!tenant)return;
            try {
                const rows=[];
                for(let offset=0;;offset+=1000){
                    const {data,error}=await _supabase.from('vaccination_records').select('*').eq('tenant_id',tenant)
                        .order('last_date',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
                    if(error)throw error;
                    if(tenant!==CURRENT_TENANT_ID||request!==vaccineLoadRequest)return;
                    rows.push(...(data||[]));if(!data||data.length<1000)break;
                }
                // vaccination_records.pet_id has no FK here; fetch only its referenced pets and their owner FK.
                const ids=[...new Set(rows.map(v=>v.pet_id).filter(Boolean))],pets=new Map();
                for(let offset=0;offset<ids.length;offset+=200){
                    const {data,error}=await _supabase.from('pets').select('id,name,microchip,species,owner_id,owners(id,name,mobile,phone,owner_code,system_code)')
                        .eq('tenant_id',tenant).in('id',ids.slice(offset,offset+200));
                    if(error)throw error;
                    if(tenant!==CURRENT_TENANT_ID||request!==vaccineLoadRequest)return;
                    for(const pet of data||[])pets.set(pet.id,pet);
                }
                allVaccinationCache=rows.map(v=>{const pet=pets.get(v.pet_id),owner=pet?.owners;return {...v,
                    pet_name:pet?.name||'寵物資料無法讀取',pet_microchip:pet?.microchip||'',pet_species:pet?.species||'',
                    owner_id:pet?.owner_id||null,owner_name:owner?.name||'飼主資料無法讀取',owner_mobile:owner?.mobile||'',
                    owner_phone:owner?.phone||'',owner_code:owner?.owner_code||'',owner_system_code:owner?.system_code||''};});
                filterVaccineTable();filterSearchVaccines();renderCurrentPetVaccineHistory();vaccineToolsRender();
            }catch(error){
                if(tenant===CURRENT_TENANT_ID&&request===vaccineLoadRequest){
                    alert('疫苗紀錄查詢失敗：'+error.message+'。請重新查詢，勿重新登記已施打紀錄。');
                    const box=document.getElementById('medicalVaccineHistoryContent');if(box)box.textContent='疫苗紀錄讀取失敗，請重新展開查詢。';
                }
            }
        }
        function renderCurrentPetVaccineHistory(){
            const box=document.getElementById('medicalVaccineHistoryContent');if(!box)return;box.replaceChildren();
            if(!currentPetId){box.textContent='請先選擇寵物。';return;}
            const rows=currentClinicVaccineRows().filter(v=>v.pet_id===currentPetId);
            if(!rows.length){box.textContent='此寵物尚無疫苗施打紀錄。';return;}
            for(const v of rows){const item=document.createElement('div');item.style.cssText='padding:12px 0;border-bottom:1px solid #e2e8f0;';
                item.innerHTML=vaccineIdentityHtml(v)+'<p><b>'+escapeCheckoutText(v.vaccine_name||'未指定疫苗')+'</b>｜施打：'+escapeCheckoutText(v.last_date||'未填')+
                    '｜下次：'+escapeCheckoutText(v.next_due_date||'未設定')+'</p><p>備註／批號：'+escapeCheckoutText(v.notes||'-')+'</p>';box.appendChild(item);}
        }
        function renderVaccineTable(dataList){
            const tbody=document.getElementById('petVaccineTableBody');if(!tbody)return;tbody.innerHTML='';
            if(collapseHistoryUntilSearch(tbody,'vacReportTableSearch'))return;
            if(!dataList?.length){tbody.innerHTML='<tr><td colspan="6">查無符合的疫苗施打紀錄。</td></tr>';return;}
            for(const v of dataList){const tr=document.createElement('tr');tr.innerHTML=vaccineRecordCells(v);
                const td=document.createElement('td'),button=document.createElement('button');button.className='btn-danger';button.textContent='刪除';button.onclick=()=>deletePetVaccine(v.id);td.appendChild(button);tr.appendChild(td);tbody.appendChild(tr);}
        }
        function filterVaccineTable(){renderVaccineTable(filterVaccineRecords(document.getElementById('vacReportTableSearch').value));}
        async function deletePetVaccine(id){
            if(!confirm('確定刪除這筆施打紀錄？已結帳費用不會因此自動退款。'))return;
            const tenant=CURRENT_TENANT_ID;
            const {data,error}=await _supabase.from('vaccination_records').delete().eq('id',id).eq('tenant_id',tenant).select('id').single();
            if(error||!data){alert('刪除失敗：'+(error?.message||'找不到紀錄'));return;}
            if(tenant!==CURRENT_TENANT_ID)return;
            removePendingServiceRecord('vaccine',id);await loadPetVaccines();
        }

        async function showStockHistory(kind, id) {
            const row = kind === 'item' ? loadedItemsMap[id] : loadedMedicinesMap[id];
            const { data, error } = await _supabase.from('inventory_movements')
                .select('created_at,change_qty,qty_before,qty_after,reason')
                .eq('tenant_id', CURRENT_TENANT_ID).eq('item_kind', kind).eq('item_id', id)
                .order('created_at', { ascending: false }).limit(50);
            if (error) { alert('無法讀取異動紀錄：' + error.message); return; }
            const lines = (data || []).map(x => `${new Date(x.created_at).toLocaleString()}：${x.change_qty > 0 ? '+' : ''}${x.change_qty}（${x.qty_before} → ${x.qty_after}）${x.reason}`);
            alert(`${row ? row.name : '品項'}：最近異動\n` + (lines.length ? lines.join('\n') : '尚無異動紀錄；既有庫存量是啟用前的起始量。'));
        }

        function isRegulatedInventoryRow(kind, row) {
            if (!row) return false;
            return kind === 'medicine'
                ? !!(row.reportable || row.controlled_drug)
                : !!(row.reportable || row.regulatory_class === '動物用商品');
        }

        function openRegulatedLotReceipt(kind, id) {
            const row = kind === 'item' ? loadedItemsMap[id] : loadedMedicinesMap[id];
            if (!row) return;
            document.getElementById('lotItemKind').value = kind;
            document.getElementById('lotItemId').value = id;
            document.getElementById('lotItemTitle').textContent =
                `${row.name}｜目前庫存 ${row.stock_qty || 0} ${kind === 'medicine' ? (row.unit || '錠') : (row.smallest_unit || '件')}`;
            document.getElementById('lotQuantity').value = '';
            document.getElementById('lotNo').value = '';
            document.getElementById('lotExpiryDate').value = '';
            document.getElementById('lotReceivedDate').value = new Date().toISOString().slice(0,10);
            document.getElementById('lotSupplierName').value = '';
            document.getElementById('lotPurchaseDocumentNo').value = '';
            document.getElementById('lotNotes').value = '';
            document.getElementById('regulatedLotModal').style.display = 'flex';
        }

        function closeRegulatedLotModal() {
            document.getElementById('regulatedLotModal').style.display = 'none';
        }

        async function saveRegulatedLotReceipt() {
            const kind = document.getElementById('lotItemKind').value;
            const id = document.getElementById('lotItemId').value;
            const quantity = Number(document.getElementById('lotQuantity').value);
            const lotNo = document.getElementById('lotNo').value.trim();
            const expiry = document.getElementById('lotExpiryDate').value || null;
            const receivedDate = document.getElementById('lotReceivedDate').value;
            const supplier = document.getElementById('lotSupplierName').value.trim();
            const docNo = document.getElementById('lotPurchaseDocumentNo').value.trim();
            const notes = document.getElementById('lotNotes').value.trim();

            if (!Number.isFinite(quantity) || quantity <= 0) { alert('進貨數量必須大於 0。'); return; }
            if (!lotNo) { alert('請填寫批號。'); return; }

            const receivedAt = receivedDate ? `${receivedDate}T12:00:00` : new Date().toISOString();
            const { error } = await _supabase.rpc('receive_regulated_lot', {
                p_kind: kind,
                p_id: id,
                p_quantity: quantity,
                p_lot_no: lotNo,
                p_expiry_date: expiry,
                p_supplier_name: supplier || null,
                p_purchase_document_no: docNo || null,
                p_received_at: receivedAt,
                p_notes: notes || null
            });
            if (error) { alert('批次入庫失敗：' + error.message + '\n請先確認第16步 SQL 已執行成功。'); return; }

            closeRegulatedLotModal();
            alert('批次入庫完成，總庫存已同步增加。');
            if (kind === 'item') await loadItems(); else await loadMedicines();
        }

        async function showRegulatedLots(kind, id) {
            const row = kind === 'item' ? loadedItemsMap[id] : loadedMedicinesMap[id];
            if (!row) return;
            const { data, error } = await _supabase.from('regulated_lots')
                .select('lot_no,expiry_date,received_at,supplier_name,qty_received,qty_on_hand,smallest_unit,purchase_document_no')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .eq('item_kind', kind)
                .eq('item_id', id)
                .order('expiry_date', { ascending:true, nullsFirst:false })
                .order('received_at', { ascending:false });
            if (error) { alert('讀取批次資料失敗：' + error.message); return; }

            document.getElementById('lotListItemTitle').textContent = row.name;
            const body = document.getElementById('regulatedLotListBody');
            if (!data || !data.length) {
                body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#64748b;">尚無批次資料</td></tr>';
            } else {
                body.innerHTML = data.map(x => {
                    const expiryText = x.expiry_date || '-';
                    const expired = x.expiry_date && x.expiry_date < new Date().toISOString().slice(0,10);
                    return `<tr>
                        <td><b>${escapeRegText(x.lot_no || '-')}</b></td>
                        <td style="${expired ? 'color:#dc2626;font-weight:bold;' : ''}">${escapeRegText(expiryText)}${expired ? '（已過期）' : ''}</td>
                        <td>${x.received_at ? new Date(x.received_at).toLocaleDateString() : '-'}</td>
                        <td>${escapeRegText(x.supplier_name || '-')}</td>
                        <td>${x.qty_received ?? 0}</td>
                        <td><b>${x.qty_on_hand ?? 0}</b></td>
                        <td>${escapeRegText(x.smallest_unit || '-')}</td>
                        <td>${escapeRegText(x.purchase_document_no || '-')}</td>
                    </tr>`;
                }).join('');
            }
            document.getElementById('regulatedLotListModal').style.display = 'flex';
        }

        function closeRegulatedLotList() {
            document.getElementById('regulatedLotListModal').style.display = 'none';
        }

        async function adjustStock(kind, id) {
            const row = kind === 'item' ? loadedItemsMap[id] : loadedMedicinesMap[id];
            if (!row) return;

            // 需申報／管制品項的正向進貨改走批號流程，避免總庫存有增加但沒有批號來源。
            if (isRegulatedInventoryRow(kind, row)) {
                const choice = prompt(`${row.name} 為申報／管制品項。\n輸入「入庫」進行批號進貨；若要盤虧/盤點調整，輸入「調整」。`, '入庫');
                if (choice === null) return;
                if (choice.trim() === '入庫') { openRegulatedLotReceipt(kind, id); return; }
                if (choice.trim() !== '調整') { alert('請輸入「入庫」或「調整」。'); return; }
            }

            const unit = kind === 'item' ? (row.smallest_unit || '件') : (row.unit || '錠');
            const raw = prompt(`${row.name}：目前 ${row.stock_qty || 0} ${unit}\n輸入異動數量（正數增加、負數盤虧）：`);
            if (raw === null) return;
            if (!/^[+-]?(?:\d+)(?:\.\d+)?$/.test(raw.trim()) || Number(raw) === 0 || !Number.isFinite(Number(raw))) {
                alert('請輸入非零數量'); return;
            }
            if (isRegulatedInventoryRow(kind, row) && Number(raw) > 0) {
                alert('申報／管制品項的正向入庫必須使用「批號入庫」。');
                openRegulatedLotReceipt(kind, id);
                return;
            }
            const reason = prompt('請填寫原因（例如：盤點調整、盤虧）：');
            if (reason === null) return;
            if (!reason.trim()) { alert('請填寫異動原因'); return; }
            const { error } = await _supabase.rpc('adjust_inventory', {
                p_kind: kind, p_id: id, p_change: Number(raw), p_reason: reason.trim()
            });
            if (error) { alert('庫存異動失敗：' + error.message); return; }
            alert('庫存異動已儲存');
            if (kind === 'item') await loadItems(); else await loadMedicines();
        }


        // ===== 第 14 步：商品分類資料庫管理 =====
        let itemCategoriesCache = [];

        async function loadItemCategories() {
            if (!CURRENT_TENANT_ID) return;
            const { data, error } = await _supabase.from('item_categories')
                .select('*')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .order('sort_order', { ascending:true })
                .order('name', { ascending:true });
            if (error) {
                console.warn('載入商品分類失敗：', error.message);
                return;
            }
            itemCategoriesCache = data || [];
            syncItemCategorySelects();
        }

        function syncItemCategorySelects() {
            const selects = [
                document.getElementById('itemCategory'),
                document.getElementById('editItemCategorySelect')
            ].filter(Boolean);
            selects.forEach(sel => {
                const current = normalizeItemCategory(sel.value);
                sel.innerHTML = '';
                itemCategoriesCache.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    sel.appendChild(opt);
                });
                if (itemCategoriesCache.some(c => c.name === current)) sel.value = current;
                else if (itemCategoriesCache.some(c => c.name === '一般商品')) sel.value = '一般商品';
            });
        }

        async function openItemCategoryManager() {
            await loadItemCategories();
            await renderItemCategoryManager();
            document.getElementById('itemCategoryManagerModal').style.display = 'flex';
        }

        function closeItemCategoryManager() {
            document.getElementById('itemCategoryManagerModal').style.display = 'none';
        }

        async function renderItemCategoryManager() {
            const body = document.getElementById('itemCategoryManagerBody');
            if (!body) return;
            const { data: items, error } = await _supabase.from('items')
                .select('category')
                .eq('tenant_id', CURRENT_TENANT_ID);
            if (error) { body.innerHTML = `<tr><td colspan="3">載入失敗：${escapeRegText(error.message)}</td></tr>`; return; }
            const counts = {};
            (items || []).forEach(i => {
                const c = normalizeItemCategory(i.category);
                counts[c] = (counts[c] || 0) + 1;
            });
            body.innerHTML = itemCategoriesCache.map(c => `
                <tr>
                    <td><b>${escapeRegText(c.name)}</b>${c.name === '動物用商品' ? '<br><small style="color:#0369a1;">申報正式分類</small>' : ''}</td>
                    <td>${counts[c.name] || 0}</td>
                    <td>
                        <button class="btn-secondary" onclick="renameManagedItemCategory('${c.id}')">重新命名</button>
                        <button class="btn-danger" onclick="deleteManagedItemCategory('${c.id}')">刪除</button>
                    </td>
                </tr>`).join('');
        }

        async function createManagedItemCategory() {
            const input = document.getElementById('newManagedItemCategory');
            const name = (input?.value || '').trim();
            if (!name) { alert('請輸入分類名稱'); return; }
            if (name === '動物用藥品') {
                alert('商品專區請使用「動物用商品」；「動物用藥品」保留給藥品專區。');
                return;
            }
            const { error } = await _supabase.from('item_categories').insert([{
                tenant_id: CURRENT_TENANT_ID, name
            }]);
            if (error) { alert('新增分類失敗：' + error.message); return; }
            input.value = '';
            await loadItemCategories();
            await renderItemCategoryManager();
        }

        async function renameManagedItemCategory(categoryId) {
            const cat = itemCategoriesCache.find(c => c.id === categoryId);
            if (!cat) return;
            const newName = (prompt(`將「${cat.name}」重新命名為：`, cat.name) || '').trim();
            if (!newName || newName === cat.name) return;
            if (newName === '動物用藥品') {
                alert('商品專區請使用「動物用商品」。');
                return;
            }
            if (cat.name === '動物用商品') {
                alert('「動物用商品」是申報正式分類，不能重新命名；可新增其他分類。');
                return;
            }
            const { error: catError } = await _supabase.from('item_categories')
                .update({ name:newName, updated_at:new Date().toISOString() })
                .eq('id', categoryId).eq('tenant_id', CURRENT_TENANT_ID);
            if (catError) { alert('重新命名失敗：' + catError.message); return; }

            const { error: itemError } = await _supabase.from('items')
                .update({ category:newName })
                .eq('tenant_id', CURRENT_TENANT_ID)
                .eq('category', cat.name);
            if (itemError) { alert('分類名稱已更新，但商品同步失敗：' + itemError.message); }
            await loadItemCategories();
            await loadItems();
            await renderItemCategoryManager();
        }

        async function deleteManagedItemCategory(categoryId) {
            const cat = itemCategoriesCache.find(c => c.id === categoryId);
            if (!cat) return;
            if (cat.name === '一般商品' || cat.name === '動物用商品') {
                alert(`「${cat.name}」為系統必要分類，不能刪除。`);
                return;
            }

            const { count, error: countError } = await _supabase.from('items')
                .select('id', { count:'exact', head:true })
                .eq('tenant_id', CURRENT_TENANT_ID)
                .eq('category', cat.name);
            if (countError) { alert('檢查分類使用狀況失敗：' + countError.message); return; }

            if ((count || 0) > 0) {
                const targets = itemCategoriesCache.filter(c => c.id !== categoryId);
                const choices = targets.map(c => c.name).join('、');
                const target = (prompt(`「${cat.name}」目前有 ${count} 個商品。\n刪除前請輸入要轉移到的分類名稱：\n${choices}`, '一般商品') || '').trim();
                if (!target) return;
                if (!targets.some(c => c.name === target)) {
                    alert('請輸入現有的目標分類名稱。');
                    return;
                }
                const targetIsVeterinary = target === '動物用商品';
                const { error: moveError } = await _supabase.from('items').update({
                    category: target,
                    regulatory_class: targetIsVeterinary ? '動物用商品' : '一般商品',
                    reportable: targetIsVeterinary,
                    regulatory_updated_at: new Date().toISOString()
                }).eq('tenant_id', CURRENT_TENANT_ID).eq('category', cat.name);
                if (moveError) { alert('商品轉移失敗：' + moveError.message); return; }
            }

            if (!confirm(`確定刪除分類「${cat.name}」？`)) return;
            const { error } = await _supabase.from('item_categories')
                .delete().eq('id', categoryId).eq('tenant_id', CURRENT_TENANT_ID);
            if (error) { alert('刪除分類失敗：' + error.message); return; }

            await loadItemCategories();
            await loadItems();
            await renderItemCategoryManager();
        }

        // 商品專區舊稱相容：過去商品資料使用「動物用藥品」，
        // 現在正式更名為「動物用商品」；藥品專區不受影響。
        function normalizeItemCategory(category) {
            return category === '動物用藥品' ? '動物用商品' : (category || '一般商品');
        }

        let legacyVeterinaryProductCategoryMigrated = false;
        async function migrateLegacyVeterinaryProductCategory() {
            if (legacyVeterinaryProductCategoryMigrated) return;
            legacyVeterinaryProductCategoryMigrated = true;
            const { error } = await _supabase.from('items')
                .update({
                    category: '動物用商品',
                    regulatory_class: '動物用商品',
                    reportable: true,
                    regulatory_updated_at: new Date().toISOString()
                })
                .eq('tenant_id', CURRENT_TENANT_ID)
                .eq('category', '動物用藥品');
            if (error) console.warn('舊商品分類更名未完成：', error.message);
        }

        async function loadItems(options={}) {
            if(!options.preserveDrafts){await migrateLegacyVeterinaryProductCategory();await loadItemCategories();}
            const { data, error } = await _supabase.from('items').select('*').eq('tenant_id', CURRENT_TENANT_ID);
 if(options.preserveDrafts){if(error)throw error;if(options.scope!==clinicRefreshScopeV50())throw Error('登入已變更');}
            if (error) return;

            const tbody = document.getElementById('itemTableBody');
            const datalist = document.getElementById('productDataList');
            
            if(tbody) tbody.innerHTML = '';
            if(datalist) datalist.innerHTML = '';
            loadedItemsMap = {};

            if (!data || data.length === 0) {
                if(tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">尚無一般商品資料</td></tr>`;
                return;
            }

            data.forEach(item => {
                item.category = normalizeItemCategory(item.category);
                loadedItemsMap[item.id] = item;

                if(tbody) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><b>${item.name}</b></td>
                        <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${item.category || '一般商品'}</span></td>
                        <td>NT$ ${item.cost_price || 0}</td>
                        <td>NT$ ${item.sell_price || 0}</td>
                        <td>${item.stock_qty || 0}${Number(item.stock_qty || 0) <= Number(item.safety_stock || 0) ? ' <span style="color:#dc2626">低庫存</span>' : ''}</td>
                        <td>${item.safety_stock || 0}</td>
                        <td>
                            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openEditItemModal('${item.id}')">完整修改</button>
                            <button class="btn-secondary" onclick="adjustStock('item','${item.id}')">入庫／盤點</button>
                            <button class="btn-secondary" onclick="showStockHistory('item','${item.id}')">異動紀錄</button>
                            ${(item.reportable || item.regulatory_class === '動物用商品') ? `<button class="btn-secondary" onclick="openRegulatedLotReceipt('item','${item.id}')">批號入庫</button><button class="btn-secondary" onclick="showRegulatedLots('item','${item.id}')">批次明細</button>` : ''}
                            <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteItem('${item.id}')">刪除</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
                if(datalist) {
                    const opt = document.createElement('option');
                    opt.value = `${item.name} | ${item.sell_price} | ${item.category || '一般商品'}`;
                    datalist.appendChild(opt);
                }
            });
        }

        async function saveNewItem() {
            const name = document.getElementById('itemName').value.trim();
            const category = document.getElementById('itemCategory').value;
            const cost_price = parseFloat(document.getElementById('itemCostPrice').value) || 0;
            const sell_price = parseFloat(document.getElementById('itemSellPrice').value) || 0;
            const stock_qty = parseInt(document.getElementById('itemStockQty').value) || 0;
            const safety_stock = parseInt(document.getElementById('itemSafetyStock').value) || 0;
            
            if(!name || !sell_price) { alert('請填寫商品名稱與售價！'); return; }

            const normalizedCategory = normalizeItemCategory(category);
            const { error } = await _supabase.from('items').insert([{
                tenant_id: CURRENT_TENANT_ID, name, category: normalizedCategory, cost_price, sell_price, stock_qty, safety_stock,
                regulatory_class: normalizedCategory === '動物用商品' ? '動物用商品' : '一般商品',
                reportable: normalizedCategory === '動物用商品',
                regulatory_updated_at: new Date().toISOString()
            }]);
            
            if (error) { 
                alert('新增失敗：' + error.message); 
            } else { 
                alert('商品已成功建立！'); 
                document.getElementById('itemName').value = '';
                document.getElementById('itemCostPrice').value = '';
                document.getElementById('itemSellPrice').value = '';
                document.getElementById('itemStockQty').value = '';
                document.getElementById('itemSafetyStock').value = '';
                loadItems();
            }
        }

        function openEditItemModal(itemId) {
            const item = loadedItemsMap[itemId];
            if (!item) return;

            document.getElementById('editItemId').value = item.id;
            document.getElementById('editItemName').value = item.name || '';
            const editCat = document.getElementById('editItemCategorySelect');
            syncItemCategorySelects();
            if (editCat) editCat.value = normalizeItemCategory(item.category);
            document.getElementById('editItemCostPrice').value = item.cost_price || 0;
            document.getElementById('editItemSellPrice').value = item.sell_price || 0;
            document.getElementById('editItemStockQty').value = item.stock_qty || 0;
            document.getElementById('editItemStockQty').readOnly = true;
            document.getElementById('editItemSafetyStock').value = item.safety_stock || 0;

            document.getElementById('editItemModal').style.display = 'flex';
        }

        function closeEditItemModal() {
            document.getElementById('editItemModal').style.display = 'none';
        }

        async function saveEditedItem() {
            const itemId = document.getElementById('editItemId').value;
            const name = document.getElementById('editItemName').value.trim();
            const category = document.getElementById('editItemCategorySelect').value;
            const cost_price = parseFloat(document.getElementById('editItemCostPrice').value) || 0;
            const sell_price = parseFloat(document.getElementById('editItemSellPrice').value) || 0;
            const stock_qty = parseInt(document.getElementById('editItemStockQty').value) || 0;
            const safety_stock = parseInt(document.getElementById('editItemSafetyStock').value) || 0;

            if (!name) { alert('商品名稱不能為空！'); return; }

            const normalizedCategory = normalizeItemCategory(category);
            const { error } = await _supabase.from('items').update({
                name,
                category: normalizedCategory,
                cost_price,
                sell_price,
                safety_stock,
                regulatory_class: normalizedCategory === '動物用商品' ? '動物用商品' : '一般商品',
                reportable: normalizedCategory === '動物用商品',
                regulatory_updated_at: new Date().toISOString()
            }).eq('id', itemId).eq('tenant_id', CURRENT_TENANT_ID);

            if (error) {
                alert('修改失敗：' + error.message);
            } else {
                alert('商品完整資料已成功更新！');
                closeEditItemModal();
                loadItems();
            }
        }

        async function deleteItem(itemId) {
            if (!confirm('確定要刪除此商品嗎？')) return;
            const { error } = await _supabase.from('items').delete().eq('id', itemId);
            if (error) { alert('刪除失敗：' + error.message); } else { alert('已成功刪除！'); loadItems(); }
        }

        function filterPrescriptionMedicines() {
            const input = document.getElementById('prescriptionMedicineSearch');
            const dropdown = document.getElementById('medSelectDropdown');
            const results = document.getElementById('prescriptionMedicineResults');
            if (!input || !dropdown || !results) return;

            const keyword = input.value.trim().toLocaleLowerCase();
            dropdown.replaceChildren(new Option('-- 尚未選擇藥品 --', ''));
            results.innerHTML = '';

            if (!keyword) {
                results.style.display = 'none';
                onMedicineSelectedForDoseCalculation();
                return;
            }

            const matches = Object.values(loadedMedicinesMap)
                .filter(med => (med.name || '').toLocaleLowerCase().includes(keyword))
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));

            matches.slice(0, 30).forEach(med => {
                const option = new Option(med.name, med.id);
                option.dataset.name = med.name;
                option.dataset.route = med.route || '口服';
                option.dataset.recdose = med.recommended_dose || '';
                option.dataset.usedose = med.usage_dose || '';
                dropdown.add(option);

                const row = document.createElement('button');
                row.type = 'button';
                row.style.cssText = 'display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-bottom:1px solid #e2e8f0;background:#fff;cursor:pointer;';
                row.onmouseenter = () => row.style.background = '#f0f9ff';
                row.onmouseleave = () => row.style.background = '#fff';
                row.onclick = () => selectPrescriptionMedicine(med.id);
                row.innerHTML = `
                    <div style="font-size:1rem;font-weight:700;color:#0f172a;">💊 ${med.name || '未命名藥品'}</div>
                    <div style="font-size:.78rem;color:#64748b;margin-top:4px;">
                        ${med.route || '口服'}　規格：${med.usage_dose || '-'}　建議：${med.recommended_dose || '-'}　庫存：${med.stock_qty ?? 0} ${med.unit || ''}
                    </div>`;
                results.appendChild(row);
            });

            if (!matches.length) {
                results.innerHTML = '<div style="padding:12px;color:#64748b;">找不到符合的藥品</div>';
            } else if (matches.length > 30) {
                const more = document.createElement('div');
                more.style.cssText = 'padding:8px 12px;color:#64748b;font-size:.8rem;background:#f8fafc;';
                more.textContent = `共有 ${matches.length} 筆結果，目前顯示前 30 筆；可再多輸入幾個字縮小範圍。`;
                results.appendChild(more);
            }
            results.style.display = 'block';
            onMedicineSelectedForDoseCalculation();
        }

        function selectPrescriptionMedicine(medicineId) {
            const med = loadedMedicinesMap[medicineId];
            const input = document.getElementById('prescriptionMedicineSearch');
            const dropdown = document.getElementById('medSelectDropdown');
            const results = document.getElementById('prescriptionMedicineResults');
            if (!med || !input || !dropdown) return;

            let option = Array.from(dropdown.options).find(o => o.value === medicineId);
            if (!option) {
                option = new Option(med.name, med.id);
                option.dataset.name = med.name;
                option.dataset.route = med.route || '口服';
                option.dataset.recdose = med.recommended_dose || '';
                option.dataset.usedose = med.usage_dose || '';
                dropdown.add(option);
            }
            dropdown.value = medicineId;
            input.value = med.name;
            if (results) results.style.display = 'none';
            onMedicineSelectedForDoseCalculation();
        }

        async function loadMedicines(options={}) {
            const { data, error } = await _supabase.from('medicines').select('*').eq('tenant_id', CURRENT_TENANT_ID);
 if(options.preserveDrafts){if(error)throw error;if(options.scope!==clinicRefreshScopeV50())throw Error('登入已變更');}
            
            const tbody = document.getElementById('medicineTableBody');
            const medDropdown = document.getElementById('medSelectDropdown');
            
            if(tbody) tbody.innerHTML = '';
            if(medDropdown&&!options.preserveDrafts) medDropdown.innerHTML = '<option value="">-- 輸入關鍵字後選擇藥品 --</option>';
            loadedMedicinesMap = {};

            if (error || !data || data.length === 0) {
                if(tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b;">尚無藥品資料</td></tr>`;
                return;
            }

            data.forEach(med => {
                loadedMedicinesMap[med.id] = med;
                const route = med.route || '口服';
                const routeBadgeColor = route === '針劑' ? '#b45309' : '#0369a1';

                if(tbody) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><span style="background: #e0f2fe; color: ${routeBadgeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${route}</span></td>
                        <td><b>${med.name}</b></td>
                        <td>${med.recommended_dose || '-'}</td>
                        <td>NT$ ${med.price || 0}</td>
                        <td>${med.usage_dose || '-'}</td>
                        <td><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${med.calculated_dose || '一般藥品'}</span></td>
                        <td><span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-weight:bold;">${med.controlled_drug ? '管制藥品' : (med.regulatory_class || '未分類')}</span>${med.reportable ? '<br><small style="color:#059669;">需申報</small>' : ''}</td>
                        <td>${med.controlled_drug ? `<span style="color:#dc2626;font-weight:bold;">管制${med.controlled_level ? ' 第'+med.controlled_level+'級' : ''}</span>` : '-'}</td>
                        <td>${med.stock_qty || 0} ${med.unit || '錠'}</td>
                        <td>
                            <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openEditMedicineModal('${med.id}')">完整修改</button>
                            <button class="btn-secondary" onclick="adjustStock('medicine','${med.id}')">入庫／盤點</button>
                            <button class="btn-secondary" onclick="showStockHistory('medicine','${med.id}')">異動紀錄</button>
                            ${(med.reportable || med.controlled_drug) ? `<button class="btn-secondary" onclick="openRegulatedLotReceipt('medicine','${med.id}')">批號入庫</button><button class="btn-secondary" onclick="showRegulatedLots('medicine','${med.id}')">批次明細</button>` : ''}
                            <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteMedicine('${med.id}')">刪除</button>
                        </td>
                    `;
                    const speciesNote=document.createElement('small');speciesNote.style.cssText='display:block;color:#17352a;white-space:pre-wrap';const mp=medicineProfileV94(med);speciesNote.textContent='適用：'+({unset:'尚未設定',dog:'犬',cat:'貓',both:'犬貓皆可',other:'其他'}[mp.species]||'尚未設定')+'\n犬：'+(mp.dog||'未設定')+'\n貓：'+(mp.cat||'未設定');tr.children[2].append(speciesNote);
                    tbody.appendChild(tr);
                }

            });
            if(options.preserveDrafts)return;
            const prescriptionSearch = document.getElementById('prescriptionMedicineSearch');
            if (prescriptionSearch) prescriptionSearch.value = '';
            const prescriptionResults = document.getElementById('prescriptionMedicineResults');
            if (prescriptionResults) {
                prescriptionResults.innerHTML = '';
                prescriptionResults.style.display = 'none';
            }
            onMedicineSelectedForDoseCalculation();
        }

        // 第16.4步：上層「藥品分類」是申報資料唯一開關
        function upperCategoryToRegulatoryClass(category) {
            if (category === '動物用藥品' || category === '動物用藥') return '動物用藥品';
            if (category === '管制藥品') return '管制藥品';
            return '未分類';
        }

        function onUpperMedicineCategoryChange() {
            const category = document.getElementById('medCalcFormula')?.value || '一般藥品';
            const regulatoryClass = upperCategoryToRegulatoryClass(category);
            document.getElementById('medRegulatoryClass').value = regulatoryClass;

            const show = category === '動物用藥品' || category === '動物用藥' || category === '管制藥品';
            const section = document.getElementById('newMedicineRegulatorySection');
            if (section) {
                section.hidden = !show;
                section.style.display = show ? 'block' : 'none';
                section.style.gridColumn = show ? '1 / -1' : '';
                section.style.width = show ? '100%' : '';
            }
            applyNewMedicineRegulatoryUI();
        }

        function onEditUpperMedicineCategoryChange() {
            const category = document.getElementById('editMedCalcFormula')?.value || '一般藥品';
            const regulatoryClass = upperCategoryToRegulatoryClass(category);
            document.getElementById('editMedRegulatoryClass').value = regulatoryClass;

            const show = category === '動物用藥品' || category === '動物用藥' || category === '管制藥品';
            const section = document.getElementById('editMedicineRegulatorySection');
            if (section) {
                section.hidden = !show;
                section.style.display = show ? 'block' : 'none';
            }
            applyEditMedicineRegulatoryUI();
        }

        function applyNewMedicineRegulatoryUI() {
            const cls = document.getElementById('medRegulatoryClass')?.value || '未分類';
            const controlled = cls === '管制藥品';
            const reportable = cls === '動物用藥品' || controlled;
            const showDetails = reportable;

            const details = document.getElementById('medRegulatoryDetails');
            if (details) {
                details.hidden = !showDetails;
                details.style.display = showDetails ? 'block' : 'none';
                details.style.gridColumn = showDetails ? '1 / -1' : '';
                details.style.width = showDetails ? '100%' : '';
            }

            document.getElementById('medControlledDrug').value = controlled ? 'true' : 'false';
            document.getElementById('medControlledDrugStatus').value = controlled ? '是' : '否';
            document.getElementById('medReportable').value = reportable ? 'true' : 'false';

            const g1 = document.getElementById('medControlledLevelGroup');
            const g2 = document.getElementById('medControlledRegNoGroup');
            if (g1) g1.style.display = controlled ? '' : 'none';
            if (g2) g2.style.display = controlled ? '' : 'none';

            if (!controlled) {
                document.getElementById('medControlledLevel').value = '';
                document.getElementById('medControlledRegistrationNo').value = '';
            }
        }

        function onNewMedicineRegulatoryClassChange() {
            applyNewMedicineRegulatoryUI();
        }

        function applyEditMedicineRegulatoryUI() {
            const cls = document.getElementById('editMedRegulatoryClass')?.value || '未分類';
            const controlled = cls === '管制藥品';
            const reportable = cls === '動物用藥品' || controlled;
            const showDetails = reportable;

            const details = document.getElementById('editMedRegulatoryDetails');
            if (details) {
                details.hidden = !showDetails;
                details.style.display = showDetails ? 'block' : 'none';
            }

            document.getElementById('editMedControlledDrug').value = controlled ? 'true' : 'false';
            document.getElementById('editMedControlledDrugStatus').value = controlled ? '是' : '否';
            document.getElementById('editMedReportable').value = reportable ? 'true' : 'false';

            const g1 = document.getElementById('editMedControlledLevelGroup');
            const g2 = document.getElementById('editMedControlledRegNoGroup');
            if (g1) g1.style.display = controlled ? '' : 'none';
            if (g2) g2.style.display = controlled ? '' : 'none';

            if (!controlled) {
                document.getElementById('editMedControlledLevel').value = '';
                document.getElementById('editMedControlledRegistrationNo').value = '';
            }
        }

        function onEditMedicineRegulatoryClassChange() {
            applyEditMedicineRegulatoryUI();
        }

        // 舊函式名稱保留，避免其他既有流程呼叫失效。
        function toggleNewControlledDrugFields() { applyNewMedicineRegulatoryUI(); }
        function toggleEditControlledDrugFields() { applyEditMedicineRegulatoryUI(); }

        async function saveNewMedicine() {
            const name = document.getElementById('medName').value;
            const route = document.getElementById('medRoute').value;
            const recommended_dose = document.getElementById('medRecDose').value;
            const price = parseFloat(document.getElementById('medPrice').value) || 0;
            const usage_dose = document.getElementById('medUseDose').value;
            const calculated_dose = document.getElementById('medCalcFormula').value; 
            const stock_qty = Number(document.getElementById('medStock').value || 0);
            if (!Number.isFinite(stock_qty) || stock_qty < 0) { alert('初始庫存量不可為負數'); return; }
            const unit = document.getElementById('medUnit').value.trim() || '錠';
            const regulatory_class = document.getElementById('medRegulatoryClass').value;
            const reportable = regulatory_class === '動物用藥品' || regulatory_class === '管制藥品';
            const veterinary_license_no = document.getElementById('medVeterinaryLicenseNo').value.trim();
            const active_ingredient = document.getElementById('medActiveIngredient').value.trim();
            const strength = usage_dose.trim();
            const dosage_form = document.getElementById('medDosageForm').value.trim();
            const manufacturer = document.getElementById('medManufacturer').value.trim();
            const smallest_unit = document.getElementById('medSmallestUnit').value.trim() || unit;
            const controlled_drug = regulatory_class === '管制藥品';
            const controlled_level_raw = document.getElementById('medControlledLevel').value;
            const controlled_level = controlled_drug && controlled_level_raw ? Number(controlled_level_raw) : null;
            const controlled_registration_no = controlled_drug ? document.getElementById('medControlledRegistrationNo').value.trim() : '';
            let regulatory_notes = document.getElementById('medRegulatoryNotes').value.trim();
            let final_veterinary_license_no = veterinary_license_no;
            let final_active_ingredient = active_ingredient;
            let final_dosage_form = dosage_form;
            let final_manufacturer = manufacturer;
            let final_smallest_unit = smallest_unit;
            if (!reportable) {
                final_veterinary_license_no = '';
                final_active_ingredient = '';
                final_dosage_form = '';
                final_manufacturer = '';
                final_smallest_unit = unit;
                regulatory_notes = '';
            }

            if(!name) { alert('請填寫藥名！'); return; }
            if (controlled_drug && !controlled_level) { alert('管制藥品請選擇管制級別。'); return; }

            const { error } = await _supabase.from('medicines').insert([{
                tenant_id: CURRENT_TENANT_ID, clinical_profile_v94:profileFormV94('med'), name, route, recommended_dose, price, usage_dose, calculated_dose, stock_qty, unit,
                regulatory_class, reportable, report_scheme: controlled_drug ? 'controlled_drug' : (reportable ? 'veterinary_medicine' : 'none'),
                veterinary_license_no: final_veterinary_license_no,
                active_ingredient: final_active_ingredient,
                strength: reportable ? strength : '',
                dosage_form: final_dosage_form,
                manufacturer: final_manufacturer,
                smallest_unit: final_smallest_unit,
                controlled_drug, controlled_level, controlled_registration_no, regulatory_notes,
                regulatory_updated_at: new Date().toISOString()
            }]);

            if (error) {
                alert('新增藥品失敗：' + error.message);
            } else {
                alert('藥品/針劑已成功建立至專區！');fillProfileV94('med',null);
                document.getElementById('medName').value = '';
                document.getElementById('medRecDose').value = '';
                document.getElementById('medPrice').value = '';
                document.getElementById('medUseDose').value = '';
                document.getElementById('medStock').value = '';
                document.getElementById('medUnit').value = '錠';
                document.getElementById('medRegulatoryClass').value = upperCategoryToRegulatoryClass(document.getElementById('medCalcFormula').value);
                document.getElementById('medReportable').value = 'true';
                document.getElementById('medVeterinaryLicenseNo').value = '';
                document.getElementById('medActiveIngredient').value = '';
                document.getElementById('medDosageForm').value = '';
                document.getElementById('medManufacturer').value = '';
                document.getElementById('medSmallestUnit').value = '';
                document.getElementById('medControlledDrug').value = 'false';
                document.getElementById('medControlledLevel').value = '';
                document.getElementById('medControlledRegistrationNo').value = '';
                document.getElementById('medRegulatoryNotes').value = '';
                onUpperMedicineCategoryChange();
                loadMedicines();
            }
        }

        function openEditMedicineModal(medId) {
            const med = loadedMedicinesMap[medId];
            if (!med) return;

            document.getElementById('editMedId').value = med.id;
            document.getElementById('editMedName').value = med.name || '';
            document.getElementById('editMedRoute').value = med.route || '口服';
            document.getElementById('editMedRecDose').value = med.recommended_dose || '';
            document.getElementById('editMedPrice').value = med.price || 0;
            document.getElementById('editMedUseDose').value = med.usage_dose || '';
            let editUpperCategory = med.calculated_dose || '一般藥品';
            if (med.controlled_drug) editUpperCategory = '管制藥品';
            else if (med.regulatory_class === '動物用藥品') editUpperCategory = '動物用藥品';
            document.getElementById('editMedCalcFormula').value = editUpperCategory;
            document.getElementById('editMedStock').value = med.stock_qty || 0;
            document.getElementById('editMedUnit').value = med.unit || '錠';
            document.getElementById('editMedStock').readOnly = true;
            document.getElementById('editMedRegulatoryClass').value =
                med.controlled_drug ? '管制藥品' : (med.regulatory_class || '未分類');
            document.getElementById('editMedReportable').value = med.reportable ? 'true' : 'false';
            document.getElementById('editMedVeterinaryLicenseNo').value = med.veterinary_license_no || '';
            document.getElementById('editMedActiveIngredient').value = med.active_ingredient || '';
            document.getElementById('editMedDosageForm').value = med.dosage_form || '';
            document.getElementById('editMedManufacturer').value = med.manufacturer || '';
            document.getElementById('editMedSmallestUnit').value = med.smallest_unit || med.unit || '';
            document.getElementById('editMedControlledDrug').value = med.controlled_drug ? 'true' : 'false';
            document.getElementById('editMedControlledLevel').value = med.controlled_level || '';
            document.getElementById('editMedControlledRegistrationNo').value = med.controlled_registration_no || '';
            document.getElementById('editMedRegulatoryNotes').value = med.regulatory_notes || '';
            onEditUpperMedicineCategoryChange();

            document.getElementById('editMedicineModal').style.display = 'flex';
        }

        function closeEditMedicineModal() {
            document.getElementById('editMedicineModal').style.display = 'none';
        }

        async function saveEditedMedicine() {
            const medId = document.getElementById('editMedId').value;
            const name = document.getElementById('editMedName').value;
            const route = document.getElementById('editMedRoute').value;
            const recommended_dose = document.getElementById('editMedRecDose').value;
            const price = parseFloat(document.getElementById('editMedPrice').value) || 0;
            const usage_dose = document.getElementById('editMedUseDose').value;
            const calculated_dose = document.getElementById('editMedCalcFormula').value;
            const unit = document.getElementById('editMedUnit').value.trim();
            const regulatory_class = document.getElementById('editMedRegulatoryClass').value;
            const reportable = regulatory_class === '動物用藥品' || regulatory_class === '管制藥品';
            const veterinary_license_no = document.getElementById('editMedVeterinaryLicenseNo').value.trim();
            const active_ingredient = document.getElementById('editMedActiveIngredient').value.trim();
            const strength = usage_dose.trim();
            const dosage_form = document.getElementById('editMedDosageForm').value.trim();
            const manufacturer = document.getElementById('editMedManufacturer').value.trim();
            const smallest_unit = document.getElementById('editMedSmallestUnit').value.trim() || unit;
            const controlled_drug = regulatory_class === '管制藥品';
            const controlled_level_raw = document.getElementById('editMedControlledLevel').value;
            const controlled_level = controlled_drug && controlled_level_raw ? Number(controlled_level_raw) : null;
            const controlled_registration_no = controlled_drug ? document.getElementById('editMedControlledRegistrationNo').value.trim() : '';
            let regulatory_notes = document.getElementById('editMedRegulatoryNotes').value.trim();
            let final_veterinary_license_no = veterinary_license_no;
            let final_active_ingredient = active_ingredient;
            let final_dosage_form = dosage_form;
            let final_manufacturer = manufacturer;
            let final_smallest_unit = smallest_unit;
            if (!reportable) {
                final_veterinary_license_no = '';
                final_active_ingredient = '';
                final_dosage_form = '';
                final_manufacturer = '';
                final_smallest_unit = unit;
                regulatory_notes = '';
            }

            if (!name || !unit) { alert('請填寫藥名與庫存單位！'); return; }
            if (controlled_drug && !controlled_level) { alert('管制藥品請選擇管制級別。'); return; }

            const { error } = await _supabase.from('medicines').update({
                clinical_profile_v94:profileFormV94('editMed'), name, route, recommended_dose, price, usage_dose, calculated_dose, unit,
                regulatory_class, reportable, report_scheme: controlled_drug ? 'controlled_drug' : (reportable ? 'veterinary_medicine' : 'none'),
                veterinary_license_no: final_veterinary_license_no,
                active_ingredient: final_active_ingredient,
                strength: reportable ? strength : '',
                dosage_form: final_dosage_form,
                manufacturer: final_manufacturer,
                smallest_unit: final_smallest_unit,
                controlled_drug, controlled_level, controlled_registration_no, regulatory_notes,
                regulatory_updated_at: new Date().toISOString()
            }).eq('id', medId).eq('tenant_id', CURRENT_TENANT_ID);

            if (error) {
                alert('修改失敗：' + error.message);
            } else {
                alert('藥品所有欄位已成功更新！');
                closeEditMedicineModal();
                loadMedicines();
            }
        }

        async function deleteMedicine(medId) {
            if (!confirm('確定要刪除此藥品嗎？')) return;
            const { error } = await _supabase.from('medicines').delete().eq('id', medId);
            if (error) { alert('刪除失敗：' + error.message); } else { alert('已成功刪除藥品！'); loadMedicines(); }
        }

        var ownerPetCacheGenerationV50=0;
async function loadOwnersAndPetsIntegrated() {
 const ownerReadV50=++ownerPetCacheGenerationV50,ownerScopeV50=String(CURRENT_TENANT_ID)+'|'+CURRENT_USER?.id;
    // 直接透過 Supabase 的外鍵關聯一次把 owners 與對應的 pets 全部抓回來
    const ownersData = [];
    const loadStatus = document.getElementById('ownerPetLoadStatus');
    if (loadStatus) loadStatus.textContent = '載入中…';
    let pageSize = 400;
    let lastOwnerId = null;
    let loadIncomplete = false;
    while (true) {
        let ownerPage = null;
        let pageError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            let request = _supabase
                .from('owners')
                .select(`*, pets (*)`)
                .eq('tenant_id', CURRENT_TENANT_ID)
                .order('id', { ascending: true });
            if (lastOwnerId) request = request.gt('id', lastOwnerId);
            const { data, error } = await request.limit(pageSize);
            if(ownerReadV50!==ownerPetCacheGenerationV50||ownerScopeV50!==String(CURRENT_TENANT_ID)+'|'+CURRENT_USER?.id)return;
            if (!error) {
                ownerPage = data || [];
                pageError = null;
                break;
            }
            pageError = error;
            pageSize = Math.max(100, Math.floor(pageSize / 2));
            if (loadStatus) loadStatus.textContent = `已讀 ${ownersData.length} 位，重試中…`;
        }
        if (pageError) {
            loadIncomplete = true;
            console.error('載入飼主與寵物資料失敗：', pageError);
            break;
        }
        ownersData.push(...ownerPage);
        if (ownerPage.length) lastOwnerId = ownerPage[ownerPage.length - 1].id;
        if (loadStatus) loadStatus.textContent = `已載入 ${ownersData.length} 位飼主…`;
        if (ownerPage.length < pageSize) break;
    }

    if (loadStatus) loadStatus.textContent = loadIncomplete ? `部分載入 ${ownersData.length} 位；仍可依新編號直接查詢` : `已載入 ${ownersData.length} 位飼主`;
    // 整理成全域資料結構供前端表格與下拉選單使用
    if(ownerReadV50!==ownerPetCacheGenerationV50||ownerScopeV50!==String(CURRENT_TENANT_ID)+'|'+CURRENT_USER?.id)return;
    if(typeof ownerMergeRowsV908==='function')ownerMergeRowsV908(ownersData);
    globalOwnersPetsData = ownersData.map(owner => {
        return {
            owner: {
                id: owner.id,
                tenant_id: owner.tenant_id,
                owner_code: owner.owner_code,
                system_code: owner.system_code,
                name: owner.name,
                mobile: owner.mobile,
                phone: owner.phone,
                email: owner.email,
                address: owner.address,
                notes: owner.notes
            },
            pets: owner.pets || []
        };
    });

    filterIntegratedTable();

    allOwnersListForDropdown = ownersData || [];
    const checkoutDatalist = document.getElementById('checkoutOwnerDatalist');
    if(checkoutDatalist) {
        checkoutDatalist.innerHTML = '';
        allOwnersListForDropdown.forEach(owner => {
            const opt = document.createElement('option');
            const codeStr = `[新:${owner.system_code || '待產生'}] ` + (owner.owner_code ? `[舊:${owner.owner_code}] ` : '');
            opt.value = `${codeStr}${owner.name} (${owner.mobile || '無手機'})`;
            opt.dataset.ownerId = owner.id;
            checkoutDatalist.appendChild(opt);
        });
    }

    const invoiceOwnerSelect = document.getElementById('invoiceOwnerSelect');
    const previousInvoiceOwnerId=invoiceOwnerSelect?.value||'';
    if(invoiceOwnerSelect) invoiceOwnerSelect.innerHTML = '<option value="">-- 請選擇飼主 --</option>';

    ownersData.forEach(owner => {
        if(invoiceOwnerSelect) {
            const opt = document.createElement('option');
            opt.value = owner.id;
            const codeStr = `[新:${owner.system_code || '待產生'}] ` + (owner.owner_code ? `[舊:${owner.owner_code}] ` : '');
            opt.textContent = `${codeStr}${owner.name} (${owner.mobile || ''})`;
            invoiceOwnerSelect.appendChild(opt);
        }
    });

    if (invoiceOwnerSelect && previousInvoiceOwnerId && Array.from(invoiceOwnerSelect.options).some(o=>o.value===previousInvoiceOwnerId)) invoiceOwnerSelect.value=previousInvoiceOwnerId;

    // 展開所有寵物清單供下拉選單使用
    allPetsListForDropdown = [];
    ownersData.forEach(owner => {
        if (owner.pets && owner.pets.length > 0) {
            owner.pets.forEach(pet => {
                allPetsListForDropdown.push({
                    id: pet.id,
                    name: pet.name,
                    microchip: pet.microchip || '',
                    weight: roundPetWeight(pet.weight) || 0,
                    birthday: pet.birthday || '',
                    gender: pet.gender || '',
                    species: pet.species || '貓',
                    breed: pet.breed || '',
                    owner_id: owner.id,
                    owner_name: owner.name,
                    owner_mobile: owner.mobile || '',
                    owner_phone: owner.phone || '',
                    owner_code: owner.owner_code || '',
                    system_code: owner.system_code || ''
                });
            });
        }
    });

    filterVaccinePetDropdown();
    filterLabPetDropdown();
    filterRapidPetDropdown();
    updateRapidItemsForPet();

    syncAppointmentPetSearchSelection();
}

        function onCheckoutOwnerInput(event) {
            const val = event.target.value.trim();
            const datalist = document.getElementById('checkoutOwnerDatalist');
            const options = datalist.querySelectorAll('option');
            let foundId = "";
            options.forEach(opt => {
                if (opt.value === val) {
                    foundId = opt.dataset.ownerId;
                }
            });
            document.getElementById('selectedCheckoutOwnerId').value = foundId;

            const petSelect = document.getElementById('checkoutPetSelect');
            petSelect.innerHTML = '<option value="">-- 請選擇關聯寵物 --</option>';

            if (foundId) {
                const matchedGroup = globalOwnersPetsData.find(item => item.owner.id === foundId);
                if (matchedGroup && matchedGroup.pets.length > 0) {
                    matchedGroup.pets.forEach(pet => {
                        const opt = document.createElement('option');
                        opt.value = pet.id;
                        opt.textContent = `🐶 ${pet.name} (${pet.species || '寵物'} / ${pet.weight ? formatPetWeight(pet.weight) + 'kg' : '未量體重'})`;
                        petSelect.appendChild(opt);
                    });
                }
            }
        }

        function renderIntegratedTable(dataList) {
    const tbody = document.getElementById('integratedTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'ownerPetTableSearch')) return;

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">找不到符合的飼主或寵物資料</td></tr>`;
        return;
    }

    dataList.slice(0, 100).forEach(item => {
        const owner = item.owner;
        const ownerPets = item.pets;

        let petsHtml = '<div class="nested-pet-container">';
        if(ownerPets.length > 0) {
            ownerPets.forEach(pet => {
                // 這裡會正確讀取資料庫的 birthday 來計算年齡
                const ageStr = calculateAge(pet.birthday);
                const breedStr = pet.breed ? `[${pet.breed}]` : '';
                const speciesBadge = pet.species ? `(${pet.species})` : '';
                
                const petDataEncoded = encodeURIComponent(JSON.stringify(pet));
                const ownerNameEncoded = encodeURIComponent(owner.name || '');

                petsHtml += `
                    <div class="nested-pet-tag">
                        <span style="cursor: pointer;" title="點擊直接看診" onclick="startConsultationById('${pet.id}', '${pet.microchip || ''}', '${pet.name}', '${owner.id}', ${pet.weight || 0}, '${owner.name}', '${pet.birthday || ''}', '${pet.gender || ''}', '${pet.species || '貓'}', '${pet.breed || ''}')">
                            🐾 <b>${pet.name}</b> ${speciesBadge} ${breedStr} (${ageStr} | ${pet.weight !== null ? formatPetWeight(pet.weight) + 'kg' : '未量體重'}) ${pet.microchip ? '[' + pet.microchip + ']' : ''}
                        </span>
                        <div class="pet-actions">
                            <button class="pet-btn pet-btn-info" title="檢視寵物詳細資料與精確年齡" onclick="openPetDetailModal('${petDataEncoded}', '${ownerNameEncoded}')">詳</button>
                            <button class="pet-btn" title="快速補印最後一次處方箋" onclick="printLatestPrescription('${pet.id}', '${pet.name}', ${pet.weight || 0}, '${pet.microchip || ''}')">處方</button>
                            <button class="pet-btn pet-btn-edit" title="修改寵物資料" onclick="editPet('${pet.id}', '${pet.name}', '${pet.microchip || ''}', ${pet.weight || 0}, '${pet.birthday || ''}', '${pet.breed || ''}', '${pet.species || '貓'}')">改</button>
                            <button class="pet-btn btn-danger" title="刪除寵物" onclick="deletePet('${pet.id}', '${pet.name}')">刪</button>
                        </div>
                    </div>
                `;
            });
        } else {
            petsHtml = '<span style="color: #94a3b8; font-size: 0.85rem;">尚無登記寵物</span>';
        }
        petsHtml += '</div>';

        const ownerCodeBadge = `<span style="background:#175b76;color:#fff;padding:2px 6px;border-radius:4px;margin-right:6px;">新 ${owner.system_code || '待產生'}</span>` + (owner.owner_code ? `<span style="background:#e1eff5;color:#175b76;padding:2px 6px;border-radius:4px;margin-right:6px;">舊 ${owner.owner_code}</span>` : '');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="min-width:190px;"><div style="white-space:nowrap;">${ownerCodeBadge}</div><div style="margin-top:5px;"><b>${owner.name}</b></div></td>
            <td>手機: ${owner.mobile || ''} / 市話: ${owner.phone || '-'}<br><small style="color:#64748b;">${owner.address || '-'}</small></td>
            <td><span style="color: #475569; font-size: 0.85rem;">${owner.notes || '-'}</span></td>
            <td>${petsHtml}</td>
            <td>
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; margin-bottom: 4px;" onclick="editOwner('${owner.id}', '${owner.owner_code || ''}', '${owner.name}', '${owner.mobile || ''}', '${owner.phone || ''}', '${owner.address || ''}', '${owner.notes || ''}')">修改飼主</button>
                <br>
                <button style="padding: 4px 8px; font-size: 0.8rem; background-color: #059669;" onclick="addPetToOwnerPrompt('${owner.id}', '${owner.name}')">+ 新增寵物</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (dataList.length > 100) {
        const note = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.textContent = `符合 ${dataList.length} 組，先顯示前 100 組；請縮小搜尋範圍。`;
        note.appendChild(cell);
        tbody.appendChild(note);
    }
}

        function openPetDetailModal(petDataEncoded, ownerNameEncoded) {
            const pet = JSON.parse(decodeURIComponent(petDataEncoded));
            const ownerName = decodeURIComponent(ownerNameEncoded);
            const exactAge = calculateAge(pet.birthday);

            const html = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
                    <div><b>🐾 寵物名字：</b><br>${pet.name || '-'}</div>
                    <div><b>👤 所屬飼主：</b><br>${ownerName || '-'}</div>
                    <div><b>🏷️ 晶片號碼：</b><br>${pet.microchip || '未植入晶片'}</div>
                    <div><b>舊系統寵物資料號：</b><br>${pet.legacy_source_no || '無'}</div>
                    <div><b>🏷️ 寵物種類 / 品種：</b><br>${pet.species || '未知'} / ${pet.breed || '未填寫'}</div>
                    <div><b>🎂 出生日期：</b><br>${pet.birthday || '未填寫'}</div>
                    <div><b>⏳ 精確計算年齡：</b><br><span style="color: #0369a1; font-weight: bold; font-size: 1.05rem;">${exactAge}</span></div>
                    <div><b>⚧ 性別狀態：</b><br>${pet.gender || '未填寫'}</div>
                    <div><b>⚖️ 目前體重：</b><br>${pet.weight !== null && pet.weight !== undefined ? formatPetWeight(pet.weight) + ' kg' : '未量體重'}</div>
                </div>
            `;

            document.getElementById('detailModalTitle').innerText = `🐾 寵物詳細資料與年齡檢視 - ${pet.name}`;
            document.getElementById('detailModalBody').innerHTML = html;
            document.getElementById('genericDetailModal').style.display = 'flex';
        }

        function roundPetWeight(value) {
            if(value===null||value===undefined||String(value).trim()==='')return null;
            const number=Number(value);if(!Number.isFinite(number))return null;
            return Math.round((number+Number.EPSILON*Math.max(1,Math.abs(number)))*100)/100;
        }
        function normalizePetWeightInput(input) {
            if(!input||input.value.trim()==='')return;
            const weight=roundPetWeight(input.value);if(weight!==null)input.value=String(weight);
        }
        function formatPetWeight(value) {
            const number=roundPetWeight(value);
            return number===null?'':new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(number);
        }

        let integratedSearchRequest = 0;
        async function filterIntegratedTable() {
            const keyword = document.getElementById('ownerPetTableSearch').value.trim().toLowerCase();
            const requestNumber = ++integratedSearchRequest;
            if(!keyword) { renderIntegratedTable(globalOwnersPetsData); return; }

            const filtered = globalOwnersPetsData.filter(item => {
                const ownerName = (item.owner.name || '').toLowerCase();
                const ownerCode = (item.owner.owner_code || '').toLowerCase();
                const systemCode = (item.owner.system_code || '').toLowerCase();
                const ownerMobile = (item.owner.mobile || '').toLowerCase();
                const ownerPhone = (item.owner.phone || '').toLowerCase();
                const ownerNotes = (item.owner.notes || '').toLowerCase();
                const matchOwner = ownerName.includes(keyword) || ownerCode.includes(keyword) || systemCode.includes(keyword) || ownerMobile.includes(keyword) || ownerPhone.includes(keyword) || ownerNotes.includes(keyword);
                const matchPet = item.pets.some(p => (p.name || '').toLowerCase().includes(keyword) || (p.microchip || '').toLowerCase().includes(keyword) || (p.breed || '').toLowerCase().includes(keyword) || (p.species || '').toLowerCase().includes(keyword));
                return matchOwner || matchPet;
            });
            if (filtered.length === 0 && /^[a-z]\d{4}$/.test(keyword)) {
                const { data, error } = await _supabase.from('owners')
                    .select('*, pets (*)')
                    .eq('tenant_id', CURRENT_TENANT_ID)
                    .eq('system_code', keyword.toUpperCase())
                    .limit(1);
                if (requestNumber !== integratedSearchRequest) return;
                if (error) {
                    console.error('按新編號查詢失敗：', error);
                    renderIntegratedTable([]);
                    return;
                }
                if (data && data.length) {
                    const owner = data[0];
                    renderIntegratedTable([{ owner, pets: owner.pets || [] }]);
                    return;
                }
            }
            renderIntegratedTable(filtered);
        }

        let petBirthdayCalendarResolve = null;
        let petBirthdayCalendarSelected = '';
        let petBirthdayCalendarPreviousFocus = null;

        function localCalendarDate(date) {
            return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
        }

        function birthdayMonthCells(year, month) {
            const cells = Array(new Date(year, month-1, 1).getDay()).fill(null);
            const count = new Date(year, month, 0).getDate();
            for (let day=1; day<=count; day++) cells.push(String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'));
            return cells;
        }

        function choosePetBirthday(currentValue='', title='選擇出生日期') {
            if (petBirthdayCalendarResolve) finishPetBirthdayCalendar(null);
            petBirthdayCalendarPreviousFocus = document.activeElement;
            petBirthdayCalendarSelected = /^\d{4}-\d{2}-\d{2}$/.test(currentValue || '') ? currentValue : '';
            const today = new Date();
            const selected = petBirthdayCalendarSelected ? new Date(petBirthdayCalendarSelected+'T12:00:00') : today;
            const valid = !Number.isNaN(selected.getTime()) && selected.getFullYear()>=1900 && localCalendarDate(selected)<=localCalendarDate(today);
            const initial = valid ? selected : today;
            const years = document.getElementById('petBirthdayCalendarYear');
            const months = document.getElementById('petBirthdayCalendarMonth');
            years.replaceChildren(); months.replaceChildren();
            for (let y=today.getFullYear(); y>=1900; y--) years.add(new Option(y+' 年',String(y)));
            for (let m=1; m<=12; m++) months.add(new Option(m+' 月',String(m)));
            years.value=String(initial.getFullYear()); months.value=String(initial.getMonth()+1);
            document.getElementById('petBirthdayCalendarTitle').textContent=title;
            document.getElementById('petBirthdayCalendarModal').style.display='flex';
            renderPetBirthdayCalendar(); years.focus();
            return new Promise(resolve => { petBirthdayCalendarResolve=resolve; });
        }

        function renderPetBirthdayCalendar() {
            const year=Number(document.getElementById('petBirthdayCalendarYear').value);
            const month=Number(document.getElementById('petBirthdayCalendarMonth').value);
            const days=document.getElementById('petBirthdayCalendarDays');
            const today=localCalendarDate(new Date());
            days.replaceChildren();
            for (const date of birthdayMonthCells(year,month)) {
                if (!date) { days.appendChild(document.createElement('span')); continue; }
                const button=document.createElement('button');
                button.type='button'; button.className='btn-secondary';
                button.textContent=String(Number(date.slice(-2)));
                button.setAttribute('aria-label',date+' 出生');
                button.style.cssText='padding:9px 0;min-width:0;';
                button.disabled=date>today;
                if (button.disabled) { button.style.opacity='.35'; button.style.cursor='default'; }
                if (date===petBirthdayCalendarSelected) { button.style.background='#0284c7'; button.style.color='#fff'; }
                if (date===today) button.style.border='2px solid #059669';
                button.onclick=()=>finishPetBirthdayCalendar(date);
                days.appendChild(button);
            }
            document.getElementById('petBirthdayCalendarHint').textContent='原日期：'+(petBirthdayCalendarSelected || '未填寫')+'｜今天：'+today+'。點日期即可選定。';
        }

        function moveBirthdayCalendarMonth(change) {
            const years=document.getElementById('petBirthdayCalendarYear');
            const months=document.getElementById('petBirthdayCalendarMonth');
            const next=new Date(Number(years.value),Number(months.value)-1+change,1);
            const today=new Date();
            if (next.getFullYear()<1900 || next.getFullYear()>today.getFullYear()) return;
            years.value=String(next.getFullYear()); months.value=String(next.getMonth()+1);
            renderPetBirthdayCalendar();
        }

        function finishPetBirthdayCalendar(value) {
            if (value && value>localCalendarDate(new Date())) return;
            const resolve=petBirthdayCalendarResolve;
            petBirthdayCalendarResolve=null;
            document.getElementById('petBirthdayCalendarModal').style.display='none';
            petBirthdayCalendarPreviousFocus?.focus();
            if (resolve) resolve(value);
        }

        function handleBirthdayCalendarKey(event) {
            if (event.key==='Escape') { event.preventDefault(); finishPetBirthdayCalendar(null); return; }
            if (event.key!=='Tab') return;
            const controls=Array.from(document.getElementById('petBirthdayCalendarModal').querySelectorAll('button:not(:disabled), select'));
            const first=controls[0], last=controls[controls.length-1];
            if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
        }

        async function chooseIntegratedPetBirthday() {
            const input=document.getElementById('intPetBirthday');
            const date=await choosePetBirthday(input.value);
            if (date===null) return;
            input.value=date;
            updateLiveAgeDisplay();
        }

        let quickPetContext=null,quickPetSaving=false;
        async function openNewPetForCurrentOwner(){
            if(!currentOwnerId){alert('請先選擇有飼主的看診寵物。');return;}
            await openQuickNewPet(currentOwnerId);
        }
        async function openQuickNewPet(ownerId){
            if(quickPetSaving)return;
            const tenant=CURRENT_TENANT_ID;
            try{
                const {data:owner,error}=await _supabase.from('owners').select('id,name,mobile,system_code,owner_code').eq('tenant_id',tenant).eq('id',ownerId).single();
                if(error||!owner)throw error||new Error('找不到飼主');if(tenant!==CURRENT_TENANT_ID)return;
                document.getElementById('quickNewPetForm').reset();
                quickPetContext={tenant,owner,id:crypto.randomUUID()};
                document.getElementById('quickPetOwnerLabel').textContent='飼主：'+owner.name+'｜新編號：'+(owner.system_code||'-')+'｜舊病歷號：'+(owner.owner_code||'-')+'｜電話：'+(owner.mobile||'-');
                document.getElementById('quickPetMessage').textContent='';document.getElementById('quickNewPetModal').style.display='flex';document.getElementById('quickPetName').focus();
            }catch(e){alert('讀取飼主失敗：'+e.message);}
        }
        function closeQuickNewPet(){if(quickPetSaving)return;document.getElementById('quickNewPetModal').style.display='none';quickPetContext=null;}
        async function quickPetCheckIn20261027(ctx,pet,scope){
            if(!waitingDoctorAllowedV54())throw Error('此帳號沒有掛號權限；寵物已建檔，可由有權限的人員加入候診。');
            if(ctx.appointment)return ctx.appointment;
            const valid=()=>scope===ownerScopeV908()&&ctx===quickPetContext;
            const {data:{session},error}=await _supabase.auth.getSession();
            if(error||!session?.access_token||session.user?.id!==CURRENT_USER?.id||!valid())throw Error('登入已變更，請回原院所核對建檔與候診結果。');
            // Keep the same ID and payload after an uncertain response to avoid duplicate check-in.
            ctx.registration=ctx.registration||{pet_id:pet.id,request_id:crypto.randomUUID(),purpose:'看診',session:document.getElementById('appointmentSession')?.value||'上午診'};
            const send=async()=>{
                if(!valid())throw Error('登入已變更，請回原院所核對結果。');
                const response=await fetch('/api/registration/',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(ctx.registration),cache:'no-store'});
                const result=await response.json();
                if(!valid())throw Error('登入已變更，請回原院所核對結果。');
                return {response,result};
            };
            let {response,result}=await send();
            if(response.status===409&&result.code==='early_check_in'){
                const a=result.appointment;
                if(!a?.id||!a.scheduled_at)throw Error('未取得原預約資料，請至候診核對。');
                if(!confirm('此寵物尚未到原預約時間，確定提前報到嗎？'))throw Error('已取消提前報到；寵物建檔保留。');
                ctx.registration.confirm_early={id:a.id,scheduled_at:a.scheduled_at};
                ({response,result}=await send());
            }
            if(!response.ok)throw Error(result.error||'掛號結果未確認，請保留畫面重試或至候診核對。');
            const a=result.appointment;
            if(result.user_id!==CURRENT_USER?.id||a?.tenant_id!==ctx.tenant||a?.pet_id!==pet.id||!a?.id||!['候診中','診間看診中'].includes(a.status))throw Error('未取得正確的候診確認，請至候診核對。');
            ctx.appointment=a;
            appointmentsLoadRequest++;
            const row=waitingPetFromAppointment(pet,a);
            activeAppointmentsList=activeAppointmentsList.filter(p=>p.id!==pet.id||(p.appointment_id&&p.appointment_id!==a.id));
            activeAppointmentsList.push(row);renderAppointmentTable(activeAppointmentsList);
            return a;
        }
        async function saveQuickNewPet(action='save'){
            if(quickPetSaving||!quickPetContext||!['save','waiting','consult'].includes(action))return;
            const ctx=quickPetContext,scope=ownerScopeV908();
            if(ctx.tenant!==CURRENT_TENANT_ID||!scope){closeQuickNewPet();return;}
            const value=id=>document.getElementById(id).value.trim(),name=value('quickPetName'),gender=value('quickPetGender');
            if(!name||!gender){alert('請填寫寵物名字並選擇性別。');return;}
            const weight=value('quickPetWeight');if(weight&&(!Number.isFinite(Number(weight))||Number(weight)<0)){alert('體重不得小於零。');return;}
            if(action!=='save'&&!waitingDoctorAllowedV54()){alert('此帳號沒有掛號權限；可選擇只儲存，由有權限的人員安排候診。');return;}
            if(action==='consult'&&!(CURRENT_PROFILE?.role==='admin'||(CURRENT_PROFILE?.permission_clinical??CURRENT_PROFILE?.role==='doctor'))){alert('此帳號沒有看診權限，請選擇「儲存並加入候診」，由醫師接診。');return;}
            const pet={id:ctx.id,tenant_id:ctx.tenant,owner_id:ctx.owner.id,name,species:value('quickPetSpecies'),breed:value('quickPetBreed')||null,gender,birthday:value('quickPetBirthday')||null,weight:weight?roundPetWeight(weight):null,microchip:value('quickPetChip')||null};
            const fingerprint=JSON.stringify(pet);
            if(ctx.fingerprint&&ctx.fingerprint!==fingerprint){document.getElementById('quickPetMessage').textContent='原建檔結果已送出或待確認，請恢復原欄位再核對，避免重複新增。';return;}
            ctx.fingerprint=fingerprint;
            quickPetSaving=true;for(const id of ['quickPetSave','quickPetWaiting','quickPetConsult'])document.getElementById(id).disabled=true;
            const message=document.getElementById('quickPetMessage');message.textContent='正在儲存，請稍候…';
            try{
                if(!ctx.savedPet)ctx.savedPet=await ownerConfirmedInsertV908('pets',pet,scope);
                if(scope!==ownerScopeV908()||ctx!==quickPetContext)return;
                if(ctx.savedPet.id!==pet.id||ctx.savedPet.owner_id!==ctx.owner.id||ctx.savedPet.tenant_id!==ctx.tenant)throw Error('寵物與飼主資料不符，請先核對。');
                const entry=ownerCacheUpsertV908(ctx.owner,ctx.savedPet);
                if(action==='save'){
                    document.getElementById('quickNewPetModal').style.display='none';quickPetContext=null;
                    alert('已替「'+ctx.owner.name+'」新增「'+name+'」。');return;
                }
                message.textContent='寵物已建檔，正在加入候診…';
                const appointment=await quickPetCheckIn20261027(ctx,entry,scope);
                if(scope!==ownerScopeV908()||ctx!==quickPetContext)return;
                if(action==='waiting'){
                    document.getElementById('quickNewPetModal').style.display='none';quickPetContext=null;
                    switchTab('appointments');
                    if(appointment.status==='候診中')await openWaitingDoctorV54(appointment.id);
                    return;
                }
                message.textContent='寵物已建檔並加入候診，正在確認接診權…';
                await startDoctorConsultationV51([entry.id,entry.microchip||'',entry.name,entry.owner_id,entry.weight,entry.owner_name,entry.birthday,entry.gender,entry.species,entry.breed],appointment.id);
                if(scope!==ownerScopeV908()||ctx!==quickPetContext)return;
                if(currentPetId!==entry.id||doctorVisitV51?.petId!==entry.id||doctorVisitV51?.appointmentId!==appointment.id||!document.getElementById('medical').classList.contains('active')){
                    message.textContent='寵物已建檔並加入候診，尚未進入看診；可按「儲存並加入候診」查看，或確認原看診已完成後再接診。';return;
                }
                document.getElementById('quickNewPetModal').style.display='none';quickPetContext=null;
            }catch(e){
                if(scope===ownerScopeV908()&&ctx===quickPetContext){
                    if(!ctx.savedPet&&e.code==='GB_RECORD_REJECTED')ctx.fingerprint=null;
                    message.textContent=(ctx.savedPet?'寵物已建檔。':'新增失敗或結果待確認。')+' '+e.message+' 請保留原欄位重試或核對候診。';
                }
            }finally{quickPetSaving=false;for(const id of ['quickPetSave','quickPetWaiting','quickPetConsult'])document.getElementById(id).disabled=false;}
        }
        let medicalProductReturnContext=null,medicalProductOpening=false;
        async function goToProductsFromMedical(){
            if(medicalProductOpening)return;
            if(!currentPetId||!currentOwnerId){alert('請先選擇有飼主的看診寵物。');return;}
            const ctx={tenant:CURRENT_TENANT_ID,petId:currentPetId,ownerId:currentOwnerId,appointmentId:currentAppointmentId||doctorVisitV51?.appointmentId||null};
            if(document.querySelector('#productCheckoutItems .checkout-item-row') && document.getElementById('selectedCheckoutOwnerId').value!==ctx.ownerId){alert('商品頁尚有另一筆購物車，請先完成或清空，避免更換飼主。');return;}
            medicalProductOpening=true;
            try{
                const {data:owner,error}=await _supabase.from('owners').select('*').eq('tenant_id',ctx.tenant).eq('id',ctx.ownerId).single();if(error||!owner)throw error||new Error('找不到飼主');
                const {data:pets,error:petError}=await _supabase.from('pets').select('*').eq('tenant_id',ctx.tenant).eq('owner_id',ctx.ownerId);if(petError)throw petError;
                if(ctx.tenant!==CURRENT_TENANT_ID||ctx.petId!==currentPetId||ctx.ownerId!==currentOwnerId)return;
                if(!(pets||[]).some(p=>p.id===ctx.petId))throw new Error('寵物與飼主關聯不符');
                collectCurrentMedicalState();medicalProductReturnContext=ctx;
                const list=document.getElementById('checkoutOwnerDatalist');let opt=Array.from(list.options).find(o=>o.dataset.ownerId===owner.id);
                if(!opt){opt=document.createElement('option');opt.dataset.ownerId=owner.id;opt.value='[新:'+(owner.system_code||'-')+'] '+owner.name+' ('+(owner.mobile||'無手機')+')';list.append(opt);}
                const idx=globalOwnersPetsData.findIndex(x=>x.owner.id===owner.id);const group={owner,pets:pets||[]};if(idx<0)globalOwnersPetsData.push(group);else globalOwnersPetsData[idx]=group;
                document.getElementById('checkoutOwnerSearch').value=opt.value;onCheckoutOwnerInput({target:document.getElementById('checkoutOwnerSearch')});document.getElementById('checkoutPetSelect').value=ctx.petId;
                document.getElementById('returnMedicalFromProducts').hidden=false;const hint=document.getElementById('medicalProductContext');hint.hidden=false;hint.textContent='由門診帶入：'+owner.name+'／'+currentPetName+'。商品另行結帳，返回時保留原病歷與處方。';
                switchTab('product_checkout');
            }catch(e){alert('無法帶入商品頁：'+e.message);}finally{medicalProductOpening=false;}
        }
        function backToMedicalFromProducts(){
            if(!currentPetId){switchTab('medical');return;}
            const ctx=medicalProductReturnContext;
            if(!ctx||ctx.tenant!==CURRENT_TENANT_ID||ctx.petId!==currentPetId||ctx.ownerId!==currentOwnerId){alert('原看診已變更，請從候診清單重新開啟正確病患。');return;}
            switchTab('medical'); // DOM stays mounted: preserve even unfinished prescription inputs.
        }

        async function addPetToOwnerPrompt(ownerId, ownerName) {
            return openQuickNewPet(ownerId);
        }

        async function editOwner(ownerId, currentCode, currentName, currentMobile, currentPhone, currentAddress, currentNotes) {
            const newCode = prompt('修改舊紙本病歷號（新系統編號由系統管理）：', currentCode);
            if (newCode === null) return;
            const newName = prompt('修改飼主姓名：', currentName);
            if (newName === null) return;
            const newMobile = prompt('修改手機號碼：', currentMobile);
            if (newMobile === null) return;
            const newPhone = prompt('修改市話：', currentPhone);
            if (newPhone === null) return;
            const newAddress = prompt('修改聯絡地址：', currentAddress);
            if (newAddress === null) return;
            const newNotes = prompt('修改備註欄：', currentNotes);
            if (newNotes === null) return;

            await _supabase.from('owners').update({ 
                owner_code: newCode || null, 
                name: newName, 
                mobile: newMobile, 
                phone: newPhone, 
                address: newAddress,
                notes: newNotes || null
            }).eq('id', ownerId);

            alert('飼主資料已更新！');
            loadOwnersAndPetsIntegrated();
        }

        async function editPet(petId, currentName, currentChip, currentWeight, currentBirthday, currentBreed, currentSpecies) {
            const newName = prompt('修改寵物名字：', currentName);
            if (newName === null) return;
            const newSpecies = prompt('修改動物分類 (犬 / 貓 / 兔 / 鼠 / 豬 / 其他)：', currentSpecies);
            if (newSpecies === null) return;
            const newBreed = prompt('修改品種：', currentBreed);
            if (newBreed === null) return;
            const newChip = prompt('修改晶片號碼：', currentChip);
            if (newChip === null) return;
            const newBirthday = await choosePetBirthday(currentBirthday, '修改寵物：選擇出生日期');
            if (newBirthday === null) return;
            const newWeightText=prompt('修改目前體重 (kg，最多兩位小數)：', roundPetWeight(currentWeight)??'');
            if(newWeightText===null)return;
            const newWeight=roundPetWeight(newWeightText);
            if(newWeightText.trim()!=='' && newWeight===null){alert('請輸入有效體重。');return;}

            const { error } = await _supabase.from('pets').update({ name: newName, species: newSpecies || '貓', breed: newBreed || null, microchip: newChip || null, birthday: newBirthday || null, weight: newWeight }).eq('id', petId).eq('tenant_id', CURRENT_TENANT_ID);
            if (error) { alert('寵物資料更新失敗：'+error.message); return; }
            alert('寵物資料已更新！');
            loadOwnersAndPetsIntegrated();
        }

        async function deletePet(petId, petName) {
            if (!confirm(`確定要刪除寵物「${petName}」嗎？`)) return;
            await _supabase.from('pets').delete().eq('id', petId);
            alert('寵物已刪除！');
            loadOwnersAndPetsIntegrated();
        }

        function onReportTypeChange() {
            const reportType = document.getElementById('reportType').value;
            const todayStr = new Date().toISOString().split('T')[0];
            const groupEndDate = document.getElementById('groupEndDate');
            const labelStartDate = document.getElementById('labelStartDate');

            if (reportType === 'daily') {
                labelStartDate.innerText = "選擇結算日期";
                groupEndDate.style.display = 'none';
                document.getElementById('reportStartDate').value = todayStr;
            } else if (reportType === 'monthly') {
                labelStartDate.innerText = "選擇月份中的任意一天";
                groupEndDate.style.display = 'none';
                document.getElementById('reportStartDate').value = todayStr;
            } else if (reportType === 'yearly') {
                labelStartDate.innerText = "選擇年份中的任意一天";
                groupEndDate.style.display = 'none';
                document.getElementById('reportStartDate').value = todayStr;
            } else {
                labelStartDate.innerText = "起始日期 (Start Date)";
                groupEndDate.style.display = 'flex';
                document.getElementById('reportStartDate').value = todayStr;
                document.getElementById('reportEndDate').value = todayStr;
            }
            fetchFinancialReport();
        }

        let financialReportRequest=0;
        async function loadFinancialReportRows(startDate,endDate,tenant,request) {
            const invoices=[];
            for (let offset=0;;offset+=1000) {
                const {data,error}=await _supabase.from('invoices')
                    .select('*, owners(id,name,mobile,phone,owner_code,system_code)')
                    .eq('tenant_id',tenant).gte('created_at',startDate.toISOString()).lte('created_at',endDate.toISOString())
                    .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
                if (error) throw error;
                if (tenant!==CURRENT_TENANT_ID || request!==financialReportRequest) return null;
                invoices.push(...(data||[]));
                if (!data || data.length<1000) break;
            }
            // invoices.pet_id has no FK in this installation: retrieve only the referenced pets explicitly.
            const petIds=[...new Set(invoices.map(i=>i.pet_id).filter(Boolean))], pets=new Map();
            for (let offset=0;offset<petIds.length;offset+=200) {
                const {data,error}=await _supabase.from('pets').select('id,name').eq('tenant_id',tenant).in('id',petIds.slice(offset,offset+200));
                if (error) throw error;
                if (tenant!==CURRENT_TENANT_ID || request!==financialReportRequest) return null;
                for (const pet of data||[]) pets.set(pet.id,pet);
            }
            const verification=new Map();
            for(let offset=0;offset<invoices.length;offset+=200){
                const batch=invoices.slice(offset,offset+200),ids=batch.map(i=>i.id);
                const reply=await posRpcV77('finance_status',{invoice_ids:ids});
                if(tenant!==CURRENT_TENANT_ID||request!==financialReportRequest)return null;
                if(reply.tenant_id!==String(tenant)||!Array.isArray(reply.statuses)||reply.statuses.length!==ids.length||new Set(reply.statuses.map(r=>r.invoice_id)).size!==ids.length||reply.statuses.some(r=>!ids.includes(r.invoice_id)))throw Error('收款核對狀態回覆不完整，請確認已更新 v84_5 SQL');
                for(const row of reply.statuses){if(row.revenue_split?.version!==853)throw Error('請先執行 v85_3 門診商品收入分類 SQL');verification.set(row.invoice_id,row);}
            }
            return invoices.map(i=>({...i,pets:pets.get(i.pet_id)||null,verificationV845:verification.get(i.id)}));
        }
        function financialOwnerDisplay(invoice) {
            const owner=invoice.owners;
            if (owner) {
                const codes=[owner.system_code?'新：'+owner.system_code:'',owner.owner_code?'舊：'+owner.owner_code:''].filter(Boolean).join('／');
                return (codes?'['+escapeCheckoutText(codes)+'] ':'')+escapeCheckoutText(owner.name||'未填姓名')+' ('+escapeCheckoutText(owner.mobile||owner.phone||'無電話')+')';
            }
            if (invoice.owner_id) return '<span style="color:#b45309;">飼主資料無法讀取（已有飼主關聯）</span>';
            return invoice.pet_id ? '<span style="color:#b45309;">未指定飼主（已有寵物關聯）</span>' : '<span style="color:#94a3b8;">散客 / 無指定飼主</span>';
        }

        async function fetchFinancialReport() {
            const tenant=CURRENT_TENANT_ID,request=++financialReportRequest;
            if (!tenant) return;
            const reportType = document.getElementById('reportType').value;
            const startDateStr = document.getElementById('reportStartDate').value;
            const endDateStr = document.getElementById('reportEndDate').value;
            if(!startDateStr) return;

            let startDate, endDate;
            if (reportType === 'daily') {
                const baseDate = new Date(startDateStr);
                startDate = new Date(baseDate); startDate.setHours(0, 0, 0, 0);
                endDate = new Date(baseDate); endDate.setHours(23, 59, 59, 999);
            } else if (reportType === 'monthly') {
                const baseDate = new Date(startDateStr);
                startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1, 0, 0, 0, 0);
                endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);
            } else if (reportType === 'yearly') {
                const baseDate = new Date(startDateStr);
                startDate = new Date(baseDate.getFullYear(), 0, 1, 0, 0, 0, 0);
                endDate = new Date(baseDate.getFullYear(), 11, 31, 23, 59, 59, 999);
            } else {
                if(!endDateStr) return;
                startDate = new Date(startDateStr); startDate.setHours(0, 0, 0, 0);
                endDate = new Date(endDateStr); endDate.setHours(23, 59, 59, 999);
            }

            let data;
            try { data=await loadFinancialReportRows(startDate,endDate,tenant,request); }
            catch(error) {
                if (tenant===CURRENT_TENANT_ID && request===financialReportRequest) alert('結算報表讀取失敗：'+error.message+'。請重新查詢，畫面目前保留上一次成功結果。');
                return;
            }
            if (data===null) return;
            data=data.filter(inv=>!inv.voided_at&&inv.verificationV845?.state==='verified');

            const tbody = document.getElementById('reportTableBody');
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">此期間尚無已確認入帳的營收</td></tr>`;
                document.getElementById('statClinicCount').innerText = `0 筆`;
                document.getElementById('statClinicDiscount').innerText = `NT$ 0`;
                document.getElementById('statClinicTotal').innerText = `NT$ 0`;
                document.getElementById('statProductCount').innerText = `0 筆`;
                document.getElementById('statProductDiscount').innerText = `NT$ 0`;
                document.getElementById('statProductTotal').innerText = `NT$ 0`;
                document.getElementById('statGrandTotal').innerText = `NT$ 0`;
                document.getElementById('footSubtotal').innerText = `NT$ 0`;
                document.getElementById('footDiscount').innerText = `NT$ 0`;
                document.getElementById('footTotal').innerText = `NT$ 0`;
                return;
            }

            let clinicCount = 0, clinicDiscount = 0, clinicTotal = 0;
            let productCount = 0, productDiscount = 0, productTotal = 0;
            let totalSubtotal = 0, totalDiscount = 0, totalRevenue = 0;

            data.forEach(inv => {
                const sub = parseFloat(inv.subtotal) || 0;
                const disc = parseFloat(inv.discount) || 0;
                const originalTotalV845=parseFloat(inv.total_amount)||0;
                const verifiedV845=inv.verificationV845?.state==='verified'&&!inv.voided_at;
                const total=verifiedV845?Math.max(0,originalTotalV845-Number(inv.verificationV845?.confirmed_refunds||0)):0;
                
                if (verifiedV845) totalSubtotal += sub; 
                if (verifiedV845) totalDiscount += disc; 
                if (verifiedV845) totalRevenue += total;

                const revenueV853=posRevenueV853(inv,inv.verificationV845?.confirmed_refunds||0);
                if(verifiedV845){
                    if(revenueV853.has_product){productCount++;productDiscount+=Number(revenueV853.product_discount||0);productTotal+=revenueV853.product_total;}
                    if(revenueV853.has_clinic){clinicCount++;clinicDiscount+=Number(revenueV853.clinic_discount||0);clinicTotal+=revenueV853.clinic_total;}
                }

                const ownerStr = financialOwnerDisplay(inv);
                const petStr = inv.pets ? ` 🐶 <b>${inv.pets.name}</b>` : '';
                const typeBadgeColor = inv.checkout_type === '商品零售' ? '#059669' : '#0284c7';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(inv.created_at).toLocaleString()}</td>
                    <td><b>${ownerStr}</b>${petStr}</td>
                    <td><span style="background: #e0f2fe; color: ${typeBadgeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${escapeCheckoutText(revenueV853.has_product&&revenueV853.has_clinic?'門診＋商品':inv.checkout_type)}</span><br>門診 ${revenueV853.clinic_total.toLocaleString()}｜商品 ${revenueV853.product_total.toLocaleString()}${inv.voided_at ? ' <b style="color:#dc2626">已作廢</b>' : '<br><b>'+escapeCheckoutText(({verified:'已核對確認',pending:'已收款、待核對',unlinked:'舊帳單尚未連結',unpaid:'待收款'})[inv.verificationV845?.state]||'待核對')+'</b>'+(inv.verificationV845?.method?'｜'+escapeCheckoutText(inv.verificationV845.method):'')+(inv.verificationV845?.verified_at?'<br>核對：'+new Date(inv.verificationV845.verified_at).toLocaleString()+'｜'+escapeCheckoutText(inv.verificationV845.verified_by||''):'')+(inv.verificationV845?.settled_date?'<br>實際入帳日：'+escapeCheckoutText(inv.verificationV845.settled_date):'')}</td>
                    <td>NT$ ${sub.toLocaleString()}</td>
                    <td>NT$ ${disc.toLocaleString()}</td>
                    <td><b>NT$ ${inv.voided_at ? '0（原 ' + originalTotalV845.toLocaleString() + '）' : verifiedV845 ? total.toLocaleString()+(Number(inv.verificationV845.confirmed_refunds||0)?'（已扣核對退款）':'') : '待確認 '+originalTotalV845.toLocaleString()}</b></td>
                    <td>${inv.verificationV845?.settled_date ? '入帳日：'+escapeCheckoutText(inv.verificationV845.settled_date) : '已核對確認'}</td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('statClinicCount').innerText = `${clinicCount} 筆`;
            document.getElementById('statClinicDiscount').innerText = `NT$ ${clinicDiscount.toLocaleString()}`;
            document.getElementById('statClinicTotal').innerText = `NT$ ${clinicTotal.toLocaleString()}`;

            document.getElementById('statProductCount').innerText = `${productCount} 筆`;
            document.getElementById('statProductDiscount').innerText = `NT$ ${productDiscount.toLocaleString()}`;
            document.getElementById('statProductTotal').innerText = `NT$ ${productTotal.toLocaleString()}`;

            document.getElementById('statGrandTotal').innerText = `NT$ ${totalRevenue.toLocaleString()}`;
            document.getElementById('footSubtotal').innerText = `NT$ ${totalSubtotal.toLocaleString()}`;
            document.getElementById('footDiscount').innerText = `NT$ ${totalDiscount.toLocaleString()}`;
            document.getElementById('footTotal').innerText = `NT$ ${totalRevenue.toLocaleString()}`;
        }

        // v73 同飼主複選掛號與上一筆搜尋。每隻保留獨立就診，搜尋紀錄僅留本次登入記憶體。
        let globalSearchRequest = 0;
        let globalSearchMatches = new Map();
        let globalSearchTenant = null;
        let globalSearchScopeV73 = '';
        let globalRecentSearchV73 = null;
        const globalSelectedPetsV73 = new Set();
        let globalRegistrationBusyV73 = false;
        const globalWaitingSaveBusy = new Set();
        const globalRegistrationRequestsDjango = new Map();

        function globalSearchScopeNowV73() {return doctorScopeV51();}
        function globalCanRegisterV73() {return !!globalSearchScopeNowV73() && waitingDoctorAllowedV54();}
        function globalOwnerIdV73(pet) {return pet?.owner_id || pet?.owners?.id || '';}
        function globalActivePetV73(id) {
            return activeAppointmentsList.find(p => (p.id===id || p.pet_id===id) && p.status!=='已預約')
                || activeAppointmentsList.find(p => p.id===id || p.pet_id===id);
        }
        function updateRecentSearchButtonV73() {
            const btn=document.getElementById('globalPreviousSearchV73');
            if(btn)btn.disabled=globalRegistrationBusyV73 || !globalRecentSearchV73 || globalRecentSearchV73.scope!==globalSearchScopeNowV73();
        }
        function forgetGlobalRecentSearchV73() {globalRecentSearchV73=null;updateRecentSearchButtonV73();}
        function closeGlobalSearchResults() {
            globalSearchRequest++;
            globalSearchMatches.clear();globalSelectedPetsV73.clear();
            globalSearchTenant = null;globalSearchScopeV73='';
            document.getElementById('globalSearchResultsPanel').hidden = true;
            document.getElementById('globalSearchResultsBody').replaceChildren();
            updateGlobalSelectionV73();updateRecentSearchButtonV73();
        }
        function clearGlobalSearchAfterSelection(request, tenant) {
            if (request !== globalSearchRequest || tenant !== CURRENT_TENANT_ID || globalSearchScopeV73!==globalSearchScopeNowV73()) return;
            document.getElementById('globalSearchInput').value='';
            document.getElementById('globalSearchOwnerInput').value='';
            document.getElementById('globalSearchResultsStatus').textContent='';
            closeGlobalSearchResults();
            document.getElementById('globalSearchInput').focus();
        }
        function globalSearchCriteria(query,ownerName) {
            query=query.trim(); ownerName=ownerName.trim();
            if (ownerName) return {query,ownerName};
            const parts=query.split(/\s+/u);
            return parts.length>1 ? {query:parts[0],ownerName:parts.slice(1).join(' ')} : {query,ownerName:''};
        }
        async function handleGlobalSearch(event,ownerId=null,recent=null) {
            if (event.key !== 'Enter' || event.isComposing || event.repeat || globalRegistrationBusyV73) return;
            event.preventDefault();
            const criteria=recent || globalSearchCriteria(document.getElementById('globalSearchInput').value,document.getElementById('globalSearchOwnerInput').value);
            const query=ownerId?'':criteria.query,ownerName=ownerId?'':criteria.ownerName;
            closeGlobalSearchResults();
            const scope=globalSearchScopeNowV73();
            if ((!query && !ownerName && !ownerId) || !scope) return;
            const request = globalSearchRequest, tenant = CURRENT_TENANT_ID;
            const panel = document.getElementById('globalSearchResultsPanel');
            const status = document.getElementById('globalSearchResultsStatus');
            panel.hidden = false;status.textContent = '正在搜尋…';
            try {
                const {data:{session},error:sessionError}=await _supabase.auth.getSession();
                if(sessionError)throw sessionError;
                if(!session || session.user.id!==CURRENT_USER?.id)throw new Error('登入已失效或帳號已變更，請重新登入。');
                const params=new URLSearchParams({query,owner_name:ownerName});
                if(ownerId)params.set('owner_id',ownerId);
                const response=await fetch('/api/search/pets/?'+params.toString(),{
                    headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'
                });
                const result=await response.json();
                if(!response.ok)throw new Error(result.error||'搜尋失敗，請稍後再試。');
                if(result.tenant_id!==tenant || result.user_id!==session.user.id)throw new Error('登入院所已變更，請重新登入。');
                const matchedPets=result.pets;
                if(!Array.isArray(matchedPets))throw new Error('搜尋回應格式不正確。');
                if (matchedPets===null || request!==globalSearchRequest || scope!==globalSearchScopeNowV73()) return;
                globalSearchTenant=tenant;globalSearchScopeV73=scope;
                globalSearchMatches=new Map(matchedPets.map(pet=>[pet.id,pet]));
                globalRecentSearchV73={scope,query,ownerName,ownerId};
                document.getElementById('globalSearchInput').value='';
                document.getElementById('globalSearchOwnerInput').value='';
                renderGlobalSearchResultsV73();updateRecentSearchButtonV73();
                status.textContent=matchedPets.length ? `找到 ${globalSearchMatches.size} 隻寵物。請核對飼主與電話，勾選同一飼主的寵物後加入候診；也可逐隻掛號。` : '查無符合條件的病患，請換個關鍵字再搜尋。';
            } catch (error) {
                if (request!==globalSearchRequest || scope!==globalSearchScopeNowV73()) return;
                status.textContent=error.message||'搜尋失敗，請重新按 Enter 搜尋。';console.error('全域搜尋失敗',error);
            }
        }
        async function showOwnerPetsV73(ownerId) {
            if(globalRegistrationBusyV73 || globalSearchScopeV73!==globalSearchScopeNowV73() || ![...globalSearchMatches.values()].some(p=>globalOwnerIdV73(p)===ownerId))return;
            return handleGlobalSearch({key:'Enter',preventDefault(){}},ownerId);
        }
        async function repeatGlobalSearchV73() {
            const previous=globalRecentSearchV73;
            if(globalRegistrationBusyV73 || !previous || previous.scope!==globalSearchScopeNowV73()){updateRecentSearchButtonV73();return;}
            document.getElementById('globalSearchInput').value=previous.query;
            document.getElementById('globalSearchOwnerInput').value=previous.ownerName;
            return handleGlobalSearch({key:'Enter',preventDefault(){}},previous.ownerId,previous);
        }
        function updateGlobalSelectionV73() {
            const selected=[...globalSelectedPetsV73].map(id=>globalSearchMatches.get(id)).filter(Boolean);
            const label=document.getElementById('globalSelectedLabelV73');
            if(label)label.textContent=selected.length ? `${selected[0].owners?.name||'此飼主'}：已勾選 ${selected.length} 隻` : '尚未勾選寵物';
            const btn=document.getElementById('globalBatchRegisterV73');
            if(btn)btn.disabled=globalRegistrationBusyV73 || !selected.length || !globalCanRegisterV73() || globalSearchScopeV73!==globalSearchScopeNowV73();
            const ownerId=selected.length?globalOwnerIdV73(selected[0]):null;
            for(const input of document.querySelectorAll('#globalSearchResultsBody input[data-pet-id]')){
                const pet=globalSearchMatches.get(input.dataset.petId),existing=globalActivePetV73(input.dataset.petId);
                input.checked=globalSelectedPetsV73.has(input.dataset.petId);
                input.disabled=globalRegistrationBusyV73 || !globalCanRegisterV73() || !globalOwnerIdV73(pet) || (!!existing && existing.status!=='已預約') || (!!ownerId && globalOwnerIdV73(pet)!==ownerId);
            }
        }
        function toggleGlobalPetV73(id,checked) {
            const pet=globalSearchMatches.get(id);
            if(globalRegistrationBusyV73 || !globalCanRegisterV73() || globalSearchScopeV73!==globalSearchScopeNowV73() || !pet || !globalOwnerIdV73(pet))return;
            const existing=globalActivePetV73(id);
            if(existing && existing.status!=='已預約')return;
            const selected=[...globalSelectedPetsV73].map(k=>globalSearchMatches.get(k)).filter(Boolean);
            if(checked && selected.length && globalOwnerIdV73(selected[0])!==globalOwnerIdV73(pet)){
                alert('一次請只勾選同一位飼主的寵物；請先完成掛號或取消原勾選。');updateGlobalSelectionV73();return;
            }
            if(checked)globalSelectedPetsV73.add(id);else globalSelectedPetsV73.delete(id);
            updateGlobalSelectionV73();
        }
        function selectGlobalOwnerV73(ownerId) {
            if(globalRegistrationBusyV73 || !globalCanRegisterV73() || globalSearchScopeV73!==globalSearchScopeNowV73())return;
            const other=[...globalSelectedPetsV73].some(id=>globalOwnerIdV73(globalSearchMatches.get(id))!==ownerId);
            if(other){alert('請先完成原飼主掛號或取消勾選，再選另一位飼主。');return;}
            for(const pet of globalSearchMatches.values()){
                const existing=globalActivePetV73(pet.id);
                if(globalOwnerIdV73(pet)===ownerId && (!existing || existing.status==='已預約'))globalSelectedPetsV73.add(pet.id);
            }
            updateGlobalSelectionV73();
        }
        function renderGlobalSearchResultsV73() {
            if(globalSearchScopeV73!==globalSearchScopeNowV73())return;
            const body=document.getElementById('globalSearchResultsBody');body.replaceChildren();
            const groups=new Map();
            for(const pet of globalSearchMatches.values()){
                const key=globalOwnerIdV73(pet)||'pet:'+pet.id;
                if(!groups.has(key))groups.set(key,[]);groups.get(key).push(pet);
            }
            const button=(text,fn,cls='btn-secondary')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.disabled=globalRegistrationBusyV73;b.addEventListener('click',fn);return b;};
            for(const pets of groups.values()){
                const first=pets[0],owner=first.owners||{},ownerId=globalOwnerIdV73(first);
                const heading=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=8;cell.className='global-owner-group-v73';
                const label=document.createElement('strong');label.textContent=`飼主：${owner.name||'未知飼主'}　電話：${[owner.mobile,owner.phone].filter(Boolean).join('／')||'無電話'}　新編號：${owner.system_code||'-'}　舊號：${owner.owner_code||'-'}`;cell.append(label);
                if(ownerId){
                    const tools=document.createElement('span');tools.className='global-owner-tools-v73';
                    tools.append(button('顯示此飼主全部寵物',()=>showOwnerPetsV73(ownerId)));
                    const select=button('勾選本組可掛號寵物',()=>selectGlobalOwnerV73(ownerId));select.disabled=globalRegistrationBusyV73||!globalCanRegisterV73();tools.append(select);cell.append(tools);
                }
                heading.append(cell);body.append(heading);
                for(const pet of pets){
                    const row=document.createElement('tr'),pick=document.createElement('td'),input=document.createElement('input');
                    input.type='checkbox';input.dataset.petId=pet.id;input.setAttribute('aria-label','勾選 '+(pet.name||'此寵物')+'（飼主 '+(owner.name||'未知')+'）');
                    input.addEventListener('change',()=>toggleGlobalPetV73(pet.id,input.checked));pick.append(input);row.append(pick);
                    const values=[pet.name||'-',[pet.species,pet.breed].filter(Boolean).join('／')||'-','新：'+(owner.system_code||'-')+'\n舊：'+(owner.owner_code||'-'),owner.name||'未知飼主',[owner.mobile,owner.phone].filter(Boolean).join('／')||'無電話',pet.microchip||'-'];
                    for(const value of values){const c=document.createElement('td');c.textContent=value;c.style.whiteSpace='pre-wrap';row.append(c);}
                    const action=document.createElement('td');action.className='global-pet-actions-v73';
                    const existing=globalActivePetV73(pet.id);
                    if(existing && existing.status!=='已預約'){
                        globalSelectedPetsV73.delete(pet.id);const state=document.createElement('span');state.textContent=existing.status==='診間看診中'?'看診中':'已在候診';action.append(state);
                    }else{
                        const register=button(existing?'預約報到':'加入候診',()=>addGlobalSearchPetToWaiting(pet.id),'btn-success');register.disabled=globalRegistrationBusyV73||!globalCanRegisterV73();action.append(register);
                    }
                    if(ownerId)action.append(button('替此飼主新增寵物',()=>openQuickNewPet(ownerId)));
                    row.append(action);body.append(row);
                }
            }
            updateGlobalSelectionV73();
        }
        function setGlobalRegistrationBusyV73(value) {
            globalRegistrationBusyV73=value;
            for(const id of ['globalSearchInput','globalSearchOwnerInput','globalVisitPurposeV74'])document.getElementById(id).disabled=value;
            updateRecentSearchButtonV73();renderGlobalSearchResultsV73();
        }
        function waitingPetFromAppointment(pet,appointment) {
            return {...pet,id:appointment.pet_id,owner_id:appointment.owner_id||globalOwnerIdV73(pet),
                owner_name:pet.owners?.name||pet.owner_name||'未知飼主',appointment_id:appointment.id,
                appointment_time:appointment.scheduled_at,status:appointment.status,notes:appointment.notes||'',
                session:appointment.session||'上午診',doctor:appointment.doctor||'',assigned_doctor_id:appointment.assigned_doctor_id||null,
                check_in_time:appointment.checked_in_at?new Date(appointment.checked_in_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'',
                time:new Date(appointment.scheduled_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
        }
        async function registerGlobalPetV73(petId,request,scope) {
            const tenant=CURRENT_TENANT_ID,pet=globalSearchMatches.get(petId),busyKey=tenant+':'+petId;
            const valid=()=>request===globalSearchRequest && scope===globalSearchScopeNowV73() && scope===globalSearchScopeV73 && tenant===CURRENT_TENANT_ID && globalCanRegisterV73();
            if(!pet || !valid())throw Error('搜尋或登入已變更，請重新搜尋確認。');
            if(globalWaitingSaveBusy.has(busyKey))throw Error('這隻寵物正在掛號，請稍後核對。');
            globalWaitingSaveBusy.add(busyKey);
            try{
                if(!globalRegistrationRequestsDjango.has(busyKey))globalRegistrationRequestsDjango.set(busyKey,crypto.randomUUID());
                const payload={pet_id:petId,request_id:globalRegistrationRequestsDjango.get(busyKey),
                    purpose:document.getElementById('globalVisitPurposeV74')?.value||'看診',
                    session:document.getElementById('appointmentSession')?.value||'上午診'};
                const send=async()=>{
                    if(!valid())throw Error('登入或搜尋已變更，停止後續掛號。');
                    const {data:{session},error}=await _supabase.auth.getSession();
                    if(error)throw error;
                    if(!session || session.user.id!==CURRENT_USER?.id)throw Error('登入已失效或帳號已變更，請重新登入。');
                    if(!valid())throw Error('登入或搜尋已變更，停止後續掛號。');
                    const response=await fetch('/api/registration/',{method:'POST',
                        headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
                        body:JSON.stringify(payload),cache:'no-store'});
                    const result=await response.json();
                    return {response,result};
                };
                let {response,result}=await send();
                if(response.status===409 && result.code==='early_check_in'){
                    if(!valid())throw Error('登入或搜尋已變更，停止報到。');
                    if(!confirm(`${pet.name||'此寵物'}尚未到原預約時間，確定要提前報到嗎？`))return {kind:'skipped',name:pet.name};
                    payload.confirm_early={id:result.appointment.id,scheduled_at:result.appointment.scheduled_at};
                    ({response,result}=await send());
                }
                if(!response.ok)throw Error(result.error||'掛號未確認成功，請更新候診核對。');
                const appointment=result.appointment,existing=result.kind==='existing';
                if(result.user_id!==CURRENT_USER?.id)throw Error('登入已變更；請重新登入原院核對本筆結果。');
                if(!appointment?.id || appointment.pet_id!==petId || appointment.tenant_id!==tenant || !['候診中','診間看診中'].includes(appointment.status))throw Error('未取得正確的已儲存報到紀錄。');
                if(scope!==globalSearchScopeNowV73())throw Error('登入已變更；請重新登入原院核對本筆結果。');
                globalRegistrationRequestsDjango.delete(busyKey);
                appointmentsLoadRequest++;
                const row=waitingPetFromAppointment(pet,appointment);
                activeAppointmentsList=activeAppointmentsList.filter(p=>p.id!==petId || (p.appointment_id && p.appointment_id!==appointment.id));activeAppointmentsList.push(row);
                globalSelectedPetsV73.delete(petId);
                return {kind:existing?'existing':'added',name:pet.name,row};
            }finally{globalWaitingSaveBusy.delete(busyKey);}
        }
        async function addGlobalSearchPetToWaiting(petId) {
            if(globalRegistrationBusyV73)return;
            if(!globalCanRegisterV73()){alert('此帳號沒有掛號權限。');return;}
            const request=globalSearchRequest,scope=globalSearchScopeNowV73();setGlobalRegistrationBusyV73(true);
            try{
                const result=await registerGlobalPetV73(petId,request,scope);
                if(scope!==globalSearchScopeNowV73())return;
                if(result.kind==='skipped'){document.getElementById('globalSearchResultsStatus').textContent='已取消提前報到，搜尋結果保留。';return;}
                switchTab('appointments');renderAppointmentTable(activeAppointmentsList);
                clearGlobalSearchAfterSelection(request,CURRENT_TENANT_ID);

                if(result.kind==='added' && result.row.status==='候診中')await openWaitingDoctorV54(result.row.appointment_id);
            }catch(error){if(scope===globalSearchScopeNowV73())alert('加入候診未確認成功：'+error.message+'。請更新候診核對結果後再重試。');}
            finally{setGlobalRegistrationBusyV73(false);}
        }
        async function addSelectedGlobalPetsV73() {
            if(globalRegistrationBusyV73)return;
            const ids=[...globalSelectedPetsV73],pets=ids.map(id=>globalSearchMatches.get(id));
            if(!ids.length || pets.some(p=>!p || !globalOwnerIdV73(p)) || !globalCanRegisterV73() || globalSearchScopeV73!==globalSearchScopeNowV73())return;
            if(new Set(pets.map(globalOwnerIdV73)).size!==1){alert('一次只能複選同一位飼主的寵物。');return;}
            const request=globalSearchRequest,scope=globalSearchScopeNowV73(),results=[];
            setGlobalRegistrationBusyV73(true);
            try{
                for(let i=0;i<ids.length;i++){
                    if(scope!==globalSearchScopeNowV73() || request!==globalSearchRequest || !globalCanRegisterV73())break;
                    document.getElementById('globalSearchResultsStatus').textContent=`正在掛號 ${i+1}／${ids.length}：${pets[i].name}…`;
                    try{results.push(await registerGlobalPetV73(ids[i],request,scope));}
                    catch(error){results.push({kind:'failed',name:pets[i].name,error:error.message});}
                }
                if(scope!==globalSearchScopeNowV73())return;
                switchTab('appointments');renderAppointmentTable(activeAppointmentsList);
                if(request===globalSearchRequest){
                    renderGlobalSearchResultsV73();
                    const count=kind=>results.filter(r=>r.kind===kind).length;
                    const failures=results.filter(r=>r.kind==='failed').map(r=>r.name+'：'+r.error).join('；');
                    const complete=results.length===ids.length && results.every(r=>r.kind==='added'||r.kind==='existing');
                    if(complete){
                        document.getElementById('globalSearchInput').value='';
                        document.getElementById('globalSearchOwnerInput').value='';
                        document.getElementById('globalSearchResultsStatus').textContent='';
                        closeGlobalSearchResults();
                        document.getElementById('globalSearchInput').focus();
                        return;
                    }
                    document.getElementById('globalSearchResultsStatus').textContent=`本次已完成 ${count('added')} 隻；原已在列表 ${count('existing')} 隻；取消提前報到 ${count('skipped')} 隻；未確認成功 ${count('failed')} 隻；尚未處理 ${ids.length-results.length} 隻。${failures?' 未確認項目：'+failures+'。請先更新候診核對後再重試。':''} 搜尋結果保留；請從各候診卡分別指定醫師。`;
                }
            }finally{setGlobalRegistrationBusyV73(false);}
        }

        // 一鍵資料備份 v1：完整原始 JSON 以文字保存，避免數值精度改變。
        const CLINIC_BACKUP_TABLES = ["appointments", "audit_logs", "breed_images", "breeds", "categories", "clinic_settings", "clinic_trials", "controlled_drug_counts", "diagnostic_devices", "diagnostic_import_jobs", "diagnostic_results", "imaging_assets", "imaging_share_tokens", "imaging_shares_v76", "imaging_studies", "inpatients", "inventory_movements", "invoice_items", "invoices", "item_categories", "items", "lab_reports", "lab_tests", "legacy_medical_histories", "medical_records", "medicines", "owner_code_counters", "owners", "pets", "rapid_test_records", "rapid_types", "regulated_drug_transactions", "regulated_lots", "regulatory_report_batch_transactions", "regulatory_report_batches", "report_export_profiles", "user_profiles", "vaccination_records", "vaccine_types", "pos_audit_v77", "pos_movements_v77", "pos_pending_v77", "pos_requests_v77", "pos_shifts_v77", "pharmacy_jobs_v9133"];
        const CLINIC_BACKUP_POS_TABLES_V843 = ["pos_audit_v77", "pos_movements_v77", "pos_pending_v77", "pos_requests_v77", "pos_shifts_v77"];
        let clinicBackupBusy = false;
        let clinicBackupController = null;
        let clinicBackupDownloadUrl = null;

        function validateClinicBackupSnapshot(snapshot, expectedTenant) {
            if (!snapshot || snapshot.format !== 'genblue-clinic-snapshot' || ![1,2,3].includes(snapshot.format_version)) throw new Error('不是支援的 genblue 醫院資料備份。');
            if (!snapshot.tenant_id || (expectedTenant && snapshot.tenant_id !== expectedTenant)) throw new Error('备份的醫院代碼與目前登入醫院不同。');
            // v84_4: old archives may omit the whole POS group; partial groups are invalid.
            const posTableCount=CLINIC_BACKUP_POS_TABLES_V843.filter(name=>Object.prototype.hasOwnProperty.call(snapshot.tables||{},name)).length;
            if(posTableCount!==0&&posTableCount!==CLINIC_BACKUP_POS_TABLES_V843.length)throw new Error('待付款與交班備份資料表不完整。');
            const expectedTables=CLINIC_BACKUP_TABLES.filter(name=>!['breed_images','imaging_shares_v76','pharmacy_jobs_v9133',...CLINIC_BACKUP_POS_TABLES_V843].includes(name)||Object.prototype.hasOwnProperty.call(snapshot.tables||{},name));
            if (!snapshot.tables || snapshot.table_count !== expectedTables.length+(snapshot.format_version>=2?3:0)+(snapshot.format_version===3?Object.keys(snapshot.booking_tables||{}).length:0) ||
                Object.keys(snapshot.tables).sort().join('|') !== [...expectedTables].sort().join('|')) throw new Error('資料表範圍不完整或版本不同。');
            if(snapshot.format_version===3)validateStorageBackupV62(snapshot);else if (snapshot.attachments?.mode !== 'verified_none_v1' || snapshot.attachments.patient_file_references !== 0 || snapshot.attachments.non_html_storage_objects !== 0) throw new Error('此備份含尚未支援的附件範圍。');
            let total = 0;
            const indexes = new Map();
            for (const name of expectedTables) {
                const table = snapshot.tables[name];
                if (!Array.isArray(table.rows) || !Number.isSafeInteger(table.row_count) || table.row_count !== table.rows.length ||
                    !Array.isArray(table.columns) || !table.columns.length || !Array.isArray(table.foreign_keys) || !Array.isArray(table.constraints)) throw new Error(name + ' 的結構或筆數不完整。');
                const columns = table.columns.map(c => c.name).sort().join('|');
                const child = ['invoice_items','regulatory_report_batch_transactions'].includes(name);
                if (table.scope !== (child ? 'parent_tenant' : 'tenant_id')) throw new Error(name + ' 的醫院範圍無效。');
                const pk = table.constraints.find(c => c.kind === 'p');
                const match = pk?.definition?.match(/PRIMARY KEY \(([^)]+)\)/);
                const pkColumns = match ? match[1].split(',').map(k=>k.trim().replaceAll('"','')) : [];
                const keys = new Set();
                for (const row of table.rows) {
                    if (!row || Array.isArray(row) || Object.keys(row).sort().join('|') !== columns) throw new Error(name + ' 有缺少或多出的欄位。');
                    if (!child && String(row.tenant_id) !== snapshot.tenant_id) throw new Error(name + ' 有其他醫院的資料。');
                    if (pkColumns.length) {
                        if (pkColumns.some(k=>row[k] == null)) throw new Error(name + ' 的主鍵為空。');
                        const key = JSON.stringify(pkColumns.map(k=>row[k]));
                        if (keys.has(key)) throw new Error(name + ' 有重複主鍵。');
                        keys.add(key);
                    }
                }
                total += table.row_count;
            }
            if(snapshot.format_version>=2)total+=validateClinicPrivateBackupV53(snapshot);
            if(snapshot.format_version===3)total+=validateBookingBackupV62(snapshot);
            if (total !== snapshot.total_rows) throw new Error('總筆數核對不一致。');
            for (const name of expectedTables) {
                for (const fk of snapshot.tables[name].foreign_keys) {
                    if (fk.parent_schema === 'auth' && fk.parent_table === 'users') continue;
                    const parent = snapshot.tables[fk.parent_table];
                    if (fk.parent_schema !== 'public' || !parent || !Array.isArray(fk.columns) || !fk.columns.length || fk.columns.length !== fk.parent_columns?.length) throw new Error(name + ' 有無法核對的關聯。');
                    const indexKey = JSON.stringify([fk.parent_table, fk.parent_columns]);
                    if (!indexes.has(indexKey)) indexes.set(indexKey, new Set(parent.rows.map(row=>JSON.stringify(fk.parent_columns.map(k=>row[k])))));
                    for (const row of snapshot.tables[name].rows) {
                        const values = fk.columns.map(k=>row[k]);
                        if (values.some(v=>v == null)) continue;
                        if (!indexes.get(indexKey).has(JSON.stringify(values))) throw new Error(name + ' 有找不到對應資料的關聯。');
                    }
                }
            }
            return {tenantId:snapshot.tenant_id, snapshotAt:snapshot.snapshot_at, tableCount:snapshot.table_count, totalRows:total};
        }

        async function clinicBackupSha256(text) {
            if (!globalThis.crypto?.subtle) throw new Error('此瀏覽器不支援校驗，請使用最新版 Chrome 或 Edge。');
            const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            return Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
        }

        function showClinicBackupSummary(snapshot) {
            const body = document.getElementById('clinicBackupSummaryBody');
            body.replaceChildren();
            const keyTables = [['飼主','owners'],['寵物','pets'],['舊系統病歷','legacy_medical_histories'],['新系統病歷','medical_records'],['收費單','invoices'],['收費明細','invoice_items'],['藥品','medicines'],['商品','items'],['編號計數器','owner_code_counters']];
            for(const [label,name] of [['配藥室紀錄','pharmacy_jobs_v9133'],['待付款帳單','pos_pending_v77'],['開班與下班紀錄','pos_shifts_v77'],['現金與收款異動','pos_movements_v77'],['收款重試紀錄','pos_requests_v77'],['櫃台操作紀錄','pos_audit_v77']])if(snapshot.tables[name])keyTables.push([label,name]);
            for (const [label,name] of keyTables) {
                const row = document.createElement('tr');
                for (const value of [label, snapshot.tables[name].row_count.toLocaleString()]) {
                    const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
                }
                body.append(row);
            }
        }

        function showPrivateBackupSummaryV53(snapshot){if(snapshot.format_version!==2)return;const body=document.getElementById('clinicBackupSummaryBody');for(const [name,label] of [['clinic_visit_claims_v51','接診占用'],['clinic_multidoctor_settings_v51','多人接診保護設定'],['medical_amendments_v53','病歷修正紀錄']]){const row=document.createElement('tr');for(const value of [label,snapshot.private_tables[name].row_count.toLocaleString()]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}}
                function cancelClinicBackup() {
            clinicBackupController?.abort();
            if (clinicBackupDownloadUrl) { URL.revokeObjectURL(clinicBackupDownloadUrl); clinicBackupDownloadUrl = null; }
            const link = document.getElementById('clinicBackupDownload');
            if (link) { link.hidden = true; link.removeAttribute('href'); }
            document.getElementById('clinicBackupSummaryBody')?.replaceChildren();
        }

        async function startClinicDataBackup() {
            if (clinicBackupBusy) return;
            if (CURRENT_PROFILE?.role !== 'admin' || !CURRENT_TENANT_ID) { alert('只有登入本院的管理者可以備份。'); return; }
            const tenant = CURRENT_TENANT_ID;
            const status = document.getElementById('clinicBackupStatus');
            const button = document.getElementById('clinicBackupStart');
            const progress = document.getElementById('clinicBackupProgress');
            const link = document.getElementById('clinicBackupDownload');
            cancelClinicBackup();
            clinicBackupBusy = true;
            button.disabled = true;
            progress.hidden = false;
            progress.removeAttribute('value');
            status.style.color = '#475569';
            status.textContent = '正在取得同一時間點的院內資料，請保留此頁面…';
            const controller = new AbortController();
            clinicBackupController = controller;
            const timer = setTimeout(()=>controller.abort(), 180000);
            try {
                const {data, error} = await _supabase.rpc('genblue_export_clinic_backup_v53', {p_expected_tenant:tenant}).abortSignal(controller.signal);
                if (error) {
                    if (error.code === 'PGRST202' || /Could not find the function/i.test(error.message || '')) throw new Error('備份函式尚未安裝，請先完成一次性的安裝 SQL。');
                    throw new Error(error.message || '資料讀取失敗');
                }
                if (controller.signal.aborted || tenant !== CURRENT_TENANT_ID || CURRENT_PROFILE?.role !== 'admin') throw new Error('備份已取消或登入狀態已改變。');
                if (typeof data !== 'string') throw new Error('伺服器備份版本不符，請確認已安裝 v53 SQL。');
                status.textContent = '正在核對資料表、筆數與病患關聯…'; progress.value = 55;
                const snapshot = JSON.parse(data);
                validateClinicBackupSnapshot(snapshot, tenant);
                if(snapshot.format_version!==2)throw new Error('備份尚未納入接診設定與病歷修正紀錄，請安裝v53 SQL。');
                if (!snapshot.tables.breed_images) throw new Error("備份函式尚未納入品種圖片，請執行 v28 安裝 SQL 後重試。");
                const hash = await clinicBackupSha256(data);
                const envelope = {format:'genblue-clinic-backup-file',format_version:1,sha256:hash,payload_json:data};
                const json = JSON.stringify(envelope);
                status.textContent = '核對通過，正在製作備份檔…'; progress.value = 80;
                let blob = new Blob([json], {type:'application/json'});
                let extension = '.json';
                if (typeof CompressionStream !== 'undefined') {
                    blob = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
                    extension = '.json.gz';
                }
                if (controller.signal.aborted || tenant !== CURRENT_TENANT_ID || CURRENT_PROFILE?.role !== 'admin') throw new Error('備份已取消或登入狀態已改變。');
                clinicBackupDownloadUrl = URL.createObjectURL(blob);
                link.href = clinicBackupDownloadUrl;
                const stamp = new Date(snapshot.snapshot_at).toLocaleString('sv-SE', {timeZone:'Asia/Taipei'}).replace(/[^0-9]/g,'');
                link.download = 'genblue_院內資料備份_' + tenant.replace(/[^A-Za-z0-9_-]/g,'_') + '_' + stamp + extension;
                link.hidden = false;
                showClinicBackupSummary(snapshot);showPrivateBackupSummaryV53(snapshot);
                progress.value = 100;
                status.style.color = '#059669';
                status.textContent = `備份檔已產生（${snapshot.table_count} 張表、${snapshot.total_rows.toLocaleString()} 筆、${(blob.size/1048576).toFixed(1)} MB），已開始下載。請確認下載完成，再用下方「檢查備份檔」核對。`;
                link.click();
            } catch (error) {
                progress.hidden = true;
                status.style.color = '#dc2626';
                status.textContent = '本次備份未完成：' + (controller.signal.aborted ? '已取消或等候逾時，請重新操作。' : (error.message || String(error)));
            } finally {
                clearTimeout(timer);
                clinicBackupBusy = false;
                button.disabled = false;
                if (clinicBackupController === controller) clinicBackupController = null;
            }
        }

        async function checkClinicBackupFile(event) {
            const file = event.target.files?.[0];
            const status = document.getElementById('clinicBackupCheckStatus');
            if (!file) return;
            if (CURRENT_PROFILE?.role !== 'admin' || !CURRENT_TENANT_ID) { status.textContent = '請先登入本院管理者帳號。'; return; }
            const tenant = CURRENT_TENANT_ID;
            status.style.color = '#475569'; status.textContent = '正在檢查備份檔…';
            try {
                if (file.size > 512*1048576) throw new Error('檔案超過此測試版可檢查的大小。');
                let stream = file.stream();
                if (/\.gz$/i.test(file.name)) {
                    if (typeof DecompressionStream === 'undefined') throw new Error('此瀏覽器無法讀取壓縮檔，請使用最新版 Chrome 或 Edge。');
                    stream = stream.pipeThrough(new DecompressionStream('gzip'));
                }
                const reader = stream.getReader(); const chunks = []; let length = 0;
                while (true) {
                    const {value,done} = await reader.read(); if (done) break;
                    length += value.byteLength;
                    if (length > 512*1048576) { await reader.cancel(); throw new Error('解壓後檔案過大。'); }
                    chunks.push(value);
                }
                const envelope = JSON.parse(await new Blob(chunks).text());
                if (envelope.format !== 'genblue-clinic-backup-file' || envelope.format_version !== 1 || typeof envelope.payload_json !== 'string') throw new Error('不是 genblue 的備份檔。');
                if (await clinicBackupSha256(envelope.payload_json) !== envelope.sha256) throw new Error('備份校驗碼不符，檔案可能不完整或已變更。');
                const snapshot = JSON.parse(envelope.payload_json); if(snapshot.format_version===3)throw new Error('含影像的備份請選擇完整 ZIP，不能只核對資料 JSON。');
                validateClinicBackupSnapshot(snapshot, tenant);
                if (tenant !== CURRENT_TENANT_ID || CURRENT_PROFILE?.role !== 'admin') throw new Error('登入狀態已改變，請重新檢查。');
                showClinicBackupSummary(snapshot);showPrivateBackupSummaryV53(snapshot);
                status.style.color = '#059669';
                status.textContent = `檔案檢查通過：${snapshot.table_count} 張表、${snapshot.total_rows.toLocaleString()} 筆，醫院代碼 ${snapshot.tenant_id}。這是完整性檢查；此份真實資料的隔離還原測試尚待完成。`;
            } catch (error) {
                status.style.color = '#dc2626'; status.textContent = '檔案檢查失敗：' + (error.message || String(error));
            } finally { event.target.value = ''; }
        }
        window.addEventListener('beforeunload', event=>{
            if (clinicBackupBusy) { event.preventDefault(); event.returnValue = ''; }
        });

        function calculateProductTotal() {
            let subtotal = 0;
            document.querySelectorAll('#productCheckoutItems .checkout-item-row').forEach(row => {
                const qty = row.querySelector('.qty-input').value;
                const price = row.querySelector('.price-input').value;
                if(qty && price) subtotal += (parseFloat(qty) * parseFloat(price));
            });
            let discount = parseFloat(document.getElementById('checkoutDiscount').value) || 0;
            let finalTotal = Math.max(0, subtotal - discount);
            document.getElementById('checkoutSubTotal').innerText = subtotal.toLocaleString();
            document.getElementById('checkoutTotalAmount').innerText = finalTotal.toLocaleString();
        }

        function addSearchedProductToCheckout() {
            const searchInput = document.getElementById('checkoutSearchProduct').value;
            if(!searchInput) return;
            let name = searchInput, price = "0", category = "一般商品";
            
            if (searchInput.includes("|")) { 
                const parts = searchInput.split("|"); 
                name = parts[0].trim(); 
                price = parts[1].trim(); 
                if (parts[2]) category = parts[2].trim();
            }

            const container = document.getElementById('productCheckoutItems');
            const div = document.createElement('div');
            div.className = 'list-row checkout-item-row';
            div.dataset.category = category;
            const selectedItem = Object.values(loadedItemsMap).find(item =>
                `${item.name} | ${item.sell_price} | ${item.category || '一般商品'}` === searchInput);
            if (!selectedItem) { alert('請從已建檔商品清單選取品項'); return; }
            div.dataset.stockId = selectedItem.id;
            div.innerHTML = `
                <input type="text" value="${name}" class="checkout-item-name" readonly style="flex:2;">
                <span style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold;" class="checkout-item-cat">${category}</span>
                <input type="number" value="1" class="qty-input" style="flex:0.6;" oninput="calculateProductTotal()">
                <input type="number" value="${price}" class="price-input" style="flex:0.8;" oninput="calculateProductTotal()">
                <button class="btn-danger" onclick="this.parentElement.remove(); calculateProductTotal();" style="padding: 9px 12px;">刪除</button>
            `;
            container.appendChild(div);
            document.getElementById('checkoutSearchProduct').value = '';
            calculateProductTotal();
        }

        function addEmptyCheckoutRow() {
            const container = document.getElementById('productCheckoutItems');
            const div = document.createElement('div');
            div.className = 'list-row checkout-item-row';
            div.dataset.category = '一般商品';
            div.innerHTML = `
                <input type="text" placeholder="商品名稱" class="checkout-item-name" style="flex:2;">
                <span style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold;" class="checkout-item-cat">一般商品</span>
                <input type="number" value="1" class="qty-input" style="flex:0.6;" oninput="calculateProductTotal()">
                <input type="number" placeholder="單價" class="price-input" style="flex:0.8;" oninput="calculateProductTotal()">
                <button class="btn-danger" onclick="this.parentElement.remove(); calculateProductTotal();" style="padding: 9px 12px;">刪除</button>
            `;
            container.appendChild(div);
        }

        async function processProductCheckoutDatabase() {
            const ownerId = document.getElementById('selectedCheckoutOwnerId').value;
            const petId = document.getElementById('checkoutPetSelect').value;
            const subtotal = parseFloat(document.getElementById('checkoutSubTotal').innerText.replace(/,/g, '')) || 0;
            const discount = parseFloat(document.getElementById('checkoutDiscount').value) || 0;
            const totalAmount = parseFloat(document.getElementById('checkoutTotalAmount').innerText.replace(/,/g, '')) || 0;
            
            let primaryCategory = '一般商品';
            const firstRow = document.querySelector('#productCheckoutItems .checkout-item-row');
            if (firstRow && firstRow.dataset.category) {
                primaryCategory = firstRow.dataset.category;
            }

            if (subtotal === 0) { 
                alert('購物車無商品！'); 
                return; 
            }

            let itemRows = document.querySelectorAll('#productCheckoutItems .checkout-item-row');
            if (itemRows.length === 0) {
                itemRows = document.querySelectorAll('#productCheckoutItems .list-row');
            }

            if (itemRows.length === 0) {
                alert('購物車中沒有品項可結帳！');
                return;
            }

            const { data: invData, error: invError } = await _supabase.from('invoices').insert([{
                tenant_id: CURRENT_TENANT_ID, 
                owner_id: ownerId ? ownerId : null, 
                pet_id: petId ? petId : null,
                checkout_type: '商品零售', 
                category: primaryCategory,
                subtotal: subtotal, 
                discount: discount, 
                total_amount: totalAmount
            }]).select();

            if (invError || !invData || invData.length === 0) {
                alert('商品結帳寫入失敗：' + (invError ? invError.message : '未知錯誤'));
                return;
            }

            const newInvoiceId = invData[0].id;

            for (let row of itemRows) {
                const itemNameEl = row.querySelector('.checkout-item-name') || row.querySelector('input[type="text"]');
                const qtyEl = row.querySelector('.qty-input') || row.querySelector('input[type="number"]');
                const priceEl = row.querySelector('.price-input') || row.querySelectorAll('input[type="number"]')[1];

                if (itemNameEl && itemNameEl.value.trim() !== "") {
                    const q = parseInt(qtyEl ? qtyEl.value : 1) || 1;
                    const p = parseFloat(priceEl ? priceEl.value : 0) || 0;
                    await _supabase.from('invoice_items').insert([{
                        invoice_id: newInvoiceId,
                        item_name: itemNameEl.value.trim(),
                        quantity: q,
                        unit_price: p,
                        subtotal: q * p
                    }]);
                }
            }

            alert('商品結帳成功，且所有明細已順利儲存至 Supabase！');
            document.getElementById('productCheckoutItems').innerHTML = '';
            document.getElementById('checkoutOwnerSearch').value = '';
            document.getElementById('selectedCheckoutOwnerId').value = '';
            document.getElementById('checkoutPetSelect').innerHTML = '<option value="">-- 請選擇飼主或不指定寵物 --</option>';
            calculateProductTotal();
            switchTab('search_center');
            switchSearchSubTab('sales_history');
        }

        function calculateInvoiceTotal() {
            let subtotal = 0;
            document.querySelectorAll('#invoiceItemsList .list-row').forEach(row => {
                const qty = parseFloat(row.querySelector('.invoice-qty').value) || 1;
                const price = parseFloat(row.querySelector('.invoice-price').value) || 0;
                subtotal += (qty * price);
            });
            let discount = parseFloat(document.getElementById('invoiceDiscount').value) || 0;
            let finalTotal = Math.max(0, subtotal - discount);
            document.getElementById('invoiceSubTotal').innerText = subtotal.toLocaleString();
            document.getElementById('invoiceTotalAmount').innerText = finalTotal.toLocaleString();
        }

        function addInvoiceRow() {
            const container = document.getElementById('invoiceItemsList');
            const div = document.createElement('div');
            div.className = 'list-row';
            div.innerHTML = `<input type="text" placeholder="項目名稱" class="invoice-name"><input type="number" value="1" placeholder="數量" class="invoice-qty" style="flex: 0.5;" oninput="calculateInvoiceTotal()"><input type="number" placeholder="金額" class="invoice-price" oninput="calculateInvoiceTotal()"><button class="btn-danger" onclick="this.parentElement.remove(); calculateInvoiceTotal();" style="padding: 9px 12px;">刪除</button>`;
            container.appendChild(div);
        }

        function applyInvoicePackage(packageName, itemsArray) {
            if(clinicalMedicationGroupsV64){alert('本次有處方藥費，請逐列調整其他費用，或回門診修改處方。');return;}
            const invoiceListContainer = document.getElementById('invoiceItemsList');
            invoiceListContainer.innerHTML = '';
            clinicalMedicationGroupsV64=null;

            itemsArray.forEach(it => {
                let div = document.createElement('div');
                div.className = 'list-row';
                div.innerHTML = `
                    <input type="text" value="${it.name}" placeholder="項目名稱" class="invoice-name">
                    <input type="number" value="${it.qty}" placeholder="數量" class="invoice-qty" style="flex: 0.5;" oninput="calculateInvoiceTotal()">
                    <input type="number" value="${it.price}" placeholder="金額" class="invoice-price" oninput="calculateInvoiceTotal()">
                    <button class="btn-danger" onclick="this.parentElement.remove(); calculateInvoiceTotal();" style="padding: 9px 12px;">刪除</button>
                `;
                invoiceListContainer.appendChild(div);
            });
            calculateInvoiceTotal();
            alert(`已成功套用「${packageName}」醫療套餐組合！`);
        }

        processInvoiceCheckoutToArchive
        async function startConsultationById(petId, chipId, petNameStr, ownerId, weight, ownerName, birthday, gender, species, breed) {
            currentPetId = petId;
            medicalWeightConfirmedV9121=null;medicalVitalsDraftV9132=null;
            setMedicalWeightStatus('');
            resetCurrentPetClinicalHistories();
            const vaccinePanel=document.getElementById('medicalVaccineHistoryPanel');if(vaccinePanel)vaccinePanel.open=false;
            const vaccineBox=document.getElementById('medicalVaccineHistoryContent');if(vaccineBox)vaccineBox.textContent='展開後查詢此寵物疫苗紀錄。';
            resetLegacyMedicalArchive();
            currentPetMicrochip = chipId;
            currentPetName = petNameStr;
            currentOwnerId = ownerId || "";
            currentPetWeight = roundPetWeight(allPetsListForDropdown.find(p=>p.id===petId)?.weight ?? weight) || 0;
            currentPetBirthday = birthday || "";
            currentPetGender = gender || "";
            currentPetSpecies = species || "貓";
            currentPetBreed = breed || "";

            let targetPet = activeAppointmentsList.find(p => p.id === petId);
            if (targetPet) {
                targetPet.status = '診間看診中';
                renderAppointmentTable(activeAppointmentsList);
            }

            medicalStateCache = { chiefComplaint: "", temperature: "", weight: currentPetWeight, prescriptions: [] };
            resetPrescriptionSharedSettingsForVisit();

            document.getElementById('medicalPetNameInfo').value = `${petNameStr} ${chipId ? '(晶片: ' + chipId + ')' : ''}`;
            document.getElementById('medicalPetWeightInput').value = currentPetWeight;
            document.getElementById('medicalDiagnosis').value = "";
            document.getElementById('medicalTemperatureInput').value = "";
            loadLastTemperatureMeasurement();
            document.getElementById('prescriptionItemsContainer').innerHTML = "";
            
            updateMedicalPetProfileCard();

            switchTab('medical');
            await loadAllMedicalRecords(petId);
            renderClinicalServiceCharges();
        }

        function updateMedicalPetProfileCard() {
            updateJournalMedicalAvatar();
            document.getElementById('cardPetName').innerText = currentPetName || '-';
            document.getElementById('cardPetChip').innerText = currentPetMicrochip || '無晶片';
            document.getElementById('cardPetAge').innerText = calculateAge(currentPetBirthday);
            document.getElementById('cardPetGender').innerText = currentPetGender || '未填寫';
            document.getElementById('cardPetBreed').innerText = `${currentPetSpecies} / ${currentPetBreed || '未填品種'}`;
        }

        async function admitCurrentPetToHospital() {
            if (!currentPetId) { alert('尚未指定看診寵物！'); return; }
            const reason = prompt('請輸入住院原因與觀察重點：', document.getElementById('medicalDiagnosis').value || '留院觀察');
            if (reason === null) return;
            const dailyRate = parseFloat(prompt('請設定每日住院基本費 (NT$)：', '500')) || 500;

            const { error } = await _supabase.from('inpatients').insert([{
                tenant_id: CURRENT_TENANT_ID,
                pet_id: currentPetId,
                reason: reason,
                daily_rate: dailyRate,
                status: '住院中',
                care_notes: '初次入住病房 (體溫: 38.5°C | 食慾良好)'
            }]);

            if (error) {
                alert('轉入住院失敗：' + error.message);
                return;
            }

            activeAppointmentsList = activeAppointmentsList.filter(p => p.id !== currentPetId);
            renderAppointmentTable(activeAppointmentsList);

            alert(`成功將「${currentPetName}」轉入住院病房區！已自動退出現場看診畫面。`);
            
            clearMedicalFormInputs();
            currentPetId = ""; currentOwnerId = "";
            switchTab('appointments');
        }

        async function loadInpatientsList() {
            const { data, error } = await _supabase
                .from('inpatients')
                .select('*, pets(*, owners(id, name, mobile, owner_code))')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .eq('status', '住院中')
                .order('admission_date', { ascending: false });

            if (error || !data) {
                allInpatientsCache = [];
            } else {
                allInpatientsCache = data;
            }
            filterInpatientsTable();
            if (error) {
                const tbody = document.getElementById('inpatientsTableBody');
                tbody.innerHTML = '';
                const row = tbody.insertRow();
                const cell = row.insertCell();
                cell.colSpan = 6;
                cell.style.color = '#dc2626';
                cell.textContent = '無法載入住院病患：' + error.message;
            }
        }

        function filterInpatientsTable() {
            const keyword = document.getElementById('inpatientsTableSearch').value.trim().toLowerCase();
            const filtered = keyword ? allInpatientsCache.filter(item => {
                const pet = item.pets || {};
                const owner = pet.owners || {};
                return [pet.name, pet.microchip, owner.name, owner.mobile, item.reason]
                    .some(value => String(value || '').toLowerCase().includes(keyword));
            }) : allInpatientsCache;
            renderInpatientsTable(filtered);
        }

        function renderInpatientsTable(dataList) {
            const tbody = document.getElementById('inpatientsTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">目前尚無任何住院中病患</td></tr>`;
                return;
            }

            dataList.forEach(item => {
                const pet = item.pets || {};
                const owner = pet.owners || {};
                const ownerCodeStr = owner.owner_code ? `[${owner.owner_code}] ` : '';
                const ownerStr = owner.name ? `${ownerCodeStr}${owner.name} (${owner.mobile || '無電話'})` : '未知飼主';

                const admissionDate = new Date(item.admission_date);
                const now = new Date();
                const diffTime = Math.abs(now - admissionDate);
                const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); 
                const estimatedTotal = diffDays * (parseFloat(item.daily_rate) || 500);

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${pet.name || '未知寵物'}</b> <small style="color:#64748b;">${pet.microchip ? '[' + pet.microchip + ']' : ''}</small><br><small>飼主: ${ownerStr}</small></td>
                    <td>${admissionDate.toLocaleString()}<br><small style="color:#0284c7; font-weight:bold;">已住院約 ${diffDays} 天</small></td>
                    <td>${item.reason || '未填寫原因'}</td>
                    <td>NT$ ${item.daily_rate || 500} / 天<br><small style="color:#dc2626; font-weight:bold;">預估基本費: NT$ ${estimatedTotal}</small></td>
                    <td>
                        <textarea id="note_${item.id}" rows="3" style="margin-bottom: 6px; padding: 6px 10px; font-size: 0.85rem; width: 100%; resize: vertical;" placeholder="輸入每日護理日誌 (例: 體溫 38.6°C, 食慾 80%, 排便正常, 輸液 20ml/h)...">${item.care_notes || ''}</textarea>
                        <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="updateInpatientNote('${item.id}')">更新護理日誌</button>
                    </td>
                    <td>
                        <button class="btn-success" style="padding: 6px 12px; font-size: 0.85rem;" onclick="dischargeInpatientToCheckout('${item.id}', '${pet.id}', '${pet.name}', '${owner.id}', ${estimatedTotal}, '${item.reason || '住院費'}', ${diffDays}, ${item.daily_rate || 500})">🏥 辦理出院並轉回結帳</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function updateInpatientNote(inpatientId) {
            const newNote = document.getElementById(`note_${inpatientId}`).value;
            const { error } = await _supabase.from('inpatients').update({ care_notes: newNote }).eq('id', inpatientId);
            if (error) {
                alert('更新失敗：' + error.message);
            } else {
                alert('住院護理日誌已成功更新！');
                loadInpatientsList();
            }
        }

        async function dischargeInpatientToCheckout(inpatientId, petId, petName, ownerId, estimatedTotal, reason, days, dailyRate) {
            if (!confirm(`確定要為「${petName}」辦理出院嗎？系統將自動把住院費用帶入收費結帳頁面。`)) return;

            clinicalInvoiceContext={tenantId:CURRENT_TENANT_ID,petId,petName,ownerId,appointmentId:null};
            await _supabase.from('inpatients').update({
                status: '已出院',
                discharge_date: new Date().toISOString()
            }).eq('id', inpatientId);

            if (ownerId) {
                document.getElementById('invoiceOwnerSelect').value = ownerId;
            }

            const invoiceListContainer = document.getElementById('invoiceItemsList');
            invoiceListContainer.innerHTML = '';
            clinicalMedicationGroupsV64=null;

            let div = document.createElement('div');
            div.className = 'list-row';
            div.innerHTML = `
                <input type="text" value="住院照護費 (${reason} - 共 ${days} 天，每日 NT$ ${dailyRate})" placeholder="項目名稱" class="invoice-name">
                <input type="number" value="${days}" placeholder="數量" class="invoice-qty" style="flex: 0.5;" oninput="calculateInvoiceTotal()">
                <input type="number" value="${dailyRate}" placeholder="金額" class="invoice-price" oninput="calculateInvoiceTotal()">
                <button class="btn-danger" onclick="this.parentElement.remove(); calculateInvoiceTotal();" style="padding: 9px 12px;">刪除</button>
            `;
            invoiceListContainer.appendChild(div);
            calculateInvoiceTotal();

            alert('已成功辦理出院！請在收費與付款頁面確認金額後完成結帳歸檔。');
            switchTab('invoices');
            loadInpatientsList();
        }

        function directCheckoutFromAppointment(petId, ownerId) {
            const sourceAppointment = activeAppointmentsList.find(p => p.id === petId && p.appointment_id);
            currentAppointmentId = sourceAppointment?.appointment_id || null;
            currentPetId = petId || currentPetId;
            resetLegacyMedicalArchive();
            if (sourceAppointment?.name) currentPetName = sourceAppointment.name;

            activeAppointmentsList = activeAppointmentsList.filter(p => p.id !== petId);
            renderAppointmentTable(activeAppointmentsList);

            if (ownerId) {
                document.getElementById('invoiceOwnerSelect').value = ownerId;
            }

            const invoiceListContainer = document.getElementById('invoiceItemsList');
            invoiceListContainer.innerHTML = '';
            clinicalMedicationGroupsV64=null;

            let diagnosticDiv = document.createElement('div');
            diagnosticDiv.className = 'list-row';
            diagnosticDiv.innerHTML = `
                <input type="text" value="一般門診診察費" placeholder="項目名稱" class="invoice-name">
                <input type="number" value="1" placeholder="數量" class="invoice-qty" style="flex: 0.5;" oninput="calculateInvoiceTotal()">
                <input type="number" value="250" placeholder="金額" class="invoice-price" oninput="calculateInvoiceTotal()">
                <button class="btn-danger" onclick="this.parentElement.remove(); calculateInvoiceTotal();" style="padding: 9px 12px;">刪除</button>
            `;
            invoiceListContainer.appendChild(diagnosticDiv);
            attachServiceChargesToInvoice(petId);
            calculateInvoiceTotal();

            alert('已將病患從候診列表移除，並為您跳轉至收費與付款頁面進行結帳歸檔！');
            switchTab('invoices');
        }

        function goToVaccinesFromMedical() {
            if (!currentPetId) { alert('請先選擇看診寵物！'); return; }
            collectCurrentMedicalState();
            switchTab('vaccines');
            const vacSearchInput = document.getElementById('vacPetSearchInput');
            const hiddenVacPetId = document.getElementById('selectedVacPetId');
            if (vacSearchInput && hiddenVacPetId) {
                const matchedPetOption = allPetsListForDropdown.find(p => p.id === currentPetId);
                if (matchedPetOption) {
                    const codeStr = matchedPetOption.owner_code ? `[編號:${matchedPetOption.owner_code}] ` : '';
                    vacSearchInput.value = `${matchedPetOption.name} (${codeStr}飼主: ${matchedPetOption.owner_name} / 晶片: ${matchedPetOption.microchip || '無'})`;
                    hiddenVacPetId.value = currentPetId;
                }
            }
        }

        function backToMedicalFromVaccine() {
            if (!currentPetId) { switchTab('appointments'); return; }
            switchTab('medical');
            restoreMedicalState();
        }

        function goToLabManagerFromMedical() {
            if (!currentPetId) { alert('請先選擇看診寵物！'); return; }
            collectCurrentMedicalState();
            switchTab('lab_manager');
            const labSearchInput = document.getElementById('labPetSearchInput');
            const hiddenLabPetId = document.getElementById('selectedLabPetId');
            if (labSearchInput && hiddenLabPetId) {
                const matchedPetOption = allPetsListForDropdown.find(p => p.id === currentPetId);
                if (matchedPetOption) {
                    const codeStr = matchedPetOption.owner_code ? `[編號:${matchedPetOption.owner_code}] ` : '';
                    const selectedOption=[...document.getElementById('labPetDatalist').options].find(o=>o.dataset.petId===currentPetId);
                    labSearchInput.value=selectedOption?.value||`${matchedPetOption.name} (${codeStr}飼主: ${matchedPetOption.owner_name} / 晶片: ${matchedPetOption.microchip || '無'})`;
                    hiddenLabPetId.value = currentPetId;
                    onLabPetSelectedForTrend(currentPetId);
                }else{labSearchInput.value=currentPetName;hiddenLabPetId.value=currentPetId;void onLabPetSelectedForTrend(currentPetId);}
            }
        }

        let labSelectionRequestV9116=0;
        async function onLabPetSelectedForTrend(explicitPetId=null) {
            const input=document.getElementById('labPetSearchInput'),options=[...document.getElementById('labPetDatalist').querySelectorAll('option')];
            const option=options.find(o=>o.value===input.value);
            const foundId=typeof explicitPetId==='string'?explicitPetId:option?.dataset.petId||'';
            const tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id,request=++labSelectionRequestV9116;
            document.getElementById('selectedLabPetId').value=foundId;
            const valid=()=>request===labSelectionRequestV9116&&tenant===CURRENT_TENANT_ID&&user===CURRENT_USER?.id&&document.getElementById('selectedLabPetId').value===foundId;
            if(foundId&&!getSelectedLabSpecies()){
                try{
                    const {data,error}=await _supabase.from('pets').select('id,name,species').eq('tenant_id',tenant).eq('id',foundId).single();
                    if(!valid())return;if(error)throw error;if(!data||data.id!==foundId)throw Error('無法確認寵物資料');
                    const cached=allPetsListForDropdown.find(p=>p.id===foundId);if(cached)cached.species=data.species;else allPetsListForDropdown.push(data);
                }catch(error){if(valid()){renderLabSpeciesTemplates();document.getElementById('cbcLabRows').textContent='寵物物種讀取失敗，請重新選取寵物重試：'+error.message;document.getElementById('bioLabRows').textContent='寵物物種讀取失敗，請重新選取寵物重試。';renderedLabPatientKey='';}return;}
            }
            if(!valid())return;
            renderLabSpeciesTemplates();

            const trendContainer = document.getElementById('petLabTrendContainer');
            const trendContent = document.getElementById('petLabTrendContent');

            if (!foundId) {
                trendContainer.style.display = 'none';
                return;
            }

            const petReports = allLabReportsCache.filter(r => r.pet_id === foundId);
            if (petReports.length === 0) {
                trendContainer.style.display = 'block';
                trendContent.innerHTML = '此寵物尚無過往歷史檢驗紀錄。';
                return;
            }

            let html = '';
            petReports.slice(0, 3).forEach((rep, idx) => {
                let sum = '';
                if (rep.report_data) {
                    for (let k in rep.report_data) {
                        if (!k.startsWith('_') && rep.report_data[k]) sum += `${k.toUpperCase()}:${rep.report_data[k]} | `;
                    }
                }
                html += `<div>🕒 ${new Date(rep.created_at).toLocaleDateString()} [${rep.test_type}]：${sum}</div>`;
            });

            trendContainer.style.display = 'block';
            trendContent.innerHTML = html;
        }

        function checkLabInputRange(inputEl, minVal, maxVal) {
            const val = parseFloat(inputEl.value);
            if (isNaN(val)) {
                inputEl.style.background = '#fff';
                inputEl.style.color = '#334155';
                return;
            }
            if (val < minVal || val > maxVal) {
                inputEl.style.background = '#fee2e2';
                inputEl.style.color = '#dc2626';
                inputEl.style.fontWeight = 'bold';
            } else {
                inputEl.style.background = '#f0fdf4';
                inputEl.style.color = '#166534';
                inputEl.style.fontWeight = 'bold';
            }
        }

        function backToMedicalFromLab() {
            if (!currentPetId) { switchTab('appointments'); return; }
            switchTab('medical');
            restoreMedicalState();
        }

        function goToRapidTestsFromMedical() {
            if (!currentPetId) { alert('請先選擇看診寵物！'); return; }
            collectCurrentMedicalState();
            switchTab('rapid_tests');
            const rapidSearchInput = document.getElementById('rapidPetSearchInput');
            const hiddenRapidPetId = document.getElementById('selectedRapidPetId');
            if (rapidSearchInput && hiddenRapidPetId) {
                const matchedPetOption = allPetsListForDropdown.find(p => p.id === currentPetId);
                if (matchedPetOption) {
                    const codeStr = matchedPetOption.owner_code ? `[編號:${matchedPetOption.owner_code}] ` : '';
                    rapidSearchInput.value = `${matchedPetOption.name} (${codeStr}飼主: ${matchedPetOption.owner_name} / 晶片: ${matchedPetOption.microchip || '無'})`;
                    hiddenRapidPetId.value = currentPetId;
                }
            }
            updateRapidItemsForPet();
        }

        function clearRapidFormInputs() {
            const rapidSearchInput = document.getElementById('rapidPetSearchInput');
            const hiddenRapidPetId = document.getElementById('selectedRapidPetId');
            const rapidTestItem = document.getElementById('rapidTestItem');
            const rapidTestBatch = document.getElementById('rapidTestBatch');
            const rapidTestNotes = document.getElementById('rapidTestNotes');
            const rapidSubResultsList = document.getElementById('rapidSubResultsList');

            if (rapidSearchInput) rapidSearchInput.value = '';
            if (hiddenRapidPetId) hiddenRapidPetId.value = '';
            if (rapidTestItem) rapidTestItem.value = '';
            if (rapidTestBatch) rapidTestBatch.value = '';
            if (rapidTestNotes) rapidTestNotes.value = '';
            if (rapidSubResultsList) rapidSubResultsList.innerHTML = '<span style="color: #64748b;">請先選擇快篩項目...</span>';
            updateRapidItemsForPet();
        }

        function backToMedicalFromRapid() {
            clearRapidFormInputs();
            if (!currentPetId) { switchTab('appointments'); return; }
            switchTab('medical');
            restoreMedicalState();
        }

        function collectCurrentMedicalState() {
            const chiefComplaint = document.getElementById('medicalDiagnosis').value;
            const weight = roundPetWeight(document.getElementById('medicalPetWeightInput').value) || 0;
            
            const prescriptions = collectPrescriptionDetailsV75();

            const temperature = document.getElementById('medicalTemperatureInput').value;
            medicalStateCache = { chiefComplaint, temperature, weight, prescriptions };
        }

        function restoreMedicalState() {
            if (currentPetId) {
                document.getElementById('medicalPetNameInfo').value = `${currentPetName} ${currentPetMicrochip ? '(晶片: ' + currentPetMicrochip + ')' : ''}`;
                updateMedicalPetProfileCard();
            }
            document.getElementById('medicalPetWeightInput').value = roundPetWeight(medicalStateCache.weight ?? currentPetWeight) ?? 0;
            document.getElementById('medicalDiagnosis').value = medicalStateCache.chiefComplaint || "";
            document.getElementById('medicalTemperatureInput').value = medicalStateCache.temperature ?? "";
            renderClinicalServiceCharges();

            const container = document.getElementById('prescriptionItemsContainer');
            container.innerHTML = "";
            if (medicalStateCache.prescriptions && medicalStateCache.prescriptions.length > 0) {
                medicalStateCache.prescriptions.forEach(p => {
                    container.appendChild(makePrescriptionDraftRowV65(p));
                });
            }
        }

        function onWeightChanged() {
            markMedicalWeightDraft();
            currentPetWeight = roundPetWeight(document.getElementById('medicalPetWeightInput').value) || 0;
            medicalStateCache.weight = currentPetWeight;
            runDetailedMathCalculation();
        }

        let preservePrescriptionRouteForVisit=false;
let injectionEntryModeV70=false,oralEntrySettingsV70=null;
function syncInjectionEntryV70(route){
 const injection=route?.kind==='injection';
 const frequency=document.getElementById('medFrequencyDetail'),days=document.getElementById('medDays'),note=document.getElementById('medPrescribeNote');
 if(injection&&!injectionEntryModeV70)oralEntrySettingsV70={frequency:frequency.value,days:days.value,note:note.value};
 if(injection){frequency.value='1';days.value='1';note.value='';}
 else if(injectionEntryModeV70&&oralEntrySettingsV70){frequency.value=oralEntrySettingsV70.frequency;days.value=oralEntrySettingsV70.days;note.value=oralEntrySettingsV70.note;}
 injectionEntryModeV70=injection;
 for(const control of [frequency,days,note]){
  control.disabled=injection;
  control.classList.toggle('injection-inactive-v70',injection);
  if(injection)control.title='院內針劑按單次用量計算，不使用口服療程設定';else control.removeAttribute('title');
 }
}
        function resetPrescriptionSharedSettingsForVisit(){
            preservePrescriptionRouteForVisit=false;
            injectionEntryModeV70=false;oralEntrySettingsV70=null;syncInjectionEntryV70(null);
            document.getElementById('medRouteDetailSelect').value='';
            document.getElementById('labelRecDoseTitle').innerText='建議劑量 (mg/kg)';
            document.getElementById('medFrequencyDetail').value='2';
            document.getElementById('medDays').value='5';
            document.getElementById('medPrescribeNote').value='一天兩次，連續5天，飯後服用';
        }

        function setCalculatedPrescriptionTotal(total,unit,prefix='建議總需') {
            const result=document.getElementById('calculatedDoseResult'),qty=document.getElementById('medPrescribeQty');
            if(!Number.isFinite(total)||total<0){result.value='請檢查計算欄位';qty.value='';return;}
            const rounded=Math.round((total+Number.EPSILON*Math.max(1,Math.abs(total)))*10)/10;
            if(total>0&&rounded===0){result.value='總量少於 0.1 '+unit+'，請手動確認開立數量';qty.value='';return;}
            result.value=prefix+' '+rounded.toFixed(1)+' '+unit;qty.value=String(rounded);
        }
function medicineStrengthPerUnitV68(med){
 const text=String(med?.usage_dose||med?.strength||'').normalize('NFKC').trim();
 if(!text||/\b(?:ml|dl|l|kg)\b|毫升|公升|公斤|%/i.test(text))return null;
 const pattern=/(\d+(?:\.\d+)?|\.\d+)\s*(mg|mcg|μg|ug|g|毫克|微克|公克)(?![a-z])/gi;
 const hits=[...text.matchAll(pattern)];if(hits.length!==1||/-\s*\d|\d\s*[,，]\s*\d/.test(text))return null;
 const hit=hits[0],tail=text.slice(hit.index+hit[0].length).trim();
 if(tail&&!/^(?:\/\s*(?:1\s*)?(?:顆|錠|粒|膠囊|tablet|tab|capsule|cap)|每(?:顆|錠|粒|膠囊))$/i.test(tail))return null;
 const before=text.slice(0,hit.index).trim();if(before&&!/^(?:每(?:顆|錠|粒|膠囊)(?:含)?|含量[:：]?)$/.test(before))return null;
 const mass=Number(hit[1]),unit=hit[2].toLowerCase(),factor=['g','公克'].includes(unit)?1000:['mcg','μg','ug','微克'].includes(unit)?.001:1;
 return mass>0&&Number.isFinite(mass)?mass*factor:null;
}
function inferredMedicineRouteV68(med){return simpleRouteV944(String(med?.route||'').trim());}
function prescriptionCalculationRouteV68(){
 const actual=prescriptionRouteV66();if(actual)return actual;
 const med=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];
 const solid=/(顆|錠|粒|膠囊|tablet|capsule)/i.test(String(med?.unit||'')+' '+String(med?.dosage_form||'')+' '+String(med?.usage_dose||''));
 if(/^(口服|oral)$/i.test(String(med?.route||'').trim())&&solid&&medicineStrengthPerUnitV68(med))return {calc:'tablet',preview:true};
 return null;
}
function onRouteDetailChanged(){
 const route=prescriptionCalculationRouteV68();
 syncInjectionEntryV70(route);
 syncPrescriptionDoseUnitV91(route);
 const label=document.getElementById('prescribeQuantityLabelV69');if(label)label.textContent=route?.preparedFromSolid?'原藥開立顆數（扣庫存用）':'實際開立數量';
 document.getElementById('labelRecDoseTitle').textContent=route?.calc==='tablet'?'建議劑量 (mg/kg)':route?.calc==='ratio'?'使用劑量（依所選單位換算 ml）':'使用劑量（手動輸入，含單位）';
 runDetailedMathCalculation();
}
function onMedicineSelectedForDoseCalculation(){
 const selectedMedId=document.getElementById('medSelectDropdown').value,med=loadedMedicinesMap[selectedMedId];
 const display=document.getElementById('medUseDoseDisplay'),select=document.getElementById('medRouteDetailSelect');
 if(!med){display.value='';document.getElementById('calculatedDoseResult').value='請先選藥品';document.getElementById('medPrescribeQty').value='';return;}
 display.value=med.usage_dose||med.strength||'';
 if(!preservePrescriptionRouteForVisit)select.value=inferredMedicineRouteV68(med);
 let defaultVal=10;const match=String(med.recommended_dose||'').match(/(?:\d+(?:\.\d+)?|\.\d+)/);if(match)defaultVal=Number(match[0]);
 document.getElementById('medCustomRecDose').value=defaultVal;
 onRouteDetailChanged();
}
let prescriptionMathRequest=0,prescriptionMathTimer=null,prescriptionMathPending=false;
function prescriptionMathSnapshot(){
 const med=loadedMedicinesMap[document.getElementById('medSelectDropdown').value],route=prescriptionCalculationRouteV68();
 return {medicine_id:med?.id||document.getElementById('medSelectDropdown').value,route:route?.name||'口服藥',dose:document.getElementById('medCustomRecDose').value,weight:String(currentPetWeight||''),frequency:document.getElementById('medFrequencyDetail').value,days:document.getElementById('medDays').value,unit:document.getElementById('prescriptionDoseUnitV91')?.value||''};
}
function runDetailedMathCalculation(){
 const request=++prescriptionMathRequest;clearTimeout(prescriptionMathTimer);prescriptionMathPending=false;
 const result=document.getElementById('calculatedDoseResult'),qty=document.getElementById('medPrescribeQty');
 const stop=text=>{result.value=text;qty.value='';};
 const med=loadedMedicinesMap[document.getElementById('medSelectDropdown').value];if(!med){stop('請先選藥品');return;}
 const route=prescriptionCalculationRouteV68();if(!route||route.calc==='manual'){stop(route?'此方式請手動填寫實際開立數量':'請先選給藥方式');return;}
 const payload=prescriptionMathSnapshot(),snapshot=JSON.stringify(payload),pet=currentPetId,tenant=CURRENT_TENANT_ID;
 prescriptionMathPending=true;stop('換算中…');
 prescriptionMathTimer=setTimeout(async()=>{
  const current=()=>request===prescriptionMathRequest&&pet===currentPetId&&tenant===CURRENT_TENANT_ID&&snapshot===JSON.stringify(prescriptionMathSnapshot());
  try{
   const {data:{session},error}=await _supabase.auth.getSession();if(!current())return;
   if(error||!session?.access_token)throw Error('登入已失效，請重新登入後換算');
   const response=await fetch('/api/prescription/calculate/',{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(!current())return;const data=await response.json();if(!current())return;
   if(!response.ok)throw Error(data.error||'換算失敗，請核對輸入');
   if(typeof data.quantity!=='string'||typeof data.display!=='string')throw Error('換算結果格式不正確，請重新換算');
   qty.value=data.quantity;result.value=data.display;if(route.calc==='ratio')qty.step='any';
   if(route.preview&&qty.value)result.value+='（加入前請選給藥方式）';
   if(route.preparedFromSolid&&qty.value)result.value+='（原藥顆數，配藥方式依本組指示）';
  }catch(error){if(current())stop(error.message||'無法連線換算，請重新換算');}
  finally{if(request===prescriptionMathRequest)prescriptionMathPending=false;}
 },180);
}

        function resetPrescriptionEntryAfterAdd() {
            const search = document.getElementById('prescriptionMedicineSearch');
            search.value = '';
            document.getElementById('medSelectDropdown').replaceChildren(new Option('-- 尚未選擇藥品 --', ''));
            const results = document.getElementById('prescriptionMedicineResults');
            results.replaceChildren();
            results.style.display = 'none';
            ['medUseDoseDisplay', 'medCustomRecDose', 'calculatedDoseResult'].forEach(id => {
                document.getElementById(id).value = '';
            });
            preservePrescriptionRouteForVisit=true;
            document.getElementById('medPrescribeQty').value = '1';
            search.focus();
        }

        function addDetailedPrescriptionItem() {
            if(prescriptionMathPending){alert('數量正在換算，請稍候再加入。');return;}
            const dropdown = document.getElementById('medSelectDropdown');
            const selectedOpt = dropdown.options[dropdown.selectedIndex];
            if(!selectedOpt || !selectedOpt.value) { alert('請選擇專區藥品！'); return; }
            
            const medName = selectedOpt.dataset.name || selectedOpt.text;
            const routeDetail = document.getElementById('medRouteDetailSelect').value;
            const route=prescriptionRouteV66();if(!route){alert('請選擇實際給藥方式。');return;}
            const doseText=document.getElementById('medCustomRecDose').value.trim();if(!doseText){alert('請填寫使用劑量。');return;}
            const customDose = formatPrescriptionDoseV763(doseText,route);
            if(!customDose || /^(?:\d+(?:\.\d+)?|\.\d+)\s*(?:單位)?$/.test(customDose)){alert("請選擇劑量單位，或輸入完整劑量，例如 0.1 ml/kg。");return;}
            const qty = document.getElementById('medPrescribeQty').value;
            if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) { alert('實際開立數量須大於零'); return; }
            const note = route.kind==='injection'?'':document.getElementById('medPrescribeNote').value || '';

            const badgeColor = routeDetail.includes('注射') ? '#b45309' : '#0369a1';

            const container = document.getElementById('prescriptionItemsContainer');
            const div=makePrescriptionDraftRowV65({medicine_id:selectedOpt.value,medicine_name:'['+routeDetail+'] '+medName,custom_dose:customDose,quantity:qty,instruction:note,billing_kind:route.kind});
            container.appendChild(div);
            resetPrescriptionEntryAfterAdd();
        }

        // 舊病歷按需查閱；切換寵物後作廢先前的讀取結果。
        let legacyArchiveRequest = 0;
        let legacyArchiveLoaded = false;
        let legacyArchiveLoading = false;

        function resetLegacyMedicalArchive() {
            closePrescriptionCopyV65();
            document.getElementById('prescriptionCopyFeedbackV65').textContent='';
            resetCurrentPetClinicalHistories();
            legacyArchiveRequest++;
            legacyArchiveLoaded = false;
            legacyArchiveLoading = false;
            document.getElementById('legacyMedicalArchive').open = false;
            document.getElementById('legacyMedicalArchiveContent').replaceChildren();
            document.getElementById('legacyMedicalArchiveRetry').hidden = true;
            document.getElementById('legacyMedicalArchiveStatus').textContent = currentPetId
                ? '展開後載入此寵物的舊系統病歷。' : '請先選擇看診寵物。';
        }

        function toggleLegacyMedicalArchive() {
            if (document.getElementById('legacyMedicalArchive').open && !legacyArchiveLoaded && !legacyArchiveLoading) {
                loadLegacyMedicalArchive();
            }
        }

        async function loadLegacyMedicalArchive() {
            if (legacyArchiveLoading) return;
            const status = document.getElementById('legacyMedicalArchiveStatus');
            const content = document.getElementById('legacyMedicalArchiveContent');
            const retry = document.getElementById('legacyMedicalArchiveRetry');
            const petId = currentPetId;
            const tenantId = CURRENT_TENANT_ID;
            const petName = currentPetName || '此寵物';
            if (!petId || !tenantId) {
                status.textContent = '請先登入並選擇看診寵物。';
                content.replaceChildren();
                return;
            }
            const request = ++legacyArchiveRequest;
            legacyArchiveLoading = true;
            legacyArchiveLoaded = false;
            retry.hidden = true;
            content.replaceChildren();
            status.textContent = '正在載入「' + petName + '」的舊系統病歷…';
            try {
                const { data, error } = await _supabase.from('legacy_medical_histories')
                    .select('source_pet_no,medical_text,treatment_text,med_note,hospitalization_text')
                    .eq('tenant_id', tenantId).eq('pet_id', petId).maybeSingle();
                if (request !== legacyArchiveRequest || petId !== currentPetId || tenantId !== CURRENT_TENANT_ID) return;
                if (error) throw error;
                legacyArchiveLoaded = true;
                if (!data) {
                    status.textContent = '「' + petName + '」尚無可查閱的舊系統病歷。';
                    return;
                }
                status.textContent = '「' + petName + '」｜舊系統寵物資料編號：' + (data.source_pet_no || '未提供');
                const sections = [
                    ['病歷', data.medical_text], ['處置', data.treatment_text],
                    ['用藥備註', data.med_note], ['住院記錄', data.hospitalization_text]
                ];
                for (const [label, value] of sections) {
                    const section = document.createElement('section');
                    section.className = 'legacy-archive-section';
                    const title = document.createElement('h4');
                    title.textContent = label;
                    const body = document.createElement('div');
                    body.className = 'legacy-archive-text';
                    body.textContent = value && value.trim() ? value : '無記錄';
                    section.append(title, body);
                    content.append(section);
                }
            } catch (error) {
                if (request !== legacyArchiveRequest || petId !== currentPetId || tenantId !== CURRENT_TENANT_ID) return;
                status.textContent = '舊系統病歷載入失敗，請重試。若持續失敗，請確認帳號的讀取權限。';
                retry.hidden = false;
                console.error('舊系統病歷載入失敗', error);
            } finally {
                if (request === legacyArchiveRequest) legacyArchiveLoading = false;
            }
        }

        var medicalHistoryReadV50=0;
async function loadAllMedicalRecords(petId,options={}){
 const request=++medicalHistoryReadV50,tenant=CURRENT_TENANT_ID,user=CURRENT_USER?.id,container=document.getElementById('lastMedicalHistoryContent');container.textContent='正在載入歷史病歷…';
 const {data,error}=await _supabase.from('medical_records').select('*').eq('tenant_id',tenant).eq('pet_id',petId).order('created_at',{ascending:false});
 if(request!==medicalHistoryReadV50||tenant!==CURRENT_TENANT_ID||user!==CURRENT_USER?.id||petId!==currentPetId)return;
 if(error){container.textContent='歷史病歷載入失敗，請稍後按更新資料重試。';if(options.preserveDrafts)throw error;return;}
 container.replaceChildren();if(!data?.length){container.textContent='此寵物尚無歷史看診紀錄。';return;}
 for(const record of data){
  const section=document.createElement('div');section.style.cssText='border-bottom:1px dashed #cbd5e1;padding-bottom:12px;margin-bottom:12px';
  const head=document.createElement('div');head.style.cssText='display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px';
  const date=new Date(record.created_at).toLocaleString(),time=document.createElement('p');time.textContent='看診時間：'+date;
  const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px';
  const add=(label,callback)=>{const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.style.cssText='padding:3px 8px;font-size:.75rem';button.textContent=label;button.addEventListener('click',callback);actions.append(button);};
  if(medicalEditAllowedV53())add('修正病歷文字',()=>openMedicalEditV53(record.id));
  if(medicalEditAllowedV53()&&Array.isArray(record.prescription_details)&&record.prescription_details.length)add('複製這次處方',()=>openPrescriptionCopyV65(record.id));
  add('詳細內容',()=>openMedicalDetailModal(record));add('📄 處方箋',()=>{reprintPrescription(date,record.chief_complaint||'',encodeURIComponent(JSON.stringify(record.prescription_details||[])));const source=record.vaccine_info?.offline_emergency_v1?.source;if(source?.doctor)document.getElementById('rxDoctorName').innerText=source.doctor;});
  head.append(time,actions);section.append(head);const chief=document.createElement('p');chief.textContent='主訴：'+(record.chief_complaint||'');chief.style.whiteSpace='pre-wrap';section.append(chief);
  section.append(medicalPrescriptionListV53(record.prescription_details,false));
  if(record.edited_at){const meta=document.createElement('small');meta.textContent='最近內容修正：'+new Date(record.edited_at).toLocaleString('zh-TW');section.append(meta);}
  container.append(section);
 }
}
function medicalHistoryQuantityV913(p){
 const quantity=String(p.quantity??'').trim();
 if(!quantity||!Number.isFinite(Number(quantity)))return quantity;
 const route=String(p.medicine_name||'').match(/^\[([^\]]+)\]/)?.[1]||'';
 const kind=p.billing_kind||prescriptionRoutesV66.find(r=>r.name===route)?.kind||'';
 const unit=kind==='injection'||/注射|針劑/.test(route)?'ml':kind==='oral'||/口服/.test(route)?'顆':'';
 return quantity+(unit?' '+unit:'');
}
function medicalPrescriptionListV53(prescriptions,detail){
 const ul=document.createElement('ul');for(const p of Array.isArray(prescriptions)?prescriptions:[]){const li=document.createElement('li');li.textContent=(p.medicine_name||'')+' '+(detail?'－劑量：':'（劑量：')+(normalizePrescriptionDoseV91(p)||'-')+(detail?' | 數量：':'）：')+medicalHistoryQuantityV913(p)+' '+(p.instruction||'');ul.append(li);}
 if(!ul.childNodes.length){const li=document.createElement('li');li.textContent=detail?'無用藥明細':'無用藥紀錄';ul.append(li);}return ul;
}
function openMedicalDetailModal(record){
 const body=document.getElementById('detailModalBody');body.replaceChildren();
 for(const text of ['看診時間：'+new Date(record.created_at).toLocaleString(),'病歷狀態：'+(record.status||'已完成'),'主訴與診斷：']){const p=document.createElement('p');p.textContent=text;body.append(p);}
 const chief=document.createElement('div');chief.style.cssText='background:#f1f5f9;padding:10px;border-radius:6px;margin:5px 0 15px;white-space:pre-wrap';chief.textContent=record.chief_complaint||'無';body.append(chief);
 const label=document.createElement('p');label.textContent='處方與針劑用藥明細：';body.append(label,medicalPrescriptionListV53(record.prescription_details,true));
 document.getElementById('detailModalTitle').textContent='📋 歷史病歷完整內容';document.getElementById('genericDetailModal').style.display='flex';
}

        function reprintPrescription(dateStr, chiefComplaint, rxJsonEncoded) {
            const prescriptions = JSON.parse(decodeURIComponent(rxJsonEncoded));

            document.getElementById('rxClinicName').innerText = clinicSettings.name;
            document.getElementById('rxClinicMeta').innerText = `電話: ${clinicSettings.phone} | 地址: ${clinicSettings.address}`;
            document.getElementById('rxDoctorName').innerText = clinicSettings.director;

            document.getElementById('rxPetName').innerText = currentPetName || '指定病患';
            document.getElementById('rxPetWeight').innerText = currentPetWeight ? formatPetWeight(currentPetWeight) : '未知';
            document.getElementById('rxPetChip').innerText = currentPetMicrochip || '無晶片';
            document.getElementById('rxDate').innerText = dateStr.split(' ')[0];
            document.getElementById('rxChiefComplaint').value = chiefComplaint || '無特別主訴';

            renderRxModalTable(prescriptions);
            document.getElementById('prescriptionPreviewModal').style.display = 'flex';
        }

        function renderRxModalTable(prescriptions) {
            const body=document.getElementById('rxTableBody');body.replaceChildren();
            if(!Array.isArray(prescriptions)||!prescriptions.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.textContent='尚無處方用藥';cell.style.cssText='text-align:center;color:#64748b';row.append(cell);body.append(row);return;}
            prescriptions.forEach((p,index)=>{const row=document.createElement('tr');row.className='rx-editable-row';const number=document.createElement('td');number.textContent=index+1;row.append(number);
                for(const [field,cls] of [['medicine_name','rx-input-name'],['custom_dose','rx-input-dose'],['quantity','rx-input-qty'],['instruction','rx-input-inst']]){const td=document.createElement('td'),input=document.createElement('input');input.type='text';input.className=cls;input.value=field==='quantity'?medicalHistoryQuantityV913({...p,quantity:p.quantity??1}):field==='custom_dose'?normalizePrescriptionDoseV91(p):String(p[field]??'');input.style.cssText='width:100%;padding:4px 8px';td.append(input);row.append(td);}
                const td=document.createElement('td'),button=document.createElement('button');button.className='btn-danger';button.style.cssText='padding:4px 8px;font-size:.75rem';button.textContent='刪';button.type='button';button.onclick=()=>row.remove();td.append(button);row.append(td);body.append(row);
            });
        }

        function addRxModalRow() {
            const rxTbody = document.getElementById('rxTableBody');
            if (rxTbody.querySelector('td[colspan="6"]')) rxTbody.innerHTML = '';
            const rowCount = rxTbody.rows.length + 1;
            const tr = document.createElement('tr');
            tr.className = 'rx-editable-row';
            tr.innerHTML = `
                <td>${rowCount}</td>
                <td><input type="text" value="" placeholder="藥名" class="rx-input-name" style="width: 100%; padding: 4px 8px;"></td>
                <td><input type="text" value="10 mg/kg" class="rx-input-dose" style="width: 100%; padding: 4px 8px;"></td>
                <td><input type="text" value="1" class="rx-input-qty" style="width: 100%; padding: 4px 8px;"></td>
                <td><input type="text" value="一天兩次" class="rx-input-inst" style="width: 100%; padding: 4px 8px;"></td>
                <td><button class="btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="this.closest('tr').remove();">刪</button></td>
            `;
            rxTbody.appendChild(tr);
        }

        async function printLatestPrescription(petId, petName, petWeight, petMicrochip) {
            currentPetId = petId; currentPetName = petName; currentPetWeight = roundPetWeight(petWeight) || 0; currentPetMicrochip = petMicrochip;
            resetLegacyMedicalArchive();
            const { data, error } = await _supabase.from('medical_records').select('*').eq('tenant_id', CURRENT_TENANT_ID).eq('pet_id', petId).order('created_at', { ascending: false }).limit(1);

            if (error || !data || data.length === 0) { alert('找不到此寵物的歷史處方紀錄！'); return; }
            reprintPrescription(new Date(data[0].created_at).toLocaleString(), data[0].chief_complaint || '', encodeURIComponent(JSON.stringify(data[0].prescription_details || [])));
            const offlineDoctor=data[0].vaccine_info?.offline_emergency_v1?.source?.doctor;if(offlineDoctor)document.getElementById('rxDoctorName').innerText=offlineDoctor;
        }

        function openPrescriptionPreviewModal() {
            if (!currentPetId) { alert('尚未指定看診寵物！'); return; }

            document.getElementById('rxClinicName').innerText = clinicSettings.name;
            document.getElementById('rxClinicMeta').innerText = `電話: ${clinicSettings.phone} | 地址: ${clinicSettings.address}`;
            document.getElementById('rxDoctorName').innerText = clinicSettings.director;
            document.getElementById('rxPetName').innerText = currentPetName || '未指定';
            document.getElementById('rxPetWeight').innerText = formatPetWeight(currentPetWeight || 0);
            document.getElementById('rxPetChip').innerText = currentPetMicrochip || '無晶片';
            document.getElementById('rxDate').innerText = new Date().toLocaleDateString();
            document.getElementById('rxChiefComplaint').value = document.getElementById('medicalDiagnosis').value || '無特別主訴';

            const prescriptions = collectPrescriptionDetailsV75();

            renderRxModalTable(prescriptions);
            document.getElementById('prescriptionPreviewModal').style.display = 'flex';
        }

        function closePrescriptionPreviewModal() {
            document.getElementById('prescriptionPreviewModal').style.display = 'none';
        }

        function clearMedicalFormInputs() {
            medicalWeightConfirmedV9121=null;medicalVitalsDraftV9132=null;
            setMedicalWeightStatus('');
            medicalTemperatureRevision++;setMedicalTemperatureStatus('');
            document.getElementById("journalMedicalAvatar")?.replaceChildren();
            resetPrescriptionSharedSettingsForVisit();
            medicalStateCache = { chiefComplaint: "", temperature: "", weight: 0, prescriptions: [] };
            currentPetId = "";
            resetLegacyMedicalArchive();
            currentPetMicrochip = "";
            currentPetName = "";
            currentPetWeight = 0;
            currentOwnerId = "";
            currentPetBirthday = "";
            currentPetGender = "";
            currentPetSpecies = "";
            currentPetBreed = "";

            document.getElementById('medicalPetNameInfo').value = "尚未選擇";
            document.getElementById('medicalPetWeightInput').value = "0";
            document.getElementById('medicalDiagnosis').value = "";
            document.getElementById('medicalTemperatureInput').value = "";
            document.getElementById('medCustomRecDose').value = "";
            document.getElementById('medPrescribeQty').value = "1";
            document.getElementById('calculatedDoseResult').value = "";
            document.getElementById('prescriptionItemsContainer').innerHTML = "";
            document.getElementById('lastMedicalHistoryContent').innerHTML = "請先從首頁預約報到列表選擇寵物，系統將自動載入其所有歷史紀錄。";
            
            document.getElementById('cardPetName').innerText = "-";
            document.getElementById('cardPetChip').innerText = "-";
            document.getElementById('cardPetAge').innerText = "-";
            document.getElementById('cardPetGender').innerText = "-";
            document.getElementById('cardPetBreed').innerText = "-";
        }

        // Keep the visit's values inside its own medical text; later pet updates cannot change them.
        let medicalWeightConfirmedV9121=null;
        function medicalChiefComplaintWithTemperature() {
            const chief=document.getElementById('medicalDiagnosis').value;
            let weight,temperature;
            try {weight=readMedicalWeightForSave();temperature=readMedicalTemperatureForSave();}
            catch(error){alert(error.message);return null;}
            const confirmed=medicalWeightConfirmedV9121?.scope===medicalWeightScope() && medicalWeightConfirmedV9121?.weight===weight;
            const body=medicalVitalsBodyV9132(chief);
            if(!body.trim() && temperature===null && !confirmed && !medicalVitalsOwnedLineV9132(chief))return chief;
            return medicalVitalsHeaderV9132(weight,temperature,confirmed)+(body?'\n'+body:'');
        }

        const medicalDjangoAttemptsV5=new Map();
        let checkoutReturnDraftV1=null;
        async function medicalDjangoRequestV5(action,payload,base='/api/medical/'){
            const scope=doctorScopeV51(),tenant=CURRENT_TENANT_ID,userId=CURRENT_USER?.id;
            if(!scope)throw Error('請先登入。');
            const {data:{session},error}=await _supabase.auth.getSession();
            if(error)throw error;
            if(!session||session.user.id!==userId||scope!==doctorScopeV51())throw Error('登入身分已變更，請保留輸入並重新登入。');
            const response=await fetch(base+action+'/',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
            const result=await response.json();
            if(!response.ok){const failure=Error(result.error||'病歷儲存未確認成功，請保留畫面。');failure.status=response.status;throw failure;}
            if(scope!==doctorScopeV51()||result.tenant_id!==tenant||result.user_id!==userId||currentPetId!==payload.pet_id)throw Error('登入或病患已變更，請保留輸入並核對原病歷儲存結果。');
            return result;
        }
        async function medicalVisitRequestV6(action,appointmentId,petId,recordId=null){
            const visit=doctorVisitV51;
            if(!visit||visit.scope!==doctorScopeV51()||visit.petId!==petId||visit.appointmentId!==appointmentId)throw Error('無法確認本次接診資料，請保留輸入並核對。');
            const result=await medicalDjangoRequestV5(action,{pet_id:petId,appointment_id:appointmentId,claim_id:visit.claimId,record_id:recordId},'/api/medical-visit/');
            if(visit!==doctorVisitV51)throw Error('接診資料已變更，請保留畫面並核對原掛號結果。');
            return result;
        }
        async function saveMedicalViaDjangoV5(mode,chief,prescriptions){
            const visit=doctorVisitV51,scope=doctorScopeV51();
            if(!visit||visit.scope!==scope||visit.petId!==currentPetId)throw Error('無法確認本次接診權，請保留輸入。');
            const key=JSON.stringify([scope,visit.petId,visit.claimId,mode]);
            const fingerprint=JSON.stringify([chief,prescriptions]);
            let attempt=medicalDjangoAttemptsV5.get(key);
            if(attempt?.unconfirmed&&attempt.fingerprint!==fingerprint)throw Error('上次病歷儲存結果未確認。請先恢復原本內容並重試，以免產生重複病歷。');
            if(!attempt||attempt.fingerprint!==fingerprint){attempt={id:crypto.randomUUID(),fingerprint};medicalDjangoAttemptsV5.set(key,attempt);}
            const existing=visit.checkoutRecordV1;
            const requestId=existing?.id||attempt.id;
            attempt.unconfirmed=true;
            let result;
            try{result=await medicalDjangoRequestV5(existing?'revise':'save',{pet_id:visit.petId,appointment_id:visit.appointmentId,claim_id:visit.claimId,request_id:requestId,mode,chief,prescriptions,...(existing?{expected_version:existing.version}:{})});}
            catch(error){if([400,401,403].includes(error.status))attempt.unconfirmed=false;throw error;}
            if(result.data?.id!==requestId||result.data?.pet_id!==visit.petId||!Number.isSafeInteger(result.data?.row_version))throw Error('未取得正確的病歷儲存確認，請保留畫面。');
            attempt.unconfirmed=false;
            visit.checkoutRecordV1={id:requestId,version:result.data.row_version};
            return result.data;
        }

        const archiveOnlyAttempts=new Map();
        async function saveMedicalRecordOnlyAndArchive() {
            if(medicalSaveBusy)return;
            const tenant=CURRENT_TENANT_ID,petId=currentPetId;
            if(!tenant||!petId){alert('請先選擇寵物。');return;}
            if(document.querySelectorAll('#prescriptionItemsContainer .prescription-item-row').length){alert('本次有處方，請使用收費流程處理；僅儲存歸檔適用於查閱或無處方的紀錄。');return;}
            let pending;try{pending=readServiceDrafts().filter(x=>x.tenantId===tenant&&x.petId===petId&&x.state!=='paid');}catch(error){alert('無法確認待收費項目：'+error.message);return;}
            if(pending.length){alert('此寵物仍有疫苗／檢驗待收費項目，請先完成或核對收費，再使用不收費歸檔。');return;}
            let chief=medicalChiefComplaintWithTemperature();if(chief===null)return;
            let hasNewContent=chief.trim().length>0;
            const appointmentId=currentAppointmentId||activeAppointmentsList.find(p=>p.id===petId&&p.appointment_id)?.appointment_id||null;
            const key=tenant+':'+petId+':'+(appointmentId||'direct');
            const previousAttempt=archiveOnlyAttempts.get(key);
            if(previousAttempt?.saved&&!hasNewContent){chief=previousAttempt.chief;hasNewContent=true;}
            medicalSaveBusy=true;
            const valid=()=>tenant===CURRENT_TENANT_ID&&petId===currentPetId;
            let saved=false;
            try {
                if(!await ensureMedicalWeightForAction()||!valid())return;
                let appointment=null;
                if(appointmentId){
                    const response=await medicalVisitRequestV6('state',appointmentId,petId);const data=response.appointment,error=null;
                    if(error||!data)throw error||new Error('找不到本次報到資料。');if(!valid())return;
                    appointment=data;
                    if(!['候診中','診間看診中','已完成'].includes(data.status))throw new Error('本次尚未報到或已取消，請先核對預約狀態。');
                }
                if(hasNewContent){
                    let attempt=archiveOnlyAttempts.get(key);
                    if(!attempt){attempt={id:crypto.randomUUID()};archiveOnlyAttempts.set(key,attempt);}
                    // Reusing this attempt's UUID makes retrying after a partial failure update the same record.
                    const data=await saveArchiveMedicalV53(attempt,tenant,petId,chief),error=null;
                    if(error||!data)throw error||new Error('未確認病歷已儲存。');attempt.saved=true;attempt.chief=chief;saved=true;if(!valid())return;
                }
                if(appointment&&appointment.status!=='已完成'){
                    const response=await medicalVisitRequestV6('complete-archive',appointmentId,petId,hasNewContent?archiveOnlyAttempts.get(key)?.id||null:null);
                    const data=response.appointment,error=null;
                    if(error||!data)throw error||new Error('本次候診狀態已改變，請重新核對。');if(!valid())return;
                }
                activeAppointmentsList=activeAppointmentsList.filter(p=>appointmentId?p.appointment_id!==appointmentId&&!(p.id===petId&&!p.appointment_id):p.id!==petId);
                currentAppointmentId=null;archiveOnlyAttempts.delete(key);renderAppointmentTable(activeAppointmentsList);
                clearMedicalFormInputs();switchTab('appointments');
                alert(hasNewContent?'病歷已儲存歸檔，本次未建立帳單、未收費。':'已結束查閱，本次未新增病歷或帳單。');
                await loadAppointments();
            }catch(error){if(valid())alert((saved?'病歷已儲存，但歸檔尚未全部完成：':'歸檔未完成：')+error.message+'。請保留畫面；重試此按鈕會沿用同一筆病歷。');}
            finally{medicalSaveBusy=false;}
        }

        let medicalSaveBusy = false;
        async function saveMedicalRecordAndBackToWaiting() {
            if (medicalSaveBusy) return;
            medicalSaveBusy = true;
            try {
            if(!await ensureMedicalWeightForAction())return;
            const chiefComplaint = medicalChiefComplaintWithTemperature();
            if (chiefComplaint === null) return;
            if(!currentPetId) { alert('尚未指定看診寵物！'); return; }

            const prescriptions = collectPrescriptionDetailsV75();

            let recordError,savedMedicalV6;
            try {
                savedMedicalV6=await saveMedicalViaDjangoV5('waiting',chiefComplaint,prescriptions);
            } catch (err) { recordError = err; }
            if (recordError) {
                alert('病歷儲存失敗：' + recordError.message + '\n請保留畫面資料，稍後重試。');
                return;
            }



            try{
                const visit=doctorVisitV51;
                if(!visit)throw Error('無法確認本次掛號。');
                await medicalVisitRequestV6('waiting',visit.appointmentId,visit.petId,savedMedicalV6.id);
            }catch(waitingError){alert('病歷已儲存，但返回候診未成功：'+waitingError.message+'。請保留畫面並確認候診狀態。');return;}
            clinicClaimsV51.delete(currentPetId);doctorVisitV51=null;currentAppointmentId=null;medicalViewBaselineV918=null;
            let targetPet = activeAppointmentsList.find(p => p.id === currentPetId);
            if (targetPet) {
                targetPet.status = '候診中';
            } else {
                activeAppointmentsList.push({
                    id: currentPetId, name: currentPetName, microchip: currentPetMicrochip, weight: currentPetWeight, owner_id: currentOwnerId, status: '候診中', session: '上午診', doctor: '張醫師', time: new Date().toLocaleTimeString()
                });
            }
            renderAppointmentTable(activeAppointmentsList);

            alert('醫療紀錄已儲存！病患已切回候診狀態，所有欄位已自動清空。');
            clearMedicalFormInputs();
            switchTab('appointments');
            } finally { medicalSaveBusy = false; }
        }

        function checkoutInvoiceSnapshotV1(){return JSON.stringify({owner:document.getElementById('invoiceOwnerSelect').value,discount:document.getElementById('invoiceDiscount').value,rows:[...document.querySelectorAll('#invoiceItemsList .list-row')].map(r=>[...r.querySelectorAll('input,select')].map(x=>x.value))});}
        async function returnMedicalFromCheckoutV1(){
            const d=checkoutReturnDraftV1;
            if(!d||d.scope!==doctorScopeV51()||doctorVisitV51!==d.visit||clinicalInvoiceContext?.appointmentId!==d.visit.appointmentId){alert('本次看診資料已改變，請保留收費畫面並核對。');return;}
            if(checkoutInvoiceSnapshotV1()!==d.invoiceSnapshot&&!confirm('收費明細已有修改。返回病歷後重新產生收費明細時，這些修改需要重新輸入。確定返回？'))return;
            if(sessionStorage.getItem(posKeyV77('direct'))||sessionStorage.getItem(posKeyV77('stage:'+d.visit.appointmentId))||familyHasAppointmentV74(d.visit.appointmentId)){alert('此帳單有尚未確認的收款或已送待收；請先核對，勿返回修改。');return;}
            try{const {data,error}=await clinicDjangoRpcV4('verify_clinic_visit_v51',{p_pet_id:d.petId,p_claim_id:d.visit.claimId});if(error)throw error;if(data!==true)throw Error('看診權已變更');const state=await posRefreshV77({fresh:true,required:true});if([...state.pending||[],...state.pharmacy_holds_v9133||[]].some(q=>q.appointment_id===d.visit.appointmentId))throw Error('本次已送待付款，請先核對');}catch(e){alert('未能返回修改：'+e.message);return;}
            if(d.scope!==doctorScopeV51()||doctorVisitV51!==d.visit)return;
            clinicalInvoiceContext=null;clinicalMedicationGroupsV64=null;document.getElementById('invoiceItemsList').replaceChildren();document.getElementById('invoiceOwnerSelect').value='';document.getElementById('invoiceDiscount').value='0';familyInvoiceTouchedV74=false;calculateInvoiceTotal();
            currentPetId=d.petId;currentPetName=d.petName;currentPetMicrochip=d.microchip;currentPetWeight=d.weight;currentOwnerId=d.ownerId;currentPetBirthday=d.birthday;currentPetGender=d.gender;currentPetSpecies=d.species;currentPetBreed=d.breed;currentAppointmentId=d.visit.appointmentId;
            medicalWeightConfirmedV9121=structuredClone(d.weightConfirmation);medicalVitalsDraftV9132=structuredClone(d.vitalsDraft);medicalStateCache=structuredClone(d.state);restoreMedicalState();
            checkoutReturnDraftV1=null;document.getElementById('returnMedicalFromCheckoutV1').hidden=true;
            switchTab('medical');
        }

        async function saveMedicalRecordAndDirectCheckout() {
            if (medicalSaveBusy) return;
            medicalSaveBusy = true;
            try {
            if(!await ensureMedicalWeightForAction({verifiedByMedicalSave:true}))return;
            const chiefComplaint = medicalChiefComplaintWithTemperature();
            if (chiefComplaint === null) return;
            if(!currentPetId) { alert('尚未指定看診寵物！'); return; }

            const prescriptions = collectPrescriptionDetailsV75();

            let medicationGroups;try{medicationGroups=prepareMedicationGroupsV64(prescriptions);}catch(e){alert(e.message);return;}
            collectCurrentMedicalState();
            const returnSnapshot={scope:doctorScopeV51(),visit:doctorVisitV51,petId:currentPetId,petName:currentPetName,microchip:currentPetMicrochip,weight:currentPetWeight,ownerId:currentOwnerId,birthday:currentPetBirthday,gender:currentPetGender,species:currentPetSpecies,breed:currentPetBreed,state:structuredClone(medicalStateCache),weightConfirmation:structuredClone(medicalWeightConfirmedV9121),vitalsDraft:structuredClone(medicalVitalsDraftV9132)};
            let recordError;
            try {
                await saveMedicalViaDjangoV5('checkout',chiefComplaint,prescriptions);
            } catch (err) { recordError = err; }
            if (recordError) {
                alert('病歷儲存失敗：' + recordError.message + '\n請保留畫面資料，稍後重試。');
                return;
            }



            if (currentOwnerId) {
                document.getElementById('invoiceOwnerSelect').value = currentOwnerId;
            }

            const invoiceListContainer = document.getElementById('invoiceItemsList');
            invoiceListContainer.innerHTML = '';
            clinicalMedicationGroupsV64=null;

            let diagnosticDiv = document.createElement('div');
            diagnosticDiv.className = 'list-row';
            diagnosticDiv.innerHTML = `
                <input type="text" value="一般門診診察費" placeholder="項目名稱" class="invoice-name">
                <input type="number" value="1" placeholder="數量" class="invoice-qty" style="flex: 0.5;" oninput="calculateInvoiceTotal()">
                <input type="number" value="250" placeholder="金額" class="invoice-price" oninput="calculateInvoiceTotal()">
                <button class="btn-danger" onclick="this.parentElement.remove(); calculateInvoiceTotal();" style="padding: 9px 12px;">刪除</button>
            `;
            invoiceListContainer.appendChild(diagnosticDiv);

            appendMedicationGroupsV64(medicationGroups);

            attachServiceChargesToInvoice(currentPetId);
            calculateInvoiceTotal();

            activeAppointmentsList = activeAppointmentsList.filter(p => p.id !== currentPetId);
            renderAppointmentTable(activeAppointmentsList);

            checkoutReturnDraftV1=returnSnapshot;
            returnSnapshot.invoiceSnapshot=checkoutInvoiceSnapshotV1();
            document.getElementById('returnMedicalFromCheckoutV1').hidden=false;
            alert('病歷已儲存。請核對本隻費用，再按「確認本隻費用並送至待付款」。合併或分開付款由櫃台勾選。');
            clearMedicalFormInputs();
            switchTab('invoices');
            } finally { medicalSaveBusy = false; }
        }

        function appointmentLocalInputValue(dateValue) {
            if (!dateValue) return '';
            const d = new Date(dateValue);
            if (Number.isNaN(d.getTime())) return '';
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        function appointmentKey(p) {
            return p.appointment_id || `walkin:${p.id}`;
        }

        async function saveAppointment() {
            if(document.getElementById("appointmentPetSelect").dataset.selectedTenant !== CURRENT_TENANT_ID){alert("請先搜尋並選定正確的寵物！");return;}
            const searchRequest = globalSearchRequest;
            const searchTenant = CURRENT_TENANT_ID;
            const petSelectVal = document.getElementById('appointmentPetSelect').value;
            if(!petSelectVal) { alert('請選擇寵物！'); return; }
            if (!CURRENT_TENANT_ID) { alert('尚未取得醫院登入資訊，請重新登入。'); return; }

            const petObj = JSON.parse(petSelectVal);
            const appointmentTimeValue = document.getElementById('appointmentTime').value;
            if (!appointmentTimeValue) { alert('請選擇預約日期與時間！'); return; }

            const scheduledDate = new Date(appointmentTimeValue);
            if (Number.isNaN(scheduledDate.getTime())) { alert('預約日期時間格式不正確。'); return; }

            const session = document.getElementById('appointmentSession').value;
            const doctorAssignment={doctor:null,assigned_doctor_id:null};
            const doctor = doctorAssignment.doctor;
            const status = document.getElementById('appointmentStatusSelect').value || '已預約';
            const isEditing = !!editingAppointmentPetId;

            if (isEditing) {
                const target = activeAppointmentsList.find(p => appointmentKey(p) === editingAppointmentPetId);
                if (!target || !target.appointment_id) { alert('找不到要修改的正式預約資料。'); return; }

                const { data, error } = await _supabase.from('appointments')
                    .update({ scheduled_at: scheduledDate.toISOString(), session, status, notes:purposeNotesV74(target.notes,'appointmentVisitPurposeV74') })
                    .eq('id', target.appointment_id)
                    .eq('tenant_id', CURRENT_TENANT_ID)
                    .select('id, scheduled_at, session, doctor, assigned_doctor_id, status, notes, checked_in_at')
                    .single();

                if (error) { alert('預約修改失敗：' + error.message); return; }
                target.appointment_time = data.scheduled_at;
                target.session = data.session;
                target.doctor = data.doctor;target.assigned_doctor_id=data.assigned_doctor_id;
                target.status = data.status;target.notes=data.notes;
                target.check_in_time = data.checked_in_at ? new Date(data.checked_in_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
                renderAppointmentTable(activeAppointmentsList);
                alert('預約資料已修改完成！');
                cancelEditAppointment();
                return;
            }

            const insertRow = {
                tenant_id: CURRENT_TENANT_ID,
                pet_id: petObj.id,
                owner_id: petObj.owner_id || null,
                scheduled_at: scheduledDate.toISOString(),
                session,
                ...doctorAssignment,
                notes:purposeNotesV74('','appointmentVisitPurposeV74'),
                status
            };
            const { data, error } = await _supabase.from('appointments')
                .insert([insertRow])
                .select('id, scheduled_at, session, doctor, assigned_doctor_id, status, notes, checked_in_at')
                .single();
            if (error) { alert('建立預約失敗：' + error.message); return; }

            petObj.appointment_id = data.id;
            petObj.status = data.status;petObj.notes=data.notes;
            petObj.session = data.session;
            petObj.doctor = data.doctor;petObj.assigned_doctor_id=data.assigned_doctor_id;
            petObj.appointment_time = data.scheduled_at;
            petObj.check_in_time = '';
            petObj.time = new Date(data.scheduled_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
            activeAppointmentsList.push(petObj);
            renderAppointmentTable(activeAppointmentsList);
            clearAppointmentPetSearch();
            clearGlobalSearchAfterSelection(searchRequest, searchTenant);
            alert(data.status==='候診中'?'掛號已完成，現在可指定醫師。':'預約已儲存；來院報到後再指定醫師。');
            if(data.status==='候診中'&&searchTenant===CURRENT_TENANT_ID)await openWaitingDoctorV54(data.id);
        }

        function editAppointment(key) {
            const appointment = activeAppointmentsList.find(p => appointmentKey(p) === key);
            if (!appointment) { alert('找不到此預約資料。'); return; }
            if (appointment.status !== '已預約') { alert('只有尚未報到的預約可以修改。'); return; }
            if (!appointment.appointment_id) { alert('此筆不是正式預約，無法使用修改預約功能。'); return; }

            const form=document.getElementById("journalAppointmentForm");form.open=true;
            chooseAppointmentPet(appointment, true);
            editingAppointmentPetId = key;
            const petSelect = document.getElementById('appointmentPetSelect');
            const matchingOption = Array.from(petSelect.options).find(opt => {
                if (!opt.value) return false;
                try { return JSON.parse(opt.value).id === appointment.id; } catch (e) { return false; }
            });
            if (matchingOption) petSelect.value = matchingOption.value;
            petSelect.disabled = true;

            document.getElementById('appointmentTime').value = appointmentLocalInputValue(appointment.appointment_time);
            document.getElementById('appointmentSession').value = appointment.session || '上午診';
            setAppointmentDoctorV51(appointment);
            document.getElementById('appointmentVisitPurposeV74').value=visitPurposeV74(appointment.notes)==='未註記'?'看診':visitPurposeV74(appointment.notes);
            document.getElementById('appointmentStatusSelect').value = '已預約';
            document.getElementById('appointmentStatusSelect').disabled = true;
            document.getElementById('saveAppointmentBtn').textContent = '儲存修改';
            document.getElementById('cancelEditAppointmentBtn').style.display = 'inline-block';
            document.getElementById('appointmentTime').focus({preventScroll:true});
            form.scrollIntoView({behavior:'smooth',block:'start'});
        }

        function cancelEditAppointment() {
            clearAppointmentPetSearch();document.getElementById("appointmentPetSearchClear").disabled=false;
            editingAppointmentPetId = null;
            document.getElementById('appointmentVisitPurposeV74').value='看診';
            document.getElementById('appointmentPetSelect').disabled = false;
            document.getElementById('appointmentStatusSelect').disabled = false;
            document.getElementById('appointmentStatusSelect').value = '已預約';
            document.getElementById('saveAppointmentBtn').textContent = '建立預約';
            document.getElementById('cancelEditAppointmentBtn').style.display = 'none';
        }

        async function checkInAppointment(key) {
            const appointment = activeAppointmentsList.find(p => appointmentKey(p) === key);
            if (!appointment) { alert('找不到此預約資料。'); return; }
            if (appointment.status !== '已預約') { alert('此病患目前不是「已預約（未報到）」狀態。'); return; }

            const now = new Date(),tenant=CURRENT_TENANT_ID,registrationScope=doctorScopeV51();
            if (appointment.appointment_time && new Date(appointment.appointment_time).getTime() > now.getTime()) {
                if (!confirm('此病患尚未到原預約時間，確定要提前報到嗎？')) return;
            }

            if (appointment.appointment_id) {
                const { data,error } = await _supabase.from('appointments')
                    .update({ status: '候診中', checked_in_at: now.toISOString() })
                    .eq('id', appointment.appointment_id)
                    .eq('tenant_id', tenant).eq('status','已預約').select('id,status,checked_in_at').single();
                if(registrationScope!==doctorScopeV51())return;
                if(error||!data?.id){alert('報到尚未確認：'+(error?.message||'本筆預約狀態已改變')+'。請更新候診後核對，尚未開啟醫師指定。');return;}
            }

            appointment.status = '候診中';
            appointment.check_in_time = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
            renderAppointmentTable(activeAppointmentsList);
            alert(`${appointment.name} 已完成報到，現在進入候診中。`);
            if(appointment.appointment_id)await openWaitingDoctorV54(appointment.appointment_id);
        }

        let appointmentsLoadRequest=0;
        async function loadAppointments() {
            if (!CURRENT_TENANT_ID) return;
            const tenant=CURRENT_TENANT_ID, request=++appointmentsLoadRequest;
            const { data, error } = await _supabase.from('appointments')
                .select('id, tenant_id, pet_id, owner_id, scheduled_at, session, doctor, assigned_doctor_id, status, notes, checked_in_at, pets(id,name,microchip,birthday,species,gender,weight,breed,owner_id,owners(name))')
                .eq('tenant_id', tenant)
                .in('status', ['已預約','候診中','診間看診中'])
                .order('scheduled_at', { ascending: true });
            if (tenant!==CURRENT_TENANT_ID || request!==appointmentsLoadRequest) return;
            if (error) { console.error('讀取預約失敗：', error); alert('候診資料讀取失敗，請重新整理再確認。'); return; }

            const storedPetIds=new Set((data||[]).map(a=>a.pet_id));
            const localWalkins = activeAppointmentsList.filter(p => !p.appointment_id && !storedPetIds.has(p.id));
            const dbAppointments = (data || []).map(a => {
                const pet = a.pets || {};
                return {
                    ...pet,
                    id: a.pet_id,
                    owner_id: a.owner_id || pet.owner_id || '',
                    owner_name: pet.owners?.name || '關聯飼主',
                    appointment_id: a.id,
                    appointment_time: a.scheduled_at,
                    session: a.session || '上午診',
                    doctor: a.doctor || '',assigned_doctor_id:a.assigned_doctor_id||null,
                    status: a.status, notes:a.notes||'',
                    check_in_time: a.checked_in_at ? new Date(a.checked_in_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '',
                    time: new Date(a.scheduled_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
                };
            });
            activeAppointmentsList = [...localWalkins, ...dbAppointments];
            renderAppointmentTable(activeAppointmentsList);
            await loadAppointmentHistory('all');
        }

        async function loadAppointmentHistory(statusFilter = 'all') {
            const tbody = document.getElementById('appointmentHistoryBody');
            if (!tbody || !CURRENT_TENANT_ID || !document.getElementById('appointmentHistoryPanel')?.open) return;
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">載入中...</td></tr>`;

            let query = _supabase.from('appointments')
                .select('id, scheduled_at, session, doctor, status, cancelled_at, cancel_reason, pets(name, owners(name))')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .in('status', ['已取消','已完成'])
                .order('scheduled_at', { ascending: false })
                .limit(200);

            if (statusFilter !== 'all') query = query.eq('status', statusFilter);

            const { data, error } = await query;
            if (error) {
                console.error('讀取預約歷史紀錄失敗：', error);
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#b91c1c;">讀取歷史紀錄失敗：${error.message}</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b;">目前沒有符合條件的歷史預約紀錄</td></tr>`;
                return;
            }

            data.forEach(a => {
                const petName = a.pets?.name || '未知寵物';
                const ownerName = a.pets?.owners?.name || '關聯飼主';
                const scheduled = a.scheduled_at
                    ? new Date(a.scheduled_at).toLocaleString([], { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
                    : '-';
                const statusColor = a.status === '已取消' ? '#b91c1c' : '#059669';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${scheduled}</td>
                    <td><b>${petName}</b></td>
                    <td>${ownerName}</td>
                    <td>${a.session || '-'}<br><small style="color:#0369a1;">${a.doctor || '-'}</small></td>
                    <td><span style="font-weight:bold; color:${statusColor};">${a.status || '-'}</span></td>
                    <td>${a.status === '已取消' ? (a.cancel_reason || '未填寫') : '-'}</td>`;
                tbody.appendChild(tr);
            });
        }

        function filterAppointmentsStatus(status) {
            currentAppointmentFilter = status;
            renderAppointmentTable(activeAppointmentsList);
        }

        function renderAppointmentTable(petsData) {
            const tbody = document.getElementById('appointmentTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';

            const getLocalDateKey = (dateValue) => {
                if (!dateValue) return '';
                const d = new Date(dateValue);
                if (Number.isNaN(d.getTime())) return '';
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            const todayKey = getLocalDateKey(new Date());

            let filteredList = petsData;
            if (currentAppointmentFilter !== 'all') {
                if (['上午診','下午診','夜診'].includes(currentAppointmentFilter)) {
                    filteredList = petsData.filter(p => (p.session || '上午診') === currentAppointmentFilter);
                } else if (currentAppointmentFilter === '今日預約') {
                    filteredList = petsData.filter(p => p.status === '已預約' && getLocalDateKey(p.appointment_time) === todayKey);
                } else if (currentAppointmentFilter === '未來預約') {
                    filteredList = petsData.filter(p => p.status === '已預約' && getLocalDateKey(p.appointment_time) > todayKey);
                } else {
                    filteredList = petsData.filter(p => p.status === currentAppointmentFilter);
                }
            }

            if (!filteredList || filteredList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">目前尚無任何符合條件的報到病患</td></tr>`;
                renderJournalAppointmentCards([]);
                return;
            }

            filteredList.forEach(pet => {
                const ownerName = pet.owner_name || '關聯飼主';
                const appointmentTimeStr = pet.appointment_time
                    ? new Date(pet.appointment_time).toLocaleString([], { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
                    : (pet.time || new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }));
                const checkInTimeStr = pet.check_in_time || '';
                const statusStr = pet.status || '候診中';
                const appointmentDateKey = getLocalDateKey(pet.appointment_time);
                const displayStatusStr = statusStr === '已預約'
                    ? (appointmentDateKey === todayKey ? '今日預約' : (appointmentDateKey > todayKey ? '未來預約' : '已預約'))
                    : statusStr;
                const sessionStr = pet.session || '上午診';
                const doctorStr = doctorWaitingLabelV51(pet);
                const statusBadgeColor = statusStr === '診間看診中' ? '#0284c7' : (statusStr === '已預約' ? '#d97706' : '#059669');
                const key = appointmentKey(pet);
                const actionButtons = statusStr === '已預約'
                    ? `<button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editAppointment('${key}')">修改預約</button>
                       <button class="btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="checkInAppointment('${key}')">報到</button>
                       ${pet.appointment_id
                           ? `<button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="cancelAppointment('${key}')">取消預約</button>`
                           : `<button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="removeAppointment('${key}')">移除</button>`}`
                    : `<button ${doctorVisitOccupiedV51(pet)?'disabled title="其他醫師看診中"':''} class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="startConsultationFromAppointment('${key}', '${pet.id}', '${pet.microchip || ''}', '${pet.name}', '${pet.owner_id || ''}', ${pet.weight || 0}, '${ownerName}', '${pet.birthday || ''}', '${pet.gender || ''}', '${pet.species || '貓'}', '${pet.breed || ''}')">看診</button>
                       <button class="btn-success" style="padding: 4px 8px; font-size: 0.8rem;" onclick="directCheckoutFromAppointment('${pet.id}', '${pet.owner_id || ''}')">💳 歸檔結帳</button>
                       ${statusStr === '候診中' ? `<button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="removeAppointment('${key}')">移除候診</button>` : ''}`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${pet.microchip || '(無)'}</td>
                    <td><b>${pet.name}</b> (${formatPetWeight(pet.weight || 0)} kg)</td>
                    <td>${ownerName}</td>
                    <td><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${sessionStr}</span><br><small style="color:#0369a1;">${doctorStr}</small></td>
                    <td><b>${appointmentTimeStr}</b>${checkInTimeStr ? `<br><small style="color:#059669;">報到：${checkInTimeStr}</small>` : `<br><small style="color:#94a3b8;">尚未報到</small>`}</td>
                    <td><span style="color: ${statusBadgeColor}; background: #e0f2fe; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${displayStatusStr}</span><br><small>${visitPurposeV74(pet.notes)}</small></td>
                    <td style="display: flex; gap: 6px; flex-wrap: wrap;">${actionButtons}${waitingDoctorActionV54(pet)}${doctorReleaseActionV51(pet)}${pet.owner_id ? `<button type="button" class="btn-secondary" style="padding:4px 8px;font-size:0.8rem;" onclick='openQuickNewPet(${escapeLabText(JSON.stringify(pet.owner_id))})'>🐾 新增寵物</button>` : ''}</td>`;
                tbody.appendChild(tr);
            });
            renderJournalAppointmentCards(filteredList);
        }

        async function startConsultationFromAppointment(key,...args){const appointment=activeAppointmentsList.find(p=>appointmentKey(p)===key);if(!appointment){alert('找不到候診資料，請更新。');return;}return startDoctorConsultationV51(args,appointment.appointment_id||null);}

        async function cancelAppointment(key) {
            const target = activeAppointmentsList.find(p => appointmentKey(p) === key);
            if (!target || !target.appointment_id) { alert('找不到此正式預約資料。'); return; }
            if (target.status !== '已預約') {
                alert('只有尚未報到的預約可以取消；已報到病患請依候診／看診流程處理。');
                return;
            }

            const reasonInput = prompt(`請輸入「${target.name || '此病患'}」取消預約的原因：`);
            if (reasonInput === null) return;
            const reason = reasonInput.trim();
            if (reason.length < 2) {
                alert('請填寫至少兩個字的取消原因。');
                return;
            }
            if (!confirm(`確定取消「${target.name || '此病患'}」這筆預約嗎？\n\n取消原因：${reason}\n\n取消後會從即時預約列表隱藏，但紀錄仍保留在 Supabase。`)) return;

            const now = new Date();
            const { error } = await _supabase.from('appointments')
                .update({
                    status: '已取消',
                    cancelled_at: now.toISOString(),
                    cancel_reason: reason
                })
                .eq('id', target.appointment_id)
                .eq('tenant_id', CURRENT_TENANT_ID);

            if (error) { alert('取消預約失敗：' + error.message); return; }

            activeAppointmentsList = activeAppointmentsList.filter(p => appointmentKey(p) !== key);
            renderAppointmentTable(activeAppointmentsList);
            await loadAppointmentHistory('all');
            alert('預約已取消。紀錄已保留在 Supabase。');
        }

        async function removeAppointment(key) {
            const target=activeAppointmentsList.find(p=>appointmentKey(p)===key);
            if (!target) return;
            if (target.status==='已預約') {alert('尚未報到的預約請使用取消預約。');return;}
            if (target.status==='診間看診中') {alert('此病患正在看診，請先返回候診再移除。');return;}
            if (!confirm('確定將此病患移出候診？已儲存的報到紀錄將保留為已取消。')) return;
            const tenant=CURRENT_TENANT_ID;
            if (target.appointment_id) {
                try {
                    const {data,error}=await _supabase.from('appointments')
                        .update({status:'已取消',cancelled_at:new Date().toISOString(),cancel_reason:'移除候診'})
                        .eq('id',target.appointment_id).eq('tenant_id',tenant).eq('status','候診中').select('id').single();
                    if (error || !data) throw error||new Error('紀錄狀態已改變，請重新讀取候診。');
                } catch(error) {alert('移除失敗：'+error.message);return;}
            }
            if (tenant!==CURRENT_TENANT_ID) return;
            activeAppointmentsList=activeAppointmentsList.filter(p=>appointmentKey(p)!==key);
            renderAppointmentTable(activeAppointmentsList);await loadAppointmentHistory('all');
        }

        // Enter 依目前顯示的檢驗表格順序移動；最後一格移至備註，不送出報告。
        document.getElementById('lab_manager').addEventListener('keydown', function(event) {
            if (event.key !== 'Enter' || event.isComposing || event.keyCode===229 || event.repeat || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || !event.target.matches('.lab-result-input')) return;
            event.preventDefault();
            const panel = event.target.closest('.lab-entry-panel');
            const cells = Array.from(panel.querySelectorAll('.lab-result-input')).filter(el=>!el.disabled&&!el.readOnly&&el.getClientRects().length&&!el.closest('[hidden],[inert]'));
            const next = cells[cells.indexOf(event.target) + 1] || document.getElementById('labReportNotes');
            next.focus();
            if (next.select) next.select();
        });

        const labReferenceTemplates = {
            cbc: [
                // key, label, unit, dog reference, cat reference, group
                ['wbc','白血球總數','×1000/µL',[6,17],[5.5,19.5],'白血球與分類百分比'],
                ['pct_neu','嗜中性球百分比','%',[52,81],[38,80],'白血球與分類百分比'],
                ['pct_lym','淋巴球百分比','%',[12,33],[12,45],'白血球與分類百分比'],
                ['pct_mono','單核球百分比','%',[2,13],[1,8],'白血球與分類百分比'],
                ['pct_eos','嗜酸性球百分比','%',[0.5,10],[1,11],'白血球與分類百分比'],
                ['pct_baso','嗜鹼性球百分比','%',[0,1.3],[0,1.2],'白血球與分類百分比'],
                ['neu','嗜中性球數','×1000/µL',[3.62,12.30],[3.12,12.58],'白血球絕對數'],
                ['lym','淋巴球數','×1000/µL',[0.83,4.91],[0.73,7.86],'白血球絕對數'],
                ['mono','單核球數','×1000/µL',[0.14,1.97],[0.07,1.36],'白血球絕對數'],
                ['eos','嗜酸性球數','×1000/µL',[0.04,1.62],[0.06,1.93],'白血球絕對數'],
                ['baso','嗜鹼性球數','×1000/µL',[0,0.12],[0,0.12],'白血球絕對數'],
                ['rbc','紅血球總數','×10⁶/µL',[5.1,8.5],[4.62,10.20],'紅血球系列'],
                ['hgb','血紅素','g/dL',[11,19],[8.5,15.3],'紅血球系列'],
                ['hct','血球容積比','%',[33,56],[26,47],'紅血球系列'],
                ['mcv','平均紅血球容積','fL',[60,76],[38,54],'紅血球系列'],
                ['mch','平均血紅素量','pg',[20,27],[11.8,18],'紅血球系列'],
                ['mchc','平均血紅素濃度','g/L',[30,38],[29,36],'紅血球系列'],
                ['rdw_cv','紅血球分布寬度 CV','%',[12.5,17.2],[16,23],'紅血球系列'],
                ['rdw_sd','紅血球分布寬度 SD','fL',[33.2,46.3],[26.4,43.1],'紅血球系列'],
                ['plt','血小板總數','×1000/µL',[117,490],[100,518],'血小板系列'],
                ['mpv','平均血小板體積','fL',[8,14.1],[9.9,16.3],'血小板系列'],
                ['pdw','血小板分布寬度','fL',[0.1,30],[0.1,30],'血小板系列'],
                ['pct','血小板容積比','%',[0.09,0.58],[0,0.8],'血小板系列']
            ],
            bio: [
                ['alb','白蛋白','g/dL',[2.6,4.6],[2.5,4.6],'血清生化'],
                ['tp','總蛋白','g/dL',[5.2,8.2],[5.7,8.9],'血清生化'],
                ['glu','血糖','mg/dL',[60,132],[53,150],'血清生化'],
                ['chol','總膽固醇','mg/dL',[110,320],[54,220],'血清生化'],
                ['alp','鹼性磷酸酶','U/L',[0,212],[0,111],'血清生化'],
                ['alt','丙胺酸轉胺酶','U/L',[0,88],[0,116],'血清生化'],
                ['ggt','伽馬麩胺醯轉移酶','U/L',[0,10],[0,10],'血清生化'],
                ['tbil','總膽紅素','mg/dL',[0,0.9],[0,0.9],'血清生化'],
                ['amy','澱粉酶','U/L',[400,1500],[500,1600],'血清生化'],
                ['bun','血中尿素氮','mg/dL',[6,26],[13,37],'血清生化'],
                ['crea','肌酐','mg/dL',[0.4,1.6],[0.7,2.0],'血清生化'],
                ['ca','鈣','mg/dL',[7.9,12.0],[8.0,12.0],'血清生化'],
                ['phos','無機磷','mg/dL',[2.5,6.8],[3.1,7.5],'血清生化'],
                ['glob','球蛋白','g/dL',[2.2,4.6],[2.6,5.1],'延伸計算與脂肪酶'],
                ['urea','尿素','mg/dL',[12.8,55.6],[27.8,79.2],'延伸計算與脂肪酶'],
                ['c_ca','修正鈣','mg/dL',[7.9,12.0],[8.0,12.0],'延伸計算與脂肪酶'],
                ['ag_ratio','球蛋白比','',null,null,'延伸計算與脂肪酶'],
                ['bc_ratio','尿素氮肌酐比','',null,null,'延伸計算與脂肪酶'],
                ['lipa','脂肪酶','U/L',[0,125],[0,35],'延伸計算與脂肪酶']
            ]
        };
        let renderedLabPatientKey = '';
        function getSelectedLabSpecies() {
            const petId=document.getElementById('selectedLabPetId').value;
            const pet=allPetsListForDropdown.find(item=>item.id===petId);
            const species=String(pet?.species||'').normalize('NFKC').trim().toLowerCase();
            if(/^(犬|狗|犬類|狗狗|dog|canine)$/.test(species))return 'dog';
            if(/^(貓|猫|貓類|貓咪|cat|feline)$/.test(species))return 'cat';
            return '';
        }

        function renderLabSpeciesTemplates() {
            const species = getSelectedLabSpecies();
            const patientKey = document.getElementById('selectedLabPetId').value + ':' + species;
            if (patientKey === renderedLabPatientKey) return;
            renderedLabPatientKey = patientKey;
            document.querySelector('#cbcFieldsContainer h4').textContent = `🐾 ${species === 'dog' ? '犬' : species === 'cat' ? '貓' : '犬／貓'} CBC 全血球`;
            document.querySelector('#bioFieldsContainer h4').textContent = `🧪 ${species === 'dog' ? '犬' : species === 'cat' ? '貓' : '犬／貓'} 血清生化`;
            const reportCodes = {
                pct_neu:'%Neu', pct_lym:'%Lym', pct_mono:'%Mono', pct_eos:'%Eos', pct_baso:'%Baso',
                neu:'_Neu', lym:'Lym', mono:'Mono', eos:'_Eos', baso:'_Baso',
                rdw_cv:'RDW-CV', rdw_sd:'RDW-SD', c_ca:'#C-Ca', glob:'#GLOB',
                urea:'#UREA', ag_ratio:'#A/G', bc_ratio:'#B/C', lipa:'LIPA'
            };
            for (const [type, fields] of Object.entries(labReferenceTemplates)) {
                const body = document.getElementById(type + 'LabRows');
                body.replaceChildren();
                if (!species) {
                    const message = document.createElement('tr');
                    message.innerHTML = '<td colspan="4">請先選擇犬或貓的寵物，系統會顯示對應的檢驗範本。</td>';
                    body.appendChild(message);
                    continue;
                }
                let lastGroup = '';
                fields.forEach(([key, label, unit, dogRange, catRange, group]) => {
                    if (group !== lastGroup) {
                        const header = document.createElement('tr');
                        header.className = 'lab-section-row';
                        const cell = document.createElement('th');
                        cell.colSpan = 4;
                        cell.scope = 'colgroup';
                        cell.textContent = group;
                        header.appendChild(cell);
                        body.appendChild(header);
                        lastGroup = group;
                    }
                    const range = species === 'dog' ? dogRange : catRange;
                    const tr = document.createElement('tr');
                    const title = document.createElement('th');
                    title.scope = 'row';
                    const code = document.createElement('strong');
                    code.textContent = reportCodes[key] || key.toUpperCase();
                    const description = document.createElement('span');
                    description.textContent = label;
                    title.append(code, description);
                    const reference = document.createElement('td');
                    reference.className = 'lab-reference';
                    reference.textContent = range ? range.join('–') : '—';
                    const unitCell = document.createElement('td');
                    unitCell.className = 'lab-unit';
                    unitCell.textContent = unit;
                    const result = document.createElement('td');
                    const input = document.createElement('input');
                    input.id = type + '_' + key;
                    input.type = 'text'; // 報告可含「<10」等結果；不將其誤判為確切數值。
                    input.inputMode = 'decimal';
                    input.className = 'lab-result-input';
                    input.autocomplete = 'off';
                    input.setAttribute('aria-label', `${key.toUpperCase()} ${label} 結果`);
                    input.dataset.labKey = key;
                    if (range) input.addEventListener('input', () => {
                        const text = input.value.trim();
                        if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) checkLabInputRange(input, range[0], range[1]);
                        else { input.style.background = '#fff'; input.style.color = '#334155'; input.style.fontWeight = 'normal'; }
                    });
                    result.appendChild(input);
                    tr.append(title, reference, unitCell, result);
                    body.appendChild(tr);
                });
            }
        }

        function toggleLabFormFields() {
            const type = document.getElementById('labTestType').value;
            if (type === 'CBC全血球') {
                document.getElementById('cbcFieldsContainer').style.display = 'block';
                document.getElementById('bioFieldsContainer').style.display = 'none';
            } else {
                document.getElementById('cbcFieldsContainer').style.display = 'none';
                document.getElementById('bioFieldsContainer').style.display = 'block';
            }
        }

        let labReportSaveBusy=false;
        let pendingSkylaTransfer=null;
        async function saveLabReportToDatabase() {
            if (labReportSaveBusy) return;
            const petId = document.getElementById('selectedLabPetId').value;
            const testType = document.getElementById('labTestType').value;
            const notes = document.getElementById('labReportNotes').value;

            if(!petId) { alert('請從搜尋欄正確選取檢驗對象寵物！'); return; }

            const species = getSelectedLabSpecies();
            if (!species) { alert('請選擇犬或貓，才能使用對應的參考範圍。'); return; }
            const formType = testType === 'CBC全血球' ? 'cbc' : 'bio';
            const reportData = { _species: species === 'dog' ? '犬' : '貓' };
            document.querySelectorAll('#' + formType + 'LabRows .lab-result-input').forEach(input => {
                reportData[input.dataset.labKey] = input.value.trim();
            });
            if (!Object.entries(reportData).some(([key, value]) => key !== '_species' && value !== '')) {
                alert('請先輸入至少一項檢驗結果。'); return;
            }

            const selectedPet=allPetsListForDropdown.find(p=>p.id===petId);
            const imported=pendingSkylaTransfer && testType==='血液生化';
            if (imported && (pendingSkylaTransfer.petId!==petId || !notes.includes(pendingSkylaTransfer.marker))) {
                alert('Skyla 匯入資料的寵物或來源備註已改變，請重新帶入並確認。'); return;
            }
            if (imported && !confirm(`確認將 Skyla 報告存入 ${selectedPet?.name||'未知寵物'}（${selectedPet?.species||''}）的血液生化紀錄？\n原始檢驗日期：${pendingSkylaTransfer.date}\n請先核對 PDF 與表單。`)) return;
            labReportSaveBusy=true;
            let error, serviceCharge;
            try {
                if (imported) {
                    const lookup=await _supabase.from('lab_reports').select('notes,report_data')
                        .eq('tenant_id',CURRENT_TENANT_ID).eq('pet_id',petId).eq('test_type',testType);
                    if (lookup.error) throw new Error('無法查詢既有報告，未儲存：'+lookup.error.message);
                    const duplicate=(lookup.data||[]).some(old=>
                        (old.notes||'').includes(pendingSkylaTransfer.marker) &&
                        Object.entries(reportData).every(([key,value])=>String(old.report_data?.[key]??'')===String(value))
                    );
                    if (duplicate) { alert('同一隻寵物、同一來源與相同檢驗數值已存檔，已取消重複儲存。'); return; }
                }
                serviceCharge=prepareServiceCharge('labServiceFee',petId,'lab','檢驗：'+testType);
                const response=await _supabase.from('lab_reports').insert([{
                    id: serviceCharge.id,
                    tenant_id: CURRENT_TENANT_ID, pet_id: petId, test_type: testType, report_data: reportData, notes: notes
                }]);
                error=response.error;
            } catch (e) { alert((e.message||String(e))+'。若已送出儲存請先確認報告，勿重複登記。'); return; }
            finally { labReportSaveBusy=false; }

            if(error) {
                cancelServiceCharge(serviceCharge);
                alert('儲存失敗：' + error.message);
            } else {
                try { finishServiceCharge(serviceCharge,serviceCharge.id); } catch(error) { alert('檢驗報告已儲存，但待收費暫存更新失敗：'+error.message+'。請核對帳單，勿重新登記報告。'); return; }
                document.getElementById('labServiceFee').value='';
                document.querySelectorAll('#' + formType + 'LabRows .lab-result-input').forEach(input => {
                    input.value = '';
                    input.style.background = '#fff';
                    input.style.color = '#334155';
                    input.style.fontWeight = 'normal';
                });
                document.getElementById('labReportNotes').value = '';
                pendingSkylaTransfer=null;
                if (imported) resetSkylaExchangeAfterSave();
                await loadLabReportsList();
                if (formType === 'cbc') {
                    document.getElementById('labTestType').value = '血液生化';
                    toggleLabFormFields();
                    alert('血球報告已儲存。可直接接著輸入同一隻寵物的血清生化。');
                } else {
                    alert('血清生化報告已儲存。可繼續輸入或按「返回目前看診病歷」。');
                }
            }
        }

        async function loadLabReportsList() {
            refreshOpenCurrentPetHistory('cbc');refreshOpenCurrentPetHistory('bio');
            const { data, error } = await _supabase.from('lab_reports').select('*, pets(name, species)').eq('tenant_id', CURRENT_TENANT_ID).order('created_at', { ascending: false });
            if (error || !data) { allLabReportsCache = []; } else { allLabReportsCache = data; }
            filterLabReportsTable();
        }

        function renderLabReportsTable(dataList) {
            const tbody = document.getElementById('labReportsTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'labReportTableSearch')) return;

            if(!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">尚無任何檢驗報告</td></tr>`;
                return;
            }

            dataList.forEach(rep => {
                const petName = rep.pets ? rep.pets.name : '未知寵物';
                let summary = '';
                if (rep.report_data) {
                    const species = getLabReportSpecies(rep);
                    const metadata = labReferenceTemplates[rep.test_type === 'CBC全血球' ? 'cbc' : 'bio'];
                    for (let key in rep.report_data) {
                        if (key.startsWith('_') || rep.report_data[key] === '') continue;
                        const value = String(rep.report_data[key]);
                        const field = metadata.find(item => item[0] === key);
                        const range = field && (species === 'dog' ? field[3] : species === 'cat' ? field[4] : null);
                        const numeric = /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? Number(value) : NaN;
                        const sourceRow=rep.report_data?._skyla?.rows?.find(r=>r.key===key);
                        const abnormal = sourceRow ? ['h','l'].includes(sourceRow.flag) : range && Number.isFinite(numeric) && (numeric < range[0] || numeric > range[1]);
                        summary += `<span style="${abnormal ? 'color:#dc2626;font-weight:bold' : ''}">${escapeLabText(key.toUpperCase())}: ${escapeLabText(value)}</span> | `;
                    }
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(rep.created_at).toLocaleString()}</td>
                    <td><b>${escapeLabText(petName)}</b></td>
                    <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${rep.test_type}</span></td>
                    <td><small style="color: #475569;">${summary || '無數據'}</small></td>
                    <td>${escapeLabText(rep.notes || '-')}</td>
                    <td>
                        <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick='openLabDetailModal(${escapeLabText(JSON.stringify(rep))})'>檢視</button>
                        <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteLabReport('${rep.id}')">刪除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterLabReportsTable() {
            const keyword = document.getElementById('labReportTableSearch').value.trim().toLowerCase();
            if(!keyword) { renderLabReportsTable(allLabReportsCache); return; }

            const filtered = allLabReportsCache.filter(rep => {
                const petName = (rep.pets && rep.pets.name ? rep.pets.name : '').toLowerCase();
                const notes = (rep.notes || '').toLowerCase();
                const testType = (rep.test_type || '').toLowerCase();
                return petName.includes(keyword) || notes.includes(keyword) || testType.includes(keyword);
            });

            renderLabReportsTable(filtered);
        }

        function escapeLabText(value) {
            return String(value ?? '').replace(/[&<>"']/g, char => ({
                '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
            })[char]);
        }

        function getLabReportSpecies(rep) {
            const stored = rep.report_data?._species;
            const petSpecies = rep.pets?.species || allPetsListForDropdown.find(p => p.id === rep.pet_id)?.species;
            const name = stored || petSpecies || '';
            if (name === '犬' || name === '狗' || String(name).toLowerCase() === 'dog') return 'dog';
            if (name === '貓' || String(name).toLowerCase() === 'cat') return 'cat';
            return '';
        }

        function buildLabReportHtml(rep) {
            const species = getLabReportSpecies(rep);
            const type = rep.test_type === 'CBC全血球' ? 'cbc' : 'bio';
            const metadata = labReferenceTemplates[type];
            const report = rep.report_data || {};
            const petName = rep.pets?.name || '未知寵物';
            const speciesName = species === 'dog' ? '犬' : species === 'cat' ? '貓' : '物種未記錄';
            const displayCodes = {
                pct_neu:'%Neu',pct_lym:'%Lym',pct_mono:'%Mono',pct_eos:'%Eos',pct_baso:'%Baso',
                neu:'_Neu',lym:'Lym',mono:'Mono',eos:'_Eos',baso:'_Baso',
                rdw_cv:'RDW-CV',rdw_sd:'RDW-SD',glob:'#GLOB',urea:'#UREA',c_ca:'#C-Ca',
                ag_ratio:'#A/G',bc_ratio:'#B/C',lipa:'LIPA'
            };
            const rows = [];
            const known = new Set();
            metadata.forEach(([key, label, unit, dogRange, catRange]) => {
                known.add(key);
                const result = report[key];
                if (result === '' || result === null || result === undefined) return;
                const range = species === 'dog' ? dogRange : species === 'cat' ? catRange : null;
                const normalized = String(result).trim();
                const numeric = /^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
                const abnormal = range && Number.isFinite(numeric) && (numeric < range[0] || numeric > range[1]);
                const flag = abnormal ? (numeric < range[0] ? '低' : '高') : '';
                rows.push(`<tr><th>${escapeLabText(displayCodes[key] || key.toUpperCase())}<span>${escapeLabText(label)}</span></th>` +
                    `<td class="${abnormal ? 'lab-abnormal' : ''}">${escapeLabText(result)}${flag ? ` <strong>(${flag})</strong>` : ''}</td>` +
                    `<td>${escapeLabText(unit || '—')}</td><td>${range ? escapeLabText(range.join('–')) : '—'}</td></tr>`);
            });
            Object.entries(report).forEach(([key, result]) => {
                if (key.startsWith('_') || known.has(key) || result === '' || result == null) return;
                rows.push(`<tr><th>${escapeLabText(key.toUpperCase())}</th><td>${escapeLabText(result)}</td><td>—</td><td>—</td></tr>`);
            });
            const summary = `<div class="lab-report-meta"><p><b>檢驗寵物：</b>${escapeLabText(petName)}（${speciesName}）</p>` +
                `<p><b>檢驗類別：</b>${escapeLabText(rep.test_type)}</p>` +
                `<p><b>檢驗時間：</b>${escapeLabText(new Date(rep.created_at).toLocaleString())}</p>` +
                `<p><b>臨床備註：</b>${escapeLabText(rep.notes || '無')}</p></div>`;
            const table = `<table class="lab-report-table"><thead><tr><th>項目</th><th>檢驗結果</th><th>單位</th><th>參考範圍</th></tr></thead>` +
                `<tbody>${rows.join('') || '<tr><td colspan="4">無檢驗數值</td></tr>'}</tbody></table>`;
            return summary + table + '<p class="lab-report-note">參考範圍依當次犬／貓範本顯示；非純數字的結果保留原樣，不自動判定高低。</p>';
        }

        function printLabReport() {
            const reportContent = document.querySelector('#detailModalBody .lab-report-content');
            if (!reportContent) return;
            let header;
            try { header=labPrintEightFieldHeader(document); }
            catch(error) { alert(error.message); return; }
            const popup = window.open('', '_blank');
            if (!popup) { alert('瀏覽器阻擋了列印視窗，請允許此頁開啟彈出視窗。'); return; }
            const doc = popup.document;
            const reportHeading = '吉布動物醫院 ' + (labPrintHeaderContext.type === 'CBC全血球' ? '血球報告' : '血清生化報告');
            doc.title = reportHeading;
            const style = doc.createElement('style');
            style.textContent = '@page{size:A4 portrait;margin:12mm}' +
                'html,body{margin:0;padding:0}' +
                'body{font-family:Arial,"Microsoft JhengHei",sans-serif;color:#1e293b;font-size:14px;line-height:1.3}' +
                'h2{font-size:22px;margin:0 0 11px;border-bottom:2px solid #0b6eb5;padding-bottom:7px}' +
                '.lab-report-meta{display:grid;grid-template-columns:1fr 1fr;column-gap:14px;margin-bottom:12px}' +
                '.lab-report-meta p{margin:4px 0;overflow-wrap:anywhere}' +
                'table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:9px;font-size:14px;line-height:1.25}' +
                'th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:middle;word-wrap:break-word}' +
                'thead{background:#eff6ff}thead th:nth-child(1){width:34%}' +
                'thead th:nth-child(2){width:20%}thead th:nth-child(3){width:20%}thead th:nth-child(4){width:26%}' +
                '.lab-report-table td.lab-abnormal,.lab-report-table td.lab-abnormal *{color:#dc2626!important;-webkit-text-fill-color:#dc2626!important;font-weight:bold;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}' +
                '.lab-report-table th span{margin-left:7px;color:#475569;font-weight:normal}' +
                '.lab-report-note{font-size:11px;color:#64748b;margin:10px 0 0}' +
                '.bio-print table{font-size:15px}.bio-print th,.bio-print td{padding:8px 9px}' +
                'tr{break-inside:avoid;page-break-inside:avoid}';
            doc.head.appendChild(style);
            const heading = doc.createElement('h2');
            heading.textContent = reportHeading;
            heading.style.textAlign = 'center';
            const printedReport = doc.importNode(reportContent, true);
            printedReport.querySelectorAll('.lab-report-meta').forEach(meta=>meta.remove());
            printedReport.prepend(doc.importNode(header,true));
            printedReport.querySelectorAll('.lab-abnormal').forEach(cell => {
                [cell, ...cell.querySelectorAll('*')].forEach(element => {
                    element.style.setProperty('color', '#dc2626', 'important');
                    element.style.setProperty('-webkit-text-fill-color', '#dc2626', 'important');
                    element.style.setProperty('print-color-adjust', 'exact', 'important');
                    element.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
                });
            });
            doc.body.replaceChildren(heading, printedReport);
            doc.body.className = reportContent.querySelectorAll('tbody tr').length > 20 ? 'cbc-print' : 'bio-print';
            setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print(); } }, 250);
        }

        function openLabDetailModal(rep) {
            const petName = rep.pets?.name || '未知寵物';
            document.getElementById('detailModalTitle').textContent = `🩸 血液檢驗報告詳情 - ${petName} (${rep.test_type})`;
            document.getElementById('detailModalBody').innerHTML =
                `<div class="lab-report-content">${buildLabReportHtml(rep)}</div>` +
                '<div class="lab-report-actions"><button class="btn-success" onclick="printLabReport()">🖨️ 列印此份報告</button></div>';
            document.getElementById('genericDetailModal').style.display = 'flex';
        }

        async function deleteLabReport(id) {
            if(!confirm('確定要刪除這版檢驗報告嗎？')) return;
            const { error } = await _supabase.from('lab_reports').delete().eq('id', id);
            if(error) { alert('刪除失敗'); } else { removePendingServiceRecord('lab',id); loadLabReportsList(); }
        }

        async function saveRapidTestToDatabase() {
            if (rapidRecordSaveBusy) return;
            const petId = document.getElementById('selectedRapidPetId').value;
            const testItem = document.getElementById('rapidTestItem').value;
            const batchNo = document.getElementById('rapidTestBatch').value;
            const notes = document.getElementById('rapidTestNotes').value;

            if(!petId || !testItem) { alert('請完整選擇快篩對象與快篩項目！'); return; }
            const selectedPet = allPetsListForDropdown.find(item => item.id === petId);
            const selectedType = loadedRapidTypesMap[testItem];
            if (!selectedPet || !selectedType || (selectedType.target !== '通用' && selectedType.target !== selectedPet.species)) {
                alert('快篩項目與寵物物種不符，請重新選擇。');
                updateRapidItemsForPet();
                return;
            }

            const subSelects = document.querySelectorAll('.rapid-sub-result-select');
            if(!subSelects.length || Array.from(subSelects).some(sel=>!sel.value)){alert('請逐項選擇快篩結果，不能留空。');return;}
            let resultsObj = Object.create(null);
            subSelects.forEach(sel => {
                const subName = sel.getAttribute('data-subname');
                resultsObj[subName] = sel.value;
            });

            if(document.getElementById('rapidServiceFee').value===''){alert('此快篩尚未設定預設費用，請管理者在上方種類設定儲存費用；免費請設為 0。');return;}
            let serviceCharge;
            try { serviceCharge=prepareServiceCharge('rapidServiceFee',petId,'rapid','快篩：'+testItem); } catch(error) { alert(error.message); return; }
            rapidRecordSaveBusy=true;
            try {
            const { error } = await _supabase.from('rapid_test_records').insert([{
                id:serviceCharge.id,
                tenant_id: CURRENT_TENANT_ID, pet_id: petId, test_item: testItem, result: JSON.stringify(resultsObj), batch_no: batchNo, notes: notes
            }]);

            if(error) {
                cancelServiceCharge(serviceCharge);
                alert('快篩儲存失敗：' + error.message);
            } else {
                finishServiceCharge(serviceCharge,serviceCharge.id);
                document.getElementById('rapidServiceFee').value='';
                delete document.getElementById('rapidServiceFee').dataset.rapidFeeType;
                alert('快篩檢驗報告已成功儲存，費用已加入待收費清單！');
                loadRapidReportsList();
                backToMedicalFromRapid();
            }
                    } catch(error) { alert('快篩儲存結果待確認：'+error.message+'，請保留畫面，勿重複登記。'); } finally { rapidRecordSaveBusy=false; }
        }

        async function loadRapidReportsList() {
            refreshOpenCurrentPetHistory('rapid');
            const { data, error } = await _supabase.from('rapid_test_records').select('*, pets(name)').eq('tenant_id', CURRENT_TENANT_ID).order('created_at', { ascending: false });
            if (error || !data) { allRapidReportsCache = []; } else { allRapidReportsCache = data; }
            filterRapidReportsTable();
        }

        function renderRapidReportsTable(dataList) {
            const tbody = document.getElementById('rapidReportsTableBody');
            if(!tbody) return;
            tbody.innerHTML = '';
            if (collapseHistoryUntilSearch(tbody, 'rapidReportTableSearch')) return;

            if(!dataList || dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">尚無任何檢驗紀錄</td></tr>`;
                return;
            }

            dataList.forEach(rep => {
                const petName = rep.pets ? rep.pets.name : '未知寵物';
                let parsedResult = {};
                try {
                    parsedResult = typeof rep.result === 'string' ? JSON.parse(rep.result) : rep.result;
                } catch(e) {
                    parsedResult = { "結果": rep.result };
                }

                let summaryHtml = '';
                for (let k in parsedResult) {
                    const color = parsedResult[k].includes('陽性') ? '#dc2626' : '#059669';
                    summaryHtml += `<b>${k}:</b> <span style="color: ${color};">${parsedResult[k]}</span><br>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(rep.created_at).toLocaleString()}</td>
                    <td><b>${petName}</b></td>
                    <td><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${rep.test_item}</span></td>
                    <td>${summaryHtml}</td>
                    <td><small style="color: #475569;">批號: ${rep.batch_no || '-'}</small><br>${rep.notes || ''}</td>
                    <td>
                        <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick='openRapidDetailModal(${JSON.stringify(rep)})'>檢視</button>
                        <button class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem;" onclick="deleteRapidReport('${rep.id}')">刪除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function filterRapidReportsTable() {
            const keyword = document.getElementById('rapidReportTableSearch').value.trim().toLowerCase();
            if(!keyword) { renderRapidReportsTable(allRapidReportsCache); return; }

            const filtered = allRapidReportsCache.filter(rep => {
                const petName = (rep.pets && rep.pets.name ? rep.pets.name : '').toLowerCase();
                const testItem = (rep.test_item || '').toLowerCase();
                const notes = (rep.notes || '').toLowerCase();
                return petName.includes(keyword) || testItem.includes(keyword) || notes.includes(keyword);
            });

            renderRapidReportsTable(filtered);
        }

        function openRapidDetailModal(rep) {
            const petName = rep.pets ? rep.pets.name : '未知寵物';
            let parsedResult = {};
            try {
                parsedResult = typeof rep.result === 'string' ? JSON.parse(rep.result) : rep.result;
            } catch(e) {
                parsedResult = { "結果": rep.result };
            }

            let resHtml = '';
            for (let k in parsedResult) {
                const color = parsedResult[k].includes('陽性') ? '#dc2626' : '#059669';
                resHtml += `<div style="margin-bottom: 4px;"><b>${k}:</b> <span style="color: ${color}; font-weight: bold;">${parsedResult[k]}</span></div>`;
            }

            const html = `
                <p><b>檢驗寵物：</b> ${petName}</p>
                <p><b>快篩項目：</b> <span style="color:#0369a1; font-weight:bold;">${rep.test_item}</span></p>
                <p><b>試劑批號：</b> ${rep.batch_no || '無'}</p>
                <p><b>檢驗時間：</b> ${new Date(rep.created_at).toLocaleString()}</p>
                <p><b>臨床備註：</b> ${rep.notes || '無'}</p>
                <h4 style="margin: 12px 0 6px 0; color: #1e293b;">各子項目詳細檢驗判定：</h4>
                <div style="background: #f1f5f9; padding: 12px; border-radius: 6px;">${resHtml}</div>
            `;
            document.getElementById('detailModalTitle').innerText = `🦠 快篩檢驗報告詳情 - ${petName} (${rep.test_item})`;
            document.getElementById('detailModalBody').innerHTML = html;
            document.getElementById('genericDetailModal').style.display = 'flex';
        }

        async function deleteRapidReport(id) {
            if(!confirm('確定要刪除這筆快篩紀錄嗎？')) return;
            const { error } = await _supabase.from('rapid_test_records').delete().eq('id', id);
            if(error) { alert('刪除失敗'); } else { removePendingServiceRecord('rapid',id); loadRapidReportsList(); }
        }

        let inventoryCheckoutBusy = false;
        async function commitInventoryCheckout(details) {
            if (inventoryCheckoutBusy) return null;
            inventoryCheckoutBusy = true;
            try {
                const { data, error } = await _supabase.rpc('checkout_with_inventory', details);
                if (error) throw error;
                await Promise.all([loadItems(), loadMedicines()]);
                return data;
            } catch (error) {
                alert('結帳未完成，帳單與庫存均未變更：' + error.message + '\n請確認已執行結帳庫存 SQL。');
                return null;
            } finally { inventoryCheckoutBusy = false; }
        }

        async function completeCurrentAppointmentAfterCheckout() {
            if (!currentAppointmentId) return true;

            const appointmentIdToComplete = currentAppointmentId;
            const { error } = await _supabase.from('appointments')
                .update({
                    status: '已完成',
                    completed_at: new Date().toISOString()
                })
                .eq('id', appointmentIdToComplete)
                .eq('tenant_id', CURRENT_TENANT_ID);

            if (error) {
                console.error('結帳成功，但預約完診狀態更新失敗：', error);
                alert('結帳已成功，帳單與庫存已完成；但預約狀態未能自動改為「已完成」：' + error.message);
                return false;
            }

            currentAppointmentId = null;
            activeAppointmentsList = activeAppointmentsList.filter(p => p.appointment_id !== appointmentIdToComplete);
            renderAppointmentTable(activeAppointmentsList);
            await loadAppointmentHistory('all');
            return true;
        }


function collectInvoiceDraftV74(){
            const ownerSelect = document.getElementById('invoiceOwnerSelect');
            const ownerId = ownerSelect?.value || null;
            if (!ownerId && clinicalInvoiceContext?.tenantId===CURRENT_TENANT_ID && clinicalInvoiceContext.ownerId) {throw Error('請先選定本次門診飼主');}
            const ownerName = ownerId ? ownerSelect.selectedOptions[0]?.text || '飼主' : '散客 / 未指定飼主';
            const billingContext=clinicalInvoiceContext?.tenantId===CURRENT_TENANT_ID && clinicalInvoiceContext.ownerId===ownerId ? clinicalInvoiceContext : null;
            const billingPetId=billingContext?.petId || currentPetId || null;
            const billingAppointmentId=billingContext ? billingContext.appointmentId||null : currentAppointmentId||null;
            const billingPetName=billingContext?.petName || currentPetName || '無指定寵物';
            if(clinicalInvoiceContext?.tenantId===CURRENT_TENANT_ID && clinicalInvoiceContext.ownerId!==ownerId)throw Error('帳單飼主與本次門診不符');
            const serviceIds=[],serviceRows=[];
            const paymentMethod = document.getElementById('invoicePaymentMethod')?.value || '現金';
            const discount = Number(document.getElementById('invoiceDiscount')?.value || 0);
            let medicationGroups;try{medicationGroups=collectMedicationFeesV64();}catch(e){throw e;}
            const lines = [];
            for (const row of document.querySelectorAll('#invoiceItemsList .list-row')) {
                if(row.dataset.medicationGroupV64)continue;
                const name = row.querySelector('.invoice-name')?.value.trim();
                if (!name) continue;
                const qty = Number(row.querySelector('.invoice-qty')?.value);
                const price = Number(row.querySelector('.invoice-price')?.value);
                if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
                    throw Error('請檢查帳單明細的數量與單價');
                }
                if (row.dataset.serviceChargeId) {
                    const charge=readServiceDrafts().find(x=>x.id===row.dataset.serviceChargeId);
                    if (!charge || charge.state!=='ready' || charge.petId!==billingPetId || charge.ownerId!==ownerId || charge.tenantId!==CURRENT_TENANT_ID) { throw Error('待收費項目與目前飼主／寵物不符，請重新由門診轉入收費。'); }
                    serviceIds.push(charge.id);serviceRows.push({index:lines.length,id:charge.id});
                }
                const id = row.dataset.medicineId || '';
                if (!id && !row.dataset.serviceChargeId && Object.values(loadedMedicinesMap).some(m => name.includes(m.name))) {
                    throw Error('手動輸入的藥品無法對應庫存，請從處方選藥後轉入結帳');
                }
                if (id && !loadedMedicinesMap[id]) { throw Error('處方藥品資料已變更，請重新開立'); }
                const baseName = row.dataset.medicineName || '';
                if (id && !name.includes(baseName)) { throw Error('處方藥品名稱已更改，請重新開立'); }
                lines.push({ item_name: name, quantity: qty, unit_price: price,
                    stock_kind: id ? 'medicine' : '', stock_id: id });
            }
            if (!lines.length&&!medicationGroups.length) { throw Error('帳單沒有明細'); }
            const subtotal = lines.reduce((sum, x) => sum + x.quantity * x.unit_price, 0)+medicationGroups.reduce((sum,g)=>sum+g.price,0);
            if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) { throw Error('折扣金額不正確'); }
            const total = subtotal - discount;

 return {ownerId,ownerName,billingPetId,billingPetName,billingAppointmentId,serviceIds,serviceRows,paymentMethod,discount,medicationGroups,lines,subtotal,total};
}
        async function processInvoiceCheckoutToArchive(shouldPrintReceipt = true) {
            if (inventoryCheckoutBusy) return;
            let draft;try{draft=collectInvoiceDraftV74();}catch(e){alert(e.message);return;}
            const {ownerId,ownerName,billingPetId,billingPetName,billingAppointmentId,serviceIds,paymentMethod,discount,medicationGroups,lines,subtotal,total}=draft;
            const id = await commitInventoryCheckout({ p_tenant_id: CURRENT_TENANT_ID,
                p_owner_id: ownerId, p_pet_id: billingPetId,
                p_checkout_type: `門診收費 (${paymentMethod})`, p_category: '門診', p_appointment_id: billingAppointmentId,
                p_subtotal: subtotal, p_discount: discount, p_total: total, p_lines: lines, ...(medicationGroups.length?{p_medication_groups:medicationGroups}:{}) });
            if (!id) return;
            document.getElementById('invoiceDiscount').value = '0'; // 本筆成功後重設；收據仍使用原折扣快照。
            try { markServiceChargesPaid(serviceIds,id); } catch(error) { alert('帳單已成功儲存，但待收費暫存更新失敗；請勿重複結帳，帳單號：'+id); }
            const invoice = { id, created_at: new Date().toISOString(),
                checkout_type: `門診收費 (${paymentMethod})`, subtotal, discount, total_amount: total };
            const receiptLines = [...lines,...medicationGroups.map(g=>({item_name:medicationGroupLabelsV64[g.kind],quantity:1,unit_price:g.price}))].map(x => ({ item_name: `${x.item_name} [付款: ${paymentMethod}]`,
                quantity: x.quantity, subtotal: x.quantity*x.unit_price }));

            await finishDoctorInvoiceV57(billingAppointmentId);

            if (shouldPrintReceipt) {
                openReceiptModal(invoice, ownerName, billingPetName, receiptLines);
            } else {
                alert('結帳成功，帳單與庫存已同步儲存');
                switchTab('appointments');
                await loadAppointments();
            }
            clinicalInvoiceContext=null;clinicalMedicationGroupsV64=null;
            document.getElementById('invoiceItemsList').innerHTML = '';
            calculateInvoiceTotal();
        }

        function openReceiptModal(invoiceData, ownerName, petName, itemsArray) {
            console.log("正在開啟收據彈窗...");
            try {
                const setTxt = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = val;
                };

                setTxt('receiptClinicName', (typeof clinicSettings !== 'undefined' && clinicSettings.name) ? clinicSettings.name : '吉布動物醫院');
                setTxt('receiptClinicPhone', `電話: ${(typeof clinicSettings !== 'undefined' && clinicSettings.phone) ? clinicSettings.phone : '02-8888-9999'}`);
                setTxt('receiptClinicAddress', `地址: ${(typeof clinicSettings !== 'undefined' && clinicSettings.address) ? clinicSettings.address : '台北市中正區動物路一段88號'}`);

                const rawId = invoiceData.id ? String(invoiceData.id) : 'REC-001';
                setTxt('receiptNo', rawId.length > 8 ? rawId.slice(0, 8).toUpperCase() : rawId.toUpperCase());
                setTxt('receiptDate', new Date(invoiceData.created_at || Date.now()).toLocaleString());
                setTxt('receiptOwnerName', ownerName || '散客 / 未指定飼主');
                setTxt('receiptPetName', petName || '無指定寵物');
                setTxt('receiptPaymentMethod', invoiceData.checkout_type || '現金');

                const tbody = document.getElementById('receiptItemsTableBody');
                if (tbody) {
                    tbody.innerHTML = '';
                    if (itemsArray && itemsArray.length > 0) {
                        itemsArray.forEach(item => {
                            const tr = document.createElement('tr');
                            const sub = item.subtotal !== undefined ? item.subtotal : (item.quantity * (item.unit_price || 0));
                            tr.innerHTML = `
                                <td>${item.item_name}</td>
                                <td style="text-align: center;">${item.quantity}</td>
                                <td style="text-align: right;">NT$ ${sub.toLocaleString()}</td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                }

                setTxt('receiptSubtotal', (invoiceData.subtotal || 0).toLocaleString());
                setTxt('receiptDiscount', (invoiceData.discount || 0).toLocaleString());
                setTxt('receiptTotalAmount', (invoiceData.total_amount || 0).toLocaleString());

                const modal = document.getElementById('receipt-modal');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.style.zIndex = '999999';
                    console.log("收據彈窗已成功強制顯示！");
                } else {
                    alert("找不到收據彈窗元件 (#receipt-modal)，請檢查 HTML！");
                }
            } catch (e) {
                console.error("開啟收據發生例外狀況:", e);
                alert("顯示收據時發生錯誤：" + e.message);
            }
        }

async function processProductCheckoutToArchive(shouldPrintReceipt = true) {
            if (inventoryCheckoutBusy) return;
            const customerInput=document.getElementById('checkoutOwnerSearch');
            if (customerInput?.value.trim()) {
                const previousProductPetId=document.getElementById('checkoutPetSelect')?.value||'';
                onCheckoutOwnerInput({target:customerInput});
                const productPetSelect=document.getElementById('checkoutPetSelect');
                if (previousProductPetId && productPetSelect && Array.from(productPetSelect.options).some(o=>o.value===previousProductPetId)) productPetSelect.value=previousProductPetId;
                if (!document.getElementById('selectedCheckoutOwnerId')?.value) {alert('已輸入飼主，但尚未選定資料。請點選搜尋建議中的飼主後再結帳；散客請清空飼主欄。');return;}
            } else document.getElementById('selectedCheckoutOwnerId').value='';
            const ownerId = document.getElementById('selectedCheckoutOwnerId')?.value || null;
            const petId = document.getElementById('checkoutPetSelect')?.value || null;
            const ownerName = document.getElementById('checkoutOwnerSearch')?.value.trim() || '散客 / 未指定飼主';
            const discount = Number(document.getElementById('checkoutDiscount')?.value || 0);
            const lines = [];
            for (const row of document.querySelectorAll('#productCheckoutItems .checkout-item-row')) {
                const name = row.querySelector('.checkout-item-name')?.value.trim();
                if (!name) continue;
                const qty = Number(row.querySelector('.qty-input')?.value);
                const price = Number(row.querySelector('.price-input')?.value);
                if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
                    alert('商品數量須為正整數，單價不可為負'); return;
                }
                const itemId = row.dataset.stockId || '';
                const item = loadedItemsMap[itemId];
                if (!item || item.name !== name) { alert(`「${name}」尚未從已建檔商品選取，請先建檔再加入購物車`); return; }
                lines.push({ item_name: name, quantity: qty, unit_price: price,
                    stock_kind: 'item', stock_id: itemId });
            }
            if (!lines.length) { alert('購物車沒有商品'); return; }
            const subtotal = lines.reduce((sum,x) => sum+x.quantity*x.unit_price,0);
            if (discount < 0 || discount > subtotal) { alert('折扣金額不正確'); return; }
            const category = document.querySelector('#productCheckoutItems .checkout-item-row')?.dataset.category || '一般商品';
            const id = await commitInventoryCheckout({ p_tenant_id: CURRENT_TENANT_ID,
                p_owner_id: ownerId, p_pet_id: petId, p_checkout_type: '商品零售', p_category: category,
                p_subtotal: subtotal, p_discount: discount, p_total: subtotal-discount, p_lines: lines });
            if (!id) return;
            document.getElementById('checkoutDiscount').value = '0'; // 本筆成功後重設；收據仍使用原折扣快照。
            const invoice = { id, created_at: new Date().toISOString(), checkout_type: '商品零售 ('+document.getElementById('posRetailMethodV77').value+')',
                subtotal, discount, total_amount: subtotal-discount };
            if (shouldPrintReceipt) openReceiptModal(invoice, ownerName, '商品選購 (無指定寵物)',
                lines.map(x => ({...x,subtotal:x.quantity*x.unit_price})));
            else alert('商品結帳成功，庫存已扣除');
            document.getElementById('productCheckoutItems').innerHTML = '';
            document.getElementById('checkoutOwnerSearch').value = '';
            document.getElementById('selectedCheckoutOwnerId').value = '';
            document.getElementById('checkoutPetSelect').innerHTML = '<option value="">-- 請先選擇飼主或不指定寵物 --</option>';
            calculateProductTotal();
        }
        // 總覽清單預設收合；搜尋後才顯示符合的資料。
        (function setupSearchOnlyOverviews() {
            const overviews = [
                ['searchMedTableBody', 'searchMedKeyword'],
                ['searchVacTableBody', 'searchVacKeyword'],
                ['searchMedUsageTableBody', 'searchMedUsageKeyword'],
                ['searchSalesTableBody', 'searchSalesKeyword'],
                ['integratedTableBody', 'ownerPetTableSearch'],
                ['petVaccineTableBody', 'vacReportTableSearch'],
                ['itemTableBody', 'itemOverviewSearch', true],
                ['medicineTableBody', 'medicineOverviewSearch', true],
                ['labReportsTableBody', 'labReportTableSearch'],
                ['rapidReportsTableBody', 'rapidReportTableSearch']
            ];
            overviews.forEach(([bodyId, inputId, filterRows]) => {
                const body = document.getElementById(bodyId);
                const input = document.getElementById(inputId);
                if (!body || !input) return;
                const table = body.closest('table');
                const hint = document.createElement('p');
                hint.style.cssText = 'color:#64748b;margin:10px 0 0';
                hint.textContent = '輸入關鍵字後顯示符合的資料。';
                table.insertAdjacentElement('afterend', hint);
                const update = () => {
                    const keyword = input.value.trim().toLocaleLowerCase();
                    table.style.display = keyword ? '' : 'none';
                    hint.style.display = keyword ? 'none' : '';
                    if (filterRows) {
                        let matches = 0;
                        body.querySelectorAll('tr').forEach(row => {
                            const found = row.textContent.toLocaleLowerCase().includes(keyword);
                            row.style.display = found ? '' : 'none';
                            if (found) matches++;
                        });
                        if (keyword && !matches) {
                            hint.textContent = '找不到符合的資料。';
                            hint.style.display = '';
                        } else {
                            hint.textContent = '輸入關鍵字後顯示符合的資料。';
                        }
                    }
                };
                input.addEventListener('input', update);
                if (filterRows) new MutationObserver(update).observe(body, {childList:true, subtree:true});
                update();
            });
        })();

        // ===== 第 13 步：用藥申報與管制藥品中心 =====
        let regulatoryTransactionsCache = [];
        let controlledLedgerCache = [];

        function escapeRegText(value) {
            return String(value ?? '').replace(/[&<>"']/g, c => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
            })[c]);
        }

        function initRegulatoryCenterDates() {
            const start = document.getElementById('regStartDate');
            const end = document.getElementById('regEndDate');
            if (!start || !end || (start.value && end.value)) return;
            const now = new Date();
            const first = new Date(now.getFullYear(), now.getMonth(), 1);
            const localDate = d => {
                const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
                return `${y}-${m}-${day}`;
            };
            start.value = localDate(first);
            end.value = localDate(now);
        }

        function regulatoryDateBounds() {
            const start = document.getElementById('regStartDate')?.value;
            const end = document.getElementById('regEndDate')?.value;
            if (!start || !end) return null;
            return {
                startIso: new Date(start + 'T00:00:00').toISOString(),
                endIso: new Date(end + 'T23:59:59.999').toISOString()
            };
        }

        async function loadRegulatoryCenter() {
            initRegulatoryCenterDates();
            const bounds = regulatoryDateBounds();
            if (!bounds) return;
            const filter = document.getElementById('regTypeFilter')?.value || 'all';

            let q = _supabase.from('v_regulatory_transactions')
                .select('*')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .gte('occurred_at', bounds.startIso)
                .lte('occurred_at', bounds.endIso)
                .order('occurred_at', { ascending:false });
            if (filter === 'veterinary_medicine') q = q.eq('regulatory_class', '動物用藥品');
            if (filter === 'veterinary_product') q = q.eq('regulatory_class', '動物用商品');
            if (filter === 'controlled') q = q.eq('controlled_drug', true);

            const { data, error } = await q;
            if (error) {
                alert('載入用藥申報資料失敗：' + error.message);
                return;
            }
            regulatoryTransactionsCache = data || [];
            renderRegulatoryTransactions();

            const { data: ledger, error: ledgerError } = await _supabase
                .from('v_controlled_drug_ledger')
                .select('*')
                .eq('tenant_id', CURRENT_TENANT_ID)
                .gte('occurred_at', bounds.startIso)
                .lte('occurred_at', bounds.endIso)
                .order('occurred_at', { ascending:false });
            if (!ledgerError) {
                controlledLedgerCache = ledger || [];
                renderControlledLedger();
            }
        }

        function renderRegulatoryTransactions() {
            const body = document.getElementById('regulatoryTransactionBody');
            if (!body) return;
            const rows = regulatoryTransactionsCache;
            document.getElementById('regStatCount').textContent = rows.length;
            document.getElementById('regStatMedicine').textContent = rows.filter(x => x.regulatory_class === '動物用藥品').length;
            document.getElementById('regStatProduct').textContent = rows.filter(x => x.regulatory_class === '動物用商品').length;
            document.getElementById('regStatControlled').textContent = rows.filter(x => x.controlled_drug).length;
            document.getElementById('regStatMissingLot').textContent = rows.filter(x => !x.lot_no).length;
            if (!rows.length) {
                body.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#64748b;">此期間尚無正式用藥異動資料</td></tr>';
                return;
            }
            body.innerHTML = rows.map(x => {
                const income = x.direction === 'IN' ? x.quantity : '';
                const expense = x.direction === 'OUT' ? x.quantity : '';
                const patient = [x.owner_name, x.pet_name].filter(Boolean).join('／') || '-';
                return `<tr>
                    <td>${escapeRegText(new Date(x.occurred_at).toLocaleString())}</td>
                    <td><b>${escapeRegText(x.item_name)}</b>${x.controlled_drug ? '<br><small style="color:#b91c1c;font-weight:700;">管制藥品</small>' : ''}</td>
                    <td>${escapeRegText(x.regulatory_class || '-')}</td>
                    <td>${escapeRegText(x.veterinary_license_no || '-')}</td>
                    <td>${escapeRegText(x.lot_no || '⚠ 未填')}</td>
                    <td>${escapeRegText(income)}</td><td>${escapeRegText(expense)}</td>
                    <td>${escapeRegText(x.smallest_unit || '-')}</td>
                    <td>${escapeRegText(patient)}</td>
                    <td>${escapeRegText(x.veterinarian_name || '-')}</td>
                    <td>${escapeRegText(x.reason_text || x.reason_code || '-')}</td>
                </tr>`;
            }).join('');
        }

        function renderControlledLedger() {
            const body = document.getElementById('controlledLedgerBody');
            if (!body) return;
            if (!controlledLedgerCache.length) {
                body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b;">此期間尚無管制藥品異動</td></tr>';
                return;
            }
            body.innerHTML = controlledLedgerCache.map(x => `<tr>
                <td>${escapeRegText(x.ledger_date || '')}</td>
                <td><b>${escapeRegText(x.item_name)}</b></td>
                <td>${x.controlled_level ? '第 ' + escapeRegText(x.controlled_level) + ' 級' : '-'}</td>
                <td>${escapeRegText(x.lot_no || '-')}</td>
                <td>${escapeRegText(x.income_qty || 0)}</td>
                <td>${escapeRegText(x.expense_qty || 0)}</td>
                <td><b>${escapeRegText(x.balance_after ?? '-')}</b></td>
                <td>${escapeRegText(x.smallest_unit || '-')}</td>
                <td>${escapeRegText(x.reason_code || x.counterparty_name || '-')}</td>
            </tr>`).join('');
        }

        async function loadRegulatoryReportHistory() {
            const body = document.getElementById('regulatoryReportHistoryBody');
            if (!body || !CURRENT_TENANT_ID) return;
            const { data, error } = await _supabase.from('regulatory_report_batches')
                .select('*').eq('tenant_id', CURRENT_TENANT_ID)
                .order('created_at', { ascending:false }).limit(100);
            if (error || !data?.length) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;">尚無申報快照</td></tr>';
                return;
            }
            body.innerHTML = data.map(x => `<tr>
                <td>${escapeRegText(x.period_start)} ～ ${escapeRegText(x.period_end)}</td>
                <td>${escapeRegText(x.report_type)}</td>
                <td>${escapeRegText(x.status)}</td>
                <td>${escapeRegText(x.file_name || '-')}</td>
                <td>${escapeRegText(x.row_count || 0)}</td>
                <td>${escapeRegText(x.generated_at ? new Date(x.generated_at).toLocaleString() : '-')}</td>
            </tr>`).join('');
        }

        function regulatoryExportRows() {
            return regulatoryTransactionsCache.map(x => ({
                '日期時間': new Date(x.occurred_at).toLocaleString(),
                '品項': x.item_name || '',
                '法規分類': x.regulatory_class || '',
                '許可證字號': x.veterinary_license_no || '',
                '有效成分': x.active_ingredient || '',
                '規格': x.strength || '',
                '劑型': x.dosage_form || '',
                '批號': x.lot_no || '',
                '效期': x.expiry_date || '',
                '收入量': x.direction === 'IN' ? x.quantity : '',
                '支出量': x.direction === 'OUT' ? x.quantity : '',
                '最小單位': x.smallest_unit || '',
                '結存': x.balance_after ?? '',
                '飼主': x.owner_name || '',
                '寵物': x.pet_name || '',
                '動物種類': x.pet_species || '',
                '獸醫師': x.veterinarian_name || '',
                '管制藥品': x.controlled_drug ? '是' : '否',
                '管制級別': x.controlled_level || '',
                '原因': x.reason_text || x.reason_code || '',
                '單據號碼': x.document_no || ''
            }));
        }

        async function copyRegulatoryTableForExcel() {
            const rows = regulatoryExportRows();
            if (!rows.length) { alert('目前沒有可複製的申報資料'); return; }
            const headers = Object.keys(rows[0]);
            const tsv = [headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '').replace(/\t|\r?\n/g,' ')).join('\t'))].join('\n');
            try {
                await navigator.clipboard.writeText(tsv);
                alert('已複製，可直接貼到 Excel。');
            } catch (e) {
                alert('瀏覽器無法直接寫入剪貼簿，請使用「匯出 Excel」或允許剪貼簿權限。');
            }
        }

        function exportRegulatoryExcel() {
            const rows = regulatoryExportRows();
            if (!rows.length) { alert('目前沒有可匯出的申報資料'); return; }
            if (typeof XLSX === 'undefined') {
                alert('Excel 元件尚未載入，請確認網路連線後重新整理。');
                return;
            }
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '全部申報明細');

            const medicineRows = rows.filter(r => r['法規分類'] === '動物用藥品');
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(medicineRows.length ? medicineRows : [{'說明':'本期間無動物用藥品異動'}]),
                '動物用藥品'
            );

            const productRows = rows.filter(r => r['法規分類'] === '動物用商品');
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(productRows.length ? productRows : [{'說明':'本期間無動物用商品異動'}]),
                '動物用商品'
            );

            const controlledRows = rows.filter(r => r['管制藥品'] === '是');
            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(controlledRows.length ? controlledRows : [{'說明':'本期間無管制藥品異動'}]),
                '管制藥品收支結存'
            );
            const start = document.getElementById('regStartDate')?.value || '';
            const end = document.getElementById('regEndDate')?.value || '';
            XLSX.writeFile(wb, `genblueAH_用藥申報_${start}_${end}.xlsx`);
        }

    
        // 第16.2步：初始化申報欄位顯示狀態
        setTimeout(() => {
            try { onUpperMedicineCategoryChange(); } catch (e) {}
        }, 0);

        async function loadDiagnosticExchangeCenter() {
            if (!CURRENT_TENANT_ID) return;
            const [devicesRes, jobsRes, resultsRes, imagingRes] = await Promise.all([
                _supabase.from('diagnostic_devices').select('*').eq('tenant_id', CURRENT_TENANT_ID).order('created_at',{ascending:false}),
                _supabase.from('diagnostic_import_jobs').select('id',{count:'exact'}).eq('tenant_id', CURRENT_TENANT_ID),
                _supabase.from('diagnostic_results').select('id',{count:'exact'}).eq('tenant_id', CURRENT_TENANT_ID),
                _supabase.from('imaging_studies').select('id',{count:'exact'}).eq('tenant_id', CURRENT_TENANT_ID)
            ]);
            if (devicesRes.error) {
                document.getElementById('dxDeviceTableBody').innerHTML =
                    `<tr><td colspan="5" style="text-align:center;color:#dc2626;">尚未建立第17.1步資料表，請先執行 SQL。</td></tr>`;
                return;
            }
            const devices = devicesRes.data || [];
            const importDevice = document.getElementById('dxImportDevice');
            if (importDevice) {
                const current = importDevice.value;
                importDevice.innerHTML = '<option value="">未指定／先測試檔案</option>' +
                    devices.filter(d => ['CBC','BIOCHEM'].includes(d.device_type))
                    .map(d => `<option value="${d.id}">${escapeRegText(d.name)}｜${escapeRegText(d.device_type)}</option>`).join('');
                if ([...importDevice.options].some(o => o.value === current)) importDevice.value = current;
            }
            document.getElementById('dxDeviceCount').textContent = devices.length;
            document.getElementById('dxImportCount').textContent = jobsRes.count || 0;
            document.getElementById('dxResultCount').textContent = resultsRes.count || 0;
            document.getElementById('dxImagingCount').textContent = imagingRes.count || 0;
            document.getElementById('dxDeviceTableBody').innerHTML = devices.length ? devices.map(d=>`
                <tr>
                    <td><b>${escapeRegText(d.name)}</b></td>
                    <td>${escapeRegText(d.device_type)}</td>
                    <td>${escapeRegText([d.manufacturer,d.model].filter(Boolean).join(' / ') || '-')}</td>
                    <td>${escapeRegText(d.adapter_type)}</td>
                    <td>${d.is_active ? '啟用' : '停用'}</td>
                </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#64748b;">尚未設定儀器</td></tr>';
        }

        async function saveDiagnosticDevice() {
            const name=document.getElementById('dxDeviceName').value.trim();
            if(!name){alert('請輸入儀器名稱');return;}
            const payload={
                tenant_id:CURRENT_TENANT_ID,
                name,
                device_type:document.getElementById('dxDeviceType').value,
                manufacturer:document.getElementById('dxManufacturer').value.trim()||null,
                model:document.getElementById('dxModel').value.trim()||null,
                serial_no:document.getElementById('dxSerialNo').value.trim()||null,
                adapter_type:document.getElementById('dxAdapterType').value
            };
            const {error}=await _supabase.from('diagnostic_devices').insert([payload]);
            if(error){alert('新增儀器失敗：'+error.message);return;}
            ['dxDeviceName','dxManufacturer','dxModel','dxSerialNo'].forEach(id=>document.getElementById(id).value='');
            await loadDiagnosticExchangeCenter();
            alert('儀器設定已建立。');
        }

        function detectDiagnosticDelimiter(line) {
            const candidates = [
                {d:'\t', n:(line.match(/\t/g)||[]).length},
                {d:',', n:(line.match(/,/g)||[]).length},
                {d:';', n:(line.match(/;/g)||[]).length},
                {d:'|', n:(line.match(/\|/g)||[]).length}
            ].sort((a,b)=>b.n-a.n);
            return candidates[0].n > 0 ? candidates[0].d : null;
        }

        function splitDiagnosticLine(line, delimiter) {
            if (!delimiter) return [line.trim()];
            if (delimiter !== ',') return line.split(delimiter).map(v=>v.trim());
            const out=[]; let cur=''; let quoted=false;
            for(let i=0;i<line.length;i++){
                const ch=line[i];
                if(ch === '"'){
                    if(quoted && line[i+1] === '"'){ cur+='"'; i++; }
                    else quoted=!quoted;
                } else if(ch === ',' && !quoted){
                    out.push(cur.trim()); cur='';
                } else cur+=ch;
            }
            out.push(cur.trim());
            return out;
        }

        function escapeDxHtml(v) {
            return String(v ?? '').replace(/[&<>"']/g, m=>({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
            })[m]);
        }

        let pendingSkylaPdf = null;
        async function previewSkylaPdf(file) {
            pendingSkylaPdf = null;
            document.getElementById('dxSkylaSavePanel').style.display='none';
            const info = document.getElementById('dxFileInfo');
            const wrap = document.getElementById('dxImportPreviewWrap');
            info.style.display='block'; wrap.style.display='none';
            info.textContent='正在讀取 Skyla PDF…';
            if (file.size > 10 * 1024 * 1024) { info.textContent='PDF 超過 10 MB，請選擇單份報告。'; return; }
            if (!window.pdfjsLib) { info.textContent='PDF 讀取元件未載入，請檢查網路連線後重新整理。'; return; }
            try {
                pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const doc = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
                const codePattern=/^(?:#?(?:ALB|TP|GLU|CHOL|ALP|ALT|GGT|TBIL|AMY|BUN|CREA|CA|PHOS|GLOB|UREA|C-CA|A\/G|B\/C|NA\/K|NA|K|LIPA)(?:\s*\(FPL\))?)$/i;
                const rows=[];
                for (let pageNo=1;pageNo<=Math.min(doc.numPages,5);pageNo++) {
                    const content=await (await doc.getPage(pageNo)).getTextContent();
                    const parts=content.items.filter(i=>i.str && i.str.trim()).map(i=>({s:i.str.trim(),x:i.transform[4],y:i.transform[5]}));
                    const labels=parts.filter(i=>i.x<115 && codePattern.test(i.s));
                    for (const label of labels) {
                        const same=parts.filter(i=>Math.abs(i.y-label.y)<4).sort((a,b)=>a.x-b.x);
                        const cells=(lo,hi)=>same.filter(i=>i.x>=lo && i.x<hi).map(i=>i.s).join(' ').trim();
                        const raw=cells(170,237);
                        const value=(raw.match(/(?:N\.?A\.?|[<>≤≥]?\s*[-+]?\d+(?:\.\d+)?)/i)||[])[0]||'';
                        const code=label.s.toUpperCase();
                        rows.push({code,value:value.trim(),unit:cells(237,275),reference:cells(275,355),page:pageNo});
                    }
                }
                if (!rows.length) {
                    info.textContent='這份 PDF 沒有辨識到 Skyla 檢驗數值，可能是掃描圖片或其他報告格式；請提供原始匯出檔。';
                    return;
                }
                pendingSkylaPdf={name:file.name,rows};
                populateDxPetChoices();
                document.getElementById('dxSkylaSavePanel').style.display='block';
                document.getElementById('dxImportKind').value='BIOCHEM';
                document.getElementById('dxImportPreviewHead').innerHTML='<tr><th>項目</th><th>結果（含原始符號）</th><th>單位</th><th>報告參考範圍</th><th>頁數</th></tr>';
                document.getElementById('dxImportPreviewBody').innerHTML=rows.map(r=>
                    '<tr>'+[r.code,r.value||'未讀到',r.unit,r.reference,r.page].map(v=>'<td>'+escapeDxHtml(v)+'</td>').join('')+'</tr>'
                ).join('');
                document.getElementById('dxRawFileText').textContent=rows.map(r=>`${r.code}  ${r.value}  ${r.unit}  ${r.reference}`).join('\n');
                info.innerHTML=`<b>${escapeDxHtml(file.name)}</b>　${rows.length} 個項目　Skyla PDF 預覽<br><span style="color:#b45309">PDF 中文文字可能亂碼；請以紙本核對數值、符號、單位和參考範圍。選擇寵物、填入原始日期並確認後才會儲存。</span>`;
                wrap.style.display='block';
            } catch(error) { info.textContent='PDF 讀取失敗：'+(error.message||String(error)); }
        }

        function resetSkylaExchangeAfterSave() {
            pendingSkylaPdf=null;
            document.getElementById('dxImportFile').value='';
            document.getElementById('dxPetSearchInput').value='';
            document.getElementById('dxSelectedPetId').value='';
            document.getElementById('dxExamDate').value='';
            document.getElementById('dxSkylaSavePanel').style.display='none';
            document.getElementById('dxFileInfo').style.display='none';
            document.getElementById('dxFileInfo').textContent='';
            document.getElementById('dxImportPreviewWrap').style.display='none';
            document.getElementById('dxImportPreviewHead').replaceChildren();
            document.getElementById('dxImportPreviewBody').replaceChildren();
            document.getElementById('dxRawFileText').textContent='';
        }

        function populateDxPetChoices() {
            const list=document.getElementById('dxPetDatalist');
            if (!list) return;
            list.replaceChildren();
            for (const pet of allPetsListForDropdown) {
                const option=document.createElement('option');
                option.value=`${pet.name} (飼主: ${pet.owner_name} / 晶片: ${pet.microchip||'無'} / 編號: ${pet.owner_code||'-'})`;
                option.dataset.petId=pet.id;
                list.appendChild(option);
            }
        }
        function selectDxPet() {
            const input=document.getElementById('dxPetSearchInput').value;
            const match=[...document.getElementById('dxPetDatalist').options].find(o=>o.value===input);
            document.getElementById('dxSelectedPetId').value=match?.dataset.petId||'';
        }
        async function saveSkylaFromExchange() {
            if (!pendingSkylaPdf) { alert('請先選擇 Skyla PDF。'); return; }
            if (!transferSkylaPreviewToLab()) return;
            await saveLabReportToDatabase();
        }

        function transferSkylaPreviewToLab() {
            if (!pendingSkylaPdf?.rows?.length) { alert('請先預覽 Skyla PDF。'); return; }
            const petId=document.getElementById('dxSelectedPetId').value;
            const pet=allPetsListForDropdown.find(p=>p.id===petId);
            if (!pet) { alert('請在交換中心搜尋並選取正確的寵物。'); return false; }
            const species=['犬','狗','dog'].includes(String(pet.species).toLowerCase()) ? 'dog' : ['貓','cat'].includes(String(pet.species).toLowerCase()) ? 'cat' : '';
            if (!species) { alert('選擇的寵物須設定為犬或貓；請先核對資料。'); return false; }
            const date=document.getElementById('dxExamDate').value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) {
                alert('請依原始 PDF 輸入有效的檢驗日期，例如 2016-09-28。'); return false;
            }
            const map={'ALB':'alb','TP':'tp','GLU':'glu','CHOL':'chol','ALP':'alp','ALT':'alt','GGT':'ggt','TBIL':'tbil','AMY':'amy','BUN':'bun','CREA':'crea','CA':'ca','PHOS':'phos','#GLOB':'glob','#UREA':'urea','#C-CA':'c_ca','#A/G':'ag_ratio','#B/C':'bc_ratio','LIPA':'lipa','LIPA (FPL)':'lipa'};
            const existing=document.querySelectorAll('#bioLabRows .lab-result-input');
            if ([...existing].some(i=>i.value.trim()) && !confirm('生化輸入表已有數值，帶入會覆蓋相同項目。確定繼續？')) return false;
            document.getElementById('selectedLabPetId').value=petId;
            const labOption=[...document.getElementById('labPetDatalist').options].find(o=>o.dataset.petId===petId);
            document.getElementById('labPetSearchInput').value=labOption?.value||pet.name;
            document.getElementById('labTestType').value='血液生化';
            renderLabSpeciesTemplates(); toggleLabFormFields();
            const targets=pendingSkylaPdf.rows.map(r=>({r,input:document.getElementById('bio_'+map[r.code])})).filter(x=>x.input && x.r.value);
            if (!targets.length) { alert('PDF 預覽未找到可對應的生化項目，請傳送解析預覽截圖。'); return false; }
            if (!confirm(`請核對原始 PDF 的病患身分。\n系統選擇：${pet.name}（${pet.species}）\nPDF：${pendingSkylaPdf.name}\n檢驗日期：${date}\n將帶入 ${targets.length} 項並準備儲存。確定？`)) return false;
            for (const {r} of targets) {
                const input=document.getElementById('bio_'+map[r.code]);
                if (input) { input.value=r.value; input.dispatchEvent(new Event('input',{bubbles:true})); }
            }
            const note=document.getElementById('labReportNotes');
            const provenance=`Skyla VC-P21 PDF：${pendingSkylaPdf.name}；原始檢驗日期：${date}；已由人員核對報告與病患。`;
            note.value=[note.value.trim().replace(/Skyla VC-P21 PDF：[^；]*；原始檢驗日期：\d{4}-\d{2}-\d{2}；已由人員核對報告與病患。/g,'').trim(),provenance].filter(Boolean).join(' ');
            pendingSkylaTransfer={petId,date,marker:`Skyla VC-P21 PDF：${pendingSkylaPdf.name}；原始檢驗日期：${date}`};
            return true;
        }

        async function previewDiagnosticFile(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (/\.pdf$/i.test(file.name)) { await previewSkylaPdf(file); return; }
            pendingSkylaPdf=null;
            document.getElementById('dxSkylaSavePanel').style.display='none';
            const allowedExt = /\.(csv|txt)$/i.test(file.name);
            if (!allowedExt) {
                alert('目前支援 CSV、TXT 與 Skyla 文字型 PDF。');
                event.target.value='';
                return;
            }

            let text = await file.text();
            text = text.replace(/^\uFEFF/, '');
            document.getElementById('dxRawFileText').textContent = text;

            const lines = text.split(/\r?\n/).filter(x=>x.trim()!=='');
            const info = document.getElementById('dxFileInfo');
            const wrap = document.getElementById('dxImportPreviewWrap');
            if (!lines.length) {
                info.style.display='block';
                info.innerHTML='<b>檔案沒有可讀取的文字內容。</b>';
                wrap.style.display='none';
                return;
            }

            const delimiter = detectDiagnosticDelimiter(lines[0]);
            const delimiterName = delimiter === '\t' ? 'Tab' :
                                  delimiter === ',' ? '逗號 CSV' :
                                  delimiter === ';' ? '分號' :
                                  delimiter === '|' ? '直線符號 |' : '單欄文字';

            const rows = lines.slice(0, 101).map(line=>splitDiagnosticLine(line, delimiter));
            const maxCols = Math.max(...rows.map(r=>r.length));
            const first = rows[0] || [];
            const looksHeader = first.some(v => /[A-Za-z\u4e00-\u9fff]/.test(v)) &&
                                first.filter(v => /^[-+]?\d+(\.\d+)?$/.test(v)).length < Math.ceil(first.length/2);

            let headers;
            let bodyRows;
            if (looksHeader) {
                headers = Array.from({length:maxCols},(_,i)=>first[i] || `欄位 ${i+1}`);
                bodyRows = rows.slice(1);
            } else {
                headers = Array.from({length:maxCols},(_,i)=>`欄位 ${i+1}`);
                bodyRows = rows;
            }

            document.getElementById('dxImportPreviewHead').innerHTML =
                '<tr>' + headers.map(h=>`<th>${escapeDxHtml(h)}</th>`).join('') + '</tr>';
            document.getElementById('dxImportPreviewBody').innerHTML =
                bodyRows.slice(0,100).map(r =>
                    '<tr>' + headers.map((_,i)=>`<td>${escapeDxHtml(r[i] ?? '')}</td>`).join('') + '</tr>'
                ).join('');

            info.style.display='block';
            info.innerHTML = `<b>${escapeDxHtml(file.name)}</b>　
                ${(file.size/1024).toFixed(1)} KB　
                ${lines.length} 行　
                分隔格式：${delimiterName}
                ${lines.length > 101 ? '　<span style="color:#b45309;">預覽前 100 筆</span>' : ''}`;
            wrap.style.display='block';
        }

// v26 presentation reads the same filtered appointments and clones their existing actions.
const JOURNAL_BRITISH_CAT = '/assets/frontend/images/9e266a96b76ba4f0ad28eb72ff97fcbdc873346b8c0977baaf6dd9eeacbc5bda.png?v=9e266a96b76ba4f0ad28eb72ff97fcbdc873346b8c0977baaf6dd9eeacbc5bda';
function setJournalOriginalAvatar(node, breed, species) {
    node.replaceChildren();
    const normalized=String(breed||'').trim().toLowerCase().replace(/[\s_-]/g,'');
    const catSpecies=/貓|猫|cat|feline/i.test(String(species||''));
    if(catSpecies && ['英短','英國短毛','英国短毛','英國短毛貓','英国短毛猫','britishshorthair'].includes(normalized)){
        const img=document.createElement('img');img.src=JOURNAL_BRITISH_CAT;img.alt='英國短毛貓品種示意（非病患本人）';node.appendChild(img);
    }else{node.textContent=catSpecies?'🐱':/犬|狗|dog|canine/i.test(String(species||''))?'🐶':'🐾';}
}
function updateJournalMedicalAvatar(){
    const node=document.getElementById('journalMedicalAvatar');
    if(node)setJournalAvatar(node,currentPetBreed,currentPetSpecies);
}
function toggleJournalAppointmentView(){
    const table=document.getElementById('appointmentTable'),cards=document.getElementById('journalAppointmentCards'),button=document.getElementById('journalViewToggle');
    const tableVisible=table.classList.contains('journal-table-hidden');
    table.classList.toggle('journal-table-hidden',!tableVisible);cards.hidden=tableVisible;
    button.textContent=tableVisible?'切換小卡':'切換表格';button.setAttribute('aria-pressed',String(tableVisible));
}
function renderJournalAppointmentCards(patients){
    const container=document.getElementById('journalAppointmentCards');if(!container)return;
    renderJournalSchedule();
    container.replaceChildren();
    if(!patients.length){const p=document.createElement('p');p.className='journal-empty';p.textContent='目前尚無符合條件的報到病患';container.appendChild(p);return;}
    const rows=[...document.getElementById('appointmentTableBody').rows];
    function text(parent,tag,cls,value){const n=document.createElement(tag);n.className=cls;n.textContent=value;parent.appendChild(n);return n;}
    patients.forEach((pet,index)=>{
        if(currentAppointmentFilter === "all" && pet.status === "已預約") return;
        const row=rows[index];if(!row)return;
        const card=document.createElement('article');card.className='journal-patient';card.dataset.petId=pet.id;card.dataset.appointmentKey=appointmentKey(pet);
        const top=text(card,'div','journal-patient-top','');text(top,'span','',pet.session||'上午診');text(top,'span','',row.cells[5].textContent.trim());
        const main=text(card,'div','journal-patient-main',''),avatar=text(main,'div','journal-avatar','');setJournalAvatar(avatar,pet.breed,pet.species);
        const info=text(main,'div','','');text(info,'div','journal-name',pet.name||'未填姓名');text(info,'div','journal-owner','飼主：'+(pet.owner_name||'關聯飼主'));
        text(info,'div','journal-breed',[pet.breed||pet.species||'未填品種',pet.weight?formatPetWeight(pet.weight)+' kg':''].filter(Boolean).join(' · '));
        text(info,'div','journal-doctor-v55',doctorCardTextV55(pet));
        text(info,'div','family-purpose-v74','來院目的：'+visitPurposeV74(pet.notes));
        if(familyHasAppointmentV74(pet.appointment_id))text(info,'div','family-purpose-v74','已加入合併待收');
        text(card,'div','journal-meta',row.cells[4].textContent.trim()+' 晶片：'+(pet.microchip||'無'));
        const actions=text(card,'div','journal-actions','');row.cells[6].querySelectorAll('button').forEach(button=>{const clone=button.cloneNode(true);if((clone.getAttribute('onclick')||'').startsWith('startConsultationFromAppointment'))clone.textContent='打開病歷 ↗';actions.appendChild(clone);});
        container.appendChild(card);
    });
    if(!container.children.length){const p=document.createElement("p");p.className="journal-empty";p.textContent="現在沒有候診中的毛孩。預約請看右側的約定時間。";container.appendChild(p);}
}
