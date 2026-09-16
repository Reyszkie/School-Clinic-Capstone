const clinicStateId = 1;

export const dynamic = "force-dynamic";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
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

export async function GET() {
  try {
    const response = await supabaseRequest(`clinic_state?id=eq.${clinicStateId}&select=state`);
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const rows = (await response.json()) as Array<{ state: Record<string, unknown> }>;
    if (!rows[0]) {
      return Response.json({ message: "No shared clinic state has been saved yet." }, { status: 404 });
    }
    return Response.json(rows[0].state, { headers: { "Cache-Control": "no-store" } });
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
    const response = await supabaseRequest("clinic_state", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: clinicStateId, state }),
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save shared clinic state", error);
    return Response.json({ message: "Unable to save shared clinic state." }, { status: 500 });
  }
}
