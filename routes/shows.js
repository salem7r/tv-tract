// routes/shows.js
// المسؤول عن: البحث عن مسلسلات (عبر TMDb)، إضافة مسلسل لقائمتي، تتبع الحلقات

const express = require("express");
const fetch = require("node-fetch");
const db = require("../db");

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY || "01b494d03f636220f1a288d164afc5d6";
const TMDB_BASE = "https://api.themoviedb.org/3";

// middleware: لازم تكون مسجل دخول عشان تستخدم الراوت ده
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "لازم تسجل دخول الأول" });
  }
  next();
}

// 1) البحث عن مسلسل
router.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "اكتب اسم المسلسل" });

  try {
    const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${TMDB_API_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.results || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في الاتصال بـ TMDb" });
  }
});

// 2) تفاصيل مسلسل معين (بيرجع كل المواسم)
router.get("/:showId", async (req, res) => {
  const { showId } = req.params;
  try {
    const url = `${TMDB_BASE}/tv/${showId}?api_key=${TMDB_API_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب تفاصيل المسلسل" });
  }
});

// 3) تفاصيل موسم معين (بيرجع كل الحلقات)
router.get("/:showId/season/:seasonNumber", async (req, res) => {
  const { showId, seasonNumber } = req.params;
  try {
    const url = `${TMDB_BASE}/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب حلقات الموسم" });
  }
});

// 4) إضافة مسلسل لقائمة "مسلسلاتي"
router.post("/my-shows", requireAuth, (req, res) => {
  const { showId, showName, posterPath } = req.body;
  const userId = req.session.userId;

  const already = db.get("userShows")
    .find({ userId, showId: String(showId) })
    .value();

  if (already) {
    return res.status(400).json({ error: "المسلسل ده مضاف بالفعل" });
  }

  const entry = {
    id: Date.now().toString(),
    userId,
    showId: String(showId),
    showName,
    posterPath
  };

  db.get("userShows").push(entry).write();
  res.json({ message: "تمت الإضافة", entry });
});

// 5) جلب كل مسلسلاتي
router.get("/my/list", requireAuth, (req, res) => {
  const userId = req.session.userId;
  const shows = db.get("userShows").filter({ userId }).value();
  res.json(shows);
});

// 6) حذف مسلسل من قائمتي
router.delete("/my-shows/:id", requireAuth, (req, res) => {
  db.get("userShows").remove({ id: req.params.id, userId: req.session.userId }).write();
  res.json({ message: "تم الحذف" });
});

// 7) تعليم حلقة كـ "متفرج عليها" أو إلغاء التعليم
router.post("/progress", requireAuth, (req, res) => {
  const { showId, seasonNumber, episodeNumber, watched } = req.body;
  const userId = req.session.userId;

  const existing = db.get("progress")
    .find({ userId, showId: String(showId), seasonNumber, episodeNumber })
    .value();

  if (existing) {
    db.get("progress")
      .find({ id: existing.id })
      .assign({ watched })
      .write();
  } else {
    db.get("progress").push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      userId,
      showId: String(showId),
      seasonNumber,
      episodeNumber,
      watched
    }).write();
  }

  res.json({ message: "تم التحديث" });
});

// 8) جلب تقدم المشاهدة لمسلسل معين
router.get("/:showId/progress", requireAuth, (req, res) => {
  const userId = req.session.userId;
  const { showId } = req.params;
  const items = db.get("progress")
    .filter({ userId, showId: String(showId) })
    .value();
  res.json(items);
});

// 9) إحصائيات المستخدم (عدد الحلقات، تقدير الساعات، تفصيل لكل مسلسل)
router.get("/stats/summary", requireAuth, (req, res) => {
  const userId = req.session.userId;

  const watchedEpisodes = db.get("progress").filter({ userId, watched: true }).value();
  const myShows = db.get("userShows").filter({ userId }).value();

  const totalEpisodes = watchedEpisodes.length;

  // بنفترض متوسط مدة الحلقة 45 دقيقة (تقدير تقريبي مفيش API بيديها بالظبط بسهولة)
  const AVG_EPISODE_MINUTES = 45;
  const totalMinutes = totalEpisodes * AVG_EPISODE_MINUTES;
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const perShow = myShows.map(show => {
    const count = watchedEpisodes.filter(p => p.showId === show.showId).length;
    return {
      showId: show.showId,
      showName: show.showName,
      posterPath: show.posterPath,
      episodesWatched: count
    };
  }).sort((a, b) => b.episodesWatched - a.episodesWatched);

  res.json({
    totalEpisodes,
    totalHours,
    totalShows: myShows.length,
    perShow
  });
});

module.exports = router;
