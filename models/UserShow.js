// models/UserShow.js
// المسلسلات اللي كل مستخدم ضافها لقائمته

const mongoose = require("mongoose");

const userShowSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  showId: { type: String, required: true },
  showName: { type: String, required: true },
  posterPath: { type: String }
}, { timestamps: true });

// منع تكرار نفس المسلسل لنفس اليوزر
userShowSchema.index({ userId: 1, showId: 1 }, { unique: true });

module.exports = mongoose.model("UserShow", userShowSchema);
