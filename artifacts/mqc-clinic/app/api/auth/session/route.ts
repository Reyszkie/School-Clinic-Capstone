import { readActiveClinicSession } from "../session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "No active clinic session." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ id: session.userId, name: session.userName, role: session.role, username: session.username, status: "Active", appearanceTheme: session.appearanceTheme }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to restore clinic session", error);
    return Response.json({ message: "Clinic session validation is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "No active clinic session." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ message: "A valid appearance theme is required." }, { status: 400 });
    }
    const theme = body && typeof body === "object" && !Array.isArray(body)
      ? (body as { appearanceTheme?: unknown }).appearanceTheme
      : null;
    if (typeof theme !== "string" || !["ocean", "forest", "berry", "terracotta", "lagoon", "sage", "cobalt", "cranberry", "amber", "graphite"].includes(theme)) {
      return Response.json({ message: "The selected appearance theme is not supported." }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("Supabase server configuration is missing.");
    const response = await fetch(`${url}/rest/v1/clinic_users?id=eq.${encodeURIComponent(session.userId)}&status=eq.Active&deleted_at=is.null`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ appearance_theme: theme }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const updated = await response.json() as Array<{ id?: string }>;
    if (!updated.some(profile => profile.id === session.userId)) {
      return Response.json({ message: "The account theme was not updated." }, { status: 409 });
    }
    return Response.json({ appearanceTheme: theme }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to update clinic account theme", error);
    return Response.json({ message: "The account theme could not be saved." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}