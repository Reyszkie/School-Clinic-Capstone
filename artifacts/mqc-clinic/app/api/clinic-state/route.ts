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

function normalizeAuditLogRow(row: Record<string, unknown>) {
  const identity = `${row.date ?? row.created_at ?? ""}|${row.time ?? ""}|${row.user ?? row.user_name ?? ""}|${row.action ?? ""}`;
  let stableId = 0;
  for (const character of identity) stableId = (stableId * 31 + character.charCodeAt(0)) % 2147483647;
  const normalized = {
    user_id: row.userId ?? row.user_id ?? null,
    user_name: row.userName ?? row.user_name ?? "System",
    action: row.action ?? "System Action",
    module: row.module ?? "System",
    status: row.status ?? "Success",
    created_at: toDateValue(row.createdAt ?? row.created_at) ?? new Date().toISOString(),
  };
  return { id: row.id === null || row.id === undefined ? stableId || 1 : row.id, ...normalized };
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

function auditFromRow(row: Record<string, unknown>) {
  const createdAt = String(row.created_at ?? "");
  const date = createdAt.slice(0, 10);
  const time = createdAt ? new Date(createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
  return { date, time, user: row.user_name, action: row.action, module: row.module, status: row.status };
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
    const response = await supabaseRequest(`${tableName}?on_conflict=${conflictKey}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${tableName} upsert returned ${response.status}: ${text}`);
    }
  }
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
    const [patients, medicines, equipment, visits, users, auditLogs] = await Promise.all([
      readTable("patients"),
      readTable("medicines"),
      readTable("equipment"),
      readTable("clinical_visits"),
      readTable("clinic_users"),
      readTable("audit_logs"),
    ]);
    const hasNormalizedData = [patients, medicines, equipment, visits, users, auditLogs].some((table) => table.length > 0);
    if (!hasNormalizedData && !rows[0]) {
      return Response.json({ message: "No shared clinic state has been saved yet." }, { status: 404 });
    }
    const normalized = hasNormalizedData ? {
      ...snapshot,
      students: patients.length ? patients.map(patientFromRow) : snapshot.students ?? [],
      ...(medicines.length || snapshot.medicines ? { medicines: medicines.length ? medicines.map(medicineFromRow) : snapshot.medicines } : {}),
      ...(equipment.length || snapshot.equipment ? { equipment: equipment.length ? equipment.map(equipmentFromRow) : snapshot.equipment } : {}),
      consultations: visits.length ? visits.map((visit) => visitFromRow(visit, patients)) : snapshot.consultations ?? [],
      users: users.length ? users.filter((user) => !user.deleted_at).map(userFromRow) : snapshot.users ?? [],
      deletedStudents: patients.length ? patients.filter((patient) => patient.deleted_at).map(patientFromRow) : snapshot.deletedStudents ?? [],
      deletedUsers: users.length ? users.filter((user) => user.deleted_at).map(userFromRow) : snapshot.deletedUsers ?? [],
      auditLogs: auditLogs.length ? auditLogs.map(auditFromRow) : snapshot.auditLogs ?? [],
      bootstrapRequired: !equipment.length && !snapshot.equipment,
    } : snapshot;
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
    if (Array.isArray(snapshot.auditLogs)) {
      await upsertTableRows("audit_logs", "id", snapshot.auditLogs.map((row) => normalizeAuditLogRow(row as Record<string, unknown>)));
    }
    if (Array.isArray(snapshot.users)) {
      await upsertTableRows("clinic_users", "id", snapshot.users.map((row) => normalizeUserRow(row as Record<string, unknown>)));
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

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save shared clinic state", error);
    const message = error instanceof Error ? error.message : "Unable to save shared clinic state.";
    return Response.json({ message }, { status: 500 });
  }
}
