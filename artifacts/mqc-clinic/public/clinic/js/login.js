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
      <div class="remember-row">
        <label><input type="checkbox" id="remember-me"> Remember me</label>
        <span class="login-security-note">Identity verification required</span>
      </div>
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
    const user=document.getElementById('login-user').value.trim();
    const pass=document.getElementById('login-pass').value.trim();
    const errEl=document.getElementById('login-error');
    const loginButton=document.getElementById('login-btn');
    const spinner=document.getElementById('login-spinner');
    const btnText=document.getElementById('login-btn-text');
    errEl.style.display='none';
    if(!user || !pass){ errEl.textContent='Please enter both username and password.'; errEl.style.display='block'; return; }
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
    const rememberMe=document.getElementById('remember-me').checked;
    state.currentUser=ensureVisibleClinicUser(found);
    state.loggedIn=true;
    saveAuthSession(found,rememberMe);
    logAudit("Signed In","Authentication");
    render();
    toast("Signed in",`Welcome back, ${state.currentUser.name}.`,"ok");
  });
}

function openIdentityVerification(user,rememberMe=false,loginPassword=""){
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
    const password=document.getElementById("verification-password").value;
    const error=document.getElementById("verification-error");
    if(password!==(user.password||loginPassword)){
      error.textContent="That password does not match this clinic account.";
      error.style.display="block";
      return;
    }
    state.currentUser=ensureVisibleClinicUser(user);
    state.loggedIn=true;
    saveAuthSession(user,rememberMe);
    closeModal();
    logAudit("Identity Verified","Authentication");
    render();
    toast("Identity verified",`Welcome back, ${state.currentUser.name}.`,"ok");
  };
}
