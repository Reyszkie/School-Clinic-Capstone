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
let clinicDataLoaded=false;
let clinicDataStatus="loading";
let clinicDataFingerprint="";
let clinicDataChanged=false;

function setSyncStatus(label, stateName="idle"){
  const indicator=document.getElementById("sync-status");
  if(!indicator)return;
  indicator.textContent=label;
  indicator.dataset.state=stateName;
}

function snapshotData(includeAuditLogs=true){
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
    ...(includeAuditLogs ? {auditLogs:normalizedAuditLogs} : {}),
    deletedStudents: DELETED_STUDENTS,
    deletedUsers: DELETED_USERS,
    purged: PURGED_RECORDS,
    users: [...state.users, ...DELETED_USERS],
    settings: state.settings,
    inventoryCatalogVersion: INVENTORY_CATALOG_VERSION,
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
  if(visit.medicine||visit.medicineCode){
    const medicine=MEDICINES.find(item=>item.code===visit.medicineCode||item.name===visit.medicine);
    if(medicine)add("medicine",medicine,Math.max(1,Number(visit.medQty)||1));
    else{
      const equipment=EQUIPMENT.find(item=>item.id===visit.medicine||item.name===visit.medicine);
      if(equipment)add("equipment",equipment,1);
    }
  }
  const supplyNames=Array.isArray(visit.supplyUsed)?visit.supplyUsed:(visit.supplyUsed?[visit.supplyUsed]:[]);
  const selectedSupply=EQUIPMENT.find(candidate=>candidate.id===visit.supplyItemId)
    ||EQUIPMENT.find(candidate=>candidate.category==="Medical Supplies"&&supplyNames.includes(candidate.name));
  if(selectedSupply)add("equipment",selectedSupply,Math.max(1,Number(visit.supplyQty)||1));
  const toolNames=Array.isArray(visit.equipmentUsed)?visit.equipmentUsed:(visit.equipmentUsed?[visit.equipmentUsed]:[]);
  toolNames.forEach(name=>{
    const item=EQUIPMENT.find(candidate=>candidate.id===name||candidate.name===name);
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
    const previouslyDispensed=returning.get(inventoryItemKey(requirement.itemType,requirement.itemId))||0;
    const needsNewStock=requirement.quantity>previouslyDispensed;
    if(needsNewStock&&(requirement.item.deleted||requirement.itemType==="medicine"&&medicineIsExpired(requirement.item)||requirement.itemType==="equipment"&&requirement.item.status!=="Available")||available<requirement.quantity){
      const label=requirement.itemType==="medicine"?`${requirement.item.name} ${requirement.item.unit||"unit(s)"}`:requirement.item.name;
      throw new Error(`${label} has only ${available} available; ${requirement.quantity} required.`);
    }
  }
}
function applyVisitInventoryUsage(visit,previousVisit=null){
  const requirements=visitInventoryRequirements(visit);
  const active=activeVisitInventoryTransactions(visit.id);
  const previouslyDispensed=new Map((previousVisit?visitInventoryRequirements(previousVisit):[])
    .map(requirement=>[inventoryItemKey(requirement.itemType,requirement.itemId),requirement.quantity]));
  for(const requirement of requirements){
    const alreadyApplied=active.some(entry=>entry.itemType===requirement.itemType&&entry.itemId===requirement.itemId);
    if(alreadyApplied)continue;
    const historicalQuantity=previouslyDispensed.get(inventoryItemKey(requirement.itemType,requirement.itemId))||0;
    const needsNewStock=requirement.quantity>historicalQuantity;
    if(needsNewStock&&(requirement.item.deleted||requirement.itemType==="medicine"&&medicineIsExpired(requirement.item)||requirement.itemType==="equipment"&&requirement.item.status!=="Available")||Number(requirement.item.qty)<requirement.quantity){
      const available=Number(requirement.item.qty)||0;
      throw new Error(`${requirement.item.name} has only ${available} available; ${requirement.quantity} required.`);
    }
  }
  requirements.forEach(requirement=>{
    if(active.some(entry=>entry.itemType===requirement.itemType&&entry.itemId===requirement.itemId))return;
    requirement.item.qty=Number(requirement.item.qty)-requirement.quantity;
    recordInventoryTransaction(requirement.itemType,requirement.item,"used",requirement.quantity,visit.date,visit.id);
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
  });
  return active.length;
}
function clinicInventoryAuditActions(snapshot,reference=""){
  const previous=new Map([
    ...snapshot.medicineQuantities.map(([item,quantity])=>[inventoryItemKey("medicine",item.code),Number(quantity)||0]),
    ...snapshot.equipmentQuantities.map(([item,quantity])=>[inventoryItemKey("equipment",item.id),Number(quantity)||0]),
  ]);
  return [
    ...MEDICINES.map(item=>({type:"medicine",item,key:inventoryItemKey("medicine",item.code)})),
    ...EQUIPMENT.map(item=>({type:"equipment",item,key:inventoryItemKey("equipment",item.id)})),
  ].flatMap(({type,item,key})=>{
    if(!previous.has(key))return [];
    const prior=previous.get(key),current=Number(item.qty)||0;
    return prior===current?[]:[{action:`Inventory Stock Updated — ${item.name}: ${prior} → ${current}`,module:type==="medicine"?"Medicines":"Equipment",detail:`${type==="medicine"?item.code:item.id}${reference?`; ${reference}`:""}`}];
  });
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

function saveToClinicState(_resetAuditLogs=false,throwOnError=false,purgeRequests=[],inventoryBootstrap=false){
  const payload=snapshotData(false);
  if(purgeRequests.length)payload.purgeRequests=purgeRequests;
  if(inventoryBootstrap)payload.inventoryBootstrap=true;
  return queueClinicStateSave(payload,throwOnError);
}

async function commitClinicRecordMutation({apply,rollback,save=()=>saveToClinicState(false,true),auditAction,auditActions,module,status="Success",successTitle,successMessage,detail="",refresh=render}){
  let attempted=false;
  try{
    attempted=true;
    apply();
    await save();
  }catch(error){
    if(attempted)rollback();
    toast("Change not saved",error.message||"Unable to update the clinic record.","err");
    refresh();
    return false;
  }
  try{
    const events=auditActions||[{action:auditAction,module,status,detail}];
    for(const event of events)await logAudit(event.action,event.module||module,event.status||status,false,true,event.detail||detail);
  }catch{
    toast("Record saved; audit sync failed","The change was saved, but its audit entry could not be recorded.","err");
    refresh();
    return true;
  }
  toast(successTitle,successMessage,status==="Warning"?"warn":"ok");
  refresh();
  return true;
}

function saveInventoryRecordToClinicState(itemType,itemId,previousQuantity=null){
  const item=itemType==="medicine"?MEDICINES.find(record=>record.code===itemId):EQUIPMENT.find(record=>record.id===itemId);
  if(!item)return Promise.reject(new Error("The inventory record for this save could not be found."));
  const payload={
    inventoryMutation:{itemType,itemId,previousQuantity},
    medicines:itemType==="medicine"?[item]:[],
    equipment:itemType==="equipment"?[item]:[],
    inventoryTransactions:INVENTORY_TRANSACTIONS,
    savedAt:new Date().toISOString(),
  };
  return queueClinicStateSave(payload,true);
}

function saveInventoryItemStatusToClinicState(itemType,itemId,deleted){
  return queueClinicStateSave({
    inventoryStatusMutation:{itemType,itemId,deleted},
  },true);
}

function saveVisitToClinicState(visitIds,inventorySnapshot,patientIds=[],createPatient=false,updateVisit=false){
  const payload=snapshotData(false);
  payload.visitMutation={
    visitIds:visitIds.filter(Boolean),
    patientIds:patientIds.filter(Boolean),
    createPatient,
    updateVisit,
    medicineCodes:inventorySnapshot.medicineQuantities.filter(([item,quantity])=>Number(item.qty)!==quantity).map(([item])=>item.code),
    equipmentIds:inventorySnapshot.equipmentQuantities.filter(([item,quantity])=>Number(item.qty)!==quantity).map(([item])=>item.id),
  };
  return queueClinicStateSave(payload,true);
}

function saveVisitInventoryStatusToClinicState(visitId,deleted,restorePatient=false){
  const payload=snapshotData(false);
  payload.visitStatusMutation={visitId,deleted,restorePatient};
  return queueClinicStateSave(payload,true);
}

function applyStoredData(data){
  clinicDataLoaded=true;
  clinicDataStatus="ready";
  if(Array.isArray(data.students)) STUDENTS.splice(0, STUDENTS.length, ...data.students.filter(s=>!s.deleted));
  if(Array.isArray(data.medicines)) MEDICINES = data.medicines;
  if(Array.isArray(data.equipment)) EQUIPMENT = data.equipment;
  INVENTORY_TRANSACTIONS=Array.isArray(data.inventoryTransactions)?data.inventoryTransactions:[];
  const medicalToolNames=new Set([...MEDICAL_SUPPLY_NAMES,...Object.keys(INVENTORY_ITEM_NAME_ALIASES)]);
  let migratedInventory=false;
  const movedTools=MEDICINES.filter(m=>medicalToolNames.has(m.name));
  if(movedTools.length){
    MEDICINES=MEDICINES.filter(m=>!medicalToolNames.has(m.name));
    const existingEquipmentNames=new Set(EQUIPMENT.map(e=>e.name));
    const equipmentCount=EQUIPMENT.length;
    movedTools.forEach((m,index)=>{
      const name=INVENTORY_ITEM_NAME_ALIASES[m.name]||m.name;
      const category=HISTORIC_MEDICAL_EQUIPMENT_NAMES.includes(name)?"Medical Equipment":"Medical Supplies";
      if(!existingEquipmentNames.has(name)){
        EQUIPMENT.push({id:`EQP-${String(equipmentCount+index+1).padStart(3,"0")}`,name,category,qty:m.qty,condition:"Good",lastMaint:"",status:"Available",deleted:m.deleted});
        migratedInventory=true;
      }
    });
  }
  const catalogMigrationRequired=data.inventoryCatalogVersion!==INVENTORY_CATALOG_VERSION;
  const medicineByName=name=>MEDICINES.find(item=>item.name.toLowerCase()===name.toLowerCase());
  MEDICINE_CATALOG_NAMES.forEach(name=>{
    const existing=medicineByName(name);
    if(existing){
      if(existing.deleted&&catalogMigrationRequired){existing.deleted=false;delete existing.deletedAt;migratedInventory=true;}
      return;
    }
    let code;
    do{code=uid("MED");}while(MEDICINES.some(item=>item.code===code));
    MEDICINES.push({code,name,category:"General",qty:0,unit:"tablet",exp:"",deleted:false});
    migratedInventory=true;
  });
  const supplyByName=name=>EQUIPMENT.find(item=>(INVENTORY_ITEM_NAME_ALIASES[item.name]||item.name).toLowerCase()===name.toLowerCase());
  EQUIPMENT.forEach(item=>{
    item.name=INVENTORY_ITEM_NAME_ALIASES[item.name]||item.name;
    if(MEDICAL_SUPPLY_NAMES.includes(item.name))item.category="Medical Supplies";
    else if(HISTORIC_MEDICAL_EQUIPMENT_NAMES.includes(item.name))item.category="Medical Equipment";
    if(REMOVED_MEDICAL_SUPPLY_NAMES.includes(item.name)&&!item.deleted){
      item.deleted=true;
      item.deletedAt=item.deletedAt||new Date().toISOString();
      migratedInventory=true;
    }
  });
  MEDICAL_SUPPLY_NAMES.forEach(name=>{
    const existing=supplyByName(name);
    if(existing){
      if(existing.deleted&&catalogMigrationRequired){existing.deleted=false;delete existing.deletedAt;migratedInventory=true;}
      if(existing.category!=="Medical Supplies"){existing.category="Medical Supplies";migratedInventory=true;}
      return;
    }
    EQUIPMENT.push({id:uid("EQP"),name,category:"Medical Supplies",qty:0,condition:"Good",lastMaint:"",status:"Available",deleted:false});
    migratedInventory=true;
  });
  if(catalogMigrationRequired)migratedInventory=true;
  if(Array.isArray(data.consultations)) CONSULTATIONS = data.consultations;
  if(Array.isArray(data.auditLogs)) AUDIT_LOGS = data.auditLogs;
  if(Array.isArray(data.deletedStudents)) DELETED_STUDENTS = data.deletedStudents;
  else if(Array.isArray(data.students)) DELETED_STUDENTS = data.students.filter(s=>s.deleted);
  if(Array.isArray(data.deletedUsers)) DELETED_USERS = data.deletedUsers;
  if(Array.isArray(data.purged)) PURGED_RECORDS = data.purged;
  if(Array.isArray(data.users)) state.users = data.users;
  if(data.settings && typeof data.settings==="object") state.settings = {...state.settings,...data.settings};
  try{
    const savedTheme=window.localStorage.getItem("mqc_clinic_appearance_theme_v1");
    if(CLINIC_THEMES.some(theme=>theme.id===savedTheme))state.settings.appearanceTheme=savedTheme;
  }catch{}
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
      const fingerprint=JSON.stringify([data.students,data.medicines,data.equipment,data.inventoryTransactions,data.consultations,data.auditLogs,data.deletedStudents,data.deletedUsers,data.users,data.settings]);
      clinicDataChanged=!clinicDataLoaded||fingerprint!==clinicDataFingerprint;
      clinicDataFingerprint=fingerprint;
      sharedStorageNeedsBootstrap=Boolean(data.bootstrapRequired);
      if(applyStoredData(data))sharedStorageNeedsBootstrap=true;
      setSyncStatus("Live", "saved");
      if(!Array.isArray(data.inventoryTransactions))sharedStorageNeedsBootstrap=true;
      return true;
    }
    sharedStorageMissing=response.status===404;
    clinicDataStatus=clinicDataLoaded?"stale":response.status===404?"empty":"error";
    setSyncStatus(clinicDataLoaded?"Stale":"Unavailable","error");
    console.warn("MQC Clinic: shared clinic state could not be loaded.", response.status);
  }catch(err){
    clinicDataStatus=clinicDataLoaded?"stale":"error";
    setSyncStatus(clinicDataLoaded?"Stale":"Unavailable","error");
    console.warn("MQC Clinic: shared storage is unavailable.",err);
  }
  return false;
}

function startClinicRefresh(){
  if(window.__clinicRefreshTimer)return;
  window.__clinicRefreshTimer=window.setInterval(async()=>{
    if(!state.loggedIn||modalStack.length||document.visibilityState==="hidden")return;
    const previousStatus=clinicDataStatus;
    const refreshed=await hydrateFromSharedStorage();
    if(refreshed&&(clinicDataChanged||previousStatus!==clinicDataStatus)){
      const app=document.getElementById("app");
      const activeElement=document.activeElement;
      const activeId=activeElement?.id;
      const selectionStart=typeof activeElement?.selectionStart==="number"?activeElement.selectionStart:null;
      const selectionEnd=typeof activeElement?.selectionEnd==="number"?activeElement.selectionEnd:null;
      const hadFocus=Boolean(activeElement&&activeElement!==document.body&&app?.contains(activeElement));
      render();
      if(hadFocus&&activeId){const replacement=document.getElementById(activeId);if(replacement){replacement.focus();if(selectionStart!==null&&typeof replacement.setSelectionRange==="function")replacement.setSelectionRange(selectionStart,selectionEnd);}}
    }
  },5000);
}

function saveAuthSession(user, rememberMe=false){
  const authData=JSON.stringify({username:user.username,rememberMe:Boolean(rememberMe)});
  try{
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    (rememberMe?window.localStorage:window.sessionStorage).setItem(AUTH_SESSION_KEY,authData);
  }catch(err){ console.warn("MQC Clinic: couldn't save the login session.",err); }
}

async function restoreAuthSession(){
  try{
    const rememberedRaw=window.localStorage.getItem(AUTH_SESSION_KEY);
    const raw=rememberedRaw||window.sessionStorage.getItem(AUTH_SESSION_KEY);
    let saved=null;
    if(raw){
      try{saved=JSON.parse(raw);}
      catch{clearAuthSession();}
    }
    if(rememberedRaw&&saved?.rememberMe!==true){window.localStorage.removeItem(AUTH_SESSION_KEY);}
    const response=await fetch("/api/auth/session",{cache:"no-store"});
    if(response.status===401){clearAuthSession();return false;}
    if(!response.ok)throw new Error(`Clinic session validation returned ${response.status}.`);
    const user=await response.json();
    if(!user?.id||user.status!=="Active"||(saved?.username&&user.username!==saved.username)){clearAuthSession();return false;}
    ensureVisibleClinicUser(user);
    state.currentUser=user;
    state.loggedIn=true;
    return true;
  }catch(err){
    console.warn("MQC Clinic: couldn't restore the login session.",err);
    throw err;
  }
}

function clearAuthSession(){
  try{
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  }catch(err){ /* ignore */ }
}
