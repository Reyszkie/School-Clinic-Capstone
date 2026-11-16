export const dynamic = "force-dynamic";

export async function GET() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!siteKey || !secretKey) {
    return Response.json(
      { message: "Google reCAPTCHA is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ siteKey }, { headers: { "Cache-Control": "no-store" } });
}
