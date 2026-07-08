// models/Progress.js
// تتبع الحلقات اللي كل مستخدم شافها

const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  showId: { type: String, required: true },
  seasonNumber: { type: Number, required: true },
  episodeNumber: { type: Number, required: true },
  watched: { type: Boolean, default: false }
}, { timestamps: true });

// منع تكرار نفس الحلقة لنفس اليوزر
progressSchema.index(
  { userId: 1, showId: 1, seasonNumber: 1, episodeNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Progress", progressSchema);
