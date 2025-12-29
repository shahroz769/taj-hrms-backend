import Position from "../models/Position.js";
import Department from "../models/Department.js";
import mongoose from "mongoose";

// @description     Get all positions
// @route           GET /api/positions
// @access          Admin
export const getAllPositions = async (req, res, next) => {
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
    const totalPositions = await Position.countDocuments(query);

    // Get paginated positions
    const positions = await Position.find(query)
      .populate("department", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      positions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPositions / limit),
        totalPositions,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single position by ID
// @route           GET /api/positions/:id
// @access          Admin
export const getPositionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id);

    if (!position) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    res.json(position);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new position
// @route           POST /api/positions
// @access          Admin
export const createPosition = async (req, res, next) => {
  try {
    const { name, reportsTo, employeeLimit, department } = req.body || {};

    if (
      (!name?.trim() || !employeeLimit?.toString().trim() || !reportsTo?.trim() || !department?.trim())
    ) {
      res.status(400);
      throw new Error("Position name, employee limit, reports to and department are required");
    }

    // Validate department ID
    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400);
      throw new Error("Invalid department ID");
    }

    // Check if department exists
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404);
      throw new Error("Department not found");
    }

    // Check position count limit for the department
    const positionCountLimit = departmentDoc.positionCount?.trim().toLowerCase();
    
    if (positionCountLimit && positionCountLimit !== "unlimited") {
      // Count current positions in this department
      const currentPositionCount = await Position.countDocuments({ department: department });
      
      // Parse the limit as a number
      const limit = parseInt(positionCountLimit, 10);
      
      if (isNaN(limit)) {
        res.status(400);
        throw new Error("Invalid position count limit in department");
      }
      
      // Check if limit is reached
      if (currentPositionCount >= limit) {
        res.status(400);
        throw new Error(
          `Position limit reached for ${departmentDoc.name} department. Maximum positions allowed: ${limit}`
        );
      }
    }

    // Check if position already exists in this department
    const existingPosition = await Position.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      department: department,
    });

    if (existingPosition) {
      res.status(400);
      throw new Error("Position with this name already exists in this department");
    }

    const newPosition = new Position({
      name: name.trim(),
      department: department,
      reportsTo: reportsTo,
      employeeLimit: employeeLimit,
      createdBy: req.user._id,
    });

    const savedPosition = await newPosition.save();

    res.status(201).json(savedPosition);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update position
// @route           PUT /api/positions/:id
// @access          Admin
export const updatePosition = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id);

    if (!position) {
      res.status(404);
      throw new Error("Position not found");
    }

    const { name, reportsTo, employeeLimit, department } = req.body || {};

    if (!name?.trim() || !employeeLimit?.toString().trim() || !reportsTo?.trim() || !department?.trim()) {
      res.status(400);
      throw new Error("Position name, employee limit, reports to and department are required");
    }

    // Validate department ID
    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400);
      throw new Error("Invalid department ID");
    }

    // Check if department exists
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404);
      throw new Error("Department not found");
    }

    // If department is being changed, check position limit for new department
    if (department !== position.department.toString()) {
      const positionCountLimit = departmentDoc.positionCount?.trim().toLowerCase();
      
      if (positionCountLimit && positionCountLimit !== "unlimited") {
        // Count current positions in the new department
        const currentPositionCount = await Position.countDocuments({ department: department });
        
        // Parse the limit as a number
        const limit = parseInt(positionCountLimit, 10);
        
        if (isNaN(limit)) {
          res.status(400);
          throw new Error("Invalid position count limit in department");
        }
        
        // Check if limit is reached
        if (currentPositionCount >= limit) {
          res.status(400);
          throw new Error(
            `Position limit reached for ${departmentDoc.name} department. Maximum positions allowed: ${limit}`
          );
        }
      }
    }

    // Check if new name conflicts with existing position in the target department
    if (name.trim() !== position.name || department !== position.department.toString()) {
      const existingPosition = await Position.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        department: department,
        _id: { $ne: id },
      });

      if (existingPosition) {
        res.status(400);
        throw new Error("Position with this name already exists in this department");
      }
    }

    // Update position fields
    position.name = name.trim();
    position.department = department;
    position.reportsTo = reportsTo;
    position.employeeLimit = employeeLimit;

    const updatedPosition = await position.save();

    res.json(updatedPosition);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete position
// @route           DELETE /api/positions/:id
// @access          Admin
export const deletePosition = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id);

    if (!position) {
      res.status(404);
      throw new Error("Position not found");
    }

// Check if position has employees
    if (position.hiredEmployees > 0) {
      res.status(400);
      throw new Error(
        "Cannot delete position with active employees. Please reassign employees first."
      );
    }

    await position.deleteOne();

    res.json({
      message: "Position deleted successfully",
      deletedPosition: {
        id: position._id,
        name: position.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
