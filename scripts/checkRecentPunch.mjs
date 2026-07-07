#!/usr/bin/env node
import dotenv from "dotenv";
import dns from "node:dns";
import connectDB from "../config/db.js";
import ZktecoAttendanceLog from "../models/ZktecoAttendanceLog.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import ZktecoDevice from "../models/ZktecoDevice.js";

dotenv.config();
if (process.env.MONGO_DNS_SERVERS) {
  dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map((s) => s.trim()));
}

await connectDB();

const since = new Date(Date.now() - 30 * 60 * 1000);
const newLogs = await ZktecoAttendanceLog.find({ createdAt: { $gte: since } })
  .sort({ createdAt: -1 })
  .lean();

console.log("\n=== Punches received in last 30 minutes ===");
console.log("Count:", newLogs.length);
for (const l of newLogs) {
  console.log(
    `  PIN ${l.pin} | ${l.deviceSerialNumber} | punch ${l.punchTime} | synced=${l.syncedToAttendance}${l.syncError ? " ERR:" + l.syncError : ""}`,
  );
}

const logs14123 = await ZktecoAttendanceLog.find({ pin: "14123" })
  .sort({ punchTime: -1 })
  .lean();
console.log("\n=== All punches for Employee ID 14123 ===");
console.log("Count:", logs14123.length);
for (const l of logs14123) {
  console.log(`  ${l.punchTime} | synced=${l.syncedToAttendance} | ${l.syncError || "ok"}`);
}

const emp = await Employee.findOne({ employeeID: "14123" });
if (emp) {
  const att = await Attendance.find({ employee: emp._id })
    .sort({ date: -1 })
    .limit(3)
    .lean();
  console.log("\n=== Attendance for ZKTeco Test Employee (14123) ===");
  if (!att.length) console.log("  No attendance records yet.");
  for (const a of att) {
    console.log(
      `  ${a.date?.toISOString?.()?.slice(0, 10)} | ${a.status} | checkIn=${a.checkIn} | source=${a.source}`,
    );
  }
}

const dev = await ZktecoDevice.findOne({ serialNumber: "AJP3254900187" }).lean();
console.log("\n=== Device AJP3254900187 ===");
console.log("  lastSeenAt:", dev?.lastSeenAt || "Never");
console.log("  online threshold check:", dev?.lastSeenAt ? "had contact before" : "NO contact recorded");

process.exit(0);
