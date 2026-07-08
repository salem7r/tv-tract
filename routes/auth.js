// routes/auth.js
// المسؤول عن: تسجيل حساب جديد، تسجيل الدخول، تسجيل الخروج

const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

// تسجيل حساب جديد
router.post("/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "لازم تكتب اسم المستخدم وكلمة السر" });
  }

  const existingUser = db.get("users").find({ username }).value();
  if (existingUser) {
    return res.status(400).json({ error: "اسم المستخدم ده مستخدم قبل كده" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = {
    id: Date.now().toString(),
    username,
    passwordHash
  };

  db.get("users").push(newUser).write();

  // تسجيل دخول تلقائي بعد التسجيل
  req.session.userId = newUser.id;
  req.session.username = newUser.username;

  res.json({ message: "تم إنشاء الحساب بنجاح", username: newUser.username });
});

// تسجيل الدخول
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = db.get("users").find({ username }).value();
  if (!user) {
    return res.status(400).json({ error: "اسم المستخدم غير موجود" });
  }

  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) {
    return res.status(400).json({ error: "كلمة السر غير صحيحة" });
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.json({ message: "تم تسجيل الدخول بنجاح", username: user.username });
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
