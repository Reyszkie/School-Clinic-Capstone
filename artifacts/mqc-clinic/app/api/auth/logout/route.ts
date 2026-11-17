import {
  clearClinicSessionCookie,
  hashClinicSessionId,
  readClinicSession,
} from "../session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let reason = "manual";
    const rawBody = await request.text();
    if (rawBody) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return Response.json({ message: "Logout request must be valid JSON." }, { status: 400 });
      }
      if (
        body &&
        typeof body === "object" &&
        !Array.isArray(body) &&
        (body as { reason?: unknown }).reason === "inactivity_timeout"
      ) {
        reason = "inactivity_timeout";
      }
    }

    const session = readClinicSession(request);
    if (session) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
      if (!url || !key) throw new Error("Supabase server configuration is missing.");

      const response = await fetch(`${url}/rest/v1/rpc/release_clinic_session`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: session.userId,
          p_token_hash: hashClinicSessionId(session.sessionId),
          p_reason: reason,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Clinic session release returned ${response.status}`);
    }

    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store", "Set-Cookie": clearClinicSessionCookie() },
    });
  } catch (error) {
    console.error("Unable to release clinic session", error);
    return Response.json(
      { message: "The active clinic session could not be released. Please try logging out again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}