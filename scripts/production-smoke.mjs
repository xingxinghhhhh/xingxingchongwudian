import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
const nextCli = resolve(rootDir, "node_modules/next/dist/bin/next");
const schemaPath = resolve(rootDir, "prisma/schema.prisma");
const apiEntry = resolve(rootDir, "dist/main.js");
const smokeOwner = {
  email: "owner@smoke.example.com",
  password: "smoke-owner-secret-2026"
};
const memberWebhookToken = "production-smoke-member-webhook-token";

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: options.env ?? process.env,
      windowsHide: true
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun(output);
      } else {
        rejectRun(
          new Error(
            `${command} exited with code ${code}\n${output.slice(-8_000)}`
          )
        );
      }
    });
  });
}

async function getAvailablePort() {
  const server = createServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolveClose) => server.close(resolveClose));

  if (!port) {
    throw new Error("Unable to allocate a production smoke port");
  }

  return port;
}

async function startMemberVerificationWebhook(port) {
  const codes = new Map();
  const server = createHttpServer((request, response) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        if (
          request.method !== "POST" ||
          request.headers.authorization !== `Bearer ${memberWebhookToken}`
        ) {
          response.writeHead(401).end();
          return;
        }

        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        codes.set(payload.phone, payload.code);
        response.writeHead(204).end();
      } catch {
        response.writeHead(400).end();
      }
    });
  });

  server.listen(port, "127.0.0.1");
  await once(server, "listening");

  return {
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
    getCode(phone) {
      return codes.get(phone);
    },
    url: `http://127.0.0.1:${port}/member-verification`
  };
}

function startApi(env) {
  const child = spawn(process.execPath, [apiEntry], {
    cwd: rootDir,
    env,
    windowsHide: true
  });
  let output = "";

  child.stdout.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_000);
  });

  return {
    child,
    getOutput: () => output
  };
}

function startWeb(env, port) {
  const child = spawn(
    process.execPath,
    [nextCli, "start", "web", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: rootDir,
      env: { ...env, PORT: String(port) },
      windowsHide: true
    }
  );
  let output = "";

  child.stdout.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_000);
  });

  return {
    child,
    getOutput: () => output
  };
}

async function stopApi(api) {
  if (!api || api.child.exitCode !== null) {
    return;
  }

  api.child.kill();
  const exited = once(api.child, "exit");
  const timeout = new Promise((resolveTimeout) => {
    setTimeout(resolveTimeout, 5_000, "timeout");
  });

  if ((await Promise.race([exited, timeout])) === "timeout") {
    api.child.kill("SIGKILL");
    await once(api.child, "exit");
  }
}

async function requestJson(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return { response, body };
}

async function waitForReadiness(baseUrl, api) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (api.child.exitCode !== null) {
      throw new Error(
        `Production API exited before readiness\n${api.getOutput()}`
      );
    }

    try {
      const { response, body } = await requestJson(
        baseUrl,
        "/api/health/ready",
        {
          headers: { "X-Request-Id": "production-smoke-ready" }
        }
      );

      if (
        response.ok &&
        body?.status === "ready" &&
        body?.database?.connected === true &&
        response.headers.get("x-request-id") === "production-smoke-ready"
      ) {
        return;
      }
    } catch {
      // The process may still be binding its port.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Production API readiness timed out\n${api.getOutput()}`);
}

async function waitForWeb(baseUrl, web) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (web.child.exitCode !== null) {
      throw new Error(`Production web exited before readiness\n${web.getOutput()}`);
    }

    try {
      const [workspace, loginPage] = await Promise.all([
        fetch(`${baseUrl}/cloud-pets`),
        fetch(`${baseUrl}/admin/login`)
      ]);
      const [workspaceHtml, loginHtml] = await Promise.all([
        workspace.text(),
        loginPage.text()
      ]);

      if (
        workspace.ok &&
        loginPage.ok &&
        workspaceHtml.includes("<html") &&
        loginHtml.includes("<html")
      ) {
        return;
      }
    } catch {
      // The production web process may still be binding its port.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Production web readiness timed out\n${web.getOutput()}`);
}

async function verifyApiSecurityHeaders(baseUrl) {
  const trustedOrigin = "https://smoke.example.com";
  const untrustedOrigin = "https://untrusted.example.net";
  const trusted = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: trustedOrigin,
      "X-Request-Id": "production-smoke-security"
    }
  });
  const untrusted = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: untrustedOrigin }
  });
  const requiredHeaders = {
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN"
  };

  for (const [name, expected] of Object.entries(requiredHeaders)) {
    if (trusted.headers.get(name) !== expected) {
      throw new Error(`Production API security header ${name} is missing`);
    }
  }

  if (
    !trusted.ok ||
    trusted.headers.get("strict-transport-security")?.includes("max-age=") !==
      true ||
    trusted.headers.has("x-powered-by") ||
    trusted.headers.get("access-control-allow-origin") !== trustedOrigin ||
    trusted.headers.get("x-request-id") !== "production-smoke-security" ||
    [untrustedOrigin, "*"].includes(
      untrusted.headers.get("access-control-allow-origin")
    )
  ) {
    throw new Error(
      `Production API HTTP security baseline failed: ${JSON.stringify({
        trustedStatus: trusted.status,
        strictTransportSecurity: trusted.headers.get(
          "strict-transport-security"
        ),
        xPoweredBy: trusted.headers.get("x-powered-by"),
        trustedCors: trusted.headers.get("access-control-allow-origin"),
        requestId: trusted.headers.get("x-request-id"),
        untrustedCors: untrusted.headers.get("access-control-allow-origin")
      })}`
    );
  }
}

async function login(baseUrl) {
  const { response, body } = await requestJson(
    baseUrl,
    "/api/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify(smokeOwner)
    }
  );

  if (!response.ok || !body?.sessionToken || body?.staff?.role !== "owner") {
    throw new Error(`Production owner login failed: ${response.status}`);
  }

  return body.sessionToken;
}

async function verifyPersistentSession(baseUrl, sessionToken) {
  const headers = { "X-Admin-Session": sessionToken };
  const restored = await requestJson(baseUrl, "/api/admin/auth/me", {
    headers
  });

  if (
    !restored.response.ok ||
    restored.body?.staffNo !== "STAFF_OWNER" ||
    restored.body?.role !== "owner"
  ) {
    throw new Error("Admin session did not survive production restart");
  }

  const logout = await requestJson(baseUrl, "/api/admin/auth/logout", {
    method: "POST",
    headers,
    body: JSON.stringify({})
  });
  const revoked = await requestJson(baseUrl, "/api/admin/auth/me", {
    headers
  });

  if (!logout.response.ok || revoked.response.status !== 401) {
    throw new Error("Admin session was not revoked by production logout");
  }
}

async function loginMember(baseUrl, verificationWebhook) {
  const verification = await requestJson(
    baseUrl,
    "/api/auth/verification-codes",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Production Smoke Member",
        phone: "13800138088"
      })
    }
  );
  const code = verificationWebhook.getCode("13800138088");

  if (
    !verification.response.ok ||
    verification.body?.developmentCode ||
    !code
  ) {
    throw new Error("Production member verification provider failed");
  }

  const { response, body } = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      challengeId: verification.body.challengeId,
      code
    })
  });

  if (!response.ok || !body?.sessionToken || !body?.expiresAt) {
    throw new Error(`Production member login failed: ${response.status}`);
  }

  return body.sessionToken;
}

async function verifyProxyAwareMemberAuthRateLimit(baseUrl) {
  const statuses = [];

  for (let index = 0; index < 11; index += 1) {
    const result = await requestJson(
      baseUrl,
      "/api/auth/verification-codes",
      {
        method: "POST",
        headers: { "X-Forwarded-For": "203.0.113.10" },
        body: JSON.stringify({
          name: `Rate Limit Smoke ${index}`,
          phone: `1379000${String(index).padStart(4, "0")}`
        })
      }
    );
    statuses.push(result.response.status);
  }

  const differentClient = await requestJson(
    baseUrl,
    "/api/auth/verification-codes",
    {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.11" },
      body: JSON.stringify({
        name: "Different Proxy Client",
        phone: "13790009999"
      })
    }
  );

  if (
    statuses.slice(0, 10).some((status) => status !== 201) ||
    statuses[10] !== 429 ||
    differentClient.response.status !== 201
  ) {
    throw new Error("Proxy-aware member auth rate limiting failed");
  }
}

async function createCloudPet(baseUrl, sessionToken) {
  const input = {
    ownerName: "Forged Production Owner",
    ownerPhone: "13900139999",
    name: "Production Smoke Pet",
    species: "cat",
    personality: "Verifies authenticated creation and restart persistence"
  };
  const anonymous = await requestJson(baseUrl, "/api/cloud-pets", {
    method: "POST",
    body: JSON.stringify(input)
  });
  const authenticated = await requestJson(baseUrl, "/api/cloud-pets", {
    method: "POST",
    headers: { "X-Member-Token": sessionToken },
    body: JSON.stringify(input)
  });

  if (
    anonymous.response.status !== 401 ||
    !authenticated.response.ok ||
    !authenticated.body?.petNo ||
    authenticated.body?.ownerPhone !== "13800138088"
  ) {
    throw new Error("Cloud-pet creation did not enforce member ownership");
  }

  return authenticated.body.petNo;
}

async function verifyPublicCloudPetPrivacy(baseUrl, petNo) {
  const publicProfile = await requestJson(
    baseUrl,
    `/api/cloud-pets/${petNo}`
  );
  const body = publicProfile.body ?? {};

  if (
    !publicProfile.response.ok ||
    Object.prototype.hasOwnProperty.call(body, "ownerName") ||
    Object.prototype.hasOwnProperty.call(body, "ownerPhone") ||
    body.bio?.includes("Production Smoke Member")
  ) {
    throw new Error("Public cloud-pet profile exposed member identity");
  }
}

async function recordCloudPetHomepageVisits(baseUrl, petNo) {
  const path = `/api/cloud-pets/${petNo}/homepage/visits`;
  const first = await requestJson(baseUrl, path, {
    method: "POST",
    body: JSON.stringify({
      source: "production_smoke",
      visitorId: "production_smoke_visitor_001"
    })
  });
  const repeated = await requestJson(baseUrl, path, {
    method: "POST",
    body: JSON.stringify({
      source: "production_smoke",
      visitorId: "production_smoke_visitor_001"
    })
  });
  const secondVisitor = await requestJson(baseUrl, path, {
    method: "POST",
    body: JSON.stringify({
      source: "production_smoke",
      visitorId: "production_smoke_visitor_002"
    })
  });

  if (
    !first.response.ok ||
    first.body?.visitCount !== 1 ||
    !repeated.response.ok ||
    repeated.body?.visitCount !== 1 ||
    !secondVisitor.response.ok ||
    secondVisitor.body?.visitCount !== 2
  ) {
    throw new Error("Cloud-pet homepage visit deduplication failed");
  }
}

async function verifyPersistentMemberSession(baseUrl, sessionToken, petNo) {
  const headers = { "X-Member-Token": sessionToken };
  const restored = await requestJson(baseUrl, "/api/members/me", { headers });

  if (
    !restored.response.ok ||
    restored.body?.member?.phone !== "13800138088" ||
    !restored.body?.pets?.some((pet) => pet.petNo === petNo)
  ) {
    throw new Error(
      "Member session or owned cloud pet did not survive production restart"
    );
  }

  const archive = await requestJson(
    baseUrl,
    `/api/cloud-pets/${petNo}/homepage/archive`
  );
  if (
    !archive.response.ok ||
    archive.body?.engagement?.homepageVisitCount !== 2
  ) {
    throw new Error("Homepage visit totals did not survive production restart");
  }

  const logout = await requestJson(baseUrl, "/api/auth/logout", {
    method: "POST",
    headers,
    body: JSON.stringify({})
  });
  const revoked = await requestJson(baseUrl, "/api/members/me", { headers });

  if (!logout.response.ok || revoked.response.status !== 401) {
    throw new Error("Member session was not revoked by production logout");
  }
}

async function updateOperationsConfig(baseUrl, sessionToken) {
  const headers = { "X-Admin-Session": sessionToken };
  const task = await requestJson(
    baseUrl,
    "/api/admin/cloud-pets/growth-tasks/daily-care",
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        points: 37,
        rewards: { mood: 9, energy: 5, intimacy: 11 }
      })
    }
  );
  const rules = await requestJson(
    baseUrl,
    "/api/admin/cloud-pets/care-score-rules",
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        dailyTaskBonus: 15,
        steadyMinScore: 61,
        thrivingMinScore: 76,
        thrivingRequiresCareToday: true
      })
    }
  );

  if (!task.response.ok || task.body?.points !== 37) {
    throw new Error(`Growth task smoke update failed: ${task.response.status}`);
  }
  if (!rules.response.ok || rules.body?.dailyTaskBonus !== 15) {
    throw new Error(`Care score smoke update failed: ${rules.response.status}`);
  }
}

async function verifyOperationsConfig(baseUrl, sessionToken) {
  const headers = { "X-Admin-Session": sessionToken };
  const tasks = await requestJson(
    baseUrl,
    "/api/admin/cloud-pets/growth-tasks",
    { headers }
  );
  const rules = await requestJson(
    baseUrl,
    "/api/admin/cloud-pets/care-score-rules",
    { headers }
  );
  const dailyCare = tasks.body?.items?.find(
    (item) => item.key === "daily-care"
  );

  if (
    !tasks.response.ok ||
    dailyCare?.points !== 37 ||
    dailyCare?.rewards?.intimacy !== 11
  ) {
    throw new Error("Growth task configuration did not survive restart");
  }
  if (
    !rules.response.ok ||
    rules.body?.dailyTaskBonus !== 15 ||
    rules.body?.thrivingMinScore !== 76
  ) {
    throw new Error("Care score configuration did not survive restart");
  }
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "kzt-production-smoke-"));
  const databasePath = join(tempDir, "smoke.db");
  const port = await getAvailablePort();
  const webPort = await getAvailablePort();
  const memberWebhookPort = await getAvailablePort();
  const memberVerificationWebhook = await startMemberVerificationWebhook(
    memberWebhookPort
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  const webBaseUrl = `http://127.0.0.1:${webPort}`;
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    KZT_USE_MEMORY_STORE: "false",
    ADMIN_API_KEY: "production-smoke-admin-key-2026",
    ADMIN_OWNER_NAME: "Production Smoke Owner",
    ADMIN_OWNER_EMAIL: smokeOwner.email,
    ADMIN_OWNER_PASSWORD: smokeOwner.password,
    WEB_ORIGIN: "https://smoke.example.com",
    TRUST_PROXY_HOPS: "1",
    KZT_PRODUCTION_SMOKE: "true",
    MEMBER_AUTH_PROVIDER: "webhook",
    MEMBER_AUTH_CODE_SECRET: "production-smoke-member-code-secret-2026",
    MEMBER_AUTH_WEBHOOK_URL: memberVerificationWebhook.url,
    MEMBER_AUTH_WEBHOOK_TOKEN: memberWebhookToken,
    PAYMENT_TIMEOUT_MINUTES: "30",
    PORT: String(port)
  };
  let api;
  let web;

  try {
    await writeFile(databasePath, "");
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", schemaPath],
      { env }
    );
    await run(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "diff",
        "--from-url",
        databaseUrl,
        "--to-schema-datamodel",
        schemaPath,
        "--exit-code"
      ],
      { env }
    );

    api = startApi(env);
    await waitForReadiness(baseUrl, api);
    await verifyApiSecurityHeaders(baseUrl);
    web = startWeb(env, webPort);
    await waitForWeb(webBaseUrl, web);
    await verifyProxyAwareMemberAuthRateLimit(baseUrl);
    const firstSession = await login(baseUrl);
    const firstMemberSession = await loginMember(
      baseUrl,
      memberVerificationWebhook
    );
    const firstMemberPet = await createCloudPet(baseUrl, firstMemberSession);
    await verifyPublicCloudPetPrivacy(baseUrl, firstMemberPet);
    await recordCloudPetHomepageVisits(baseUrl, firstMemberPet);
    await updateOperationsConfig(baseUrl, firstSession);
    await stopApi(api);

    api = startApi(env);
    await waitForReadiness(baseUrl, api);
    await verifyPersistentSession(baseUrl, firstSession);
    await verifyPersistentMemberSession(
      baseUrl,
      firstMemberSession,
      firstMemberPet
    );
    const secondSession = await login(baseUrl);
    await verifyOperationsConfig(baseUrl, secondSession);

    console.log(
      "Production smoke passed: migrations, API/web readiness, HTTP security headers, member verification webhook, persistent admin/member sessions, logout, and operations restart persistence."
    );
  } finally {
    await stopApi(web);
    await stopApi(api);
    await memberVerificationWebhook.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
