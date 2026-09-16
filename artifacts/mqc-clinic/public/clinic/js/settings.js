/* ================= SETTINGS ================= */
function settingField(label,id,value,type="text"){
  return `<div class="f-field"><label>${label}</label><input type="${type}" id="${id}" value="${escapeHtml(value??"")}"></div>`;
}
function renderSettings(){
  const u=state.currentUser;
  return `<div class="grid grid-2">
    <div class="card"><div class="panel-title"><h4>Backup & Restore</h4></div>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.6">Download a copy of the clinic records saved in this browser, or restore a previous JSON backup.</p>
      <div class="toolbar"><button class="btn btn-blue" id="backup-btn">${ICONS.download||ICONS.check} Create Backup</button><label class="btn">Restore Backup<input type="file" id="restore-file" accept=".json" style="display:none"></label></div>
    </div>
    <div class="card"><div class="panel-title"><h4>Data Management</h4></div>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.6">Deleted visits, medicines, equipment, and users remain recoverable under Administration → Deleted Records.</p>
      <button class="btn btn-outline-red" id="reset-data-btn">${ICONS.trash_sm} Clear Patient & Visit Data</button>
    </div>
    <div class="card"><div class="panel-title"><h4>About System</h4></div><p style="font-size:13px;color:var(--ink-soft);line-height:1.7">MQC School Clinic Management System<br>Version 3.0 · School Year 2026–2027<br>Designed for accountable student care operations.</p></div>
  </div>`;
}
function bindSettings(){
  document.getElementById("backup-btn")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify(snapshotData(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mqc-clinic-backup-${todayDateString()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Backup created","A JSON backup of clinic records was downloaded.","ok");});
  document.getElementById("restore-file")?.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!Array.isArray(d.students)||!Array.isArray(d.consultations))throw new Error("Invalid backup");STUDENTS.splice(0,STUDENTS.length,...d.students);CONSULTATIONS=d.consultations;if(Array.isArray(d.medicines))MEDICINES=d.medicines;if(Array.isArray(d.equipment))EQUIPMENT=d.equipment;if(Array.isArray(d.users))state.users=d.users;if(d.settings)state.settings={...state.settings,...d.settings};saveToClinicState();logAudit("Backup Restored","Settings");toast("Backup restored","Clinic records were restored successfully.","ok");render();}catch(err){toast("Restore failed","Choose a valid MQC Clinic JSON backup.","err");}};reader.readAsText(file);});
  document.getElementById("reset-data-btn")?.addEventListener("click",()=>confirmDialog({title:"Clear patient and visit data?",msg:"This removes all patient records, visit history, and saved audit entries from Supabase. Inventory and user accounts remain available.",okLabel:"Clear Records",onConfirm:()=>{STUDENTS.splice(0);CONSULTATIONS=[];AUDIT_LOGS=[];saveToClinicState();toast("Records cleared","Patient and visit data have been removed.","warn");render();}}));
}