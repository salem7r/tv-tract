// models/CustomListItem.js
// كل مسلسل داخل قائمة خاصة معينة

const mongoose = require("mongoose");

const customListItemSchema = new mongoose.Schema({
  listId: { type: String, required: true },
  userId: { type: String, required: true },
  showId: { type: String, required: true },
  showName: { type: String, required: true },
  posterPath: { type: String }
}, { timestamps: true });

// منع تكرار نفس المسلسل في نفس القائمة
customListItemSchema.index({ listId: 1, showId: 1 }, { unique: true });

module.exports = mongoose.model("CustomListItem", customListItemSchema);
