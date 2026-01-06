import mongoose from "mongoose";

const salaryComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
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

const SalaryComponent = mongoose.model("SalaryComponent", salaryComponentSchema);

export default SalaryComponent;
