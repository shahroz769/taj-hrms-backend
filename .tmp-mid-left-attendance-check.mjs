import "dotenv/config";
import mongoose from "mongoose";
import Employee from "./models/Employee.js";
import Attendance from "./models/Attendance.js";

await mongoose.connect(process.env.MONGO_URI);

const emp = await Employee.findOne({ employeeID: "MOCK-1003" }).lean();
const rows = await Attendance.find({ employee: emp._id, date: { $gte: new Date("2026-02-01T00:00:00.000Z"), $lt: new Date("2026-03-01T00:00:00.000Z") } })
  .sort({ date: 1 })
  .select("date status")
  .lean();

console.log(JSON.stringify({
  employee: emp ? { employeeID: emp.employeeID, fullName: emp.fullName, status: emp.status, joiningDate: emp.joiningDate, resignationDate: emp.resignationDate || null } : null,
  attendanceCount: rows.length,
  attendance: rows.map(r => ({ date: r.date, status: r.status }))
}, null, 2));

await mongoose.disconnect();
