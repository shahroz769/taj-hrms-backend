import mongoose from "mongoose";

const salaryPolicyHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    fromSalaryPolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryPolicy",
      default: null,
    },
    toSalaryPolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryPolicy",
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Index for efficient queries by employee
salaryPolicyHistorySchema.index({ employee: 1, changedAt: -1 });

const SalaryPolicyHistory = mongoose.model(
  "SalaryPolicyHistory",
  salaryPolicyHistorySchema
);

export default SalaryPolicyHistory;
