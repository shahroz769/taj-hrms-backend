import mongoose from "mongoose";

const workProgressReportSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    assignmentDate: {
      type: Date,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    daysForCompletion: {
      type: Number,
      required: true,
      min: 1,
    },
    completionDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed"],
      default: "Pending",
    },
    assignedBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const WorkProgressReport = mongoose.model(
  "WorkProgressReport",
  workProgressReportSchema,
);

export default WorkProgressReport;
