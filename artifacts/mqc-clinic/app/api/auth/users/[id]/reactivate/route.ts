import { hasClinicAdminPrivileges, readActiveClinicSession } from "../../../session";

export const dynamic = "force-dynamic";

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return { url, key };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) {
      return Response.json(
        { message: "Sign in to manage clinic accounts." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!hasClinicAdminPrivileges(session.role)) {
      return Response.json(
        { message: "Only a Head Nurse or Super Admin can reactivate clinic accounts." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { id } = await context.params;
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/rpc/reactivate_clinic_user`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: id, p_actor_id: session.userId }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string; details?: string };
      if (response.status === 400) {
        return Response.json(
          { message: body.message || "This disabled account cannot be reactivated." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      throw new Error(`Account reactivation returned ${response.status}: ${body.message || body.details || "Unknown Supabase error"}`);
    }

    const rows = await response.json() as Array<{
      id?: string;
      name?: string;
      role?: string;
      username?: string;
      status?: string;
    }>;
    const user = rows[0];
    if (!user?.id || user.status !== "Active") {
      throw new Error("Supabase returned an invalid account reactivation result.");
    }
    return Response.json(user, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to reactivate clinic account", error);
    return Response.json(
      { message: "Unable to reactivate clinic account." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
