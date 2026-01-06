import SalaryComponent from "../models/SalaryComponent.js";
import SalaryPolicy from "../models/SalaryPolicy.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all salary components
// @route           GET /api/salary-components
// @access          Admin, Supervisor
export const getAllSalaryComponents = async (req, res, next) => {
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
    const totalSalaryComponents = await SalaryComponent.countDocuments(query);

    // Get paginated salary components
    const salaryComponents = await SalaryComponent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      salaryComponents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSalaryComponents / limit),
        totalSalaryComponents,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all salary components list for select options
// @route           GET /api/salary-components/list
// @access          Admin, Supervisor
export const getAllSalaryComponentsList = async (req, res, next) => {
  try {
    const salaryComponents = await SalaryComponent.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(salaryComponents);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single salary component by ID
// @route           GET /api/salary-components/:id
// @access          Admin
export const getSalaryComponentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Component Not Found");
    }

    const salaryComponent = await SalaryComponent.findById(id);

    if (!salaryComponent) {
      res.status(404);
      throw new Error("Salary Component Not Found");
    }

    res.json(salaryComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new salary component
// @route           POST /api/salary-components
// @access          Admin, Supervisor
export const createSalaryComponent = async (req, res, next) => {
  try {
    const { name } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Salary component name is required");
    }

    const existingSalaryComponent = await SalaryComponent.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingSalaryComponent) {
      res.status(400);
      throw new Error("Salary component with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newSalaryComponent = new SalaryComponent({
      name: name.trim(),
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedSalaryComponent = await newSalaryComponent.save();

    res.status(201).json(savedSalaryComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update salary component
// @route           PUT /api/salary-components/:id
// @access          Admin
export const updateSalaryComponent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Component Not Found");
    }

    const salaryComponent = await SalaryComponent.findById(id);

    if (!salaryComponent) {
      res.status(404);
      throw new Error("Salary component not found");
    }

    const { name } = req.body || {};

    // Validate required fields
    if (!name?.trim()) {
      res.status(400);
      throw new Error("Salary component name is required");
    }

    // Check if new name conflicts with existing salary component
    if (name.trim() !== salaryComponent.name) {
      const existingSalaryComponent = await SalaryComponent.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingSalaryComponent) {
        res.status(400);
        throw new Error("Salary component with this name already exists");
      }
    }

    // Update salary component fields
    salaryComponent.name = name.trim();

    const updatedSalaryComponent = await salaryComponent.save();

    res.json(updatedSalaryComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update salary component status (Approve/Reject)
// @route           PATCH /api/salary-components/:id/status
// @access          Admin
export const updateSalaryComponentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Component Not Found");
    }

    const salaryComponent = await SalaryComponent.findById(id);

    if (!salaryComponent) {
      res.status(404);
      throw new Error("Salary component not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`
      );
    }

    // Update salary component status
    salaryComponent.status = status;
    const updatedSalaryComponent = await salaryComponent.save();

    res.json({
      message: `Salary component ${status.toLowerCase()} successfully`,
      salaryComponent: updatedSalaryComponent,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete salary component
// @route           DELETE /api/salary-components/:id
// @access          Admin
export const deleteSalaryComponent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Salary Component Not Found");
    }

    const salaryComponent = await SalaryComponent.findById(id);

    if (!salaryComponent) {
      res.status(404);
      throw new Error("Salary component not found");
    }

    // Check if salary component is used in any salary policies
    const salaryPolicyCount = await SalaryPolicy.countDocuments({
      "components.salaryComponent": id,
    });

    if (salaryPolicyCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete salary component. It is currently used in ${salaryPolicyCount} salary ${
          salaryPolicyCount === 1 ? "policy" : "policies"
        }. Please remove it from all salary policies first.`
      );
    }

    await salaryComponent.deleteOne();

    res.json({
      message: "Salary component deleted successfully",
      deletedSalaryComponent: {
        id: salaryComponent._id,
        name: salaryComponent.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
