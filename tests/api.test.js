const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const { createApp } = require('../server/app');
const { connectDatabase } = require('../server/database');
const { Book } = require('../server/models/Book');
let mongo, server, base, id;
// Tests always start their own real mongod, never the database in .env.
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24' }, instance: { args: ['--nounixsocket'] } });
  await connectDatabase(mongo.getUri('reading_list_test'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const call = (method, path = '/api/books', body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
test('Reading List REST API backed by a real isolated MongoDB process', async t => {
  await t.test('GET health confirms database connection', async () => {
    const r=await call('GET','/api/health');assert.equal(r.status,200);assert.equal((await r.json()).database,'connected');
  });
  await t.test('GET collection is initially empty', async () => {
    const r=await call('GET');assert.equal(r.status,200);assert.deepEqual(await r.json(),[]);
  });
  await t.test('POST rejects missing, blank, non-string and unknown fields', async () => {
    for(const body of [{},{title:'Only title'},{title:' ',author:'A'},{title:1,author:'A'},[],{title:'A',author:'B',status:'invalid'},{title:'A',author:'B',_id:'x'}])
      assert.equal((await call('POST','/api/books',body)).status,400);
    assert.equal(await Book.countDocuments(),0);
  });
  await t.test('POST returns 201 and persists Thai text in MongoDB', async () => {
    const r=await call('POST','/api/books',{title:' หนังสือทดสอบภาษาไทย ',author:' นักเขียนตัวอย่าง ',notes:'บันทึกข้อความภาษาไทย'});
    assert.equal(r.status,201);const b=await r.json();id=b.id;
    assert.match(id,/^[a-f0-9]{24}$/);assert.equal(r.headers.get('location'),'/api/books/'+id);assert.equal(b.status,'want-to-read');
    const raw=await Book.collection.findOne({_id:new mongoose.Types.ObjectId(id)});
    assert.equal(raw.title,'หนังสือทดสอบภาษาไทย');assert.equal(raw.notes,'บันทึกข้อความภาษาไทย');assert(raw.createdAt instanceof Date);
  });
  await t.test('GET by ID preserves API id and timestamps', async () => {
    const r=await call('GET','/api/books/'+id);const b=await r.json();assert.equal(r.status,200);assert.equal(b.id,id);assert(!('_id' in b));assert(b.createdAt);assert(b.updatedAt);
  });
  await t.test('PATCH changes only submitted fields in MongoDB', async () => {
    const r=await call('PATCH','/api/books/'+id,{status:'finished'});assert.equal(r.status,200);assert.equal((await r.json()).title,'หนังสือทดสอบภาษาไทย');
    assert.equal((await Book.findById(id)).status,'finished');
  });
  await t.test('GET query status filter includes and excludes records', async () => {
    assert.equal((await (await call('GET','/api/books?status=finished')).json()).length,1);
    assert.deepEqual(await (await call('GET','/api/books?status=reading')).json(),[]);
    assert.equal((await call('GET','/api/books?status=wrong')).status,400);
    assert.equal((await call('GET','/api/books?status=reading&status=finished')).status,400);
  });
  await t.test('PATCH validates type, length and forbidden update operators', async () => {
    for(const body of [{},{title:' '},{author:2},{notes:'x'.repeat(1001)},{title:'x'.repeat(121)},{status:null},{$set:{title:'x'}}])
      assert.equal((await call('PATCH','/api/books/'+id,body)).status,400);
    assert.equal((await Book.findById(id)).title,'หนังสือทดสอบภาษาไทย');
  });
  await t.test('GET, PATCH and DELETE return 404 for missing or malformed IDs', async () => {
    for(const missing of ['missing','000000000000000000000000'])
      for(const method of ['GET','PATCH','DELETE'])
        assert.equal((await call(method,'/api/books/'+missing,method==='PATCH'?{title:'X'}:undefined)).status,404);
  });
  await t.test('Malformed JSON and non-object JSON return 400', async () => {
    for(const body of ['{bad','null','"text"'])
      assert.equal((await fetch(base+'/api/books',{method:'POST',headers:{'Content-Type':'application/json'},body})).status,400);
  });
  await t.test('Oversized request returns 413 and unknown API returns 404', async () => {
    assert.equal((await call('POST','/api/books',{title:'x',author:'A',notes:'x'.repeat(40000)})).status,413);
    assert.equal((await call('GET','/api/missing')).status,404);
  });
  await t.test('Existing data survives application and DB connection restart', async () => {
    await mongoose.disconnect();await connectDatabase(mongo.getUri('reading_list_test'));
    const second=createApp().listen(0,'127.0.0.1');await new Promise(r=>second.once('listening',r));
    try{const r=await fetch(`http://127.0.0.1:${second.address().port}/api/books/${id}`);assert.equal(r.status,200);assert.equal((await r.json()).notes,'บันทึกข้อความภาษาไทย');}
    finally{await new Promise(r=>second.close(r));}
  });
  await t.test('DELETE returns empty 204 and removes the MongoDB document', async () => {
    const r=await call('DELETE','/api/books/'+id);assert.equal(r.status,204);assert.equal(await r.text(),'');assert.equal(await Book.findById(id),null);assert.equal((await call('GET','/api/books/'+id)).status,404);
  });
  await t.test('Database disconnect returns 503 with JSON errors', async () => {
    await mongoose.disconnect();assert.equal((await call('GET','/api/health')).status,503);
    const r=await call('GET');assert.equal(r.status,503);assert.equal(typeof (await r.json()).error,'string');
  });
});
