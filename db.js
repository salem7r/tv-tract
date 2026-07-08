// db.js
// المسؤول عن الاتصال بقاعدة بيانات MongoDB Atlas

const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("⚠️  متغير البيئة MONGODB_URI مش متظبط. ضيفه قبل ما تشغل السيرفر.");
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ اتصل بقاعدة بيانات MongoDB بنجاح"))
  .catch(err => console.error("❌ فشل الاتصال بقاعدة البيانات:", err.message));

module.exports = mongoose;
