import { readActiveClinicSession } from "../auth/session";

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

export async function GET(request: Request) {
  const session = await readActiveClinicSession(request);
  if (!session) return Response.json({ message: "Sign in to view audit activity." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const after = new URL(request.url).searchParams.get("after");
    if (after !== null && !/^\d+$/.test(after)) return Response.json({ message: "Audit cursor is invalid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const rows: Array<Record<string, unknown>> = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const path = after === null
        ? "audit_logs?select=id,user_id,user_name,role,action,module,status,created_at&order=created_at.desc,id.desc"
        : `audit_logs?select=id,user_id,user_name,role,action,module,status,created_at&id=gt.${after}&order=id.asc`;
      const response = await supabaseRequest(path, {
        headers: { Range: `${offset}-${offset + pageSize - 1}`, "Range-Unit": "items" },
      });
      if (!response.ok) throw new Error(`audit_logs read returned ${response.status}: ${await response.text()}`);
      const page = await response.json() as Array<Record<string, unknown>>;
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    const logs = rows.map(row => {
      const createdAt = String(row.created_at ?? "");
      const parsed = new Date(createdAt);
      const valid = createdAt && !Number.isNaN(parsed.getTime());
      return {
        id: row.id,
        date: valid ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed) : "",
        time: valid ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(parsed) : "",
        user: row.user_name,
        userId: row.user_id,
        role: row.role ?? "Unknown",
        action: row.action,
        module: row.module,
        status: row.status,
        timestamp: createdAt,
      };
    });
    return Response.json(logs, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to read audit activity", error);
    return Response.json({ message: "Unable to read audit activity from Supabase." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const session = await readActiveClinicSession(request);
  if (!session) return Response.json({ message: "Sign in to record audit activity." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Audit event must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Audit event must be an object." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const action = typeof input.action === "string" ? input.action.trim() : "";
  const module = typeof input.module === "string" ? input.module.trim() : "";
  const status = input.status ?? "Success";

  if (!action || action.length > 500 || !module || module.length > 100 || !["Success", "Warning", "Error"].includes(String(status))) {
    return Response.json({ message: "Audit event has invalid required fields." }, { status: 400 });
  }

  try {
    const userResponse = await supabaseRequest(`clinic_users?id=eq.${encodeURIComponent(session.userId)}&status=eq.Active&deleted_at=is.null&select=id,name&limit=1`);
    if (!userResponse.ok) throw new Error(`clinic_users lookup returned ${userResponse.status}`);
    const users = (await userResponse.json()) as Array<{ id?: string; name?: string }>;
    if (!users[0]?.id) return Response.json({ message: "This clinic account is no longer active." }, { status: 401, headers: { "Cache-Control": "no-store" } });

    const response = await supabaseRequest("audit_logs?select=id,user_id,user_name,role,action,module,status,created_at", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: users[0].id,
        user_name: users[0].name || session.userName,
        role: session.role,
        action,
        module,
        status,
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`audit_logs insert returned ${response.status}: ${details}`);
    }

    const [saved] = await response.json() as Array<{ id: number; user_id: string; user_name: string; role: string; action: string; module: string; status: string; created_at: string }>;
    if (!saved) throw new Error("audit_logs insert returned no saved record");
    return Response.json(saved, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save audit event", error);
    return Response.json({ message: "Unable to save audit event to Supabase." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}