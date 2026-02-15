import WorkProgressReport from "../models/WorkProgressReport.js";
import Employee from "../models/Employee.js";
import mongoose from "mongoose";

// Helper: auto-update status based on current date and assignment date
const autoUpdateStatuses = (reports) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return reports.map((report) => {
    if (report.status === "Completed") return report;

    const assignmentDate = new Date(report.assignmentDate);
    assignmentDate.setHours(0, 0, 0, 0);

    if (now < assignmentDate) {
      report.status = "Pending";
    } else {
      report.status = "In Progress";
    }

    return report;
  });
};

// @description     Get all work progress reports (paginated)
// @route           GET /api/work-progress-reports
// @access          Admin, Supervisor
export const getAllWorkProgressReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";
    const skip = (page - 1) * limit;

    // Aggregation pipeline with employee lookup for search
    const pipeline = [
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
    ];

    if (searchText.trim()) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employee.fullName": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "employee.employeeID": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              description: {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              assignedBy: {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
          ],
        },
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await WorkProgressReport.aggregate(countPipeline);
    const totalReports = countResult[0]?.total || 0;

    // Fetch paginated
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 1,
        "employee._id": 1,
        "employee.fullName": 1,
        "employee.employeeID": 1,
        assignmentDate: 1,
        deadline: 1,
        daysForCompletion: 1,
        completionDate: 1,
        description: 1,
        remarks: 1,
        status: 1,
        assignedBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    let reports = await WorkProgressReport.aggregate(pipeline);

    // Auto-update statuses based on current date
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const bulkOps = [];

    reports = reports.map((report) => {
      if (report.status === "Completed") return report;

      const assignmentDate = new Date(report.assignmentDate);
      assignmentDate.setHours(0, 0, 0, 0);

      let newStatus;
      if (now < assignmentDate) {
        newStatus = "Pending";
      } else {
        newStatus = "In Progress";
      }

      if (report.status !== newStatus) {
        bulkOps.push({
          updateOne: {
            filter: { _id: report._id },
            update: { $set: { status: newStatus } },
          },
        });
        report.status = newStatus;
      }

      return report;
    });

    if (bulkOps.length > 0) {
      await WorkProgressReport.bulkWrite(bulkOps);
    }

    res.json({
      workProgressReports: reports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReports / limit),
        totalReports,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get work progress report by ID
// @route           GET /api/work-progress-reports/:id
// @access          Admin, Supervisor
export const getWorkProgressReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id).populate(
      "employee",
      "fullName employeeID",
    );

    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    res.json(report);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new work progress report
// @route           POST /api/work-progress-reports
// @access          Admin, Supervisor
export const createWorkProgressReport = async (req, res, next) => {
  try {
    const {
      employee,
      assignmentDate,
      deadline,
      daysForCompletion,
      description,
    } = req.body || {};

    // Validations
    if (!employee) {
      res.status(400);
      throw new Error("Employee is required");
    }

    if (!mongoose.Types.ObjectId.isValid(employee)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const employeeDoc = await Employee.findById(employee);
    if (!employeeDoc) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (!assignmentDate) {
      res.status(400);
      throw new Error("Assignment date is required");
    }

    if (!deadline) {
      res.status(400);
      throw new Error("Deadline is required");
    }

    const assignDate = new Date(assignmentDate);
    const deadlineDate = new Date(deadline);

    if (deadlineDate <= assignDate) {
      res.status(400);
      throw new Error("Deadline must be after the assignment date");
    }

    if (!daysForCompletion || daysForCompletion < 1) {
      res.status(400);
      throw new Error("Days for completion must be at least 1");
    }

    if (!description?.trim()) {
      res.status(400);
      throw new Error("Description is required");
    }

    // Determine initial status
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    assignDate.setHours(0, 0, 0, 0);

    let status = "Pending";
    if (now >= assignDate) {
      status = "In Progress";
    }

    const newReport = new WorkProgressReport({
      employee,
      assignmentDate: new Date(assignmentDate),
      deadline: deadlineDate,
      daysForCompletion,
      description: description.trim(),
      status,
      assignedBy: req.user.name || req.user._id,
    });

    const savedReport = await newReport.save();

    const populatedReport = await WorkProgressReport.findById(
      savedReport._id,
    ).populate("employee", "fullName employeeID");

    res.status(201).json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update work progress report
// @route           PUT /api/work-progress-reports/:id
// @access          Admin, Supervisor
export const updateWorkProgressReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    const {
      employee,
      assignmentDate,
      deadline,
      daysForCompletion,
      description,
      status,
      remarks,
      completionDate,
    } = req.body || {};

    // Validate employee if provided
    if (employee) {
      if (!mongoose.Types.ObjectId.isValid(employee)) {
        res.status(400);
        throw new Error("Invalid employee ID");
      }
      const employeeDoc = await Employee.findById(employee);
      if (!employeeDoc) {
        res.status(404);
        throw new Error("Employee not found");
      }
      report.employee = employee;
    }

    if (assignmentDate) {
      report.assignmentDate = new Date(assignmentDate);
    }

    if (deadline) {
      report.deadline = new Date(deadline);
    }

    // Validate deadline > assignmentDate
    const effectiveAssignDate = new Date(
      assignmentDate || report.assignmentDate,
    );
    const effectiveDeadline = new Date(deadline || report.deadline);
    if (effectiveDeadline <= effectiveAssignDate) {
      res.status(400);
      throw new Error("Deadline must be after the assignment date");
    }

    if (daysForCompletion !== undefined) {
      if (daysForCompletion < 1) {
        res.status(400);
        throw new Error("Days for completion must be at least 1");
      }
      report.daysForCompletion = daysForCompletion;
    }

    if (description !== undefined) {
      if (!description?.trim()) {
        res.status(400);
        throw new Error("Description is required");
      }
      report.description = description.trim();
    }

    // Handle status change
    if (status) {
      if (!["Pending", "In Progress", "Completed"].includes(status)) {
        res.status(400);
        throw new Error("Invalid status value");
      }

      report.status = status;

      // Clear completion date and remarks if status is not Completed
      if (status !== "Completed") {
        report.completionDate = null;
        report.remarks = "";
      }
    }

    // Handle completion date (only when status is Completed)
    if (completionDate !== undefined) {
      const currentStatus = status || report.status;

      if (currentStatus === "Completed") {
        if (!completionDate) {
          res.status(400);
          throw new Error("Completion date is required when status is Completed");
        }

        const completionDateObj = new Date(completionDate);
        const effectiveAssignDate = new Date(
          assignmentDate || report.assignmentDate,
        );
        effectiveAssignDate.setHours(0, 0, 0, 0);
        completionDateObj.setHours(0, 0, 0, 0);

        if (completionDateObj < effectiveAssignDate) {
          res.status(400);
          throw new Error("Completion date cannot be before assignment date");
        }

        report.completionDate = completionDateObj;
      }
    }

    // Handle remarks (only when Completed)
    if (remarks !== undefined) {
      const currentStatus = status || report.status;
      if (currentStatus === "Completed") {
        report.remarks = remarks.trim();
      }
    }

    // Validate remarks and completion date when marking as completed
    const finalStatus = status || report.status;
    if (finalStatus === "Completed") {
      if (!report.remarks?.trim()) {
        res.status(400);
        throw new Error("Remarks are required when marking as completed");
      }
      if (!report.completionDate) {
        res.status(400);
        throw new Error("Completion date is required when marking as completed");
      }
    }

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(
      updatedReport._id,
    ).populate("employee", "fullName employeeID");

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete work progress report
// @route           DELETE /api/work-progress-reports/:id
// @access          Admin
export const deleteWorkProgressReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id).populate(
      "employee",
      "fullName employeeID",
    );

    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    await report.deleteOne();

    res.json({
      message: "Work progress report deleted successfully",
      deletedReport: {
        id: report._id,
        employee: report.employee?.fullName,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
