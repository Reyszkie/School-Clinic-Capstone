import { HealthCheckResponse } from "@workspace/api-zod";

export function GET() {
  return Response.json(HealthCheckResponse.parse({ status: "ok" }));
}