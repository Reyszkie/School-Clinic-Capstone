import {
  hasClinicAdminPrivileges,
  readActiveClinicSession,
} from "../auth/session";

const clinicStateId = 1;

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}

function toDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeDeletedAt(row: Record<string, unknown>) {
  if (!row.deleted && row.status !== "Deleted") return null;
  return (
    toDateValue(row.deletedAt ?? row.deleted_at) ?? new Date().toISOString()
  );
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function normalizeUserRow(row: Record<string, unknown>) {
  const computedName =
    row.name ??
    [row.lastName ?? row.last_name ?? "", row.firstName ?? row.first_name ?? ""]
      .filter(Boolean)
      .join(", ");
  const normalized: Record<string, unknown> = {
    id: row.id ?? null,
    name: computedName || null,
    last_name: row.lastName ?? row.last_name ?? "",
    first_name: row.firstName ?? row.first_name ?? "",
    middle_initial: row.middleInitial ?? row.middle_initial ?? null,
    role: row.role ?? "Staff Nurse",
    username: row.username ?? null,
    status: row.status ?? "Active",
    deleted_at: normalizeDeletedAt(row),
    updated_at: new Date().toISOString(),
  };
  if (row.authUserId !== undefined || row.auth_user_id !== undefined)
    normalized.auth_user_id = row.authUserId ?? row.auth_user_id;
  if (row.passwordHash !== undefined || row.password_hash !== undefined)
    normalized.password_hash = row.passwordHash ?? row.password_hash;
  return normalized;
}

function userStateKey(row: Record<string, unknown>) {
  return JSON.stringify({
    username: String(row.username ?? "").toLowerCase(),
    name: String(row.name ?? ""),
    role: String(row.role ?? "Staff Nurse"),
    status: String(row.status ?? "Active"),
    deleted: Boolean(row.deleted ?? row.deleted_at ?? row.deletedAt),
  });
}

async function hasClinicUserChanges(rows: unknown) {
  if (!Array.isArray(rows)) return false;
  const [currentUsers, snapshotResponse] = await Promise.all([
    readTable("clinic_users"),
    supabaseRequest(`clinic_state?id=eq.${clinicStateId}&select=state`),
  ]);
  if (!snapshotResponse.ok)
    throw new Error(
      `clinic_state user-history lookup returned ${snapshotResponse.status}`,
    );
  const snapshots = (await snapshotResponse.json()) as Array<{
    state?: Record<string, unknown>;
  }>;
  const snapshotUsers = Array.isArray(snapshots[0]?.state?.users)
    ? (snapshots[0].state.users as Array<Record<string, unknown>>)
    : [];
  const existingById = new Map(
    currentUsers.map((user) => [String(user.id), user]),
  );
  const existingByUsername = new Map(
    currentUsers.map((user) => [
      String(user.username ?? "").toLowerCase(),
      user,
    ]),
  );
  const snapshotById = new Map(
    snapshotUsers.map((user) => [String(user.id ?? ""), user]),
  );
  const snapshotByUsername = new Map(
    snapshotUsers.map((user) => [
      String(user.username ?? "").toLowerCase(),
      user,
    ]),
  );
  const submittedUsers = rows as Array<Record<string, unknown>>;
  const submittedIds = new Set<string>(),
    submittedUsernames = new Set<string>();
  for (const submitted of submittedUsers) {
    const id = String(submitted.id ?? ""),
      username = String(submitted.username ?? "").toLowerCase();
    const databaseUser =
      existingById.get(id) ?? existingByUsername.get(username);
    const snapshotUser =
      snapshotById.get(id) ?? snapshotByUsername.get(username);
    const existing = databaseUser ?? snapshotUser;
    if (
      !existing ||
      userStateKey(submitted) !==
        userStateKey(
          databaseUser
            ? { ...databaseUser, deleted: Boolean(databaseUser.deleted_at) }
            : existing,
        )
    )
      return true;
    if (databaseUser?.id) submittedIds.add(String(databaseUser.id));
    if (snapshotUser?.id) submittedIds.add(String(snapshotUser.id));
    if (username) submittedUsernames.add(username);
  }
  return (
    currentUsers.some((user) => !submittedIds.has(String(user.id))) ||
    snapshotUsers.some(
      (user) =>
        !submittedIds.has(String(user.id ?? "")) &&
        !submittedUsernames.has(String(user.username ?? "").toLowerCase()),
    )
  );
}

function normalizePatientRow(row: Record<string, unknown>) {
  const name =
    row.name ??
    [
      row.lastName ?? row.last_name ?? "",
      row.firstName ?? row.first_name ?? "",
      row.middleInitial ?? row.middle_initial ?? "",
    ]
      .filter(Boolean)
      .join(", ");
  return {
    id: row.id ?? null,
    last_name: row.lastName ?? row.last_name ?? "",
    first_name: row.firstName ?? row.first_name ?? "",
    middle_initial: row.middleInitial ?? row.middle_initial ?? null,
    name: name || "Unknown Patient",
    course: row.course ?? "",
    institutional_category:
      row.institutionalCategory ??
      row.institutional_category ??
      row.course ??
      "",
    personnel_type: row.personnelType ?? row.personnel_type ?? null,
    year_level: row.year ?? row.yearLevel ?? row.year_level ?? "",
    gender: row.gender ?? row.sex ?? null,
    age: toNumber(row.age),
    contact: row.contact ?? null,
    guardian_name: row.guardianName ?? row.guardian_name ?? null,
    guardian_contact: row.guardianContact ?? row.guardian_contact ?? null,
    allergies: row.allergies ?? "Not Yet Assessed",
    medical_conditions:
      row.conditions ??
      row.medicalConditions ??
      row.medical_conditions ??
      "None",
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    deleted_at: normalizeDeletedAt(row),
    deleted_by: row.deletedBy ?? row.deleted_by ?? null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeMedicineRow(row: Record<string, unknown>) {
  return {
    code: row.code ?? null,
    name: row.name ?? "",
    category: row.category ?? "General",
    quantity: toNumber(row.qty ?? row.quantity) ?? 0,
    unit: row.unit ?? "piece",
    expiration_date: toDateValue(
      row.exp ?? row.expirationDate ?? row.expiration_date,
    ),
    deleted_at: normalizeDeletedAt(row),
    updated_at: new Date().toISOString(),
  };
}

function normalizeEquipmentRow(row: Record<string, unknown>) {
  const condition =
    row.condition === "Good" ||
    row.condition === "Fair" ||
    row.condition === "Poor"
      ? row.condition
      : "Poor";
  return {
    id: row.id ?? null,
    name: row.name ?? "",
    category: row.category ?? "Medical Supplies",
    quantity: toNumber(row.qty ?? row.quantity) ?? 0,
    condition,
    last_maintenance_date: toDateValue(
      row.lastMaint ?? row.lastMaintenanceDate ?? row.last_maintenance_date,
    ),
    status: row.status ?? "Available",
    deleted_at: normalizeDeletedAt(row),
    updated_at: new Date().toISOString(),
  };
}

function normalizeGuardianContacted(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (["not applicable", "not applical", "n/a", "na"].includes(normalized))
    return "Not Applicable";
  return value.trim() || null;
}

function normalizeVisitRow(
  row: Record<string, unknown>,
  requireOtherReason = false,
) {
  const medicineName =
    row.medicine ?? row.medicineName ?? row.medicine_name ?? null;
  const medicineQuantity = toNumber(
    row.medQty ?? row.medicineQuantity ?? row.medicine_quantity,
  );
  const complaint =
    typeof row.complaint === "string" ? row.complaint.trim() : "";
  const reasonOther =
    typeof row.reasonOther === "string" ? row.reasonOther.trim() : "";
  const visitDate = toDateValue(row.date ?? row.visitDate ?? row.visit_date);
  const visitTime = row.time ?? row.visitTime ?? row.visit_time;
  const outcome = typeof row.outcome === "string" ? row.outcome.trim() : "";
  const guardianContacted = normalizeGuardianContacted(
    row.guardianContacted ?? row.guardian_contacted,
  );
  if (requireOtherReason && !complaint)
    throw new Error("A reason for the clinic visit is required.");
  if (requireOtherReason && (!visitDate || !String(visitTime ?? "").trim()))
    throw new Error("A visit date and time are required.");
  if (
    requireOtherReason &&
    complaint.toLowerCase() === "other" &&
    !reasonOther
  ) {
    throw new Error(
      "Specify the custom reason when the clinic visit reason is Other.",
    );
  }
  if (
    medicineName &&
    (!Number.isInteger(medicineQuantity) || Number(medicineQuantity) <= 0)
  ) {
    throw new Error(
      "Medication quantity must be a positive whole number when a medication is selected.",
    );
  }
  const supplyName = row.supplyUsed ?? row.supply_used ?? null;
  const supplyQuantity = toNumber(
    row.supplyQty ?? row.supplyQuantity ?? row.supply_quantity,
  );
  if (
    requireOtherReason &&
    supplyName &&
    (!Number.isInteger(supplyQuantity) || Number(supplyQuantity) <= 0)
  ) {
    throw new Error(
      "Medical supply quantity must be a positive whole number when a supply is selected.",
    );
  }
  return {
    id: row.id ?? null,
    patient_id: row.studentId ?? row.patientId ?? row.patient_id ?? null,
    nurse_id: row.nurseId ?? row.nurse_id ?? null,
    nurse_name: row.nurse ?? row.nurseName ?? row.nurse_name ?? "Unknown",
    visit_date: visitDate ?? new Date().toISOString().slice(0, 10),
    visit_time: String(visitTime ?? "").trim() || "00:00",
    complaint: complaint || "",
    reason_other: complaint.toLowerCase() === "other" ? reasonOther : null,
    description: row.description ?? null,
    symptom_start: row.symptomStart ?? row.symptom_start ?? null,
    pain_level: row.painLevel ?? row.pain_level ?? null,
    pain_location: row.painLocation ?? row.pain_location ?? null,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    known_conditions: row.knownConditions ?? row.known_conditions ?? null,
    allergies_history: row.allergiesHistory ?? row.allergies_history ?? null,
    current_medication: row.currentMedication ?? row.current_medication ?? null,
    previous_similar: row.previousSimilar ?? row.previous_similar ?? null,
    last_meal: row.lastMeal ?? row.last_meal ?? null,
    weight: row.weight ?? null,
    height: row.height ?? null,
    temperature: row.temp ?? row.temperature ?? null,
    blood_pressure: row.bp ?? row.bloodPressure ?? row.blood_pressure ?? null,
    heart_rate: row.pulse ?? row.heartRate ?? row.heart_rate ?? null,
    respiratory_rate: row.respiratoryRate ?? row.respiratory_rate ?? null,
    oxygen_saturation:
      row.spo2 ?? row.oxygenSaturation ?? row.oxygen_saturation ?? null,
    assessment: row.assessment ?? null,
    assessment_other: row.assessmentOther ?? row.assessment_other ?? null,
    notes: row.notes ?? null,
    interventions: Array.isArray(row.interventions) ? row.interventions : [],
    treatment_given: row.treatmentGiven ?? row.treatment_given ?? null,
    medicine_code: row.medicineCode ?? row.medicine_code ?? null,
    medicine_name: medicineName,
    medicine_quantity: medicineName ? medicineQuantity : null,
    supply_item_id: row.supplyItemId ?? row.supply_item_id ?? null,
    equipment_used: Array.isArray(row.equipmentUsed ?? row.equipment_used)
      ? (row.equipmentUsed ?? row.equipment_used)
      : [],
    equipment_quantity: toNumber(
      row.equipmentQty ?? row.equipmentQuantity ?? row.equipment_quantity,
    ),
    supply_used: supplyName,
    supply_quantity: supplyQuantity,
    dosage: row.dosage ?? null,
    outcome: outcome || null,
    released_at: row.releasedAt ?? row.released_at ?? null,
    remarks: row.remarks ?? null,
    guardian_contacted: guardianContacted,
    guardian_method: row.guardianMethod ?? row.guardian_method ?? null,
    person_contacted: row.personContacted ?? row.person_contacted ?? null,
    staff_record: row.staffRecord ?? row.staff_record ?? null,
    position: row.position ?? null,
    status: row.deleted ? "Deleted" : (row.status ?? "Active"),
    version_of: row.versionOf ?? row.version_of ?? null,
    revision: toNumber(row.revision) ?? 1,
    supersedes_id: row.supersedesId ?? row.supersedes_id ?? null,
    superseded_by: row.supersededBy ?? row.superseded_by ?? null,
    deleted_at: normalizeDeletedAt(row),
    updated_at: new Date().toISOString(),
    created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  };
}

function parse12HourClock(value: unknown) {
  if (typeof value !== "string") return "00:00";
  const trimmed = value.trim();
  if (!trimmed) return "00:00";
  const match = trimmed.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
  if (match) {
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const timeOnly = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeOnly) {
    const hours = Number(timeOnly[1]);
    const minutes = Number(timeOnly[2]);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return "00:00";
}

function toManilaIso(dateValue: unknown, timeValue: unknown) {
  const fallbackNow = new Date();
  const dateString =
    typeof dateValue === "string" && dateValue
      ? dateValue
      : fallbackNow.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const timeString = parse12HourClock(timeValue);
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  const [hours, minutes] = timeString.split(":").map((part) => Number(part));
  if (!year || !month || !day) return fallbackNow.toISOString();
  const utcMs =
    Date.UTC(year, month - 1, day, hours, minutes, 0) - 8 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

async function resolveClinicUsers(rows: Array<Record<string, unknown>>) {
  const usernames = [
    ...new Set(
      rows
        .map((row) => row.username)
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    ),
  ];
  if (!usernames.length) return rows;
  const response = await supabaseRequest(
    `clinic_users?username=in.(${usernames.map(encodeURIComponent).join(",")})&select=id,username,auth_user_id`,
  );
  if (!response.ok) return rows;
  const users = (await response.json()) as Array<{
    id?: string;
    username?: string;
    auth_user_id?: string;
  }>;
  const existing = new Map(users.map((user) => [user.username, user]));
  return rows.map((row) => {
    const match = existing.get(String(row.username));
    if (!match?.id) return row;
    return {
      ...row,
      id: match.id,
      auth_user_id: row.auth_user_id ?? match.auth_user_id,
    };
  });
}

async function readTable(tableName: string) {
  const sortColumn =
    tableName === "medicines"
      ? "code"
      : tableName === "audit_logs"
        ? "id"
        : "id";
  const sortDirection = tableName === "audit_logs" ? "desc" : "asc";
  const pageSize = 1000;
  const rows: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += pageSize) {
    const response = await supabaseRequest(
      `${tableName}?select=*&order=${sortColumn}.${sortDirection}`,
      {
        headers: {
          Range: `${offset}-${offset + pageSize - 1}`,
          "Range-Unit": "items",
        },
      },
    );
    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `${tableName} read returned ${response.status}: ${details}`,
      );
    }
    const page = (await response.json()) as Array<Record<string, unknown>>;
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function isDeletedRecord(row: Record<string, unknown>) {
  return (
    Boolean(row.deleted) ||
    Boolean(row.deleted_at) ||
    Boolean(row.deletedAt) ||
    row.status === "Deleted"
  );
}

async function hasStaffDeleteRestoreTransition(
  tableName: string,
  key: string,
  rows: unknown,
) {
  if (!Array.isArray(rows)) return false;
  const submittedRows = rows as Array<Record<string, unknown>>;
  const existingRows = await readTable(tableName);
  const existingById = new Map(
    existingRows.map((row) => [String(row[key] ?? ""), row]),
  );
  return submittedRows.some((row) => {
    const id = String(row[key] ?? "");
    const existing = existingById.get(id);
    return (
      isDeletedRecord(row) !== Boolean(existing && isDeletedRecord(existing))
    );
  });
}

async function validateNewPatientFields(rows: Array<Record<string, unknown>>) {
  const existingPatients = await readTable("patients");
  const existingIds = new Set(
    existingPatients.map((patient) => String(patient.id ?? "")),
  );
  return rows.some((patient) => {
    if (existingIds.has(String(patient.id ?? ""))) return false;
    const category =
      patient.institutionalCategory ??
      patient.institutional_category ??
      patient.course;
    const year =
      patient.personnelType ??
      patient.personnel_type ??
      patient.year ??
      patient.yearLevel ??
      patient.year_level;
    return !String(category ?? "").trim() || !String(year ?? "").trim();
  });
}

async function hasInvalidGuardianContactChange(
  rows: Array<Record<string, unknown>>,
) {
  const existingPatients = await readTable("patients");
  const existingById = new Map(
    existingPatients.map((patient) => [String(patient.id ?? ""), patient]),
  );
  return rows.some((patient) => {
    const existing = existingById.get(String(patient.id ?? ""));
    const submittedContact =
      patient.guardianContact ?? patient.guardian_contact ?? null;
    const existingContact = existing?.guardian_contact ?? null;
    if (
      existing &&
      String(submittedContact ?? "") === String(existingContact ?? "")
    )
      return false;
    return (
      typeof submittedContact !== "string" || !/^\d{11}$/.test(submittedContact)
    );
  });
}

function patientFromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial ?? "",
    name: row.name,
    course: row.course,
    institutionalCategory: row.institutional_category ?? row.course,
    personnelType: row.personnel_type ?? "",
    year: row.personnel_type || row.year_level,
    gender: row.gender,
    sex: row.gender,
    age: row.age,
    contact: row.contact,
    guardianName: row.guardian_name,
    guardianContact: row.guardian_contact,
    allergies: row.allergies,
    conditions: row.medical_conditions,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
  };
}

function medicineFromRow(row: Record<string, unknown>) {
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    qty: row.quantity,
    unit: row.unit,
    exp: row.expiration_date,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
  };
}

function equipmentFromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? "Medical Supplies",
    qty: row.quantity,
    condition: row.condition,
    lastMaint: row.last_maintenance_date,
    status: row.status,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
  };
}

function visitFromRow(
  row: Record<string, unknown>,
  patients: Array<Record<string, unknown>>,
) {
  const patient = patients.find((candidate) => candidate.id === row.patient_id);
  return {
    id: row.id,
    date: row.visit_date,
    time: row.visit_time,
    nurse: row.nurse_name,
    nurseId: row.nurse_id,
    studentId: row.patient_id,
    studentName: patient?.name ?? row.patient_id,
    course: patient?.course,
    institutionalCategory: patient?.institutional_category ?? patient?.course,
    personnelType: patient?.personnel_type ?? "",
    year: patient?.personnel_type || patient?.year_level,
    complaint: row.complaint,
    reasonOther: row.reason_other ?? "",
    description: row.description,
    symptomStart: row.symptom_start,
    painLevel: row.pain_level,
    painLocation: row.pain_location,
    symptoms: row.symptoms,
    knownConditions: row.known_conditions,
    allergiesHistory: row.allergies_history,
    currentMedication: row.current_medication,
    previousSimilar: row.previous_similar,
    lastMeal: row.last_meal,
    weight: row.weight,
    height: row.height,
    temp: row.temperature,
    bp: row.blood_pressure,
    pulse: row.heart_rate,
    respiratoryRate: row.respiratory_rate,
    spo2: row.oxygen_saturation,
    assessment: row.assessment,
    assessmentOther: row.assessment_other,
    notes: row.notes,
    interventions: row.interventions,
    treatmentGiven: row.treatment_given,
    medicineCode: row.medicine_code,
    medicine: row.medicine_name,
    medQty: row.medicine_quantity,
    equipmentUsed: row.equipment_used,
    equipmentQty: row.equipment_quantity,
    supplyUsed: row.supply_used,
    supplyItemId: row.supply_item_id,
    supplyQty: row.supply_quantity,
    dosage: row.dosage,
    outcome: row.outcome,
    releasedAt: row.released_at,
    remarks: row.remarks,
    guardianContacted: row.guardian_contacted,
    guardianMethod: row.guardian_method,
    personContacted: row.person_contacted,
    staffRecord: row.staff_record,
    position: row.position,
    status: row.status,
    deleted: row.status === "Deleted" || Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    versionOf: row.version_of,
    revision: row.revision,
    supersedesId: row.supersedes_id,
    supersededBy: row.superseded_by,
  };
}

function userFromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    name: row.name,
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial ?? "",
    role: row.role,
    username: row.username,
    status: row.status,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
  };
}

function auditFromRow(
  row: Record<string, unknown>,
  users: Array<Record<string, unknown>> = [],
) {
  const createdAt = String(row.created_at ?? "");
  const parsedCreatedAt = new Date(createdAt);
  const validCreatedAt = createdAt && !Number.isNaN(parsedCreatedAt.getTime());
  const date = validCreatedAt
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(parsedCreatedAt)
    : "";
  const time = validCreatedAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(parsedCreatedAt)
    : "";
  const linkedUser = users.find((user) => user.id === row.user_id);
  return {
    id: row.id,
    date,
    time,
    user: row.user_name,
    userId: row.user_id,
    role: row.role ?? linkedUser?.role ?? "Unknown",
    action: row.action,
    module: row.module,
    status: row.status,
    timestamp: createdAt,
  };
}

function normalizeRestoredAuditRow(row: Record<string, unknown>) {
  const id = toNumber(row.id);
  const createdAt = row.timestamp ?? row.createdAt ?? row.created_at;
  const parsedCreatedAt =
    typeof createdAt === "string" ? new Date(createdAt) : new Date(NaN);
  const action = typeof row.action === "string" ? row.action : "";
  const module = typeof row.module === "string" ? row.module : "";
  const status =
    row.status === "Warning" || row.status === "Error" ? row.status : "Success";
  if (
    id === null ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !action ||
    !module ||
    Number.isNaN(parsedCreatedAt.getTime())
  ) {
    throw new Error("Backup contains an invalid audit log entry.");
  }
  return {
    id,
    user_id: null,
    user_name:
      typeof row.user === "string"
        ? row.user
        : typeof row.user_name === "string"
          ? row.user_name
          : "System",
    action,
    module,
    status,
    created_at: parsedCreatedAt.toISOString(),
  };
}

function settingsFromRow(row: Record<string, unknown>) {
  return {
    clinicName: row.clinic_name,
    address: row.address,
    contactNumber: row.contact_number,
    email: row.email,
    clinicOpen: row.clinic_open,
    clinicClose: row.clinic_close,
    clinicDays: row.clinic_days,
    patientIdPrefix: row.patient_id_prefix,
    lowStockThreshold: row.low_stock_threshold,
    expirationAlertDays: row.expiration_alert_days,
    passwordMinLength: row.password_min_length,
    sessionTimeout: row.session_timeout_minutes,
    dateFormat: row.date_format,
    timeFormat: row.time_format,
    timezone: row.timezone,
    language: row.language,
  };
}

async function upsertTableRows(
  tableName: string,
  conflictKey: string,
  rows: Array<Record<string, unknown>>,
) {
  if (!rows.length) return;
  const batches = new Map<string, Array<Record<string, unknown>>>();
  if (tableName === "clinic_users") {
    rows.forEach((row, index) => batches.set(`user-${index}`, [row]));
  } else {
    for (const row of rows) {
      const shape = Object.keys(row).sort().join("|");
      const batch = batches.get(shape) ?? [];
      batch.push(row);
      batches.set(shape, batch);
    }
  }
  for (const batch of batches.values()) {
    const uniqueBatch: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const row of batch) {
      const duplicateKey = String(row[conflictKey] ?? JSON.stringify(row));
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      uniqueBatch.push(row);
    }
    if (!uniqueBatch.length) continue;

    const response = await supabaseRequest(
      `${tableName}?on_conflict=${conflictKey}`,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(uniqueBatch),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `${tableName} upsert returned ${response.status}: ${text}`,
      );
    }
  }
}

async function validatePurgeRows(rows: unknown) {
  if (rows === undefined)
    return {
      requests: [] as Array<{
        table: string;
        key: string;
        value: string | number;
      }>,
      groups: [] as Array<{
        table: string;
        key: string;
        values: Array<string | number>;
      }>,
      linkedAuthUsers: [] as Array<{
        authUserId: string;
        profile: Record<string, unknown>;
      }>,
    };
  if (!Array.isArray(rows))
    throw new Error("Permanent-delete requests must be an array.");
  const allowedTables: Record<string, string> = {
    patients: "id",
    clinical_visits: "id",
    medicines: "code",
    equipment: "id",
    clinic_users: "id",
  };
  const groups = new Map<
    string,
    { table: string; key: string; values: Array<string | number> }
  >();
  const requests: Array<{
    table: string;
    key: string;
    value: string | number;
  }> = [];
  for (const item of rows) {
    if (!item || typeof item !== "object")
      throw new Error("A permanent-delete request is invalid.");
    const purge = item as { table?: unknown; key?: unknown; value?: unknown };
    if (
      typeof purge.table !== "string" ||
      typeof purge.key !== "string" ||
      allowedTables[purge.table] !== purge.key ||
      (typeof purge.value !== "string" && typeof purge.value !== "number")
    ) {
      throw new Error("The permanent-delete request is not supported.");
    }
    const request = { table: purge.table, key: purge.key, value: purge.value };
    requests.push(request);
    const groupKey = `${purge.table}:${purge.key}`;
    const group = groups.get(groupKey) ?? {
      table: purge.table,
      key: purge.key,
      values: [],
    };
    if (!group.values.some((value) => String(value) === String(purge.value)))
      group.values.push(purge.value);
    groups.set(groupKey, group);
  }
  const validatedGroups = [...groups.values()];
  const validatedRecords = await Promise.all(
    validatedGroups.map(async (group) => {
      const values = group.values
        .map(
          (value) =>
            `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
        )
        .join(",");
      const selection =
        group.table === "clinic_users"
          ? "*"
          : group.table === "clinical_visits"
            ? `${group.key},deleted_at,status`
            : `${group.key},deleted_at`;
      const lookup = await supabaseRequest(
        `${group.table}?${group.key}=${encodeURIComponent(`in.(${values})`)}&select=${selection}`,
      );
      if (!lookup.ok)
        throw new Error(
          `${group.table} delete validation returned ${lookup.status}`,
        );
      const records = (await lookup.json()) as Array<Record<string, unknown>>;
      if (
        records.length !== group.values.length ||
        records.some(
          (record) => !(record.deleted_at || record.status === "Deleted"),
        )
      ) {
        throw new Error(
          "Only records already in Deleted Records can be permanently removed.",
        );
      }
      return { group, records };
    }),
  );
  const linkedAuthUsers = validatedRecords.flatMap(({ group, records }) =>
    group.table === "clinic_users"
      ? records
          .filter(
            (record): record is Record<string, unknown> & {
              auth_user_id: string;
            } =>
              typeof record.auth_user_id === "string" &&
              Boolean(record.auth_user_id),
          )
          .map((record) => ({
            authUserId: record.auth_user_id,
            profile: record,
          }))
      : [],
  );
  return { requests, groups: validatedGroups, linkedAuthUsers };
}

async function purgeRows(
  prepared: Awaited<ReturnType<typeof validatePurgeRows>>,
) {
  if (
    prepared.groups.length !== 1 ||
    prepared.groups[0].values.length !== 1
  ) {
    throw new Error("Permanently delete one record at a time.");
  }
  for (const group of prepared.groups) {
    if (group.table === "patients") {
      const linkedVisits = await supabaseRequest(
        `clinical_visits?patient_id=eq.${encodeURIComponent(String(group.values[0]))}&select=id,status,deleted_at`,
      );
      if (!linkedVisits.ok)
        throw new Error(
          `Linked patient visits could not be checked before deletion (${linkedVisits.status}).`,
        );
      const visits = (await linkedVisits.json()) as Array<{
        status?: string;
        deleted_at?: string | null;
      }>;
      if (
        visits.some(
          (visit) => !visit.deleted_at && visit.status !== "Deleted",
        )
      ) {
        throw new Error(
          "This patient still has visit records outside Deleted Records. Delete those visits first to prevent losing clinical history.",
        );
      }
    }
    const values = group.values
      .map(
        (value) =>
          `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
      )
      .join(",");
    const deletedFilter =
      group.table === "clinical_visits"
        ? `&or=${encodeURIComponent("(deleted_at.not.is.null,status.eq.Deleted)")}`
        : "&deleted_at=not.is.null";
    const response = await supabaseRequest(
      `${group.table}?${group.key}=${encodeURIComponent(`in.(${values})`)}${deletedFilter}&select=${group.key}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      },
    );
    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `${group.table} delete returned ${response.status}: ${details}`,
      );
    }
    const deleted = (await response.json()) as Array<Record<string, unknown>>;
    const deletedIds = new Set(
      deleted.map((record) => String(record[group.key] ?? "")),
    );
    if (
      deletedIds.size !== group.values.length ||
      group.values.some((value) => !deletedIds.has(String(value)))
    ) {
      throw new Error(
        `One or more ${group.table} records changed before permanent deletion. Refresh Deleted Records and try again.`,
      );
    }
  }
  if (prepared.linkedAuthUsers.length) {
    const { url, key } = supabaseConfig();
    const results = await Promise.all(
      prepared.linkedAuthUsers.map(({ authUserId }) =>
        fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
          method: "DELETE",
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          cache: "no-store",
        }),
      ),
    );
    if (results.some((response) => !response.ok && response.status !== 404)) {
      const [user] = prepared.linkedAuthUsers;
      const rollback = await supabaseRequest("clinic_users?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(user.profile),
      });
      if (!rollback.ok) {
        const details = await rollback.text();
        throw new Error(
          `Linked authentication-account deletion failed, and the deleted clinic profile could not be restored (${rollback.status}: ${details}).`,
        );
      }
      throw new Error(
        "The linked authentication account could not be permanently deleted. The clinic profile was restored to Deleted Records; try again.",
      );
    }
  }
}

async function savePurgeHistory(
  requests: Array<{ table: string; key: string; value: string | number }>,
) {
  try {
    const snapshotResponse = await supabaseRequest(
      `clinic_state?id=eq.${clinicStateId}&select=state`,
    );
    if (!snapshotResponse.ok)
      throw new Error(
        `clinic_state purge history lookup returned ${snapshotResponse.status}`,
      );
    const snapshots = (await snapshotResponse.json()) as Array<{
      state?: Record<string, unknown>;
    }>;
    const clinicSnapshot = snapshots[0]?.state ?? {};
    const history = Array.isArray(clinicSnapshot.purged)
      ? (clinicSnapshot.purged as Array<Record<string, unknown>>)
      : [];
    const keys = new Set(
      history.map(
        (record) => `${record.table}:${record.key}:${String(record.value)}`,
      ),
    );
    clinicSnapshot.purged = [
      ...history,
      ...requests.filter((record) => {
        const key = `${record.table}:${record.key}:${String(record.value)}`;
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      }),
    ];
    const saveResponse = await supabaseRequest(`clinic_state?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: clinicStateId, state: clinicSnapshot }),
    });
    if (!saveResponse.ok)
      console.warn(
        `Optional clinic_state purge history returned ${saveResponse.status}`,
      );
  } catch (error) {
    console.warn("Unable to save optional clinic_state purge history", error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session)
      return Response.json(
        { message: "Sign in to access clinic records." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    let rows: Array<{ state: Record<string, unknown> }> = [];
    try {
      const response = await supabaseRequest(
        `clinic_state?id=eq.${clinicStateId}&select=state`,
      );
      if (response.ok)
        rows = (await response.json()) as Array<{
          state: Record<string, unknown>;
        }>;
    } catch (error) {
      console.warn("Unable to read optional clinic_state snapshot", error);
    }
    const snapshot = rows[0]?.state ?? {};
    const [
      patients,
      medicines,
      equipment,
      visits,
      users,
      auditLogs,
      settingsRows,
      syncMeta,
    ] = await Promise.all([
      readTable("patients"),
      readTable("medicines"),
      readTable("equipment"),
      readTable("clinical_visits"),
      readTable("clinic_users"),
      readTable("audit_logs"),
      readTable("clinic_settings"),
      readTable("clinic_sync_meta"),
    ]);
    const normalizedReady = syncMeta[0]?.normalized_ready === true;
    const hasAnyNormalizedRows = [
      patients,
      medicines,
      equipment,
      visits,
      users,
      auditLogs,
      settingsRows,
    ].some((table) => table.length > 0);
    const hasNormalizedData =
      normalizedReady || (!rows[0] && hasAnyNormalizedRows);
    if (!hasNormalizedData && !rows[0]) {
      return Response.json(
        { message: "No shared clinic state has been saved yet." },
        { status: 404 },
      );
    }
    const snapshotUsers = Array.isArray(snapshot.users)
      ? snapshot.users.filter(
          (user): user is Record<string, unknown> =>
            Boolean(user) && typeof user === "object",
        )
      : [];
    const storedUsernames = new Set(
      users
        .map((user) => String(user.username ?? "").toLowerCase())
        .filter(Boolean),
    );
    const missingSnapshotUsers = snapshotUsers.filter((user) => {
      const username = String(user.username ?? "").toLowerCase();
      return username && !storedUsernames.has(username);
    });
    const usersNeedBootstrap = missingSnapshotUsers.length > 0;
    const snapshotVisitById = new Map<string, Record<string, unknown>>();
    if (Array.isArray(snapshot.consultations)) {
      snapshot.consultations.forEach((visit) => {
        if (visit && typeof visit === "object") {
          const savedVisit = visit as Record<string, unknown>;
          if (savedVisit.id !== undefined)
            snapshotVisitById.set(String(savedVisit.id), savedVisit);
        }
      });
    }
    const snapshotSettings =
      snapshot.settings && typeof snapshot.settings === "object"
        ? (snapshot.settings as Record<string, unknown>)
        : {};
    const normalizedUsers = users
      .filter((user) => !user.deleted_at)
      .map(userFromRow);
    const normalized = hasNormalizedData
      ? {
          ...snapshot,
          students: patients.map(patientFromRow),
          medicines: medicines.map(medicineFromRow),
          equipment: equipment.map(equipmentFromRow),
          consultations: visits.map((visit) => {
            const normalizedVisit = visitFromRow(visit, patients);
            const savedVisit = snapshotVisitById.get(String(visit.id));
            return savedVisit
              ? {
                  ...normalizedVisit,
                  respiratoryRate: savedVisit.respiratoryRate,
                  equipmentUsed: savedVisit.equipmentUsed,
                  equipmentQty: savedVisit.equipmentQty,
                  supplyUsed: savedVisit.supplyUsed,
                  supplyQty: savedVisit.supplyQty,
                }
              : normalizedVisit;
          }),
          users: [...normalizedUsers, ...missingSnapshotUsers],
          deletedStudents: patients
            .filter((patient) => patient.deleted_at)
            .map(patientFromRow),
          deletedUsers: users
            .filter((user) => user.deleted_at)
            .map(userFromRow),
          auditLogs: auditLogs
            .filter(
              (audit) =>
                session.role !== "Staff Nurse" ||
                audit.user_id === session.userId,
            )
            .map((audit) => auditFromRow(audit, users)),
          ...(settingsRows[0]
            ? {
                settings: {
                  ...snapshotSettings,
                  ...settingsFromRow(settingsRows[0]),
                },
              }
            : {}),
          bootstrapRequired: usersNeedBootstrap,
        }
      : { ...snapshot, bootstrapRequired: true };
    return Response.json(normalized, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to read shared clinic state", error);
    return Response.json(
      { message: "Unable to read shared clinic state." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let state: unknown;
  try {
    state = await request.json();
  } catch {
    return Response.json(
      { message: "Clinic state must be a JSON object." },
      { status: 400 },
    );
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return Response.json(
      { message: "Clinic state must be a JSON object." },
      { status: 400 },
    );
  }

  try {
    const session = await readActiveClinicSession(request);
    if (!session)
      return Response.json(
        { message: "Sign in to update clinic records." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    const snapshot = state as Record<string, unknown>;
    if (snapshot.recordRestoreMutation !== undefined) {
      if (
        Object.keys(snapshot).length !== 1 ||
        !snapshot.recordRestoreMutation ||
        typeof snapshot.recordRestoreMutation !== "object" ||
        Array.isArray(snapshot.recordRestoreMutation)
      ) {
        return Response.json(
          { message: "The record restoration request is invalid." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!hasClinicAdminPrivileges(session.role)) {
        return Response.json(
          { message: "Only a Head Nurse or existing legacy administrator can restore records." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
      const mutation = snapshot.recordRestoreMutation as Record<
        string,
        unknown
      >;
      const recordType = mutation.recordType;
      const recordId =
        typeof mutation.recordId === "string" ? mutation.recordId.trim() : "";
      const table =
        recordType === "patient"
          ? "patients"
          : recordType === "user"
            ? "clinic_users"
            : null;
      if (!table || !recordId || recordId.length > 200) {
        return Response.json(
          { message: "The selected record cannot be restored." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      const lookup = await supabaseRequest(
        `${table}?id=eq.${encodeURIComponent(recordId)}&deleted_at=not.is.null&select=id${table === "clinic_users" ? ",username" : ""}&limit=1`,
      );
      if (!lookup.ok)
        throw new Error(`${table} restore lookup returned ${lookup.status}`);
      const [record] = (await lookup.json()) as Array<{
        id: string;
        username?: string;
      }>;
      if (!record) {
        return Response.json(
          { message: "This record is no longer deleted or no longer exists. Refresh the list and try again." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (table === "clinic_users") {
        const existingUsers = await readTable("clinic_users");
        if (
          existingUsers.some(
            (user) =>
              String(user.id) !== recordId &&
              !user.deleted_at &&
              String(user.username ?? "").toLowerCase() ===
                String(record.username ?? "").toLowerCase(),
          )
        ) {
          return Response.json(
            { message: "An active account already uses this username. Rename that account before restoring this user." },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
      }
      const restoreResponse = await supabaseRequest(
        `${table}?id=eq.${encodeURIComponent(recordId)}&deleted_at=not.is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(
            table === "patients"
              ? { deleted_at: null, deleted_by: null }
              : { deleted_at: null },
          ),
        },
      );
      if (!restoreResponse.ok)
        throw new Error(`${table} restore returned ${restoreResponse.status}`);
      const restored = (await restoreResponse.json()) as Array<{
        id: string;
      }>;
      if (restored.length !== 1 || restored[0].id !== recordId) {
        return Response.json(
          { message: "The record changed before it could be restored. Refresh the list and try again." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (snapshot.purgeOnly === true) {
      if (
        Object.keys(snapshot).some(
          (key) => key !== "purgeOnly" && key !== "purgeRequests",
        )
      ) {
        return Response.json(
          {
            message:
              "Permanent deletion cannot be combined with other clinic changes.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!hasClinicAdminPrivileges(session.role)) {
        return Response.json(
          {
            message:
              "Only a Head Nurse or existing legacy administrator can permanently delete clinic records.",
          },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
      const purgeRequest = await validatePurgeRows(snapshot.purgeRequests);
      if (purgeRequest.groups.length > 1) {
        return Response.json(
          { message: "Permanently delete one record type at a time." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (!purgeRequest.requests.length)
        return Response.json(
          {
            message:
              "Select at least one deleted record to permanently remove.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      if (
        purgeRequest.requests.some(
          (record) =>
            record.table === "clinic_users" &&
            String(record.value) === session.userId,
        )
      ) {
        return Response.json(
          { message: "You cannot permanently delete your signed-in account." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (purgeRequest.requests.length) {
        await purgeRows(purgeRequest);
      }
      await savePurgeHistory(purgeRequest.requests);
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (session.role === "Staff Nurse") {
      const transitions = await Promise.all([
        hasStaffDeleteRestoreTransition("patients", "id", snapshot.students),
        hasStaffDeleteRestoreTransition(
          "clinical_visits",
          "id",
          snapshot.consultations,
        ),
        snapshot.inventoryBootstrap === true
          ? hasStaffDeleteRestoreTransition(
              "medicines",
              "code",
              snapshot.medicines,
            )
          : Promise.resolve(false),
        snapshot.inventoryBootstrap === true
          ? hasStaffDeleteRestoreTransition(
              "equipment",
              "id",
              snapshot.equipment,
            )
          : Promise.resolve(false),
      ]);
      if (transitions.some(Boolean)) {
        return Response.json(
          { message: "Staff Nurses cannot delete or restore clinic records." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const persistedSnapshot = { ...snapshot };
    delete persistedSnapshot.auditLogs;
    delete persistedSnapshot.purgeRequests;
    delete persistedSnapshot.inventoryBootstrap;
    delete persistedSnapshot.visitStatusMutation;
    delete persistedSnapshot.inventoryStatusMutation;
    const inventoryMutation =
      snapshot.inventoryMutation &&
      typeof snapshot.inventoryMutation === "object"
        ? (snapshot.inventoryMutation as Record<string, unknown>)
        : null;
    if (inventoryMutation) {
      if (
        snapshot.visitMutation ||
        snapshot.visitStatusMutation ||
        snapshot.inventoryStatusMutation ||
        snapshot.purgeRequests
      )
        return Response.json(
          {
            message:
              "Inventory record saves cannot be combined with other mutations.",
          },
          { status: 400 },
        );
      const itemType = inventoryMutation.itemType;
      const itemId = String(inventoryMutation.itemId ?? "");
      const table =
        itemType === "medicine"
          ? "medicines"
          : itemType === "equipment"
            ? "equipment"
            : null;
      const key = itemType === "medicine" ? "code" : "id";
      const rows =
        table === "medicines" && Array.isArray(snapshot.medicines)
          ? (snapshot.medicines as Array<Record<string, unknown>>)
          : table === "equipment" && Array.isArray(snapshot.equipment)
            ? (snapshot.equipment as Array<Record<string, unknown>>)
            : [];
      const affected = rows.filter((row) => String(row[key] ?? "") === itemId);
      if (!table || !itemId || affected.length !== 1)
        return Response.json(
          { message: "The inventory record for this save could not be found." },
          { status: 400 },
        );

      const submitted = affected[0];
      const previousQuantity = toNumber(inventoryMutation.previousQuantity);
      if (previousQuantity !== null) {
        const currentResponse = await supabaseRequest(
          `${table}?${key}=eq.${encodeURIComponent(itemId)}&select=${key},quantity,deleted_at,updated_at`,
        );
        if (!currentResponse.ok)
          throw new Error(
            `${table} inventory check returned ${currentResponse.status}`,
          );
        const currentRows = (await currentResponse.json()) as Array<
          Record<string, unknown>
        >;
        const current = currentRows[0];
        if (currentRows.length !== 1 || !current?.updated_at) {
          return Response.json(
            {
              message:
                "This inventory item changed or was removed. Refresh the inventory list and try again.",
            },
            { status: 409 },
          );
        }
        const normalized =
          table === "medicines"
            ? normalizeMedicineRow(submitted)
            : normalizeEquipmentRow(submitted);
        if (
          session.role === "Staff Nurse" &&
          Boolean(current.deleted_at) !== Boolean(normalized.deleted_at)
        ) {
          return Response.json(
            {
              message:
                "Staff Nurses cannot delete or restore inventory records.",
            },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }
        const submittedQuantity = toNumber(normalized.quantity) ?? 0;
        const patch = { ...normalized } as Record<string, unknown>;
        delete patch[key];
        delete patch.updated_at;
        delete patch.quantity;
        if (submittedQuantity !== previousQuantity)
          patch.quantity = submittedQuantity;
        const updateResponse = await supabaseRequest(
          `${table}?${key}=eq.${encodeURIComponent(itemId)}&updated_at=eq.${encodeURIComponent(String(current.updated_at))}&select=${key}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(patch),
          },
        );
        if (!updateResponse.ok) {
          const details = await updateResponse.text();
          throw new Error(
            `${table} inventory update returned ${updateResponse.status}: ${details}`,
          );
        }
        const updatedRows = (await updateResponse.json()) as Array<
          Record<string, unknown>
        >;
        if (updatedRows.length !== 1) {
          return Response.json(
            {
              message:
                "Inventory changed while this item was being edited. Refresh the list and try again.",
            },
            { status: 409 },
          );
        }
      } else {
        const normalized =
          table === "medicines"
            ? normalizeMedicineRow(submitted)
            : normalizeEquipmentRow(submitted);
        if (session.role === "Staff Nurse" && Boolean(normalized.deleted_at)) {
          return Response.json(
            {
              message:
                "Staff Nurses cannot delete or restore inventory records.",
            },
            { status: 403, headers: { "Cache-Control": "no-store" } },
          );
        }
        const insertResponse = await supabaseRequest(table, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(normalized),
        });
        if (!insertResponse.ok) {
          if (insertResponse.status === 409 || insertResponse.status === 422) {
            return Response.json(
              {
                message:
                  "An inventory item with this ID already exists. Refresh the list and try again.",
              },
              { status: 409, headers: { "Cache-Control": "no-store" } },
            );
          }
          const details = await insertResponse.text();
          throw new Error(
            `${table} inventory insert returned ${insertResponse.status}: ${details}`,
          );
        }
      }
      try {
        const currentSnapshotResponse = await supabaseRequest(
          `clinic_state?id=eq.${clinicStateId}&select=state`,
        );
        if (!currentSnapshotResponse.ok)
          throw new Error(
            `clinic_state inventory snapshot read returned ${currentSnapshotResponse.status}`,
          );
        const currentSnapshots =
          (await currentSnapshotResponse.json()) as Array<{
            state?: Record<string, unknown>;
          }>;
        const currentState = currentSnapshots[0]?.state ?? {};
        const stateUpdate = {
          ...currentState,
          inventoryTransactions: Array.isArray(snapshot.inventoryTransactions)
            ? snapshot.inventoryTransactions
            : (currentState.inventoryTransactions ?? []),
          savedAt: snapshot.savedAt ?? new Date().toISOString(),
        };
        const snapshotResponse = await supabaseRequest("clinic_state", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ id: clinicStateId, state: stateUpdate }),
        });
        if (!snapshotResponse.ok)
          console.warn(
            `Optional clinic_state inventory snapshot returned ${snapshotResponse.status}`,
          );
      } catch (error) {
        console.warn(
          "Unable to save optional clinic_state inventory snapshot",
          error,
        );
      }
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const inventoryStatusMutation =
      snapshot.inventoryStatusMutation &&
      typeof snapshot.inventoryStatusMutation === "object"
        ? (snapshot.inventoryStatusMutation as Record<string, unknown>)
        : null;
    if (inventoryStatusMutation) {
      if (session.role === "Staff Nurse")
        return Response.json(
          {
            message: "Staff Nurses cannot delete or restore inventory records.",
          },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      if (
        snapshot.visitMutation ||
        snapshot.visitStatusMutation ||
        snapshot.purgeRequests
      ) {
        return Response.json(
          {
            message:
              "Inventory status changes cannot be combined with other mutations.",
          },
          { status: 400 },
        );
      }
      const itemType = inventoryStatusMutation.itemType;
      const itemId = String(inventoryStatusMutation.itemId ?? "");
      const table =
        itemType === "medicine"
          ? "medicines"
          : itemType === "equipment"
            ? "equipment"
            : null;
      const key = itemType === "medicine" ? "code" : "id";
      if (
        !table ||
        !itemId ||
        typeof inventoryStatusMutation.deleted !== "boolean"
      ) {
        return Response.json(
          { message: "The inventory status change is invalid." },
          { status: 400 },
        );
      }
      const expectedStatus = inventoryStatusMutation.deleted
        ? "is.null"
        : "not.is.null";
      const response = await supabaseRequest(
        `${table}?${key}=eq.${encodeURIComponent(itemId)}&deleted_at=${expectedStatus}&select=${key}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            deleted_at: inventoryStatusMutation.deleted
              ? new Date().toISOString()
              : null,
          }),
        },
      );
      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `${table} status update returned ${response.status}: ${details}`,
        );
      }
      const affected = (await response.json()) as Array<
        Record<string, unknown>
      >;
      if (
        affected.length !== 1 ||
        String(affected[0]?.[key] ?? "") !== itemId
      )
        return Response.json(
          {
            message:
              "The inventory record changed before this action completed. Refresh the list and try again.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const clinicUsersChanged = await hasClinicUserChanges(snapshot.users);
    if (clinicUsersChanged && !hasClinicAdminPrivileges(session.role)) {
      return Response.json(
        {
          message:
            "Only a Head Nurse or existing legacy administrator can change clinic accounts.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (clinicUsersChanged) {
      const submittedUsers = Array.isArray(snapshot.users)
        ? (snapshot.users as Array<Record<string, unknown>>)
        : [];
      const existingUsers = await readTable("clinic_users");
      const existingUsersById = new Map(
        existingUsers.map((user) => [String(user.id ?? ""), user]),
      );
      const invalidRole = submittedUsers.some((user) => {
        const role = user.role;
        if (
          role !== "Head Nurse" &&
          role !== "Staff Nurse" &&
          role !== "Head Nurse & Administrator"
        )
          return true;
        return (
          role === "Head Nurse & Administrator" &&
          existingUsersById.get(String(user.id ?? ""))?.role !==
            "Head Nurse & Administrator"
        );
      });
      if (invalidRole)
        return Response.json(
          {
            message:
              "Select Head Nurse or Staff Nurse. The legacy administrator role cannot be assigned to new accounts.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      const activeAdministrators = submittedUsers.filter(
        (user) =>
          hasClinicAdminPrivileges(String(user.role ?? "")) &&
          user.status === "Active" &&
          !user.deleted &&
          !user.deletedAt,
      );
      const requestingUser = submittedUsers.find(
        (user) => String(user.id ?? "") === session.userId,
      );
      if (!activeAdministrators.length) {
        return Response.json(
          {
            message:
              "At least one active Head Nurse or legacy administrator account must remain.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (
        !requestingUser ||
        requestingUser.status !== "Active" ||
        requestingUser.deleted ||
        requestingUser.deletedAt
      ) {
        return Response.json(
          {
            message:
              "The signed-in account cannot be disabled or deleted by this change.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (
        hasClinicAdminPrivileges(session.role) &&
        !hasClinicAdminPrivileges(String(requestingUser.role ?? ""))
      ) {
        return Response.json(
          {
            message:
              "Use another Head Nurse account to change your own administrative role.",
          },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    const purgeRequest = await validatePurgeRows(snapshot.purgeRequests);
    if (
      purgeRequest.requests.length &&
      !hasClinicAdminPrivileges(session.role)
    ) {
      return Response.json(
        {
          message:
            "Only a Head Nurse or existing legacy administrator can permanently delete clinic records.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      purgeRequest.requests.some(
        (record) =>
          record.table === "clinic_users" &&
          String(record.value) === session.userId,
      )
    ) {
      return Response.json(
        { message: "You cannot permanently delete your signed-in account." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (purgeRequest.requests.length) {
      if (snapshot.visitMutation)
        return Response.json(
          {
            message: "Permanent deletion cannot be combined with a visit save.",
          },
          { status: 400 },
        );
      const history = Array.isArray(snapshot.purged)
        ? (snapshot.purged as Array<Record<string, unknown>>)
        : [];
      const historyKeys = new Set(
        history.map(
          (record) => `${record.table}:${record.key}:${String(record.value)}`,
        ),
      );
      persistedSnapshot.purged = [
        ...history,
        ...purgeRequest.requests.filter(
          (record) =>
            !historyKeys.has(
              `${record.table}:${record.key}:${String(record.value)}`,
            ),
        ),
      ];
    }
    const visitMutation =
      snapshot.visitMutation && typeof snapshot.visitMutation === "object"
        ? (snapshot.visitMutation as Record<string, unknown>)
        : null;

    if (visitMutation) {
      if (
        snapshot.visitStatusMutation ||
        snapshot.inventoryStatusMutation ||
        snapshot.inventoryMutation
      ) {
        return Response.json(
          {
            message:
              "Clinical visit saves cannot be combined with inventory status changes.",
          },
          { status: 400 },
        );
      }
      const visitIds = new Set(
        Array.isArray(visitMutation.visitIds)
          ? visitMutation.visitIds.map(String)
          : [],
      );
      const patientIds = new Set(
        Array.isArray(visitMutation.patientIds)
          ? visitMutation.patientIds.map(String)
          : [],
      );
      const visits = Array.isArray(snapshot.consultations)
        ? (snapshot.consultations as Array<Record<string, unknown>>)
        : [];
      const patients = Array.isArray(snapshot.students)
        ? (snapshot.students as Array<Record<string, unknown>>)
        : [];
      const affectedVisits = visits.filter((row) =>
        visitIds.has(String(row.id)),
      );
      const affectedPatients = patients.filter((row) =>
        patientIds.has(String(row.id)),
      );
      const visitToSave = affectedVisits.find(
        (row) => row.status !== "Superseded",
      );
      const createPatient = visitMutation.createPatient === true;
      const updateVisit = visitMutation.updateVisit === true;

      if (createPatient) {
        return Response.json(
          {
            message:
              "Save the patient profile first, then create a separate clinical visit.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (affectedVisits.length !== visitIds.size)
        throw new Error(
          "A visit record for this save could not be found in the submitted state.",
        );
      if (affectedPatients.length !== patientIds.size)
        throw new Error(
          "A patient record for this save could not be found in the submitted state.",
        );
      if (!visitToSave)
        throw new Error(
          "The new clinical visit for this save could not be found.",
        );
      if (updateVisit && (visitIds.size !== 1 || patientIds.size !== 1)) {
        return Response.json(
          {
            message:
              "Updating a clinical visit requires exactly one existing visit and its patient.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (visitToSave.deleted || visitToSave.status === "Deleted")
        return Response.json(
          { message: "A new clinical visit cannot be saved as deleted." },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      if (await hasInvalidGuardianContactChange(affectedPatients)) {
        return Response.json(
          {
            message:
              "Parent / Guardian Contact must contain exactly 11 digits.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      let normalizedVisit: ReturnType<typeof normalizeVisitRow>;
      try {
        normalizedVisit = normalizeVisitRow(
          visitToSave,
          visitToSave.status !== "Superseded",
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The clinical visit details are invalid.";
        return Response.json(
          { message },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      const patient = affectedPatients.find(
        (row) => String(row.id) === String(normalizedVisit.patient_id),
      );
      const rpcName = updateVisit
        ? "update_clinical_visit_with_inventory"
        : "save_clinical_visit_with_inventory";
      const rpcResponse = await supabaseRequest(`rpc/${rpcName}`, {
        method: "POST",
        body: JSON.stringify({
          p_visit: normalizedVisit,
          p_patient_allergies: patient?.allergies ?? "Not Yet Assessed",
        }),
      });
      if (!rpcResponse.ok) {
        const details = await rpcResponse.text();
        const message = (() => {
          try {
            const parsed = JSON.parse(details) as {
              message?: string;
              details?: string;
            };
            return (
              parsed.message ||
              parsed.details ||
              "The visit could not be saved."
            );
          } catch {
            return "The visit could not be saved.";
          }
        })();
        const insufficientStock = /available|stock|inventory/i.test(message);
        return Response.json(
          { message },
          {
            status: insufficientStock ? 409 : 400,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }

      const { visitMutation: _visitMutation, ...clinicSnapshot } =
        persistedSnapshot;
      try {
        const snapshotResponse = await supabaseRequest("clinic_state", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ id: clinicStateId, state: clinicSnapshot }),
        });
        if (!snapshotResponse.ok)
          console.warn(
            `Optional clinic_state visit snapshot returned ${snapshotResponse.status}`,
          );
      } catch (error) {
        console.warn(
          "Unable to save optional clinic_state visit snapshot",
          error,
        );
      }
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const visitStatusMutation =
      snapshot.visitStatusMutation &&
      typeof snapshot.visitStatusMutation === "object"
        ? (snapshot.visitStatusMutation as Record<string, unknown>)
        : null;
    if (visitStatusMutation) {
      if (session.role === "Staff Nurse")
        return Response.json(
          { message: "Staff Nurses cannot delete or restore clinical visits." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      if (
        snapshot.inventoryMutation ||
        snapshot.inventoryStatusMutation ||
        snapshot.visitMutation ||
        snapshot.purgeRequests
      ) {
        return Response.json(
          {
            message:
              "Visit status changes cannot be combined with other record mutations.",
          },
          { status: 400 },
        );
      }
      const visitId = String(visitStatusMutation.visitId ?? "");
      const deleted = visitStatusMutation.deleted === true;
      const submittedVisits = Array.isArray(snapshot.consultations)
        ? (snapshot.consultations as Array<Record<string, unknown>>)
        : [];
      const submittedVisit = submittedVisits.find(
        (row) => String(row.id) === visitId,
      );
      if (
        !visitId ||
        !submittedVisit ||
        Boolean(submittedVisit.deleted) !== deleted
      ) {
        return Response.json(
          { message: "The clinical visit status change is invalid." },
          { status: 400 },
        );
      }
      const rpcResponse = await supabaseRequest(
        "rpc/set_clinical_visit_inventory_status",
        {
          method: "POST",
          body: JSON.stringify({
            p_visit_id: visitId,
            p_deleted: deleted,
            p_restore_patient:
              !deleted && visitStatusMutation.restorePatient === true,
          }),
        },
      );
      if (!rpcResponse.ok) {
        const details = await rpcResponse.text();
        let message = "The clinical visit could not be updated.";
        try {
          const parsed = JSON.parse(details) as {
            message?: string;
            details?: string;
          };
          message = parsed.message || parsed.details || message;
        } catch {
          message = "The clinical visit could not be updated.";
        }
        return Response.json(
          { message },
          {
            status: /inventory|stock|available/i.test(message) ? 409 : 400,
            headers: { "Cache-Control": "no-store" },
          },
        );
      }
      try {
        const snapshotResponse = await supabaseRequest("clinic_state", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ id: clinicStateId, state: persistedSnapshot }),
        });
        if (!snapshotResponse.ok)
          console.warn(
            `Optional clinic_state visit-status snapshot returned ${snapshotResponse.status}`,
          );
      } catch (error) {
        console.warn(
          "Unable to save optional clinic_state visit-status snapshot",
          error,
        );
      }
      return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const syncMeta =
      snapshot.inventoryBootstrap === true ||
      Array.isArray(snapshot.consultations)
        ? await readTable("clinic_sync_meta")
        : [];
    const normalizedReady = syncMeta[0]?.normalized_ready === true;

    if (Array.isArray(snapshot.students)) {
      const patients = snapshot.students as Array<Record<string, unknown>>;
      if (await validateNewPatientFields(patients)) {
        return Response.json(
          {
            message:
              "Institutional category and year level or personnel type are required for new patients.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (await hasInvalidGuardianContactChange(patients)) {
        return Response.json(
          {
            message:
              "Parent / Guardian Contact must contain exactly 11 digits.",
          },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      await upsertTableRows(
        "patients",
        "id",
        patients.map(normalizePatientRow),
      );
    }
    if (snapshot.inventoryBootstrap === true) {
      const [existingMedicines, existingEquipment]: [
        Array<Record<string, unknown>>,
        Array<Record<string, unknown>>,
      ] = normalizedReady
        ? await Promise.all([readTable("medicines"), readTable("equipment")])
        : [[], []];
      const knownMedicineCodes = new Set(
        existingMedicines.map((row) => String(row.code)),
      );
      const knownEquipmentIds = new Set(
        existingEquipment.map((row) => String(row.id)),
      );
      if (Array.isArray(snapshot.medicines)) {
        const records = snapshot.medicines as Array<Record<string, unknown>>;
        await upsertTableRows(
          "medicines",
          "code",
          records
            .filter(
              (row) =>
                !normalizedReady || !knownMedicineCodes.has(String(row.code)),
            )
            .map(normalizeMedicineRow),
        );
      }
      if (Array.isArray(snapshot.equipment)) {
        const records = snapshot.equipment as Array<Record<string, unknown>>;
        await upsertTableRows(
          "equipment",
          "id",
          records
            .filter(
              (row) =>
                !normalizedReady || !knownEquipmentIds.has(String(row.id)),
            )
            .map(normalizeEquipmentRow),
        );
      }
    }
    if (Array.isArray(snapshot.consultations) && !normalizedReady) {
      await upsertTableRows(
        "clinical_visits",
        "id",
        snapshot.consultations.map((row) =>
          normalizeVisitRow(row as Record<string, unknown>),
        ),
      );
    }
    if (
      Array.isArray(snapshot.users) &&
      hasClinicAdminPrivileges(session.role)
    ) {
      const userRows = snapshot.users.map((row) =>
        normalizeUserRow(row as Record<string, unknown>),
      );
      await upsertTableRows(
        "clinic_users",
        "id",
        await resolveClinicUsers(userRows),
      );
    }
    if (snapshot.settings && typeof snapshot.settings === "object") {
      const settings = snapshot.settings as Record<string, unknown>;
      await upsertTableRows("clinic_settings", "id", [
        {
          id: 1,
          clinic_name:
            settings.clinicName ?? settings.clinic_name ?? "MQC School Clinic",
          address: settings.address ?? null,
          contact_number:
            settings.contactNumber ?? settings.contact_number ?? null,
          email: settings.email ?? null,
          clinic_open: settings.clinicOpen ?? settings.clinic_open ?? null,
          clinic_close: settings.clinicClose ?? settings.clinic_close ?? null,
          clinic_days: Array.isArray(settings.clinicDays)
            ? settings.clinicDays
            : [],
          patient_id_prefix:
            settings.patientIdPrefix ?? settings.patient_id_prefix ?? null,
          low_stock_threshold:
            toNumber(
              settings.lowStockThreshold ?? settings.low_stock_threshold,
            ) ?? 15,
          expiration_alert_days:
            toNumber(
              settings.expirationAlertDays ?? settings.expiration_alert_days,
            ) ?? 14,
          password_min_length:
            toNumber(
              settings.passwordMinLength ?? settings.password_min_length,
            ) ?? 8,
          session_timeout_minutes:
            toNumber(
              settings.sessionTimeout ?? settings.session_timeout_minutes,
            ) ?? 30,
          date_format:
            settings.dateFormat ?? settings.date_format ?? "MMM D, YYYY",
          time_format: settings.timeFormat ?? settings.time_format ?? "12-hour",
          timezone: settings.timezone ?? "Asia/Manila",
          language: settings.language ?? "English",
          updated_at: new Date().toISOString(),
        },
      ]);
    }
    await purgeRows(purgeRequest);

    try {
      const snapshotResponse = await supabaseRequest("clinic_state", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: clinicStateId, state: persistedSnapshot }),
      });
      if (!snapshotResponse.ok) {
        console.warn(
          `Optional clinic_state snapshot returned ${snapshotResponse.status}`,
        );
      }
    } catch (error) {
      console.warn("Unable to save optional clinic_state snapshot", error);
    }

    const syncMetaResponse = await supabaseRequest(
      "clinic_sync_meta?on_conflict=id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: 1,
          normalized_ready: true,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!syncMetaResponse.ok) {
      console.warn(`clinic_sync_meta returned ${syncMetaResponse.status}`);
    }

    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to save shared clinic state", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save shared clinic state.";
    return Response.json({ message }, { status: 500 });
  }
}
