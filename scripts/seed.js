require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { connectDatabase } = require('../server/database');
const { Book } = require('../server/models/Book');
const books = [
  { title: 'หนังสือเล่มแรกของฉัน', author: 'นักเขียนตัวอย่าง', status: 'want-to-read', notes: 'อยากอ่านในวันหยุด' },
  { title: 'เปิดโลกการอ่าน', author: 'นักเขียนตัวอย่าง', status: 'reading', notes: 'อ่านวันละบท' },
  { title: 'บันทึกความประทับใจ', author: 'นักเขียนตัวอย่าง', status: 'finished', notes: 'อ่านจบแล้วและอยากกลับมาอ่านอีก' }
];
async function seed() {
  try {
    await connectDatabase();
    for (const book of books) await Book.updateOne({ title: book.title, author: book.author }, { $setOnInsert: book }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
    console.log('Sample books are ready. Existing books were not overwritten.');
  } catch { console.error('Unable to seed books. Check MongoDB Server and MONGODB_URI.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
seed();
