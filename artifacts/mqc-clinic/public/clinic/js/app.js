/* ================= RENDER ROOT ================= */
let authRestoreStatus="loading";
let systemTabStatus="checking";
let systemTabLockRelease=null;
let systemTabHeartbeat=null;
let systemTabOwnerId=null;
let clinicBootstrapStarted=false;
let systemTabMessage="The system is already open in another tab. Please use your existing active session.";
let systemTabStorageListenerInstalled=false;
let preserveSystemTabIdOnNextInit=false;
const CLINIC_INACTIVITY_LIMIT_MS=300000;
const CLINIC_ACTIVITY_SYNC_INTERVAL_MS=5000;
const CLINIC_SESSION_EXPIRED_MESSAGE="Your session has expired due to 5 minutes of inactivity. Please log in again to continue.";
let clinicLastActivityAt=0;
let clinicLastActivitySyncAt=0;
let clinicInactivityTimer=null;
let clinicActivitySyncTimer=null;
let clinicActivityRequestInProgress=false;
let clinicActivitySyncPending=false;
let clinicSessionEnding=false;
let sessionExpiredNoticePending=false;
const SYSTEM_TAB_LOCK_NAME="mqc-clinic-single-system-tab";
const SYSTEM_TAB_LEASE_KEY="mqc_clinic_system_tab_lease_v1";
const SYSTEM_TAB_ID_KEY="mqc_clinic_system_tab_id_v1";
const SYSTEM_TAB_LEASE_MS=120000;

function render(){
  const app=document.getElementById('app');
  if(systemTabStatus==="blocked"){
    app.innerHTML=`<main class="session-restore" role="alert"><p>${escapeHtml(systemTabMessage)}</p></main>`;
    document.body.style.overflowY="hidden";
    return;
  }
  if(systemTabStatus!=="active"){
    app.innerHTML='<main class="session-restore" role="status">Checking system tab access…</main>';
    document.body.style.overflowY="hidden";
    return;
  }
  applyClinicTheme();
  if(!state.loggedIn&&authRestoreStatus==="loading"){
    app.innerHTML='<main class="session-restore" role="status">Restoring your clinic session…</main>';
    document.body.style.overflowY = 'hidden';
    return;
  }
  if(!state.loggedIn&&authRestoreStatus==="error"){
    app.innerHTML='<main class="session-restore"><p>Unable to verify your clinic session. Your saved session has not been cleared.</p><button class="btn btn-dark" id="retry-session-restore">Try Again</button></main>';
    document.body.style.overflowY = 'hidden';
    document.getElementById("retry-session-restore").onclick=()=>{serverHydrationPromise=bootstrapClinicSession();};
    return;
  }
  if(!state.loggedIn){
    app.innerHTML = renderLogin();
    document.body.style.overflowY = 'hidden';
    attachLoginEvents();
    return;
  }
  document.body.style.overflowY = 'auto';
  app.innerHTML = renderShell();
  attachShellEvents();
  renderPage();
}

function stopClinicInactivityMonitor(){
  if(clinicInactivityTimer)window.clearTimeout(clinicInactivityTimer);
  if(clinicActivitySyncTimer)window.clearTimeout(clinicActivitySyncTimer);
  clinicInactivityTimer=null;
  clinicActivitySyncTimer=null;
  clinicLastActivityAt=0;
  clinicLastActivitySyncAt=0;
  clinicActivitySyncPending=false;
}

function scheduleClinicInactivityCheck(){
  if(clinicInactivityTimer)window.clearTimeout(clinicInactivityTimer);
  if(!state.loggedIn||!clinicLastActivityAt)return;
  const remaining=CLINIC_INACTIVITY_LIMIT_MS-(Date.now()-clinicLastActivityAt);
  if(remaining<=0){
    void expireClinicSession();
    return;
  }
  clinicInactivityTimer=window.setTimeout(()=>{
    if(Date.now()-clinicLastActivityAt>=CLINIC_INACTIVITY_LIMIT_MS){
      void expireClinicSession();
      return;
    }
    scheduleClinicInactivityCheck();
  },remaining);
}

async function syncClinicSessionActivity(){
  if(!state.loggedIn||clinicSessionEnding)return;
  if(clinicActivityRequestInProgress){
    clinicActivitySyncPending=true;
    return;
  }
  clinicActivityRequestInProgress=true;
  clinicLastActivitySyncAt=Date.now();
  try{
    const response=await fetch("/api/auth/session",{method:"POST",cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(response.status===401){
      if(result.sessionExpired)await expireClinicSession();
      else await endClinicSession(false);
      return;
    }
    if(!response.ok)throw new Error(result.message||`Session activity returned ${response.status}.`);
    const serverActivityAt=Date.parse(result.lastActivityAt);
    if(Number.isFinite(serverActivityAt)){
      clinicLastActivityAt=Math.max(clinicLastActivityAt,serverActivityAt);
      scheduleClinicInactivityCheck();
    }
  }catch(error){
    console.error("MQC Clinic: session activity could not be synchronized.",error);
  }finally{
    clinicActivityRequestInProgress=false;
    if(clinicActivitySyncPending){
      clinicActivitySyncPending=false;
      scheduleClinicActivitySync();
    }
  }
}

function scheduleClinicActivitySync(){
  if(!state.loggedIn||clinicSessionEnding||clinicActivitySyncTimer)return;
  const elapsed=Date.now()-clinicLastActivitySyncAt;
  const delay=Math.max(250,CLINIC_ACTIVITY_SYNC_INTERVAL_MS-elapsed);
  clinicActivitySyncTimer=window.setTimeout(()=>{
    clinicActivitySyncTimer=null;
    void syncClinicSessionActivity();
  },delay);
}

function startClinicInactivityMonitor(lastActivityAt=Date.now()){
  stopClinicInactivityMonitor();
  clinicSessionEnding=false;
  const parsed=typeof lastActivityAt==="number"?lastActivityAt:Date.parse(lastActivityAt);
  clinicLastActivityAt=Number.isFinite(parsed)?parsed:Date.now();
  scheduleClinicInactivityCheck();
  scheduleClinicActivitySync();
}

async function endClinicSession(showExpirationNotice){
  clinicSessionEnding=true;
  stopClinicInactivityMonitor();
  if(window.__clinicRefreshTimer){
    window.clearInterval(window.__clinicRefreshTimer);
    window.__clinicRefreshTimer=null;
  }
  clearAuthSession();
  state.loggedIn=false;
  state.currentUser=null;
  state.page="dashboard";
  state.loginAlertsShown=false;
  render();
  if(showExpirationNotice)toast("Session expired",CLINIC_SESSION_EXPIRED_MESSAGE,"warn");
}

async function expireClinicSession(){
  if(clinicSessionEnding)return;
  clinicSessionEnding=true;
  try{
    const response=await fetch("/api/auth/logout",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({reason:"inactivity_timeout"}),
      cache:"no-store",
    });
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      throw new Error(result.message||`Session release returned ${response.status}.`);
    }
  }catch(error){
    console.error("MQC Clinic: automatic session release could not be confirmed.",error);
  }
  await endClinicSession(true);
}

function recordClinicUserActivity(event){
  if(!state.loggedIn||clinicSessionEnding)return;
  const now=Date.now();
  if(now-clinicLastActivityAt>=CLINIC_INACTIVITY_LIMIT_MS){
    void expireClinicSession();
    return;
  }
  if(event.type==="mousemove"&&now-clinicLastActivityAt<1000)return;
  clinicLastActivityAt=now;
  scheduleClinicInactivityCheck();
  scheduleClinicActivitySync();
}

function installClinicActivityListeners(){
  ["mousemove","mousedown","click","keydown","scroll","touchstart","touchmove","pointerdown"].forEach(type=>{
    document.addEventListener(type,recordClinicUserActivity,{capture:true,passive:true});
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible")scheduleClinicInactivityCheck();
  });
  window.addEventListener("focus",scheduleClinicInactivityCheck);
}

function startClinicApplication(){
  if(systemTabStatus==="blocked")return;
  systemTabStatus="active";
  render();
  if(!clinicBootstrapStarted){
    clinicBootstrapStarted=true;
    serverHydrationPromise=bootstrapClinicSession();
  }
}

function randomSystemTabId(){
  if(window.crypto?.randomUUID)return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fallbackTabId(){
  const navigation=window.performance?.getEntriesByType?.("navigation")[0];
  const navigationType=navigation?.type;
  const legacyNavigationType=window.performance?.navigation?.type;
  const isSameTabNavigation=navigationType==="reload"
    ||navigationType==="back_forward"
    ||legacyNavigationType===1
    ||legacyNavigationType===2;
  const previousId=window.sessionStorage.getItem(SYSTEM_TAB_ID_KEY);
  const tabId=(isSameTabNavigation||preserveSystemTabIdOnNextInit)&&previousId?previousId:randomSystemTabId();
  preserveSystemTabIdOnNextInit=false;
  window.sessionStorage.setItem(SYSTEM_TAB_ID_KEY,tabId);
  return tabId;
}

function readSystemTabLease(){
  const value=window.localStorage.getItem(SYSTEM_TAB_LEASE_KEY);
  if(!value)return null;
  try{return JSON.parse(value);}
  catch(error){throw new Error("The system tab lock data is invalid.");}
}

function releaseFallbackTabLease(){
  if(systemTabHeartbeat){
    window.clearInterval(systemTabHeartbeat);
    systemTabHeartbeat=null;
  }
  if(!systemTabOwnerId)return;
  try{
    const lease=readSystemTabLease();
    if(lease?.owner===systemTabOwnerId)window.localStorage.removeItem(SYSTEM_TAB_LEASE_KEY);
  }catch(error){
    console.error("MQC Clinic: unable to release the browser tab lock.",error);
  }
  systemTabOwnerId=null;
}

function recordBlockedSystemTab(){
  fetch("/api/audit-logs",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      action:"Additional System Tab Blocked",
      module:"Authentication",
      status:"Warning",
      detail:"A second system tab was blocked by the single-tab session guard.",
    }),
    cache:"no-store",
  }).then(async response=>{
    if(response.ok||response.status===401||response.status===403)return;
    const result=await response.json().catch(()=>({}));
    console.error("MQC Clinic: blocked-tab audit event was not saved.",result.message||response.status);
  }).catch(error=>console.error("MQC Clinic: blocked-tab audit event was not saved.",error));
}

function blockSystemTab(message="The system is already open in another tab. Please use your existing active session."){
  if(systemTabStatus==="blocked")return;
  systemTabMessage=message;
  systemTabStatus="blocked";
  releaseFallbackTabLease();
  if(window.__clinicRefreshTimer){
    window.clearInterval(window.__clinicRefreshTimer);
    window.__clinicRefreshTimer=null;
  }
  render();
  if(message==="The system is already open in another tab. Please use your existing active session."){
    recordBlockedSystemTab();
  }
}

function startFallbackSystemTabGuard(){
  try{
    const tabId=fallbackTabId();
    const currentLease=readSystemTabLease();
    if(currentLease&&currentLease.expiresAt>Date.now()&&currentLease.owner!==tabId){
      blockSystemTab();
      return;
    }

    const claim=()=>window.localStorage.setItem(SYSTEM_TAB_LEASE_KEY,JSON.stringify({
      owner:tabId,
      expiresAt:Date.now()+SYSTEM_TAB_LEASE_MS,
    }));
    claim();
    if(readSystemTabLease()?.owner!==tabId){
      blockSystemTab();
      return;
    }

    systemTabOwnerId=tabId;
    startClinicApplication();
    systemTabHeartbeat=window.setInterval(()=>{
      try{
        const lease=readSystemTabLease();
        if(lease&&lease.expiresAt>Date.now()&&lease.owner!==tabId){
          blockSystemTab();
          return;
        }
        claim();
        if(readSystemTabLease()?.owner!==tabId)blockSystemTab();
      }catch(error){
        console.error("MQC Clinic: browser tab lock validation failed.",error);
        blockSystemTab("Unable to verify that this is the only active system tab. Please refresh and try again.");
      }
    },10000);
    if(!systemTabStorageListenerInstalled){
      window.addEventListener("storage",event=>{
        if(event.key!==SYSTEM_TAB_LEASE_KEY||systemTabStatus!=="active")return;
        try{
          const lease=readSystemTabLease();
          if(lease&&lease.expiresAt>Date.now()&&lease.owner!==systemTabOwnerId)blockSystemTab();
        }catch(error){
          console.error("MQC Clinic: browser tab lock validation failed.",error);
          blockSystemTab("Unable to verify that this is the only active system tab. Please refresh and try again.");
        }
      });
      systemTabStorageListenerInstalled=true;
    }
  }catch(error){
    console.error("MQC Clinic: browser tab access could not be verified.",error);
    blockSystemTab("Unable to verify that this is the only active system tab. Please enable browser storage and try again.");
  }
}

function initializeSystemTabGuard(){
  systemTabStatus="checking";
  render();
  if(window.navigator.locks&&typeof window.navigator.locks.request==="function"){
    window.navigator.locks.request(SYSTEM_TAB_LOCK_NAME,{mode:"exclusive",ifAvailable:true},async lock=>{
      if(!lock){
        blockSystemTab();
        return;
      }
      startClinicApplication();
      await new Promise(resolve=>{systemTabLockRelease=resolve;});
      systemTabLockRelease=null;
    }).catch(error=>{
      if(systemTabStatus!=="checking")return;
      console.warn("MQC Clinic: Web Locks are unavailable; using browser storage for tab control.",error);
      startFallbackSystemTabGuard();
    });
    return;
  }
  startFallbackSystemTabGuard();
}

async function bootstrapClinicSession(){
  authRestoreStatus="loading";
  render();
  try{
    const restored=await restoreAuthSession();
    if(!restored){
      authRestoreStatus="ready";
      render();
      if(sessionExpiredNoticePending){
        sessionExpiredNoticePending=false;
        toast("Session expired",CLINIC_SESSION_EXPIRED_MESSAGE,"warn");
      }
      return false;
    }
    const hydrated=await hydrateFromSharedStorage();
    if((sharedStorageMissing||sharedStorageNeedsBootstrap)&&hasClinicAdminPrivileges(state.currentUser?.role)){
      await saveToClinicState(true,[],true);
      clinicDataLoaded=true;
      clinicDataStatus="ready";
    }
    authRestoreStatus="ready";
    render();
    startClinicInactivityMonitor(restored.lastActivityAt);
    startClinicRefresh();
    if(sessionExpiredNoticePending){
      sessionExpiredNoticePending=false;
      toast("Session expired",CLINIC_SESSION_EXPIRED_MESSAGE,"warn");
    }
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
initializeSystemTabGuard();
installClinicActivityListeners();
window.addEventListener("pagehide",()=>{
  if(systemTabLockRelease){
    const release=systemTabLockRelease;
    systemTabLockRelease=null;
    release();
  }
  releaseFallbackTabLease();
  if(systemTabStatus==="active")systemTabStatus="checking";
});
window.addEventListener("pageshow",event=>{
  if(event.persisted){
    preserveSystemTabIdOnNextInit=true;
    initializeSystemTabGuard();
  }
});
