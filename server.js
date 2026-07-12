// server.js
// نقطة انطلاق التطبيق

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/auth");
const showsRoutes = require("./routes/shows");
const reviewsRoutes = require("./routes/reviews");
const listsRoutes = require("./routes/lists");
const usersRoutes = require("./routes/users");

const app = express();
const PORT = process.env.PORT || 3000;

// عشان نقدر نقرأ بيانات JSON جاية من الفرونت اند
app.use(express.json());

// إعداد الـ session (عشان نعرف مين مسجل دخول)
app.use(session({
  secret: "tv-time-secret-key-change-me", // في مشروع حقيقي، غيّر السطر ده لقيمة سرية قوية
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // أسبوع
}));

// ملفات الفرونت اند (HTML/CSS/JS) هتتقرأ من مجلد public
app.use(express.static(path.join(__dirname, "public")));

// الراوتس
app.use("/api/auth", authRoutes);
app.use("/api/shows", showsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/lists", listsRoutes);
app.use("/api/users", usersRoutes);

app.listen(PORT, () => {
  console.log(`السيرفر شغال على http://localhost:${PORT}`);
});
