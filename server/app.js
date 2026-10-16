const express = require('express');
const path = require('node:path');
const { Book, statuses } = require('./models/Book');
const isObjectId = id => /^[a-fA-F0-9]{24}$/.test(id);

function validate(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'ข้อมูลต้องอยู่ในรูปแบบ JSON object';
  const keys = Object.keys(body);
  if (!keys.length) return 'กรุณาส่งข้อมูลอย่างน้อยหนึ่งช่อง';
  if (keys.some(key => !['title', 'author', 'status', 'notes'].includes(key))) return 'พบช่องข้อมูลที่ระบบไม่รองรับ';
  for (const [key, max] of [['title', 120], ['author', 80]]) {
    if ((!partial || key in body) && (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > max))
      return `กรุณากรอก${key === 'title' ? 'ชื่อหนังสือ' : 'ชื่อผู้แต่ง'} ความยาว 1–${max} ตัวอักษร`;
  }
  if ('status' in body && !statuses.includes(body.status)) return 'สถานะการอ่านไม่ถูกต้อง';
  if ('notes' in body && (typeof body.notes !== 'string' || body.notes.length > 1000)) return 'บันทึกย่อต้องเป็นข้อความไม่เกิน 1,000 ตัวอักษร';
  return null;
}
const clean = body => Object.fromEntries(Object.entries(body).map(([key, value]) => [key, value.trim()]));

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.on('finish', () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`));
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (req, res) => {
    const connected = Book.db.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'unavailable', database: connected ? 'connected' : 'disconnected' });
  });
  app.use('/api/books', (req, res, next) => {
    if (Book.db.readyState !== 1) return res.status(503).json({ error: 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองอีกครั้ง' });
    next();
  });
  app.get('/api/books', async (req, res) => {
    const status = req.query.status;
    if (status !== undefined && !statuses.includes(status)) return res.status(400).json({ error: 'สถานะที่ใช้กรองไม่ถูกต้อง' });
    res.json(await Book.find(status ? { status } : {}).sort({ createdAt: -1, _id: -1 }));
  });
  app.param('id', (req, res, next, id) => {
    if (!isObjectId(id)) return res.status(404).json({ error: 'ไม่พบหนังสือเล่มนี้' });
    next();
  });
  app.get('/api/books/:id', async (req, res) => {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'ไม่พบหนังสือเล่มนี้' });
    res.json(book);
  });
  app.post('/api/books', async (req, res) => {
    const error = validate(req.body);
    if (error) return res.status(400).json({ error });
    const book = await Book.create(clean(req.body));
    res.location(`/api/books/${book.id}`).status(201).json(book);
  });
  app.patch('/api/books/:id', async (req, res) => {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'ไม่พบหนังสือเล่มนี้' });
    const error = validate(req.body, true);
    if (error) return res.status(400).json({ error });
    book.set(clean(req.body));
    await book.save();
    res.json(book);
  });
  app.delete('/api/books/:id', async (req, res) => {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ error: 'ไม่พบหนังสือเล่มนี้' });
    res.status(204).end();
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบเส้นทาง API ที่เรียกใช้' }));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป' });
    if (err.name === 'ValidationError') return res.status(400).json({ error: 'ข้อมูลหนังสือไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' });
    if (['MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkTimeoutError'].includes(err.name))
      return res.status(503).json({ error: 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองอีกครั้ง' });
    console.error('Request failed:', err.name);
    res.status(500).json({ error: 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง' });
  });
  return app;
}
module.exports = { createApp, validate };
