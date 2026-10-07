/* ================= SETTINGS ================= */
function settingField(label,id,value,type="text"){
  return `<div class="f-field"><label>${label}</label><input type="${type}" id="${id}" value="${escapeHtml(value??"")}"></div>`;
}
function renderSettings(){
  const u=state.currentUser;
  const appearanceTheme=state.settings.appearanceTheme||"ocean";
  return `<div class="card settings-appearance"><div class="panel-title"><h4>Theme &amp; Appearance</h4></div>
      <div class="appearance-setting"><div><b>Color theme</b><p>Choose a readable color palette for the clinic workspace.</p></div>
        <select id="appearance-theme" aria-label="Color theme">${CLINIC_THEMES.map(theme=>`<option value="${theme.id}" ${appearanceTheme===theme.id?"selected":""}>${theme.label}</option>`).join("")}</select>
      </div>
    </div><div class="grid grid-2">
    <div class="card"><div class="panel-title"><h4>Backup & Restore</h4></div>
      <p style="font-size:13px;color:var(--ink-soft);line-height:1.6">Download a copy of the clinic records saved in this browser, or restore a previous JSON backup.</p>
      <div class="toolbar"><button class="btn btn-blue" id="backup-btn">${ICONS.download||ICONS.check} Create Backup</button><label class="btn">Restore Backup<input type="file" id="restore-file" accept=".json" style="display:none"></label></div>
    </div>

    <div class="card"><div class="panel-title"><h4>About System</h4></div><p style="font-size:13px;color:var(--ink-soft);line-height:1.7">MQC School Clinic Management System<br>Version 3.0 · School Year 2026–2027<br>Designed for accountable student care operations.</p></div>
  </div>`;
}
function bindSettings(){
  document.getElementById("appearance-theme")?.addEventListener("change",event=>{
    applyClinicTheme(event.target.value);
    try{window.localStorage.setItem("mqc_clinic_appearance_theme_v1",state.settings.appearanceTheme);}catch{}
    saveToClinicState();
    toast("Appearance updated","Your color theme has been saved.","ok");
  });
  document.getElementById("backup-btn")?.addEventListener("click",()=>{const blob=new Blob([JSON.stringify(snapshotData(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mqc-clinic-backup-${todayDateString()}.json`;a.click();URL.revokeObjectURL(a.href);toast("Backup created","A JSON backup of clinic records was downloaded.","ok");});
  document.getElementById("restore-file")?.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const d=JSON.parse(reader.result);if(!Array.isArray(d.students)||!Array.isArray(d.consultations))throw new Error("Invalid backup");STUDENTS.splice(0,STUDENTS.length,...d.students);CONSULTATIONS=d.consultations;if(Array.isArray(d.medicines))MEDICINES=d.medicines;if(Array.isArray(d.equipment))EQUIPMENT=d.equipment;if(Array.isArray(d.users))state.users=d.users;if(d.settings)state.settings={...state.settings,...d.settings};saveToClinicState();logAudit("Backup Restored","Settings");toast("Backup restored","Clinic records were restored successfully.","ok");render();}catch(err){toast("Restore failed","Choose a valid MQC Clinic JSON backup.","err");}};reader.readAsText(file);});

}