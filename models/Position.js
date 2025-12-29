import mongoose from "mongoose";

const positionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    // reportsTo: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Employee",
    //   default: null,
    // },
    reportsTo: {
      type: String,
    },
    employeeLimit: {
      type: String,
      required: [true, "Employee Limit is required"],
    },
  },
  { timestamps: true }
);

// Virtual to get current hired count from Employee collection
positionSchema.virtual("hiredCount", {
  ref: "Employee",
  localField: "_id",
  foreignField: "position",
  count: true,
});

const Position = mongoose.model("Position", positionSchema);

export default Position;
