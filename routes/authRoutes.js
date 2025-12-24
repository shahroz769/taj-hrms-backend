import express from "express";
import User from "../models/User.js";
import { jwtVerify } from "jose";
import { JWT_SECRET } from "../utils/getJwtSecret.js";
import { generateToken } from "../utils/generateToken.js";

const router = express.Router();

// @route         POST api/auth/register
// @description   Register new user
// @access        Public
router.post("/register", async (req, res, next) => {
  try {
    const { name, username, password, role } = req.body || {};
    console.log(name, username, password, role);
    if (!name || !username || !password || !role) {
      res.status(400);
      throw new Error("All fields are required");
    }

    const existingUser = await User.findOne({ username });

    if (existingUser) {
      res.status(400);
      throw new Error("User already exists");
    }

    const user = await User.create({ name, username, password, role });

    // Create Tokens
    const payload = { userId: user._id.toString(), role: user.role };
    const accessToken = await generateToken(payload, "1m");
    const refreshToken = await generateToken(payload, "30d");

    // Set refresh token in HTTP-Only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// @route         POST api/auth/login
// @description   Authenticate user
// @access        Public
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      res.status(400);
      throw new Error("username and password are required");
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401);
      throw new Error("Invalid Credentials");
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      res.status(401);
      throw new Error("Invalid Credentials");
    }

    // Create Tokens
    const payload = { userId: user._id.toString(), role: user.role };
    const accessToken = await generateToken(payload, "1m");
    const refreshToken = await generateToken(payload, "30d");

    // Set refresh token in HTTP-Only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    });

    res.status(201).json({
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

// @route         POST api/auth/logout
// @description   Logout user and clear refresh token
// @access        Private
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  res.status(200).json({ message: "Logged out successfully" });
});

// @route         POST api/auth/refresh
// @description   Generate new access token from refresh token
// @access        Public (Needs valid refresh token in cookie)
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    console.log("Refreshing token...");

    if (!token) {
      res.status(401);
      throw new Error("No refresh token");
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    const user = await User.findById(payload.userId);

    if (!user) {
      res.status(401);
      throw new Error("No user");
    }

    const newAccessToken = await generateToken(
      { userId: user._id.toString(), role: user.role },
      "1m"
    );

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(401);
    next(err);
  }
});

export default router;
