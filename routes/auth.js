// routes/auth.js
// المسؤول عن: تسجيل حساب جديد، تسجيل الدخول، تسجيل الخروج

const express = require("express");
const bcrypt = require("bcryptjs");
require("../db"); // التأكد إن الاتصال بقاعدة البيانات بدأ
const User = require("../models/User");

const router = express.Router();

// نسمح بس بحروف إنجليزية وأرقام و _ و - في اسم المستخدم
// عشان نمنع من الأساس أي محاولة حقن كود ضار (XSS) عن طريق اسم المستخدم
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

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
router.get("/me", (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, username: req.session.username });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
