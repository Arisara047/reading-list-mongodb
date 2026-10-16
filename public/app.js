const $ = id => document.getElementById(id);
const labels = { 'want-to-read': 'อยากอ่าน', reading: 'กำลังอ่าน', finished: 'อ่านจบแล้ว' };
let editingId = null;
let deletingId = null;
let loadVersion = 0;
function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
async function api(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }); }
  catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงาน'); }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง');
  return data;
}
function element(tag, className, text) {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
}
async function loadBooks() {
  const version = ++loadVersion;
  $('books').setAttribute('aria-busy', 'true'); $('retry').hidden = true;
  try {
    const status = $('filter').value;
    const books = await api('/api/books' + (status ? '?status=' + encodeURIComponent(status) : ''));
    if (version !== loadVersion) return;
    $('books').replaceChildren(); $('count').textContent = books.length;
    if (!books.length) $('books').append(element('p', 'empty', 'ยังไม่มีหนังสือในรายการนี้ ลองเพิ่มหนังสือหรือเปลี่ยนตัวกรอง'));
    for (const book of books) {
      const card = element('article', 'book', '');
      const top = element('div', 'book-top', '');
      const cover = element('div', 'cover', book.title.slice(0, 1).toUpperCase()); cover.setAttribute('aria-hidden', 'true');
      const info = element('div', 'book-info', '');
      info.append(element('span', 'badge ' + book.status, labels[book.status]), element('h3', '', book.title), element('p', 'author', book.author));
      top.append(cover, info);
      const actions = element('div', 'book-actions', '');
      for (const [text, action, cls] of [['ดูรายละเอียด', () => showBook(book.id), ''], ['แก้ไข', () => editBook(book.id), ''], ['ลบ', () => askDelete(book), 'delete']]) {
        const button = element('button', cls, text); button.type = 'button'; button.setAttribute('aria-label', text + ' ' + book.title); button.addEventListener('click', action); actions.append(button);
      }
      card.append(top, actions); $('books').append(card);
    }
  } catch (error) {
    if (version === loadVersion) { message('โหลดรายการหนังสือไม่สำเร็จ: ' + error.message, true); $('retry').hidden = false; }
  } finally { if (version === loadVersion) $('books').setAttribute('aria-busy', 'false'); }
}
function resetForm() {
  editingId = null; $('book-form').reset(); $('title').setCustomValidity(''); $('author').setCustomValidity(''); $('form-title').textContent = 'เพิ่มหนังสือ';
  $('save').textContent = '+ เพิ่มลงชั้นหนังสือ'; $('cancel').hidden = true;
}
async function showBook(id) {
  try {
    const book = await api('/api/books/' + id);
    $('detail-title').textContent = book.title; $('detail-author').textContent = 'ผู้แต่ง: ' + book.author;
    $('detail-status').textContent = labels[book.status]; $('detail-notes').textContent = book.notes || 'ยังไม่มีบันทึกย่อ';
    if (!$('details').open) $('details').showModal();
  } catch (error) { message(error.message, true); }
}
async function editBook(id) {
  try {
    const book = await api('/api/books/' + id); editingId = id;
    for (const key of ['title', 'author', 'status', 'notes']) $(key).value = book[key];
    $('title').setCustomValidity(''); $('author').setCustomValidity('');
    $('form-title').textContent = 'แก้ไขหนังสือ'; $('save').textContent = 'บันทึกการแก้ไข'; $('cancel').hidden = false;
    $('title').focus(); message('กำลังแก้ไข “' + book.title + '”');
  } catch (error) { message(error.message, true); }
}
$('book-form').addEventListener('submit', async event => {
  event.preventDefault(); const id = editingId;
  const body = Object.fromEntries(new FormData(event.target));
  $('save').disabled = true;
  try {
    await api('/api/books' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
    resetForm(); message(id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มหนังสือลงชั้นแล้ว'); await loadBooks();
  } catch (error) { message(error.message, true); }
  finally { $('save').disabled = false; }
});
function askDelete(book) { deletingId = book.id; $('delete-name').textContent = book.title; $('delete-dialog').showModal(); }
$('confirm-delete').addEventListener('click', async () => {
  const id = deletingId; $('confirm-delete').disabled = true;
  try {
    await api('/api/books/' + id, { method: 'DELETE' });
    if (editingId === id) resetForm(); $('delete-dialog').close(); message('ลบหนังสือแล้ว'); await loadBooks();
  } catch (error) { $('delete-dialog').close(); message(error.message, true); }
  finally { $('confirm-delete').disabled = false; }
});
$('keep').addEventListener('click', () => $('delete-dialog').close());
$('close-details').addEventListener('click', () => $('details').close());
$('cancel').addEventListener('click', () => { resetForm(); message('ยกเลิกการแก้ไขแล้ว'); });
$('filter').addEventListener('change', () => { message(''); loadBooks(); });
$('retry').addEventListener('click', () => { message(''); loadBooks(); });
loadBooks();

for (const [id, label] of [['title', 'ชื่อหนังสือ'], ['author', 'ชื่อผู้แต่ง']]) {
  $(id).addEventListener('invalid', () => {
    $(id).setCustomValidity($(id).validity.valueMissing ? 'กรุณากรอก' + label : 'กรุณาตรวจสอบ' + label);
  });
  $(id).addEventListener('input', () => $(id).setCustomValidity(''));
}
