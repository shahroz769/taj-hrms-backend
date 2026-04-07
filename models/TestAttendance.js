import mongoose from "mongoose";

const testAttendanceSchema = new mongoose.Schema(
  {
    userID: { type: String },
    checkTime: { type: Date },
  },
  { timestamps: true }
);

const TestAttendance = mongoose.model("TestAttendance", testAttendanceSchema);

export default TestAttendance;
