/* ================= SHARED CLINIC STORAGE =================
  Supabase is the source of truth for clinic data.
================================================================= */
const AUTH_SESSION_KEY = "mqc_clinic_auth_v1";
const SHARED_STORAGE_URL = "/api/clinic-state";
let serverHydrationPromise;
let serverSaveChain=Promise.resolve();
let localChangeVersion=0;
let sharedStorageMissing=false;
let sharedStorageNeedsBootstrap=false;

function setSyncStatus(label, stateName="idle"){
  const indicator=document.getElementById("sync-status");
  if(!indicator)return;
  indicator.textContent=label;
  indicator.dataset.state=stateName;
}

function snapshotData(resetAuditLogs=false){
  ensureInventoryLedger();
  const normalizedAuditLogs = (AUDIT_LOGS || []).map(log => ({
    ...log,
    timestamp: normalizeAuditTimestamp(log),
    createdAt: normalizeAuditTimestamp(log),
    date: log.date || todayDateString(),
    time: log.time || new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Manila', hour:'2-digit', minute:'2-digit', hour12:true }).format(new Date()),
  }));
  return {
    students: [...STUDENTS, ...DELETED_STUDENTS],
    medicines: MEDICINES,
    equipment: EQUIPMENT,
    inventoryTransactions: INVENTORY_TRANSACTIONS,
    consultations: CONSULTATIONS,
    auditLogs: normalizedAuditLogs,
    deletedStudents: DELETED_STUDENTS,
    deletedUsers: DELETED_USERS,
    purged: PURGED_RECORDS,
    users: [...state.users, ...DELETED_USERS],
    settings: state.settings,
    resetAuditLogs,
    savedAt: new Date(new Date().toLocaleString('en-US', { timeZone:'Asia/Manila' })).toISOString(),
  };
}

function inventoryItemKey(itemType,itemId){return `${itemType}:${itemId}`;}
function recordInventoryTransaction(itemType,item,kind,quantity,date=todayDateString(),referenceId=""){
  const amount=Number(quantity);
  if(!Number.isFinite(amount)||amount===0)return;
  INVENTORY_TRANSACTIONS.unshift({id:uid("INV"),itemType,itemId:itemType==="medicine"?item.code:item.id,itemName:item.name,kind,quantity:amount,date,referenceId,createdAt:new Date().toISOString()});
}
function recordInventoryQuantityChange(itemType,item,previousQuantity,nextQuantity){
  const delta=Number(nextQuantity)-Number(previousQuantity);
  if(delta>0)recordInventoryTransaction(itemType,item,"added",delta);
  else if(delta<0)recordInventoryTransaction(itemType,item,"used",Math.abs(delta));
}
function ensureInventoryLedger(){
  const known=new Set(INVENTORY_TRANSACTIONS.map(entry=>inventoryItemKey(entry.itemType,entry.itemId)));
  [...MEDICINES.map(item=>({itemType:"medicine",item})),...EQUIPMENT.map(item=>({itemType:"equipment",item}))].forEach(({itemType,item})=>{
    const itemId=itemType==="medicine"?item.code:item.id,key=inventoryItemKey(itemType,itemId);
    if(known.has(key))return;
    INVENTORY_TRANSACTIONS.unshift({id:uid("INV"),itemType,itemId,itemName:item.name,kind:"baseline",quantity:Number(item.qty)||0,date:todayDateString(),referenceId:"",createdAt:new Date().toISOString()});
    known.add(key);
  });
}

function normalizeAuditTimestamp(log){
  const supplied = log.timestamp || log.createdAt;
  if(supplied){
    const parsed = new Date(supplied);
    if(!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const date = log.date || todayDateString();
  const time = String(log.time || '00:00').trim();
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  let hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;
  const meridiem = match?.[3]?.toUpperCase();
  if(meridiem === 'PM' && hours < 12) hours += 12;
  if(meridiem === 'AM' && hours === 12) hours = 0;
  const utcMs = Date.UTC(...date.split('-').map(Number), hours, minutes) - 8 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function saveToClinicState(resetAuditLogs=false){
  localChangeVersion+=1;
  const payload=snapshotData(resetAuditLogs);
  setSyncStatus("Saving", "saving");
  serverSaveChain=serverSaveChain.then(async()=>{
    const response=await fetch(SHARED_STORAGE_URL,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      throw new Error(result.message||`Supabase sync returned ${response.status}`);
    }
    setSyncStatus("Saved", "saved");
  }).catch(err=>{setSyncStatus("Sync failed", "error");console.warn("MQC Clinic: shared storage is temporarily unavailable.",err);});
  return serverSaveChain;
}

function applyStoredData(data){
  if(Array.isArray(data.students)) STUDENTS.splice(0, STUDENTS.length, ...data.students.filter(s=>!s.deleted));
  if(Array.isArray(data.medicines)) MEDICINES = data.medicines;
  if(Array.isArray(data.equipment)) EQUIPMENT = data.equipment;
  INVENTORY_TRANSACTIONS=Array.isArray(data.inventoryTransactions)?data.inventoryTransactions:[];
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
  if(!EQUIPMENT.some(item=>item.name.trim().toLowerCase()==="nebulizer")){
    const usedIds=new Set(EQUIPMENT.map(item=>item.id));
    let nextId=1;
    while(usedIds.has(`EQP-${String(nextId).padStart(3,"0")}`))nextId++;
    EQUIPMENT.push({id:`EQP-${String(nextId).padStart(3,"0")}`,name:"Nebulizer",qty:1,condition:"Good",lastMaint:todayDateString(),status:"Available",deleted:false});
    migratedInventory=true;
  }
  if(Array.isArray(data.consultations)) CONSULTATIONS = data.consultations;
  if(Array.isArray(data.auditLogs)) AUDIT_LOGS = data.auditLogs;
  if(Array.isArray(data.deletedStudents)) DELETED_STUDENTS = data.deletedStudents;
  else if(Array.isArray(data.students)) DELETED_STUDENTS = data.students.filter(s=>s.deleted);
  if(Array.isArray(data.deletedUsers)) DELETED_USERS = data.deletedUsers;
  if(Array.isArray(data.users)) state.users = data.users;
  if(data.settings && typeof data.settings==="object") state.settings = {...state.settings,...data.settings};
  ensureInventoryLedger();
  return migratedInventory;
}

async function hydrateFromSharedStorage(){
  const hydrationVersion=localChangeVersion;
  try{
    const response=await fetch(SHARED_STORAGE_URL,{cache:"no-store"});
    if(response.ok){
      const data=await response.json();
      if(localChangeVersion!==hydrationVersion) return false;
      sharedStorageNeedsBootstrap=Boolean(data.bootstrapRequired);
      applyStoredData(data);
      if(!Array.isArray(data.inventoryTransactions))sharedStorageNeedsBootstrap=true;
      return true;
    }
    sharedStorageMissing=response.status===404;
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
