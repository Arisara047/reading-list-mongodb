const mongoose = require('mongoose');
const statuses = ['want-to-read', 'reading', 'finished'];
const bookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  author: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  status: { type: String, enum: statuses, default: 'want-to-read', required: true },
  notes: { type: String, trim: true, default: '', maxlength: 1000 }
}, {
  timestamps: true,
  bufferCommands: false,
  toJSON: {
    // Keep the API's `id` field so the existing frontend can use MongoDB IDs.
    transform(doc, ret) { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; }
  }
});
bookSchema.index({ status: 1, createdAt: -1 });
const Book = mongoose.model('Book', bookSchema);
module.exports = { Book, statuses };
