/* ================= INVENTORY ================= */
const MEDICINE_EXPIRY_ALERT_DAYS=30;
function inventoryIdentityPart(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
function sameMedicineIdentity(left, right) {
  return ["name", "category", "unit"].every(
    (key) => inventoryIdentityPart(left[key]) === inventoryIdentityPart(right[key]),
  );
}
function medicineBatchSnapshot(medicine) {
  if (Array.isArray(medicine?.batches) && medicine.batches.length)
    return medicine.batches.map((batch, index) => ({
      ...batch,
      id: batch.id || `${medicine.code}-B${index + 1}`,
      productionDate: batch.productionDate ?? batch.production_date ?? medicine.productionDate ?? null,
    }));
  return Number(medicine?.qty) > 0
    ? [{
        id: `${medicine.code}-LEGACY`,
        qty: Number(medicine.qty) || 0,
        productionDate: medicine.productionDate || null,
        exp: medicine.exp || null,
        status: "Available",
      }]
    : [];
}
function supplyBatchSnapshot(supply) {
  if (Array.isArray(supply?.batches) && supply.batches.length)
    return supply.batches.map((batch, index) => ({
      ...batch,
      id: batch.id || `${supply.id}-B${index + 1}`,
      qty: Math.max(0, Number(batch.qty ?? batch.quantity) || 0),
      productionDate:
        batch.productionDate ?? batch.production_date ?? supply.productionDate ?? "",
      exp:
        batch.exp ??
        batch.expirationDate ??
        batch.expiration_date ??
        "",
      batchNumber: batch.batchNumber || batch.batch_number || "",
      status: batch.status || "Available",
      voidedQuantity: batch.voidedQuantity ?? batch.voided_quantity,
      voidedAt: batch.voidedAt ?? batch.voided_at,
    }));
  return Number(supply?.qty) > 0
    ? [{
        id: `${supply.id}-LEGACY`,
        qty: Number(supply.qty) || 0,
        productionDate: supply.productionDate || "",
        exp: null,
        batchNumber: "",
        status: "Available",
      }]
    : [];
}
function nextSupplyBatchIdentifier(supplyId, batches = []) {
  const prefix = `${supplyId}-B`;
  const identifiers = new Set(
    batches.flatMap((batch) => [batch.id, batch.batchNumber]),
  );
  const highestSequence = batches.reduce((highest, batch) => {
    return [batch.id, batch.batchNumber].reduce((current, value) => {
      if (!String(value || "").startsWith(prefix)) return current;
      const suffix = String(value).slice(prefix.length);
      return /^\d+$/.test(suffix)
        ? Math.max(current, Number(suffix))
        : current;
    }, highest);
  }, 0);
  let sequence = Math.max(batches.length, highestSequence) + 1;
  while (identifiers.has(`${prefix}${sequence}`)) sequence += 1;
  return `${prefix}${sequence}`;
}
function supplyAvailableQuantity(supply) {
  if (!supply || supply.deleted) return 0;
  return supplyBatchSnapshot(supply)
    .filter((batch) => {
      if (batch.status !== "Available" || batch.deleted) return false;
      if (!batch.exp) return true;
      const days = clinicDateDaysUntil(batch.exp);
      return days !== null && days >= 0 && days !== 3;
    })
    .reduce((total, batch) => total + batch.qty, 0);
}
function monitorAndVoidMedicineBatches() {
  let changed = false;
  MEDICINES.forEach((medicine) => {
    if (!Array.isArray(medicine.batches) || !medicine.batches.length) {
      if (medicine.exp) {
        medicine.batches = [{
          id: `${medicine.code}-B1`,
          qty: Number(medicine.qty) || 0,
          exp: medicine.exp,
          status: "Available",
        }];
      }
    }
    medicine.batches.forEach((batch) => {
      if (!batch.exp || batch.status === "Voided") return;
      const days = clinicDateDaysUntil(batch.exp);
      if (days === 3) {
        const quantity = Number(batch.qty ?? batch.quantity) || 0;
        batch.voidedQuantity = quantity;
        batch.qty = 0;
        batch.quantity = 0;
        batch.status = "Voided";
        batch.voidedAt = new Date().toISOString();
        if (quantity > 0) {
          logAudit(
            `Automatic Medicine Voiding — ${medicine.name} — Batch ${batch.id}`,
            "Medicines",
            "Warning",
            false,
          );
        }
        changed = true;
      }
    });
    medicine.qty = medicine.batches
      .filter((batch) => batch.status !== "Voided")
      .reduce((total, batch) => total + (Number(batch.qty ?? batch.quantity) || 0), 0);
  });
  return changed;
}
function medicineBatches(medicine) {
  if (!medicine) return [];
  if (Array.isArray(medicine.batches) && medicine.batches.length) {
    return medicine.batches
      .filter((batch) => !batch.deleted)
      .map((batch, index) => ({
        id: batch.id || `${medicine.code}-B${index + 1}`,
        qty: Math.max(0, Number(batch.qty ?? batch.quantity) || 0),
        productionDate: batch.productionDate ?? batch.production_date ?? medicine.productionDate ?? "",
        exp: batch.exp ?? batch.expirationDate ?? batch.expiration_date ?? "",
        batchNumber: batch.batchNumber || batch.batch_number || "",
        status: batch.status || "Available",
        voidedQuantity: batch.voidedQuantity ?? batch.voided_quantity,
      }));
  }
  return medicine.exp || Number(medicine.qty) > 0
    ? [{
        id: `${medicine.code}-B1`,
        qty: Number(medicine.qty) || 0,
        productionDate: medicine.productionDate || "",
        exp: medicine.exp || "",
        status: "Available",
      }]
    : [];
}
function medicineAvailableQuantity(medicine) {
  if (!medicine || medicine.deleted) return 0;
  return medicineBatches(medicine)
    .filter((batch) => {
      if (batch.status !== "Available") return false;
      if (!batch.exp) return true;
      const days = clinicDateDaysUntil(batch.exp);
      return days !== null && days >= 0 && days !== 3;
    })
    .reduce((total, batch) => total + batch.qty, 0);
}
function medicineExpiryDays(medicine){return medicine?clinicDateDaysUntil(medicine.exp):null;}
function medicineIsExpired(medicine){const remaining=medicineExpiryDays(medicine);return remaining!==null&&remaining<0;}
function medicineAlertData(today=todayDateString()){
  const threshold=Number(state.settings.lowStockThreshold??15);
  const active=MEDICINES.filter(medicine=>!medicine.deleted);
  const expiring=[],expired=[];
  active.forEach(medicine=>{
    const remaining=clinicDateDaysUntil(medicine.exp,today);
    if(remaining===null)return;
    if(remaining<0)expired.push({...medicine,daysRemaining:remaining});
    else if(remaining<=MEDICINE_EXPIRY_ALERT_DAYS)expiring.push({...medicine,daysRemaining:remaining});
  });
  const orderByExpiration=(a,b)=>a.daysRemaining-b.daysRemaining||a.name.localeCompare(b.name);
  return {
    lowStock:active.filter(medicine=>Number(medicine.qty)<=threshold),
    expiring:expiring.sort(orderByExpiration),
    expired:expired.sort(orderByExpiration),
  };
}
function medStatus(m){
  if(medicineIsExpired(m)) return {label:"Expired", chip:"chip-expired"};
  if(Number(m.qty)===0) return {label:"Out of Stock", chip:"chip-out"};
  const d=medicineExpiryDays(m);
  if(d!==null&&d<=MEDICINE_EXPIRY_ALERT_DAYS) return {label:"Expiring Soon", chip:"chip-expiring"};
  if(Number(m.qty)<=Number(state.settings.lowStockThreshold??15)) return {label:"Low Stock", chip:"chip-low"};
  return {label:"Available", chip:"chip-available"};
}
function renderInventory(){
  if(!["medicines","supplies"].includes(state.invTab))state.invTab="medicines";
  return `
  <div class="subtabs">
    <button class="subtab ${state.invTab==='medicines'?'active':''}" data-itab="medicines">Medicines</button>
    <button class="subtab ${state.invTab==='supplies'?'active':''}" data-itab="supplies">Medical Supplies</button>
  </div>
  <div id="inv-body"></div>`;
}
function renderMedicinesTab(){
  const perPage=8;
  const rawQ=document.getElementById('med-search')?.value||"";
  const q=rawQ.trim().toLowerCase();
  const statusF=document.getElementById('med-status')?.value||"";
  let list = MEDICINES.filter(m=>!m.deleted).filter(m=>{
    const st=medStatus(m).label;
    const batchSearchValues = medicineBatches(m).flatMap((batch) => [
      batch.productionDate,
      fmtDate(batch.productionDate),
    ]);
    const matchQ=!q || [
      m.name,
      m.category,
      m.qty,
      m.unit,
      m.exp,
      fmtDate(m.exp),
      ...batchSearchValues,
      st,
    ].some(value=>String(value??"").toLowerCase().includes(q));
    const matchStatus = !statusF || st===statusF;
    return matchQ && matchStatus;
  });
  const totalPages=Math.max(1,Math.ceil(list.length/perPage));
  if(state.medPage>totalPages) state.medPage=totalPages;
  const pageItems=list.slice((state.medPage-1)*perPage, state.medPage*perPage);
  const rows = pageItems.length===0? `<tr><td colspan="7">${emptyState("No medicines match your filters.")}</td></tr>` :
    pageItems.map(m=>{ const st=medStatus(m); const batches=medicineBatches(m).filter((batch)=>batch.status==="Available"); const earliest=batches.slice().sort((a,b)=>(a.exp||"9999").localeCompare(b.exp||"9999"))[0]; return `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.category)}</td>
      <td class="mono">${medicineAvailableQuantity(m)} ${m.unit}</td>
      <td>${earliest ? fmtDate(earliest.exp) : fmtDate(m.exp)}</td>
      <td><span class="chip ${st.chip}">${st.label}</span></td>
      <td><button type="button" class="btn btn-teal" data-view-med-batches="${escapeHtml(m.code)}" title="View batches" aria-label="View batches for ${escapeHtml(m.name)}">${ICONS.search}<span>View Batches</span></button></td>
      <td><div class="row-actions">
        ${canManageInventory()?`<button class="mini-btn" data-edit-med="${m.code}" title="Edit">${ICONS.edit}</button>`:""}
        ${canDeleteClinicRecords()?`<button class="mini-btn" data-archive-med="${m.code}" title="Move to Archive">${ICONS.archive}</button>`:""}
      </div></td>
    </tr>`;}).join("");
  const deletedCount = MEDICINES.filter(m=>m.deleted).length;
  return `
  <div class="card">
    <div class="toolbar">
      <div class="search-box"><span class="ic">${ICONS.search}</span><input type="text" id="med-search" placeholder="Search medicines by name, category, quantity, expiration, or status..." value="${escapeHtml(rawQ)}"></div>
      <select class="select-sm" id="med-status">
        <option value="" ${statusF===""?'selected':''}>All Status</option>
        ${["Available","Low Stock","Out of Stock","Expiring Soon","Expired"].map(o=>`<option ${statusF===o?'selected':''}>${o}</option>`).join("")}
      </select>
      ${canAddInventoryItem()?`<button class="btn btn-amber" id="add-med-btn">${ICONS.plus} Add Medicine</button>`:""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Medicine</th><th>Category</th><th>Total Quantity</th><th>Nearest Expiration</th><th>Status</th><th>Batches</th><th></th></tr></thead>
        <tbody id="med-tbody">${rows}</tbody>
      </table>
    </div>
    <div class="pagination">
      <span>Page ${state.medPage} of ${totalPages} · ${list.length} items ${deletedCount?`· ${deletedCount} in Archive`:''}</span>
      <div class="page-btns"><button type="button" data-mpage="prev" aria-label="Previous medicines page" title="Previous page">${ICONS.chevleft}<span>Previous</span></button><button type="button" data-mpage="next" aria-label="Next medicines page" title="Next page">${ICONS.chevright}<span>Next</span></button></div>
    </div>
  </div>`;
}
async function saveInventoryRecord({itemType,records,record,existing,refresh}){
  if(!(canManageInventory()||(["medicine","equipment"].includes(itemType)&&!existing&&canAddInventoryItem()))){
    toast("Permission denied","You do not have permission to make this inventory change.","err");
    return false;
  }
  const previousRecords=records.slice();
  const inventorySnapshot=captureInventoryState();
  const previousQuantity=existing?Number(existing.qty)||0:0;
  const noun=itemType==="medicine"?"Medicine":"Medical Supply";
  const mergedQuantity = existing && record.qty !== previousQuantity;
  const inventoryAction = mergedQuantity
    ? `${noun} Duplicate Merged — ${record.name} (${previousQuantity} → ${record.qty})`
    : existing
      ? `${noun} Updated — ${record.name} (${previousQuantity} → ${record.qty})`
      : `${noun} Added — ${record.name}`;
  const priorSupplyBatches =
    itemType === "equipment" && existing
      ? supplyBatchSnapshot(existing)
      : [];
  const priorSupplyBatchesById = new Map(
    priorSupplyBatches.map((batch) => [batch.id, batch]),
  );
  const changedSupplyBatchDetails =
    itemType === "equipment"
      ? record.batches
          .filter((batch) => {
            const prior = priorSupplyBatchesById.get(batch.id);
            return (
              !prior ||
              ["qty", "productionDate", "exp", "batchNumber", "status"].some(
                (field) => prior[field] !== batch[field],
              )
            );
          })
          .map((batch) => {
            const prior = priorSupplyBatchesById.get(batch.id);
            const details = `Batch ${batch.batchNumber || batch.id}: ${Number(batch.qty) || 0}, production ${batch.productionDate || "not set"}, expiration ${batch.exp || "not set"}, status ${batch.status || "Available"}`;
            return prior
              ? `${details} (previously ${Number(prior.qty) || 0}, production ${prior.productionDate || "not set"}, expiration ${prior.exp || "not set"})`
              : details;
          })
      : [];
  const auditDetail = [
    itemType === "medicine" ? record.code : record.id,
    ...changedSupplyBatchDetails,
  ].join("; ");
  const saved=await commitClinicRecordMutation({
    apply:()=>{
      ensureInventoryLedger();
      if(existing){
        const index=records.findIndex(item=>item[itemType==="medicine"?"code":"id"]===existing[itemType==="medicine"?"code":"id"]);
        if(index<0)throw new Error(`This ${noun.toLowerCase()} record is no longer available.`);
        records[index]=record;
        recordInventoryQuantityChange(itemType,record,previousQuantity,record.qty);
      }else{
        records.unshift(record);
        if(record.qty)recordInventoryTransaction(itemType,record,"added",record.qty);
        else recordInventoryTransaction(itemType,record,"baseline",0);
      }
    },
    rollback:()=>{
      restoreInventoryState(inventorySnapshot);
      if(itemType==="medicine")MEDICINES=previousRecords;
      else EQUIPMENT=previousRecords;
    },
    save:()=>saveInventoryRecordToClinicState(itemType,itemType==="medicine"?record.code:record.id,existing?previousQuantity:null),
    auditAction:inventoryAction,
    detail:auditDetail,auditBackground:true,
    module:itemType==="medicine"?"Medicines":"Medical Supplies",successTitle:existing?`${noun} updated`:`${noun} added`,
    successMessage:existing?`${record.name} has been updated.`:`${record.name} added to inventory.`,refresh:()=>{if(state.page==="inventory")refresh();else render();},
  });
  if (saved) {
    const refreshed = await hydrateFromSharedStorage();
    if (refreshed) {
      if (state.page === "inventory") refresh();
      else render();
    }
    else toast("Inventory saved; refresh failed", "The inventory change was saved, but the latest shared inventory could not be reloaded.", "warn");
  }
  return saved;
}
function openMedicineForm(existing=null){
  if(existing?!canManageInventory():!canAddInventoryItem())return;
  const isEdit=!!existing;
  const f = existing || {code:uid("MED"), name:"", category:"", qty:0, unit:"tablet", exp:""};
  const editableBatches = isEdit
    ? medicineBatchSnapshot(existing).filter((batch) => !["Voided", "Expired"].includes(batch.status || "Available"))
    : [];
  const selectedBatch = editableBatches[0] || null;
  const batchOptions = editableBatches.map((batch, index) =>
    `<option value="${escapeHtml(batch.id)}">${escapeHtml(batch.batchNumber || `Batch ${index + 1}`)} · ${Number(batch.qty) || 0} ${escapeHtml(existing.unit || "unit")} · expires ${batch.exp ? escapeHtml(fmtDate(batch.exp)) : "not set"}</option>`
  ).join("");
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} Medicine</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="med-form">
      <div class="f-field full"><label>Medicine Name <span class="req">*</span></label><input type="text" id="mf-name" value="${escapeHtml(f.name)}" required></div>
      <div class="f-field"><label>Category</label><input type="text" id="mf-category" value="${escapeHtml(f.category)}" placeholder="e.g. Analgesic"></div>
      <div class="f-field"><label>Unit</label><select id="mf-unit">${["tablet","bottle","tube","piece","roll","sachet","box"].map(u=>`<option ${f.unit===u?'selected':''}>${u}</option>`).join("")}</select></div>
      <div class="f-field full"><h4>Batch Details</h4></div>
      ${isEdit && editableBatches.length > 1 ? `<div class="f-field full"><label for="mf-batch">Batch to Update</label><select id="mf-batch">${batchOptions}</select></div>` : ""}
      ${isEdit && editableBatches.length === 1 ? `<input type="hidden" id="mf-batch" value="${escapeHtml(selectedBatch.id)}">` : ""}
      ${selectedBatch || !isEdit ? `<div class="f-field"><label>${isEdit ? "Batch Quantity" : "Incoming Quantity"}</label><input type="number" min="0" id="mf-qty" value="${isEdit ? Number(selectedBatch.qty) || 0 : f.qty}"></div>
      <div class="f-field"><label>Production Date</label><input type="date" id="mf-production" value="${escapeHtml(isEdit ? selectedBatch.productionDate || "" : "")}"></div>
      <div class="f-field"><label>Expiration Date</label><input type="date" id="mf-exp" value="${escapeHtml(isEdit ? selectedBatch.exp || "" : f.exp || "")}"></div>`
      : `<div class="f-field full"><p>No editable batches are available. To record a delivery, add the same medicine again and enter the new batch details.</p></div>`}
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="mf-save">${ICONS.check} Save Medicine</button></div>`;
  openModal(html);
  const batchSelect = document.getElementById("mf-batch");
  batchSelect?.addEventListener("change", () => {
    const batch = editableBatches.find((item) => item.id === batchSelect.value);
    if (!batch) return;
    document.getElementById("mf-qty").value = String(Number(batch.qty) || 0);
    document.getElementById("mf-production").value = batch.productionDate || "";
    document.getElementById("mf-exp").value = batch.exp || "";
  });
  let saving=false;
  document.getElementById('mf-save').onclick=async()=>{
    if(saving)return;
    const name=document.getElementById('mf-name').value.trim();
    if(!name){ toast('Missing information','Medicine name is required.','err'); return; }
    const rec={
      code: existing?.code || f.code, name,
      category: document.getElementById('mf-category').value || "General",
      qty: isEdit ? Number(existing.qty) || 0 : parseInt(document.getElementById('mf-qty').value, 10)||0,
      unit: document.getElementById('mf-unit').value,
      exp: existing?.exp || "",
      deleted:false,
    };
    if (isEdit) {
      rec.batches = medicineBatchSnapshot(existing);
      const selectedBatchId = batchSelect?.value;
      const selectedIndex = rec.batches.findIndex((batch) => batch.id === selectedBatchId);
      if (selectedIndex >= 0) {
        rec.batches[selectedIndex] = {
          ...rec.batches[selectedIndex],
          qty: parseInt(document.getElementById("mf-qty").value, 10) || 0,
          productionDate: document.getElementById("mf-production").value || null,
          exp: document.getElementById("mf-exp").value || null,
        };
      }
      rec.qty = rec.batches
        .filter((batch) => (batch.status || "Available") === "Available")
        .reduce((total, batch) => total + (Number(batch.qty ?? batch.quantity) || 0), 0);
      const activeExpirations = rec.batches
        .filter((batch) => (batch.status || "Available") === "Available" && batch.exp)
        .map((batch) => batch.exp)
        .sort();
      rec.exp = activeExpirations[0] || existing.exp || "";
    } else {
      const incomingBatch = {
        id: `${rec.code}-B1`,
        qty: rec.qty,
        productionDate: document.getElementById("mf-production").value || null,
        exp: document.getElementById("mf-exp").value || null,
        status: "Available",
      };
      rec.exp = incomingBatch.exp || "";
      rec.batches = [incomingBatch];
    }
    if (!isEdit) {
      const duplicate = MEDICINES.find((item) =>
        !item.deleted &&
        sameMedicineIdentity(item, rec)
      );
      if (duplicate) {
        const existingBatches = medicineBatchSnapshot(duplicate);
        const incomingExpiration = rec.exp || null;
        const matchingBatch = existingBatches.find((batch) =>
          (batch.status || "Available") === "Available" &&
          (batch.exp || batch.expirationDate || "") === (incomingExpiration || "") &&
          (batch.productionDate || batch.production_date || "") ===
            (rec.batches[0].productionDate || "")
        );
        if (matchingBatch) {
          matchingBatch.qty = (Number(matchingBatch.qty ?? matchingBatch.quantity) || 0) + rec.qty;
          matchingBatch.quantity = matchingBatch.qty;
        } else {
          existingBatches.push({
            ...rec.batches[0],
            id: `${duplicate.code}-B${existingBatches.length + 1}`,
          });
        }
        rec.code = duplicate.code;
        rec.qty = existingBatches
          .filter((batch) => (batch.status || "Available") === "Available")
          .reduce((total, batch) => total + (Number(batch.qty ?? batch.quantity) || 0), 0);
        rec.exp = duplicate.exp || rec.exp;
        rec.batches = existingBatches;
        existing = duplicate;
      }
    }
    const saveButton=document.getElementById('mf-save'),saveLabel=saveButton.innerHTML;saveButton.disabled=true;saveButton.innerHTML='<span class="button-spinner"></span> Saving...';
    saving=true;
    try{const saved=await saveInventoryRecord({itemType:"medicine",records:MEDICINES,record:rec,existing,refresh:renderInventoryTabBody});if(saved)closeModal();}
    finally{saving=false;if(document.body.contains(saveButton)){saveButton.disabled=false;saveButton.innerHTML=saveLabel;}}
  };
}
function bindMedicinesTab(){
  const rerender=()=>{
    const active=document.activeElement;
    const activeId = active && active.id;
    const selStart = active && typeof active.selectionStart==='number' ? active.selectionStart : null;
    document.getElementById('inv-body').innerHTML=renderMedicinesTab();
    bindMedicinesTab();
    if(activeId){
      const el=document.getElementById(activeId);
      if(el){ el.focus(); if(selStart!==null && el.setSelectionRange) el.setSelectionRange(selStart, selStart); }
    }
  };
  const s=document.getElementById('med-search');
  let searchTimer;
  if(s) s.oninput=()=>{
    window.clearTimeout(searchTimer);
    searchTimer=window.setTimeout(rerender,120);
  };
  const st=document.getElementById('med-status'); if(st) st.onchange=rerender;
  document.getElementById('add-med-btn')?.addEventListener('click',()=>openMedicineForm());
  document.querySelectorAll('[data-view-med-batches]').forEach((button) => {
    button.onclick = () => {
      const medicine = MEDICINES.find((item) => item.code === button.dataset.viewMedBatches);
      if (!medicine) return;
      const batches = medicineBatches(medicine);
      const statusDetails = {
        Available: ["Available", "chip-available"],
        Expired: ["Expired", "chip-expired"],
        Voided: ["Voided / Expiring – 3 Days Remaining", "chip-void"],
      };
      const rows = batches.map((batch, index) => {
        const [statusLabel, statusClass] = statusDetails[batch.status] || [batch.status, "chip-available"];
        const quantity = batch.status === "Voided"
          ? Number(batch.voidedQuantity ?? batch.qty) || 0
          : Number(batch.qty) || 0;
        return `<tr><td>${escapeHtml(batch.batchNumber || `Batch ${index + 1}`)}</td><td class="mono">${quantity} ${escapeHtml(medicine.unit || "unit")}</td><td>${batch.productionDate ? escapeHtml(fmtDate(batch.productionDate)) : "—"}</td><td>${batch.exp ? escapeHtml(fmtDate(batch.exp)) : "—"}</td><td><span class="chip ${statusClass}">${escapeHtml(statusLabel)}</span></td></tr>`;
      }).join("");
      openModal(`<div class="modal-head"><h3>${escapeHtml(medicine.name)} — Inventory Batches</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div><div class="modal-body"><p><b>Total available quantity:</b> ${medicineAvailableQuantity(medicine)} ${escapeHtml(medicine.unit || "unit")}</p><div class="table-wrap"><table><thead><tr><th>Batch</th><th>Quantity</th><th>Production Date</th><th>Expiration Date</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${emptyState("No batch records.")}</td></tr>`}</tbody></table></div></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button></div>`, "record-detail-modal");
    };
  });
  document.querySelectorAll('[data-mpage]').forEach(b=> b.onclick=()=>{ state.medPage += b.dataset.mpage==='next'?1:-1; if(state.medPage<1) state.medPage=1; rerender(); });
  document.querySelectorAll('[data-edit-med]').forEach(b=> b.onclick=()=>openMedicineForm(MEDICINES.find(m=>m.code===b.dataset.editMed)));
  document.querySelectorAll('[data-archive-med]').forEach(b=>{
    b.onclick=()=>{
      if(!canDeleteClinicRecords())return;
      const rec=MEDICINES.find(m=>m.code===b.dataset.archiveMed);
      if(!rec)return;
      confirmDialog({title:"Move this medicine to the Archive?", msg:`<b>${escapeHtml(rec.name)}</b> will be moved to the Archive and can be restored later.`, okLabel:"Move to Archive", onConfirm:async()=>{
        const previous={deleted:rec.deleted,deletedAt:rec.deletedAt},deletedAt=new Date().toISOString();
        await commitClinicRecordMutation({apply:()=>{rec.deleted=true;rec.deletedAt=deletedAt;},rollback:()=>Object.assign(rec,previous),save:()=>saveInventoryItemStatusToClinicState("medicine",rec.code,true),auditAction:`Record Archived — Medicine ${rec.name}`,module:"Medicines",status:"Warning",successTitle:"Medicine archived",successMessage:`${rec.name} moved to the Archive.`,detail:rec.code,refresh:rerender});
      }});
    };
  });
}
function renderEquipmentTab(){
  const perPage=8;
  const rawQ=document.getElementById('eq-search')?.value||"";
  const q=rawQ.trim().toLowerCase();
  const statusF=document.getElementById('eq-status')?.value||"";
  let list = EQUIPMENT.filter(e=>!e.deleted&&e.category==="Medical Supplies").filter(e=>{
    const batchSearchValues = supplyBatchSnapshot(e).flatMap((batch) => [
      batch.batchNumber,
      batch.productionDate,
      fmtDate(batch.productionDate),
      batch.exp,
      fmtDate(batch.exp),
    ]);
    const matchQ=!q || [
      e.name,
      supplyAvailableQuantity(e),
      e.lastMaint,
      fmtDate(e.lastMaint),
      e.status,
      ...batchSearchValues,
    ].some(value=>String(value??"").toLowerCase().includes(q));
    const matchStatus = !statusF || e.status===statusF;
    return matchQ && matchStatus;
  });
  const totalPages=Math.max(1,Math.ceil(list.length/perPage));
  if(state.eqPage>totalPages) state.eqPage=totalPages;
  const pageItems=list.slice((state.eqPage-1)*perPage, state.eqPage*perPage);
  const chipMap={"Available":"chip-available","Under Maintenance":"chip-maint","Damaged":"chip-damaged","Replacement Needed":"chip-out"};
  const rows = pageItems.length===0? `<tr><td colspan="6">${emptyState("No supplies match your filters.")}</td></tr>` :
    pageItems.map(e=>`
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td class="mono">${supplyAvailableQuantity(e)}</td>
      <td>${fmtDate(e.lastMaint)}</td>
      <td><span class="chip ${chipMap[e.status]}">${e.status}</span></td>
      <td><button type="button" class="btn btn-teal" data-view-supply-batches="${escapeHtml(e.id)}" title="View batches" aria-label="View batches for ${escapeHtml(e.name)}">${ICONS.search}<span>View Batches</span></button></td>
      <td><div class="row-actions">
        ${canManageInventory()?`<button class="mini-btn" data-edit-eq="${e.id}" title="Edit">${ICONS.edit}</button>`:""}
        ${canDeleteClinicRecords()?`<button class="mini-btn" data-archive-eq="${e.id}" title="Move to Archive">${ICONS.archive}</button>`:""}
      </div></td>
    </tr>`).join("");
  return `
  <div class="card">
    <div class="toolbar">
      <div class="search-box"><span class="ic">${ICONS.search}</span><input type="text" id="eq-search" placeholder="Search supplies by name, quantity, maintenance date, or status..." value="${escapeHtml(rawQ)}"></div>
      <select class="select-sm" id="eq-status">
        <option value="" ${statusF===""?'selected':''}>All Status</option>
        ${["Available","Under Maintenance","Damaged","Replacement Needed"].map(o=>`<option ${statusF===o?'selected':''}>${o}</option>`).join("")}
      </select>
      ${canAddInventoryItem()?`<button class="btn btn-amber" id="add-eq-btn">${ICONS.plus} Add Supply</button>`:""}
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Supply</th><th>Qty</th><th>Last Maintenance</th><th>Status</th><th>Batches</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
    <div class="pagination"><span>Page ${state.eqPage} of ${totalPages} · ${list.length} items</span>
      <div class="page-btns"><button type="button" data-eqpage="prev" aria-label="Previous medical supplies page" title="Previous page">${ICONS.chevleft}<span>Previous</span></button><button type="button" data-eqpage="next" aria-label="Next medical supplies page" title="Next page">${ICONS.chevright}<span>Next</span></button></div>
    </div>
  </div>`;
}
function openEquipmentForm(existing=null){
  if(existing?!canManageInventory():!canAddInventoryItem())return;
  const isEdit=!!existing;
  const f=existing||{id:uid("EQP"), name:"", category:"Medical Supplies", qty:1, condition:"Good", lastMaint:"", status:"Available"};
  const itemLabel="Supply";
  const editableBatches = isEdit
    ? supplyBatchSnapshot(existing).filter((batch) => !["Voided", "Expired"].includes(batch.status))
    : [];
  const selectedBatch = editableBatches[0] || null;
  const batchOptions = editableBatches.map((batch, index) =>
    `<option value="${escapeHtml(batch.id)}">${escapeHtml(batch.batchNumber || `Batch ${index + 1}`)} · ${batch.qty} ${escapeHtml(existing.unit || "unit")} · expires ${batch.exp ? escapeHtml(fmtDate(batch.exp)) : "not set"}</option>`
  ).join("");
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} ${itemLabel}</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="eq-form">
      <div class="f-field full"><label>${itemLabel} Name <span class="req">*</span></label><input type="text" id="ef-name" value="${escapeHtml(f.name)}" required></div>
      <div class="f-field full"><h4>Batch Details</h4></div>
      ${isEdit && editableBatches.length > 1 ? `<div class="f-field full"><label for="ef-batch-select">Batch to Update</label><select id="ef-batch-select">${batchOptions}</select></div>` : ""}
      ${isEdit && editableBatches.length === 1 ? `<input type="hidden" id="ef-batch-select" value="${escapeHtml(selectedBatch.id)}">` : ""}
      ${selectedBatch || !isEdit ? `<div class="f-field"><label>${isEdit ? "Batch Quantity" : "Incoming Quantity"}</label><input type="number" min="0" id="ef-qty" value="${isEdit ? selectedBatch.qty : f.qty}"></div>
      <div class="f-field"><label>Production Date (optional)</label><input type="date" id="ef-production" value="${escapeHtml(isEdit ? selectedBatch.productionDate : "")}"></div>
      ${!isEdit ? `<div class="f-field full"><p>Batch identifier is assigned automatically when saved.</p></div>` : ""}`
      : `<div class="f-field full"><p>No editable batches are available. To record a delivery, add the same supply again and enter the new batch details.</p></div>`}
      <div class="f-field"><label>Last Maintenance</label><input type="date" id="ef-maint" value="${f.lastMaint||""}"></div>
      <div class="f-field"><label>Status</label><select id="ef-status">${["Available","Under Maintenance","Damaged","Replacement Needed"].map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join("")}</select></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="ef-save">${ICONS.check} Save ${itemLabel}</button></div>`;
  openModal(html);
  const batchSelect = document.getElementById("ef-batch-select");
  batchSelect?.addEventListener("change", () => {
    const batch = editableBatches.find((item) => item.id === batchSelect.value);
    if (!batch) return;
    document.getElementById("ef-qty").value = String(batch.qty);
    document.getElementById("ef-production").value = batch.productionDate;
  });
  let saving=false;
  document.getElementById('ef-save').onclick=async()=>{
    if(saving)return;
    const name=document.getElementById('ef-name').value.trim();
    if(!name){ toast('Missing information',`${itemLabel} name is required.`,'err'); return; }
    const incomingQuantity=Math.max(0,parseInt(document.getElementById('ef-qty')?.value || "0",10)||0);
    const rec={ id:existing?.id || f.id, name, category:"Medical Supplies", qty:incomingQuantity,
      condition:existing?.condition||"Good", lastMaint:document.getElementById('ef-maint').value,
      status:document.getElementById('ef-status').value, deleted:false,
      batches:existing?supplyBatchSnapshot(existing):[] };
    if (isEdit) {
      const selectedIndex = rec.batches.findIndex((batch) => batch.id === batchSelect?.value);
      if (selectedIndex >= 0) {
        rec.batches[selectedIndex] = {
          ...rec.batches[selectedIndex],
          qty: incomingQuantity,
          productionDate: document.getElementById("ef-production").value || null,
        };
      }
      rec.qty = rec.batches
        .filter((batch) => batch.status === "Available")
        .reduce((total, batch) => total + batch.qty, 0);
    } else {
      const batchIdentifier = nextSupplyBatchIdentifier(f.id);
      const incomingBatch={
        id:batchIdentifier,
        batchNumber:batchIdentifier,
        qty:incomingQuantity,
        productionDate:document.getElementById('ef-production').value || null,
        exp:null,
        status:"Available",
      };
      rec.batches = [incomingBatch];
    }
    if (!isEdit) {
      const duplicate = EQUIPMENT.find((item) =>
        !item.deleted &&
        item.category === "Medical Supplies" &&
        inventoryIdentityPart(item.name) === inventoryIdentityPart(name)
      );
      if (duplicate) {
        rec.id = duplicate.id;
        rec.condition = duplicate.condition || "Good";
        rec.status = duplicate.status || rec.status;
        rec.lastMaint = rec.lastMaint || duplicate.lastMaint || "";
        const existingBatches = supplyBatchSnapshot(duplicate);
        const batchIdentifier = nextSupplyBatchIdentifier(
          duplicate.id,
          existingBatches,
        );
        rec.batches = [
          ...existingBatches,
          {
            ...rec.batches[0],
            id: batchIdentifier,
            batchNumber: batchIdentifier,
          },
        ];
        rec.qty = rec.batches
          .filter((batch) => batch.status === "Available")
          .reduce((total, batch) => total + batch.qty, 0);
        existing = duplicate;
      }
    }
    const saveButton=document.getElementById('ef-save'),saveLabel=saveButton.innerHTML;saveButton.disabled=true;saveButton.innerHTML='<span class="button-spinner"></span> Saving...';
    saving=true;
    try{const saved=await saveInventoryRecord({itemType:"equipment",records:EQUIPMENT,record:rec,existing,refresh:renderInventoryTabBody});if(saved)closeModal();}
    finally{saving=false;if(document.body.contains(saveButton)){saveButton.disabled=false;saveButton.innerHTML=saveLabel;}}
  };
}
function bindEquipmentTab(){
  const rerender=()=>{
    const active=document.activeElement;
    const activeId = active && active.id;
    const selStart = active && typeof active.selectionStart==='number' ? active.selectionStart : null;
    document.getElementById('inv-body').innerHTML=renderEquipmentTab();
    bindEquipmentTab();
    if(activeId){
      const el=document.getElementById(activeId);
      if(el){ el.focus(); if(selStart!==null && el.setSelectionRange) el.setSelectionRange(selStart, selStart); }
    }
  };
  const s=document.getElementById('eq-search');
  let searchTimer;
  if(s) s.oninput=()=>{
    window.clearTimeout(searchTimer);
    searchTimer=window.setTimeout(rerender,120);
  };
  const st=document.getElementById('eq-status'); if(st) st.onchange=rerender;
  document.getElementById('add-eq-btn')?.addEventListener('click',()=>openEquipmentForm());
  document.querySelectorAll('[data-eqpage]').forEach(b=> b.onclick=()=>{ state.eqPage += b.dataset.eqpage==='next'?1:-1; if(state.eqPage<1) state.eqPage=1; rerender(); });
  document.querySelectorAll('[data-edit-eq]').forEach(b=> b.onclick=()=>openEquipmentForm(EQUIPMENT.find(e=>e.id===b.dataset.editEq)));
  document.querySelectorAll('[data-view-supply-batches]').forEach((button) => {
    button.onclick = () => {
      const supply = EQUIPMENT.find((item) => item.id === button.dataset.viewSupplyBatches);
      if (!supply) return;
      const batches = supplyBatchSnapshot(supply);
      const statusDetails = {
        Available: ["Available", "chip-available"],
        Expired: ["Expired", "chip-expired"],
        Voided: ["Voided", "chip-void"],
      };
      const rows = batches.map((batch, index) => {
        const [statusLabel, statusClass] = statusDetails[batch.status] || [batch.status, "chip-available"];
        const quantity = batch.status === "Voided"
          ? Number(batch.voidedQuantity ?? batch.qty) || 0
          : batch.qty;
        return `<tr><td>${escapeHtml(batch.batchNumber || `Batch ${index + 1}`)}</td><td class="mono">${quantity}</td><td>${batch.productionDate ? escapeHtml(fmtDate(batch.productionDate)) : "—"}</td><td>${batch.exp ? escapeHtml(fmtDate(batch.exp)) : "—"}</td><td><span class="chip ${statusClass}">${escapeHtml(statusLabel)}</span></td></tr>`;
      }).join("");
      openModal(`<div class="modal-head"><h3>${escapeHtml(supply.name)} — Inventory Batches</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div><div class="modal-body"><p><b>Total available quantity:</b> ${supplyAvailableQuantity(supply)}</p><div class="table-wrap"><table><thead><tr><th>Batch</th><th>Quantity</th><th>Production Date</th><th>Expiration Date</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="5">${emptyState("No batch records.")}</td></tr>`}</tbody></table></div></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button></div>`, "record-detail-modal");
    };
  });
  document.querySelectorAll('[data-archive-eq]').forEach(b=>{
    b.onclick=()=>{
      if(!canDeleteClinicRecords())return;
      const rec=EQUIPMENT.find(e=>e.id===b.dataset.archiveEq);
      if(!rec)return;
      confirmDialog({title:"Move this supply to the Archive?", msg:`<b>${escapeHtml(rec.name)}</b> will be moved to the Archive and can be restored later.`, okLabel:"Move to Archive", onConfirm:async()=>{
        const previous={deleted:rec.deleted,deletedAt:rec.deletedAt},deletedAt=new Date().toISOString();
        await commitClinicRecordMutation({apply:()=>{rec.deleted=true;rec.deletedAt=deletedAt;},rollback:()=>Object.assign(rec,previous),save:()=>saveInventoryItemStatusToClinicState("equipment",rec.id,true),auditAction:`Record Archived — Medical Supply ${rec.name}`,module:"Medical Supplies",status:"Warning",successTitle:"Medical supply archived",successMessage:`${rec.name} moved to the Archive.`,detail:rec.id,refresh:rerender});
      }});
    };
  });
}
function renderInventoryTabBody(){
  const body=document.getElementById('inv-body');
  if(state.invTab==='medicines'){ body.innerHTML=renderMedicinesTab(); bindMedicinesTab(); }
  else { state.invTab="supplies";body.innerHTML=renderEquipmentTab(); bindEquipmentTab(); }
}
