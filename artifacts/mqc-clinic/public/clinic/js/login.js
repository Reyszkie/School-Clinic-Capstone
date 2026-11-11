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
  const threshold = Number(state.settings.lowStockThreshold ?? 15);
  const currentMonth = todayDateString().slice(0, 7);
  const monthDate = new Date(`${currentMonth}-01T00:00:00+08:00`);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "long",
    year: "numeric",
  }).format(monthDate);

  const sections = [
    {
      id: "low-stock-medicines",
      title: "Low Stock Medicines",
      empty: "No low-stock medicines require attention.",
      route: "inventory",
      badge: "Low Stock",
      items: [],
    },
    {
      id: "low-stock-supplies",
      title: "Low Stock Medical Supplies",
      empty: "No low-stock medical supplies require attention.",
      route: "inventory",
      badge: "Low Stock",
      items: [],
    },
    {
      id: "expired-medicines",
      title: "Expired Medicines",
      empty: "No expired medicines are on record.",
      route: "inventory",
      badge: "Expired",
      items: [],
    },
    {
      id: "expired-supplies",
      title: "Expired Medical Supplies",
      empty: "No expired medical supplies are on record.",
      route: "inventory",
      badge: "Expired",
      items: [],
    },
    {
      id: "expiring-medicines",
      title: "Expiring Medicines",
      empty: "No medicines are expiring within the next 30 days.",
      route: "inventory",
      badge: "Expiring",
      items: [],
    },
    {
      id: "expiring-supplies",
      title: "Expiring Medical Supplies",
      empty: "No medical supplies are expiring within the next 30 days.",
      route: "inventory",
      badge: "Expiring",
      items: [],
    },
    {
      id: "frequent-visitors",
      title: "Frequently Visited Patients",
      empty: `No patients have reached the current monthly alert threshold for ${monthLabel}.`,
      route: "consultation",
      badge: "Frequent Visitor",
      items: [],
    },
  ];

  MEDICINES.filter((medicine) => !medicine.deleted).forEach((medicine) => {
    const qty = Number(medicine.qty) || 0;
    if (qty <= threshold) {
      sections[0].items.push({
        name: medicine.name,
        currentQuantity: qty,
        minimumStock: threshold,
        stockStatus: qty === 0 ? "Out of Stock" : "Low Stock",
        route: "inventory",
      });
    }

    if (!medicine.exp) return;
    const remaining = clinicDateDaysUntil(medicine.exp);
    if (remaining === null) return;
    if (remaining < 0) {
      sections[2].items.push({
        name: medicine.name,
        availableQuantity: qty,
        expirationDate: medicine.exp,
        expirationStatus: "Expired",
        route: "inventory",
      });
    } else if (remaining <= MEDICINE_EXPIRY_ALERT_DAYS) {
      sections[4].items.push({
        name: medicine.name,
        availableQuantity: qty,
        expirationDate: medicine.exp,
        daysRemaining: remaining,
        expirationStatus: "Expiring Soon",
        route: "inventory",
      });
    }
  });

  EQUIPMENT.filter((item) => !item.deleted && item.category === "Medical Supplies").forEach((item) => {
    const qty = Number(item.qty) || 0;
    if (qty <= threshold) {
      sections[1].items.push({
        name: item.name,
        currentQuantity: qty,
        minimumStock: threshold,
        stockStatus: qty === 0 ? "Out of Stock" : "Low Stock",
        route: "inventory",
      });
    }

    const expirationDate = item.exp || item.expirationDate || item.expiryDate || item.expiration;
    if (!expirationDate) return;
    const remaining = clinicDateDaysUntil(expirationDate);
    if (remaining === null) return;
    if (remaining < 0) {
      sections[3].items.push({
        name: item.name,
        availableQuantity: qty,
        expirationDate,
        expirationStatus: "Expired",
        route: "inventory",
      });
    } else if (remaining <= MEDICINE_EXPIRY_ALERT_DAYS) {
      sections[5].items.push({
        name: item.name,
        availableQuantity: qty,
        expirationDate,
        daysRemaining: remaining,
        expirationStatus: "Expiring Soon",
        route: "inventory",
      });
    }
  });

  const visitsByPatient = new Map();
  CONSULTATIONS.filter((visit) => !visit.deleted && visit.date && visit.date.startsWith(currentMonth)).forEach((visit) => {
    const key = visit.studentId || visit.studentName || "unknown";
    const entry = visitsByPatient.get(key) || {
      id: visit.studentId || null,
      name: visit.studentName || "Unknown patient",
      count: 0,
    };
    entry.count += 1;
    entry.name = visit.studentName || entry.name;
    visitsByPatient.set(key, entry);
  });

  sections[6].items = [...visitsByPatient.values()]
    .filter((entry) => entry.count >= (CLINIC_FREQUENT_VISIT_THRESHOLD || 2))
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      totalVisits: entry.count,
      monthLabel,
      route: "consultation",
    }));

  return {
    sections,
    hasAlerts: sections.some((section) => section.items.length > 0),
  };
}

function openLoginAlertsModal() {
  const alerts = buildLoginAlerts();
  const renderAlertItem = (section, item) => {
    const commonHtml = `
      <button type="button" class="clinic-alert-item" data-alert-route="${section.route}" data-alert-id="${escapeHtml(section.id)}-${escapeHtml(String(item.name || item.id || "item")).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}">
        <div class="clinic-alert-header">
          <div>
            <div class="clinic-alert-tag">${escapeHtml(section.badge)}</div>
            <strong>${escapeHtml(item.name || item.patientName || "Unnamed record")}</strong>
          </div>
          <span class="chip ${section.id.includes("expired") ? "chip-expired" : section.id.includes("expiring") ? "chip-expiring" : section.id.includes("low") ? "chip-low" : "chip-available"}">${section.title}</span>
        </div>
        <div class="clinic-alert-details">
    `;

    if (section.id.includes("low-stock")) {
      return `${commonHtml}
        <div><span>Current quantity</span><strong>${Number(item.currentQuantity ?? 0)}</strong></div>
        <div><span>Minimum stock</span><strong>${Number(item.minimumStock ?? 0)}</strong></div>
        <div><span>Stock status</span><strong>${escapeHtml(item.stockStatus || "Low Stock")}</strong></div>
      </div></button>`;
    }

    if (section.id.includes("expired")) {
      return `${commonHtml}
        <div><span>Available quantity</span><strong>${Number(item.availableQuantity ?? 0)}</strong></div>
        <div><span>Expiration date</span><strong>${fmtDate(item.expirationDate)}</strong></div>
        <div><span>Expiration status</span><strong>${escapeHtml(item.expirationStatus || "Expired")}</strong></div>
      </div></button>`;
    }

    if (section.id.includes("expiring")) {
      return `${commonHtml}
        <div><span>Available quantity</span><strong>${Number(item.availableQuantity ?? 0)}</strong></div>
        <div><span>Expiration date</span><strong>${fmtDate(item.expirationDate)}</strong></div>
        <div><span>Days remaining</span><strong>${Number(item.daysRemaining ?? 0)} day${Number(item.daysRemaining ?? 0) === 1 ? "" : "s"}</strong></div>
      </div></button>`;
    }

    return `${commonHtml}
      <div><span>Patient name</span><strong>${escapeHtml(item.name)}</strong></div>
      <div><span>Total clinic visits</span><strong>${Number(item.totalVisits ?? 0)}</strong></div>
      <div><span>Month & year</span><strong>${escapeHtml(item.monthLabel)}</strong></div>
    </div></button>`;
  };

  const body = alerts.hasAlerts
    ? alerts.sections.filter((section) => section.items.length > 0).map((section) => `
      <div class="clinic-alert-section">
        <div class="panel-title clinic-alert-title">
          <h4>${escapeHtml(section.title)}</h4>
          <span class="chip ${section.id.includes("expired") ? "chip-expired" : section.id.includes("expiring") ? "chip-expiring" : section.id.includes("low") ? "chip-low" : "chip-available"}">${section.items.length}</span>
        </div>
        <div class="clinic-alert-list">${section.items.map((item) => renderAlertItem(section, item)).join("")}</div>
      </div>
    `).join("")
    : `<div class="empty-state-box"><strong>There are currently no important clinic alerts.</strong></div>`;

  const html = `
    <div class="modal-head">
      <div><div class="eyebrow">CLINIC ALERTS</div><h3>Important clinic alerts</h3></div>
      <button class="modal-close" id="login-alerts-close" aria-label="Close clinic alerts">${ICONS.x}</button>
    </div>
    <div class="modal-body clinic-alert-modal-body">${body}</div>
    <div class="modal-foot"><button class="btn btn-dark" id="login-alerts-done">Close</button></div>`;

  openModal(html, "md");
  document.getElementById("login-alerts-close").onclick = closeModal;
  document.getElementById("login-alerts-done").onclick = closeModal;
  document.querySelectorAll("[data-alert-route]").forEach((button) => {
    button.onclick = () => {
      const route = button.getAttribute("data-alert-route");
      if (route) {
        state.page = route;
      }
      closeModal();
      render();
    };
  });
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
