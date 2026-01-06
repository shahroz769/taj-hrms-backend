import SalaryPolicy from "../models/SalaryPolicy.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all salary policies
// @route           GET /api/salary-policies
// @access          Admin, Supervisor
export const getAllSalaryPolicies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";

    // Build search query
    const query = {};
    if (searchText.trim()) {
      query.name = { $regex: searchText.trim(), $options: "i" };
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalSalaryPolicies = await SalaryPolicy.countDocuments(query);

    // Get paginated salary policies
    const salaryPolicies = await SalaryPolicy.find(query)
      .populate("components.salaryComponent", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      salaryPolicies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSalaryPolicies / limit),
        totalSalaryPolicies,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all salary policies list for select options
// @route           GET /api/salary-policies/list
// @access          Admin, Supervisor
export const getAllSalaryPoliciesList = async (req, res, next) => {
  try {
    const salaryPolicies = await SalaryPolicy.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(salaryPolicies);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single salary policy by ID
// @route           GET /api/salary-policies/:id
// @access          Admin, Supervisor
export const getSalaryPolicyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Policy Not Found");
    }

    const salaryPolicy = await SalaryPolicy.findById(id).populate(
      "components.salaryComponent",
      "name"
    );

    if (!salaryPolicy) {
      res.status(404);
      throw new Error("Salary Policy Not Found");
    }

    res.json(salaryPolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new salary policy
// @route           POST /api/salary-policies
// @access          Admin
export const createSalaryPolicy = async (req, res, next) => {
  try {
    const { name, components } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Salary policy name is required");
    }

    if (!components || !Array.isArray(components) || components.length === 0) {
      res.status(400);
      throw new Error("At least one salary component is required");
    }

    // Validate components
    for (const component of components) {
      if (
        !component.salaryComponent ||
        !mongoose.Types.ObjectId.isValid(component.salaryComponent)
      ) {
        res.status(400);
        throw new Error("Invalid salary component ID in components");
      }
      if (component.amount === undefined || component.amount < 0) {
        res.status(400);
        throw new Error("Amount must be a non-negative number");
      }
    }

    // Check if salary policy already exists
    const existingSalaryPolicy = await SalaryPolicy.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingSalaryPolicy) {
      res.status(400);
      throw new Error("Salary policy with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newSalaryPolicy = new SalaryPolicy({
      name: name.trim(),
      components,
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedSalaryPolicy = await newSalaryPolicy.save();

    // Populate the salary components in the response
    await savedSalaryPolicy.populate("components.salaryComponent", "name");

    res.status(201).json(savedSalaryPolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update salary policy
// @route           PUT /api/salary-policies/:id
// @access          Admin
export const updateSalaryPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Policy Not Found");
    }

    const salaryPolicy = await SalaryPolicy.findById(id);

    if (!salaryPolicy) {
      res.status(404);
      throw new Error("Salary policy not found");
    }

    const { name, components } = req.body || {};

    // Validate name if provided
    if (name && name.trim()) {
      // Check if new name conflicts with existing salary policy
      if (name.trim() !== salaryPolicy.name) {
        const existingSalaryPolicy = await SalaryPolicy.findOne({
          name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
          _id: { $ne: id },
        });

        if (existingSalaryPolicy) {
          res.status(400);
          throw new Error("Salary policy with this name already exists");
        }
      }
      salaryPolicy.name = name.trim();
    }

    // Validate and update components if provided
    if (components) {
      if (!Array.isArray(components) || components.length === 0) {
        res.status(400);
        throw new Error("At least one salary component is required");
      }

      // Validate each component
      for (const component of components) {
        if (
          !component.salaryComponent ||
          !mongoose.Types.ObjectId.isValid(component.salaryComponent)
        ) {
          res.status(400);
          throw new Error("Invalid salary component ID in components");
        }
        if (component.amount === undefined || component.amount < 0) {
          res.status(400);
          throw new Error("Amount must be a non-negative number");
        }
      }

      salaryPolicy.components = components;
    }

    const updatedSalaryPolicy = await salaryPolicy.save();

    // Populate the salary components in the response
    await updatedSalaryPolicy.populate("components.salaryComponent", "name");

    res.json(updatedSalaryPolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update salary policy status (Approve/Reject)
// @route           PATCH /api/salary-policies/:id/status
// @access          Admin
export const updateSalaryPolicyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Policy Not Found");
    }

    const salaryPolicy = await SalaryPolicy.findById(id).populate(
      "components.salaryComponent",
      "name"
    );

    if (!salaryPolicy) {
      res.status(404);
      throw new Error("Salary policy not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`
      );
    }

    // Update salary policy status
    salaryPolicy.status = status;
    const updatedSalaryPolicy = await salaryPolicy.save();

    res.json({
      message: `Salary policy ${status.toLowerCase()} successfully`,
      salaryPolicy: updatedSalaryPolicy,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete salary policy
// @route           DELETE /api/salary-policies/:id
// @access          Admin
export const deleteSalaryPolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Policy Not Found");
    }

    const salaryPolicy = await SalaryPolicy.findById(id);

    if (!salaryPolicy) {
      res.status(404);
      throw new Error("Salary policy not found");
    }

    await salaryPolicy.deleteOne();

    res.json({
      message: "Salary policy deleted successfully",
      deletedSalaryPolicy: {
        id: salaryPolicy._id,
        name: salaryPolicy.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
