/* ================= REPORTS ================= */
function reportVisits(){return CONSULTATIONS.filter(c=>!c.deleted&&c.status!=="Deleted"&&c.status!=="Superseded"&&STUDENTS.some(student=>student.id===c.studentId));}
function frequentVisitors(consults,minCount=1){
  const map={};consults.forEach(c=>{if(!map[c.studentId])map[c.studentId]={studentId:c.studentId,studentName:c.studentName,course:c.course,year:c.year,count:0,records:[]};map[c.studentId].count++;map[c.studentId].records.push(c);});
  return Object.values(map).filter(x=>x.count>=minCount).sort((a,b)=>b.count-a.count);
}
const REFERRAL_THRESHOLD=1;
function recordedReferrals(visits=reportVisits()){return visits.filter(visit=>/referred|referral/i.test(visit.outcome||""));}
function referralConcernList(){return frequentVisitors(recordedReferrals().filter(visit=>visit.date?.slice(0,7)===todayDateString().slice(0,7)),REFERRAL_THRESHOLD);}
function reportData(){
  const visits=reportVisits(),month=todayDateString().slice(0,7),reasons={},levels={},outcomes={};
  visits.forEach(c=>{const reason=c.complaint==="Other"&&c.reasonOther?`Other: ${c.reasonOther}`:c.complaint||"Not recorded";reasons[reason]=(reasons[reason]||0)+1;levels[c.year||"Not recorded"]=(levels[c.year||"Not recorded"]||0)+1;outcomes[c.outcome||"Not recorded"]=(outcomes[c.outcome||"Not recorded"]||0)+1;});
  return {visits,unique:new Set(visits.map(c=>c.studentId)).size,frequent:frequentVisitors(visits,FREQUENT_VISIT_THRESHOLD),referrals:recordedReferrals(visits),reasons,levels,outcomes,monthVisits:visits.filter(c=>c.date?.slice(0,7)===month)};
}
function summaryList(obj,kind){return Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([value,count])=>`<tr><td><button type="button" class="report-summary-drilldown" data-summary-kind="${kind}" data-summary-value="${escapeHtml(value)}">${escapeHtml(value)}</button></td><td class="report-count mono">${count}</td></tr>`).join("")||`<tr><td colspan="2">${emptyState("No visit data yet.")}</td></tr>`;}
function renderReports(){
  if(!clinicDataLoaded){const message=clinicDataStatus==="error"?"Clinic records could not be loaded from the database.":"Clinic records are loading from the database.";return `<div class="card dashboard-data-state"><h3>${message}</h3></div>`;}
  const d=reportData(),flagged=referralConcernList();
  const cards=[["Total Clinic Visits",d.visits.length,"all-visits"],["Unique Students Served",d.unique,"unique-students"],["Frequent Clinic Visitors",d.frequent.length,"frequent-visitors"],["Recorded Referrals",d.referrals.length,"referrals"],["Common Reasons for Visits",Object.keys(d.reasons).length,"reasons"],["Visits by Grade Level / Section",Object.keys(d.levels).length,"levels"],["Clinic Visit Trends",d.monthVisits.length,"trends"],["Patient Disposition",Object.keys(d.outcomes).length,"disposition"]];
  return `${clinicDataStatus==="stale"?'<div class="sync-warning">The latest database refresh failed. Report figures may be out of date.</div>':""}<div class="toolbar" style="justify-content:flex-end"><button class="btn btn-dark" id="print-reports">${ICONS.print} Print Report Copy</button></div>
  <div class="grid grid-4">${cards.map(c=>`<button class="card stat-card report-card-clickable" data-report-detail="${c[2]}" style="text-align:left"><div class="stat-label">${c[0]}</div><div class="stat-value">${c[1]}</div><div style="font-size:11.5px;color:var(--blue);margin-top:auto">View details ${ICONS.chevright}</div></button>`).join("")}</div>
  <div class="report-summary-grid">
    <div class="card"><div class="panel-title"><h4>Common Reasons for Visits</h4></div><div class="table-wrap report-summary-table-wrap"><table class="report-summary-table"><colgroup><col><col class="report-summary-count-column"></colgroup><thead><tr><th>Reason</th><th class="report-count">Visits</th></tr></thead><tbody>${summaryList(d.reasons,"reason")}</tbody></table></div></div>
    <div class="card"><div class="panel-title"><h4>Patient Disposition</h4></div><div class="table-wrap report-summary-table-wrap"><table class="report-summary-table"><colgroup><col><col class="report-summary-count-column"></colgroup><thead><tr><th>Outcome</th><th class="report-count">Visits</th></tr></thead><tbody>${summaryList(d.outcomes,"outcome")}</tbody></table></div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="panel-title"><h4>Visits by Grade Level / Section</h4></div><div class="table-wrap"><table><thead><tr><th>Year / Grade</th><th class="report-count">Visits</th></tr></thead><tbody>${summaryList(d.levels,"level")}</tbody></table></div></div>
  <div class="card" style="margin-top:16px;border-left:3px solid var(--amber)"><div class="panel-title"><h4>${ICONS.alert} Frequent Clinic Visitors</h4></div>${d.frequent.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Course / Year</th><th class="report-count">Visits</th><th></th></tr></thead><tbody>${d.frequent.map(v=>`<tr><td>${escapeHtml(v.studentName)}<br><span class="mono" style="font-size:11px;color:var(--ink-soft)">${escapeHtml(v.studentId)}</span></td><td>${escapeHtml(v.course||"—")} — ${escapeHtml(v.year||"—")}</td><td class="report-count">${v.count}</td><td><button class="mini-btn" data-view-visitor-btn="${v.studentId}" title="View visit history">${ICONS.search}</button></td></tr>`).join("")}</tbody></table></div>`:emptyState(`No student has ${FREQUENT_VISIT_THRESHOLD} or more recorded visits.`)}</div>
  <div class="card" style="margin-top:16px;border-left:3px solid var(--red)"><div class="panel-title"><h4>${ICONS.alert} Recorded Referrals</h4></div><p style="font-size:13px;color:var(--ink-soft);line-height:1.7">Referrals are counted from visit dispositions recorded this month.</p>${flagged.length?`<div class="table-wrap"><table><thead><tr><th>Student</th><th class="report-count">Referrals This Month</th><th></th></tr></thead><tbody>${flagged.map(v=>`<tr><td>${escapeHtml(v.studentName)} (${escapeHtml(v.studentId)})</td><td class="report-count">${v.count}</td><td><button class="mini-btn" data-view-visitor-btn="${v.studentId}">${ICONS.search}</button></td></tr>`).join("")}</tbody></table></div>`:emptyState("No referrals were recorded this month.")}</div>`;
}
function detailModal(title,subtitle,tableHtml){openModal(`<div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div><div class="modal-body">${subtitle?`<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:14px">${subtitle}</div>`:""}${tableHtml}</div><div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button></div>`,"record-detail-modal");}
function reportSummaryVisits(kind,value){
  const field={reason:"complaint",level:"year",outcome:"outcome"}[kind];
  const records=reportVisits().filter(visit=>String(kind==="reason"?(visit.complaint==="Other"&&visit.reasonOther?`Other: ${visit.reasonOther}`:visit.complaint||"Not recorded"):kind==="outcome"?(visit[field]||"Not recorded"):visit[field]||"Not recorded")===value)
    .sort((a,b)=>(a.date||"")+(a.time||"")<(b.date||"")+(b.time||"")?1:-1);
  const rows=records.map(visit=>`<tr><td>${escapeHtml(visit.studentName||"—")}</td><td class="mono">${escapeHtml(visit.studentId||"—")}</td><td>${escapeHtml(visit.course||"—")} · ${escapeHtml(visit.year||"—")}</td><td>${escapeHtml(fmtDate(visit.date))}<br>${escapeHtml(visit.time||"")}</td><td>${escapeHtml(visit.complaint==="Other"&&visit.reasonOther?`Other: ${visit.reasonOther}`:visit.complaint||"—")}</td><td>${escapeHtml(visit.outcome||"Not recorded")}</td><td><button type="button" class="mini-btn" data-report-visit-print="${escapeHtml(visit.id)}" title="View full visit record">${ICONS.search}</button></td></tr>`).join("");
  const label={reason:"Common Reason",level:"Year / Grade",outcome:"Patient Disposition"}[kind];
  detailModal(`${label}: ${escapeHtml(value)}`,`${records.length} matching visit record(s)`,`<div class="table-wrap"><table class="report-summary-visits-table"><thead><tr><th>Patient</th><th>Student ID</th><th>Course / Year</th><th>Date / Time</th><th>Reason</th><th>Outcome</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="7">${emptyState("No matching visit records.")}</td></tr>`}</tbody></table></div>`);
  document.querySelectorAll("[data-report-visit-print]").forEach(button=>button.onclick=()=>{const visit=CONSULTATIONS.find(record=>record.id===button.dataset.reportVisitPrint);if(visit){closeModal();printConsultation(visit);}});
}
function visitorRecordsModal(v){
  const rows=v.records.sort((a,b)=>a.date+a.time<b.date+b.time?1:-1).map(c=>`<tr><td class="mono">${c.id}</td><td>${fmtDate(c.date)}<br><span style="font-size:11px;color:var(--ink-soft)">${escapeHtml(c.time)}</span></td><td>${escapeHtml(c.complaint==="Other"&&c.reasonOther?`Other: ${c.reasonOther}`:c.complaint)}</td><td>${escapeHtml(c.outcome||"—")}</td><td><button class="mini-btn" data-open-slip-btn="${c.id}">${ICONS.print}</button></td></tr>`).join("");
  detailModal(`Visit History — ${escapeHtml(v.studentName)}`,`${escapeHtml(v.studentId)} · ${escapeHtml(v.course||"—")} — ${escapeHtml(v.year||"—")} · ${v.count} visit(s)`, `<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Reason</th><th>Outcome</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`);
  document.querySelectorAll("[data-open-slip-btn]").forEach(b=>b.onclick=()=>{closeModal();printConsultation(CONSULTATIONS.find(c=>c.id===b.dataset.openSlipBtn));});
}
function reportDetail(key){
  const d=reportData();
  if(key==="all-visits"||key==="trends"){const rows=d.visits.map(c=>`<tr><td class="mono">${c.id}</td><td>${fmtDate(c.date)}</td><td>${escapeHtml(c.studentName)}</td><td>${escapeHtml(c.complaint==="Other"&&c.reasonOther?`Other: ${c.reasonOther}`:c.complaint)}</td><td>${escapeHtml(c.outcome||"—")}</td></tr>`).join("");detailModal(key==="trends"?"Clinic Visit Trends":"Total Clinic Visits",`${d.visits.length} active record(s)`,`<div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Student</th><th>Reason</th><th>Outcome</th></tr></thead><tbody>${rows||`<tr><td colspan="5">${emptyState("No visit data yet.")}</td></tr>`}</tbody></table></div>`);}
  else if(key==="referrals"){const rows=d.referrals.map(visit=>`<tr><td>${escapeHtml(visit.studentName||"—")}</td><td class="mono">${escapeHtml(visit.studentId||"—")}</td><td>${escapeHtml(fmtDate(visit.date))}</td><td>${escapeHtml(visit.outcome||"—")}</td></tr>`).join("");detailModal("Recorded Referrals",`${d.referrals.length} referral visit(s)`,`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Date</th><th>Disposition</th></tr></thead><tbody>${rows||`<tr><td colspan="4">${emptyState("No referral records found.")}</td></tr>`}</tbody></table></div>`);}
  else if(key==="unique-students"||key==="frequent-visitors"){const list=frequentVisitors(d.visits,1);detailModal(key==="unique-students"?"Unique Students Served":"Frequent Clinic Visitors",`${list.length} student(s) represented`, `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Course / Year</th><th class="report-count">Visits</th></tr></thead><tbody>${list.map(v=>`<tr><td>${escapeHtml(v.studentName)} (${escapeHtml(v.studentId)})</td><td>${escapeHtml(v.course||"—")} — ${escapeHtml(v.year||"—")}</td><td class="report-count">${v.count}</td></tr>`).join("")||`<tr><td colspan="3">${emptyState("No visit data yet.")}</td></tr>`}</tbody></table></div>`);}
  else {const obj=key==="reasons"?d.reasons:key==="levels"?d.levels:d.outcomes;detailModal(key==="reasons"?"Common Reasons for Visits":key==="levels"?"Visits by Grade Level / Section":"Patient Disposition","Summary of active clinic visits",`<div class="table-wrap"><table class="report-detail-summary-table"><colgroup><col><col class="report-detail-count-column"></colgroup><thead><tr><th>Category</th><th class="report-count">Visits</th></tr></thead><tbody>${summaryList(obj)}</tbody></table></div>`);}
}
function printReports(){
  logAudit("Clinic Report Printed","Reports","Success",false);
  const d=reportData(),flagged=referralConcernList();
  const table=(title,headers,rows)=>`<h2>${title}</h2><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">No data</td></tr>`}</tbody></table>`;
  const summaryRows=(obj)=>Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([key,value])=>[escapeHtml(key),value]);
  const visitRows=d.monthVisits.sort((a,b)=>(a.date+a.time<b.date+b.time?1:-1)).map(c=>[escapeHtml(c.id),escapeHtml(fmtDate(c.date)),escapeHtml(c.studentName||"—"),escapeHtml(c.complaint==="Other"&&c.reasonOther?`Other: ${c.reasonOther}`:c.complaint||"—"),escapeHtml(c.outcome||"—")]);
  const frequentRows=d.frequent.map(v=>[escapeHtml(v.studentName||"—"),escapeHtml(v.studentId||"—"),escapeHtml(`${v.course||"—"} — ${v.year||"—"}`),v.count]);
  const referralRows=flagged.map(v=>[escapeHtml(v.studentName||"—"),escapeHtml(v.studentId||"—"),v.count]);
  const html=`<p class="report-meta">Clinical reports · Printed ${escapeHtml(new Date().toLocaleString("en-PH",{timeZone:"Asia/Manila"}))}</p><p class="summary"><b>Total Clinic Visits:</b> ${d.visits.length}<br><b>Unique Students Served:</b> ${d.unique}<br><b>Frequent Clinic Visitors:</b> ${d.frequent.length}<br><b>Common Reasons:</b> ${Object.keys(d.reasons).length}<br><b>Grade Levels / Sections:</b> ${Object.keys(d.levels).length}<br><b>Visits This Month:</b> ${d.monthVisits.length}<br><b>Patient Dispositions:</b> ${Object.keys(d.outcomes).length}</p>${table("Common Reasons for Visits",["Reason","Visits"],summaryRows(d.reasons))}${table("Patient Disposition",["Outcome","Visits"],summaryRows(d.outcomes))}${table("Visits by Grade Level / Section",["Year / Grade","Visits"],summaryRows(d.levels))}${table("Clinic Visit Trends",["Record","Date","Student","Reason","Outcome"],visitRows)}${table("Frequent Clinic Visitors",["Student","Student ID","Course / Year","Visits"],frequentRows)}${table("Recorded Referrals This Month",["Student","Student ID","Referral Visits"],referralRows)}`;
  printInPlace("MQC Clinic Report",html);
}
function previousMonthKey(month){
  const [year,monthNumber]=month.split("-").map(Number);
  return monthNumber===1?`${year-1}-12`:`${year}-${String(monthNumber-1).padStart(2,"0")}`;
}
function reportMonthLabel(month){
  return new Intl.DateTimeFormat("en",{month:"long",year:"numeric",timeZone:"Asia/Manila"}).format(new Date(`${month}-01T00:00:00+08:00`));
}
function currentMedicineInventory(){
  return MEDICINES.filter(item=>!item.deleted).map(item=>({item,status:medStatus(item).label})).sort((a,b)=>a.item.name.localeCompare(b.item.name));
}
function currentEquipmentInventory(){
  return EQUIPMENT.filter(item=>!item.deleted).sort((a,b)=>a.name.localeCompare(b.name));
}
function monthlyReportData(month){
  const visits=reportVisits().filter(visit=>!visit.deleted&&visit.status!=="Superseded"&&visit.date?.slice(0,7)===month);
  const previousMonthVisits=reportVisits().filter(visit=>!visit.deleted&&visit.status!=="Superseded"&&visit.date?.slice(0,7)===previousMonthKey(month)).length;
  const reasons={},medicines={},equipment={},referrals=recordedReferrals(visits);
  visits.forEach(visit=>{
    [...new Set([visit.complaint==="Other"&&visit.reasonOther?`Other: ${visit.reasonOther}`:visit.complaint,...(visit.symptoms||[])].filter(Boolean))].forEach(reason=>{reasons[reason]=(reasons[reason]||0)+1;});
    if(visit.medicine)medicines[visit.medicine]=(medicines[visit.medicine]||0)+(Number(visit.medQty)||1);
    if(visit.supplyUsed)equipment[visit.supplyUsed]=(equipment[visit.supplyUsed]||0)+(Number(visit.supplyQty)||1);
    [...new Set(visit.equipmentUsed||[])].forEach(tool=>{equipment[tool]=(equipment[tool]||0)+(Number(visit.equipmentQty)||1);});
  });
  return {
    visits,previousMonthVisits,referrals,
    visitors:frequentVisitors(visits,1),
    reasons:Object.entries(reasons).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    medicines:Object.entries(medicines).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    equipment:Object.entries(equipment).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    medicineInventory:currentMedicineInventory(),
    equipmentInventory:currentEquipmentInventory(),
  };
}
function monthlyTable(headers,rows,emptyText="No records for this month."){
  const countColumn=/^(visits|visits this month|occurrences|uses)$/i.test(headers.at(-1)||"");
  return `<div class="table-wrap"><table class="monthly-report-table${countColumn?" report-count-table":""}"><thead><tr>${headers.map((header,index)=>`<th${countColumn&&index===headers.length-1?' class="report-count"':''}>${header}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.join(""):`<tr><td colspan="${headers.length}">${emptyText}</td></tr>`}</tbody></table></div>`;
}
function monthlyReportHtml(month){
  const data=monthlyReportData(month),monthLabel=reportMonthLabel(month);
  const visitors=data.visitors.map(visitor=>`<tr><td>${escapeHtml(visitor.studentName||"—")}</td><td>${escapeHtml(visitor.year||"—")}</td><td>${escapeHtml(visitor.course||"—")}</td><td>${visitor.count}</td></tr>`);
  const reasons=data.reasons.map(([reason,count])=>`<tr><td>${escapeHtml(reason)}</td><td>${count}</td></tr>`);
  const medicineUse=data.medicines.map(([name,count])=>`<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`);
  const equipmentUse=data.equipment.map(([name,count])=>`<tr><td>${escapeHtml(name)}</td><td>${count}</td></tr>`);
  const referralRows=data.referrals.map(visit=>`<tr><td>${escapeHtml(visit.studentName||"—")}</td><td>${escapeHtml(visit.studentId||"—")}</td><td>${escapeHtml(fmtDate(visit.date))}</td><td>${escapeHtml(visit.outcome||"—")}</td></tr>`);
  const medicineInventoryRows=data.medicineInventory.map(({item,status})=>`<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category||"—")}</td><td>${Number(item.qty)||0}</td><td>${escapeHtml(item.unit||"—")}</td><td>${escapeHtml(status)}</td></tr>`);
  const equipmentInventoryRows=data.equipmentInventory.map(item=>`<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.qty)||0}</td><td>${escapeHtml(item.condition||"—")}</td><td>${escapeHtml(item.status||"—")}</td></tr>`);
  return `<div class="monthly-report-content">
    <div class="monthly-report-kpis"><div class="monthly-report-stat"><span>Total Clinic Visits</span><strong>${data.visits.length}</strong></div><div class="monthly-report-stat"><span>Previous Month</span><strong>${data.previousMonthVisits}</strong></div><div class="monthly-report-stat"><span>Referrals</span><strong>${data.referrals.length}</strong></div></div>
    <section class="monthly-report-block"><h5>Most Frequent Visitors</h5>${monthlyTable(["Student / Patient","Year Level","Section / Course","Visits"],visitors)}</section>
    <section class="monthly-report-block"><h5>Common Reasons for Clinic Visits</h5>${monthlyTable(["Reason / Symptom","Occurrences"],reasons)}</section>
    <section class="monthly-report-block"><h5>Recorded Referrals</h5>${monthlyTable(["Student","Student ID","Date","Disposition"],referralRows,"No referrals were recorded for this month.")}</section>
    <section class="monthly-report-block"><h5>Medicine Inventory</h5><p class="inventory-report-note">Current medicine stock as of ${fmtDate(todayDateString())}.</p>${monthlyTable(["Medicine","Category","Current Qty","Unit","Status"],medicineInventoryRows,"No medicine inventory records.")}</section>
    <section class="monthly-report-block"><h5>Equipment &amp; Medical Tools</h5><p class="inventory-report-note">Current equipment and medical tool stock as of ${fmtDate(todayDateString())}.</p>${monthlyTable(["Equipment / Tool","Current Qty","Condition","Status"],equipmentInventoryRows,"No equipment inventory records.")}</section>
    <section class="monthly-report-block"><h5>Most Frequently Used Medicines / Treatments</h5>${monthlyTable(["Medicine / Treatment","Uses"],medicineUse)}</section>
    <section class="monthly-report-block"><h5>Most Frequently Used Equipment &amp; Medical Tools</h5>${monthlyTable(["Equipment / Tool","Uses"],equipmentUse)}</section>
    <p class="monthly-report-footnote">${monthLabel} · ${data.visits.length} active visit record(s)</p>
  </div>`;
}
function renderMonthlyReportSection(){
  const month=state.reportMonth||todayDateString().slice(0,7);
  return `<section class="monthly-report-section" id="monthly-report-section"><div class="card"><div class="monthly-report-header"><div><h4>Monthly Report</h4><p>Visit activity and inventory roll-forward by month.</p></div><div class="monthly-report-actions"><label for="monthly-report-month">Month and year</label><input type="month" id="monthly-report-month" value="${escapeHtml(month)}"><button class="btn btn-dark" id="monthly-print-report">${ICONS.print} Print Report</button></div></div><div id="monthly-report-content">${monthlyReportHtml(month)}</div></div></section>`;
}
function printMonthlyReport(){
  logAudit(`Monthly Report Printed — ${state.reportMonth||todayDateString().slice(0,7)}`,"Reports","Success",false);
  const month=state.reportMonth||todayDateString().slice(0,7),report=monthlyReportHtml(month);
  const title=`${state.settings.clinicName} — Monthly Clinic Report`;
  printInPlace(title,`<h2>${escapeHtml(reportMonthLabel(month))} Monthly Report</h2><p class="report-meta">Generated ${escapeHtml(new Date().toLocaleString("en-PH",{timeZone:"Asia/Manila"}))}</p>${report}`);
}
function bindReports(){
  if(!clinicDataLoaded)return;
  document.getElementById("print-reports")?.addEventListener("click",printReports);
  document.querySelectorAll("[data-report-detail]").forEach(b=>b.onclick=()=>reportDetail(b.dataset.reportDetail));
  document.querySelectorAll("[data-summary-kind]").forEach(button=>button.addEventListener("click",()=>reportSummaryVisits(button.dataset.summaryKind,button.dataset.summaryValue)));
  document.querySelectorAll("[data-view-visitor-btn]").forEach(b=>b.onclick=()=>{const v=frequentVisitors(reportVisits(),1).find(x=>x.studentId===b.dataset.viewVisitorBtn);if(v)visitorRecordsModal(v);});
  const content=document.getElementById("content");
  if(content&&!document.getElementById("monthly-report-section"))content.insertAdjacentHTML("beforeend",renderMonthlyReportSection());
  document.getElementById("monthly-report-month")?.addEventListener("change",event=>{
    if(!event.target.value)return;
    state.reportMonth=event.target.value;
    document.getElementById("monthly-report-content").innerHTML=monthlyReportHtml(state.reportMonth);
  });
  document.getElementById("monthly-print-report")?.addEventListener("click",printMonthlyReport);
}