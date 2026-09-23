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
  {label:"Junior High School — Section", options:["Room 001","Room 401","Room 402","Room 403","Room 404","Room 405","Room 406"]},
  {label:"Elementary — Section", options:["Room 001","Room 401","Room 402","Room 403","Room 404","Room 405","Room 406"]},
  {label:"Kindergarten — Section", options:["Room 001","Room 401","Room 402","Room 403","Room 404","Room 405","Room 406"]},
];
const COURSES = COURSE_GROUPS.flatMap(g=>g.options);

/* Builds the grouped <optgroup> markup for a Course/Department <select>. */
function courseOptionsHtml(selected){
  return COURSE_GROUPS.map(g=>`<optgroup label="${g.label}">${
    g.options.map(c=>`<option ${selected===c?'selected':''}>${c}</option>`).join("")
  }</optgroup>`).join("");
}
/* Returns the valid Year/Grade Level choices for a given course/department. */
function yearLevelsFor(course){
  if(COLLEGE_COURSES.includes(course)) return ["1st Year","2nd Year","3rd Year","4th Year"];
  if(["HUMSS","GAS","ABM","STEM","ICT","HE"].includes(course)) return ["Grade 11","Grade 12"];
  if(course==="Room 001" || /^Room 4\d\d$/.test(course)) return ["Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10"];
  return ["Kinder 1","Kinder 2"];
}
function educationGroupFor(course, year=""){
  if(COLLEGE_COURSES.includes(course)) return "College";
  if(["HUMSS","GAS","ABM","STEM","ICT","HE"].includes(course)) return "Senior High School";
  if(year==="Kinder 1" || year==="Kinder 2") return "Kindergarten";
  if(/^Grade [789]$|^Grade 10$/.test(year)) return "Junior High School";
  return "Elementary School";
}
const NURSES = [];

function seedStudents(){
  // Start with an empty patient directory. Staff add real records through
  // Patients → Add New Patient.
  return [];
}
const STUDENTS = seedStudents();

let MEDICINES = [
  {code:"MED-001",name:"Paracetamol 500mg",category:"Analgesic/Antipyretic",qty:230,unit:"tablet",batch:"PB-2402",exp:"2027-03-15",supplier:"MediPharma Corp",deleted:false},
  {code:"MED-002",name:"Ibuprofen 200mg",category:"NSAID",qty:14,unit:"tablet",batch:"IB-2311",exp:"2026-08-02",supplier:"MediPharma Corp",deleted:false},
  {code:"MED-003",name:"Cetirizine 10mg",category:"Antihistamine",qty:80,unit:"tablet",batch:"CT-2405",exp:"2027-11-20",supplier:"HealthFirst Supply",deleted:false},
  {code:"MED-004",name:"Antacid Tablets",category:"Antacid",qty:0,unit:"tablet",batch:"AN-2301",exp:"2026-01-10",supplier:"HealthFirst Supply",deleted:false},
  {code:"MED-005",name:"Oral Rehydration Salts (ORS)",category:"Electrolyte",qty:45,unit:"sachet",batch:"ORS-2404",exp:"2027-06-30",supplier:"MediPharma Corp",deleted:false},
  {code:"MED-006",name:"Antibiotic Ointment",category:"Topical",qty:18,unit:"tube",batch:"AO-2312",exp:"2026-07-28",supplier:"CarePlus Distributors",deleted:false},
  {code:"MED-007",name:"Antiseptic Solution (Povidone-Iodine)",category:"Antiseptic",qty:22,unit:"bottle",batch:"AS-2403",exp:"2027-02-14",supplier:"CarePlus Distributors",deleted:false},
];

let EQUIPMENT = [
  {id:"EQP-001",name:"Digital Thermometer",qty:6,condition:"Good",lastMaint:"2026-05-10",status:"Available",deleted:false},
  {id:"EQP-002",name:"Blood Pressure Monitor (Digital)",qty:3,condition:"Good",lastMaint:"2026-06-01",status:"Available",deleted:false},
  {id:"EQP-003",name:"Stethoscope",qty:5,condition:"Good",lastMaint:"2026-04-18",status:"Available",deleted:false},
  {id:"EQP-004",name:"Pulse Oximeter",qty:4,condition:"Fair",lastMaint:"2026-03-22",status:"Available",deleted:false},
  {id:"EQP-005",name:"Weighing Scale",qty:2,condition:"Fair",lastMaint:"2026-02-14",status:"Under Maintenance",deleted:false},
  {id:"EQP-006",name:"Height Measuring Device",qty:2,condition:"Good",lastMaint:"2026-01-30",status:"Available",deleted:false},
  {id:"EQP-007",name:"Scissors (Medical)",qty:8,condition:"Good",lastMaint:"2026-05-02",status:"Available",deleted:false},
  {id:"EQP-008",name:"Tweezers",qty:8,condition:"Good",lastMaint:"2026-05-02",status:"Available",deleted:false},
  {id:"EQP-009",name:"Gloves Dispenser Box",qty:10,condition:"Poor",lastMaint:"2025-11-10",status:"Replacement Needed",deleted:false},
  {id:"EQP-010",name:"First Aid Kit (Complete Set)",qty:3,condition:"Damaged",lastMaint:"2025-12-05",status:"Damaged",deleted:false},
  {id:"EQP-011",name:"Cotton Swabs",qty:500,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-012",name:"Cotton Balls",qty:300,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-013",name:"Alcohol (70% Isopropyl)",qty:6,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-014",name:"Elastic Bandage",qty:26,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-015",name:"Adhesive Bandages (Band-Aids)",qty:400,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-016",name:"Gauze Pads",qty:150,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-017",name:"Medical Tape",qty:8,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-018",name:"Hand Sanitizer",qty:32,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-019",name:"Disposable Face Masks",qty:600,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
  {id:"EQP-020",name:"Gloves (Nitrile, Medium)",qty:250,condition:"Good",lastMaint:"2026-07-01",status:"Available",deleted:false},
];

const COMPLAINTS = ["Headache","Fever","Dizziness","Stomachache","Nausea/Vomiting","Injury","Cough/Cold","Difficulty Breathing","Menstrual Pain","Weakness/Fatigue"];
const SYMPTOMS = ["Fever","Headache","Dizziness","Nausea","Vomiting","Stomach Pain","Cough","Sore Throat","Runny Nose","Difficulty Breathing","Chest Pain","Weakness","Fainting","Diarrhea"];
const INTERVENTIONS = ["Rest/Observation","First Aid","Wound Cleaning","Ice/Cold Compress","Oral Fluids","Medication Given","Referred to Parent/Guardian","Referred to Doctor/Hospital"];
const DISPOSITIONS = ["Treated and Released","Returned to Class","Rested in Clinic","Admitted","Sent Home","Parent/Guardian Notified","Referred to Doctor","Referred to Hospital/Healthcare Facility","Emergency Referral"];

function seedConsultations(){
  // No dummy visit history. New visits are created from a patient profile.
  return [];
}
let CONSULTATIONS = seedConsultations();

let AUDIT_LOGS = [];

let DELETED_CONSULTATIONS = [];
let DELETED_MEDICINES = [];
let DELETED_STUDENTS = [];
let DELETED_USERS = [];
let PURGED_RECORDS = [];
