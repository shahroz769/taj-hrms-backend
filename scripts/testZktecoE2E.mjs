/**
 * End-to-end ZKTeco integration test (backend + admin API).
 * Usage: node scripts/testZktecoE2E.mjs [baseUrl]
 */
import dotenv from "dotenv";

dotenv.config();

const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const testSerial = `TEST${Date.now().toString().slice(-8)}`;
const testPin = "88888";

const log = (step, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${step}${detail ? `: ${detail}` : ""}`);
};

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("json")
    ? await res.json()
    : await res.text();
  return { status: res.status, body, headers: res.headers };
}

async function loginAdmin() {
  const username = `zktest_${Date.now()}`;
  const password = "TestAdmin123!";

  await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "ZK Test Admin",
      username,
      password,
      role: "admin",
    }),
  });

  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (![200, 201].includes(loginRes.status) || !loginRes.body?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return loginRes.body.accessToken;
}

async function main() {
  console.log(`\nZKTeco E2E test → ${baseUrl}\n`);

  // 1. Device ping (public)
  const ping = await request("/iclock/ping");
  log("GET /iclock/ping", ping.status === 200 && ping.body === "OK", ping.body);

  // 2. Handshake (use a throwaway serial — do not use the registration serial)
  const probeSerial = `PROBE${Date.now().toString().slice(-6)}`;
  const handshake = await request(
    `/iclock/cdata?SN=${probeSerial}&options=all`,
  );
  log(
    "GET /iclock/cdata handshake",
    handshake.status === 200 && String(handshake.body).includes("GET OPTION FROM"),
    handshake.status,
  );

  // 3. Admin auth
  let token;
  try {
    token = await loginAdmin();
    log("Admin login/register", true);
  } catch (err) {
    log("Admin login/register", false, err.message);
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 4. Register device via admin API (same as frontend)
  const createRes = await request("/api/zkteco/devices", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      serialNumber: testSerial,
      name: "E2E Test Gate",
      location: "Test Lab",
      enabled: true,
    }),
  });
  log(
    "POST /api/zkteco/devices (frontend registration)",
    createRes.status === 201,
    createRes.body?.device?.serialNumber || createRes.body?.message,
  );

  const deviceId = createRes.body?.device?._id;

  // 5. List devices
  const listRes = await request("/api/zkteco/devices", { headers: auth });
  const found = listRes.body?.devices?.some((d) => d.serialNumber === testSerial);
  log("GET /api/zkteco/devices", listRes.status === 200 && found, `count=${listRes.body?.devices?.length}`);

  // 6. Stats
  const statsRes = await request("/api/zkteco/stats", { headers: auth });
  log("GET /api/zkteco/stats", statsRes.status === 200, `devices=${statsRes.body?.devices?.total}`);

  // 7. Simulate device punch
  const punchRes = await fetch(
    `${baseUrl}/iclock/cdata?SN=${testSerial}&table=ATTLOG`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: `${testPin}\t2026-06-30 09:15:00\t0\t1\t0`,
    },
  );
  const punchBody = await punchRes.text();
  log("POST /iclock/cdata punch", punchRes.status === 200, punchBody);

  // 8. Logs (expect unmatched PIN)
  const logsRes = await request(
    `/api/zkteco/logs?serialNumber=${testSerial}&limit=5`,
    { headers: auth },
  );
  const hasLog = logsRes.body?.logs?.some((l) => l.pin === testPin);
  log("GET /api/zkteco/logs", logsRes.status === 200 && hasLog, `logs=${logsRes.body?.logs?.length}`);

  // 9. Unmatched pins
  const unmatchedRes = await request("/api/zkteco/unmatched-pins", { headers: auth });
  const hasUnmatched = unmatchedRes.body?.pins?.some((p) => p.pin === testPin);
  log("GET /api/zkteco/unmatched-pins", unmatchedRes.status === 200 && hasUnmatched);

  // 10. Cleanup device
  if (deviceId) {
    const delRes = await request(`/api/zkteco/devices/${deviceId}`, {
      method: "DELETE",
      headers: auth,
    });
    log("DELETE /api/zkteco/devices/:id", delRes.status === 200);
  }

  console.log("\nE2E test complete.\n");
}

main().catch((err) => {
  console.error("\nE2E test failed:", err.message);
  process.exit(1);
});
