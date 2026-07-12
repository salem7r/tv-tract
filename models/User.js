// models/User.js
// شكل بيانات المستخدم في قاعدة البيانات

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  avatarPath: { type: String, default: null } // مسار الصورة الشخصية بعد الرفع، زي /uploads/avatars/xxx.jpg
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
