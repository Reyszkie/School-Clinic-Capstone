/* ================= RENDER ROOT ================= */
function render(){
  const app=document.getElementById('app');
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
restoreAuthSession();
render();
serverHydrationPromise=hydrateFromSharedStorage().then((hydrated)=>{
  if(hydrated){
    const wasLoggedIn=state.loggedIn;
    if(!wasLoggedIn) restoreAuthSession();
    if(state.loggedIn || wasLoggedIn) render();
    if(sharedStorageNeedsBootstrap) saveToClinicState();
  }else if(sharedStorageMissing || sharedStorageNeedsBootstrap){
    saveToClinicState();
  }
});
