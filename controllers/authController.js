const GovUser = require('../models/GovUser'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');

// ==========================
// GOV LOGIN
// ==========================
exports.loginGovUser = async (req, res) => {
  const { userId, password } = req.body;

  try {
    const user = await GovUser.findOne({ userId });
    if (!user) {
      return res.status(401).json({ message: "Invalid userId or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid userId or password" });
    }

    const token = jwt.sign({ id: user._id, role: "gov" }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, userId: user.userId },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// ==========================
// FORGOT PASSWORD (SEND RESET LINK)
// ==========================
exports.forgotPasswordGov = async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await GovUser.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token (valid for 15 mins)
    const resetToken = jwt.sign({ id: user._id }, process.env.RESET_SECRET, {
      expiresIn: "15m",
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send reset email
    await sendEmail(
      user.gmail,
      "Blue Carbon Portal Password Reset",
      `Hello,\n\nWe received a request to reset your password. 
Click the link below to reset your password:\n\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf this wasn't you, ignore this email.\n\n- Blue Carbon Team`
    );

    res.status(200).json({ message: "Password reset link sent to registered email" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// ==========================
// RESET PASSWORD
// ==========================
exports.resetPasswordGov = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.RESET_SECRET);
    const user = await GovUser.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Assign new password (model hook will hash it)
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired token", error });
  }
};
