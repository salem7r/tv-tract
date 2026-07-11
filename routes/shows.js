// routes/shows.js
// المسؤول عن: البحث عن مسلسلات (عبر TMDb)، إضافة مسلسل لقائمتي، تتبع الحلقات

const express = require("express");
const fetch = require("node-fetch");
require("../db");
const UserShow = require("../models/UserShow");
const Progress = require("../models/Progress");
const Rating = require("../models/Rating");

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

// 1.5) المسلسلات الرائجة (لعرضها في استكشف قبل ما اليوزر يكتب أي حاجة)
router.get("/trending", async (req, res) => {
  try {
    const url = `${TMDB_BASE}/trending/tv/week?api_key=${TMDB_API_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.results || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب المسلسلات الرائجة" });
  }
});

// 2) إحصائيات المستخدم (لازم تكون قبل /:showId عشان الترتيب)
router.get("/stats/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const watchedEpisodes = await Progress.find({ userId, watched: true });
    const myShows = await UserShow.find({ userId });

    // تقييماتك الشخصية للمسلسلات ككل (مش الحلقات) عشان نحسب متوسطك العام
    const showRatings = await Rating.find({ userId, seasonNumber: null, episodeNumber: null });

    const totalEpisodes = watchedEpisodes.length;

    const AVG_EPISODE_MINUTES = 45;
    const totalMinutes = totalEpisodes * AVG_EPISODE_MINUTES;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const avgRating = showRatings.length > 0
      ? Math.round((showRatings.reduce((sum, r) => sum + r.rating, 0) / showRatings.length) * 10) / 10
      : null;

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
      avgRating,
      perShow
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب الإحصائيات" });
  }
});

// 3) جلب كل مسلسلاتي
// ?status=planning|watching|completed|dropped للفلترة بالحالة
// ?favorite=true لعرض المفضلة بس
router.get("/my/list", requireAuth, async (req, res) => {
  try {
    const filter = { userId: req.session.userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.favorite === "true") filter.isFavorite = true;

    const shows = await UserShow.find(filter).sort({ createdAt: -1 });
    res.json(shows.map(s => ({
      id: s._id.toString(),
      userId: s.userId,
      showId: s.showId,
      showName: s.showName,
      posterPath: s.posterPath,
      status: s.status,
      isFavorite: s.isFavorite
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب مسلسلاتك" });
  }
});

// 3.5) ملخص عدد المسلسلات في كل حالة (لعرض الأرقام في تابات صفحة "قوائمي")
router.get("/my/lists-overview", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const all = await UserShow.find({ userId });

    const counts = { planning: 0, watching: 0, completed: 0, dropped: 0, favorite: 0, total: all.length };
    all.forEach(s => {
      if (counts[s.status] !== undefined) counts[s.status]++;
      if (s.isFavorite) counts.favorite++;
    });

    res.json(counts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب ملخص القوائم" });
  }
});

// 3.6) حالة مسلسل معين بالنسبة لليوزر الحالي (مضاف؟ حالته إيه؟ مفضل؟)
// بيستخدمها زرار الحالة في صفحة تفاصيل المسلسل
router.get("/my-shows/for/:showId", requireAuth, async (req, res) => {
  try {
    const entry = await UserShow.findOne({ userId: req.session.userId, showId: String(req.params.showId) });
    if (!entry) return res.json({ inList: false });

    res.json({
      inList: true,
      id: entry._id.toString(),
      status: entry.status,
      isFavorite: entry.isFavorite
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب حالة المسلسل" });
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
          episodeName,
          totalEpisodes: seasons.reduce((sum, s) => sum + (s.episode_count || 0), 0),
          watchedEpisodes: watched.length
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
          totalEpisodes: 0,
          watchedEpisodes: 0,
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

// 7.5) تعديل حالة المشاهدة و/أو المفضلة لمسلسل في قائمتي
router.patch("/my-shows/:id", requireAuth, async (req, res) => {
  try {
    const { status, isFavorite } = req.body;
    const update = {};

    if (status !== undefined) {
      const validStatuses = ["planning", "watching", "completed", "dropped"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "حالة غير معروفة" });
      }
      update.status = status;
    }

    if (isFavorite !== undefined) update.isFavorite = !!isFavorite;

    const entry = await UserShow.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      update,
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: "المسلسل مش في قائمتك" });

    res.json({ message: "تم التحديث", status: entry.status, isFavorite: entry.isFavorite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء التحديث" });
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

// 10) تقييم مسلسل ككل أو حلقة معينة
// لو seasonNumber و episodeNumber جايين null، يبقى ده تقييم للمسلسل كله
router.post("/rating", requireAuth, async (req, res) => {
  try {
    const { showId, seasonNumber, episodeNumber, rating } = req.body;
    const userId = req.session.userId;

    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ error: "التقييم لازم يكون رقم من 1 لـ 10" });
    }

    const season = seasonNumber === undefined ? null : seasonNumber;
    const episode = episodeNumber === undefined ? null : episodeNumber;

    await Rating.findOneAndUpdate(
      { userId, showId: String(showId), seasonNumber: season, episodeNumber: episode },
      { userId, showId: String(showId), seasonNumber: season, episodeNumber: episode, rating },
      { upsert: true, new: true }
    );

    res.json({ message: "تم حفظ التقييم" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء حفظ التقييم" });
  }
});

// 11) جلب كل تقييماتي لمسلسل معين (تقييم المسلسل ككل + كل موسم + كل حلقة)
router.get("/:showId/ratings", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { showId } = req.params;
    const items = await Rating.find({ userId, showId: String(showId) });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب التقييمات" });
  }
});

// 12) متوسط تقييم كل المستخدمين (مش تقييمك إنت بس) لمسلسل، أو لموسم معين، أو لحلقة معينة
// أمثلة: /api/shows/1396/community-rating              -> متوسط المسلسل ككل
//        /api/shows/1396/community-rating?season=2      -> متوسط الموسم التاني
//        /api/shows/1396/community-rating?season=2&episode=5 -> متوسط حلقة معينة
router.get("/:showId/community-rating", requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const seasonNumber = req.query.season ? Number(req.query.season) : null;
    const episodeNumber = req.query.episode ? Number(req.query.episode) : null;

    const items = await Rating.find({
      showId: String(showId),
      seasonNumber,
      episodeNumber
    });

    if (items.length === 0) {
      return res.json({ average: null, count: 0 });
    }

    const average = Math.round((items.reduce((sum, r) => sum + r.rating, 0) / items.length) * 10) / 10;
    res.json({ average, count: items.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب متوسط التقييم" });
  }
});

module.exports = router;
