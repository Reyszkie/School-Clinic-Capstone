/* ================= PATIENTS & CLINICAL VISITS ================= */
function renderConsultation(){
  return `<div class="subtabs">
    <button class="subtab ${state.consultTab==="search"?"active":""}" data-ctab="search">Find a Patient</button>
    <button class="subtab ${state.consultTab==="history"?"active":""}" data-ctab="history">Visit History</button>
  </div><div id="consult-body"></div>`;
}

function renderConsultSearchTab(){
  const s=state.selectedStudent;
  return `<div class="card"><div class="toolbar">
    <div class="search-box"><span class="ic">${ICONS.search}</span><input id="stu-search" type="text" placeholder="Search by Student ID, name, course, or year/grade..."></div>
    <select class="select-sm patient-level-filter" id="stu-department-filter" aria-label="Filter by education level">
      <option value="">All education levels</option>
      <option value="College" ${state.departmentFilter==="College"?"selected":""}>College</option>
      <option value="Senior High School" ${state.departmentFilter==="Senior High School"?"selected":""}>Senior High School</option>
      <option value="Junior High School" ${state.departmentFilter==="Junior High School"?"selected":""}>Junior High School</option>
      <option value="Elementary School" ${state.departmentFilter==="Elementary School"?"selected":""}>Elementary</option>
      <option value="Kindergarten" ${state.departmentFilter==="Kindergarten"?"selected":""}>Kindergarten</option>
    </select>
    <select class="select-sm hidden" id="stu-course-filter"><option value="">All Courses / Sections</option>${courseOptionsHtml("")}</select>
    <button class="btn btn-teal" id="add-student-btn">${ICONS.plus} Add New Patient</button>
  </div><div class="table-wrap"><table><thead><tr><th>Student ID</th><th>Name</th><th>Course / Section / Strand</th><th>Year / Grade</th><th>Sex</th><th></th></tr></thead>
    <tbody id="stu-tbody"></tbody></table></div></div>${s?renderStudentDetail(s):""}`;
}

function studentTableRows(list){
  if(!list.length) return `<tr><td colspan="6">${emptyState("No patients found. Try a different search term.")}</td></tr>`;
  return list.slice(0,12).map(s=>`<tr><td class="mono">${escapeHtml(s.id)}</td><td>${escapeHtml(s.name)}</td>
    <td>${escapeHtml(s.course||"—")}</td><td>${escapeHtml(s.year||"—")}</td><td>${escapeHtml(s.gender||s.sex||"—")}</td>
    <td><div class="row-actions"><button class="btn" style="padding:6px 12px;" data-select-stu="${escapeHtml(s.id)}">Select</button>
    <button class="mini-btn danger" data-del-stu="${escapeHtml(s.id)}" title="Delete">${ICONS.trash_sm}</button></div></td></tr>`).join("");
}

function studentClinicalVisits(student){
  return CONSULTATIONS.filter(c=>c.studentId===student.id&&!c.deleted)
    .filter(c=>c.status!=="Superseded")
    .sort((a,b)=>(a.date+a.time<b.date+b.time?1:-1));
}

function renderStudentClinicalRecords(student){
  const visits=studentClinicalVisits(student);
  const rows=visits.length?visits.map(c=>{
    const note=c.description||c.notes||c.remarks||"No additional notes";
    return `<tr><td>${fmtDate(c.date)}<br><span class="record-time">${escapeHtml(c.time||"")}</span></td>
      <td><b>${escapeHtml(c.complaint||"Other")}</b><br><span class="record-preview">${escapeHtml(note)}</span></td>
      <td>${escapeHtml(c.nurse||"—")}</td><td><span class="chip chip-available">${escapeHtml(c.outcome||"Active")}</span></td>
      <td><div class="row-actions"><button class="mini-btn" data-view-student-consult="${escapeHtml(c.id)}" title="View full clinical record">${ICONS.search}</button>
      <button class="mini-btn" data-edit-student-consult="${escapeHtml(c.id)}" title="Edit visit record">${ICONS.edit}</button></div></td></tr>`;
  }).join(""):`<tr><td colspan="5"><div class="clinical-empty"><b>No clinical visits recorded yet.</b><span>Use “New Patient Visit” to record the reason for a visit, assessment, treatment, and outcome.</span></div></td></tr>`;

  return `<div class="student-records"><div class="student-records-head"><div><h4>Clinical Visit Records</h4>
    <p>${visits.length?`${visits.length} recorded visit${visits.length===1?"":"s"} for this patient.`:"This patient's clinical history will appear here."}</p></div>
    <span class="record-count">${visits.length}</span></div>
    <div class="table-wrap"><table class="clinical-records-table"><thead><tr><th>Date</th><th>Reason &amp; notes</th><th>Nurse</th><th>Outcome</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function renderStudentDetail(s){
  const displayName=s.name||[s.lastName,s.firstName,s.middleInitial].filter(Boolean).join(", ");
  const initials=displayName.split(/[\s,]+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("");
  return `<div class="card" style="margin-top:16px;"><div class="student-card">
    <div class="s-avatar">${escapeHtml(initials)}</div><div style="flex:1"><h3 style="font-size:19px">${escapeHtml(displayName)}</h3>
      <div style="color:var(--ink-soft);font-size:13px;margin-top:2px">${escapeHtml(s.id)} · ${escapeHtml(s.course||"—")} · ${escapeHtml(s.year||"—")}</div></div>
    <button class="btn" id="edit-student-btn">${ICONS.edit} Edit Profile</button>
    <button class="btn btn-teal" id="open-consult-form">${ICONS.plus} New Patient Visit</button>
    <button class="btn btn-outline-red" id="delete-student-btn">${ICONS.trash_sm} Delete Patient</button>
  </div><div class="info-grid">
    <div class="info-cell"><div class="lbl">Sex</div><div class="val">${escapeHtml(s.gender||s.sex||"—")}</div></div>
    <div class="info-cell"><div class="lbl">Age</div><div class="val">${s.age||"—"} yrs old</div></div>
    <div class="info-cell"><div class="lbl">Contact Number</div><div class="val mono">${escapeHtml(s.contact||"—")}</div></div>
    <div class="info-cell"><div class="lbl">Parent / Guardian</div><div class="val">${escapeHtml(s.guardianName||s.emergency||"—")}</div></div>
    <div class="info-cell"><div class="lbl">Guardian Contact</div><div class="val mono">${escapeHtml(s.guardianContact||"—")}</div></div>
    <div class="info-cell" style="grid-column:span 2"><div class="lbl">Course / Section / Strand</div><div class="val">${escapeHtml(s.course||"—")}</div></div>
    <div class="info-cell ${s.allergies&&s.allergies!=="None known"?"warn":""}"><div class="lbl">Allergies</div><div class="val">${escapeHtml(s.allergies||"None known")}</div></div>
    <div class="info-cell ${s.conditions&&s.conditions!=="None"?"warn":""}"><div class="lbl">Medical Conditions</div><div class="val">${escapeHtml(s.conditions||"None")}</div></div>
  </div>${renderStudentClinicalRecords(s)}</div>`;
}

function filterStudents(){
  const q=(document.getElementById("stu-search").value||"").toLowerCase();
  const course=document.getElementById("stu-course-filter").value;
  const department=document.getElementById("stu-department-filter").value||"";
  return STUDENTS.filter(s=>!s.deleted).filter(s=>{
    const searchable=[s.id,s.name,s.course,s.year,s.lastName,s.firstName].join(" ").toLowerCase();
    return (!q||searchable.includes(q))&&(!course||s.course===course)&&(!department||educationGroupFor(s.course,s.year)===department);
  });
}

function bindConsultSearch(){
  const run=()=>{ document.getElementById("stu-tbody").innerHTML=studentTableRows(filterStudents()); bindSelectButtons(); };
  document.getElementById("stu-search").oninput=run;
  document.getElementById("stu-course-filter").onchange=run;
  document.getElementById("stu-department-filter").onchange=(event)=>{
    state.departmentFilter=event.target.value;
    state.selectedStudent=null;
    run();
  };
  document.getElementById("add-student-btn").onclick=()=>openStudentForm();
  run();
}

function openStudentForm(existing=null){
  let isEdit=!!existing;
  let editingStudent=existing;
  const f=existing||{id:"",lastName:"",firstName:"",middleInitial:"",course:COLLEGE_COURSES[0],year:"1st Year",gender:"Male",age:"",contact:"",guardianName:"",guardianContact:""};
  const parts=(f.name||"").split(",");
  const lastName=f.lastName||parts[0]||"";
  const firstName=f.firstName||(parts[1]||"").trim().split(" ")[0]||"";
  const html=`<div class="modal-head"><h3 id="student-form-title">${isEdit?"Edit":"Add New"} Patient</h3><button class="modal-close" onclick="closeModal()" aria-label="Close patient form">${ICONS.x}</button></div>
  <div class="modal-body"><form class="form-grid" id="stu-form">
    <div class="f-field"><label>Student ID <span class="req">*</span></label><input id="sf-id" value="${escapeHtml(f.id)}" placeholder="e.g. 2026-10099" ${isEdit?"readonly style='background:#F7FAFD;'":""}></div>
    <div class="f-field"><label>Last Name <span class="req">*</span></label><input id="sf-lastname" value="${escapeHtml(lastName)}"></div>
    <div class="f-field"><label>Given Name <span class="req">*</span></label><input id="sf-firstname" value="${escapeHtml(firstName)}"></div>
    <div class="f-field"><label>Middle Initial</label><input id="sf-middle" maxlength="3" value="${escapeHtml(f.middleInitial||"")}" placeholder="M.I."></div>
    <div class="f-field"><label>Year Level <span class="req">*</span></label><select id="sf-year">${yearLevelsFor(f.course).map(y=>`<option ${f.year===y?"selected":""}>${y}</option>`).join("")}</select></div>
    <div class="f-field full"><label>Course / Section / Strand <span class="req">*</span></label><select id="sf-course">${courseOptionsHtml(f.course)}</select></div>
    <div class="f-field"><label>Age</label><input type="number" min="4" max="60" id="sf-age" value="${f.age||""}"></div>
    <div class="f-field"><label>Sex</label><select id="sf-gender">${["Male","Female"].map(g=>`<option ${f.gender===g?"selected":""}>${g}</option>`).join("")}</select></div>
    <div class="f-field"><label>Contact Number</label><input id="sf-contact" value="${escapeHtml(f.contact||"")}" placeholder="09XXXXXXXXX"></div>
    <div class="f-field"><label>Parent / Guardian Name</label><input id="sf-guardian" value="${escapeHtml(f.guardianName||f.emergency||"")}"></div>
    <div class="f-field"><label>Parent / Guardian Contact</label><input id="sf-guardian-contact" value="${escapeHtml(f.guardianContact||"")}" placeholder="09XXXXXXXXX"></div>
  </form></div><div class="modal-foot"><span class="form-save-status" id="sf-status" aria-live="polite"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="sf-save">${ICONS.check} ${isEdit?"Save Changes":"Save Patient"}</button></div>`;
  openModal(html);
  document.getElementById("sf-course").onchange=e=>{
    document.getElementById("sf-year").innerHTML=yearLevelsFor(e.target.value).map(y=>`<option>${y}</option>`).join("");
  };
  document.getElementById("sf-save").onclick=()=>{
    const id=document.getElementById("sf-id").value.trim(), last=document.getElementById("sf-lastname").value.trim(), first=document.getElementById("sf-firstname").value.trim(), middle=document.getElementById("sf-middle").value.trim();
    if(!id||!last||!first){toast("Missing information","Student ID, last name, and given name are required.","err");return;}
    if(!isEdit&&STUDENTS.some(s=>s.id.toLowerCase()===id.toLowerCase())){toast("Duplicate Student ID",`A student with ID ${id} already exists.`,"err");return;}
    const name=`${last}, ${first}${middle?" "+middle.replace(/\.$/,"")+".":""}`;
    const rec={id,name,lastName:last,firstName:first,middleInitial:middle,course:document.getElementById("sf-course").value,year:document.getElementById("sf-year").value,gender:document.getElementById("sf-gender").value,sex:document.getElementById("sf-gender").value,age:parseInt(document.getElementById("sf-age").value)||18,contact:document.getElementById("sf-contact").value,guardianName:document.getElementById("sf-guardian").value,guardianContact:document.getElementById("sf-guardian-contact").value,emergency:document.getElementById("sf-guardian").value,allergies:f.allergies||"None known",conditions:f.conditions||"None"};
    const wasEdit=isEdit;
    if(wasEdit){
      const index=STUDENTS.findIndex(s=>s.id===editingStudent.id), previous=index>=0?STUDENTS[index]:editingStudent;
      const updated={...previous,...rec};
      if(index>=0) STUDENTS[index]=updated;
      CONSULTATIONS.forEach(c=>{if(c.studentId===updated.id){c.studentName=updated.name;c.course=updated.course;c.year=updated.year;}});
      editingStudent=updated;state.selectedStudent=updated;
      logAudit(`Patient Record Updated — ${updated.name} (${updated.id})`,"Patient Visits");toast("Patient updated",`${updated.name}'s record has been updated.`,"ok");
    }else{
       STUDENTS.unshift(rec);editingStudent=rec;state.selectedStudent=rec;
       logAudit(`Patient Added — ${rec.name} (${rec.id})`,"Patient Visits");toast("Patient added",`Welcome, ${rec.name}! Added to patient records.`,"ok");
    }
    saveToClinicState();
     if(!wasEdit){
       closeModal();
       renderConsultTabBody();
     }else{
       renderConsultTabBody();
       document.getElementById("sf-status").textContent="Changes saved. You can keep editing or click X to close.";
     }
  };
}

function bindSelectButtons(){
  document.querySelectorAll("[data-select-stu]").forEach(b=>b.onclick=()=>{state.selectedStudent=STUDENTS.find(s=>s.id===b.dataset.selectStu);renderConsultTabBody();});
  document.querySelectorAll("[data-del-stu]").forEach(b=>b.onclick=()=>deleteStudent(STUDENTS.find(s=>s.id===b.dataset.delStu)));
  const open=document.getElementById("open-consult-form"); if(open) open.onclick=()=>openConsultationForm(state.selectedStudent);
  const edit=document.getElementById("edit-student-btn"); if(edit) edit.onclick=()=>openStudentForm(state.selectedStudent);
  const del=document.getElementById("delete-student-btn"); if(del) del.onclick=()=>deleteStudent(state.selectedStudent);
  document.querySelectorAll("[data-view-student-consult]").forEach(b=>b.onclick=()=>{
    viewConsultation(CONSULTATIONS.find(c=>c.id===b.dataset.viewStudentConsult));
  });
  document.querySelectorAll("[data-edit-student-consult]").forEach(b=>b.onclick=()=>{
    const c=CONSULTATIONS.find(x=>x.id===b.dataset.editStudentConsult);
    if(c) openConsultationForm(state.selectedStudent,c);
  });
}

function deleteStudent(s){
  if(!s)return;
  confirmDialog({title:"Delete this patient?",msg:`<b>${escapeHtml(s.name)}</b> (${s.id}) will be moved to Deleted Records and can be restored later.`,okLabel:"Delete Patient",onConfirm:()=>{
    const index=STUDENTS.findIndex(x=>x.id===s.id);
    if(index<0)return;
    const deleted={...s,deleted:true,deletedAt:todayDateString(),deletedBy:state.currentUser?.name||"System"};
    STUDENTS.splice(index,1);
    DELETED_STUDENTS=DELETED_STUDENTS.filter(x=>x.id!==s.id);
    DELETED_STUDENTS.unshift(deleted);
    if(state.selectedStudent?.id===s.id)state.selectedStudent=null;
    logAudit(`Record Deleted — Patient ${s.name} (${s.id})`,"Patient Visits","Warning");saveToClinicState();toast("Patient deleted",`${s.name} moved to Deleted Records.`,"warn");renderConsultTabBody();
  }});
}

function optionListHtml(options, selected=[], group="option"){
  return `<div class="option-grid">${options.map(o=>`<label class="option-check"><input type="checkbox" data-check-group="${group}" data-check="${escapeHtml(o)}" ${selected.includes(o)?"checked":""}><span>${escapeHtml(o)}</span></label>`).join("")}</div>`;
}
function selectedChecks(selector){return [...document.querySelectorAll(selector+":checked")].map(x=>x.dataset.check);}
function bindOptionFreeText(group, initialValue=""){
  const checkbox=document.querySelector(`[data-free-text-toggle="${group}"]`), field=document.querySelector(`[data-free-text="${group}"]`);
  if(!checkbox||!field)return;
  const update=()=>{field.classList.toggle("hidden",!checkbox.checked);if(!checkbox.checked)field.value="";};
  checkbox.addEventListener("change",update);field.value=initialValue||"";update();
}

function openConsultationForm(student, existing=null){
  if(!student)return;
  const isEdit=!!existing, f=existing||{date:todayDateString(),time:currentTimeString(),nurse:state.currentUser.name,complaint:"",description:"",symptomStart:"",painLevel:"0 – No pain",painLocation:"",symptoms:[],knownConditions:"No",allergiesHistory:"No",currentMedication:"No",previousSimilar:"No",lastMeal:"",weight:"",height:"",temp:"",bp:"",pulse:"",spo2:"",assessment:"Stable",assessmentOther:"",notes:"",interventions:[],treatmentGiven:"",dosage:"",outcome:"Treated and Released",releasedAt:"",remarks:"",guardianContacted:"not applicable",guardianMethod:"phone call",personContacted:"",staffRecord:state.currentUser.name,position:state.currentUser.role||"Staff Nurse",medicine:"",medQty:1};
  const meds=MEDICINES.filter(m=>!m.deleted);
  const html=`<div class="modal-head"><h3>${isEdit?"Edit":"New"} Patient Visit — ${escapeHtml(student.name)}</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body"><form id="consult-form" class="form-grid">
    <div class="f-field"><label>Visit Date <span class="req">*</span></label><input type="date" id="cf-date" value="${f.date}" required></div>
    <div class="f-field"><label>Visit Time <span class="req">*</span></label><input id="cf-time" value="${escapeHtml(f.time)}" required></div>
    <div class="f-field"><label>Nurse on Duty</label><input value="${escapeHtml(f.nurse||state.currentUser.name)}" readonly style="background:#F7FAFD"></div>
    <div class="f-field full"><label>Reason for Clinic Visit <span class="req">*</span></label><select id="cf-complaint"><option value="">Select reason</option>${COMPLAINTS.map(c=>`<option ${f.complaint===c?"selected":""}>${c}</option>`).join("")}<option ${f.complaint==="Other"?"selected":""}>Other</option></select></div>
    <div class="f-field full"><label>Detailed Description</label><textarea id="cf-description">${escapeHtml(f.description||"")}</textarea></div>
    <div class="f-field"><label>When did symptoms start?</label><input id="cf-start" value="${escapeHtml(f.symptomStart||"")}" placeholder="e.g. this morning"></div>
    <div class="f-field"><label>Pain Level</label><select id="cf-pain">${["0 – No pain","1–3 – Mild","4–6 – Moderate","7–9 – Severe","10 – Worst possible pain"].map(x=>`<option ${f.painLevel===x?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="f-field"><label>Location of Pain</label><input id="cf-location" value="${escapeHtml(f.painLocation||"")}"></div>
    <div class="f-field full"><label>Symptoms</label><div style="padding-top:5px">${optionListHtml(SYMPTOMS,f.symptoms||[],"symptom")}<label class="option-check"><input type="checkbox" id="cf-symptom-other" data-free-text-toggle="symptom-other" ${f.symptoms?.some(x=>x==="Other"||x.startsWith("Other: "))?"checked":""}><span>Other</span></label><input class="option-free-text hidden" data-free-text="symptom-other" placeholder="Enter other symptoms" value="${escapeHtml((f.symptoms||[]).find(x=>x.startsWith("Other: "))?.replace("Other: ","")||"")}"></div></div>
    <div class="f-field full"><label>Medical History</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <label>Known Medical Conditions<select id="cf-conditions"><option>No</option><option ${f.knownConditions==="Yes"?"selected":""}>Yes</option></select></label>
      <label>Allergies<select id="cf-allergies"><option>No</option><option ${f.allergiesHistory==="Yes"?"selected":""}>Yes</option></select></label>
      <label>Current Medication<select id="cf-current-med"><option>No</option><option ${f.currentMedication==="Yes"?"selected":""}>Yes</option></select></label>
      <label>Previous Similar Symptoms<select id="cf-previous"><option>No</option><option ${f.previousSimilar==="Yes"?"selected":""}>Yes</option></select></label>
      <label style="grid-column:span 2">Last Meal / Food Consumed<input id="cf-meal" value="${escapeHtml(f.lastMeal||"")}"></label>
    </div></div>
    <div class="f-field full"><label>Vital Signs</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <label>Weight<input id="cf-weight" value="${escapeHtml(f.weight||"")}" placeholder="kg"></label><label>Height<input id="cf-height" value="${escapeHtml(f.height||"")}" placeholder="cm"></label><label>Temperature<input id="cf-temp" value="${escapeHtml(f.temp||"")}" placeholder="°C"></label>
      <label>Blood Pressure (mmHg)<input id="cf-bp" value="${escapeHtml(f.bp||"")}" placeholder="110/70"></label><label>Heart Rate (BPM)<input id="cf-pulse" value="${escapeHtml(f.pulse||"")}"></label><label>Oxygen Saturation (SpO₂)<input id="cf-spo2" value="${escapeHtml(f.spo2||"")}" placeholder="%"></label>
    </div></div>
    <div class="f-field full"><label>Nurse's Assessment</label><div style="padding-top:5px">${optionListHtml(["Stable","Weak","Alert","Drowsy","In Pain"],f.assessment?[f.assessment]:[],"assessment")}<label class="option-check"><input type="checkbox" id="cf-assess-other" data-free-text-toggle="assessment-other" ${f.assessmentOther?"checked":""}><span>Other</span></label><input class="option-free-text hidden" data-free-text="assessment-other" placeholder="Enter other assessment" value="${escapeHtml(f.assessmentOther||"")}"></div></div>
    <div class="f-field full"><label>Nurse's Notes / Assessment</label><textarea id="cf-notes">${escapeHtml(f.notes||"")}</textarea></div>
    <div class="f-field full"><label>Treatment / Intervention</label><div style="padding-top:5px">${optionListHtml(INTERVENTIONS,f.interventions||[],"intervention") }<label class="option-check"><input type="checkbox" id="cf-intervention-other" data-free-text-toggle="intervention-other" ${f.interventions?.some(x=>x==="Other"||x.startsWith("Other: "))?"checked":""}><span>Other</span></label><input class="option-free-text hidden" data-free-text="intervention-other" placeholder="Enter other intervention" value="${escapeHtml((f.interventions||[]).find(x=>x.startsWith("Other: "))?.replace("Other: ","")||"")}"></div></div>
    <div class="f-field full"><label>Additional Treatment Details</label><textarea id="cf-treatment" placeholder="Record any care instructions or treatment details">${escapeHtml(f.treatmentGiven||"")}</textarea></div>
    <div class="f-field"><label>Medication / Treatment Given</label><select id="cf-medicine"><option value="">None</option>${meds.map(m=>`<option value="${escapeHtml(m.name)}" ${f.medicine===m.name?"selected":""}>${escapeHtml(m.name)} (${m.qty} ${m.unit})</option>`).join("")}</select></div>
    <div class="f-field"><label>Dosage / Instructions</label><input id="cf-dosage" value="${escapeHtml(f.dosage||"")}" placeholder="e.g. 1 tablet"></div>
    <div class="f-field"><label>Quantity Used</label><input type="number" min="1" id="cf-medqty" value="${f.medQty||1}"></div>
    <div class="f-field full"><label>Clinic Disposition — Outcome</label><select id="cf-outcome">${DISPOSITIONS.map(x=>`<option ${f.outcome===x?"selected":""}>${x}</option>`).join("")}<option ${f.outcome==="Other"?"selected":""}>Other</option></select></div>
    <div class="f-field"><label>Time Released / Referred</label><input id="cf-released" value="${escapeHtml(f.releasedAt||"")}"></div>
    <div class="f-field full"><label>Remarks</label><textarea id="cf-remarks">${escapeHtml(f.remarks||"")}</textarea></div>
    <div class="f-field full"><label>Parent / Guardian Notification</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <label>Contacted?<select id="cf-guardian-contacted"><option>yes</option><option ${f.guardianContacted==="no"?"selected":""}>no</option><option ${f.guardianContacted==="not applicable"?"selected":""}>not applicable</option></select></label>
      <label>Method<select id="cf-guardian-method">${[["not applicable","Not Applicable"],["phone call","Phone Call"],["sms/text","SMS/Text"],["messenger","Messenger"],["in person","In Person"]].map(([value,label])=>`<option value="${value}" ${f.guardianMethod===value?"selected":""}>${label}</option>`).join("")}</select></label>
      <label>Person Contacted<input id="cf-person" value="${escapeHtml(f.personContacted||"")}"></label>
    </div></div>
    <div class="f-field"><label>Clinic Staff Record</label><input id="cf-staff" value="${escapeHtml(f.staffRecord||state.currentUser.name)}"></div>
    <div class="f-field"><label>Position</label><input id="cf-position" value="${escapeHtml(f.position||state.currentUser.role||"Staff Nurse")}"></div>
  </form></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn" id="cf-clear">Clear Form</button><button class="btn btn-dark" id="cf-save">${ICONS.check} Save Visit</button></div>`;
  openModal(html);
  bindOptionFreeText("symptom-other",(f.symptoms||[]).find(x=>x.startsWith("Other: "))?.replace("Other: ","")||"");
  bindOptionFreeText("assessment-other",f.assessmentOther||"");
  bindOptionFreeText("intervention-other",(f.interventions||[]).find(x=>x.startsWith("Other: "))?.replace("Other: ","")||"");
  document.getElementById("cf-clear").onclick=()=>document.getElementById("consult-form").reset();
  document.getElementById("cf-save").onclick=()=>{
    const complaint=document.getElementById("cf-complaint").value;if(!complaint){toast("Missing information","Please select a reason for the clinic visit.","err");return;}
    const medName=document.getElementById("cf-medicine").value, medQty=parseInt(document.getElementById("cf-medqty").value)||1, med=MEDICINES.find(m=>m.name===medName);
    const previous=isEdit?CONSULTATIONS.find(c=>c.id===existing.id):null;
    const previousMed=previous?.medicine?MEDICINES.find(m=>m.name===previous.medicine):null;
    const availableQty=med ? med.qty + (previousMed?.name===med.name ? (Number(previous.medQty)||1) : 0) : 0;
    if(med&&availableQty<medQty){toast("Insufficient stock",`${med.name} only has ${availableQty} ${med.unit}(s) available for this visit.`,"err");return;}
    const symptoms=selectedChecks('[data-check-group="symptom"]'); const symptomOther=document.querySelector('[data-free-text="symptom-other"]')?.value.trim(); if(symptomOther)symptoms.push(`Other: ${symptomOther}`);
    const assessment=selectedChecks('[data-check-group="assessment"]')[0]||"";
    const assessmentOther=document.querySelector('[data-free-text="assessment-other"]')?.value.trim()||"";
    const interventions=selectedChecks('[data-check-group="intervention"]'); const interventionOther=document.querySelector('[data-free-text="intervention-other"]')?.value.trim(); if(interventionOther)interventions.push(`Other: ${interventionOther}`);
    const rec={id:uid("CS"),date:document.getElementById("cf-date").value,time:document.getElementById("cf-time").value,nurse:state.currentUser.name,studentId:student.id,studentName:student.name,course:student.course,year:student.year,complaint,description:document.getElementById("cf-description").value,symptomStart:document.getElementById("cf-start").value,painLevel:document.getElementById("cf-pain").value,painLocation:document.getElementById("cf-location").value,symptoms,knownConditions:document.getElementById("cf-conditions").value,allergiesHistory:document.getElementById("cf-allergies").value,currentMedication:document.getElementById("cf-current-med").value,previousSimilar:document.getElementById("cf-previous").value,lastMeal:document.getElementById("cf-meal").value,weight:document.getElementById("cf-weight").value,height:document.getElementById("cf-height").value,temp:document.getElementById("cf-temp").value,bp:document.getElementById("cf-bp").value,pulse:document.getElementById("cf-pulse").value,spo2:document.getElementById("cf-spo2").value,assessment,assessmentOther,notes:document.getElementById("cf-notes").value,interventions,treatmentGiven:document.getElementById("cf-treatment")?.value||"",dosage:document.getElementById("cf-dosage").value,medicine:medName,medQty,outcome:document.getElementById("cf-outcome").value,releasedAt:document.getElementById("cf-released").value,remarks:document.getElementById("cf-remarks").value,guardianContacted:document.getElementById("cf-guardian-contacted").value,guardianMethod:document.getElementById("cf-guardian-method").value,personContacted:document.getElementById("cf-person").value,staffRecord:document.getElementById("cf-staff").value,position:document.getElementById("cf-position").value,followUp:"No",status:"Active",deleted:false,createdAt:new Date().toISOString()};
     if(isEdit){
       if(previousMed)previousMed.qty+=Number(previous.medQty)||1;
       if(med)med.qty=Math.max(0,med.qty-medQty);
       const revision=Number(previous.revision)||1;
       rec.versionOf=previous.versionOf||previous.id;
       rec.revision=revision+1;
       rec.supersedesId=previous.id;
       previous.status="Superseded";
       previous.supersededBy=rec.id;
       previous.supersededAt=new Date().toISOString();
       CONSULTATIONS.unshift(rec);
       logAudit(`Patient Visit Revised — ${previous.id} → ${rec.id}`,"Patient Visits");
       toast("Visit revision saved",`Created new record ${rec.id}; the original remains available in Visit History.`,"ok");
     }
     else{
       rec.revision=1;
       CONSULTATIONS.unshift(rec);
       if(med)med.qty=Math.max(0,med.qty-medQty);
       logAudit(`Patient Visit Saved — ${rec.id}`,"Patient Visits");
       toast("Visit saved",`Recorded visit for ${student.name}.`,"ok");
     }
    saveToClinicState();closeModal();renderPage();
  };
}

function consultationRows(c){
  return [
    ["Record No.",c.id],
    ["Date / Time",`${fmtDate(c.date)} · ${c.time||"—"}`],
    ["Student",`${c.studentName||"—"} (${c.studentId||"—"})`],
    ["Course / Year",`${c.course||"—"} — ${c.year||"—"}`],
    ["Nurse on Duty",c.nurse||"—"],
    ["Reason for Clinic Visit",c.complaint||"—"],
    ["Detailed Description",c.description||"—"],
    ["Symptoms",(c.symptoms||[]).join(", ")||"—"],
    ["Pain",`${c.painLevel||"—"}${c.painLocation?" · "+c.painLocation:""}`],
    ["Medical History",`Conditions: ${c.knownConditions||"—"} · Allergies: ${c.allergiesHistory||"—"} · Current medication: ${c.currentMedication||"—"} · Previous similar symptoms: ${c.previousSimilar||"—"}`],
    ["Last Meal / Food",c.lastMeal||"—"],
    ["Vital Signs",`Weight ${c.weight||"—"} · Height ${c.height||"—"} · Temp ${c.temp||"—"} · BP ${c.bp||"—"} · HR ${c.pulse||"—"} · SpO₂ ${c.spo2||"—"}`],
    ["Nurse's Assessment",c.assessment||c.diagnosis||"—"],
    ["Nurse's Notes",c.notes||"—"],
    ["Treatment / Intervention",(c.interventions||[]).join(", ")||c.treatment||"—"],
    ["Additional Treatment Details",c.treatmentGiven||"—"],
    ["Medication",c.medicine?`${c.medicine} × ${c.medQty||1} · ${c.dosage||""}`:"—"],
    ["Outcome",c.outcome||"—"],
    ["Time Released / Referred",c.releasedAt||"—"],
    ["Guardian Notification",`${c.guardianContacted||"—"}${c.personContacted?" · "+c.personContacted:""}`],
    ["Remarks",c.remarks||"—"],
    ["Clinic Staff Record",`${c.staffRecord||"—"} · ${c.position||"—"}`],
  ];
}

function viewConsultation(c){
  if(!c)return;
  const rows=consultationRows(c);
  const isSuperseded=c.status==="Superseded";
  openModal(`<div class="modal-head"><h3>${isSuperseded?"Original":"Clinical"} Visit Record</h3><button class="modal-close" onclick="closeModal()" aria-label="Close clinical visit record">${ICONS.x}</button></div>
     <div class="modal-body"><div class="visit-record-summary"><span>${isSuperseded?"Original record · preserved for audit":"Reason for clinic visit"}</span><strong>${escapeHtml(c.complaint||"Other")}</strong><small>${escapeHtml(c.studentName||"")} · ${escapeHtml(fmtDate(c.date))} at ${escapeHtml(c.time||"—")} · Revision ${c.revision||1}${isSuperseded&&c.supersededBy?` · Revised as ${escapeHtml(c.supersededBy)}`:""}</small></div>
    <table class="record-detail-table"><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1]||"—")}</td></tr>`).join("")}</tbody></table></div>
     <div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button><button class="btn" id="view-record-print">${ICONS.print} Print</button>${isSuperseded?"":`<button class="btn btn-dark" id="view-record-edit">${ICONS.edit} Edit Visit</button>`}</div>`);
  document.getElementById("view-record-print").onclick=()=>printConsultation(c);
  document.getElementById("view-record-edit")?.addEventListener("click",()=>{
    closeModal();
    openConsultationForm(STUDENTS.find(s=>s.id===c.studentId)||{id:c.studentId,name:c.studentName},c);
  });
}

function printConsultation(c){
  const rows=consultationRows(c);
  openModal(`<div class="modal-head"><h3>Patient Visit Slip</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div><div class="modal-body" id="print-area"><div style="text-align:center;margin-bottom:16px"><h3 style="font-size:16px">${escapeHtml(state.settings.clinicName)}</h3><div style="font-size:12px;color:var(--ink-soft)">School Clinic — Patient Visit Slip</div></div><table style="width:100%;font-size:12.5px">${rows.map(r=>`<tr><td style="color:var(--ink-soft);width:36%;vertical-align:top">${escapeHtml(r[0])}</td><td>${escapeHtml(r[1]||"—")}</td></tr>`).join("")}</table></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button><button class="btn btn-dark" onclick="window.print()">${ICONS.print} Print</button></div>`);
}

function renderConsultHistory(){
  const rawQ=document.getElementById("ch-search")?.value||"",q=rawQ.toLowerCase(),status=document.getElementById("ch-status")?.value||"";
   let list=CONSULTATIONS.filter(c=>(!q||[c.studentName,c.studentId,c.complaint,c.id,c.nurse,c.diagnosis,c.outcome,c.versionOf,c.supersededBy].join(" ").toLowerCase().includes(q))&&(!status||(status==="Deleted"?c.deleted:!c.deleted&&(status==="Superseded"?c.status==="Superseded":c.status===status)))).sort((a,b)=>(a.date+a.time<b.date+b.time?1:-1));
  const totalPages=Math.max(1,Math.ceil(list.length/8));if(state.consultPage>totalPages)state.consultPage=totalPages;const items=list.slice((state.consultPage-1)*8,state.consultPage*8);
    const rows=items.length?items.map(c=>`<tr><td class="mono">${c.id}</td><td>${fmtDate(c.date)}<br><span style="color:var(--ink-soft);font-size:11.5px">${escapeHtml(c.time)}</span></td><td>${escapeHtml(c.studentName)}<br><span style="color:var(--ink-soft);font-size:11.5px">${escapeHtml(c.studentId)}</span></td><td>${escapeHtml(c.complaint)}</td><td>${escapeHtml(c.nurse)}</td><td>${escapeHtml(c.outcome||"—")}</td><td>${c.deleted?'<span class="chip chip-void">Deleted</span>':c.status==="Superseded"?'<span class="chip chip-low">Superseded</span>':'<span class="chip chip-available">Active</span>'}</td><td><div class="row-actions"><button class="mini-btn" data-view-consult="${c.id}" title="View clinical record">${ICONS.search}</button><button class="mini-btn" data-print="${c.id}" title="Print">${ICONS.print}</button>${c.deleted?`<button class="mini-btn good" data-restore-consult="${c.id}">${ICONS.restore}</button>`:c.status==="Superseded"?"":`<button class="mini-btn" data-edit-consult="${c.id}" title="Edit visit record">${ICONS.edit}</button><button class="mini-btn danger" data-del-consult="${c.id}">${ICONS.trash_sm}</button>`}</div></td></tr>`).join(""):`<tr><td colspan="8">${emptyState("No patient visits match your filters.")}</td></tr>`;
   return `<div class="card"><div class="toolbar"><div class="search-box"><span class="ic">${ICONS.search}</span><input id="ch-search" value="${escapeHtml(rawQ)}" placeholder="Search visits, patient, reason, nurse, or record ID..."></div><select class="select-sm" id="ch-status"><option value="">All Status</option><option ${status==="Active"?"selected":""}>Active</option><option ${status==="Superseded"?"selected":""}>Superseded</option><option ${status==="Deleted"?"selected":""}>Deleted</option></select></div><div class="table-wrap"><table><thead><tr><th>Record</th><th>Date</th><th>Patient</th><th>Reason</th><th>Nurse</th><th>Outcome</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="pagination"><span>Page ${state.consultPage} of ${totalPages} · ${list.length} records</span><div class="page-btns"><button data-page="prev">${ICONS.chevleft}</button><button data-page="next">${ICONS.chevright}</button></div></div></div>`;
}

function bindConsultHistory(){
  const rerender=()=>{const a=document.activeElement,id=a?.id,pos=a?.selectionStart;document.getElementById("consult-body").innerHTML=renderConsultHistory();bindConsultHistory();const n=id&&document.getElementById(id);if(n){n.focus();if(pos!==undefined)n.setSelectionRange(pos,pos);}};
  document.getElementById("ch-search")?.addEventListener("input",rerender);document.getElementById("ch-status")?.addEventListener("change",rerender);
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{state.consultPage+=b.dataset.page==="next"?1:-1;if(state.consultPage<1)state.consultPage=1;rerender();});
   document.querySelectorAll("[data-view-consult]").forEach(b=>b.onclick=()=>viewConsultation(CONSULTATIONS.find(c=>c.id===b.dataset.viewConsult)));
  document.querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printConsultation(CONSULTATIONS.find(c=>c.id===b.dataset.print)));
  document.querySelectorAll("[data-edit-consult]").forEach(b=>b.onclick=()=>{const c=CONSULTATIONS.find(x=>x.id===b.dataset.editConsult);openConsultationForm(STUDENTS.find(s=>s.id===c.studentId)||{id:c.studentId,name:c.studentName},c);});
  document.querySelectorAll("[data-del-consult]").forEach(b=>b.onclick=()=>{const c=CONSULTATIONS.find(x=>x.id===b.dataset.delConsult);confirmDialog({title:"Delete this patient visit?",msg:`Record <b>${c.id}</b> will be moved to Deleted Records and can be restored later.`,okLabel:"Delete Record",onConfirm:()=>{c.deleted=true;logAudit(`Record Deleted — Patient Visit ${c.id}`,"Patient Visits","Warning");saveToClinicState();toast("Visit deleted",`Record ${c.id} moved to Deleted Records.`,"warn");rerender();}});});
  document.querySelectorAll("[data-restore-consult]").forEach(b=>b.onclick=()=>{const c=CONSULTATIONS.find(x=>x.id===b.dataset.restoreConsult);c.deleted=false;logAudit(`Record Restored — Patient Visit ${c.id}`,"Patient Visits");saveToClinicState();rerender();});
}

function renderConsultTabBody(){const body=document.getElementById("consult-body");if(state.consultTab==="search"){body.innerHTML=renderConsultSearchTab();bindConsultSearch();}else{body.innerHTML=renderConsultHistory();bindConsultHistory();}}