// routes/shows.js
// المسؤول عن: البحث عن مسلسلات (عبر TMDb)، إضافة مسلسل لقائمتي، تتبع الحلقات

const express = require("express");
const fetch = require("node-fetch");
require("../db");
const UserShow = require("../models/UserShow");
const Progress = require("../models/Progress");

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY || "YOUR_API_KEY";
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

// 2) إحصائيات المستخدم (لازم تكون قبل /:showId عشان الترتيب)
router.get("/stats/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const watchedEpisodes = await Progress.find({ userId, watched: true });
    const myShows = await UserShow.find({ userId });

    const totalEpisodes = watchedEpisodes.length;

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب الإحصائيات" });
  }
});

// 3) جلب كل مسلسلاتي
router.get("/my/list", requireAuth, async (req, res) => {
  try {
    const shows = await UserShow.find({ userId: req.session.userId });
    res.json(shows.map(s => ({
      id: s._id.toString(),
      userId: s.userId,
      showId: s.showId,
      showName: s.showName,
      posterPath: s.posterPath
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب مسلسلاتك" });
  }
});

// 3) قائمة المشاهدة: الحلقة الجاية المفروض تتفرج عليها في كل مسلسل
router.get("/my/next-episodes", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const myShows = await UserShow.find({ userId });

    const results = await Promise.all(myShows.map(async (show) => {
      try {
        // 1) هات المواسم وعدد حلقات كل موسم من TMDb
        const detailsUrl = `${TMDB_BASE}/tv/${show.showId}?api_key=${TMDB_API_KEY}&language=ar`;
        const detailsRes = await fetch(detailsUrl);
        const details = await detailsRes.json();

        const seasons = (details.seasons || [])
          .filter(s => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number);

        // 2) هات آخر حلقة اتفرج عليها اليوزر في المسلسل ده
        const watched = await Progress.find({ userId, showId: show.showId, watched: true });

        let lastSeason = 0;
        let lastEpisode = 0;
        watched.forEach(w => {
          if (w.seasonNumber > lastSeason || (w.seasonNumber === lastSeason && w.episodeNumber > lastEpisode)) {
            lastSeason = w.seasonNumber;
            lastEpisode = w.episodeNumber;
          }
        });

        // 3) احسب الحلقة الجاية
        let nextSeason = null;
        let nextEpisode = null;

        if (lastSeason === 0) {
          // لسه معملش تعليم لأي حلقة، نبدأ من الأول
          if (seasons.length > 0) {
            nextSeason = seasons[0].season_number;
            nextEpisode = 1;
          }
        } else {
          const currentSeasonInfo = seasons.find(s => s.season_number === lastSeason);
          if (currentSeasonInfo && lastEpisode < currentSeasonInfo.episode_count) {
            nextSeason = lastSeason;
            nextEpisode = lastEpisode + 1;
          } else {
            const nextSeasonInfo = seasons.find(s => s.season_number === lastSeason + 1);
            if (nextSeasonInfo) {
              nextSeason = nextSeasonInfo.season_number;
              nextEpisode = 1;
            }
            // لو مفيش موسم جاي، يبقى المسلسل خلص (نسيب nextSeason=null)
          }
        }

        // 4) هات اسم الحلقة الجاية (لو موجودة)
        let episodeName = null;
        if (nextSeason) {
          const seasonUrl = `${TMDB_BASE}/tv/${show.showId}/season/${nextSeason}?api_key=${TMDB_API_KEY}&language=ar`;
          const seasonRes = await fetch(seasonUrl);
          const seasonData = await seasonRes.json();
          const ep = (seasonData.episodes || []).find(e => e.episode_number === nextEpisode);
          episodeName = ep ? ep.name : null;
        }

        return {
          showId: show.showId,
          showName: show.showName,
          posterPath: show.posterPath,
          completed: nextSeason === null,
          nextSeason,
          nextEpisode,
          episodeName
        };
      } catch (err) {
        console.error(`خطأ في حساب الحلقة الجاية للمسلسل ${show.showId}:`, err.message);
        return {
          showId: show.showId,
          showName: show.showName,
          posterPath: show.posterPath,
          completed: false,
          nextSeason: null,
          nextEpisode: null,
          episodeName: null,
          error: true
        };
      }
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب قائمة المشاهدة" });
  }
});

// 4) المرتقبة: مواعيد نزول الحلقات الجديدة (من بيانات TMDb الرسمية)
router.get("/my/upcoming", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const myShows = await UserShow.find({ userId });

    const results = await Promise.all(myShows.map(async (show) => {
      try {
        const detailsUrl = `${TMDB_BASE}/tv/${show.showId}?api_key=${TMDB_API_KEY}&language=ar`;
        const detailsRes = await fetch(detailsUrl);
        const details = await detailsRes.json();

        const next = details.next_episode_to_air;
        if (!next || !next.air_date) return null;

        return {
          showId: show.showId,
          showName: show.showName,
          posterPath: show.posterPath,
          airDate: next.air_date,
          seasonNumber: next.season_number,
          episodeNumber: next.episode_number,
          episodeName: next.name || null
        };
      } catch (err) {
        console.error(`خطأ في جلب موعد الحلقة الجاية للمسلسل ${show.showId}:`, err.message);
        return null;
      }
    }));

    const upcoming = results
      .filter(Boolean)
      .sort((a, b) => new Date(a.airDate) - new Date(b.airDate));

    res.json(upcoming);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب المرتقبة" });
  }
});

// 5) تفاصيل مسلسل معين (بيرجع كل المواسم)
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

// 5) تفاصيل موسم معين (بيرجع كل الحلقات)
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

// 6) إضافة مسلسل لقائمة "مسلسلاتي"
router.post("/my-shows", requireAuth, async (req, res) => {
  try {
    const { showId, showName, posterPath } = req.body;
    const userId = req.session.userId;

    const already = await UserShow.findOne({ userId, showId: String(showId) });
    if (already) {
      return res.status(400).json({ error: "المسلسل ده مضاف بالفعل" });
    }

    const entry = await UserShow.create({
      userId,
      showId: String(showId),
      showName,
      posterPath
    });

    res.json({ message: "تمت الإضافة", entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الإضافة" });
  }
});

// 7) حذف مسلسل من قائمتي
router.delete("/my-shows/:id", requireAuth, async (req, res) => {
  try {
    await UserShow.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.json({ message: "تم الحذف" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الحذف" });
  }
});

// 8) تعليم حلقة كـ "متفرج عليها" أو إلغاء التعليم
router.post("/progress", requireAuth, async (req, res) => {
  try {
    const { showId, seasonNumber, episodeNumber, watched } = req.body;
    const userId = req.session.userId;

    await Progress.findOneAndUpdate(
      { userId, showId: String(showId), seasonNumber, episodeNumber },
      { userId, showId: String(showId), seasonNumber, episodeNumber, watched },
      { upsert: true, new: true }
    );

    res.json({ message: "تم التحديث" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء التحديث" });
  }
});

// 9) جلب تقدم المشاهدة لمسلسل معين
router.get("/:showId/progress", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { showId } = req.params;
    const items = await Progress.find({ userId, showId: String(showId) });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب التقدم" });
  }
});

module.exports = router;
