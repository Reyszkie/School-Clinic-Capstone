/* ================= PATIENTS & CLINICAL VISITS ================= */
function renderConsultation() {
  return `<div class="subtabs">
    <button class="subtab ${state.consultTab === "search" ? "active" : ""}" data-ctab="search">Find a Patient</button>
    <button class="subtab ${state.consultTab === "history" ? "active" : ""}" data-ctab="history">Visit History</button>
  </div><div id="consult-body"></div>`;
}

function renderConsultSearchTab() {
  return `<div class="card"><div class="toolbar">
    <div class="search-box"><span class="ic">${ICONS.search}</span><input id="stu-search" type="text" placeholder="Search by patient name, institutional category, or year/grade..."></div>
    <select class="select-sm patient-level-filter" id="stu-department-filter" aria-label="Filter by education level">
      <option value="">All education levels</option>
      <option value="College" ${state.departmentFilter === "College" ? "selected" : ""}>College</option>
      <option value="Senior High School" ${state.departmentFilter === "Senior High School" ? "selected" : ""}>Senior High School</option>
      <option value="Junior High School" ${state.departmentFilter === "Junior High School" ? "selected" : ""}>Junior High School</option>
      <option value="Elementary" ${state.departmentFilter === "Elementary" ? "selected" : ""}>Elementary</option>
      <option value="Kindergarten" ${state.departmentFilter === "Kindergarten" ? "selected" : ""}>Kindergarten</option>
      <option value="Campus Personnel" ${state.departmentFilter === "Campus Personnel" ? "selected" : ""}>Campus Personnel</option>
    </select>
    <select class="select-sm hidden" id="stu-course-filter"><option value="">All Institutional Categories</option>${courseOptionsHtml("")}</select>
    <button class="btn btn-teal" id="add-student-btn">${ICONS.plus} Add New Patient</button>
  </div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Institutional Category</th><th>Year / Personnel Type</th><th>Sex</th><th></th></tr></thead>
    <tbody id="stu-tbody"></tbody></table></div></div>`;
}

function studentTableRows(list) {
  if (!list.length)
    return `<tr><td colspan="5">${emptyState("No patients found. Try a different search term.")}</td></tr>`;
  return list
    .slice(0, 12)
    .map(
      (s) => `<tr><td>${escapeHtml(s.name)}</td>
    <td>${escapeHtml(s.institutionalCategory || s.course || "—")}</td><td>${escapeHtml(s.personnelType || s.year || "—")}</td><td>${escapeHtml(s.gender || s.sex || "—")}</td>
    <td><div class="row-actions"><button class="btn" style="padding:6px 12px;" data-select-stu="${escapeHtml(s.id)}">Select</button>
    ${canDeleteClinicRecords() ? `<button class="mini-btn danger" data-del-stu="${escapeHtml(s.id)}" title="Delete">${ICONS.trash_sm}</button>` : ""}</div></td></tr>`,
    )
    .join("");
}

function studentClinicalVisits(student) {
  return clinicPatientVisitHistory(student.id);
}

function renderStudentClinicalRecords(student) {
  const visits = studentClinicalVisits(student);
  const rows = visits.length
    ? visits
        .map((c) => {
          const note = c.remarks || "No additional notes";
          const reason =
            c.complaint === "Other" && c.reasonOther
              ? `Other: ${c.reasonOther}`
              : c.complaint || "Other";
          return `<tr><td>${fmtDate(c.date)}<br><span class="record-time">${escapeHtml(c.time || "")}</span></td>
      <td><b>${escapeHtml(reason)}</b><br><span class="record-preview">${escapeHtml(note)}</span></td>
      <td>${escapeHtml(c.nurse || "—")}</td><td><span class="chip ${c.status === "Superseded" ? "chip-low" : "chip-available"}">${escapeHtml(c.status === "Superseded" ? "Revised" : c.outcome || "Active")}</span></td>
      <td><div class="row-actions"><button class="btn records-view-button" data-view-student-consult="${escapeHtml(c.id)}">View Records</button>
      ${c.status === "Superseded" ? "" : `<button class="mini-btn" data-edit-student-consult="${escapeHtml(c.id)}" title="Edit Patient Visit">${ICONS.edit}</button>`}</div></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="5"><div class="clinical-empty"><b>No clinical visits recorded yet.</b><span>Clinical visit records will appear here when available.</span></div></td></tr>`;

  return `<div class="student-records"><div class="student-records-head"><div><h4>Clinical Visit Records</h4>
    <p>${visits.length ? `${visits.length} recorded visit${visits.length === 1 ? "" : "s"} for this patient.` : "This patient's clinical history will appear here."}</p></div>
    <span class="record-count">${visits.length}</span></div>
    <div class="table-wrap"><table class="clinical-records-table"><thead><tr><th>Date</th><th>Reason for Visit</th><th>Nurse</th><th>Outcome</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}

function patientAllergyStatus(value) {
  const allergy = String(value || "").trim();
  const normalized = allergy.toLowerCase();
  if (
    !allergy ||
    ["none recorded", "not specified", "not yet assessed", "unknown"].includes(
      normalized,
    )
  )
    return { status: "unassessed", detail: "" };
  if (
    [
      "no",
      "none",
      "none known",
      "no known allergy",
      "no known allergies",
      "no allergies",
      "nka",
    ].includes(normalized)
  )
    return { status: "none", detail: "" };
  return { status: "allergies", detail: allergy };
}

function renderStudentDetail(s, inModal = false) {
  const displayName =
    s.name ||
    [s.lastName, s.firstName, s.middleInitial].filter(Boolean).join(", ");
  const initials = displayName
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  const latestVisit = studentClinicalVisits(s).find(
    (visit) => visit.status !== "Superseded",
  );
  return `<div class="${inModal ? "student-detail-content" : "card"}" ${inModal ? "" : 'style="margin-top:16px;"'}><div class="student-card">
    <div class="s-avatar">${escapeHtml(initials)}</div><div style="flex:1"><h3 style="font-size:19px">${escapeHtml(displayName)}</h3>
      <div style="color:var(--ink-soft);font-size:13px;margin-top:2px">${escapeHtml(s.institutionalCategory || s.course || "—")}</div></div>
    <button class="btn" id="edit-student-profile-btn">${ICONS.edit} Edit Profile</button>
    <button class="btn btn-teal" id="new-student-visit-btn">${ICONS.plus} New Patient Visit</button>
    ${canDeleteClinicRecords() ? `    ${canDeleteClinicRecords() ? `<button class="btn btn-outline-red" id="delete-student-btn">${ICONS.trash_sm} Delete Patient</button>` : ""}` : ""}
  </div><div class="info-grid">
    <div class="info-cell"><div class="lbl">Sex</div><div class="val">${escapeHtml(s.gender || s.sex || "—")}</div></div>
    <div class="info-cell"><div class="lbl">Parent / Guardian</div><div class="val">${escapeHtml(s.guardianName || s.emergency || "—")}</div></div>
    <div class="info-cell"><div class="lbl">Guardian Contact</div><div class="val mono">${escapeHtml(s.guardianContact || "—")}</div></div>
    <div class="info-cell" style="grid-column:span 2"><div class="lbl">Institutional Category</div><div class="val">${escapeHtml(s.institutionalCategory || s.course || "—")}</div></div>
    <div class="info-cell" style="grid-column:span 2"><div class="lbl">${(s.institutionalCategory || s.course) === "Campus Personnel" ? "Personnel Type" : "Year Level"}</div><div class="val">${escapeHtml(s.personnelType || s.year || "—")}</div></div>
  </div>${renderStudentClinicalRecords(s)}</div>`;
}

function filterStudents() {
  const q = (document.getElementById("stu-search").value || "").toLowerCase();
  const course = document.getElementById("stu-course-filter").value;
  const department =
    document.getElementById("stu-department-filter").value || "";
  return activeClinicPatients().filter((s) => {
    const category = s.institutionalCategory || s.course,
      year = s.personnelType || s.year;
    const searchable = [s.name, category, year, s.lastName, s.firstName]
      .join(" ")
      .toLowerCase();
    return (
      (!q || searchable.includes(q)) &&
      (!course || category === course) &&
      (!department || educationGroupFor(category, year) === department)
    );
  });
}

function bindConsultSearch() {
  const run = () => {
    document.getElementById("stu-tbody").innerHTML =
      studentTableRows(filterStudents());
    bindSelectButtons();
  };
  document.getElementById("stu-search").oninput = run;
  document.getElementById("stu-course-filter").onchange = run;
  document.getElementById("stu-department-filter").onchange = (event) => {
    state.departmentFilter = event.target.value;
    state.selectedStudent = null;
    run();
  };
  document.getElementById("add-student-btn").onclick = () => openStudentForm();
  run();
}

function openStudentForm(existing = null, returnToDetails = false) {
  let isEdit = !!existing;
  let editingStudent = existing;
  const f = existing || {
    lastName: "",
    firstName: "",
    middleInitial: "",
    course: "",
    year: "",
    gender: "",
    guardianName: "",
    guardianContact: "",
    symptoms: [],
  };
  const selectedCategory = f.institutionalCategory || f.course || "";
  const selectedYear = f.personnelType || f.year || "";
  const legacyCategoryOption =
    isEdit &&
    selectedCategory &&
    !COURSES.includes(selectedCategory) &&
    selectedCategory !== "Campus Personnel"
      ? `<option selected>${escapeHtml(selectedCategory)}</option>`
      : "";
  const knownYears =
    selectedCategory === "Campus Personnel"
      ? PERSONNEL_TYPES
      : YEAR_LEVEL_GROUPS.flatMap((group) => group.options);
  const legacyYearOption =
    isEdit && selectedYear && !knownYears.includes(selectedYear)
      ? `<option selected>${escapeHtml(selectedYear)}</option>`
      : "";
  const yearOptions = yearOptionsForCategoryHtml(selectedCategory, selectedYear);
  const yearOptionsWithLegacy =
    legacyYearOption && selectedCategory
      ? yearOptions.replace(
          `</option>`,
          `</option>${legacyYearOption}`,
        )
      : yearOptions;
  const parts = (f.name || "").split(",");
  const lastName = f.lastName || parts[0] || "";
  const firstName = f.firstName || (parts[1] || "").trim().split(" ")[0] || "";
  const html = `<div class="modal-head"><h3 id="student-form-title">${isEdit ? (returnToDetails ? "Edit Profile" : "Edit Patient") : "Add New Patient"}</h3><button class="modal-close" onclick="closeModal()" aria-label="Close patient form">${ICONS.x}</button></div>
  <div class="modal-body"><form class="form-grid" id="stu-form">
    <div class="f-field"><label>Last Name <span class="req">*</span></label><input id="sf-lastname" value="${escapeHtml(lastName)}" required></div>
    <div class="f-field"><label>Given Name <span class="req">*</span></label><input id="sf-firstname" value="${escapeHtml(firstName)}" required></div>
    <div class="f-field"><label>Middle Initial</label><input id="sf-middle" maxlength="3" value="${escapeHtml(f.middleInitial || "")}" placeholder="M.I."></div>
    <div class="f-field full"><label>Institutional Category <span class="req">*</span></label><select id="sf-category" required><option value="">Select Institutional Category</option>${legacyCategoryOption}${courseOptionsHtml(selectedCategory)}</select></div>
    <div class="f-field"><label id="sf-year-label">${selectedCategory === "Campus Personnel" ? "Personnel Type" : "Year Level"} <span class="req">*</span></label><select id="sf-year" required>${yearOptionsWithLegacy}</select></div>
    <div class="f-field"><label>Sex</label><select id="sf-gender"><option value="">Select Sex</option>${["Male", "Female"].map((g) => `<option ${f.gender === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
    <div class="f-field"><label>Parent / Guardian Name</label><input id="sf-guardian" value="${escapeHtml(f.guardianName || f.emergency || "")}"></div>
    <div class="f-field full"><label for="sf-guardian-contact">Parent / Guardian Contact <span class="req">*</span></label><input id="sf-guardian-contact" type="text" inputmode="numeric" pattern="[0-9]{11}" minlength="11" autocomplete="tel-national" required aria-describedby="sf-guardian-contact-error" aria-invalid="false" value="${escapeHtml(f.guardianContact || "")}" placeholder="09XXXXXXXXX"><div class="field-error hidden" id="sf-guardian-contact-error" role="alert"></div></div>
  </form></div><div class="modal-foot"><span class="form-save-status" id="sf-status" aria-live="polite"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-dark" id="sf-save">${ICONS.check} ${isEdit ? "Save Changes" : "Save Patient"}</button></div>`;
  openModal(html, "patient-form-modal");
  const categorySelect = document.getElementById("sf-category"),
    yearSelect = document.getElementById("sf-year");
  const syncCategoryFields = (resetYear = false) => {
    const personnel = categorySelect.value === "Campus Personnel";
    document.getElementById("sf-year-label").innerHTML =
      `${personnel ? "Personnel Type" : "Year Level"} <span class="req">*</span>`;
    yearSelect.innerHTML = yearOptionsForCategoryHtml(
      categorySelect.value,
      resetYear ? "" : yearSelect.value,
    );
  };
  categorySelect.addEventListener("change", () => syncCategoryFields(true));
  const guardianContact = document.getElementById("sf-guardian-contact");
  const guardianContactError = document.getElementById(
    "sf-guardian-contact-error",
  );
  let guardianContactTouched = Boolean(guardianContact.value);
  const updateGuardianContactValidity = () => {
    const unchangedLegacyContact =
      isEdit &&
      guardianContact.value === String(f.guardianContact || "") &&
      !/^\d{11}$/.test(guardianContact.value);
    const valid = /^\d{11}$/.test(guardianContact.value) || unchangedLegacyContact;
    guardianContact.setCustomValidity(
      valid ? "" : "Enter exactly 11 digits using numbers only.",
    );
    guardianContact.setAttribute(
      "aria-invalid",
      String(guardianContactTouched && !valid),
    );
    guardianContactError.textContent = valid
      ? ""
      : guardianContact.value
        ? "Enter exactly 11 digits using numbers only."
        : "Parent / Guardian Contact is required.";
    guardianContactError.classList.toggle(
      "hidden",
      valid || !guardianContactTouched,
    );
    return valid;
  };
  guardianContact.addEventListener("input", () => {
    guardianContactTouched = true;
    guardianContact.value = guardianContact.value
      .replace(/\D/g, "")
      .slice(0, 11);
    updateGuardianContactValidity();
  });
  updateGuardianContactValidity();
  let patientSaveInProgress=false;
  document.getElementById("sf-save").onclick=async()=>{
    if(patientSaveInProgress)return;
    const last=document.getElementById("sf-lastname").value.trim(), first=document.getElementById("sf-firstname").value.trim(), middle=document.getElementById("sf-middle").value.trim();
    if(!last||!first){toast("Missing information","Last name and given name are required.","err");return;}
    const symptoms=selectedChecks('[data-check-group="patient-symptom"]');
    const symptomOther=document.querySelector('[data-free-text="patient-symptom-other"]')?.value.trim();
    if(symptomOther)symptoms.push(`Other: ${symptomOther}`);
    guardianContactTouched=true;
    updateGuardianContactValidity();
    if(!document.getElementById("stu-form").reportValidity())return;
    const course=categorySelect.value,year=yearSelect.value;
    const name=`${last}, ${first}${middle?" "+middle.replace(/\.$/,"")+"." : ""}`;
    if(!updateGuardianContactValidity()){guardianContact.focus();toast("Invalid contact number","Enter exactly 11 digits using numbers only.","err");return;}
    const rec={...f,id:isEdit?editingStudent.id:newPatientRecordId(),name,lastName:last,firstName:first,middleInitial:middle,course,institutionalCategory:course,year,personnelType:course==="Campus Personnel"?year:null,gender:document.getElementById("sf-gender").value,sex:document.getElementById("sf-gender").value,guardianName:document.getElementById("sf-guardian").value,guardianContact:guardianContact.value,emergency:document.getElementById("sf-guardian").value,allergies:f.allergies||"Not Yet Assessed",conditions:f.conditions||"None",symptoms:Array.isArray(f.symptoms)?f.symptoms:symptoms};
    const wasEdit=isEdit,index=wasEdit?STUDENTS.findIndex(s=>s.id===editingStudent.id):-1,previous=index>=0?STUDENTS[index]:null;
    const previousVisits=CONSULTATIONS.map(visit=>({visit,studentName:visit.studentName,course:visit.course,year:visit.year}));
    const saveButton=document.getElementById("sf-save"),saveLabel=saveButton.innerHTML;patientSaveInProgress=true;saveButton.disabled=true;saveButton.innerHTML='<span class="button-spinner"></span> Saving...';
    let saved=false;
    try{
      if(!wasEdit){
        const registration=await registerPatientProfile(rec);
        if(registration.status==="possible_matches"){
          showPatientMatchOptions(rec,registration.matches);
          return;
        }
        if(registration.status!=="created")throw new Error("Patient registration could not be completed.");
        saved=await saveRegisteredPatient(registration.patient||rec);
      }else{
        saved=await commitClinicRecordMutation({
          apply:()=>{
            if(index<0)throw new Error("This patient record is no longer available.");
            STUDENTS[index]={...previous,...rec};
            const updated=STUDENTS[index];
            CONSULTATIONS.forEach(visit=>{if(visit.studentId===updated.id){visit.studentName=updated.name;visit.course=updated.course;visit.year=updated.year;}});
            editingStudent=updated;state.selectedStudent=updated;
          },
          rollback:()=>{
            if(previous){
              STUDENTS[index]=previous;
              previousVisits.forEach(row=>Object.assign(row.visit,{studentName:row.studentName,course:row.course,year:row.year}));
              editingStudent=previous;state.selectedStudent=previous;
            }
          },
          auditAction:`Patient Record Updated — ${rec.id}`,module:"Patients",detail:rec.id,successTitle:"Patient updated",successMessage:`${rec.name}'s record has been updated.`,refresh:renderConsultTabBody,
        });
      }
    }catch(error){toast("Patient not saved",error.message||"Unable to register this patient.","err");}
    finally{patientSaveInProgress=false;if(saveButton.isConnected){saveButton.disabled=false;saveButton.innerHTML=saveLabel;}}
    if(saved){
      closeModal();
      if(wasEdit&&returnToDetails){
        const updated=STUDENTS.find(patient=>patient.id===rec.id)||rec;
        const detailsModal=modalStack.find(backdrop=>backdrop.querySelector("#student-detail-modal-title"));
        const detailsBody=detailsModal?.querySelector(".modal-body");
        if(detailsBody){detailsBody.innerHTML=renderStudentDetail(updated,true);bindStudentDetailActions(updated,detailsModal);}
      }
    }
  };
}

function newPatientRecordId() {
  let id;
  do {
    const uniqueId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    id = `PT-${uniqueId}`;
  } while (
    STUDENTS.some((patient) => patient.id === id) ||
    DELETED_STUDENTS.some((patient) => patient.id === id)
  );
  return id;
}

async function registerPatientProfile(patient,confirmedDistinctIds=[],selectedPatientId=null){
  const response=await fetch("/api/patients/register",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({patient,confirmedDistinctIds,selectedPatientId}),
  });
  const result=await response.json().catch(()=>({}));
  if(response.status===409&&result.status==="possible_matches")return result;
  if(!response.ok)throw new Error(result.message||`Patient registration returned ${response.status}.`);
  return result;
}

async function saveRegisteredPatient(patient){
  const record=patient||{};
  let saved=false;
  saved=await commitClinicRecordMutation({
    apply:()=>{
      if(STUDENTS.some(existing=>existing.id===record.id))throw new Error("This patient profile is already active. Refresh the patient list before continuing.");
      STUDENTS.unshift(record);state.selectedStudent=record;
    },
    rollback:()=>{
      const index=STUDENTS.findIndex(existing=>existing.id===record.id);
      if(index>=0)STUDENTS.splice(index,1);
      state.selectedStudent=null;
    },
    save:()=>Promise.resolve(),
    auditAction:`Patient Added — ${record.id}`,module:"Patients",detail:record.id,
    successTitle:"Patient added",successMessage:`Welcome, ${record.name}! Added to patient records.`,
    refresh:renderConsultTabBody,
  });
  if(saved)closeModal();
  return saved;
}

function showPatientMatchOptions(patient,matches){
  closeModal();
  const candidateRows=matches.map(match=>{
    const category=match.institutionalCategory||match.course||"—";
    const year=match.personnelType||match.year||"—";
    const middle=match.middleInitial?` · M.I. ${escapeHtml(match.middleInitial)}`:"";
    const visitStatus=match.hasVisits?"Previous visits on file":"No previous visits on file";
    const matchedOn=[match.nameMatches?"name":null,match.guardianContactMatches?"guardian contact":null].filter(Boolean).join(" and ");
    return `<article class="card" style="margin:10px 0;padding:14px"><div style="font-weight:700">${escapeHtml(match.name||"Patient profile")}${middle}</div><div style="font-size:12px;color:var(--ink-soft);margin:5px 0 10px">${escapeHtml(category)} · ${escapeHtml(year)} · ${visitStatus} · Profile ${escapeHtml(match.id)}${matchedOn?` · Matched on ${escapeHtml(matchedOn)}`:""}</div><button class="btn btn-teal" type="button" data-use-patient-profile="${escapeHtml(match.id)}">Use this profile and proceed to New Patient Visit</button></article>`;
  }).join("");
  openModal(`<div class="modal-head"><h3>Possible Existing Patient</h3><button class="modal-close" onclick="closeModal()" aria-label="Close possible patient matches">${ICONS.x}</button></div>
    <div class="modal-body"><p>Possible matches were found by patient name and/or parent or guardian contact. Similar names and shared contact numbers can belong to different people, so review the details and confirm the correct profile. Selecting a profile will open New Patient Visit without changing the patient's details or previous visits.</p>${candidateRows}</div>
    <div class="modal-foot"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn" type="button" id="create-distinct-patient">These are different people — create a separate profile</button></div>`,"lg");
  document.querySelectorAll("[data-use-patient-profile]").forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    try{
      const result=await registerPatientProfile(null,[],button.dataset.usePatientProfile);
      if(result.status!=="selected")throw new Error("That patient profile is no longer active. Refresh the patient list and try again.");
      const selected=result.patient;
      const localIndex=STUDENTS.findIndex(record=>record.id===selected.id);
      const deletedIndex=DELETED_STUDENTS.findIndex(record=>record.id===selected.id);
      if(deletedIndex>=0)DELETED_STUDENTS.splice(deletedIndex,1);
      if(localIndex>=0)STUDENTS[localIndex]={...STUDENTS[localIndex],...selected};
      else STUDENTS.unshift(selected);
      const existing=localIndex>=0?STUDENTS[localIndex]:selected;
      closeModal();
      toast("Existing patient found","This patient already has a profile. Proceed to New Patient Visit; no duplicate profile will be created.","warn");
      openConsultationForm(existing);
    }catch(error){button.disabled=false;toast("Unable to open patient profile",error.message||"Refresh the patient list and try again.","err");}
  });
  const createButton=document.getElementById("create-distinct-patient");
  createButton.onclick=async()=>{
    if(createButton.disabled)return;
    createButton.disabled=true;
    createButton.innerHTML='<span class="button-spinner"></span> Checking...';
    try{
      const result=await registerPatientProfile(patient,matches.map(match=>match.id));
      if(result.status==="possible_matches"){
        showPatientMatchOptions(patient,result.matches);
        return;
      }
      if(result.status!=="created")throw new Error("Patient registration could not be completed.");
      await saveRegisteredPatient(result.patient||patient);
    }catch(error){
      createButton.disabled=false;
      createButton.textContent="These are different people — create a separate profile";
      toast("Patient not saved",error.message||"Unable to register this patient.","err");
    }
  };
}

function bindSelectButtons(){
  document.querySelectorAll("[data-select-stu]").forEach(b=>b.onclick=()=>openStudentDetailModal(STUDENTS.find(s=>s.id===b.dataset.selectStu)));
  document.querySelectorAll("[data-del-stu]").forEach(b=>b.onclick=()=>deleteStudent(STUDENTS.find(s=>s.id===b.dataset.delStu)));
}

function openStudentDetailModal(student) {
  if (!student) return;
  state.selectedStudent = student;
  logAudit(
    `Patient Details Viewed — ${student.id}`,
    "Patients",
    "Success",
    false,
  );
  openModal(
    `<div class="modal-head"><h3 id="student-detail-modal-title">Patient Details</h3><button class="modal-close" onclick="closeModal()" aria-label="Close patient details">${ICONS.x}</button></div><div class="modal-body">${renderStudentDetail(student, true)}</div>`,
    "patient-detail-modal",
    { closeOnBackdrop: true },
  );
  bindStudentDetailActions(student, modalStack[modalStack.length - 1]);
}

function bindStudentDetailActions(student, root = document) {
  const find = (selector) => root.querySelector(selector);
  const editProfile = find("#edit-student-profile-btn");
  if (editProfile) editProfile.onclick = () => openStudentForm(student, true);
  const newVisit = find("#new-student-visit-btn");
  if (newVisit)
    newVisit.onclick = () => {
      closeModal();
      openConsultationForm(student);
    };
  const del = find("#delete-student-btn");
  if (del)
    del.onclick = () => {
      closeModal();
      deleteStudent(student);
    };
  root.querySelectorAll("[data-view-student-consult]").forEach(
    (button) =>
      (button.onclick = () => {
        const visit = CONSULTATIONS.find(
          (record) => record.id === button.dataset.viewStudentConsult,
        );
        closeModal();
        viewConsultation(visit);
      }),
  );
  root.querySelectorAll("[data-edit-student-consult]").forEach(
    (button) =>
      (button.onclick = () => {
        const visit = CONSULTATIONS.find(
          (record) => record.id === button.dataset.editStudentConsult,
        );
        closeModal();
        if (visit) openConsultationForm(student, visit);
      }),
  );
}

function deleteStudent(s) {
  if (!s || !canDeleteClinicRecords()) return;
  confirmDialog({
    title: "Delete this patient?",
    msg: `<b>${escapeHtml(s.name)}</b> will be moved to Deleted Records and can be restored later.`,
    okLabel: "Delete Patient",
    onConfirm: async () => {
      const index = STUDENTS.findIndex((x) => x.id === s.id);
      if (index < 0) return;
      const deleted = {
        ...s,
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: state.currentUser?.name || "System",
      };
      await commitClinicRecordMutation({
        apply: () => {
          STUDENTS.splice(index, 1);
          DELETED_STUDENTS = DELETED_STUDENTS.filter((x) => x.id !== s.id);
          DELETED_STUDENTS.unshift(deleted);
          if (state.selectedStudent?.id === s.id) state.selectedStudent = null;
        },
        rollback: () => {
          DELETED_STUDENTS = DELETED_STUDENTS.filter((x) => x.id !== s.id);
          STUDENTS.splice(index, 0, s);
        },
        auditAction: `Record Deleted — Patient ${s.id}`,
        module: "Patients",
        status: "Warning",
        detail: s.id,
        successTitle: "Patient deleted",
        successMessage: `${s.name} moved to Deleted Records.`,
        refresh: renderConsultTabBody,
      });
    },
  });
}

function optionListHtml(options, selected = [], group = "option") {
  return `<div class="option-grid">${options.map((o) => `<label class="option-check"><input type="checkbox" data-check-group="${group}" data-check="${escapeHtml(o)}" ${selected.includes(o) ? "checked" : ""}><span>${escapeHtml(o)}</span></label>`).join("")}</div>`;
}
function selectedChecks(selector) {
  return [...document.querySelectorAll(selector + ":checked")].map(
    (x) => x.dataset.check,
  );
}
function bindOptionFreeText(group, initialValue = "") {
  const checkbox = document.querySelector(`[data-free-text-toggle="${group}"]`),
    field = document.querySelector(`[data-free-text="${group}"]`);
  if (!checkbox || !field) return;
  const update = () => {
    field.classList.toggle("hidden", !checkbox.checked);
    if (!checkbox.checked) field.value = "";
  };
  checkbox.addEventListener("change", update);
  field.value = initialValue || "";
  update();
  return update;
}

function visitInventoryCard({
  id,
  label,
  items,
  selected,
  quantityId,
  quantity,
  unitForItem,
  availableForItem,
  multiple = false,
}) {
  const itemKey = (item) => item.code || item.id || item.name;
  const selectedKeys = multiple
    ? Array.isArray(selected)
      ? selected
      : [selected]
    : [selected];
  const selectedItems = items.filter(
    (item) =>
      selectedKeys.includes(itemKey(item)) || selectedKeys.includes(item.name),
  );
  const stockText = selectedItems.length
    ? `Available Stock: ${selectedItems.map((item) => `${item.name} ${availableForItem(item)} ${unitForItem(item)}`).join("; ")}`
    : "Available Stock: Select an item";
  return `<section class="visit-inventory-card">
    <div class="visit-inventory-heading"><label for="${id}">${label}</label>
      <select id="${id}" aria-label="${label}" ${multiple ? 'multiple size="4"' : ""}>${multiple ? "" : '<option value="">None</option>'}${items.map((item) => `<option value="${escapeHtml(itemKey(item))}" ${selectedKeys.includes(itemKey(item)) || selectedKeys.includes(item.name) ? "selected" : ""} ${item.deleted || item.unavailable || (availableForItem(item) < 1 && !selectedKeys.includes(itemKey(item)) && !selectedKeys.includes(item.name)) ? "disabled" : ""}>${escapeHtml(item.name)}${item.deleted || item.unavailable ? " (Unavailable — historical record)" : ""}</option>`).join("")}</select>
      <span class="visit-inventory-stock" id="${id}-stock" aria-live="polite">${stockText}</span>
    </div>
    <div class="visit-inventory-quantity"><label for="${quantityId}">Treatment Quantity</label><div class="visit-quantity-control">
      <input id="${quantityId}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="10" value="${Math.max(0, Number(quantity) || 0)}" aria-label="${label} treatment quantity" autocomplete="off">
    </div></div><div class="field-error hidden" id="${quantityId}-error" role="alert"></div>
  </section>`;
}

function bindVisitInventoryCard({
  id,
  quantityId,
  items,
  unitForItem,
  availableForItem,
  defaultQuantity = 1,
  multiple = false,
}) {
  const select = document.getElementById(id),
    quantity = document.getElementById(quantityId),
    stock = document.getElementById(`${id}-stock`);
  if (!select || !quantity || !stock) return;
  const error = document.getElementById(`${quantityId}-error`);
  const update = () => {
    const selectedItems = multiple
      ? [...select.selectedOptions]
          .map((option) =>
            items.find(
              (candidate) =>
                (candidate.code || candidate.id || candidate.name) ===
                  option.value || candidate.name === option.value,
            ),
          )
          .filter(Boolean)
      : [
          items.find(
            (candidate) =>
              (candidate.code || candidate.id || candidate.name) ===
                select.value || candidate.name === select.value,
          ),
        ].filter(Boolean);
    const available = selectedItems.length
      ? Math.min(...selectedItems.map(availableForItem))
      : 0;
    stock.textContent = selectedItems.length
      ? `Available Stock: ${selectedItems.map((item) => `${item.name} ${availableForItem(item)} ${unitForItem(item)}`).join("; ")}`
      : "Available Stock: Select an item";
    quantity.max = selectedItems.length ? String(available) : "";
    quantity.required = Boolean(selectedItems.length);
    const validQuantity = /^[1-9]\d*$/.test(quantity.value);
    const current = validQuantity ? Number(quantity.value) : 0;
    const invalid = Boolean(
      selectedItems.length &&
      (!validQuantity ||
        selectedItems.some((item) => current > availableForItem(item))),
    );
    quantity.setAttribute("aria-invalid", String(invalid));
    quantity.setCustomValidity(
      invalid
        ? validQuantity
          ? `Requested quantity exceeds available inventory stock.`
          : "Enter a positive whole-number quantity."
        : "",
    );
    error.textContent = invalid
      ? validQuantity
        ? `Requested quantity exceeds available inventory stock.`
        : "Enter a positive whole-number quantity."
      : "";
    error.classList.toggle("hidden", !invalid);
  };
  select.addEventListener("change", () => {
    quantity.value = String(defaultQuantity);
    update();
  });
  quantity.addEventListener("input", () => {
    quantity.value = quantity.value.replace(/\D/g, "");
    update();
  });
  update();
  return update;
}

function normalizeGuardianContacted(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "";
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (["not applicable", "not applical", "n/a", "na"].includes(normalized))
    return "Not Applicable";
  return "Not Applicable";
}

function openConsultationForm(student, existing = null) {
  if (!student) return;
  if (existing && existing.studentId !== student.id) {
    toast(
      "Visit does not match patient",
      "This visit belongs to a different patient and cannot be edited here.",
      "err",
    );
    return;
  }
  const isEdit = !!existing;
  let f;
  if (isEdit) {
    f = {
      ...existing,
      date: todayDateString(),
      time: currentTimeString(),
      nurse: state.currentUser.name,
      nurseId: state.currentUser.id,
      staffRecord: state.currentUser.name,
      position: state.currentUser.role || "Staff Nurse",
    };
  } else {
    f = {
      date: todayDateString(),
      time: currentTimeString(),
      nurse: state.currentUser.name,
      complaint: "",
      description: "",
      symptomStart: "",
      painLevel: "0 – No pain",
      painLocation: "",
      symptoms: [],
      knownConditions: "No",
      allergiesHistory: "",
      currentMedication: "No",
      previousSimilar: "No",
      lastMeal: "",
      weight: "",
      height: "",
      temp: "",
      bp: "",
      pulse: "",
      respiratoryRate: "",
      spo2: "",
      assessment: "Stable",
      assessmentOther: "",
      notes: "",
      interventions: [],
      supplyUsed: "",
      supplyQty: 1,
      equipmentUsed: [],
      equipmentQty: 1,
      treatmentGiven: "",
      dosage: "",
      outcome: "",
      releasedAt: "",
      remarks: "",
      guardianContacted: "",
      guardianMethod: "phone call",
      personContacted: "",
      staffRecord: state.currentUser.name,
      position: state.currentUser.role || "Staff Nurse",
      medicine: "",
      medQty: 1,
    };
  }
  if (isEdit && (f.medicine || f.medicineCode)) {
    const medicine = MEDICINES.find(
      (item) =>
        item.code === f.medicineCode ||
        item.name.trim().toLowerCase() ===
          String(f.medicine || "").trim().toLowerCase(),
    );
    if (!medicine || medicine.deleted || medicineIsExpired(medicine)) {
      f.medicine = "";
      f.medicineCode = null;
      f.medQty = 0;
    } else {
      f.medicine = medicine.name;
      f.medicineCode = medicine.code;
    }
  }
  if (isEdit && (f.supplyUsed || f.supplyItemId)) {
    const supply = EQUIPMENT.find(
      (item) =>
        item.category === "Medical Supplies" &&
        !item.deleted &&
        item.status === "Available" &&
        (item.id === f.supplyItemId ||
          item.name.trim().toLowerCase() ===
            String(f.supplyUsed || "").trim().toLowerCase()),
    );
    f.supplyUsed = supply?.name || "";
    f.supplyItemId = supply?.id || null;
    if (!supply) f.supplyQty = 0;
  }
  const allergyHistory = String(f.allergiesHistory || "");
  const allergyAnswer = /^yes\b/i.test(allergyHistory)
    ? "Yes"
    : /^no\b/i.test(allergyHistory)
      ? "No"
      : "";
  const reasonInputValue =
    f.complaint === "Other" ? f.reasonOther || "Other" : f.complaint || "";
  const contactedValue = normalizeGuardianContacted(f.guardianContacted);
  const returnedInventory = isEdit
    ? activeVisitInventoryTransactions(existing.id)
    : [];
  const existingSupply = f.supplyUsed || "";
  const returnedQuantity = (itemType, itemId) =>
    returnedInventory
      .filter((entry) => entry.itemType === itemType && entry.itemId === itemId)
      .reduce((total, entry) => total + Number(entry.quantity || 0), 0);
  const medicineAvailable = (item) =>
    (Number(item.qty) || 0) + returnedQuantity("medicine", item.code);
  const equipmentAvailable = (item) =>
    (Number(item.qty) || 0) + returnedQuantity("equipment", item.id);
  const selectedMedicine =
    MEDICINES.find(
      (item) => item.code === f.medicineCode || item.name === f.medicine,
    ) ||
    (isEdit && f.medicineCode
      ? {
          code: f.medicineCode,
          name: f.medicine || "Unavailable medicine",
          qty: 0,
          deleted: true,
        }
      : null);
  const selectedSupply = EQUIPMENT.find(
    (item) =>
      item.category === "Medical Supplies" &&
      !item.deleted &&
      item.status === "Available" &&
      (item.id === f.supplyItemId ||
        item.id === existingSupply ||
        item.name === existingSupply),
  );
  const meds = MEDICINES.filter(
    (item) =>
      !item.deleted &&
      !medicineIsExpired(item) &&
      (Number(item.qty) > 0 || item.code === selectedMedicine?.code),
  );
  if (selectedMedicine && !meds.includes(selectedMedicine))
    meds.push({ ...selectedMedicine, unavailable: true });
  const supplies = EQUIPMENT.filter(
    (item) =>
      item.category === "Medical Supplies" &&
      !item.deleted &&
      item.status === "Available" &&
      (equipmentAvailable(item) > 0 || item.id === selectedSupply?.id),
  );
  if (selectedSupply && !supplies.includes(selectedSupply))
    supplies.push({ ...selectedSupply, unavailable: true });
  const html = `<div class="modal-head"><h3>${isEdit ? "Record Follow-up Visit" : "New Patient Visit"} — ${escapeHtml(student.name)}</h3><button class="modal-close" onclick="closeModal()">${ICONS.x}</button></div>
  <div class="modal-body"><form id="consult-form" class="form-grid">
    <div class="f-field"><label>Visit Date <span class="req">*</span></label><input type="date" id="cf-date" value="${f.date}" required></div>
    <div class="f-field"><label>Visit Time <span class="req">*</span></label><input id="cf-time" value="${escapeHtml(f.time)}" required></div>
    <div class="f-field"><label>Nurse on Duty</label><input value="${escapeHtml(f.nurse || state.currentUser.name)}" readonly style="background:#F7FAFD"></div>
    <div class="f-field full"><label for="cf-complaint">Reason for Clinic Visit <span class="req">*</span></label><input id="cf-complaint" list="cf-reasons" value="${escapeHtml(reasonInputValue)}" maxlength="300" placeholder="Select or enter a reason" required><datalist id="cf-reasons">${COMPLAINTS.map((reason) => `<option value="${escapeHtml(reason)}">`).join("")}<option value="Other"></datalist></div>
    <div class="f-field"><label>When did symptoms start?</label><input id="cf-start" value="${escapeHtml(f.symptomStart || "")}" placeholder="e.g. this morning"></div>
    <div class="f-field"><label>Pain Level</label><select id="cf-pain">${["0 – No pain", "1–3 – Mild", "4–6 – Moderate", "7–9 – Severe", "10 – Worst possible pain"].map((x) => `<option ${f.painLevel === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    <div class="f-field full"><label>Medical History</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <label>Known Medical Conditions<select id="cf-conditions"><option>No</option><option ${f.knownConditions === "Yes" ? "selected" : ""}>Yes</option></select></label>
      <label><span>Allergies</span><select id="cf-allergies"><option value="">Not recorded</option><option value="Yes" ${allergyAnswer === "Yes" ? "selected" : ""}>Yes</option><option value="No" ${allergyAnswer === "No" ? "selected" : ""}>No</option></select></label>
      <label>Current Medication<select id="cf-current-med"><option>No</option><option ${f.currentMedication === "Yes" ? "selected" : ""}>Yes</option></select></label>
    </div></div>
    <div class="f-field full"><label>Vital Signs</label><div class="vital-signs-grid">
      <label>Body Temperature (°C)<input type="number" min="25" max="50" step="0.1" id="cf-temp" value="${escapeHtml(f.temp || "")}" placeholder="e.g. 36.8"></label>
      <label>Pulse Rate (Heart Rate, bpm)<input type="number" min="0" max="300" id="cf-pulse" value="${escapeHtml(f.pulse || "")}" placeholder="e.g. 72"></label>
      <label>Respiratory Rate (breaths/min)<input type="number" min="0" max="100" id="cf-respiratory-rate" value="${escapeHtml(f.respiratoryRate || "")}" placeholder="e.g. 16"></label>
      <label>Blood Pressure (BP, mmHg)<input id="cf-bp" value="${escapeHtml(f.bp || "")}" placeholder="110/70" aria-label="Blood pressure in millimeters of mercury"></label>
      <label>Oxygen Saturation (SpO2, %)<input type="number" min="0" max="100" id="cf-spo2" value="${escapeHtml(f.spo2 || "")}" placeholder="e.g. 98"></label>
      <input type="hidden" id="cf-weight" value="${escapeHtml(f.weight || "")}"><input type="hidden" id="cf-height" value="${escapeHtml(f.height || "")}">
    </div></div>
    <div class="f-field full"><label>Treatment / Intervention</label><div style="padding-top:5px">${optionListHtml(INTERVENTIONS, f.interventions || [], "intervention")}<label class="option-check"><input type="checkbox" id="cf-intervention-other" data-free-text-toggle="intervention-other" ${f.interventions?.some((x) => x === "Other" || x.startsWith("Other: ")) ? "checked" : ""}><span>Other</span></label><input class="option-free-text hidden" data-free-text="intervention-other" placeholder="Enter other intervention" value="${escapeHtml((f.interventions || []).find((x) => x.startsWith("Other: "))?.replace("Other: ", "") || "")}"></div></div>
    <div class="f-field full visit-treatment-group"><h4>Treatment Given</h4><div class="visit-inventory-grid">
      ${visitInventoryCard({ id: "cf-medicine", label: "Medicines", items: meds, selected: selectedMedicine?.code || f.medicine, quantityId: "cf-medqty", quantity: f.medQty, unitForItem: (item) => item.unit || "unit(s)", availableForItem: medicineAvailable })}
      ${visitInventoryCard({ id: "cf-supply", label: "Medical Supplies", items: supplies, selected: selectedSupply?.id || existingSupply, quantityId: "cf-supply-qty", quantity: f.supplyQty, unitForItem: () => "items", availableForItem: equipmentAvailable })}
    </div></div>
    <div class="f-field full"><label>Clinic Disposition — Outcome</label><select id="cf-outcome"><option value="">Not recorded</option>${DISPOSITIONS.map((x) => `<option ${f.outcome === x ? "selected" : ""}>${x}</option>`).join("")}<option ${f.outcome === "Other" ? "selected" : ""}>Other</option></select></div>
    <div class="f-field full"><label>Remarks</label><textarea id="cf-remarks">${escapeHtml(f.remarks || "")}</textarea></div>
    <div class="f-field full"><label>Parent / Guardian Notification</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <label>Contacted?<select id="cf-guardian-contacted"><option value="" ${!contactedValue ? "selected" : ""}>Not recorded</option><option ${contactedValue === "Yes" ? "selected" : ""}>Yes</option><option ${contactedValue === "No" ? "selected" : ""}>No</option><option ${contactedValue === "Not Applicable" ? "selected" : ""}>Not Applicable</option></select></label>
      <label>Method<select id="cf-guardian-method">${[
        ["not applicable", "Not Applicable"],
        ["phone call", "Phone Call"],
        ["sms/text", "SMS/Text"],
        ["messenger", "Messenger"],
        ["in person", "In Person"],
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}" ${f.guardianMethod === value ? "selected" : ""}>${label}</option>`,
        )
        .join("")}</select></label>
      <label>Person Contacted<input id="cf-person" value="${escapeHtml(f.personContacted || "")}"></label>
    </div></div>
    <div class="f-field"><label>Clinic Staff Record</label><input id="cf-staff" value="${escapeHtml(state.currentUser.name)}" readonly aria-readonly="true"></div>
    <div class="f-field"><label>Position</label><input id="cf-position" value="${escapeHtml(state.currentUser.role || "Staff Nurse")}" readonly aria-readonly="true"></div>
  </form></div><div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn" id="cf-clear">Clear Form</button><button class="btn btn-dark" id="cf-save">${ICONS.check} ${isEdit ? "Save New Visit Record" : "Save Visit"}</button></div>`;
  openModal(html);
  const complaintSelect = document.getElementById("cf-complaint");
  const allergySelect = document.getElementById("cf-allergies");
  const syncInterventionFreeText = bindOptionFreeText(
    "intervention-other",
    (f.interventions || [])
      .find((x) => x.startsWith("Other: "))
      ?.replace("Other: ", "") || "",
  );
  const updateMedicineCard = bindVisitInventoryCard({
    id: "cf-medicine",
    quantityId: "cf-medqty",
    items: meds,
    unitForItem: (item) => item.unit || "unit(s)",
    availableForItem: medicineAvailable,
  });
  const updateSupplyCard = bindVisitInventoryCard({
    id: "cf-supply",
    quantityId: "cf-supply-qty",
    items: supplies,
    unitForItem: () => "items",
    availableForItem: equipmentAvailable,
  });
  let visitSaveInProgress = false;
  let pendingVisitId = "";
  document.getElementById("cf-clear").onclick = () => {
    const form = document.getElementById("consult-form");
    form.reset();
    form.querySelectorAll("input:not([readonly]),textarea").forEach((field) => {
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
      field.setCustomValidity("");
      field.setAttribute("aria-invalid", "false");
    });
    form.querySelectorAll("select").forEach((select) => {
      if (select.multiple)
        [...select.options].forEach((option) => {
          option.selected = false;
        });
      else select.selectedIndex = 0;
    });
    document.getElementById("cf-date").value = todayDateString();
    document.getElementById("cf-time").value = currentTimeString();
    document.getElementById("cf-medqty").value = "0";
    document.getElementById("cf-supply-qty").value = "0";
    form.querySelectorAll(".field-error").forEach((error) => {
      error.textContent = "";
      error.classList.add("hidden");
    });
    syncInterventionFreeText?.();
    updateMedicineCard?.();
    updateSupplyCard?.();
  };
  document.getElementById("cf-save").onclick = async () => {
    if (visitSaveInProgress) return;
    if (!document.getElementById("consult-form").reportValidity()) return;
    const reasonValue = complaintSelect.value.trim(),
      isStandardReason = COMPLAINTS.includes(reasonValue),
      complaint = isStandardReason ? reasonValue : "Other",
      reasonOther =
        complaint === "Other" && reasonValue.toLowerCase() !== "other"
          ? reasonValue
          : "",
      allergyAnswerValue = allergySelect.value;
    if (!reasonValue) {
      toast(
        "Missing information",
        "Please select or enter a reason for the clinic visit.",
        "err",
      );
      complaintSelect.focus();
      return;
    }
    if (complaint === "Other" && !reasonOther) {
      complaintSelect.focus();
      toast(
        "Missing information",
        "Enter the custom reason in the Reason for Clinic Visit field.",
        "err",
      );
      return;
    }
    const outcome = document.getElementById("cf-outcome").value;
    const medicineKey = document.getElementById("cf-medicine").value,
      medQty = Number(document.getElementById("cf-medqty").value),
      med =
        MEDICINES.find(
          (item) => item.code === medicineKey || item.name === medicineKey,
        ) ||
        (isEdit && medicineKey === f.medicineCode ? selectedMedicine : null);
    const supplyKey = document.getElementById("cf-supply").value,
      supplyQty = Number(document.getElementById("cf-supply-qty").value),
      supplyItem =
        EQUIPMENT.find(
          (item) =>
            item.category === "Medical Supplies" &&
            !item.deleted &&
            item.status === "Available" &&
            (item.id === supplyKey || item.name === supplyKey),
        ) || (isEdit && supplyKey === f.supplyItemId ? selectedSupply : null);
    const medName = med?.name || "",
      supplyName = supplyItem?.name || "";
    if (medName && (!Number.isInteger(medQty) || medQty < 1)) {
      toast(
        "Invalid quantity",
        "Enter a whole-number medication quantity of at least 1.",
        "err",
      );
      return;
    }
    if (supplyName && (!Number.isInteger(supplyQty) || supplyQty < 1)) {
      toast(
        "Invalid quantity",
        "Enter a whole-number supply quantity of at least 1.",
        "err",
      );
      return;
    }
    const previous = isEdit
      ? CONSULTATIONS.find((c) => c.id === existing.id)
      : null;
    if (
      isEdit &&
      (!previous ||
        previous.studentId !== student.id ||
        previous.deleted ||
        previous.status === "Superseded")
    ) {
      toast(
        "Visit unavailable",
        "The selected visit could not be found for this patient.",
        "err",
      );
      return;
    }
    ensureInventoryLedger();
    const interventions = selectedChecks('[data-check-group="intervention"]');
    const interventionOther = document
      .querySelector('[data-free-text="intervention-other"]')
      ?.value.trim();
    if (interventionOther) interventions.push(`Other: ${interventionOther}`);
    if (
      (medName && med && medQty > medicineAvailable(med)) ||
      (supplyName && supplyItem && supplyQty > equipmentAvailable(supplyItem))
    ) {
      toast(
        "Insufficient inventory",
        "The requested treatment quantity exceeds the currently available stock. Review Available Stock before saving.",
        "err",
      );
      return;
    }
    pendingVisitId = pendingVisitId || uid("CS");
    const rec = {
      ...f,
      id: pendingVisitId,
      date: document.getElementById("cf-date").value,
      time: document.getElementById("cf-time").value,
      nurse: state.currentUser.name,
      nurseId: state.currentUser.id,
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      year: student.personnelType || student.year,
      complaint,
      reasonOther,
      symptomStart: document.getElementById("cf-start").value,
      painLevel: document.getElementById("cf-pain").value,
      knownConditions: document.getElementById("cf-conditions").value,
      allergiesHistory: allergyAnswerValue
        ? allergyAnswerValue === "Yes"
          ? allergyHistory || "Yes"
          : "No"
        : null,
      currentMedication: document.getElementById("cf-current-med").value,
      temp: document.getElementById("cf-temp").value,
      bp: document.getElementById("cf-bp").value,
      pulse: document.getElementById("cf-pulse").value,
      spo2: document.getElementById("cf-spo2").value,
      interventions,
      medicine: medName || null,
      medicineCode: med?.code || null,
      medQty,
      supplyUsed: supplyName || null,
      supplyItemId: supplyItem?.id || null,
      supplyQty,
      equipmentUsed: isEdit ? f.equipmentUsed || [] : [],
      equipmentQty: isEdit ? f.equipmentQty || 1 : 1,
      outcome,
      remarks: document.getElementById("cf-remarks").value,
      guardianContacted: document.getElementById("cf-guardian-contacted").value,
      guardianMethod: document.getElementById("cf-guardian-method").value,
      personContacted: document.getElementById("cf-person").value,
      staffRecord: state.currentUser.name,
      position: state.currentUser.role || "Staff Nurse",
      followUp: "No",
      status: "Active",
      deleted: false,
      versionOf: isEdit ? f.versionOf || f.id : null,
      revision: isEdit ? (Number(f.revision) || 1) + 1 : 1,
      supersedesId: isEdit ? f.id : null,
      createdAt: new Date().toISOString(),
    };
    rec.respiratoryRate = document.getElementById("cf-respiratory-rate").value;
    rec.supplyUsed = supplyName || null;
    const saveButton = document.getElementById("cf-save");
    const saveLabel = saveButton.innerHTML;
    let inventorySnapshot = null,
      visitsSnapshot = null,
      previousSnapshot = null,
      previousAllergies = null;
    visitSaveInProgress = true;
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="button-spinner"></span> Saving...';
    try {
      validateVisitInventoryUsage(rec, previous);
      inventorySnapshot = captureInventoryState();
      visitsSnapshot = CONSULTATIONS.slice();
      previousSnapshot = previous ? { ...previous } : null;
      previousAllergies = student.allergies;
      if (isEdit) reverseVisitInventoryUsage(previous);
      applyVisitInventoryUsage(rec, previous);
      if (allergyAnswerValue) {
        student.allergies =
          allergyAnswerValue === "Yes"
            ? patientAllergyStatus(student.allergies).status === "unassessed"
              ? "Allergies reported"
              : student.allergies
            : patientAllergyStatus(student.allergies).status === "unassessed"
              ? "No Known Allergies"
              : student.allergies;
      }
      if (isEdit) {
        previous.status = "Superseded";
        previous.supersededBy = rec.id;
      }
      CONSULTATIONS.unshift(rec);
      await saveVisitToClinicState(
        [rec.id],
        inventorySnapshot,
        [student.id],
      );
      pendingVisitId = "";
      let auditSucceeded = true;
      try {
        const auditActions = [
          {
            action: `${isEdit ? "Patient Visit Revised" : "Patient Visit Created"} — ${rec.id}`,
            module: "Patient Visits",
            detail: rec.id,
          },
          ...clinicInventoryAuditActions(inventorySnapshot, `visit ${rec.id}`),
        ];
        auditActions.push({
          action: `Patient Allergies ${allergyAnswerValue === "Yes" ? "Recorded" : "Confirmed None"} — ${student.id} from visit ${rec.id}`,
          module: "Patients",
          detail: student.id,
        });
        for (const event of auditActions)
          await logAudit(
            event.action,
            event.module,
            "Success",
            false,
            true,
            event.detail || "",
          );
      } catch {
        auditSucceeded = false;
      }
      if (auditSucceeded) {
        if (isEdit)
          toast("Follow-up visit recorded", `Added visit ${rec.id}.`, "ok");
        else toast("Visit saved", `Recorded visit for ${student.name}.`, "ok");
      } else
        toast(
          "Visit saved; audit sync failed",
          "The visit was saved, but one or more audit entries could not be recorded.",
          "err",
        );
      closeModal();
      if (state.selectedStudent?.id === student.id)
        openStudentDetailModal(student);
      else renderPage();
    } catch (error) {
      if (inventorySnapshot) {
        restoreInventoryState(inventorySnapshot);
        CONSULTATIONS.splice(0, CONSULTATIONS.length, ...visitsSnapshot);
        if (previous && previousSnapshot)
          Object.assign(previous, previousSnapshot);
        student.allergies = previousAllergies;
      }
      toast(
        "Visit not saved",
        error.message ||
          "The visit could not be saved because inventory could not be updated.",
        "err",
      );
    } finally {
      visitSaveInProgress = false;
      if (saveButton.isConnected) {
        saveButton.disabled = false;
        saveButton.innerHTML = saveLabel;
      }
    }
  };
}

function consultationRows(c) {
  return [
    ["Record No.", c.id],
    ["Date / Time", `${fmtDate(c.date)} · ${c.time || "—"}`],
    ["Patient", c.studentName || "—"],
    [
      (c.institutionalCategory || c.course) === "Campus Personnel"
        ? "Institutional Category / Personnel Type"
        : "Institutional Category / Year Level",
      `${c.institutionalCategory || c.course || "—"} — ${c.personnelType || c.year || "—"}`,
    ],
    ["Nurse on Duty", c.nurse || "—"],
    [
      "Reason for Clinic Visit",
      c.complaint === "Other" && c.reasonOther
        ? `Other: ${c.reasonOther}`
        : c.complaint || "—",
    ],
    ["Symptom Onset", c.symptomStart || "—"],
    [
      "Pain",
      `${c.painLevel || "—"}${c.painLocation ? " · " + c.painLocation : ""}`,
    ],
    [
      "Medical History",
      `Conditions: ${c.knownConditions || "—"} · Allergies: ${c.allergiesHistory || "—"} · Current medication: ${c.currentMedication || "—"} · Previous similar symptoms: ${c.previousSimilar || "—"}`,
    ],
    [
      "Vital Signs",
      `Temp ${c.temp || "—"} °C · Pulse ${c.pulse || "—"} bpm · Respiratory rate ${c.respiratoryRate || "—"} breaths/min · BP ${c.bp || "—"} mmHg · SpO2 ${c.spo2 || "—"} % · Weight ${c.weight || "—"} · Height ${c.height || "—"}`,
    ],
    [
      "Nurse's Assessment",
      `${c.assessment || c.diagnosis || "—"}${c.assessmentOther ? ` · Other: ${c.assessmentOther}` : ""}`,
    ],
    ["Nurse's Notes", c.notes || "—"],
    [
      "Treatment / Intervention",
      (c.interventions || []).join(", ") || c.treatment || "—",
    ],
    [
      "Medical Supplies",
      c.supplyUsed
        ? `${c.supplyUsed} × ${c.supplyQty ?? "Not recorded"}`
        : "—",
    ],
    [
      "Medical Equipment",
      (c.equipmentUsed || [])
        .map(
          (value) =>
            `${EQUIPMENT.find((item) => item.id === value || item.name === value)?.name || value} × ${c.equipmentQty ?? "Not recorded"}`,
        )
        .join(", ") || "—",
    ],
    ["Additional Treatment Details", c.treatmentGiven || "—"],
    [
      "Medicines",
      c.medicine
        ? `${c.medicine} × ${c.medQty ?? "Not recorded"} · ${c.dosage || ""}`
        : "—",
    ],
    ["Outcome", c.outcome || "—"],
    ["Time Released / Referred", c.releasedAt || "—"],
    [
      "Guardian Notification",
      `${normalizeGuardianContacted(c.guardianContacted)}${c.guardianMethod ? ` · ${c.guardianMethod}` : ""}${c.personContacted ? ` · ${c.personContacted}` : ""}`,
    ],
    ["Remarks", c.remarks || "—"],
    ["Clinic Staff Record", `${c.staffRecord || "—"} · ${c.position || "—"}`],
  ];
}

function viewConsultation(c) {
  if (!c) return;
  logAudit(
    `Patient Visit Viewed — ${c.id}`,
    "Patient Visits",
    "Success",
    false,
  );
  const hiddenVisitDetails = new Set([
    "Nurse's Assessment",
    "Nurse's Notes",
    "Medical Equipment",
    "Additional Treatment Details",
    "Additional Treatment Given",
    "Time Released / Referred",
  ]);
  const rows = consultationRows(c).filter(
    ([label]) => !hiddenVisitDetails.has(label),
  );
  const isSuperseded = c.status === "Superseded";
  openModal(`<div class="modal-head"><h3>${isSuperseded ? "Original" : "Clinical"} Visit Record</h3><button class="modal-close" onclick="closeModal()" aria-label="Close clinical visit record">${ICONS.x}</button></div>
     <div class="modal-body"><div class="visit-record-summary"><span>${isSuperseded ? "Original record · preserved for audit" : "Reason for clinic visit"}</span><strong>${escapeHtml(c.complaint || "Other")}</strong><small>${escapeHtml(c.studentName || "")} · ${escapeHtml(fmtDate(c.date))} at ${escapeHtml(c.time || "—")} · Revision ${c.revision || 1}${isSuperseded && c.supersededBy ? ` · Revised as ${escapeHtml(c.supersededBy)}` : ""}</small></div>
    <table class="record-detail-table"><tbody>${rows.map((r) => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1] || "—")}</td></tr>`).join("")}</tbody></table></div>
     <div class="modal-foot"><button class="btn" onclick="closeModal()">Close</button><button class="btn" id="view-record-print">${ICONS.print} Print</button>${isSuperseded ? "" : `<button class="btn btn-dark" id="view-record-edit">${ICONS.edit} Edit Patient Visit</button>`}</div>`);
  document.getElementById("view-record-print").onclick = () =>
    printConsultation(c);
  document.getElementById("view-record-edit")?.addEventListener("click", () => {
    closeModal();
    openConsultationForm(
      STUDENTS.find((s) => s.id === c.studentId) || {
        id: c.studentId,
        name: c.studentName,
      },
      c,
    );
  });
}

function printConsultation(c) {
  if (!c) return;
  const printValue = (value) =>
    value === null || value === undefined || String(value).trim() === ""
      ? "—"
      : String(value);
  const valueWithUnit = (value, unit) => {
    const recorded = printValue(value);
    return (
      recorded === "—" ||
      recorded.trimEnd().toLowerCase().endsWith(unit.toLowerCase())
    )
      ? recorded
      : `${recorded} ${unit}`;
  };
  const historyRows = [
    ["Known Medical Conditions", c.knownConditions],
    ["Allergies", c.allergiesHistory],
    ["Current Medication", c.currentMedication],
  ];
  const vitalRows = [
    ["Blood Pressure", valueWithUnit(c.bp, "mmHg")],
    ["Heart Rate / Pulse Rate", valueWithUnit(c.pulse, "bpm")],
    ["Respiratory Rate", valueWithUnit(c.respiratoryRate, "breaths/min")],
    ["Body Temperature", valueWithUnit(c.temp, "°C")],
    ["Oxygen Saturation (SpO₂)", valueWithUnit(c.spo2, "%")],
  ];
  const excludedPrintFields = new Set([
    "Nurse on Duty",
    "Nurse's Assessment",
    "Nurse's Notes",
    "Medical Equipment",
    "Additional Treatment Details",
    "Time Released / Referred",
  ]);
  const sectionRows = (title, rows) =>
    `<tr class="patient-visit-print-section-row"><th class="patient-visit-print-section-heading" colspan="2">${title}</th></tr>${rows
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(printValue(value))}</td></tr>`,
      )
      .join("")}`;
  const rowHtml = consultationRows(c)
    .filter(([label]) => !excludedPrintFields.has(label))
    .flatMap(([label, value]) => {
      if (label === "Medical History")
        return [sectionRows("Medical History", historyRows)];
      if (label === "Vital Signs")
        return [sectionRows("Vital Signs", vitalRows)];
      return [
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(printValue(value))}</td></tr>`,
      ];
    })
    .join("");
  printTemplate({
    title: "Patient Visit Slip",
    subtitle: `School Clinic · Patient Visit Record · ${escapeHtml(c.studentName || "")}`,
    body: `<table class="clinic-print-table patient-visit-print-table"><tbody>${rowHtml}</tbody></table>`,
    footnote: `Confidential clinic record — for authorized personnel only.${clinicDataStatus === "stale" ? " The latest database refresh failed; data reflects the last successful synchronization." : ""}`,
  });
  logAudit(
    `Patient Visit Printed — ${c.id}`,
    "Patient Visits",
    "Success",
    false,
  );
}

function renderConsultHistory() {
  const rawQ = document.getElementById("ch-search")?.value || "",
    q = rawQ.toLowerCase(),
    status = document.getElementById("ch-status")?.value || "";
  let list = CONSULTATIONS.filter(
    (c) =>
      (!q ||
        [
          c.studentName,
          c.complaint,
          c.id,
          c.nurse,
          c.diagnosis,
          c.outcome,
          c.versionOf,
          c.supersededBy,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!status ||
        (status === "Deleted"
          ? c.deleted
          : !c.deleted &&
            (status === "Superseded"
              ? c.status === "Superseded"
              : c.status === status))),
  ).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  const totalPages = Math.max(1, Math.ceil(list.length / 8));
  if (state.consultPage > totalPages) state.consultPage = totalPages;
  const items = list.slice((state.consultPage - 1) * 8, state.consultPage * 8);
  const rows = items.length
    ? items
        .map(
          (c) =>
            `<tr><td>${fmtDate(c.date)}<br><span style="color:var(--ink-soft);font-size:11.5px">${escapeHtml(c.time)}</span></td><td>${escapeHtml(c.studentName)}</td><td>${escapeHtml(c.complaint === "Other" && c.reasonOther ? `Other: ${c.reasonOther}` : c.complaint)}</td><td>${escapeHtml(c.nurse)}</td><td>${escapeHtml(c.outcome || "—")}</td><td>${c.deleted ? '<span class="chip chip-void">Deleted</span>' : c.status === "Superseded" ? '<span class="chip chip-low">Superseded</span>' : '<span class="chip chip-available">Active</span>'}</td><td><div class="row-actions"><button class="mini-btn" data-view-consult="${c.id}" title="View clinical record">${ICONS.search}</button><button class="mini-btn" data-print="${c.id}" title="Print">${ICONS.print}</button>${c.deleted ? (canDeleteClinicRecords() ? `<button class="mini-btn good" data-restore-consult="${c.id}">${ICONS.restore}</button>` : "") : c.status === "Superseded" ? "" : `<button class="mini-btn" data-edit-consult="${c.id}" title="Edit visit record">${ICONS.edit}</button>${canDeleteClinicRecords() ? `<button class="mini-btn danger" data-del-consult="${c.id}">${ICONS.trash_sm}</button>` : ""}`}</div></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="7">${emptyState("No patient visits match your filters.")}</td></tr>`;
  return `<div class="card"><div class="toolbar"><div class="search-box"><span class="ic">${ICONS.search}</span><input id="ch-search" value="${escapeHtml(rawQ)}" placeholder="Search visits, patient, reason, nurse, or record ID..."></div><select class="select-sm" id="ch-status"><option value="">All Status</option><option ${status === "Active" ? "selected" : ""}>Active</option><option ${status === "Superseded" ? "selected" : ""}>Superseded</option><option ${status === "Deleted" ? "selected" : ""}>Deleted</option></select></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Patient</th><th>Reason</th><th>Nurse</th><th>Outcome</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="pagination"><span>Page ${state.consultPage} of ${totalPages} · ${list.length} records</span><div class="page-btns"><button data-page="prev">${ICONS.chevleft}</button><button data-page="next">${ICONS.chevright}</button></div></div></div>`;
}

function bindConsultHistory() {
  const rerender = () => {
    const a = document.activeElement,
      id = a?.id,
      pos = a?.selectionStart;
    document.getElementById("consult-body").innerHTML = renderConsultHistory();
    bindConsultHistory();
    const n = id && document.getElementById(id);
    if (n) {
      n.focus();
      if (pos !== undefined) n.setSelectionRange(pos, pos);
    }
  };
  document.getElementById("ch-search")?.addEventListener("input", rerender);
  document.getElementById("ch-status")?.addEventListener("change", rerender);
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        state.consultPage += b.dataset.page === "next" ? 1 : -1;
        if (state.consultPage < 1) state.consultPage = 1;
        rerender();
      }),
  );
  document
    .querySelectorAll("[data-view-consult]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          viewConsultation(
            CONSULTATIONS.find((c) => c.id === b.dataset.viewConsult),
          )),
    );
  document
    .querySelectorAll("[data-print]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          printConsultation(
            CONSULTATIONS.find((c) => c.id === b.dataset.print),
          )),
    );
  document.querySelectorAll("[data-edit-consult]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = CONSULTATIONS.find((x) => x.id === b.dataset.editConsult);
        openConsultationForm(
          STUDENTS.find((s) => s.id === c.studentId) || {
            id: c.studentId,
            name: c.studentName,
          },
          c,
        );
      }),
  );
  document.querySelectorAll("[data-del-consult]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!canDeleteClinicRecords()) return;
        const c = CONSULTATIONS.find((x) => x.id === b.dataset.delConsult);
        if (!c) return;
        confirmDialog({
          title: "Delete this patient visit?",
          msg: `Record <b>${c.id}</b> will be moved to Deleted Records and can be restored later.`,
          okLabel: "Delete Record",
          onConfirm: async () => {
            const snapshot = captureInventoryState(),
              previous = {
                deleted: c.deleted,
                deletedAt: c.deletedAt,
                status: c.status,
              };
            const deletedAt = new Date().toISOString();
            await commitClinicRecordMutation({
              apply: () => {
                reverseVisitInventoryUsage(c);
                c.deleted = true;
                c.deletedAt = deletedAt;
                c.status = "Deleted";
              },
              rollback: () => {
                restoreInventoryState(snapshot);
                Object.assign(c, previous);
              },
              save: () => saveVisitInventoryStatusToClinicState(c.id, true),
              auditActions: [
                {
                  action: `Record Deleted — Patient Visit ${c.id}`,
                  module: "Patient Visits",
                  status: "Warning",
                  detail: c.id,
                },
                ...clinicInventoryAuditActions(
                  snapshot,
                  `visit ${c.id} deleted`,
                ),
              ],
              module: "Patient Visits",
              successTitle: "Visit deleted",
              successMessage: `Record ${c.id} moved to Deleted Records; used inventory was restored.`,
              refresh: rerender,
            });
          },
        });
      }),
  );
  document.querySelectorAll("[data-restore-consult]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!canDeleteClinicRecords()) return;
        const visit = CONSULTATIONS.find(
          (record) => record.id === b.dataset.restoreConsult,
        );
        if (!visit) return;
        const patient = DELETED_STUDENTS.find(
          (record) => record.id === visit.studentId,
        );
        const restoredPatient = patient ? { ...patient, deleted: false } : null;
        if (restoredPatient) {
          delete restoredPatient.deletedAt;
          delete restoredPatient.deletedBy;
        }
        const patientIndex = patient ? DELETED_STUDENTS.indexOf(patient) : -1;
        const snapshot = captureInventoryState(),
          previousVisit = {
            deleted: visit.deleted,
            deletedAt: visit.deletedAt,
            status: visit.status,
          };
        await commitClinicRecordMutation({
          apply: () => {
            if (patient && STUDENTS.some((record) => record.id === patient.id))
              throw new Error("A patient with this ID is already active.");
            validateVisitInventoryUsage(visit);
            applyVisitInventoryUsage(visit);
            if (patient) {
              DELETED_STUDENTS.splice(patientIndex, 1);
              STUDENTS.unshift(restoredPatient);
            }
            visit.deleted = false;
            delete visit.deletedAt;
            if (visit.status === "Deleted") visit.status = "Active";
          },
          rollback: () => {
            restoreInventoryState(snapshot);
            Object.assign(visit, previousVisit);
            if (patient) {
              const activeIndex = STUDENTS.findIndex(
                (record) => record.id === patient.id,
              );
              if (activeIndex >= 0) STUDENTS.splice(activeIndex, 1);
              DELETED_STUDENTS.splice(
                Math.min(patientIndex, DELETED_STUDENTS.length),
                0,
                patient,
              );
            }
          },
          save: () =>
            saveVisitInventoryStatusToClinicState(
              visit.id,
              false,
              Boolean(patient),
            ),
          auditActions: [
            {
              action: `Record Restored — Patient Visit ${visit.id}`,
              module: "Patient Visits",
            },
            ...(patient
              ? [
                  {
                    action: `Record Restored — Patient ${patient.id}`,
                    module: "Patients",
                    detail: patient.id,
                  },
                ]
              : []),
            ...clinicInventoryAuditActions(
              snapshot,
              `visit ${visit.id} restored`,
            ),
          ],
          module: "Patient Visits",
          successTitle: "Visit restored",
          successMessage: `Record ${visit.id} returned to Patient Visits.`,
          refresh: rerender,
        });
      }),
  );
}

function renderConsultTabBody() {
  const body = document.getElementById("consult-body");
  if (state.consultTab === "search") {
    body.innerHTML = renderConsultSearchTab();
    bindConsultSearch();
  } else {
    body.innerHTML = renderConsultHistory();
    bindConsultHistory();
  }
}
