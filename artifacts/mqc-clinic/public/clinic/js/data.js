/* ================= MOCK DATA ================= */
/* Department / education-level structure, grouped for the Patients section.
   COLLEGE_COURSES = the college department options.
   COURSE_GROUPS   = the divided sections shown in the Course/Department dropdowns. */
const COLLEGE_COURSES = [
  "Bachelor of Science in Accountancy",
  "Bachelor of Science in Business Administration",
  "Bachelor of Science in Psychology",
  "Bachelor of Science in Hospitality Management",
  "Bachelor of Science in Tourism Management",
  "Bachelor of Elementary Education",
  "Bachelor of Secondary Education",
  "Bachelor of Science in Information Technology",
];
const COURSE_GROUPS = [
  {label:"College", options:COLLEGE_COURSES},
  {label:"Senior High School — Strand", options:["HUMSS","GAS","ABM","STEM","ICT","HE"]},
  {label:"Junior High School — Section", options:["James"]},
  {label:"Elementary — Section", options:["Job"]},
  {label:"Kindergarten — Section", options:["John"]},
];
const COURSES = COURSE_GROUPS.flatMap(g=>g.options);
const YEAR_LEVEL_GROUPS = [
  {label:"Kindergarten", options:["Kinder 1","Kinder 2"]},
  {label:"Elementary", options:["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6"]},
  {label:"Junior High School", options:["Grade 7","Grade 8","Grade 9","Grade 10"]},
  {label:"Senior High School", options:["Grade 11","Grade 12"]},
  {label:"College", options:["1st Year","2nd Year","3rd Year","4th Year"]},
];

/* Builds the grouped <optgroup> markup for a Course/Department <select>. */
function courseOptionsHtml(selected){
  return COURSE_GROUPS.map(g=>`<optgroup label="${g.label}">${
    g.options.map(c=>`<option ${selected===c?'selected':''}>${c}</option>`).join("")
  }</optgroup>`).join("");
}
function yearLevelOptionsHtml(selected){
  return YEAR_LEVEL_GROUPS.map(group=>`<optgroup label="${group.label}">${group.options.map(year=>`<option ${selected===year?"selected":""}>${year}</option>`).join("")}</optgroup>`).join("");
}
function schoolLevelForYear(year){
  return YEAR_LEVEL_GROUPS.find(group=>group.options.includes(year))?.label||"College";
}
function courseOptionsForYearHtml(year, selected=""){
  const level=schoolLevelForYear(year);
  const options=level==="Kindergarten"?["John"]:
    level==="Elementary"?["Job"]:
    level==="Junior High School"?["James"]:
    level==="Senior High School"?["HUMSS","GAS","ABM","STEM","ICT","HE"]:COLLEGE_COURSES;
  const current=options.includes(selected)?selected:options[0];
  return options.map(course=>`<option ${course===current?"selected":""}>${course}</option>`).join("");
}
function educationGroupFor(course, year=""){
  if(year) return schoolLevelForYear(year);
  if(COLLEGE_COURSES.includes(course)) return "College";
  if(["HUMSS","GAS","ABM","STEM","ICT","HE"].includes(course)) return "Senior High School";
  if(course==="John") return "Kindergarten";
  if(course==="James") return "Junior High School";
  if(course==="Job") return "Elementary";
  if(/^Grade [789]$|^Grade 10$/.test(year)) return "Junior High School";
  return "Elementary";
}
const NURSES = [];

function seedStudents(){
  // Start with an empty patient directory. Staff add real records through
  // Patients → Add New Patient.
  return [];
}
const STUDENTS = seedStudents();

let MEDICINES = [];
let EQUIPMENT = [];

const VISIT_SUPPLY_NAMES=["Cotton Swabs","Cotton Balls","Alcohol (70% Isopropyl)","Elastic Bandage","Adhesive Bandages (Band-Aids)","Gauze Pads","Medical Tape","Hand Sanitizer","Disposable Face Masks","Gloves (Nitrile, Medium)"];
const VISIT_TOOL_NAMES=["Digital Thermometer","Blood Pressure Monitor (Digital)","Stethoscope","Pulse Oximeter","Scissors (Medical)","Tweezers","Nebulizer"];

const COMPLAINTS = ["Headache","Fever","Dizziness","Stomachache","Nausea/Vomiting","Injury","Cough/Cold","Difficulty Breathing","Menstrual Pain","Weakness/Fatigue"];
const SYMPTOMS = ["Fever","Headache","Dizziness","Nausea","Vomiting","Stomach Pain","Cough","Sore Throat","Runny Nose","Difficulty Breathing","Chest Pain","Weakness","Fainting","Diarrhea","Asthma"];
const INTERVENTIONS = ["Rest/Observation","First Aid","Wound Cleaning","Ice/Cold Compress","Oral Fluids","Medication Given","Referred to Parent/Guardian","Referred to Doctor/Hospital"];
const DISPOSITIONS = ["Treated and Released","Returned to Class","Rested in Clinic","Admitted","Sent Home","Parent/Guardian Notified","Referred to Doctor","Referred to Hospital/Healthcare Facility","Emergency Referral"];

function seedConsultations(){
  // No dummy visit history. New visits are created from a patient profile.
  return [];
}
let CONSULTATIONS = seedConsultations();

let AUDIT_LOGS = [];
let INVENTORY_TRANSACTIONS = [];

let DELETED_CONSULTATIONS = [];
let DELETED_MEDICINES = [];
let DELETED_STUDENTS = [];
let DELETED_USERS = [];
let PURGED_RECORDS = [];
