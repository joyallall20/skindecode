import User from "../models/User.js";
import mongoose from "mongoose";

// @desc    Create a new user
// @route   POST /api/users
// @access  Public/Admin
export const createUser = async (req, res) => {
  try {
    const { firebaseUid, email, name, role, preferences } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { firebaseUid }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or Firebase UID already exists",
      });
    }

    const user = await User.create({
      firebaseUid,
      email,
      name,
      role: role || "user",
      preferences: preferences || {},
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Admin
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Filters
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const users = await User.find(query)
      .populate("skinProfile", "skinType concerns")
      .populate("preferences.preferredBrands", "name")
      .populate("preferences.preferredRetailers", "name")
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id)
      .populate("skinProfile")
      .populate("preferences.preferredBrands", "name description")
      .populate("preferences.preferredRetailers", "name website");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// @desc    Get user by Firebase UID
// @route   GET /api/users/firebase/:firebaseUid
// @access  Private
export const getUserByFirebaseUid = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid })
      .populate("skinProfile")
      .populate("preferences.preferredBrands", "name")
      .populate("preferences.preferredRetailers", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields
    const allowedUpdates = [
      "name",
      "role",
      "preferences",
      "isActive",
      "lastLoginAt",
    ];
    const updateKeys = Object.keys(updates);
    const isValidOperation = updateKeys.every((key) =>
      allowedUpdates.includes(key)
    );

    if (!isValidOperation) {
      return res.status(400).json({
        success: false,
        message: "Invalid updates!",
        allowedUpdates,
      });
    }

    // Check if ID is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("skinProfile")
      .populate("preferences.preferredBrands", "name")
      .populate("preferences.preferredRetailers", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// @desc    Update user preferences
// @route   PUT /api/users/:id/preferences
// @access  Private
export const updateUserPreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferredBrands, preferredRetailers, currency } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update preferences
    if (preferredBrands) {
      user.preferences.preferredBrands = preferredBrands;
    }
    if (preferredRetailers) {
      user.preferences.preferredRetailers = preferredRetailers;
    }
    if (currency) {
      user.preferences.currency = currency;
    }

    await user.save();

    const updatedUser = await User.findById(id)
      .populate("preferences.preferredBrands", "name")
      .populate("preferences.preferredRetailers", "name");

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating user preferences",
      error: error.message,
    });
  }
};

// @desc    Link skin profile to user
// @route   PUT /api/users/:id/skin-profile
// @access  Private
export const linkSkinProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { skinProfileId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(skinProfileId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { skinProfile: skinProfileId } },
      { new: true, runValidators: true }
    ).populate("skinProfile");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error linking skin profile",
      error: error.message,
    });
  }
};

// @desc    Update last login timestamp
// @route   PUT /api/users/:id/last-login
// @access  Private
export const updateLastLogin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { lastLoginAt: new Date() } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating last login",
      error: error.message,
    });
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Admin
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Soft delete - set isActive to false
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// @desc    Hard delete user
// @route   DELETE /api/users/:id/hard
// @access  Admin
export const hardDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User permanently deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// @desc    Add preferred brand
// @route   POST /api/users/:id/preferences/brands
// @access  Private
export const addPreferredBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { brandId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(brandId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $addToSet: { "preferences.preferredBrands": brandId } },
      { new: true }
    ).populate("preferences.preferredBrands", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences.preferredBrands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding preferred brand",
      error: error.message,
    });
  }
};

// @desc    Remove preferred brand
// @route   DELETE /api/users/:id/preferences/brands/:brandId
// @access  Private
export const removePreferredBrand = async (req, res) => {
  try {
    const { id, brandId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(brandId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $pull: { "preferences.preferredBrands": brandId } },
      { new: true }
    ).populate("preferences.preferredBrands", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences.preferredBrands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing preferred brand",
      error: error.message,
    });
  }
};

// @desc    Add preferred retailer
// @route   POST /api/users/:id/preferences/retailers
// @access  Private
export const addPreferredRetailer = async (req, res) => {
  try {
    const { id } = req.params;
    const { retailerId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(retailerId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $addToSet: { "preferences.preferredRetailers": retailerId } },
      { new: true }
    ).populate("preferences.preferredRetailers", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences.preferredRetailers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding preferred retailer",
      error: error.message,
    });
  }
};

// @desc    Remove preferred retailer
// @route   DELETE /api/users/:id/preferences/retailers/:retailerId
// @access  Private
export const removePreferredRetailer = async (req, res) => {
  try {
    const { id, retailerId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(retailerId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $pull: { "preferences.preferredRetailers": retailerId } },
      { new: true }
    ).populate("preferences.preferredRetailers", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences.preferredRetailers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing preferred retailer",
      error: error.message,
    });
  }
};