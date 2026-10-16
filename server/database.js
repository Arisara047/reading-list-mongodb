const mongoose = require('mongoose');
async function connectDatabase(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reading_list') {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
}
module.exports = { connectDatabase };
