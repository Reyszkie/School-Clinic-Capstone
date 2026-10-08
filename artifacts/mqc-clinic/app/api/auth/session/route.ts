import { readActiveClinicSession } from "../session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await readActiveClinicSession(request);
    if (!session) return Response.json({ message: "No active clinic session." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return Response.json({ id: session.userId, name: session.userName, role: session.role, username: session.username, status: "Active" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to restore clinic session", error);
    return Response.json({ message: "Clinic session validation is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}