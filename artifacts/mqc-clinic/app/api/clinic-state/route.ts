import { readFile } from "node:fs/promises";
import path from "node:path";
import { clinicStateTable, getDb } from "@workspace/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const clinicStateId = 1;
const dataDirectory = process.env.CLINIC_DATA_DIR ?? path.resolve(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "clinic-state.json");

async function readLegacyClinicState() {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as Record<string, unknown>;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function saveClinicState(state: Record<string, unknown>) {
  await getDb()
    .insert(clinicStateTable)
    .values({ id: clinicStateId, state })
    .onConflictDoUpdate({
      target: clinicStateTable.id,
      set: { state, updatedAt: new Date() },
    });
}

export async function GET() {
  try {
    const [storedState] = await getDb()
      .select({ state: clinicStateTable.state })
      .from(clinicStateTable)
      .where(eq(clinicStateTable.id, clinicStateId));

    if (storedState) {
      return Response.json(storedState.state, { headers: { "Cache-Control": "no-store" } });
    }

    const legacyState = await readLegacyClinicState();
    if (legacyState) await saveClinicState(legacyState);
    if (!legacyState) {
      return Response.json({ message: "No shared clinic state has been saved yet." }, { status: 404 });
    }
    return Response.json(legacyState, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to read shared clinic state", error);
    return Response.json({ message: "Unable to read shared clinic state." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Clinic state must be a JSON object." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Clinic state must be a JSON object." }, { status: 400 });
  }

  try {
    await saveClinicState(body as Record<string, unknown>);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save shared clinic state", error);
    return Response.json({ message: "Unable to save shared clinic state." }, { status: 500 });
  }
}