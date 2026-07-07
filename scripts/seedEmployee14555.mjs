#!/usr/bin/env node
/**
 * Seed a test employee with Employee ID 14555 (for ZKTeco device matching).
 * Usage: node scripts/seedEmployee14555.mjs
 */
import dotenv from "dotenv";
import dns from "node:dns";
import connectDB from "../config/db.js";
import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import Department from "../models/Department.js";

dotenv.config();

const TARGET_ID = "14555";

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
    console.log("Created department:", department.name);
  }

  position = await Position.create({
    name: "Staff",
    department: department._id,
    employeeLimit: "unlimited",
    hiredEmployees: 0,
  });
  console.log("Created position:", position.name);
  return position;
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
    fullName: "ZKTeco Test Employee 14555",
    gender: "Male",
    fatherName: "Test Father",
    joiningDate: new Date(),
    cnic: "1455512345678",
    contactNumber: "03001455501",
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
        cnic: "1455598765432",
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
  console.log("\nConfigure ZKTeco device User ID = 14555 for this employee.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
