/**
 * WK Connect Survey — Nyanza : synchronisation server (Google Apps Script)
 * -----------------------------------------------------------------------
 * Receives records + house photos from the phones and stores them in:
 *   - this Google Sheet  (tab "Records", one row per customer, updated in place)
 *   - a Google Drive folder "WK Connect Survey - Nyanza Photos/<Sector>/"
 *
 * SETUP (once):
 *   1. Create a new Google Sheet, e.g. "WK Connect Survey - Nyanza".
 *   2. Extensions > Apps Script. Delete the sample code, paste this whole file, Save.
 *   3. Deploy > New deployment > type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      Authorise when asked. Copy the Web app URL (ends with /exec).
 *   4. In the phone app: Export tab > Sync > paste the URL > Test & save.
 *
 * The TOKEN below must match SYNC_TOKEN in index.html.
 */
const TOKEN = 'wkcnyz-4HAs95vPKUfAI8hAiGrbJTzV';
const SHEET_NAME = 'Records';
const ROOT_FOLDER = 'WK Connect Survey - Nyanza Photos';

const COLS = [
  ['_id', 'Record ID'], ['serial', 'Serial'], ['firstName', 'First Name'], ['lastName', 'Last Name'],
  ['idNumber', 'ID Number'], ['phone', 'Phone'], ['meter', 'Meter Number'], ['upi', 'UPI'],
  ['scLength', 'SC Length (m)'], ['category', 'Category'], ['transformer', 'Transformer'], ['phase', 'Phase'],
  ['district', 'District'], ['sector', 'Sector'], ['cell', 'Cell'], ['village', 'Village'], ['comment', 'Comment'],
  ['x', 'X Easting (TM Rwanda)'], ['y', 'Y Northing (TM Rwanda)'], ['lat', 'Latitude (WGS84)'], ['lng', 'Longitude (WGS84)'],
  ['accuracy', 'GPS Precision (m)'], ['samples', 'GPS Fixes'], ['gpsSource', 'Point Source'],
  ['agent', 'Agent'], ['editedBy', 'Last Edited By'], ['photoUrl', 'Photo'], ['photoId', 'Photo File ID'],
  ['createdAt', 'Created (phone)'], ['updatedAt', 'Updated (phone)'], ['receivedAt', 'Received (server)'], ['status', 'Status']
];

function doGet() { return out({ ok: true, app: 'WK Connect Survey sync', time: new Date().toISOString() }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: 'unauthorised' });
    if (d.action === 'ping') return out({ ok: true });
    if (d.action === 'delete') return out(markDeleted(d.id));
    if (d.action === 'upsert') return out(upsert(d.record, d.photo, d.photoName));
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(COLS.map(c => c[1]));
    sh.getRange(1, 1, 1, COLS.length).setFontWeight('bold').setBackground('#d9e2f3');
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

function upsert(r, photoB64, photoName) {
  if (!r || !r._id) return { ok: false, error: 'missing record' };
  const sh = sheet_();
  let row = findRow_(sh, r._id);
  const rec = Object.assign({}, r);

  // keep previous photo link unless a new photo is sent
  if (row) {
    const prev = sh.getRange(row, 1, 1, COLS.length).getValues()[0];
    COLS.forEach((c, i) => { if (c[0] === 'photoUrl' && !photoB64) rec.photoUrl = prev[i]; if (c[0] === 'photoId') rec.photoId = prev[i]; });
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

  const values = COLS.map(c => {
    const v = rec[c[0]];
    return v === undefined || v === null ? '' : v;
  });
  if (row) sh.getRange(row, 1, 1, COLS.length).setValues([values]);
  else { sh.appendRow(values); row = sh.getLastRow(); }
  // keep IDs / phone / meter as text (no scientific notation, no lost leading zeros)
  ['idNumber', 'phone', 'meter', 'upi'].forEach(k => {
    const i = COLS.findIndex(c => c[0] === k);
    sh.getRange(row, i + 1).setNumberFormat('@').setValue(String(rec[k] || ''));
  });
  return { ok: true, id: r._id, photoUrl: rec.photoUrl || '' };
}

function markDeleted(id) {
  const sh = sheet_();
  const row = findRow_(sh, id);
  if (!row) return { ok: true, id: id, note: 'not found' };
  const i = COLS.findIndex(c => c[0] === 'status');
  sh.getRange(row, i + 1).setValue('DELETED on phone ' + new Date().toISOString());
  sh.getRange(row, 1, 1, COLS.length).setFontColor('#9ca3af');
  return { ok: true, id: id };
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
