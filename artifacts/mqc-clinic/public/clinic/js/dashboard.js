/* ================= DASHBOARD ================= */
function activeVisits(){return CONSULTATIONS.filter(c=>!c.deleted&&c.status!=="Deleted"&&c.status!=="Superseded"&&STUDENTS.some(s=>s.id===c.studentId));}
const FREQUENT_VISIT_THRESHOLD=2;
function dashboardMetrics(){
  const visits=activeVisits(), today=todayDateString(), month=today.slice(0,7);
  const monthVisits=visits.filter(c=>c.date?.slice(0,7)===month);
  const counts={};visits.forEach(c=>counts[c.studentId]=(counts[c.studentId]||0)+1);
  const returning=Object.values(counts).filter(n=>n>1).length;
  const frequent=Object.values(counts).filter(n=>n>=FREQUENT_VISIT_THRESHOLD).length;
  const referrals=visits.filter(visit=>/referred|referral/i.test(visit.outcome||"")).length;
  return {students:new Set(visits.map(c=>c.studentId)).size,today:visits.filter(c=>c.date===today).length,month:monthVisits.length,returning,frequent,referrals};
}
function renderDashboard(){
  if(!clinicDataLoaded){
    const message=clinicDataStatus==="error"?"Clinic records could not be loaded from the database.":"Clinic records are loading from the database.";
    return `<div class="card dashboard-data-state"><h3>${message}</h3><button class="btn btn-dark" id="dash-retry-load">Retry</button></div>`;
  }
  const stockThreshold=Number(state.settings.lowStockThreshold??15),expirationWindow=Number(state.settings.expirationAlertDays??14);
  const lowStock=[
    ...MEDICINES.filter(m=>!m.deleted&&m.qty<=stockThreshold).map(m=>({...m,itemType:"Medicine",itemId:m.code})),
    ...EQUIPMENT.filter(e=>!e.deleted&&e.qty<=stockThreshold).map(e=>({...e,itemType:"Equipment & Medical Tool",itemId:e.id,unit:""})),
  ];
  const expiring=MEDICINES.filter(m=>!m.deleted&&m.exp&&daysUntil(m.exp)<=expirationWindow);
  const firstName=(state.currentUser?.name||"").split(" ")[0]||"there",m=dashboardMetrics();
  const cards=[["Total Students Served",m.students,"var(--blue)",ICONS.users],["Clinic Visits Today",m.today,"var(--teal)",ICONS.stethoscope],["Total Visits This Month",m.month,"var(--violet)",ICONS.report],["Returning Students",m.returning,"var(--amber)",ICONS.users],["Frequent Visitors",m.frequent,"var(--coral)",ICONS.alert],["Referrals",m.referrals,"var(--red)",ICONS.alert],["Low stock alert",lowStock.length,"var(--amber)",ICONS.alert],["Expiring medicine alert",expiring.length,"var(--coral)",ICONS.alert]];
  return `${clinicDataStatus==="stale"?'<div class="sync-warning">The latest database refresh failed. Figures may be out of date.</div>':""}<div class="greeting-banner"><h2>${greetingWord()}, ${escapeHtml(firstName)}!</h2><p>Here's what's going on in the clinic today.</p></div>
  <div class="grid grid-3">${cards.map(c=>`<div class="card stat-card"><div class="top-row"><div class="stat-label">${c[0]}</div><div class="stat-ic" style="background:${c[2]}18;color:${c[2]}">${c[3]}</div></div><div class="stat-value">${c[1]}</div></div>`).join("")}</div>
  <div class="dashboard-alerts" id="alerts-section"><div class="card"><div class="panel-title"><h4><span style="color:var(--amber);display:inline-flex">${ICONS.alert}</span> Low Stock Alert</h4></div>${lowStockAlertHtml(lowStock)}</div>
  <div class="card expiring-alert-card"><div class="panel-title"><h4><span style="color:var(--coral);display:inline-flex">${ICONS.alert}</span> Expiring Medicine Alert</h4></div>${expiringAlertHtml(expiring)}</div></div>
  <div class="section-head"><h3>Quick Search — Patient Records</h3></div><div class="card"><div class="search-box" style="max-width:440px"><span class="ic">${ICONS.search}</span><input id="dash-search" placeholder="Search by Student ID or Name..."></div>
  <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Student ID</th><th>Name</th><th>Course / Section</th><th>Year / Grade</th><th></th></tr></thead><tbody id="dash-search-tbody"><tr><td colspan="5">${emptyState("Start typing a student ID or name to search.")}</td></tr></tbody></table></div></div>`;
}
function lowStockAlertHtml(list){
  if(!list.length)return emptyState("No items are currently low on stock.");
  return `<div class="table-wrap"><table><thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Quantity</th></tr></thead><tbody>${list.map(item=>`<tr ${item.itemType==="Medicine"?`data-open-med5="${item.itemId}"`:`data-open-eq="${item.itemId}"`}><td>${item.itemType}</td><td class="mono">${escapeHtml(item.itemId)}</td><td>${escapeHtml(item.name)}</td><td class="mono">${item.qty}${item.unit?` ${escapeHtml(item.unit)}`:""}${item.qty===0?" — Out of stock":""}</td></tr>`).join("")}</tbody></table></div>`;
}
function expiringAlertHtml(list){
  if(!list.length)return emptyState("No medicines are expiring within the configured alert window.");
  return `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Batch</th><th>Expiration</th><th>Status</th></tr></thead><tbody>${list.map(m=>{const remaining=daysUntil(m.exp),label=remaining<0?`Expired ${Math.abs(remaining)} day(s) ago`:remaining===0?"Expires today":`Expires in ${remaining} day(s)`;return `<tr data-open-med6="${m.code}"><td class="mono">${m.code}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.batch)}</td><td>${fmtDate(m.exp)}</td><td>${label}</td></tr>`;}).join("")}</tbody></table></div>`;
}
function dashSearchRows(list){
  if(!list.length)return `<tr><td colspan="5">${emptyState("No students found. Try a different search term.")}</td></tr>`;
  return list.slice(0,8).map(s=>`<tr><td class="mono">${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.course||"—")}</td><td>${escapeHtml(s.year||"—")}</td><td><button class="btn" style="padding:6px 12px" data-view-records="${s.id}">${ICONS.search} View Records</button></td></tr>`).join("");
}
function openStudentRecordsModal(student){
  if(!student)return;
  const records=activeVisits().filter(c=>c.studentId===student.id).sort((a,b)=>a.date+a.time<b.date+b.time?1:-1);
  visitorRecordsModal({studentId:student.id,studentName:student.name,course:student.course,year:student.year,count:records.length,records});
}
function bindDashboard(){
  document.getElementById("dash-retry-load")?.addEventListener("click",async()=>{const loaded=await hydrateFromSharedStorage();if(loaded)render();});
  const input=document.getElementById("dash-search"),tbody=document.getElementById("dash-search-tbody");
  const bindRows=()=>document.querySelectorAll("[data-view-records]").forEach(b=>b.onclick=()=>openStudentRecordsModal(STUDENTS.find(s=>s.id===b.dataset.viewRecords)));
  input?.addEventListener("input",()=>{const q=input.value.trim().toLowerCase();tbody.innerHTML=q?dashSearchRows(STUDENTS.filter(s=>[s.id,s.name,s.course,s.year].join(" ").toLowerCase().includes(q))):`<tr><td colspan="5">${emptyState("Start typing a student ID or name to search.")}</td></tr>`;bindRows();});
  document.querySelectorAll("[data-open-med5],[data-open-med6]").forEach(row=>{row.style.cursor="pointer";row.onclick=()=>{const med=MEDICINES.find(m=>m.code===(row.dataset.openMed5||row.dataset.openMed6));if(med)openMedicineForm(med);};});
  document.querySelectorAll("[data-open-eq]").forEach(row=>{row.style.cursor="pointer";row.onclick=()=>{const equipment=EQUIPMENT.find(e=>e.id===row.dataset.openEq);if(equipment)openEquipmentForm(equipment);};});
}