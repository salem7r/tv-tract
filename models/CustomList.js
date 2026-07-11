// models/CustomList.js
// قوائم خاصة يعملها اليوزر بنفسه (زي Lists في Letterboxd)

const mongoose = require("mongoose");

const customListSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 60 }
}, { timestamps: true });

module.exports = mongoose.model("CustomList", customListSchema);
