/* ================= LOGIN ================= */
function renderLogin(){
  return `
  <div class="login-page">
    <header class="login-topbar">
      <div class="login-brand">
         <div class="login-seal"><img src="assets/mqc-seal.jpg" alt="Mary the Queen College seal"></div>
        <div><strong>Mary the Queen College</strong><span>of Quezon City</span></div>
      </div>
      <div class="login-topbar-label">School Clinic Management System</div>
    </header>
    <main class="login-main">
      <section class="login-intro">
         <div class="intro-seal"><img src="assets/mqc-seal.jpg" alt="Mary the Queen College seal"></div>
        <div class="intro-kicker">MARY THE QUEEN COLLEGE</div>
        <h1>Care that keeps our community well.</h1>
        <p>A dependable clinic workspace for student consultations, medicine inventory, and the people who make everyday care possible.</p>
        <div class="login-feature-list">
          <div><span class="feature-icon">01</span><span><b>Student-first records</b><small>Keep every clinic visit clear and organized.</small></span></div>
          <div><span class="feature-icon">02</span><span><b>Ready clinic inventory</b><small>See what is available before care begins.</small></span></div>
          <div><span class="feature-icon">03</span><span><b>Trusted access</b><small>Support safe, accountable clinic operations.</small></span></div>
        </div>
      </section>
      <section class="login-panel" id="auth-card">
        ${renderLoginCard()}
      </section>
    </main>
    <footer class="login-footer"><span>MQC School Clinic</span><span>School Year 2026–2027</span></footer>
  </div>`;
}

function renderLoginCard(){
  return `
    <div class="eyebrow">STAFF ACCESS</div>
    <h2>Sign in to continue</h2>
    <div class="sub">Use your authorized clinic account to access the system.</div>
    <div class="error-msg" id="login-error"></div>
    <form id="login-form">
      <div class="field">
        <label>Username</label>
        <input type="text" id="login-user" placeholder="Enter your username" autocomplete="username">
      </div>
      <div class="field">
        <label>Password</label>
        <div class="input-row">
          <input type="password" id="login-pass" placeholder="Enter your password" autocomplete="current-password">
          <button type="button" class="toggle-pw" id="toggle-pw" aria-label="Show password">${ICONS.eye}</button>
        </div>
      </div>
      <div class="login-security-note">Identity verification required</div>
      <button class="btn-primary" type="submit" id="login-btn">
        <div class="spinner" id="login-spinner"></div>
        <span id="login-btn-text">Sign In</span>
      </button>
    </form>
  `;
}

function attachLoginEvents(){
  attachLoginFormEvents();
}

function attachLoginFormEvents(){
  document.getElementById('toggle-pw').onclick=()=>{
    const pw=document.getElementById('login-pass');
    const btn=document.getElementById('toggle-pw');
    const showing = pw.type !== 'password';
    pw.type = showing ? 'password' : 'text';
    btn.innerHTML = showing ? ICONS.eye : ICONS.eye_off;
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  };
  document.getElementById('login-form').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const user=document.getElementById('login-user').value;
    const pass=document.getElementById('login-pass').value;
    const errEl=document.getElementById('login-error');
    const loginButton=document.getElementById('login-btn');
    const spinner=document.getElementById('login-spinner');
    const btnText=document.getElementById('login-btn-text');
    errEl.style.display='none';
    if(!user || !pass){ errEl.textContent='Please enter both username and password.'; errEl.style.display='block'; return; }
    if(/\s/.test(user)){errEl.textContent='Username cannot contain spaces.';errEl.style.display='block';return;}
    if(!/^[A-Za-z0-9._-]{3,50}$/.test(user)){errEl.textContent='Username must be 3-50 letters, numbers, dots, underscores, or hyphens.';errEl.style.display='block';return;}
    if(/\s/.test(pass)){errEl.textContent='Password cannot contain spaces.';errEl.style.display='block';return;}
    spinner.style.display='block';
    btnText.textContent='Signing in...';
    loginButton.disabled=true;
    if(serverHydrationPromise) await serverHydrationPromise;
    let response;
    try{
      response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password:pass})});
    }catch(err){
      spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false;
      errEl.textContent='Unable to connect to Supabase. Please try again.';
      errEl.style.display='block';
      return;
    }
    if(!response.ok){
      spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false;
      const result=await response.json().catch(()=>({}));
      errEl.textContent=result.message||'Invalid username or password.';
      errEl.style.display='block';
      return;
    }
    const found=await response.json();
    if(found && found.status==='Disabled'){ spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false; errEl.textContent='This account has been disabled. Contact the administrator.'; errEl.style.display='block'; return; }
    if(!found){ spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false; errEl.textContent='Invalid username or password.'; errEl.style.display='block'; return; }
    let hydrated=false;
    try{
      hydrated=await hydrateFromSharedStorage();
      if(!hydrated&&!sharedStorageMissing)throw new Error('Shared clinic records could not be loaded. Check the connection and try again.');
    }catch(error){
      await fetch('/api/auth/logout',{method:'POST'}).catch(()=>undefined);
      spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false;
      errEl.textContent=error.message||'Shared clinic records could not be loaded.';
      errEl.style.display='block';
      return;
    }
    const visibleUser=ensureVisibleClinicUser(found);
    if((!hydrated&&sharedStorageMissing)||sharedStorageNeedsBootstrap){
      try{await saveToClinicState(true,[],true);}
      catch(error){
        await fetch('/api/auth/logout',{method:'POST'}).catch(()=>undefined);
        spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false;
        errEl.textContent=error.message||'Clinic data could not be initialized.';
        errEl.style.display='block';
        return;
      }
      clinicDataLoaded=true;
      clinicDataStatus="ready";
    }
    openIdentityVerification(visibleUser,pass);
    spinner.style.display='none'; btnText.textContent='Sign In'; loginButton.disabled=false;
  });
}

function buildLoginAlerts() {
  const currentMonth = todayDateString().slice(0, 7);
  const lowStock = [];
  MEDICINES.filter((medicine) => !medicine.deleted).forEach((medicine) => {
    if (Number(medicine.qty) <= Number(state.settings.lowStockThreshold ?? 15)) {
      lowStock.push({ name: medicine.name, qty: medicine.qty, date: null, label: "Medicine" });
    }
  });
  EQUIPMENT.filter((item) => !item.deleted && item.category === "Medical Supplies").forEach((item) => {
    if (Number(item.qty) <= Number(state.settings.lowStockThreshold ?? 15)) {
      lowStock.push({ name: item.name, qty: item.qty, date: null, label: "Supply" });
    }
  });
  const expired = [];
  const expiring = [];
  MEDICINES.filter((medicine) => !medicine.deleted && medicine.exp).forEach((medicine) => {
    const remaining = clinicDateDaysUntil(medicine.exp);
    if (remaining === null) return;
    if (remaining < 0) {
      expired.push({ name: medicine.name, qty: medicine.qty, date: medicine.exp, label: "Medicine" });
    } else if (remaining <= MEDICINE_EXPIRY_ALERT_DAYS) {
      expiring.push({ name: medicine.name, qty: medicine.qty, date: medicine.exp, label: "Medicine" });
    }
  });
  const visitsByPatient = new Map();
  CONSULTATIONS.filter((visit) => !visit.deleted && visit.date && visit.date.startsWith(currentMonth)).forEach((visit) => {
    const key = visit.studentId || visit.studentName || "unknown";
    const entry = visitsByPatient.get(key) || { name: visit.studentName || "Unknown patient", count: 0 };
    entry.count += 1;
    entry.name = visit.studentName || entry.name;
    visitsByPatient.set(key, entry);
  });
  const frequent = [...visitsByPatient.values()]
    .filter((entry) => entry.count >= (CLINIC_FREQUENT_VISIT_THRESHOLD || 3))
    .sort((a, b) => b.count - a.count);

  const categories = [
    { id: "low-stock", title: "Low Stock Medicines and Supplies", items: lowStock, empty: "No low-stock medicine or supply items require attention." },
    { id: "expired", title: "Expired Medicines and Supplies", items: expired, empty: "No expired medicines or supplies are on record." },
    { id: "expiring", title: "Expiring Medicines and Supplies", items: expiring, empty: "No medicines are expiring within the next 30 days." },
    { id: "frequent", title: "Frequently Visited Patients", items: frequent, empty: "No patients have reached the current monthly visit alert threshold." },
  ];
  return { categories, hasAlerts: categories.some((category) => category.items.length > 0) };
}

function openLoginAlertsModal() {
  const alerts = buildLoginAlerts();
  const sectionHtml = (category) => {
    if (!category.items.length) return `<div class="empty-state-box"><strong>${escapeHtml(category.empty)}</strong></div>`;
    return `<ul class="clinic-alert-list">${category.items.map((item) => {
      if (category.id === "frequent") return `<li><span>${escapeHtml(item.name)}</span><strong>${item.count} visits</strong></li>`;
      return `<li><span>${escapeHtml(item.name)}</span><strong>${item.qty} left${item.date ? ` · ${fmtDate(item.date)}` : ""}</strong></li>`;
    }).join("")}</ul>`;
  };
  const html = `
    <div class="modal-head">
      <div><div class="eyebrow">CLINIC ALERTS</div><h3>Important clinic alerts</h3></div>
      <button class="modal-close" id="login-alerts-close" aria-label="Close clinic alerts">${ICONS.x}</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow:auto;padding-right:8px;">
      ${alerts.hasAlerts ? alerts.categories.map((category) => `
        <div class="alert-panel" style="margin-bottom:16px;">
          <div class="panel-title" style="margin-bottom:8px;"><h4>${escapeHtml(category.title)}</h4><span class="chip ${category.id === "low-stock" ? "chip-low" : category.id === "expired" ? "chip-expired" : category.id === "expiring" ? "chip-expiring" : "chip-available"}">${category.items.length}</span></div>
          ${sectionHtml(category)}
        </div>
      `).join("") : `<div class="empty-state-box"><strong>There are currently no important clinic alerts.</strong></div>`}
    </div>
    <div class="modal-foot"><button class="btn btn-dark" id="login-alerts-done">Close</button></div>`;
  openModal(html, "sm");
  document.getElementById("login-alerts-close").onclick = closeModal;
  document.getElementById("login-alerts-done").onclick = closeModal;
}

function openIdentityVerification(user,loginPassword=""){
  const roleLabel=user.role||"Clinic staff";
  openModal(`<div class="modal-head"><div><div class="eyebrow">IDENTITY CHECK</div><h3>Verify your identity</h3></div><button class="modal-close" id="verification-close" aria-label="Close">${ICONS.x}</button></div>
    <div class="modal-body">
      <div class="verification-banner"><span class="verification-lock">${ICONS.lock||""}</span><div><b>${escapeHtml(user.name||user.username)}</b><span>${escapeHtml(roleLabel)}</span></div></div>
      <p class="verification-copy">For protected clinic access, confirm your password before entering the workspace.</p>
      <form id="identity-verification-form">
        <div class="f-field"><label for="verification-password">Confirm password</label><div class="input-row"><input type="password" id="verification-password" autocomplete="current-password" autofocus><button type="button" class="toggle-pw" id="verification-toggle" aria-label="Show password">${ICONS.eye}</button></div></div>
        <div class="error-msg" id="verification-error"></div>
        <div class="modal-foot"><button type="button" class="btn" id="verification-cancel">Cancel</button><button type="submit" class="btn btn-teal" id="verification-submit">Verify and continue</button></div>
      </form>
    </div>`,"sm");
  const closeVerification=()=>{
    clearAuthSession();
    fetch('/api/auth/logout',{method:'POST'}).catch(error=>console.error('MQC Clinic: could not clear canceled verification session.',error));
    closeModal();
    render();
  };
  document.getElementById("verification-close").onclick=closeVerification;
  document.getElementById("verification-cancel").onclick=closeVerification;
  document.getElementById("verification-toggle").onclick=()=>{
    const input=document.getElementById("verification-password");
    const button=document.getElementById("verification-toggle");
    const showing = input.type !== 'password';
    input.type = showing ? 'password' : 'text';
    button.innerHTML = showing ? ICONS.eye : ICONS.eye_off;
    button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  };
  document.getElementById("identity-verification-form").onsubmit=(e)=>{
    e.preventDefault();
    const password = document.getElementById("verification-password").value;
    const error=document.getElementById("verification-error");
    if(password!==(user.password||loginPassword)){
      error.textContent="That password does not match this clinic account.";
      error.style.display="block";
      logAudit("Identity Verification Failed","Authentication","Warning",false);
      return;
    }
    const shouldShowAlerts = !state.loginAlertsShown;
    state.currentUser=ensureVisibleClinicUser(user);
    applyClinicTheme(user.appearanceTheme);
    state.loggedIn=true;
    state.loginAlertsShown = true;
    startClinicRefresh();
    saveAuthSession(user);
    closeModal();
    logAudit("Signed In","Authentication","Success",false);
    logAudit("Identity Verified","Authentication","Success",false);
    render();
    if (shouldShowAlerts) openLoginAlertsModal();
    toast("Identity verified",`Welcome back, ${state.currentUser.name}.`,"ok");
  };
}
