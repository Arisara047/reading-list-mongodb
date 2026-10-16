require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { createApp } = require('./app');
const { connectDatabase } = require('./database');
const port = process.env.PORT || 3000;
let server;
async function start() {
  try {
    // Do not accept requests until MongoDB is connected.
    await connectDatabase();
    console.log('MongoDB connected successfully');
    server = createApp().listen(port, () => console.log(`Reading List: http://localhost:${port}`));
    server.on('error', async error => {
      console.error(error.code === 'EADDRINUSE' ? 'Port is already in use. Set a different PORT in .env.' : 'Unable to start HTTP server.');
      await mongoose.disconnect(); process.exitCode = 1;
    });
  } catch {
    console.error('MongoDB connection failed. Check that MongoDB Server is running and MONGODB_URI is correct.');
    await mongoose.disconnect(); process.exitCode = 1;
  }
}
async function stop() {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
}
process.once('SIGINT', () => stop().then(() => process.exit(0)));
process.once('SIGTERM', () => stop().then(() => process.exit(0)));
start();
