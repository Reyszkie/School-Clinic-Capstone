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
  document.getElementById('mf-save').onclick=()=>{
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
    if(isEdit){ const idx=MEDICINES.findIndex(m=>m.code===existing.code); MEDICINES[idx]=rec; logAudit(`Inventory Updated — ${rec.name}`,"Inventory"); toast('Medicine updated', `${rec.name} has been updated.`,'ok'); }
    else { MEDICINES.unshift(rec); logAudit(`Inventory Item Added — ${rec.name}`,"Inventory"); toast('Medicine added', `${rec.name} added to inventory.`,'ok'); }
    closeModal(); renderInventoryTabBody();
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
      confirmDialog({title:"Delete this medicine?", msg:`<b>${escapeHtml(rec.name)}</b> will be moved to Deleted Records.`, okLabel:"Delete Item", onConfirm:()=>{
        rec.deleted=true;
        logAudit(`Record Deleted — ${rec.name}`,"Inventory","Warning");
        toast('Medicine deleted', `${rec.name} moved to Deleted Records.`,'warn');
        rerender();
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
      <td>${fmtDate(e.exp)}</td>
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
      <table><thead><tr><th>ID</th><th>Equipment</th><th>Qty</th><th>Condition</th><th>Last Maintenance</th><th>Expiration</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
    <div class="pagination"><span>Page ${state.eqPage} of ${totalPages} · ${list.length} items</span>
      <div class="page-btns"><button data-eqpage="prev">${ICONS.chevleft}</button><button data-eqpage="next">${ICONS.chevright}</button></div>
    </div>
  </div>`;
}
function openEquipmentForm(existing=null){
  const isEdit=!!existing;
  const f=existing||{id:uid("EQP"), name:"", qty:1, condition:"Good", lastMaint:"2026-07-01", exp:"", status:"Available"};
  const html=`
  <div class="modal-head"><h3>${isEdit?'Edit':'Add'} Equipment</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body">
    <form class="form-grid" id="eq-form">
      <div class="f-field"><label>Equipment ID</label><input type="text" id="ef-id" value="${f.id}" ${isEdit?'readonly style="background:#F7FAFD;"':''}></div>
      <div class="f-field full"><label>Equipment Name <span class="req">*</span></label><input type="text" id="ef-name" value="${escapeHtml(f.name)}" required></div>
      <div class="f-field"><label>Quantity</label><input type="number" min="0" id="ef-qty" value="${f.qty}"></div>
      <div class="f-field"><label>Condition</label><select id="ef-condition">${["Good","Fair","Poor"].map(c=>`<option ${f.condition===c?'selected':''}>${c}</option>`).join("")}</select></div>
      <div class="f-field"><label>Last Maintenance</label><input type="date" id="ef-maint" value="${f.lastMaint||""}"></div>
      <div class="f-field"><label>Expiration Date</label><input type="date" id="ef-exp" value="${f.exp||""}"></div>
      <div class="f-field"><label>Status</label><select id="ef-status">${["Available","Under Maintenance","Damaged","Replacement Needed"].map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join("")}</select></div>
    </form>
  </div>
  <div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="ef-save">${ICONS.check} Save Equipment</button></div>`;
  openModal(html);
  document.getElementById('ef-save').onclick=()=>{
    const name=document.getElementById('ef-name').value.trim();
    if(!name){ toast('Missing information','Equipment name is required.','err'); return; }
    const rec={ id:document.getElementById('ef-id').value, name, qty:parseInt(document.getElementById('ef-qty').value)||0,
      condition:document.getElementById('ef-condition').value, lastMaint:document.getElementById('ef-maint').value,
      exp:document.getElementById('ef-exp').value,
      status:document.getElementById('ef-status').value, deleted:false };
    if(isEdit){ const idx=EQUIPMENT.findIndex(e=>e.id===existing.id); EQUIPMENT[idx]=rec; logAudit(`Inventory Updated — ${rec.name}`,"Inventory"); toast('Equipment updated', `${rec.name} has been updated.`,'ok'); }
    else { EQUIPMENT.unshift(rec); logAudit(`Inventory Item Added — ${rec.name}`,"Inventory"); toast('Equipment added', `${rec.name} added to inventory.`,'ok'); }
    closeModal(); renderInventoryTabBody();
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
      confirmDialog({title:"Delete this equipment record?", msg:`<b>${escapeHtml(rec.name)}</b> will be removed from the active list.`, okLabel:"Delete Item", onConfirm:()=>{
        rec.deleted=true;
        logAudit(`Record Deleted — ${rec.name}`,"Inventory","Warning");
        toast('Equipment deleted', `${rec.name} removed from active inventory.`,'warn');
        rerender();
      }});
    };
  });
}
function renderInventoryTabBody(){
  const body=document.getElementById('inv-body');
  if(state.invTab==='medicines'){ body.innerHTML=renderMedicinesTab(); bindMedicinesTab(); }
  else { body.innerHTML=renderEquipmentTab(); bindEquipmentTab(); }
}
