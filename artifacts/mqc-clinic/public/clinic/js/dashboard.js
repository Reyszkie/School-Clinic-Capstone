/* ================= DASHBOARD ================= */
function dashboardMetrics(){
  const metrics=clinicMetrics();
  return {students:metrics.patients.length,today:metrics.todayVisits.length,month:metrics.monthVisits.length,returning:metrics.returningPatients,frequent:metrics.frequentVisitors,referrals:metrics.referrals.length};
}
function renderDashboard(){
  if(!clinicDataLoaded){
    const message=clinicDataStatus==="error"?"Clinic records could not be loaded from the database.":"Clinic records are loading from the database.";
    return `<div class="card dashboard-data-state"><h3>${message}</h3><button class="btn btn-dark" id="dash-retry-load">Retry</button></div>`;
  }
  const medicineAlerts=medicineAlertData();
  const lowStock=[
    ...medicineAlerts.lowStock.map(m=>({...m,itemType:"Medicine",itemId:m.code})),
    ...EQUIPMENT.filter(e=>!e.deleted&&e.category==="Medical Supplies"&&e.qty<=Number(state.settings.lowStockThreshold??15)).map(e=>({...e,itemType:"Medical Supply",itemId:e.id,unit:""})),
  ];
  const expiring=medicineAlerts.expiring,expired=medicineAlerts.expired;
  const firstName=(state.currentUser?.name||"").split(" ")[0]||"there",m=dashboardMetrics();
  const cards=[["Total Patients",m.students,"var(--blue)",ICONS.users],["Clinic Visits Today",m.today,"var(--teal)",ICONS.stethoscope],["Total Visits This Month",m.month,"var(--violet)",ICONS.report],["Returning Patients",m.returning,"var(--amber)",ICONS.users],["Frequent Visitors",m.frequent,"var(--coral)",ICONS.alert],["Referrals",m.referrals,"var(--red)",ICONS.alert]];
  return `${clinicDataStatus==="stale"?'<div class="sync-warning">The latest database refresh failed. Figures may be out of date.</div>':""}<div class="greeting-banner"><h2>${greetingWord()}, ${escapeHtml(firstName)}!</h2><p>Here's what's going on in the clinic today.</p></div>
  <div class="grid grid-3">${cards.map(c=>`<div class="card stat-card"><div class="top-row"><div class="stat-label">${c[0]}</div><div class="stat-ic" style="background:${c[2]}18;color:${c[2]}">${c[3]}</div></div><div class="stat-value">${c[1]}</div></div>`).join("")}</div>
  <div class="dashboard-alerts" id="alerts-section"><div class="card"><div class="panel-title"><h4><span style="color:var(--amber);display:inline-flex">${ICONS.alert}</span> Low Stock Alert</h4></div>${lowStockAlertHtml(lowStock)}</div>
  <div class="card expiring-alert-card"><div class="panel-title"><h4><span style="color:var(--coral);display:inline-flex">${ICONS.alert}</span> Expiring Medicine Alert</h4></div>${expiringAlertHtml(expiring)}</div>
  <div class="card expired-alert-card"><div class="panel-title"><h4><span style="color:var(--red);display:inline-flex">${ICONS.alert}</span> Expired Medicines Alert</h4></div>${expiredAlertHtml(expired)}</div></div>
  <div class="section-head"><h3>Quick Search — Patient Records</h3></div><div class="card"><div class="search-box" style="max-width:440px"><span class="ic">${ICONS.search}</span><input id="dash-search" placeholder="Search patients by name, institutional category, or year..."></div>
  <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Name</th><th>Institutional Category</th><th>Year / Personnel Type</th><th></th></tr></thead><tbody id="dash-search-tbody"><tr><td colspan="4">${emptyState("Start typing a name, institutional category, or year to search.")}</td></tr></tbody></table></div></div>`;
}
function lowStockAlertHtml(list){
  if(!list.length)return emptyState("No items are currently low on stock.");
  return `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Quantity</th><th>Status</th></tr></thead><tbody>${list.map(item=>{const itemStatus=item.itemType==="Medicine"?medStatus(item).label:item.qty===0?"Out of Stock":"Low Stock";return `<tr ${item.itemType==="Medicine"?`data-open-med5="${escapeHtml(item.itemId)}"`:`data-open-eq="${escapeHtml(item.itemId)}"`}><td>${escapeHtml(item.itemType)}</td><td class="mono">${escapeHtml(item.itemId)}</td><td>${escapeHtml(item.name)}</td><td class="mono">${item.qty}${item.unit?` ${escapeHtml(item.unit)}`:""}</td><td>${itemStatus==="Expired"?`<span class="chip chip-expired">Expired</span>`:item.qty===0?"Out of stock":"Low stock"}</td></tr>`;}).join("")}</tbody></table></div>`;
}
function expiringAlertHtml(list){
  if(!list.length)return emptyState(`No medicines expire within the next ${MEDICINE_EXPIRY_ALERT_DAYS} days.`);
  return `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Expiration</th><th>Remaining</th></tr></thead><tbody>${list.map(m=>`<tr data-open-med6="${escapeHtml(m.code)}"><td class="mono">${escapeHtml(m.code)}</td><td>${escapeHtml(m.name)}</td><td class="mono">${Number(m.qty)||0} ${escapeHtml(m.unit||"")}</td><td>${fmtDate(m.exp)}</td><td>${m.daysRemaining===0?"Expires today":`In ${m.daysRemaining} day(s)`}</td></tr>`).join("")}</tbody></table></div>`;
}
function expiredAlertHtml(list){
  if(!list.length)return emptyState("No expired medicines.");
  return `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Expiration</th><th>Status</th></tr></thead><tbody>${list.map(m=>`<tr data-open-med6="${escapeHtml(m.code)}"><td class="mono">${escapeHtml(m.code)}</td><td>${escapeHtml(m.name)}</td><td class="mono">${Number(m.qty)||0} ${escapeHtml(m.unit||"")}</td><td>${fmtDate(m.exp)}</td><td><span class="chip chip-expired">Expired ${Math.abs(m.daysRemaining)} day(s) ago</span></td></tr>`).join("")}</tbody></table></div>`;
}
function dashSearchRows(list){
  if(!list.length)return `<tr><td colspan="4">${emptyState("No patients found. Try a different search term.")}</td></tr>`;
  return list.slice(0,8).map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.institutionalCategory||s.course||"—")}</td><td>${escapeHtml(s.personnelType||s.year||"—")}</td><td><button class="btn" style="padding:6px 12px" data-view-records="${s.id}">${ICONS.search} View Records</button></td></tr>`).join("");
}
function openStudentRecordsModal(student){
  if(!student)return;
  const records=activeClinicVisits().filter(c=>c.studentId===student.id);
  visitorRecordsModal({studentId:student.id,studentName:student.name,course:student.course,year:student.year,count:records.length,records});
}
function bindDashboard(){
  document.getElementById("dash-retry-load")?.addEventListener("click",async()=>{const loaded=await hydrateFromSharedStorage();if(loaded)render();});
  const input=document.getElementById("dash-search"),tbody=document.getElementById("dash-search-tbody");
  const bindRows=()=>document.querySelectorAll("[data-view-records]").forEach(b=>b.onclick=()=>openStudentRecordsModal(STUDENTS.find(s=>s.id===b.dataset.viewRecords)));
  input?.addEventListener("input",()=>{const q=input.value.trim().toLowerCase();tbody.innerHTML=q?dashSearchRows(activeClinicPatients().filter(s=>[s.name,s.institutionalCategory||s.course,s.personnelType||s.year].join(" ").toLowerCase().includes(q))):`<tr><td colspan="4">${emptyState("Start typing a name, institutional category, or year to search.")}</td></tr>`;bindRows();});
  document.querySelectorAll("[data-open-med5],[data-open-med6]").forEach(row=>{row.style.cursor="pointer";row.onclick=()=>{const med=MEDICINES.find(m=>m.code===(row.dataset.openMed5||row.dataset.openMed6));if(med)openMedicineForm(med);};});
  document.querySelectorAll("[data-open-eq]").forEach(row=>{row.style.cursor="pointer";row.onclick=()=>{const equipment=EQUIPMENT.find(e=>e.id===row.dataset.openEq);if(equipment)openEquipmentForm(equipment);};});
}