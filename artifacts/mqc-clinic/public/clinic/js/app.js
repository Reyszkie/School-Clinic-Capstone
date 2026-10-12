/* ================= RENDER ROOT ================= */
function bindLeaveWarning(){
  if(window.__mqcLeaveWarningBound) return;
  window.__mqcLeaveWarningBound = true;

  window.addEventListener('beforeunload', (event)=>{
    if(!state.loggedIn) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function render(){
  const app=document.getElementById('app');
  applyClinicTheme();
  bindLeaveWarning();
  if(!state.loggedIn){ app.innerHTML = renderLogin(); attachLoginEvents(); return; }
  app.innerHTML = renderShell();
  attachShellEvents();
  renderPage();
}

/* ================= AFTER RENDER BINDINGS ================= */
function afterPageRender(){
  if(state.page==='dashboard'){ bindDashboard(); }
  if(state.page==='consultation'){
    document.querySelectorAll('[data-ctab]').forEach(b=> b.onclick=()=>{ state.consultTab=b.dataset.ctab; render(); });
    renderConsultTabBody();
  }
  if(state.page==='inventory'){
    document.querySelectorAll('[data-itab]').forEach(b=> b.onclick=()=>{ state.invTab=b.dataset.itab; render(); });
    renderInventoryTabBody();
  }
  if(state.page==='reports'){ bindReports(); }
  if(state.page==='admin'){
    document.querySelectorAll('[data-atab]').forEach(b=> b.onclick=()=>{ state.adminTab=b.dataset.atab; render(); });
    renderAdminTabBody();
  }
  if(state.page==='settings'){ bindSettings(); }
}

/* ================= INIT ================= */
render();
serverHydrationPromise=restoreAuthSession().then(async restored=>{
  if(!restored)return false;
  const hydrated=await hydrateFromSharedStorage();
  if(hydrated&&(sharedStorageNeedsBootstrap||sharedStorageMissing)){await saveToClinicState(false,true);clinicDataLoaded=true;clinicDataStatus="ready";}
  else if(!hydrated&&(sharedStorageMissing||sharedStorageNeedsBootstrap)){await saveToClinicState(false,true);clinicDataLoaded=true;clinicDataStatus="ready";}
  render();
  startClinicRefresh();
  return hydrated;
});
