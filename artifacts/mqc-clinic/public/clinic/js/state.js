/* ================= STATE ================= */
const state = {
  loggedIn:false,
  currentUser:null,
  page:"dashboard",
  sidebarOpen:false,
  consultTab:"search",
  selectedStudent:null,
  departmentFilter:"",
  invTab:"medicines",
  adminTab:"users",
  consultPage:1,
  medPage:1,
  eqPage:1,
  auditPage:1,
  users: NURSES.map(n=>({...n})),
  settings: {
    clinicName:"Mary the Queen College School Clinic", address:"Quezon City, Philippines",
    contactNumber:"", email:"", clinicOpen:"07:00", clinicClose:"17:00",
    clinicDays:["Monday","Tuesday","Wednesday","Thursday","Friday"],
    logo:"", patientIdPrefix:"", lowStockThreshold:15, expirationAlertDays:14,
    passwordMinLength:8, sessionTimeout:30, dateFormat:"MMM D, YYYY",
    timeFormat:"12-hour", timezone:"Asia/Manila", language:"English",
  },
};

/* ================= UTIL ================= */
function manilaNow(){ return new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Manila"})); }
function todayDateString(){ const d=manilaNow(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function currentTimeString(){ return manilaNow().toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit",hour12:true}); }
function fmtDate(d){ if(!d) return "—"; const dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function daysUntil(dateStr){ const today=new Date(todayDateString()+"T00:00:00"); const target=new Date(dateStr+"T00:00:00"); return Math.round((target-today)/(1000*60*60*24)); }
function uid(prefix){ return prefix+"-"+Math.floor(1000+Math.random()*9000); }
function greetingWord(){ const h=new Date().getHours(); return h<12?"Good morning":h<18?"Good afternoon":"Good evening"; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function toast(title, msg, type="ok"){
  const wrap=document.getElementById('toast-wrap');
  const el=document.createElement('div');
  el.className='toast'+(type==='warn'?' warn':type==='err'?' err':'');
  const icon = type==='err' ? ICONS.x : type==='warn' ? ICONS.alert : ICONS.check;
  const color = type==='err' ? 'var(--red)' : type==='warn' ? 'var(--amber)' : 'var(--green)';
  el.innerHTML = `<div class="t-ic" style="color:${color}">${icon}</div><div class="t-body"><b>${escapeHtml(title)}</b><span>${escapeHtml(msg)}</span></div>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 3400);
}
function logAudit(action, module, status="Success"){
  AUDIT_LOGS.unshift({date:todayDateString(), time:manilaNow().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}), user: state.currentUser?state.currentUser.name:"System", userId: state.currentUser?.id||null, action, module, status});
  saveToClinicState();
}
let modalStack=[];
function openModal(html, size=""){
  const backdrop=document.createElement('div');
  backdrop.className='modal-backdrop';
  backdrop.innerHTML=`<div class="modal ${size}">${html}</div>`;
  backdrop.addEventListener('click', e=>{ if(e.target===backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  modalStack.push(backdrop);
}
function closeModal(){
  const b=modalStack.pop();
  if(b) b.remove();
}
function confirmDialog({title, msg, okLabel="Confirm", danger=true, onConfirm}){
  const html=`
    <div class="modal-body">
      <div class="confirm-icon ${danger?'':'good'}">${danger?ICONS.alert:ICONS.check}</div>
      <h3 style="margin-bottom:8px;">${escapeHtml(title)}</h3>
      <p style="font-size:13.5px;color:var(--ink-soft);line-height:1.6;">${msg}</p>
    </div>
    <div class="modal-foot">
      <button class="btn" id="cf-cancel">Cancel</button>
      <button class="btn ${danger?'btn-outline-red':'btn-teal'}" id="cf-ok" style="${danger?'background:var(--red);color:#fff;border-color:var(--red);':''}">${okLabel}</button>
    </div>`;
  openModal(html,"sm");
  document.getElementById('cf-cancel').onclick=closeModal;
  document.getElementById('cf-ok').onclick=()=>{ closeModal(); onConfirm(); };
}
