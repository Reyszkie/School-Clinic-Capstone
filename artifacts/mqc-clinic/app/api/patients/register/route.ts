import { readActiveClinicSession } from "../../auth/session";

export const dynamic = "force-dynamic";

type PatientRow = Record<string, unknown>;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

function patientFromRow(row: PatientRow): PatientRow {
  return {
    id: row.id,
    name: row.name,
    lastName: row.lastName ?? row.last_name ?? "",
    firstName: row.firstName ?? row.first_name ?? "",
    middleInitial: row.middleInitial ?? row.middle_initial ?? "",
    course: row.course ?? "",
    institutionalCategory: row.institutionalCategory ?? row.institutional_category ?? row.course ?? "",
    year: row.year ?? row.year_level ?? "",
    personnelType: row.personnelType ?? row.personnel_type ?? null,
    gender: row.gender ?? row.sex ?? null,
    sex: row.sex ?? row.gender ?? null,
    guardianName: row.guardianName ?? row.guardian_name ?? "",
    guardianContact: row.guardianContact ?? row.guardian_contact ?? "",
    emergency: row.emergency ?? row.guardian_name ?? row.guardianName ?? "",
    allergies: row.allergies ?? "Not Yet Assessed",
    conditions: row.conditions ?? row.medical_conditions ?? "None",
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    hasVisits: Boolean(row.hasVisits),
    nameMatches: Boolean(row.nameMatches),
    guardianContactMatches: Boolean(row.guardianContactMatches),
  };
}

export async function POST(request: Request) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "Sign in with an active clinic account to register patients." }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const selectedPatientId = typeof body.selectedPatientId === "string" ? body.selectedPatientId : null;
    const patient = body.patient && typeof body.patient === "object" && !Array.isArray(body.patient)
      ? body.patient as PatientRow
      : null;
    const confirmedDistinctIds = Array.isArray(body.confirmedDistinctIds)
      ? body.confirmedDistinctIds.filter((id): id is string => typeof id === "string")
      : [];
    if (!selectedPatientId && !patient) {
      return Response.json({ message: "The patient registration request is invalid." }, { status: 400 });
    }

    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/rpc/register_clinic_patient`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_patient: selectedPatientId ? null : patient,
        p_confirmed_distinct_ids: confirmedDistinctIds,
        p_selected_patient_id: selectedPatientId,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`Supabase patient registration returned ${response.status}.`);
      return Response.json({ message: "Patient registration could not be completed. Please refresh and try again." }, { status: 502 });
    }

    const result = await response.json() as Record<string, unknown>;
    if (result.status === "possible_matches") {
      const matches = Array.isArray(result.matches) ? result.matches as PatientRow[] : [];
      return Response.json({ ...result, matches: matches.map(patientFromRow) }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    if (result.status === "not_found") {
      return Response.json({ message: "That patient profile is no longer active. Refresh the patient list and try again." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (result.status !== "created" && result.status !== "selected") {
      return Response.json({ message: "Patient registration could not be completed. Please refresh and try again." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const patientRow = result.patient && typeof result.patient === "object"
      ? patientFromRow(result.patient as PatientRow)
      : null;
    if (patientRow && typeof result.hasVisits === "boolean") patientRow.hasVisits = result.hasVisits;

    return Response.json({
      ...result,
      patient: patientRow,
    }, {
      status: result.status === "created" ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to register clinic patient.", error);
    const message = error instanceof Error ? error.message : "Unable to register clinic patient.";
    return Response.json({ message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
