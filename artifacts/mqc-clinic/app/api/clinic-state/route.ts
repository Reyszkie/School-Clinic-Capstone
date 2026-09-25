const clinicStateId = 1;

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function normalizeUserRow(row: Record<string, unknown>) {
  const computedName = row.name ?? [row.lastName ?? row.last_name ?? "", row.firstName ?? row.first_name ?? ""].filter(Boolean).join(", ");
  const normalized: Record<string, unknown> = {
    id: row.id ?? null,
    name: computedName || null,
    last_name: row.lastName ?? row.last_name ?? "",
    first_name: row.firstName ?? row.first_name ?? "",
    middle_initial: row.middleInitial ?? row.middle_initial ?? null,
    role: row.role ?? "Staff Nurse",
    username: row.username ?? null,
    status: row.status ?? "Active",
    deleted_at: row.deleted ? new Date().toISOString() : toDateValue(row.deletedAt ?? row.deleted_at),
    updated_at: new Date().toISOString(),
  };
  if (row.authUserId !== undefined || row.auth_user_id !== undefined) normalized.auth_user_id = row.authUserId ?? row.auth_user_id;
  if (row.passwordHash !== undefined || row.password_hash !== undefined) normalized.password_hash = row.passwordHash ?? row.password_hash;
  return normalized;
}

function normalizePatientRow(row: Record<string, unknown>) {
  const name = row.name ?? [row.lastName ?? row.last_name ?? "", row.firstName ?? row.first_name ?? "", row.middleInitial ?? row.middle_initial ?? ""].filter(Boolean).join(", ");
  return {
    id: row.id ?? null,
    last_name: row.lastName ?? row.last_name ?? "",
    first_name: row.firstName ?? row.first_name ?? "",
    middle_initial: row.middleInitial ?? row.middle_initial ?? null,
    name: name || "Unknown Patient",
    course: row.course ?? "",
    year_level: row.year ?? row.yearLevel ?? row.year_level ?? "",
    gender: row.gender ?? row.sex ?? null,
    age: toNumber(row.age),
    contact: row.contact ?? null,
    guardian_name: row.guardianName ?? row.guardian_name ?? null,
    guardian_contact: row.guardianContact ?? row.guardian_contact ?? null,
    allergies: row.allergies ?? "None known",
    medical_conditions: row.conditions ?? row.medicalConditions ?? row.medical_conditions ?? "None",
    deleted_at: row.deleted ? new Date().toISOString() : toDateValue(row.deletedAt ?? row.deleted_at),
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
    batch_number: row.batch ?? row.batchNumber ?? row.batch_number ?? null,
    expiration_date: toDateValue(row.exp ?? row.expirationDate ?? row.expiration_date),
    supplier: row.supplier ?? null,
    deleted_at: row.deleted ? new Date().toISOString() : toDateValue(row.deletedAt ?? row.deleted_at),
    updated_at: new Date().toISOString(),
  };
}

function normalizeEquipmentRow(row: Record<string, unknown>) {
  const condition = row.condition === "Good" || row.condition === "Fair" || row.condition === "Poor" ? row.condition : "Poor";
  return {
    id: row.id ?? null,
    name: row.name ?? "",
    quantity: toNumber(row.qty ?? row.quantity) ?? 0,
    condition,
    last_maintenance_date: toDateValue(row.lastMaint ?? row.lastMaintenanceDate ?? row.last_maintenance_date),
    status: row.status ?? "Available",
    deleted_at: row.deleted ? new Date().toISOString() : toDateValue(row.deletedAt ?? row.deleted_at),
    updated_at: new Date().toISOString(),
  };
}

function normalizeVisitRow(row: Record<string, unknown>) {
  return {
    id: row.id ?? null,
    patient_id: row.studentId ?? row.patientId ?? row.patient_id ?? null,
    nurse_id: row.nurseId ?? row.nurse_id ?? null,
    nurse_name: row.nurse ?? row.nurseName ?? row.nurse_name ?? "Unknown",
    visit_date: toDateValue(row.date ?? row.visitDate ?? row.visit_date) ?? new Date().toISOString().slice(0, 10),
    visit_time: row.time ?? row.visitTime ?? row.visit_time ?? "00:00",
    complaint: row.complaint ?? "",
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
    oxygen_saturation: row.spo2 ?? row.oxygenSaturation ?? row.oxygen_saturation ?? null,
    assessment: row.assessment ?? null,
    assessment_other: row.assessmentOther ?? row.assessment_other ?? null,
    notes: row.notes ?? null,
    interventions: Array.isArray(row.interventions) ? row.interventions : [],
    treatment_given: row.treatmentGiven ?? row.treatment_given ?? null,
    medicine_code: row.medicineCode ?? row.medicine_code ?? null,
    medicine_name: row.medicine ?? row.medicineName ?? row.medicine_name ?? null,
    medicine_quantity: toNumber(row.medQty ?? row.medicineQuantity ?? row.medicine_quantity),
    dosage: row.dosage ?? null,
    outcome: row.outcome ?? "Treated and Released",
    released_at: row.releasedAt ?? row.released_at ?? null,
    remarks: row.remarks ?? null,
    guardian_contacted: row.guardianContacted ?? row.guardian_contacted ?? null,
    guardian_method: row.guardianMethod ?? row.guardian_method ?? null,
    person_contacted: row.personContacted ?? row.person_contacted ?? null,
    staff_record: row.staffRecord ?? row.staff_record ?? null,
    position: row.position ?? null,
    status: row.deleted ? "Deleted" : (row.status ?? "Active"),
    version_of: row.versionOf ?? row.version_of ?? null,
    revision: toNumber(row.revision) ?? 1,
    supersedes_id: row.supersedesId ?? row.supersedes_id ?? null,
    superseded_by: row.supersededBy ?? row.superseded_by ?? null,
    deleted_at: row.deleted ? new Date().toISOString() : toDateValue(row.deletedAt ?? row.deleted_at),
    updated_at: new Date().toISOString(),
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
  const dateString = typeof dateValue === "string" && dateValue ? dateValue : fallbackNow.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  const timeString = parse12HourClock(timeValue);
  const [year, month, day] = dateString.split("-").map((part) => Number(part));
  const [hours, minutes] = timeString.split(":").map((part) => Number(part));
  if (!year || !month || !day) return fallbackNow.toISOString();
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - (8 * 60 * 60 * 1000);
  return new Date(utcMs).toISOString();
}

function normalizeAuditLogRow(row: Record<string, unknown>, fallbackIndex = 0) {
  const createdAt = toDateValue(row.createdAt ?? row.created_at) ?? toManilaIso(row.date, row.time);
  const identity = `${createdAt}|${row.user ?? row.user_name ?? ""}|${row.userId ?? row.user_id ?? ""}|${row.action ?? ""}|${row.module ?? ""}|${row.status ?? ""}`;
  let stableId = 0;
  for (const character of identity) stableId = (stableId * 31 + character.charCodeAt(0)) % 2147483647;
  const normalized = {
    user_id: row.userId ?? row.user_id ?? null,
    user_name: row.userName ?? row.user_name ?? "Unknown User",
    action: row.action ?? "System Action",
    module: row.module ?? "System",
    status: row.status ?? "Success",
    created_at: createdAt,
  };
  const suppliedId = Number(row.id);
  return { id: Number.isSafeInteger(suppliedId) && suppliedId > 0 ? suppliedId : stableId || fallbackIndex + 1, ...normalized };
}

function auditTimestamp(date: unknown, time: unknown) {
  return toManilaIso(date, time);
}

async function resolveAuditUsers(rows: Array<Record<string, unknown>>) {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter((value): value is string => typeof value === "string" && value.length > 0))];
  if (!userIds.length) return rows;
  const response = await supabaseRequest(`clinic_users?id=in.(${userIds.map(encodeURIComponent).join(",")})&select=id,name`);
  if (!response.ok) return rows;
  const users = (await response.json()) as Array<{ id?: string; name?: string }>;
  const names = new Map(users.map((user) => [user.id, user.name]));
  return rows.map((row) => ({ ...row, user_name: names.get(String(row.user_id)) ?? row.user_name }));
}

async function resolveClinicUsers(rows: Array<Record<string, unknown>>) {
  const usernames = [...new Set(rows.map((row) => row.username).filter((value): value is string => typeof value === "string" && value.length > 0))];
  if (!usernames.length) return rows;
  const response = await supabaseRequest(`clinic_users?username=in.(${usernames.map(encodeURIComponent).join(",")})&select=id,username,auth_user_id`);
  if (!response.ok) return rows;
  const users = (await response.json()) as Array<{ id?: string; username?: string; auth_user_id?: string }>;
  const existing = new Map(users.map((user) => [user.username, user]));
  return rows.map((row) => {
    const match = existing.get(String(row.username));
    if (!match?.id) return row;
    return { ...row, id: match.id, auth_user_id: row.auth_user_id ?? match.auth_user_id };
  });
}

async function readTable(tableName: string) {
  const response = await supabaseRequest(`${tableName}?select=*`);
  if (!response.ok) throw new Error(`${tableName} read returned ${response.status}`);
  return response.json() as Promise<Array<Record<string, unknown>>>;
}

function patientFromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    lastName: row.last_name,
    firstName: row.first_name,
    middleInitial: row.middle_initial ?? "",
    name: row.name,
    course: row.course,
    year: row.year_level,
    gender: row.gender,
    sex: row.gender,
    age: row.age,
    contact: row.contact,
    guardianName: row.guardian_name,
    guardianContact: row.guardian_contact,
    allergies: row.allergies,
    conditions: row.medical_conditions,
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
    batch: row.batch_number,
    exp: row.expiration_date,
    supplier: row.supplier,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
  };
}

function equipmentFromRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    qty: row.quantity,
    condition: row.condition,
    lastMaint: row.last_maintenance_date,
    status: row.status,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
  };
}

function visitFromRow(row: Record<string, unknown>, patients: Array<Record<string, unknown>>) {
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
    year: patient?.year_level,
    complaint: row.complaint,
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
    spo2: row.oxygen_saturation,
    assessment: row.assessment,
    assessmentOther: row.assessment_other,
    notes: row.notes,
    interventions: row.interventions,
    treatmentGiven: row.treatment_given,
    medicineCode: row.medicine_code,
    medicine: row.medicine_name,
    medQty: row.medicine_quantity,
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

function auditFromRow(row: Record<string, unknown>, users: Array<Record<string, unknown>> = []) {
  const createdAt = String(row.created_at ?? "");
  const date = createdAt.slice(0, 10);
  const time = createdAt ? new Date(createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
  const linkedUser = users.find((user) => user.id === row.user_id);
  return { id: row.id, date, time, user: linkedUser?.name ?? row.user_name, userId: row.user_id, action: row.action, module: row.module, status: row.status };
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

async function upsertTableRows(tableName: string, conflictKey: string, rows: Array<Record<string, unknown>>) {
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

    const response = await supabaseRequest(`${tableName}?on_conflict=${conflictKey}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(uniqueBatch),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${tableName} upsert returned ${response.status}: ${text}`);
    }
  }
}

async function syncAuditRows(rows: Array<Record<string, unknown>>) {
  const normalizedRows = rows.map((row, index) => normalizeAuditLogRow(row, index));
  const localIds = new Set(normalizedRows.map((row) => String(row.id)));
  const existingRows = await readTable("audit_logs");
  const staleRows = existingRows.filter((row) => !localIds.has(String(row.id)));
  for (const staleRow of staleRows) {
    const deleteResponse = await supabaseRequest(`audit_logs?id=eq.${encodeURIComponent(String(staleRow.id))}`, { method: "DELETE" });
    if (!deleteResponse.ok) {
      throw new Error(`audit_logs delete returned ${deleteResponse.status}`);
    }
  }
  if (!normalizedRows.length) return;
  const rowsToSync = await resolveAuditUsers(normalizedRows.filter((row) => row.user_id != null && String(row.user_id).trim() !== ""));
  await upsertTableRows("audit_logs", "id", rowsToSync);
}

async function purgeRows(rows: unknown) {
  if (!Array.isArray(rows)) return;
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const purge = item as { table?: unknown; key?: unknown; value?: unknown };
    if (typeof purge.table !== "string" || typeof purge.key !== "string" || (typeof purge.value !== "string" && typeof purge.value !== "number")) continue;
    if (purge.table === "patients" && purge.key === "id") {
      const visitsResponse = await supabaseRequest(`clinical_visits?patient_id=eq.${encodeURIComponent(String(purge.value))}`, { method: "DELETE" });
      if (!visitsResponse.ok) throw new Error(`clinical_visits delete returned ${visitsResponse.status}`);
    }
    const response = await supabaseRequest(`${purge.table}?${purge.key}=eq.${encodeURIComponent(String(purge.value))}`, { method: "DELETE" });
    if (!response.ok) throw new Error(`${purge.table} delete returned ${response.status}`);
  }
}

export async function GET() {
  try {
    let rows: Array<{ state: Record<string, unknown> }> = [];
    try {
      const response = await supabaseRequest(`clinic_state?id=eq.${clinicStateId}&select=state`);
      if (response.ok) rows = (await response.json()) as Array<{ state: Record<string, unknown> }>;
    } catch (error) {
      console.warn("Unable to read optional clinic_state snapshot", error);
    }
    const snapshot = rows[0]?.state ?? {};
    const [patients, medicines, equipment, visits, users, auditLogs, settingsRows, syncMeta] = await Promise.all([
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
    const hasAnyNormalizedRows = [patients, medicines, equipment, visits, users, auditLogs, settingsRows].some((table) => table.length > 0);
    const hasNormalizedData = normalizedReady || (!rows[0] && hasAnyNormalizedRows);
    if (!hasNormalizedData && !rows[0]) {
      return Response.json({ message: "No shared clinic state has been saved yet." }, { status: 404 });
    }
    const snapshotUsers = Array.isArray(snapshot.users) ? snapshot.users.filter((user): user is Record<string, unknown> => Boolean(user) && typeof user === "object") : [];
    const storedUsernames = new Set(users.map((user) => String(user.username ?? "").toLowerCase()).filter(Boolean));
    const missingSnapshotUsers = snapshotUsers.filter((user) => {
      const username = String(user.username ?? "").toLowerCase();
      return username && !storedUsernames.has(username);
    });
    const usersNeedBootstrap = missingSnapshotUsers.length > 0;
    const normalizedUsers = users.filter((user) => !user.deleted_at).map(userFromRow);
    const normalized = hasNormalizedData ? {
      ...snapshot,
      students: patients.map(patientFromRow),
      medicines: medicines.map(medicineFromRow),
      equipment: equipment.map(equipmentFromRow),
      consultations: visits.map((visit) => visitFromRow(visit, patients)),
      users: [...normalizedUsers, ...missingSnapshotUsers],
      deletedStudents: patients.filter((patient) => patient.deleted_at).map(patientFromRow),
      deletedUsers: users.filter((user) => user.deleted_at).map(userFromRow),
      auditLogs: auditLogs.map((audit) => auditFromRow(audit, users)),
      ...(settingsRows[0] ? { settings: settingsFromRow(settingsRows[0]) } : {}),
      bootstrapRequired: usersNeedBootstrap,
    } : { ...snapshot, bootstrapRequired: true };
    return Response.json(normalized, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to read shared clinic state", error);
    return Response.json({ message: "Unable to read shared clinic state." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let state: unknown;
  try {
    state = await request.json();
  } catch {
    return Response.json({ message: "Clinic state must be a JSON object." }, { status: 400 });
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return Response.json({ message: "Clinic state must be a JSON object." }, { status: 400 });
  }

  try {
    const snapshot = state as Record<string, unknown>;

    if (Array.isArray(snapshot.students)) {
      await upsertTableRows("patients", "id", snapshot.students.map((row) => normalizePatientRow(row as Record<string, unknown>)));
    }
    if (Array.isArray(snapshot.medicines)) {
      await upsertTableRows("medicines", "code", snapshot.medicines.map((row) => normalizeMedicineRow(row as Record<string, unknown>)));
    }
    if (Array.isArray(snapshot.equipment)) {
      await upsertTableRows("equipment", "id", snapshot.equipment.map((row) => normalizeEquipmentRow(row as Record<string, unknown>)));
    }
    if (Array.isArray(snapshot.consultations)) {
      await upsertTableRows("clinical_visits", "id", snapshot.consultations.map((row) => normalizeVisitRow(row as Record<string, unknown>)));
    }
    if (snapshot.resetAuditLogs === true) {
      const auditResetResponse = await supabaseRequest("audit_logs?id=not.is.null", { method: "DELETE" });
      if (!auditResetResponse.ok) throw new Error(`audit_logs reset returned ${auditResetResponse.status}`);
    } else if (Array.isArray(snapshot.auditLogs)) {
      await syncAuditRows(snapshot.auditLogs as Array<Record<string, unknown>>);
    }
    if (Array.isArray(snapshot.users)) {
      const userRows = snapshot.users.map((row) => normalizeUserRow(row as Record<string, unknown>));
      await upsertTableRows("clinic_users", "id", await resolveClinicUsers(userRows));
    }
    if (snapshot.settings && typeof snapshot.settings === "object") {
      const settings = snapshot.settings as Record<string, unknown>;
      await upsertTableRows("clinic_settings", "id", [{
        id: 1,
        clinic_name: settings.clinicName ?? settings.clinic_name ?? "MQC School Clinic",
        address: settings.address ?? null,
        contact_number: settings.contactNumber ?? settings.contact_number ?? null,
        email: settings.email ?? null,
        clinic_open: settings.clinicOpen ?? settings.clinic_open ?? null,
        clinic_close: settings.clinicClose ?? settings.clinic_close ?? null,
        clinic_days: Array.isArray(settings.clinicDays) ? settings.clinicDays : [],
        patient_id_prefix: settings.patientIdPrefix ?? settings.patient_id_prefix ?? null,
        low_stock_threshold: toNumber(settings.lowStockThreshold ?? settings.low_stock_threshold) ?? 15,
        expiration_alert_days: toNumber(settings.expirationAlertDays ?? settings.expiration_alert_days) ?? 14,
        password_min_length: toNumber(settings.passwordMinLength ?? settings.password_min_length) ?? 8,
        session_timeout_minutes: toNumber(settings.sessionTimeout ?? settings.session_timeout_minutes) ?? 30,
        date_format: settings.dateFormat ?? settings.date_format ?? "MMM D, YYYY",
        time_format: settings.timeFormat ?? settings.time_format ?? "12-hour",
        timezone: settings.timezone ?? "Asia/Manila",
        language: settings.language ?? "English",
        updated_at: new Date().toISOString(),
      }]);
    }
    await purgeRows(snapshot.purged);

    try {
      const snapshotResponse = await supabaseRequest("clinic_state", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: clinicStateId, state: snapshot }),
      });
      if (!snapshotResponse.ok) {
        console.warn(`Optional clinic_state snapshot returned ${snapshotResponse.status}`);
      }
    } catch (error) {
      console.warn("Unable to save optional clinic_state snapshot", error);
    }

    const syncMetaResponse = await supabaseRequest("clinic_sync_meta?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, normalized_ready: true, updated_at: new Date().toISOString() }),
    });
    if (!syncMetaResponse.ok) {
      console.warn(`clinic_sync_meta returned ${syncMetaResponse.status}`);
    }

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save shared clinic state", error);
    const message = error instanceof Error ? error.message : "Unable to save shared clinic state.";
    return Response.json({ message }, { status: 500 });
  }
}
