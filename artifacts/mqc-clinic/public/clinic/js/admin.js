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
      <div class="f-field"><label>Password ${isEdit?"(leave blank to keep current)":'<span class="req">*</span>'}</label><div class="input-row"><input type="password" id="uf-password" value="" autocomplete="new-password"><button type="button" class="toggle-pw" data-toggle-password="uf-password" aria-label="Show password">${ICONS.eye}</button></div></div>
      <div class="f-field"><label>Confirm Password ${isEdit?"":'<span class="req">*</span>'}</label><div class="input-row"><input type="password" id="uf-confirm" value="" autocomplete="new-password"><button type="button" class="toggle-pw" data-toggle-password="uf-confirm" aria-label="Show password confirmation">${ICONS.eye}</button></div></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="uf-save">${ICONS.check} Save User</button></div>`;
  openModal(html);
  document.querySelectorAll("[data-toggle-password]").forEach(btn=>btn.onclick=()=>{const input=document.getElementById(btn.dataset.togglePassword); if(!input) return; const showing=input.type!=="password"; input.type=showing?"password":"text"; btn.innerHTML=showing?ICONS.eye:ICONS.eye_off; btn.setAttribute("aria-label", showing?"Show password":"Hide password"); });
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
      const created=await response.json();
      Object.assign(rec,created);
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
        DELETED_USERS.unshift({...u,deleted:true,deletedAt:new Date().toISOString()});
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
      <td>${fmtDate(l.date)}</td><td class="mono">${l.time}</td><td>${escapeHtml(l.user)}</td><td>${escapeHtml(l.role||"Unknown")}</td>
      <td>${escapeHtml(l.action)}</td><td>${l.module}</td>
      <td><span class="chip ${l.status==='Success'?'chip-available':l.status==='Warning'?'chip-low':'chip-out'}">${l.status}</span></td>
    </tr>`).join("");
  return `
  <div class="card">
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th><th>Status</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7">${emptyState("No audit activity recorded yet.")}</td></tr>`}</tbody></table></div>
    <div class="pagination"><span>Page ${state.auditPage} of ${totalPages} · ${AUDIT_LOGS.length} entries</span>
      <div class="page-btns"><button data-apage="prev">${ICONS.chevleft}</button><button data-apage="next">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
function bindAuditTab(){
  document.querySelectorAll('[data-apage]').forEach(b=> b.onclick=()=>{ state.auditPage += b.dataset.apage==='next'?1:-1; if(state.auditPage<1) state.auditPage=1; renderAdminTabBody(); });
}
function renderDeletedTab(){
  const delStudents=DELETED_STUDENTS||[];
  const delConsults=CONSULTATIONS.filter(c=>c.deleted||c.status==="Deleted");
  const delMeds=MEDICINES.filter(m=>m.deleted||m.deletedAt);
  const delEq=EQUIPMENT.filter(e=>e.deleted||e.deletedAt);
  const delUsers=DELETED_USERS||[];
  const section=(title, rows, empty)=>`
    <div class="card" style="margin-bottom:16px;">
      <div class="panel-title"><h4>${title}</h4></div>
      ${rows.length===0?emptyState(empty):`<div class="table-wrap"><table>${rows}</table></div>`}
    </div>`;
  const consultRows = delConsults.length? `<thead><tr><th>Record</th><th>Patient</th><th>Date</th><th></th></tr></thead><tbody>${
    delConsults.map(c=>`<tr><td class="mono">${escapeHtml(c.id)}</td><td>${escapeHtml(c.studentName||c.studentId||"Unknown patient")}</td><td>${fmtDate(c.date)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dc="${escapeHtml(c.id)}" title="Restore visit" aria-label="Restore visit ${escapeHtml(c.id)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dc="${escapeHtml(c.id)}" title="Delete visit permanently" aria-label="Delete visit ${escapeHtml(c.id)} permanently">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const studentRows = delStudents.length? `<thead><tr><th>Student ID</th><th>Name</th><th>Course / Year</th><th>Deleted</th><th></th></tr></thead><tbody>${
    delStudents.map(s=>`<tr><td class="mono">${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.course||"—")} · ${escapeHtml(s.year||"—")}</td><td>${fmtDate(s.deletedAt)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dp="${escapeHtml(s.id)}" title="Restore patient" aria-label="Restore patient ${escapeHtml(s.name)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dp="${escapeHtml(s.id)}" title="Delete patient permanently" aria-label="Delete patient ${escapeHtml(s.name)} permanently">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const medRows = delMeds.length? `<thead><tr><th>Code</th><th>Name</th><th>Deleted</th><th></th></tr></thead><tbody>${
    delMeds.map(m=>`<tr><td class="mono">${escapeHtml(m.code)}</td><td>${escapeHtml(m.name)}</td><td>${fmtDate(m.deletedAt)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-dm="${escapeHtml(m.code)}" title="Restore medicine" aria-label="Restore medicine ${escapeHtml(m.name)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-dm="${escapeHtml(m.code)}" title="Delete medicine permanently" aria-label="Delete medicine ${escapeHtml(m.name)} permanently">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const eqRows = delEq.length? `<thead><tr><th>ID</th><th>Name</th><th>Deleted</th><th></th></tr></thead><tbody>${
    delEq.map(e=>`<tr><td class="mono">${escapeHtml(e.id)}</td><td>${escapeHtml(e.name)}</td><td>${fmtDate(e.deletedAt)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-de="${escapeHtml(e.id)}" title="Restore equipment" aria-label="Restore equipment ${escapeHtml(e.name)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-de="${escapeHtml(e.id)}" title="Delete equipment permanently" aria-label="Delete equipment ${escapeHtml(e.name)} permanently">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  const userRows = delUsers.length? `<thead><tr><th>ID</th><th>Name</th><th>Deleted</th><th></th></tr></thead><tbody>${
    delUsers.map(u=>`<tr><td class="mono">${escapeHtml(u.id)}</td><td>${escapeHtml(u.name)}</td><td>${fmtDate(u.deletedAt)}</td>
    <td><div class="row-actions"><button class="mini-btn good" data-restore-du="${escapeHtml(u.id)}" title="Restore user" aria-label="Restore user ${escapeHtml(u.name)}">${ICONS.restore}</button><button class="mini-btn danger" data-perm-du="${escapeHtml(u.id)}" title="Delete user permanently" aria-label="Delete user ${escapeHtml(u.name)} permanently">${ICONS.trash_sm}</button></div></td></tr>`).join("")
  }</tbody>`:"";
  return section("Deleted Patient Visits", consultRows, "No deleted patient visits.")
    + section("Deleted Patients", studentRows, "No deleted patients.")
    + section("Deleted Medicines", medRows, "No deleted medicines.")
    + section("Deleted Equipment", eqRows, "No deleted equipment.")
    + section("Deleted Users", userRows, "No deleted users.");
}
async function commitDeletedRecordChange({label,apply,rollback,purge,auditAction,module,status="Success",successTitle,successMessage}){
  apply();
  if(purge)PURGED_RECORDS.push(purge);
  try{
    await saveToClinicState(false,true);
  }catch(error){
    rollback();
    if(purge)PURGED_RECORDS=PURGED_RECORDS.filter(row=>row!==purge);
    toast("Change not saved",error.message||`Unable to update ${label}.`,'err');
    renderAdminTabBody();
    return;
  }
  await logAudit(auditAction,module,status,false);
  toast(successTitle,successMessage,status==="Warning"?'warn':'ok');
  renderAdminTabBody();
}
function bindDeletedTab(){
  const confirmPurge=(label,table,key,value,action,rollback)=>{
    const purge={table,key,value};
    confirmDialog({title:"Permanently delete?",msg:`This will permanently remove <b>${escapeHtml(label)}</b>. This action cannot be undone.`,okLabel:"Delete Permanently",onConfirm:()=>commitDeletedRecordChange({label,apply:action,rollback,purge,auditAction:`Record Permanently Deleted — ${label}`,module:"Administration",status:"Warning",successTitle:"Permanently deleted",successMessage:`${label} has been permanently removed.`})});
  };
  document.querySelectorAll('[data-restore-dc]').forEach(b=>b.onclick=()=>{const r=CONSULTATIONS.find(c=>c.id===b.dataset.restoreDc);if(!r)return;const previous={deleted:r.deleted,deletedAt:r.deletedAt,status:r.status};commitDeletedRecordChange({label:`visit ${r.id}`,apply:()=>{r.deleted=false;delete r.deletedAt;if(r.status==="Deleted")r.status="Active";},rollback:()=>Object.assign(r,previous),auditAction:`Record Restored — Patient Visit ${r.id}`,module:"Patient Visits",successTitle:"Restored",successMessage:`Visit ${r.id} restored.`});});
  document.querySelectorAll('[data-restore-dp]').forEach(b=>b.onclick=()=>{const patient=DELETED_STUDENTS.find(row=>row.id===b.dataset.restoreDp);if(!patient)return;const restored={...patient,deleted:false};delete restored.deletedAt;delete restored.deletedBy;commitDeletedRecordChange({label:`patient ${patient.name}`,apply:()=>{DELETED_STUDENTS=DELETED_STUDENTS.filter(row=>row.id!==patient.id);STUDENTS.unshift(restored);},rollback:()=>{const index=STUDENTS.findIndex(row=>row.id===patient.id);if(index>=0)STUDENTS.splice(index,1);DELETED_STUDENTS.unshift(patient);},auditAction:`Record Restored — Patient ${patient.name}`,module:"Patients",successTitle:"Restored",successMessage:`${patient.name} restored.`});});
  document.querySelectorAll('[data-restore-dm]').forEach(b=>b.onclick=()=>{const item=MEDICINES.find(row=>row.code===b.dataset.restoreDm);if(!item)return;const previous={deleted:item.deleted,deletedAt:item.deletedAt};commitDeletedRecordChange({label:`medicine ${item.name}`,apply:()=>{item.deleted=false;delete item.deletedAt;},rollback:()=>Object.assign(item,previous),auditAction:`Record Restored — ${item.name}`,module:"Inventory",successTitle:"Restored",successMessage:`${item.name} restored.`});});
  document.querySelectorAll('[data-restore-de]').forEach(b=>b.onclick=()=>{const item=EQUIPMENT.find(row=>row.id===b.dataset.restoreDe);if(!item)return;const previous={deleted:item.deleted,deletedAt:item.deletedAt};commitDeletedRecordChange({label:`equipment ${item.name}`,apply:()=>{item.deleted=false;delete item.deletedAt;},rollback:()=>Object.assign(item,previous),auditAction:`Record Restored — ${item.name}`,module:"Inventory",successTitle:"Restored",successMessage:`${item.name} restored.`});});
  document.querySelectorAll('[data-restore-du]').forEach(b=>b.onclick=()=>{const user=DELETED_USERS.find(row=>row.id===b.dataset.restoreDu);if(!user)return;const restored={...user,deleted:false};delete restored.deletedAt;delete restored.deletedBy;commitDeletedRecordChange({label:`user ${user.name}`,apply:()=>{DELETED_USERS=DELETED_USERS.filter(row=>row.id!==user.id);state.users.unshift(restored);},rollback:()=>{state.users=state.users.filter(row=>row.id!==user.id);DELETED_USERS.unshift(user);},auditAction:`User Restored — ${user.name}`,module:"User Management",successTitle:"Restored",successMessage:`${user.name} restored.`});});
  document.querySelectorAll('[data-perm-dc]').forEach(b=>b.onclick=()=>{const record=CONSULTATIONS.find(row=>row.id===b.dataset.permDc);if(!record)return;confirmPurge(`visit ${record.id}`,"clinical_visits","id",record.id,()=>{CONSULTATIONS=CONSULTATIONS.filter(row=>row!==record);},()=>CONSULTATIONS.unshift(record));});
  document.querySelectorAll('[data-perm-dp]').forEach(b=>b.onclick=()=>{const record=DELETED_STUDENTS.find(row=>row.id===b.dataset.permDp);if(!record)return;confirmPurge(`patient ${record.name}`,"patients","id",record.id,()=>{DELETED_STUDENTS=DELETED_STUDENTS.filter(row=>row!==record);},()=>DELETED_STUDENTS.unshift(record));});
  document.querySelectorAll('[data-perm-dm]').forEach(b=>b.onclick=()=>{const record=MEDICINES.find(row=>row.code===b.dataset.permDm);if(!record)return;confirmPurge(`medicine ${record.name}`,"medicines","code",record.code,()=>{MEDICINES=MEDICINES.filter(row=>row!==record);},()=>MEDICINES.unshift(record));});
  document.querySelectorAll('[data-perm-de]').forEach(b=>b.onclick=()=>{const record=EQUIPMENT.find(row=>row.id===b.dataset.permDe);if(!record)return;confirmPurge(`equipment ${record.name}`,"equipment","id",record.id,()=>{EQUIPMENT=EQUIPMENT.filter(row=>row!==record);},()=>EQUIPMENT.unshift(record));});
  document.querySelectorAll('[data-perm-du]').forEach(b=>b.onclick=()=>{const record=DELETED_USERS.find(row=>row.id===b.dataset.permDu);if(!record)return;confirmPurge(`user ${record.name}`,"clinic_users","id",record.id,()=>{DELETED_USERS=DELETED_USERS.filter(row=>row!==record);},()=>DELETED_USERS.unshift(record));});
}
function renderAdminTabBody(){
  const body=document.getElementById('admin-body');
  if(state.adminTab==='users'){ body.innerHTML=renderUsersTab(); bindUsersTab(); }
  else if(state.adminTab==='audit'){ body.innerHTML=renderAuditTab(); bindAuditTab(); }
  else {
    try{
      body.innerHTML=renderDeletedTab();
      bindDeletedTab();
    }catch(error){
      console.error("Unable to render deleted clinic records.",error);
      body.innerHTML=["Patient Visits","Patients","Medicines","Equipment","Users"].map(category=>`
        <div class="card" style="margin-bottom:16px;">
          <div class="panel-title"><h4>Deleted ${category}</h4></div>
          ${emptyState("Deleted records could not be loaded. Check the clinic sync status and reload this page.")}
        </div>`).join("");
    }
  }
}
