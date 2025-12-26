import { Schema } from "mongoose";

// 1. Department
// const departmentSchema = new Schema(
//   {
//     name: { type: String, required: true },
//     positionCount: { type: Number },
//     unlimitedPositions: { type: Boolean, default: false },
//     employeeCount: { type: Number, default: 0 },
//     user: { type: Schema.Types.ObjectId, ref: "User" },
//   },
//   { timestamps: true }
// );

// 2. Position
const positionSchema = new Schema(
  {
    name: { type: String, required: true },
    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    reportsTo: { type: Schema.Types.ObjectId, ref: "Position", required: true },
    employeeLimit: { type: Number, required: true },
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

// 3. Employee
const employeeSchema = new Schema(
  {
    // --- System Access & Roles ---
    // Only Directors, HR, Supervisors might have login access
    role: {
      type: String,
      enum: ["Director", "HR", "Supervisor", "Employee"],
      default: "Employee",
    },
    password: { type: String, select: false }, // Only for those with access
    isActive: { type: Boolean, default: true },

    // --- PDF: Personal Information ---
    fullName: { type: String, required: true },
    employeeID: { type: String, unique: true }, // Auto-generated
    fatherHusbandName: String,
    joiningDate: Date,
    cnic: { type: String, unique: true }, // XXXXX-XXXXXXX-X
    cnicImages: { front: String, back: String }, // URLs to images
    dob: Date,
    contactNumber: String,
    province: String,
    maritalStatus: String,
    currentAddress: String,
    permanentAddress: String,
    emergencyContact: {
      name: String,
      number: String,
      relation: String,
    },

    // --- PDF: Medical Information ---
    medical: {
      bloodGroup: String,
      hasHealthIssues: Boolean,
      healthIssueDetails: String,
      disability: String, // Dropdown value
    },

    // --- PDF: Education (Array for multiple degrees) ---
    education: [
      {
        qualification: String,
        institute: String,
        grades: String,
        status: String, // e.g., Completed
      },
    ],

    // --- PDF: Professional Experience (Previous) ---
    previousExperience: [
      {
        company: String,
        position: String,
        from: Date,
        to: Date,
        lastSalary: Number,
      },
    ],

    // --- PDF: Reference / Guarantor ---
    guarantor: {
      name: String,
      contactNumber: String,
      cnic: String,
      address: String,
    },

    // --- PDF: Legal ---
    legal: {
      involvedInLegalActivity: Boolean,
      details: String,
      convictedBefore: Boolean,
      restrictedPlaces: String,
    },

    // --- Assignment References ---
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    position: { type: Schema.Types.ObjectId, ref: "Position" },
    currentShift: { type: Schema.Types.ObjectId, ref: "Shift" }, // Current active shift

    // --- PDF: Salary Configuration (Base for Payroll) ---
    salaryDetails: {
      basicSalary: Number,
      effectiveDate: Date,
      allowances: {
        houseRent: Number,
        utility: Number,
        communication: Number,
        medical: Number,
        meal: Number,
        special: Number,
        winter: Number,
        conveyance: Number,
        festival: Number,
      },
    },
  },
  { timestamps: true }
);

// 4. Shift
const shiftSchema = new Schema(
  {
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breaks: [
      {
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
      },
    ],
    workingDays: [{ type: Number, required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true }
);

// 5. ShiftAssignment (History)
const shiftAssignmentSchema = new Schema(
  {
    employee: [
      { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    ],
    shift: { type: Schema.Types.ObjectId, required: true, ref: "Shift" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
    },
  },
  { timestamps: true }
);

// 6. Attendance
const attendanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    date: { type: Date, required: true },
    shiftSnapshot: { type: Schema.Types.ObjectId, ref: "Shift" },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Late",
        "Half Day",
        "Leave",
        "Holiday",
        "Weekend",
      ],
    },

    lateDurationMinutes: { type: Number },
    workHours: { type: Number },
    isOvertime: { type: Boolean },
  },
  { timestamps: true }
);

// 7. LeavePolicy Set (Assigned to a Position)
const leavePolicySchema = new Schema(
  {
    position: { type: Schema.Types.ObjectId, ref: "Position", unique: true },
    entitlements: {
      casual: { type: Number, default: 12 },
      sick: { type: Number, default: 12 },
    },
  },
  { timestamps: true }
);

// 8. LeaveRequest
const leaveRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    leaveType: { type: String, enum: ["Casual", "Sick", "Unpaid"] },
    startDate: { type: Date },
    endDate: { type: Date },
    daysCount: { type: Number },
    reason: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true }
);

// 9. Contract
const contractSchema = new Schema(
  {
    contractId: { type: String },
    name: { type: String },
    type: { type: String, enum: ["Employee", "External"] },
    workerCount: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    wageType: { type: String, enum: ["Hourly", "Daily", "Monthly"] },
    rate: { type: Number },
    status: { type: String, enum: ["Active", "Inactive"] },
  },
  { timestamps: true }
);

// 10. WorkReport (Tasks)
const workReportSchema = new Schema(
  {
    description: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: "Employee" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "Employee" }, // Supervisor
    assignedDate: { type: Date },
    targetDate: { type: Date },
    extensionDate: { type: Date },
    actualClosingDate: { type: Date },
    status: { type: String, enum: ["Open", "Pending", "Hold", "Done"] },
    satisfactionLevel: { type: String, enum: ["Satisfied", "Not Satisfied"] },
    remarks: { type: String },
  },
  { timestamps: true }
);

// 11. Warning
const warningSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    type: { type: String, enum: ["Verbal", "Written", "Final", "Dismissal"] },
    description: { type: String },
    status: { type: String, enum: ["Active", "Inactive"] },
  },
  { timestamps: true }
);

// 12. Payroll
const payrollSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    month: { type: Number },
    year: { type: Number },

    // Statistics from Attendance Module
    stats: {
      totalDays: Number,
      workingDays: Number,
      attendedDays: Number,
      absences: Number,
      leaves: Number,
      lates: Number,
    },
    basicSalary: Number,
    // Snapshotted
    earnings: {
      houseRent: Number,
      utility: Number,
      medical: Number,
      communication: Number,
      overtimeAmount: Number,
      totalEarnings: Number,
    },

    deductions: {
      advanceRepayment: Number,
      loanRepayment: Number,
      absentDeduction: Number,
      totalDeductions: Number,
    },

    netPay: Number,
    status: { type: String, enum: ["Generated", "Paid"], default: "Generated" },
  },
  { timestamps: true }
);

export {
  // departmentSchema,
  positionSchema,
  employeeSchema,
  shiftSchema,
  shiftAssignmentSchema,
  attendanceSchema,
  leavePolicySchema,
  leaveRequestSchema,
  contractSchema,
  workReportSchema,
  warningSchema,
  payrollSchema,
};
