// models/Rating.js
// تقييمات المستخدم الشخصية: للمسلسل ككل (seasonNumber/episodeNumber = null)
// أو لحلقة معينة لوحدها (seasonNumber/episodeNumber محددين)

const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  showId: { type: String, required: true },
  seasonNumber: { type: Number, default: null },
  episodeNumber: { type: Number, default: null },
  rating: { type: Number, required: true, min: 1, max: 10 }
}, { timestamps: true });

// تقييم واحد بس لكل (يوزر + مسلسل + موسم + حلقة) — تحديث التقييم بيستبدل القديم
ratingSchema.index(
  { userId: 1, showId: 1, seasonNumber: 1, episodeNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Rating", ratingSchema);
