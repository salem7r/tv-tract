// routes/lists.js
// المسؤول عن: القوائم الخاصة اللي اليوزر بيعملها بنفسه (إنشاء، تعديل، حذف، إضافة/حذف مسلسلات منها)

const express = require("express");
require("../db");
const CustomList = require("../models/CustomList");
const CustomListItem = require("../models/CustomListItem");

const router = express.Router();

// كل راوتات القوائم الخاصة محتاجة تسجيل دخول
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "لازم تسجل دخول الأول" });
  }
  next();
}

router.use(requireAuth);

// 1) كل قوائمي (مع عدد المسلسلات في كل واحدة)
router.get("/", async (req, res) => {
  try {
    const userId = req.session.userId;
    const lists = await CustomList.find({ userId }).sort({ createdAt: -1 });

    const withCounts = await Promise.all(lists.map(async (list) => {
      const count = await CustomListItem.countDocuments({ listId: list._id.toString() });
      return {
        id: list._id.toString(),
        name: list.name,
        itemsCount: count
      };
    }));

    res.json(withCounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب القوائم" });
  }
});

// 2) إنشاء قائمة جديدة
router.post("/", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "اكتب اسم للقائمة" });
    if (name.length > 60) return res.status(400).json({ error: "اسم القائمة طويل أوي (60 حرف كحد أقصى)" });

    const list = await CustomList.create({ userId: req.session.userId, name });
    res.json({ message: "تم إنشاء القائمة", id: list._id.toString(), name: list.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء إنشاء القائمة" });
  }
});

// 3) كل القوائم اللي فيها مسلسل معين (علامة صح جنب اللي فيها المسلسل، عشان بوب أب "أضف لقائمة")
// لازم تكون قبل /:id عشان الترتيب
router.get("/for-show/:showId", async (req, res) => {
  try {
    const userId = req.session.userId;
    const { showId } = req.params;

    const lists = await CustomList.find({ userId });
    const items = await CustomListItem.find({ userId, showId: String(showId) });
    const listIdsWithShow = new Set(items.map(i => i.listId));

    res.json(lists.map(list => ({
      id: list._id.toString(),
      name: list.name,
      hasShow: listIdsWithShow.has(list._id.toString())
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب القوائم" });
  }
});

// 4) تفاصيل قائمة + كل مسلسلاتها
router.get("/:id", async (req, res) => {
  try {
    const list = await CustomList.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!list) return res.status(404).json({ error: "القائمة مش موجودة" });

    const items = await CustomListItem.find({ listId: list._id.toString() }).sort({ createdAt: -1 });

    res.json({
      id: list._id.toString(),
      name: list.name,
      items: items.map(i => ({
        showId: i.showId,
        showName: i.showName,
        posterPath: i.posterPath
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في جلب القائمة" });
  }
});

// 5) تعديل اسم القائمة
router.patch("/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "اكتب اسم للقائمة" });

    const list = await CustomList.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { name },
      { new: true }
    );
    if (!list) return res.status(404).json({ error: "القائمة مش موجودة" });

    res.json({ message: "تم التعديل", name: list.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء التعديل" });
  }
});

// 6) حذف قائمة (وكل عناصرها)
router.delete("/:id", async (req, res) => {
  try {
    const list = await CustomList.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!list) return res.status(404).json({ error: "القائمة مش موجودة" });

    await CustomListItem.deleteMany({ listId: req.params.id });
    res.json({ message: "تم حذف القائمة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الحذف" });
  }
});

// 7) إضافة مسلسل لقائمة
router.post("/:id/items", async (req, res) => {
  try {
    const list = await CustomList.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!list) return res.status(404).json({ error: "القائمة مش موجودة" });

    const { showId, showName, posterPath } = req.body;

    const already = await CustomListItem.findOne({ listId: list._id.toString(), showId: String(showId) });
    if (already) return res.status(400).json({ error: "المسلسل موجود في القائمة دي بالفعل" });

    await CustomListItem.create({
      listId: list._id.toString(),
      userId: req.session.userId,
      showId: String(showId),
      showName,
      posterPath
    });

    res.json({ message: "تمت الإضافة للقائمة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الإضافة للقائمة" });
  }
});

// 8) حذف مسلسل من قائمة
router.delete("/:id/items/:showId", async (req, res) => {
  try {
    const list = await CustomList.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!list) return res.status(404).json({ error: "القائمة مش موجودة" });

    await CustomListItem.findOneAndDelete({ listId: list._id.toString(), showId: String(req.params.showId) });
    res.json({ message: "تم الحذف من القائمة" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ أثناء الحذف من القائمة" });
  }
});

module.exports = router;
