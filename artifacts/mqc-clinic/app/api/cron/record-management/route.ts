import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(secret);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

async function recordMaintenanceFailure(url: string, key: string) {
  const response = await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_name: "System Scheduler",
      username: "system_scheduler",
      role: "System",
      action: "Automated Record Management Failed",
      event_details:
        "Number of records affected: not confirmed. Categories: patients, medicines, medical supplies, and medical equipment. Reason: scheduled record maintenance returned an error; run keys prevent duplicate changes on retry. Execution status: Error.",
      module: "System Maintenance",
      status: "Error",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error(
      `Unable to audit scheduled record maintenance failure (${response.status}).`,
    );
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json(
      { message: "Scheduled record maintenance is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isAuthorized(request, cronSecret)) {
    return Response.json(
      { message: "Unauthorized scheduled request." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return Response.json(
      { message: "Supabase server configuration is missing." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${url}/rest/v1/rpc/run_scheduled_record_maintenance`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error("Scheduled record maintenance request failed.", error);
    return Response.json(
      { message: "Scheduled record maintenance could not reach Supabase." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!response.ok) {
    console.error(
      `Scheduled record maintenance returned ${response.status}.`,
    );
    try {
      await recordMaintenanceFailure(url, key);
    } catch (error) {
      console.error("Unable to audit scheduled record maintenance failure.", error);
    }
    return Response.json(
      { message: "Scheduled record maintenance did not complete." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await response.json();
    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Scheduled record maintenance returned invalid JSON.", error);
    return Response.json(
      { message: "Scheduled record maintenance returned an invalid response." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
