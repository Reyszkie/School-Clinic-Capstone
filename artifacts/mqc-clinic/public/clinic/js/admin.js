/* ================= ADMIN ================= */
function renderAdmin(){
  return `
  <div class="subtabs">
    <button class="subtab ${state.adminTab==='users'?'active':''}" data-atab="users">User Management</button>
    <button class="subtab ${state.adminTab==='audit'?'active':''}" data-atab="audit">Audit Logs</button>
    <button class="subtab ${state.adminTab==='deleted'?'active':''}" data-atab="deleted">Deleted Records</button>
  </div>
  <div id="admin-body"></div>`;
}
function renderUsersTab(){
  const rows = state.users.map(u=>`
    <tr>
      <td class="mono">${u.id}</td>
      <td>${escapeHtml(u.name)}</td>
      <td>${u.role}</td>
      <td><span class="chip ${u.status==='Active'?'chip-available':'chip-void'}">${u.status}</span></td>
      <td><div class="row-actions">
        <button class="mini-btn" data-edit-user="${u.id}" title="Edit">${ICONS.edit}</button>
        <button class="mini-btn" data-toggle-user="${u.id}" title="${u.status==='Active'?'Disable':'Enable'}">${u.status==='Active'?ICONS.x:ICONS.check}</button>
        <button class="mini-btn danger" data-del-user="${u.id}" title="Delete">${ICONS.trash_sm}</button>
      </div></td>
    </tr>`).join("");
  return `
  <div class="card">
    <div class="toolbar" style="justify-content:flex-end;">
      <button class="btn btn-coral" id="add-user-btn">${ICONS.plus} Add User</button>
    </div>
    <div class="table-wrap">
       <table><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  </div>`;
}
function openUserForm(existing=null){
  const isEdit=!!existing;
  const f=existing||{id:uid("NRS"), lastName:"", firstName:"", middleInitial:"", name:"", role:"Staff Nurse", username:"", password:"", status:"Active"};
  const parts=(f.name||"").split(",");
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} User</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="user-form">
      <div class="f-field"><label>Last Name <span class="req">*</span></label><input type="text" id="uf-lastname" value="${escapeHtml(f.lastName||parts[0]||"")}" required></div>
      <div class="f-field"><label>First Name <span class="req">*</span></label><input type="text" id="uf-firstname" value="${escapeHtml(f.firstName||(parts[1]||"").trim()||"")}" required></div>
      <div class="f-field"><label>Middle Initial</label><input type="text" id="uf-middle" value="${escapeHtml(f.middleInitial||"")}" maxlength="3"></div>
      <div class="f-field"><label>Role</label><select id="uf-role">${["Head Nurse & Administrator","Head Nurse","Staff Nurse"].map(r=>`<option ${f.role===r?'selected':''}>${r}</option>`).join("")}</select></div>
      <div class="f-field"><label>Username <span class="req">*</span></label><input type="text" id="uf-username" value="${f.username}" required></div>
      <div class="f-field"><label>Status</label><select id="uf-status">${["Active","Disabled"].map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join("")}</select></div>
      <div class="f-field"><label>Password ${isEdit?"(leave blank to keep current)":'<span class="req">*</span>'}</label><div class="input-row"><input type="password" id="uf-password" value=""><button type="button" class="toggle-pw" data-toggle-password="uf-password">SHOW</button></div></div>
      <div class="f-field"><label>Confirm Password ${isEdit?"":'<span class="req">*</span>'}</label><div class="input-row"><input type="password" id="uf-confirm" value=""><button type="button" class="toggle-pw" data-toggle-password="uf-confirm">SHOW</button></div></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="uf-save">${ICONS.check} Save User</button></div>`;
  openModal(html);
  document.querySelectorAll("[data-toggle-password]").forEach(btn=>btn.onclick=()=>{const input=document.getElementById(btn.dataset.togglePassword);input.type=input.type==="password"?"text":"password";btn.textContent=input.type==="password"?"SHOW":"HIDE";});
  document.getElementById('uf-save').onclick=async()=>{
    const last=document.getElementById('uf-lastname').value.trim();
    const first=document.getElementById('uf-firstname').value.trim();
    const middle=document.getElementById('uf-middle').value.trim();
    const username=document.getElementById('uf-username').value.trim();
    const password=document.getElementById('uf-password').value;
    const confirm=document.getElementById('uf-confirm').value;
    if(!last || !first || !username){ toast('Missing information','Last name, first name, and username are required.','err'); return; }
    if(!isEdit&&!password){ toast('Password required','Create a password for this user.','err'); return; }
    if(password!==confirm){ toast('Passwords do not match','Enter the same password in both fields.','err'); return; }
    const name=`${last}, ${first}${middle?' '+middle.replace(/\.$/,'')+'.':''}`;
    const rec={ id:f.id, name, lastName:last, firstName:first, middleInitial:middle, role:document.getElementById('uf-role').value, username, password:password||f.password||'', status:document.getElementById('uf-status').value };
    if(!isEdit){
      const response=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lastName:last,firstName:first,middleInitial:middle,role:rec.role,username,password,status:rec.status})});
      if(!response.ok){const result=await response.json().catch(()=>({}));toast('Account creation failed',result.message||'Unable to create the Supabase account.','err');return;}
    }
    if(isEdit){ const idx=state.users.findIndex(u=>u.id===f.id); state.users[idx]=rec; logAudit(`User Updated — ${name}`,"User Management"); toast('User updated', `${name} has been updated.`,'ok'); }
    else{ state.users.unshift(rec); logAudit(`User Added — ${name}`,"User Management"); toast('User added', `${name} added as ${rec.role}.`,'ok'); }
    closeModal(); renderAdminTabBody();
  };
}
function bindUsersTab(){
  document.getElementById('add-user-btn').onclick=()=>openUserForm();
  document.querySelectorAll('[data-edit-user]').forEach(b=> b.onclick=()=>openUserForm(state.users.find(u=>u.id===b.dataset.editUser)));
  document.querySelectorAll('[data-toggle-user]').forEach(b=>{
    b.onclick=()=>{
      const u=state.users.find(x=>x.id===b.dataset.toggleUser);
      u.status = u.status==='Active'?'Disabled':'Active';
      logAudit(`User ${u.status==='Active'?'Enabled':'Disabled'} — ${u.name}`,"User Management");
      toast(`User ${u.status.toLowerCase()}`, `${u.name} is now ${u.status.toLowerCase()}.`,'ok');
      renderAdminTabBody();
    };
  });
  document.querySelectorAll('[data-del-user]').forEach(b=>{
    b.onclick=()=>{
      const u=state.users.find(x=>x.id===b.dataset.delUser);
      confirmDialog({title:"Delete this user?", msg:`<b>${escapeHtml(u.name)}</b> will be moved to Deleted Records.`, okLabel:"Delete User", onConfirm:()=>{
        state.users=state.users.filter(x=>x.id!==u.id);
        DELETED_USERS.unshift(u);
        logAudit(`Record Deleted — User ${u.name}`,"User Management","Warning");
        toast('User deleted', `${u.name} moved to Deleted Records.`,'warn');
        renderAdminTabBody();
      }});
    };
  });
}
function renderAuditTab(){
  const perPage=10;
  const totalPages=Math.max(1, Math.ceil(AUDIT_LOGS.length/perPage));
  if(state.auditPage>totalPages) state.auditPage=totalPages;
  const items=AUDIT_LOGS.slice((state.auditPage-1)*perPage, state.auditPage*perPage);
  const rows=items.map(l=>`
    <tr>
      <td>${fmtDate(l.date)}</td><td class="mono">${l.time}</td><td>${escapeHtml(l.user)}</td>
      <td>${escapeHtml(l.action)}</td><td>${l.module}</td>
      <td><span class="chip ${l.status==='Success'?'chip-available':l.status==='Warning'?'chip-low':'chip-out'}">${l.status}</span></td>
    </tr>`).join("");
  return `
  <div class="card">
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">${emptyState("No audit activity recorded yet.")}</td></tr>`}</tbody></table></div>
    <div class="pagination"><span>Page ${state.auditPage} of ${totalPages} · ${AUDIT_LOGS.length} entries</span>
      <div class="page-btns"><button data-apage="prev">${ICONS.chevleft}</button><button data-apage="next">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
function bindAuditTab(){
  document.querySelectorAll('[data-apage]').forEach(b=> b.onclick=()=>{ state.auditPage += b.dataset.apage==='next'?1:-1; if(state.auditPage<1) state.auditPage=1; renderAdminTabBody(); });
}
function renderDeletedTab(){
  const delStudents=DELETED_STUDENTS;
  const delConsults=CONSULTATIONS.filter(c=>c.deleted);
  const delMeds=MEDICINES.filter(m=>m.deleted);
  const delEq=EQUIPMENT.filter(e=>e.deleted);
  const section=(title, rows, empty)=>`
    <div class="card" style="margin-bottom:16px;">
      <div class="panel-title"><h4>${title}</h4></div>
      ${rows.length===0?emptyState(empty):`<div class="table-wrap"><table>${rows}</table></div>`}
    </div>`;
  const consultRows = delConsults.length? `<thead><tr><th>Record</th><th>Patient</th><th>Date</th><th></th></tr></thead><tbody>${
    delConsults.map(c=>`<tr><td class="mono">${c.id}</td><td>${escapeHtml(c.studentName)}</td><td>${fmtDate(c.date)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dc="${c.id}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dc="${c.id}">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const studentRows = delStudents.length? `<thead><tr><th>Student ID</th><th>Name</th><th>Course / Year</th><th>Deleted</th><th></th></tr></thead><tbody>${
    delStudents.map(s=>`<tr><td class="mono">${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.course||"—")} · ${escapeHtml(s.year||"—")}</td><td>${fmtDate(s.deletedAt)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dp="${escapeHtml(s.id)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dp="${escapeHtml(s.id)}">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const medRows = delMeds.length? `<thead><tr><th>Code</th><th>Name</th><th></th></tr></thead><tbody>${
    delMeds.map(m=>`<tr><td class="mono">${m.code}</td><td>${escapeHtml(m.name)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dm="${m.code}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dm="${m.code}">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const eqRows = delEq.length? `<thead><tr><th>ID</th><th>Name</th><th></th></tr></thead><tbody>${
    delEq.map(e=>`<tr><td class="mono">${e.id}</td><td>${escapeHtml(e.name)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-de="${e.id}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-de="${e.id}">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const userRows = DELETED_USERS.length? `<thead><tr><th>ID</th><th>Name</th><th></th></tr></thead><tbody>${
    DELETED_USERS.map(u=>`<tr><td class="mono">${u.id}</td><td>${escapeHtml(u.name)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-du="${u.id}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-du="${u.id}">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  return section("Deleted Patient Visits", consultRows, "No deleted patient visits.")
    + section("Deleted Patients", studentRows, "No deleted patients.")
    + section("Deleted Medicines", medRows, "No deleted medicines.")
    + section("Deleted Equipment", eqRows, "No deleted equipment.")
    + section("Deleted Users", userRows, "No deleted users.");
}
function bindDeletedTab(){
  const rerender=()=>{ document.getElementById('admin-body').innerHTML=renderDeletedTab(); bindDeletedTab(); };
  document.querySelectorAll('[data-restore-dc]').forEach(b=> b.onclick=()=>{ const r=CONSULTATIONS.find(c=>c.id===b.dataset.restoreDc); r.deleted=false; logAudit(`Record Restored — Patient Visit ${r.id}`,"Patient Visits"); toast('Restored', `Visit ${r.id} restored.`,'ok'); rerender(); });
  document.querySelectorAll('[data-restore-dp]').forEach(b=> b.onclick=()=>{ const s=DELETED_STUDENTS.find(x=>x.id===b.dataset.restoreDp); if(!s)return; DELETED_STUDENTS=DELETED_STUDENTS.filter(x=>x.id!==s.id); const restored={...s,deleted:false}; delete restored.deletedAt; delete restored.deletedBy; STUDENTS.unshift(restored); logAudit(`Record Restored — Patient ${s.name}`,"Patient Visits"); toast('Restored', `${s.name} restored.`,'ok'); rerender(); });
  document.querySelectorAll('[data-restore-dm]').forEach(b=> b.onclick=()=>{ const r=MEDICINES.find(m=>m.code===b.dataset.restoreDm); r.deleted=false; logAudit(`Record Restored — ${r.name}`,"Inventory"); toast('Restored', `${r.name} restored.`,'ok'); rerender(); });
  document.querySelectorAll('[data-restore-de]').forEach(b=> b.onclick=()=>{ const r=EQUIPMENT.find(e=>e.id===b.dataset.restoreDe); r.deleted=false; logAudit(`Record Restored — ${r.name}`,"Inventory"); toast('Restored', `${r.name} restored.`,'ok'); rerender(); });
  document.querySelectorAll('[data-restore-du]').forEach(b=> b.onclick=()=>{ const u=DELETED_USERS.find(x=>x.id===b.dataset.restoreDu); DELETED_USERS=DELETED_USERS.filter(x=>x.id!==u.id); state.users.unshift(u); logAudit(`User Restored — ${u.name}`,"User Management"); toast('Restored', `${u.name} restored.`,'ok'); rerender(); });

  const permDelete=(label, table, key, value, action)=>{
    confirmDialog({title:"Permanently delete?", msg:`This will permanently remove <b>${escapeHtml(label)}</b>. This action cannot be undone.`, okLabel:"Delete Permanently", onConfirm:()=>{ action(); PURGED_RECORDS.push({table,key,value}); logAudit(`Record Permanently Deleted — ${label}`,"Administration","Warning"); saveToClinicState(); toast('Permanently deleted', `${label} has been permanently removed.`,'warn'); rerender(); }});
  };
  document.querySelectorAll('[data-perm-dc]').forEach(b=> b.onclick=()=>permDelete(b.dataset.permDc,"clinical_visits","id",b.dataset.permDc,()=>{ CONSULTATIONS=CONSULTATIONS.filter(c=>c.id!==b.dataset.permDc); }));
  document.querySelectorAll('[data-perm-dp]').forEach(b=> b.onclick=()=>permDelete(b.dataset.permDp,"patients","id",b.dataset.permDp,()=>{ DELETED_STUDENTS=DELETED_STUDENTS.filter(s=>s.id!==b.dataset.permDp); }));
  document.querySelectorAll('[data-perm-dm]').forEach(b=> b.onclick=()=>permDelete(b.dataset.permDm,"medicines","code",b.dataset.permDm,()=>{ MEDICINES=MEDICINES.filter(m=>m.code!==b.dataset.permDm); }));
  document.querySelectorAll('[data-perm-de]').forEach(b=> b.onclick=()=>permDelete(b.dataset.permDe,"equipment","id",b.dataset.permDe,()=>{ EQUIPMENT=EQUIPMENT.filter(e=>e.id!==b.dataset.permDe); }));
  document.querySelectorAll('[data-perm-du]').forEach(b=> b.onclick=()=>permDelete(b.dataset.permDu,"clinic_users","id",b.dataset.permDu,()=>{ DELETED_USERS=DELETED_USERS.filter(u=>u.id!==b.dataset.permDu); }));
}
function renderAdminTabBody(){
  const body=document.getElementById('admin-body');
  if(state.adminTab==='users'){ body.innerHTML=renderUsersTab(); bindUsersTab(); }
  else if(state.adminTab==='audit'){ body.innerHTML=renderAuditTab(); bindAuditTab(); }
  else { body.innerHTML=renderDeletedTab(); bindDeletedTab(); }
}
