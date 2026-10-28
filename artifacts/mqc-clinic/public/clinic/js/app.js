/* ================= RENDER ROOT ================= */
let authRestoreStatus="loading";

function render(){
  const app=document.getElementById('app');
  applyClinicTheme();
  if(!state.loggedIn&&authRestoreStatus==="loading"){
    app.innerHTML='<main class="session-restore" role="status">Restoring your clinic session…</main>';
    return;
  }
  if(!state.loggedIn&&authRestoreStatus==="error"){
    app.innerHTML='<main class="session-restore"><p>Unable to verify your clinic session. Your saved session has not been cleared.</p><button class="btn btn-dark" id="retry-session-restore">Try Again</button></main>';
    document.getElementById("retry-session-restore").onclick=()=>{serverHydrationPromise=bootstrapClinicSession();};
    return;
  }
  if(!state.loggedIn){ app.innerHTML = renderLogin(); attachLoginEvents(); return; }
  app.innerHTML = renderShell();
  attachShellEvents();
  renderPage();
}

async function bootstrapClinicSession(){
  authRestoreStatus="loading";
  render();
  try{
    const restored=await restoreAuthSession();
    if(!restored){
      authRestoreStatus="ready";
      render();
      return false;
    }
    const hydrated=await hydrateFromSharedStorage();
    if(sharedStorageMissing||sharedStorageNeedsBootstrap){
      await saveToClinicState(true,[],true);
      clinicDataLoaded=true;
      clinicDataStatus="ready";
    }
    authRestoreStatus="ready";
    render();
    startClinicRefresh();
    return hydrated;
  }catch(error){
    console.error("MQC Clinic: session restoration failed.",error);
    authRestoreStatus="error";
    render();
    return false;
  }
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
serverHydrationPromise=bootstrapClinicSession();
