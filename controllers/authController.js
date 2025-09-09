const GovUser = require('../models/GovUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
