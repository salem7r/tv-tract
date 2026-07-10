// models/Review.js
// مراجعات المستخدمين على المسلسلات: نص المراجعة (ممكن يحتوي على أجزاء سبويلر متخفية) + لايكات
// نفس فكرة seasonNumber/episodeNumber في Rating.js: لو الاتنين null يبقى المراجعة للمسلسل ككل

const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true }, // بنخزنه هنا عشان نعرضه بسرعة من غير lookup لكل يوزر
  showId: { type: String, required: true },
  seasonNumber: { type: Number, default: null },
  episodeNumber: { type: Number, default: null },
  text: { type: String, required: true, maxlength: 2000 },
  likes: { type: [String], default: [] } // مصفوفة userId لكل واحد عمل لايك
}, { timestamps: true });

// مراجعة واحدة بس لكل (يوزر + مسلسل + موسم + حلقة) — إعادة النشر بتستبدل القديمة (تعديل)
reviewSchema.index(
  { userId: 1, showId: 1, seasonNumber: 1, episodeNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Review", reviewSchema);
