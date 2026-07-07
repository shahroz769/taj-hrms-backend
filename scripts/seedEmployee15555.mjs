#!/usr/bin/env node
/**
 * Seed a test employee with Employee ID 15555 (for offline mode testing).
 * Usage: node scripts/seedEmployee15555.mjs
 */
import dotenv from "dotenv";
import dns from "node:dns";
import connectDB from "../config/db.js";
import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import Department from "../models/Department.js";

dotenv.config();

const TARGET_ID = "15555";

const dnsServers = process.env.MONGO_DNS_SERVERS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (dnsServers?.length) {
  dns.setServers(dnsServers);
}

const ensurePosition = async () => {
  let position = await Position.findOne();
  if (position) return position;

  let department = await Department.findOne();
  if (!department) {
    department = await Department.create({ name: "General" });
  }

  return Position.create({
    name: "Staff",
    department: department._id,
    employeeLimit: "unlimited",
    hiredEmployees: 0,
  });
};

async function main() {
  await connectDB();

  const existing = await Employee.findOne({ employeeID: TARGET_ID });
  if (existing) {
    console.log(`Employee already exists: ${existing.fullName} (${existing.employeeID})`);
    console.log("MongoDB _id:", existing._id.toString());
    process.exit(0);
  }

  const position = await ensurePosition();

  const employee = await Employee.create({
    employeeID: TARGET_ID,
    position: position._id,
    employeeOf: "Taj Agri",
    fullName: "Offline Test Employee",
    gender: "Male",
    fatherName: "Test Father",
    joiningDate: new Date(),
    cnic: "1555512345678",
    contactNumber: "03001555501",
    province: "Sindh",
    city: "Karachi",
    maritalStatus: "Single",
    currentStreetAddress: "Test Address",
    permanentStreetAddress: "Test Address",
    status: "Active",
    employmentType: "Permanent",
    basicSalary: 0,
    emergencyContact: [
      { name: "Emergency Contact", number: "03009876543", relation: "Brother" },
    ],
    medical: {
      bloodGroup: "O+",
      hasHealthIssues: false,
      disability: false,
    },
    guarantor: [
      {
        name: "Guarantor One",
        contactNumber: "03001112233",
        relation: "Friend",
        cnic: "1555598765432",
        address: "Karachi",
      },
    ],
    references: [
      {
        name: "Reference One",
        contactNumber: "03004445566",
        relation: "Colleague",
        address: "Karachi",
      },
    ],
    legal: {
      convictedCriminalCorruptionCase: false,
      rusticatedDismissedTerminated: false,
      pendingLitigationCourtCase: false,
      availableAnywhereInPakistan: true,
    },
  });

  await Position.findByIdAndUpdate(position._id, { $inc: { hiredEmployees: 1 } });

  console.log("Employee created successfully:");
  console.log("  Name:", employee.fullName);
  console.log("  Employee ID:", employee.employeeID);
  console.log("  Status:", employee.status);
  console.log("  MongoDB _id:", employee._id.toString());
  console.log("\nOn ZKTeco device: User ID = 15555, enroll fingerprint/face, then test offline punch.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
