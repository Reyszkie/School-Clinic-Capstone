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
  document.getElementById("appearance-theme")?.addEventListener("change",async event=>{
    applyClinicTheme(event.target.value);
    try{window.localStorage.setItem("mqc_clinic_appearance_theme_v1",state.settings.appearanceTheme);}catch{}
    try{await saveToClinicState(false,true);}
    catch(error){toast("Theme applied on this device","The theme is active and saved locally, but shared sync failed: "+(error.message||"Unable to sync the selected theme."),"err");return;}
    try{await logAudit(`Appearance Theme Changed — ${state.settings.appearanceTheme}`,"Settings","Success",false,true);toast("Appearance updated","Your color theme has been saved.","ok");}
    catch{toast("Appearance saved; audit sync failed","The theme was saved, but its audit entry could not be recorded.","err");}
  });
  document.getElementById("backup-btn")?.addEventListener("click",async()=>{const blob=new Blob([JSON.stringify(snapshotData(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mqc-clinic-backup-${todayDateString()}.json`;a.click();URL.revokeObjectURL(a.href);try{await logAudit("Clinic Data Backup Exported","Settings","Success",false,true);toast("Backup created","A JSON backup of clinic records was downloaded.","ok");}catch{toast("Backup created; audit sync failed","The backup downloaded, but its audit entry could not be recorded.","err");}});
  document.getElementById("restore-file")?.addEventListener("change",event=>{
    const file=event.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const backup=JSON.parse(reader.result);
        if(!Array.isArray(backup.students)||!Array.isArray(backup.consultations))throw new Error("Invalid backup");
        const deletedStudents=Array.isArray(backup.deletedStudents)?backup.deletedStudents:backup.students.filter(student=>student.deleted);
        const deletedUsers=(Array.isArray(backup.deletedUsers)?backup.deletedUsers:(backup.users||[]).filter(user=>user.deleted)).map(user=>({...user,deleted:true,deletedAt:user.deletedAt||new Date().toISOString()}));
        const deletedUserIds=new Set(deletedUsers.map(user=>user.id));
        STUDENTS.splice(0,STUDENTS.length,...backup.students.filter(student=>!student.deleted));
        DELETED_STUDENTS=deletedStudents;
        CONSULTATIONS=backup.consultations;
        if(Array.isArray(backup.medicines))MEDICINES=backup.medicines;
        if(Array.isArray(backup.equipment))EQUIPMENT=backup.equipment;
        if(Array.isArray(backup.inventoryTransactions))INVENTORY_TRANSACTIONS=backup.inventoryTransactions;
        if(Array.isArray(backup.auditLogs))AUDIT_LOGS=backup.auditLogs;
        if(Array.isArray(backup.users))state.users=backup.users.filter(user=>!user.deleted&&!deletedUserIds.has(user.id));
        DELETED_USERS=deletedUsers;
        if(Array.isArray(backup.purged))PURGED_RECORDS=backup.purged;
        if(backup.settings)state.settings={...state.settings,...backup.settings};
        await queueClinicStateSave(snapshotData(true),true);
        try{await logAudit("Backup Restored","Settings","Success",false,true);toast("Backup restored","Clinic records were restored successfully.","ok");}
        catch{toast("Backup restored; audit sync failed","Clinic records were restored, but the audit entry could not be recorded.","err");}
        render();
      }catch(error){
        toast("Restore failed",error.message||"Choose a valid MQC Clinic JSON backup.","err");
      }
    };
    reader.readAsText(file);
  });

}