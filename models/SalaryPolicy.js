import mongoose from "mongoose";

const salaryPolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    components: [
      {
        salaryComponent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SalaryComponent",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    status: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
      default: "Pending",
    },
    createdBy: {
      type: String,
      default: "",
    },
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Employee",
    //   required: true,
    // },
  },
  { timestamps: true }
);

const SalaryPolicy = mongoose.model("SalaryPolicy", salaryPolicySchema);

export default SalaryPolicy;