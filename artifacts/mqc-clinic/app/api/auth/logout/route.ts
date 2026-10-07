import { clearClinicSessionCookie } from "../session";

export const dynamic = "force-dynamic";

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "Set-Cookie": clearClinicSessionCookie() },
  });
}