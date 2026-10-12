/* ================= INVENTORY ================= */
function medStatus(m){
  if(m.qty===0) return {label:"Out of Stock", chip:"chip-out"};
  const d=daysUntil(m.exp);
  if(d<0) return {label:"Expired", chip:"chip-expired"};
  if(d<=(state.settings.expirationAlertDays||14)) return {label:"Expiring Soon", chip:"chip-expiring"};
  if(m.qty<=(state.settings.lowStockThreshold||15)) return {label:"Low Stock", chip:"chip-low"};
  return {label:"Available", chip:"chip-available"};
}
function renderInventory(){
  return `
  <div class="subtabs">
    <button class="subtab ${state.invTab==='medicines'?'active':''}" data-itab="medicines">Medicines</button>
    <button class="subtab ${state.invTab==='equipment'?'active':''}" data-itab="equipment">Equipment & Medical Tools</button>
  </div>
  <div id="inv-body"></div>`;
}
function renderMedicinesTab(){
  const perPage=8;
  const rawQ=document.getElementById('med-search')?.value||"";
  const q=rawQ.toLowerCase();
  const statusF=document.getElementById('med-status')?.value||"";
  let list = MEDICINES.filter(m=>!m.deleted).filter(m=>{
    const matchQ=!q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    const st=medStatus(m).label;
    const matchStatus = !statusF || st===statusF;
    return matchQ && matchStatus;
  });
  const totalPages=Math.max(1,Math.ceil(list.length/perPage));
  if(state.medPage>totalPages) state.medPage=totalPages;
  const pageItems=list.slice((state.medPage-1)*perPage, state.medPage*perPage);
  const rows = pageItems.length===0? `<tr><td colspan="9">${emptyState("No medicines match your filters.")}</td></tr>` :
    pageItems.map(m=>{ const st=medStatus(m); return `
    <tr>
      <td class="mono">${m.code}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.category)}</td>
      <td class="mono">${m.qty} ${m.unit}</td>
      <td class="mono">${m.batch}</td>
      <td>${fmtDate(m.exp)}</td>
      <td>${escapeHtml(m.supplier)}</td>
      <td><span class="chip ${st.chip}">${st.label}</span></td>
      <td><div class="row-actions">
        <button class="mini-btn" data-edit-med="${m.code}" title="Edit">${ICONS.edit}</button>
        <button class="mini-btn danger" data-del-med="${m.code}" title="Delete">${ICONS.trash_sm}</button>
      </div></td>
    </tr>`;}).join("");
  const deletedCount = MEDICINES.filter(m=>m.deleted).length;
  return `
  <div class="card">
    <div class="toolbar">
      <div class="search-box"><span class="ic">${ICONS.search}</span><input type="text" id="med-search" placeholder="Search medicines by name, code, or category..." value="${escapeHtml(rawQ)}"></div>
      <select class="select-sm" id="med-status">
        <option value="" ${statusF===""?'selected':''}>All Status</option>
        ${["Available","Low Stock","Out of Stock","Expiring Soon","Expired"].map(o=>`<option ${statusF===o?'selected':''}>${o}</option>`).join("")}
      </select>
      <button class="btn btn-amber" id="add-med-btn">${ICONS.plus} Add Medicine</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Quantity</th><th>Batch</th><th>Expiration</th><th>Supplier</th><th>Status</th><th></th></tr></thead>
        <tbody id="med-tbody">${rows}</tbody>
      </table>
    </div>
    <div class="pagination">
      <span>Page ${state.medPage} of ${totalPages} · ${list.length} items ${deletedCount?`· ${deletedCount} in Deleted Records`:''}</span>
      <div class="page-btns"><button data-mpage="prev">${ICONS.chevleft}</button><button data-mpage="next">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
async function saveInventoryRecord({itemType,records,record,existing,refresh}){
  const previousRecords=records.slice();
  const inventorySnapshot=captureInventoryState();
  const previousQuantity=existing?Number(existing.qty)||0:0;
  const noun=itemType==="medicine"?"Medicine":"Equipment";
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
    auditAction:existing?`Inventory Updated — ${record.name} (${previousQuantity} → ${record.qty})`:`Inventory Item Added — ${record.name}`,
    detail:itemType==="medicine"?record.code:record.id,
    module:itemType==="medicine"?"Medicines":"Equipment",successTitle:existing?`${noun} updated`:`${noun} added`,
    successMessage:existing?`${record.name} has been updated.`:`${record.name} added to inventory.`,refresh,
  });
  return saved;
}
function openMedicineForm(existing=null){
  const isEdit=!!existing;
  const f = existing || {code:uid("MED"), name:"", category:"", qty:0, unit:"tablet", batch:"", exp:"2027-01-01", supplier:""};
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} Medicine</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="med-form">
      <div class="f-field"><label>Item Code</label><input type="text" id="mf-code" value="${f.code}" ${isEdit?'readonly style="background:#F7FAFD;"':''}></div>
      <div class="f-field full"><label>Medicine Name <span class="req">*</span></label><input type="text" id="mf-name" value="${escapeHtml(f.name)}" required></div>
      <div class="f-field"><label>Category</label><input type="text" id="mf-category" value="${escapeHtml(f.category)}" placeholder="e.g. Analgesic"></div>
      <div class="f-field"><label>Quantity</label><input type="number" min="0" id="mf-qty" value="${f.qty}"></div>
      <div class="f-field"><label>Unit</label><select id="mf-unit">${["tablet","bottle","tube","piece","roll","sachet","box"].map(u=>`<option ${f.unit===u?'selected':''}>${u}</option>`).join("")}</select></div>
      <div class="f-field"><label>Batch Number</label><input type="text" id="mf-batch" value="${f.batch}"></div>
      <div class="f-field"><label>Expiration Date</label><input type="date" id="mf-exp" value="${f.exp}"></div>
      <div class="f-field full"><label>Supplier</label><input type="text" id="mf-supplier" value="${escapeHtml(f.supplier)}"></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="mf-save">${ICONS.check} Save Medicine</button></div>`;
  openModal(html);
  document.getElementById('mf-save').onclick=async()=>{
    const name=document.getElementById('mf-name').value.trim();
    if(!name){ toast('Missing information','Medicine name is required.','err'); return; }
    const rec={
      code: document.getElementById('mf-code').value, name,
      category: document.getElementById('mf-category').value || "General",
      qty: parseInt(document.getElementById('mf-qty').value)||0,
      unit: document.getElementById('mf-unit').value,
      batch: document.getElementById('mf-batch').value || "N/A",
      exp: document.getElementById('mf-exp').value,
      supplier: document.getElementById('mf-supplier').value || "N/A",
      deleted:false,
    };
    const saveButton=document.getElementById('mf-save');saveButton.disabled=true;
    try{const saved=await saveInventoryRecord({itemType:"medicine",records:MEDICINES,record:rec,existing,refresh:renderInventoryTabBody});if(saved)closeModal();}
    finally{if(document.body.contains(saveButton))saveButton.disabled=false;}
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
  const s=document.getElementById('med-search'); if(s) s.oninput=rerender;
  const st=document.getElementById('med-status'); if(st) st.onchange=rerender;
  document.getElementById('add-med-btn').onclick=()=>openMedicineForm();
  document.querySelectorAll('[data-mpage]').forEach(b=> b.onclick=()=>{ state.medPage += b.dataset.mpage==='next'?1:-1; if(state.medPage<1) state.medPage=1; rerender(); });
  document.querySelectorAll('[data-edit-med]').forEach(b=> b.onclick=()=>openMedicineForm(MEDICINES.find(m=>m.code===b.dataset.editMed)));
  document.querySelectorAll('[data-del-med]').forEach(b=>{
    b.onclick=()=>{
      const rec=MEDICINES.find(m=>m.code===b.dataset.delMed);
      if(!rec)return;
      confirmDialog({title:"Delete this medicine?", msg:`<b>${escapeHtml(rec.name)}</b> will be moved to Deleted Records.`, okLabel:"Delete Item", onConfirm:async()=>{
        const previous={deleted:rec.deleted,deletedAt:rec.deletedAt},deletedAt=new Date().toISOString();
        await commitClinicRecordMutation({apply:()=>{rec.deleted=true;rec.deletedAt=deletedAt;},rollback:()=>Object.assign(rec,previous),auditAction:`Record Deleted — Medicine ${rec.name}`,module:"Medicines",status:"Warning",successTitle:"Medicine deleted",successMessage:`${rec.name} moved to Deleted Records.`,detail:rec.code,refresh:rerender});
      }});
    };
  });
}
function renderEquipmentTab(){
  const perPage=8;
  const rawQ=document.getElementById('eq-search')?.value||"";
  const q=rawQ.toLowerCase();
  const statusF=document.getElementById('eq-status')?.value||"";
  let list = EQUIPMENT.filter(e=>!e.deleted).filter(e=>{
    const matchQ=!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
    const matchStatus = !statusF || e.status===statusF;
    return matchQ && matchStatus;
  });
  const totalPages=Math.max(1,Math.ceil(list.length/perPage));
  if(state.eqPage>totalPages) state.eqPage=totalPages;
  const pageItems=list.slice((state.eqPage-1)*perPage, state.eqPage*perPage);
  const chipMap={"Available":"chip-available","Under Maintenance":"chip-maint","Damaged":"chip-damaged","Replacement Needed":"chip-out"};
  const rows = pageItems.length===0? `<tr><td colspan="7">${emptyState("No equipment matches your filters.")}</td></tr>` :
    pageItems.map(e=>`
    <tr>
      <td class="mono">${e.id}</td>
      <td>${escapeHtml(e.name)}</td>
      <td class="mono">${e.qty}</td>
      <td>${e.condition}</td>
      <td>${fmtDate(e.lastMaint)}</td>
      <td><span class="chip ${chipMap[e.status]}">${e.status}</span></td>
      <td><div class="row-actions">
        <button class="mini-btn" data-edit-eq="${e.id}" title="Edit">${ICONS.edit}</button>
        <button class="mini-btn danger" data-del-eq="${e.id}" title="Delete">${ICONS.trash_sm}</button>
      </div></td>
    </tr>`).join("");
  return `
  <div class="card">
    <div class="toolbar">
      <div class="search-box"><span class="ic">${ICONS.search}</span><input type="text" id="eq-search" placeholder="Search equipment by name or ID..." value="${escapeHtml(rawQ)}"></div>
      <select class="select-sm" id="eq-status">
        <option value="" ${statusF===""?'selected':''}>All Status</option>
        ${["Available","Under Maintenance","Damaged","Replacement Needed"].map(o=>`<option ${statusF===o?'selected':''}>${o}</option>`).join("")}
      </select>
      <button class="btn btn-amber" id="add-eq-btn">${ICONS.plus} Add Equipment</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>ID</th><th>Equipment</th><th>Qty</th><th>Condition</th><th>Last Maintenance</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
    <div class="pagination"><span>Page ${state.eqPage} of ${totalPages} · ${list.length} items</span>
      <div class="page-btns"><button data-eqpage="prev">${ICONS.chevleft}</button><button data-eqpage="next">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
function openEquipmentForm(existing=null){
  const isEdit=!!existing;
  const f=existing||{id:uid("EQP"), name:"", qty:1, condition:"Good", lastMaint:"2026-07-01", status:"Available"};
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} Equipment</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="eq-form">
      <div class="f-field"><label>Equipment ID</label><input type="text" id="ef-id" value="${f.id}" ${isEdit?'readonly style="background:#F7FAFD;"':''}></div>
      <div class="f-field full"><label>Equipment Name <span class="req">*</span></label><input type="text" id="ef-name" value="${escapeHtml(f.name)}" required></div>
      <div class="f-field"><label>Quantity</label><input type="number" min="0" id="ef-qty" value="${f.qty}"></div>
      <div class="f-field"><label>Condition</label><select id="ef-condition">${["Good","Fair","Poor"].map(c=>`<option ${f.condition===c?'selected':''}>${c}</option>`).join("")}</select></div>
      <div class="f-field"><label>Last Maintenance</label><input type="date" id="ef-maint" value="${f.lastMaint||""}"></div>
      <div class="f-field"><label>Status</label><select id="ef-status">${["Available","Under Maintenance","Damaged","Replacement Needed"].map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join("")}</select></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="ef-save">${ICONS.check} Save Equipment</button></div>`;
  openModal(html);
  document.getElementById('ef-save').onclick=async()=>{
    const name=document.getElementById('ef-name').value.trim();
    if(!name){ toast('Missing information','Equipment name is required.','err'); return; }
    const rec={ id:document.getElementById('ef-id').value, name, qty:parseInt(document.getElementById('ef-qty').value)||0,
      condition:document.getElementById('ef-condition').value, lastMaint:document.getElementById('ef-maint').value,
      status:document.getElementById('ef-status').value, deleted:false };
    const saveButton=document.getElementById('ef-save');saveButton.disabled=true;
    try{const saved=await saveInventoryRecord({itemType:"equipment",records:EQUIPMENT,record:rec,existing,refresh:renderInventoryTabBody});if(saved)closeModal();}
    finally{if(document.body.contains(saveButton))saveButton.disabled=false;}
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
  const s=document.getElementById('eq-search'); if(s) s.oninput=rerender;
  const st=document.getElementById('eq-status'); if(st) st.onchange=rerender;
  document.getElementById('add-eq-btn').onclick=()=>openEquipmentForm();
  document.querySelectorAll('[data-eqpage]').forEach(b=> b.onclick=()=>{ state.eqPage += b.dataset.eqpage==='next'?1:-1; if(state.eqPage<1) state.eqPage=1; rerender(); });
  document.querySelectorAll('[data-edit-eq]').forEach(b=> b.onclick=()=>openEquipmentForm(EQUIPMENT.find(e=>e.id===b.dataset.editEq)));
  document.querySelectorAll('[data-del-eq]').forEach(b=>{
    b.onclick=()=>{
      const rec=EQUIPMENT.find(e=>e.id===b.dataset.delEq);
      if(!rec)return;
      confirmDialog({title:"Delete this equipment record?", msg:`<b>${escapeHtml(rec.name)}</b> will be moved to Deleted Records.`, okLabel:"Delete Item", onConfirm:async()=>{
        const previous={deleted:rec.deleted,deletedAt:rec.deletedAt},deletedAt=new Date().toISOString();
        await commitClinicRecordMutation({apply:()=>{rec.deleted=true;rec.deletedAt=deletedAt;},rollback:()=>Object.assign(rec,previous),auditAction:`Record Deleted — Equipment ${rec.name}`,module:"Equipment",status:"Warning",successTitle:"Equipment deleted",successMessage:`${rec.name} moved to Deleted Records.`,detail:rec.id,refresh:rerender});
      }});
    };
  });
}
function renderInventoryTabBody(){
  const body=document.getElementById('inv-body');
  if(state.invTab==='medicines'){ body.innerHTML=renderMedicinesTab(); bindMedicinesTab(); }
  else { body.innerHTML=renderEquipmentTab(); bindEquipmentTab(); }
}
