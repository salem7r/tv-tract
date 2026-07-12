// routes/auth.js
// المسؤول عن: تسجيل حساب جديد، تسجيل الدخول، تسجيل الخروج، رفع الصورة الشخصية

const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("../db"); // التأكد إن الاتصال بقاعدة البيانات بدأ
const User = require("../models/User");

const router = express.Router();

// نسمح بس بحروف إنجليزية وأرقام و _ و - في اسم المستخدم
// عشان نمنع من الأساس أي محاولة حقن كود ضار (XSS) عن طريق اسم المستخدم
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

// ===== إعداد رفع الصورة الشخصية =====

const avatarsDir = path.join(__dirname, "..", "public", "uploads", "avatars");
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.session.userId}-${Date.now()}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 ميجا كحد أقصى
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("INVALID_TYPE"));
    }
    cb(null, true);
  }
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "لازم تسجل دخول الأول" });
  }
  next();
}

// تسجيل حساب جديد
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "لازم تكتب اسم المستخدم وكلمة السر" });
    }

    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json({
        error: "اسم المستخدم لازم يكون من 3 لـ 20 حرف، وحروف إنجليزية وأرقام و _ بس"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "كلمة السر لازم تكون 6 أحرف على الأقل" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "اسم المستخدم ده مستخدم قبل كده" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = await User.create({ username, passwordHash });

    // تسجيل دخول تلقائي بعد التسجيل
    req.session.userId = newUser._id.toString();
    req.session.username = newUser.username;

    res.json({ message: "تم إنشاء الحساب بنجاح", username: newUser.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر، حاول تاني" });
  }
});

// تسجيل الدخول
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "اسم المستخدم غير موجود" });
    }

    const isValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: "كلمة السر غير صحيحة" });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    res.json({ message: "تم تسجيل الدخول بنجاح", username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "حصل خطأ في السيرفر، حاول تاني" });
  }
});

// تسجيل الخروج
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "تم تسجيل الخروج" });
  });
});

// معرفة حالة تسجيل الدخول الحالية
router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }

  try {
    const user = await User.findById(req.session.userId);
    res.json({
      loggedIn: true,
      username: req.session.username,
      avatarPath: user ? user.avatarPath : null
    });
  } catch (err) {
    console.error(err);
    res.json({ loggedIn: true, username: req.session.username, avatarPath: null });
  }
});

// رفع/تغيير الصورة الشخصية
router.post("/avatar", requireAuth, (req, res) => {
  uploadAvatar.single("avatar")(req, res, async (err) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "الصورة أكبر من 3 ميجا"
        : "الصورة لازم تكون jpg أو png أو webp أو gif";
      return res.status(400).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "اختار صورة الأول" });
    }

    try {
      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      await User.findByIdAndUpdate(req.session.userId, { avatarPath });
      res.json({ message: "تم تحديث الصورة", avatarPath });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: "حصل خطأ أثناء حفظ الصورة" });
    }
  });
});

module.exports = router;
