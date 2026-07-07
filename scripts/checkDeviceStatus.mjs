#!/usr/bin/env node
import dotenv from "dotenv";
import dns from "node:dns";
import connectDB from "../config/db.js";
import ZktecoDevice from "../models/ZktecoDevice.js";
import ZktecoAttendanceLog from "../models/ZktecoAttendanceLog.js";

dotenv.config();

const thresholdMs =
  (Number(process.env.ZK_ONLINE_THRESHOLD_SECONDS) || 120) * 1000;

const dnsServers = process.env.MONGO_DNS_SERVERS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (dnsServers?.length) dns.setServers(dnsServers);

await connectDB();

const devices = await ZktecoDevice.find().sort({ lastSeenAt: -1 }).lean();
const now = Date.now();

console.log("\n=== ZKTeco Device Connection Status ===\n");

if (devices.length === 0) {
  console.log("No devices registered in database.");
  console.log("Register at: Setups → ZKTeco Devices → Add Device");
} else {
  for (const d of devices) {
    const online =
      d.lastSeenAt && now - new Date(d.lastSeenAt).getTime() < thresholdMs;
    console.log(`Device: ${d.name}`);
    console.log(`  Serial:     ${d.serialNumber}`);
    console.log(`  Enabled:    ${d.enabled !== false ? "Yes" : "No"}`);
    console.log(`  Status:     ${online ? "ONLINE" : "OFFLINE"}`);
    console.log(
      `  Last seen:  ${d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "Never"}`,
    );
    if (d.lastSeenAt) {
      const secs = Math.floor((now - new Date(d.lastSeenAt).getTime()) / 1000);
      console.log(`  Ago:        ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)} min`}`);
    }
    console.log(`  Device IP:  ${d.reportedIp || "—"}`);
    console.log(`  Firmware:   ${d.firmwareVersion || "—"}`);
    console.log("");
  }
}

const recentLogs = await ZktecoAttendanceLog.find()
  .sort({ punchTime: -1 })
  .limit(5)
  .lean();

console.log("=== Recent Punches (last 5) ===\n");
if (recentLogs.length === 0) {
  console.log("No punches received yet.");
} else {
  for (const log of recentLogs) {
    console.log(
      `  PIN ${log.pin} | ${new Date(log.punchTime).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} | synced=${log.syncedToAttendance}${log.syncError ? ` | ${log.syncError}` : ""}`,
    );
  }
}

const emp14123 = recentLogs.filter((l) => l.pin === "14123");
console.log("\n=== Employee 14123 ===");
console.log(
  emp14123.length
    ? `Last punch: ${new Date(emp14123[0].punchTime).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`
    : "No punches yet for PIN 14123",
);

console.log("");
process.exit(0);
