// models/UserShow.js
// المسلسلات اللي كل مستخدم ضافها لقائمته + حالة المشاهدة (زي Letterboxd) + المفضلة

const mongoose = require("mongoose");

const userShowSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  showId: { type: String, required: true },
  showName: { type: String, required: true },
  posterPath: { type: String },
  // حالة واحدة بس في نفس الوقت لكل مسلسل
  status: {
    type: String,
    enum: ["planning", "watching", "completed", "dropped"],
    default: "planning"
  },
  // المفضلة علامة منفصلة، ممكن تتحط مع أي حالة
  isFavorite: { type: Boolean, default: false }
}, { timestamps: true });

// منع تكرار نفس المسلسل لنفس اليوزر
userShowSchema.index({ userId: 1, showId: 1 }, { unique: true });

module.exports = mongoose.model("UserShow", userShowSchema);
