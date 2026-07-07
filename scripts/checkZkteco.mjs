#!/usr/bin/env node
/**
 * Quick ZKTeco ADMS connectivity check.
 * Usage: node scripts/checkZkteco.mjs [baseUrl]
 */
const baseUrl = process.argv[2] || "http://localhost:3000";

const check = async (path, options = {}) => {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, options);
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 200) };
};

try {
  console.log(`Checking ZKTeco ADMS at ${baseUrl}\n`);

  const ping = await check("/iclock/ping");
  console.log(`GET /iclock/ping → ${ping.status}: ${ping.text}`);

  const handshake = await check(
    "/iclock/cdata?SN=TEST123456&options=all",
  );
  console.log(
    `GET /iclock/cdata (handshake) → ${handshake.status}:`,
    handshake.text.split("\n")[0],
  );

  const punch = await check(
    "/iclock/cdata?SN=TEST123456&table=ATTLOG",
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "99999\t2026-06-30 09:00:00\t0\t1\t0",
    },
  );
  console.log(`POST /iclock/cdata (punch) → ${punch.status}: ${punch.text}`);

  console.log("\nDone.");
} catch (err) {
  console.error("Check failed:", err.message);
  process.exit(1);
}
