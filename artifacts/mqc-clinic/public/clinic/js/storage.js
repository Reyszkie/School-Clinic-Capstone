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
  const transaction={id:uid("INV"),itemType,itemId:itemType==="medicine"?item.code:item.id,itemName:item.name,kind,quantity:amount,date,referenceId,createdAt:new Date().toISOString()};
  INVENTORY_TRANSACTIONS.unshift(transaction);
  return transaction;
}
function recordInventoryQuantityChange(itemType,item,previousQuantity,nextQuantity){
  const delta=Number(nextQuantity)-Number(previousQuantity);
  if(delta>0)recordInventoryTransaction(itemType,item,"added",delta);
  else if(delta<0)recordInventoryTransaction(itemType,item,"used",Math.abs(delta));
}
function captureInventoryState(){
  return {
    medicineQuantities:MEDICINES.map(item=>[item,Number(item.qty)||0]),
    equipmentQuantities:EQUIPMENT.map(item=>[item,Number(item.qty)||0]),
    transactions:INVENTORY_TRANSACTIONS.slice(),
    auditLogs:AUDIT_LOGS.slice(),
  };
}
function restoreInventoryState(snapshot){
  snapshot.medicineQuantities.forEach(([item,quantity])=>{item.qty=quantity;});
  snapshot.equipmentQuantities.forEach(([item,quantity])=>{item.qty=quantity;});
  INVENTORY_TRANSACTIONS.splice(0,INVENTORY_TRANSACTIONS.length,...snapshot.transactions);
  AUDIT_LOGS.splice(0,AUDIT_LOGS.length,...snapshot.auditLogs);
}
function inventoryItemForUsage(itemType,itemId){
  return itemType==="medicine"
    ? MEDICINES.find(item=>item.code===itemId)
    : EQUIPMENT.find(item=>item.id===itemId);
}
function activeVisitInventoryTransactions(visitId){
  const reversedIds=new Set(INVENTORY_TRANSACTIONS.filter(entry=>entry.kind==="reversed").map(entry=>entry.reversesTransactionId));
  return INVENTORY_TRANSACTIONS.filter(entry=>entry.kind==="used"&&entry.referenceId===visitId&&!reversedIds.has(entry.id));
}
function visitInventoryRequirements(visit){
  const requirements=new Map();
  const add=(itemType,item,quantity)=>{
    if(!item)return;
    const key=inventoryItemKey(itemType,itemType==="medicine"?item.code:item.id);
    const prior=requirements.get(key);
    requirements.set(key,{itemType,itemId:itemType==="medicine"?item.code:item.id,item,quantity:Math.max(prior?.quantity||0,quantity)});
  };
  if(visit.medicine){
    const medicine=MEDICINES.find(item=>item.name===visit.medicine);
    if(medicine)add("medicine",medicine,Math.max(1,Number(visit.medQty)||1));
    else{
      const equipment=EQUIPMENT.find(item=>item.name===visit.medicine);
      if(equipment)add("equipment",equipment,1);
    }
  }
  const supplyNames=Array.isArray(visit.supplyUsed)?visit.supplyUsed:(visit.supplyUsed?[visit.supplyUsed]:[]);
  supplyNames.forEach(name=>{
    const item=EQUIPMENT.find(candidate=>candidate.name===name);
    if(item)add("equipment",item,Math.max(1,Number(visit.supplyQty)||1));
  });
  const toolNames=Array.isArray(visit.equipmentUsed)?visit.equipmentUsed:(visit.equipmentUsed?[visit.equipmentUsed]:[]);
  toolNames.forEach(name=>{
    const item=EQUIPMENT.find(candidate=>candidate.name===name);
    if(item)add("equipment",item,Math.max(1,Number(visit.equipmentQty)||1));
  });
  return [...requirements.values()];
}
function validateVisitInventoryUsage(visit,previousVisit=null){
  const returning=new Map();
  if(previousVisit)activeVisitInventoryTransactions(previousVisit.id).forEach(entry=>{
    const key=inventoryItemKey(entry.itemType,entry.itemId);
    returning.set(key,(returning.get(key)||0)+Number(entry.quantity||0));
  });
  for(const requirement of visitInventoryRequirements(visit)){
    const available=(Number(requirement.item.qty)||0)+(returning.get(inventoryItemKey(requirement.itemType,requirement.itemId))||0);
    if(requirement.item.deleted||requirement.itemType==="equipment"&&requirement.item.status!=="Available"||available<requirement.quantity){
      const label=requirement.itemType==="medicine"?`${requirement.item.name} ${requirement.item.unit||"unit(s)"}`:requirement.item.name;
      throw new Error(`${label} has only ${available} available; ${requirement.quantity} required.`);
    }
  }
}
function applyVisitInventoryUsage(visit){
  const requirements=visitInventoryRequirements(visit);
  const active=activeVisitInventoryTransactions(visit.id);
  for(const requirement of requirements){
    const alreadyApplied=active.some(entry=>entry.itemType===requirement.itemType&&entry.itemId===requirement.itemId);
    if(alreadyApplied)continue;
    if(requirement.item.deleted||requirement.itemType==="equipment"&&requirement.item.status!=="Available"||Number(requirement.item.qty)<requirement.quantity){
      const available=Number(requirement.item.qty)||0;
      throw new Error(`${requirement.item.name} has only ${available} available; ${requirement.quantity} required.`);
    }
  }
  requirements.forEach(requirement=>{
    if(active.some(entry=>entry.itemType===requirement.itemType&&entry.itemId===requirement.itemId))return;
    requirement.item.qty=Number(requirement.item.qty)-requirement.quantity;
    recordInventoryTransaction(requirement.itemType,requirement.item,"used",requirement.quantity,visit.date,visit.id);
    logAudit(`Inventory Used — ${requirement.item.name} × ${requirement.quantity} for visit ${visit.id}`,"Inventory","Success",false);
  });
}
function reverseVisitInventoryUsage(visit){
  const active=activeVisitInventoryTransactions(visit.id);
  active.forEach(entry=>{
    const item=inventoryItemForUsage(entry.itemType,entry.itemId);
    if(!item)return;
    const quantity=Number(entry.quantity)||0;
    item.qty=(Number(item.qty)||0)+quantity;
    const reversal=recordInventoryTransaction(entry.itemType,item,"reversed",quantity,todayDateString(),visit.id);
    if(reversal)reversal.reversesTransactionId=entry.id;
    logAudit(`Inventory Restored — ${item.name} × ${quantity} from visit ${visit.id}`,"Inventory","Success",false);
  });
  return active.length;
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

function queueClinicStateSave(payload,throwOnError=false){
  localChangeVersion+=1;
  setSyncStatus("Saving", "saving");
  const saveOperation=serverSaveChain.then(async()=>{
    const response=await fetch(SHARED_STORAGE_URL,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      throw new Error(result.message||`Supabase sync returned ${response.status}`);
    }
    setSyncStatus("Saved", "saved");
  }).catch(err=>{setSyncStatus("Sync failed", "error");console.warn("MQC Clinic: shared storage is temporarily unavailable.",err);if(throwOnError)throw err;});
  serverSaveChain=saveOperation.catch(()=>{});
  return saveOperation;
}

function saveToClinicState(resetAuditLogs=false,throwOnError=false){
  return queueClinicStateSave(snapshotData(resetAuditLogs),throwOnError);
}

function saveVisitToClinicState(visitIds,inventorySnapshot){
  const payload=snapshotData();
  const previousAuditIds=new Set(inventorySnapshot.auditLogs.map(log=>String(log.id)));
  payload.visitMutation={
    visitIds:visitIds.filter(Boolean),
    medicineCodes:inventorySnapshot.medicineQuantities.filter(([item,quantity])=>Number(item.qty)!==quantity).map(([item])=>item.code),
    equipmentIds:inventorySnapshot.equipmentQuantities.filter(([item,quantity])=>Number(item.qty)!==quantity).map(([item])=>item.id),
    auditIds:AUDIT_LOGS.filter(log=>!previousAuditIds.has(String(log.id))).map(log=>log.id),
  };
  return queueClinicStateSave(payload,true);
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
