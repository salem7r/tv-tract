// db.js
// ده الملف المسؤول عن قاعدة البيانات
// بنستخدم lowdb اللي بتخزن البيانات في ملف JSON بسيط (سهل للمبتدئين ومفيش تعقيد تنصيب)

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("database.json");
const db = low(adapter);

// القيم الافتراضية لو الملف فاضي أول مرة
db.defaults({
  users: [],       // كل مستخدم: { id, username, passwordHash }
  userShows: [],   // كل مسلسل مضاف لليوزر: { id, userId, showId, showName, posterPath }
  progress: []      // تقدم المشاهدة: { id, userId, showId, seasonNumber, episodeNumber, watched }
}).write();

module.exports = db;
