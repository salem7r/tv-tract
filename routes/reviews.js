// routes/reviews.js
// المسؤول عن: نشر مراجعة، جلب مراجعات مسلسل (بترتيب الأحدث أو الأعلى لايكات)، لايك/إلغاء لايك، وحذف

const express = require("express");
require("../db");
const Review = require("../models/Review");

const router = express.Router();

// middleware: لازم تكون مسجل دخول عشان تنشر/تلايك/تحذف
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "لازم تسجل دخول الأول" });
  }
  next();
}

// 1) نشر مراجعة جديدة (لو عندك مراجعة قديمة لنفس المسلسل/الموسم/الحلقة، هتتستبدل بالجديدة)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { showId, seasonNumber, episodeNumber, text } = req.body;
    const userId = req.session.userId;
    const username = req.session.username;

    const trimmed = (text || "").trim();
    if (!trimmed) {
      return res.status(400).json({ error: "اكتب مراجعة الأول" });
    }
    if (trimmed.length > 2000) {
      return res.status(400).json({ error: "المراجعة طويلة أوي (2000 حرف كحد أقصى)" });
    }

    const season = seasonNumber === undefined ? null : seasonNumber;
    const episode = episodeNumber === undefined ? null : episodeNumber;

    const review = await Review.findOneAndUpdate(
      { userId, showId: String(showId), seasonNumber: season, episodeNumber: episode },
      { userId, username, showId: String(showId), seasonNumber: season, episodeNumber: episode, text: trimmed },
      { upsert: true, new: true }
    );

    res.json({ message: "تم نشر المراجعة", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء نشر المراجعة" });
  }
});

// 2) جلب مراجعات مسلسل معين
// ?season=2&episode=5 لو عايز مراجعات موسم/حلقة بدل المسلسل ككل
// ?sort=top للأعلى لايكات، وإلا هيرجعوا بالأحدث الأول
router.get("/:showId", async (req, res) => {
  try {
    const { showId } = req.params;
    const seasonNumber = req.query.season ? Number(req.query.season) : null;
    const episodeNumber = req.query.episode ? Number(req.query.episode) : null;
    const sort = req.query.sort === "top" ? "top" : "newest";

    const items = await Review.find({ showId: String(showId), seasonNumber, episodeNumber }).lean();

    items.sort((a, b) => {
      if (sort === "top") {
        const diff = (b.likes?.length || 0) - (a.likes?.length || 0);
        if (diff !== 0) return diff;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const currentUserId = req.session.userId || null;
    const result = items.map(r => ({
      id: r._id.toString(),
      username: r.username,
      text: r.text,
      seasonNumber: r.seasonNumber,
      episodeNumber: r.episodeNumber,
      likesCount: (r.likes || []).length,
      likedByMe: currentUserId ? (r.likes || []).includes(currentUserId) : false,
      isMine: currentUserId === r.userId,
      createdAt: r.createdAt
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب المراجعات" });
  }
});

// 3) لايك / إلغاء لايك على مراجعة
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "المراجعة مش موجودة" });

    const idx = review.likes.indexOf(userId);
    if (idx === -1) {
      review.likes.push(userId);
    } else {
      review.likes.splice(idx, 1);
    }
    await review.save();

    res.json({ likesCount: review.likes.length, likedByMe: review.likes.includes(userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء تسجيل اللايك" });
  }
});

// 4) حذف مراجعتك (مينفعش تحذف مراجعة حد تاني)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await Review.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!deleted) return res.status(404).json({ error: "المراجعة مش موجودة أو مش بتاعتك" });
    res.json({ message: "تم حذف المراجعة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الحذف" });
  }
});

module.exports = router;
