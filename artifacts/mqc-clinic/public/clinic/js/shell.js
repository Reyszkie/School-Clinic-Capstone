/* ================= SHELL ================= */
const NAV = [
  {group:"Overview", items:[{key:"dashboard", label:"Dashboard", icon:ICONS.dashboard, color:"var(--blue)"}]},
  {group:"Clinical", items:[{key:"consultation", label:"Patients", icon:ICONS.stethoscope, color:"var(--teal)"}]},
  {group:"Inventory", items:[{key:"inventory", label:"Medicine & Equipment", icon:ICONS.pill, color:"var(--amber)"}]},
  {group:"Insights", items:[{key:"reports", label:"Reports", icon:ICONS.report, color:"var(--violet)"}]},
  {group:"Administration", items:[
    {key:"admin", label:"Users, Audit & Deleted", icon:ICONS.users, color:"var(--coral)"},
  ]},
];
let clockTimer = null;
let logoutConfirmationOpen = false;
let logoutTransitionRunning = false;
function manilaDateTime(){
  return new Intl.DateTimeFormat('en-PH',{
    timeZone:'Asia/Manila',
    weekday:'short',
    month:'short',
    day:'numeric',
    year:'numeric',
    hour:'numeric',
    minute:'2-digit',
    second:'2-digit',
    hour12:true
  }).format(new Date());
}
function renderShell(){
  const u=state.currentUser;
   const initials = (u?.name||"MQ").split(/[\s,]+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase();
  let navHtml="";
  NAV.forEach(g=>{
    navHtml+=`<div class="nav-label">${g.group}</div>`;
    g.items.forEach(it=>{
      navHtml+=`<button class="nav-item ${state.page===it.key?'active':''}" data-nav="${it.key}" style="--nav-c:${it.color};">${it.icon}<span>${it.label}</span></button>`;
    });
  });
  const lowStockThreshold = state.settings.lowStockThreshold || 15;
  const lowStockCount = MEDICINES.filter(m=>!m.deleted && m.qty>0 && m.qty<=lowStockThreshold).length + MEDICINES.filter(m=>!m.deleted && m.qty===0).length;
  const referralFlagCount = referralConcernList(REFERRAL_THRESHOLD).length;

  return `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
       <div class="side-brand"><div class="crest"><img src="assets/mqc-seal-transparent.png" alt="Mary the Queen College seal"></div><div class="txt"><b>MQC School Clinic</b>Management System</div></div>
      <div class="nav-group">${navHtml}</div>
      <div class="sidebar-foot">
         <div class="user-chip">
            <div class="avatar">${initials}</div>
            <div class="u-txt"><b>${escapeHtml(u?.name||"Authorized staff")}</b>${escapeHtml(u?.role||"Clinic access")}</div>
          <button class="logout-btn" id="logout-btn" title="Log out">${ICONS.logout}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="menu-toggle" id="menu-toggle">${ICONS.menu}</button>
          <div>
            <div class="page-title">${pageTitle()}</div>
            <div class="page-sub">${pageSub()}</div>
          </div>
        </div>
        <div class="top-actions">
          <span class="sync-status" id="sync-status" data-state="saved" aria-live="polite">Saved</span>
           <div class="datetime-chip mono" id="clock" aria-label="Current date and time">${manilaDateTime()}</div>
          <button class="icon-btn" id="alert-btn" title="Alerts" aria-label="Alerts">${ICONS.bell}${(lowStockCount>0||referralFlagCount>0)?'<span class="dot-alert"></span>':''}</button>
          <button class="icon-btn settings-btn" id="settings-btn" title="Settings" aria-label="Settings"><span class="settings-icon">${ICONS.settings}</span><span class="settings-label">Settings</span></button>
        </div>
      </div>
      <div class="content" id="content"></div>
    </div>
  </div>`;
}
function pageTitle(){
  return {dashboard:"Dashboard", consultation:"Patients", inventory:"Inventory Management", reports:"Reports", admin:"Administration", settings:"Settings"}[state.page]||"";
}
function pageSub(){
  return {
    dashboard:"Medicine alerts and quick student record search",
     consultation:"View patient profiles, clinical records, and visit history",
    inventory:"Medicines and medical equipment tracking",
    reports:"Generate and export simulated clinic reports",
    admin:"Users, audit logs, and deleted records",
    settings:"Preferences and system configuration",
  }[state.page]||"";
}
function attachShellEvents(){
  if(clockTimer) clearInterval(clockTimer);
  const clock=document.getElementById('clock');
  clockTimer=setInterval(()=>{ if(clock) clock.textContent=manilaDateTime(); },1000);
  document.querySelectorAll('[data-nav]').forEach(btn=>{
    btn.onclick=()=>{ state.page=btn.dataset.nav; state.sidebarOpen=false; render(); };
  });
  document.getElementById('logout-btn').onclick=()=>{
    if(logoutConfirmationOpen||logoutTransitionRunning)return;
    logoutConfirmationOpen=true;
    confirmDialog({title:"Log out?", msg:"You will be returned to the sign-in screen.", okLabel:"Log Out", danger:false, loadingLabel:"Signing out...", onCancel:()=>{logoutConfirmationOpen=false;}, onConfirm:()=>{
      logoutTransitionRunning=true;
      logAudit("Logout","Authentication","Success",false);
      fetch('/api/auth/logout',{method:'POST'}).catch(error=>console.error('MQC Clinic: could not clear the server session cookie.',error));
      clearAuthSession();
      state.loggedIn=false; state.currentUser=null; state.page="dashboard";
      document.getElementById('app').classList.add('logout-exit');
      const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(()=>{
        render();
        const app=document.getElementById('app');
        app.classList.remove('logout-exit');
        app.classList.add('login-enter');
        const finishTransition=()=>{
          app.classList.remove('login-enter');
          logoutTransitionRunning=false;
        };
        app.querySelector('.login-page')?.addEventListener('animationend',finishTransition,{once:true});
        window.setTimeout(finishTransition,reduceMotion?0:260);
        logoutConfirmationOpen=false;
      },reduceMotion?0:120);
    }});
  };
  document.getElementById('menu-toggle').onclick=()=>{
    document.getElementById('sidebar').classList.toggle('force-open');
  };
  document.getElementById('alert-btn').onclick=()=>{
    const hasReferral = referralConcernList(REFERRAL_THRESHOLD).length>0;
    if(hasReferral){ state.page="reports"; render(); }
    else { state.page="dashboard"; render(); setTimeout(()=>document.getElementById('alerts-section')?.scrollIntoView({behavior:'smooth'}),50); }
  };
  document.getElementById('settings-btn').onclick=()=>{ state.page="settings"; render(); };
}

/* ================= PAGE ROUTER ================= */
function renderPage(){
  const c=document.getElementById('content');
  if(state.page==='dashboard') c.innerHTML = renderDashboard();
  else if(state.page==='consultation') c.innerHTML = renderConsultation();
  else if(state.page==='inventory') c.innerHTML = renderInventory();
  else if(state.page==='reports') c.innerHTML = renderReports();
  else if(state.page==='admin') c.innerHTML = renderAdmin();
  else if(state.page==='settings') c.innerHTML = renderSettings();
  afterPageRender();
}

function emptyState(msg){
  return `<div class="empty-state">${ICONS.emptybox}<h4>Nothing here yet</h4><p>${msg}</p></div>`;
}
