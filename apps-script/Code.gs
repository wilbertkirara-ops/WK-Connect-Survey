/**
 * WK Connect Survey — Nyanza : synchronisation server (Google Apps Script)
 * (c) 2026 Ir Wilbert KIRARA — all rights reserved.
 * -----------------------------------------------------------------------
 * Receives records + house photos from the phones and stores them in:
 *   - the Google Sheet SHEET_ID (tab "Records", one row per customer, updated in place)
 *   - Drive folder "WK Connect Survey - Nyanza Photos/<Sector>/"   (stamped house photos)
 *   - Drive folder "WK Connect Survey - Nyanza RESERVE/"            (one RESERVE report per transformer,
 *                                                                    rebuilt when its records change)
 *
 * SETUP (once):
 *   1. Paste this whole file in the Apps Script project, Save.
 *   2. Deploy > Manage deployments > edit the web app > Version: New version > Deploy
 *        Execute as: Me      Who has access: Anyone
 *   The web-app URL does not change, so the phones need nothing new.
 *
 * The TOKEN below must match SYNC_TOKEN in index.html.
 */
const TOKEN = 'wkcnyz-4HAs95vPKUfAI8hAiGrbJTzV';
const SHEET_NAME = 'Records';
// Google Sheet that receives the data (standalone script). Leave '' when the script is bound to the Sheet.
const SHEET_ID = '1rY1TSEacDKRNh2u6URv6pfMNcF946HvTcUmDgMtvhLk';
const ROOT_FOLDER = 'WK Connect Survey - Nyanza Photos';
const RESERVE_FOLDER = 'WK Connect Survey - Nyanza RESERVE';
const APP_URL = 'https://wilbertkirara-ops.github.io/WK-Connect-Survey/';
const PROJECT_TITLE = 'PROJECT NAME: DESIGN, SUPPLY, AND INSTALLATION OF LOW VOLTAGE AND MEDIUM VOLTAGE LINES AND SERVICE CONNECTIONS IN NYANZA';
const RESERVE_BUDGET_MS = 40000;   // keep each call short; the phone asks again for the rest

// New columns are always added at the END so existing rows stay aligned.
const COLS = [
  ['_id', 'Record ID'], ['serial', 'Serial'], ['firstName', 'First Name'], ['lastName', 'Last Name'],
  ['idNumber', 'ID Number'], ['phone', 'Phone'], ['meter', 'Meter Number'], ['upi', 'UPI'],
  ['scLength', 'SC Length (m)'], ['category', 'Category'], ['transformer', 'Transformer'], ['phase', 'Phase'],
  ['district', 'District'], ['sector', 'Sector'], ['cell', 'Cell'], ['village', 'Village'], ['comment', 'Comment'],
  ['x', 'X Easting (TM Rwanda)'], ['y', 'Y Northing (TM Rwanda)'], ['lat', 'Latitude (WGS84)'], ['lng', 'Longitude (WGS84)'],
  ['accuracy', 'GPS Precision (m)'], ['samples', 'GPS Fixes'], ['gpsSource', 'Point Source'],
  ['agent', 'Agent'], ['editedBy', 'Last Edited By'], ['photoUrl', 'Photo'], ['photoId', 'Photo File ID'],
  ['createdAt', 'Created (phone)'], ['updatedAt', 'Updated (phone)'], ['receivedAt', 'Received (server)'], ['status', 'Status'],
  ['poleX', 'Pole X (TM Rwanda)'], ['poleY', 'Pole Y (TM Rwanda)'], ['poleLat', 'Pole Latitude'], ['poleLng', 'Pole Longitude'],
  ['poleAccuracy', 'Pole GPS Precision (m)'], ['poleSamples', 'Pole GPS Fixes'], ['poleSource', 'Pole Source'],
  ['poleDist', 'Pole-House Hz Distance (m)'], ['scManual', 'SC Typed By Hand']
];

function doGet() { return out({ ok: true, app: 'WK Connect Survey sync', version: 3, time: new Date().toISOString() }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: 'unauthorised' });
    if (d.action === 'ping') return out({ ok: true, version: 3 });
    if (d.action === 'delete') return out(markDeleted(d.id));
    if (d.action === 'upsert') return out(upsert(d.record, d.photo, d.photoName));
    if (d.action === 'reserve') return out(buildReserves_(!!d.all));
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet_() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0 || sh.getLastColumn() < COLS.length) {
    if (sh.getMaxColumns() < COLS.length) sh.insertColumnsAfter(sh.getMaxColumns(), COLS.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS.map(c => c[1])]).setFontWeight('bold').setBackground('#d9e2f3');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function folder_(sector) {
  const it = DriveApp.getFoldersByName(ROOT_FOLDER);
  const root = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER);
  const name = sector || 'No sector';
  const sub = root.getFoldersByName(name);
  return sub.hasNext() ? sub.next() : root.createFolder(name);
}

function colIdx_(key) { return COLS.findIndex(c => c[0] === key); }

function upsert(r, photoB64, photoName) {
  if (!r || !r._id) return { ok: false, error: 'missing record' };
  const sh = sheet_();
  let row = findRow_(sh, r._id);
  const rec = Object.assign({}, r);

  // keep previous photo link unless a new photo is sent; note the previous transformer
  if (row) {
    const prev = sh.getRange(row, 1, 1, COLS.length).getValues()[0];
    COLS.forEach((c, i) => { if (c[0] === 'photoUrl' && !photoB64) rec.photoUrl = prev[i]; if (c[0] === 'photoId') rec.photoId = prev[i]; });
    markDirty_(prev[colIdx_('transformer')]);
  }
  if (photoB64) {
    if (rec.photoId) { try { DriveApp.getFileById(rec.photoId).setTrashed(true); } catch (e) {} }
    const blob = Utilities.newBlob(Utilities.base64Decode(photoB64), 'image/jpeg', photoName || (r._id + '.jpg'));
    const f = folder_(r.sector).createFile(blob);
    rec.photoId = f.getId();
    rec.photoUrl = f.getUrl();
  }
  rec.receivedAt = new Date();
  rec.status = 'OK';
  rec.scManual = rec.scManual ? 'yes' : '';

  const values = COLS.map(c => {
    const v = rec[c[0]];
    return v === undefined || v === null ? '' : v;
  });
  if (row) sh.getRange(row, 1, 1, COLS.length).setValues([values]);
  else { sh.appendRow(values); row = sh.getLastRow(); }
  // keep IDs / phone / meter / UPI as text (no scientific notation, no lost leading zeros)
  ['idNumber', 'phone', 'meter', 'upi'].forEach(k => {
    sh.getRange(row, colIdx_(k) + 1).setNumberFormat('@').setValue(String(rec[k] || ''));
  });
  markDirty_(rec.transformer);
  return { ok: true, id: r._id, photoUrl: rec.photoUrl || '' };
}

function markDeleted(id) {
  const sh = sheet_();
  const row = findRow_(sh, id);
  if (!row) return { ok: true, id: id, note: 'not found' };
  sh.getRange(row, colIdx_('status') + 1).setValue('DELETED on phone ' + new Date().toISOString());
  sh.getRange(row, 1, 1, COLS.length).setFontColor('#9ca3af');
  markDirty_(sh.getRange(row, colIdx_('transformer') + 1).getValue());
  return { ok: true, id: id };
}

/* =====================================================================
   RESERVE reports in Google Drive — one Google Sheet per transformer
   (File > Download > Microsoft Excel gives the .xlsx)
   ===================================================================== */
function markDirty_(tx) {
  const p = PropertiesService.getScriptProperties();
  const a = JSON.parse(p.getProperty('dirtyTx') || '[]');
  const k = String(tx || '').trim();
  if (a.indexOf(k) < 0) { a.push(k); p.setProperty('dirtyTx', JSON.stringify(a)); }
}

function reserveFolder_() {
  const it = DriveApp.getFoldersByName(RESERVE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(RESERVE_FOLDER);
}

function readRecords_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, COLS.length).getValues()
    .map(row => { const o = {}; COLS.forEach((c, i) => o[c[0]] = row[i]); return o; })
    .filter(o => o._id && String(o.status).indexOf('DELETED') !== 0);
}

// all=true: rebuild every transformer. Works within a time budget; "remaining" > 0 means call again.
function buildReserves_(all) {
  const t0 = Date.now();
  const p = PropertiesService.getScriptProperties();
  const recs = readRecords_();
  const groups = {};
  recs.forEach(r => { const k = String(r.transformer || '').trim(); (groups[k] = groups[k] || []).push(r); });
  let todo = JSON.parse(p.getProperty('dirtyTx') || '[]');
  if (all) Object.keys(groups).forEach(k => { if (todo.indexOf(k) < 0) todo.push(k); });
  const folder = reserveFolder_();
  const built = [];
  while (todo.length && Date.now() - t0 < RESERVE_BUDGET_MS) {
    const tx = todo[0];
    const url = writeReserve_(folder, tx, groups[tx] || []);
    built.push({ transformer: tx, customers: (groups[tx] || []).length, url: url });
    todo.shift();
    p.setProperty('dirtyTx', JSON.stringify(todo));
  }
  return { ok: true, built: built, remaining: todo.length, folderUrl: folder.getUrl() };
}

function cleanName_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function photoName_(r) {
  return [String(r.serial || 'x').padStart(4, '0'), cleanName_(r.lastName), cleanName_(r.firstName)].filter(Boolean).join('_') + '.jpg';
}

function writeReserve_(folder, tx, list) {
  const name = 'RESERVE - ' + (tx || 'No transformer');
  const files = folder.getFilesByName(name);
  let ss = null;
  if (files.hasNext()) ss = SpreadsheetApp.openById(files.next().getId());
  if (!list.length) {                       // transformer emptied (records moved or deleted)
    if (ss) DriveApp.getFileById(ss.getId()).setTrashed(true);
    return '';
  }
  if (!ss) { ss = SpreadsheetApp.create(name); DriveApp.getFileById(ss.getId()).moveTo(folder); }
  const sh = ss.getSheets()[0];
  sh.setName('RESERVE');

  // reset the sheet
  sh.getImages().forEach(i => i.remove());
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.setFrozenRows(0);
  const N = 20, START = 6, need = START + list.length + 3;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());

  // column widths (same as the Excel template)
  [7, 16, 16, 19, 13, 15, 18, 10, 11, 13, 16, 9, 13, 13, 14, 20, 16, 34, 13, 13]
    .forEach((w, i) => sh.setColumnWidth(i + 1, Math.round(w * 7 + 5)));
  sh.setRowHeight(1, 82); sh.setRowHeight(2, 29); sh.setRowHeight(3, 29); sh.setRowHeight(4, 24); sh.setRowHeight(5, 40);

  // titles
  const secs = Array.from(new Set(list.map(r => String(r.sector || '').trim()).filter(Boolean))).sort();
  sh.getRange('D1:Q1').merge().setValue(PROJECT_TITLE).setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.getRange('A1:C1').merge(); sh.getRange('R1:T1').merge();
  sh.getRange('A2:T2').merge().setValue('REPORT ON INSTALLED PREPAID METER' + (secs.length ? ' IN ' + secs.join(' / ').toUpperCase() + ' SECTOR' + (secs.length > 1 ? 'S' : '') : ''))
    .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('A3:T3').merge().setValue('TRANSFORMER NAME:   ' + (tx || ''))
    .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('left').setVerticalAlignment('middle');

  // header
  const heads = ['Sl. No', 'FIRST NAME', 'LAST NAME', 'IDENTITY', 'TELEPHONE', 'METER NUMBER', 'UPI', 'SC LENGTH (m)', 'CATEGORY', '',
    'TRANSFORMER', 'PHASE', 'SECTOR', 'CELL', 'VILLAGE', 'COMMENT', 'AGENT', 'PHOTO', 'X (Easting)', 'Y (Northing)'];
  heads.forEach((h, i) => { const c = i + 1; if (c === 9 || c === 10) return; sh.getRange(4, c, 2, 1).merge().setValue(h); });
  sh.getRange('I4:J4').merge().setValue('CATEGORY');
  sh.getRange('I5').setValue('RESIDENTIAL'); sh.getRange('J5').setValue('NON RESIDENTIAL');
  sh.getRange(4, 1, 2, N).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true).setBackground('#d9e2f3').setBorder(true, true, true, true, true, true);

  // data
  const rows = list.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || (parseInt(a.serial, 10) || 0) - (parseInt(b.serial, 10) || 0));
  const num = v => { const n = parseFloat(v); return isFinite(n) && String(v).trim() !== '' ? n : (v === null || v === undefined ? '' : v); };
  const data = rows.map((r, i) => {
    const resid = /resid/i.test(r.category || '');
    return [i + 1, r.firstName, r.lastName, String(r.idNumber || ''), String(r.phone || ''), String(r.meter || ''), String(r.upi || ''),
      num(r.scLength), resid ? 'X' : '', (r.category && !resid) ? 'X' : '', r.transformer, r.phase, r.sector, r.cell, r.village,
      r.comment, r.agent, '', num(r.x), num(r.y)];
  });
  const body = sh.getRange(START, 1, data.length, N);
  sh.getRange(START, 4, data.length, 4).setNumberFormat('@');
  body.setValues(data);
  body.setFontSize(10).setVerticalAlignment('middle').setBorder(true, true, true, true, true, true);
  [1, 8, 9, 10, 12].forEach(c => sh.getRange(START, c, data.length, 1).setHorizontalAlignment('center'));
  sh.getRange(START, 19, data.length, 2).setNumberFormat('0.00');
  // photo: file name linked to the photo in Google Drive
  sh.getRange(START, 18, data.length, 1).setRichTextValues(rows.map(r => {
    const t = photoName_(r), b = SpreadsheetApp.newRichTextValue().setText(r.photoUrl ? t : '');
    return [r.photoUrl ? b.setLinkUrl(r.photoUrl).build() : b.build()];
  }));
  const foot = START + data.length + 1;
  sh.getRange(foot, 1, 1, 6).merge().setValue('TOTAL CUSTOMERS: ' + data.length).setFontWeight('bold');
  sh.getRange(foot, 7, 1, 14).merge().setValue('Generated by WK Connect Survey · ' + Utilities.formatDate(new Date(), 'Africa/Kigali', 'yyyy-MM-dd HH:mm'))
    .setFontColor('#64748b').setFontSize(9).setHorizontalAlignment('right');
  sh.setFrozenRows(5);

  // logos (from the app website)
  try { sh.insertImage(APP_URL + 'reserve/edcl.png', 1, 1, 6, 2).setWidth(150).setHeight(79); } catch (e) {}
  try { sh.insertImage(APP_URL + 'reserve/realpat.png', 18, 1, 6, 10).setWidth(340).setHeight(60); } catch (e) {}
  SpreadsheetApp.flush();
  return ss.getUrl();
}

// Run from the editor to rebuild every RESERVE report at once.
function rebuildAllReserves() { let r = buildReserves_(true); while (r.remaining > 0) r = buildReserves_(false); Logger.log(JSON.stringify(r)); }

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
