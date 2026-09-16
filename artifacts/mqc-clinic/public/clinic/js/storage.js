/* ================= SHARED CLINIC STORAGE =================
  Supabase is the source of truth for clinic data.
================================================================= */
const AUTH_SESSION_KEY = "mqc_clinic_auth_v1";
const SHARED_STORAGE_URL = "/api/clinic-state";
let serverHydrationPromise;
let serverSaveChain=Promise.resolve();
let localChangeVersion=0;

function snapshotData(){
  return {
    students: STUDENTS,
    medicines: MEDICINES,
    equipment: EQUIPMENT,
    consultations: CONSULTATIONS,
    auditLogs: AUDIT_LOGS,
    deletedStudents: DELETED_STUDENTS,
    deletedUsers: DELETED_USERS,
    users: state.users,
    settings: state.settings,
    savedAt: new Date().toISOString(),
  };
}

function saveToClinicState(){
  localChangeVersion+=1;
  const payload=snapshotData();
  serverSaveChain=serverSaveChain.then(()=>fetch(SHARED_STORAGE_URL,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),
  })).catch(err=>console.warn("MQC Clinic: shared storage is temporarily unavailable.",err));
}

function applyStoredData(data){
  if(Array.isArray(data.students)) STUDENTS.splice(0, STUDENTS.length, ...data.students.filter(s=>!s.deleted));
  if(Array.isArray(data.medicines)) MEDICINES = data.medicines;
  if(Array.isArray(data.equipment)) EQUIPMENT = data.equipment;
  const medicalToolNames=new Set([
    "Cotton Swabs","Cotton Balls","Alcohol (70% Isopropyl)","Elastic Bandage","Adhesive Bandages (Band-Aids)","Gauze Pads",
    "Medical Tape","Hand Sanitizer","Disposable Face Masks","Gloves (Nitrile, Medium)"
  ]);
  const movedTools=MEDICINES.filter(m=>medicalToolNames.has(m.name));
  let migratedInventory=false;
  if(movedTools.length){
    MEDICINES=MEDICINES.filter(m=>!medicalToolNames.has(m.name));
    const existingEquipmentNames=new Set(EQUIPMENT.map(e=>e.name));
    const equipmentCount=EQUIPMENT.length;
    movedTools.forEach((m,index)=>{if(!existingEquipmentNames.has(m.name)){EQUIPMENT.push({id:`EQP-${String(equipmentCount+index+1).padStart(3,"0")}`,name:m.name,qty:m.qty,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:m.deleted});migratedInventory=true;}});
  }
  if(Array.isArray(data.consultations)) CONSULTATIONS = data.consultations;
  if(Array.isArray(data.auditLogs)) AUDIT_LOGS = data.auditLogs;
  if(Array.isArray(data.deletedStudents)) DELETED_STUDENTS = data.deletedStudents;
  else if(Array.isArray(data.students)) DELETED_STUDENTS = data.students.filter(s=>s.deleted);
  if(Array.isArray(data.deletedUsers)) DELETED_USERS = data.deletedUsers;
  if(Array.isArray(data.users)) state.users = data.users;
  if(data.settings && typeof data.settings==="object") state.settings = {...state.settings,...data.settings};
  return migratedInventory;
}

async function hydrateFromSharedStorage(){
  const hydrationVersion=localChangeVersion;
  try{
    const response=await fetch(SHARED_STORAGE_URL,{cache:"no-store"});
    if(response.ok){
      const data=await response.json();
      if(localChangeVersion!==hydrationVersion) return false;
      applyStoredData(data);
      return true;
    }
    console.warn("MQC Clinic: shared clinic state could not be loaded.", response.status);
  }catch(err){
    console.warn("MQC Clinic: shared storage is unavailable.",err);
  }
  return false;
}

function saveAuthSession(user, rememberMe=false){
  const authData=JSON.stringify({username:user.username});
  try{
    window.sessionStorage.setItem(AUTH_SESSION_KEY,authData);
  }catch(err){ console.warn("MQC Clinic: couldn't save the login session.",err); }
}

function restoreAuthSession(){
  try{
    const raw=window.sessionStorage.getItem(AUTH_SESSION_KEY);
    if(!raw) return false;
    const saved=JSON.parse(raw);
    const user=state.users.find(candidate=>candidate.username===saved.username && candidate.status!=='Disabled');
    if(!user) return false;
    state.currentUser=user;
    state.loggedIn=true;
    return true;
  }catch(err){
    console.warn("MQC Clinic: couldn't restore the login session.",err);
    return false;
  }
}

function clearAuthSession(){
  try{
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
  }catch(err){ /* ignore */ }
}
