const baseUrl = process.env.OPS_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const token = process.env.OPS_METRICS_TOKEN;
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/internal/ops/cloud-pet-health`;

const EXIT_CODES = {
  healthy: 0,
  unreachable: 20,
  unauthorized: 21,
  readinessFailed: 22,
  serverErrorsHigh: 23,
  invalid: 24
};

function finish(result) {
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

if (!token) {
  finish({ ok: false, error: "OPS_METRICS_TOKEN is required", exitCode: EXIT_CODES.invalid });
} else {
  try {
    const response = await fetch(endpoint, {
      headers: { "X-Ops-Metrics-Token": token }
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (response.status === 401 && body?.code === "OPS_METRICS_UNAUTHORIZED") {
      finish({ ok: false, error: "运营指标鉴权失败", exitCode: EXIT_CODES.unauthorized });
    } else if (
      !response.ok ||
      !body ||
      !Array.isArray(body.reasons) ||
      typeof body.status !== "string" ||
      typeof body.readiness?.ready !== "boolean"
    ) {
      finish({ ok: false, error: "运营指标响应无效", exitCode: EXIT_CODES.invalid });
    } else if (!body.readiness.ready || body.reasons.includes("READINESS_FAILED")) {
      finish({ ok: false, status: body.status, reasons: body.reasons, exitCode: EXIT_CODES.readinessFailed });
    } else if (body.reasons.includes("HTTP_5XX_RATE_HIGH")) {
      finish({ ok: false, status: body.status, reasons: body.reasons, exitCode: EXIT_CODES.serverErrorsHigh });
    } else if (body.status === "healthy") {
      finish({ ok: true, status: body.status, reasons: body.reasons, exitCode: EXIT_CODES.healthy });
    } else {
      finish({ ok: false, status: body.status, reasons: body.reasons, exitCode: EXIT_CODES.invalid });
    }
  } catch {
    finish({ ok: false, error: "运营指标端点不可访问", exitCode: EXIT_CODES.unreachable });
  }
}
