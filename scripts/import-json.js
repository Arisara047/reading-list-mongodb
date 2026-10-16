// Optional migration from the old JSON edition. The web app itself never reads JSON files.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { connectDatabase } = require('../server/database');
const { Book } = require('../server/models/Book');
const { validate } = require('../server/app');
async function run() {
  try {
    const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '../data/books.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Expected an array');
    const books = data.map(({ id, _id, ...book }) => {
      if (validate(book)) throw new Error('Invalid book');
      return book;
    });
    await connectDatabase();
    for (const book of books) await Book.updateOne({ title: book.title.trim(), author: book.author.trim() }, { $setOnInsert: book }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
    console.log(`Import complete: ${books.length} source records processed; existing matching books unchanged.`);
  } catch { console.error('Import failed. Check the JSON file, its fields, MongoDB Server and MONGODB_URI.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
run();
