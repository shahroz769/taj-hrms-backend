import Position from "../models/Position.js";
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
    const { name, department, reportsTo, employeeLimit } = req.body || {};

    if (
      (!name?.trim(), !department?.trim() || !employeeLimit?.toString().trim())
    ) {
      res.status(400);
      throw new Error("Position name and department are required");
    }

    // Check if department already exists
    const existingPosition = await Position.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingPosition) {
      res.status(400);
      throw new Error("Position with this name already exists");
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

// @description     Update department
// @route           PUT /api/departments/:id
// @access          Admin
// export const updateDepartment = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     console.log(id, req.body);

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       res.status(404);
//       throw new Error("Department Not Found");
//     }

//     const department = await Department.findById(id);

//     if (!department) {
//       res.status(404);
//       throw new Error("Department not found");
//     }

//     const { name, positionCount } = req.body || {};

// if (!name?.trim() || !positionCount?.toString().trim()) {
//   res.status(400);
//   throw new Error("Department name and position count are required");
// }

// Check if new name conflicts with existing department
// if (name && name.trim() !== department.name) {
//   const existingDepartment = await Department.findOne({
//     name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
//     _id: { $ne: id },
//   });

//   if (existingDepartment) {
//     res.status(400);
//     throw new Error("Department with this name already exists");
//   }
//   department.name = name.trim();
// }

// if (positionCount !== undefined) {
//   department.positionCount = positionCount;
// }

// if (isActive !== undefined) {
//   department.isActive = isActive;
// }

//     const updatedDepartment = await department.save();

//     res.json(updatedDepartment);
//   } catch (err) {
//     console.log(err);
//     next(err);
//   }
// };

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
    if (position.employeeCount > 0) {
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
