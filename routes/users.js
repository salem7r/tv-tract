// routes/users.js
// المسؤول عن: الملف الشخصي العام لأي مستخدم (بيوزرنيمه) — الإحصائيات والأوسمة
// الأوسمة بتتحسب لايف من نشاط اليوزر الفعلي، مش بيانات متخزنة، عشان تفضل دايمًا دقيقة

const express = require("express");
require("../db");
const User = require("../models/User");
const UserShow = require("../models/UserShow");
const Review = require("../models/Review");
const Rating = require("../models/Rating");
const Progress = require("../models/Progress");

const router = express.Router();

// تعريف الأوسمة: كل وسام له شرط (مقياس + حد أدنى)
function computeBadges({ reviewsCount, ratingsCount, completedShowsCount, episodesWatched }) {
  const badges = [];

  if (reviewsCount >= 1) badges.push({ icon: "🌱", label: "أول مراجعة" });
  if (reviewsCount >= 10) badges.push({ icon: "📝", label: "ناقد نشيط" });
  if (reviewsCount >= 30) badges.push({ icon: "🖋️", label: "ناقد محترف" });

  if (ratingsCount >= 10) badges.push({ icon: "⭐", label: "مقيّم" });
  if (ratingsCount >= 50) badges.push({ icon: "🌟", label: "خبير تقييم" });

  if (completedShowsCount >= 1) badges.push({ icon: "✅", label: "أول مسلسل خلصته" });
  if (completedShowsCount >= 10) badges.push({ icon: "🏆", label: "منهي محترف" });
  if (completedShowsCount >= 30) badges.push({ icon: "👑", label: "أسطورة المشاهدة" });

  if (episodesWatched >= 100) badges.push({ icon: "📺", label: "مشاهد نهم" });
  if (episodesWatched >= 500) badges.push({ icon: "🔥", label: "لا يُشبع" });

  return badges;
}

// الملف الشخصي العام لأي مستخدم — متاح لأي حد حتى لو مش مسجل دخول
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "المستخدم مش موجود" });

    const userId = user._id.toString();

    const [reviewsCount, ratingsCount, completedShowsCount, episodesWatched] = await Promise.all([
      Review.countDocuments({ userId }),
      Rating.countDocuments({ userId }),
      UserShow.countDocuments({ userId, status: "completed" }),
      Progress.countDocuments({ userId, watched: true })
    ]);

    const stats = { reviewsCount, ratingsCount, completedShowsCount, episodesWatched };

    res.json({
      username: user.username,
      avatarPath: user.avatarPath || null,
      stats,
      badges: computeBadges(stats)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب بيانات المستخدم" });
  }
});

module.exports = router;
