WK CONNECT SURVEY v2 — NYANZA (installable phone app / PWA)
==========================================================
Created by Eng. Wilbert KIRARA, Expert Surveyor in Electrical Power Lines.
© 2026 Eng. Wilbert KIRARA. All rights reserved.
Live: https://wilbertkirara-ops.github.io/WK-Connect-Survey/
Keep ALL files together (index.html, sw.js, manifest, icons, leaflet/, rw-admin.js,
exceljs.min.js, jszip.min.js, nyanza-template.xlsx).

WHAT IT RECORDS (per customer)
- Agent name (asked once per phone, shown in header, stored on every record)
- Position X/Y in ITRF2005 / TM Rwanda (CM 30E, k0 0.9999, FE 500000, FN 5000000, GRS80)
  NOTE: this is NOT EPSG:4083 (that code is REGCAN95 / UTM 28N).
- House photo (required), customer, ID, phone, meter, UPI, SC length, category,
  transformer, phase, District (default Nyanza) > Sector > Cell > Village, comment.

GPS
- Live precision is shown permanently at the top of the screen from app start:
  🛰 SAT = satellite (GNSS) fix, 📶 NET = network (Wi-Fi / mobile) position.
- "Capture position" averages satellite fixes only:
  * network positions (no altitude) are ignored,
  * fixes worse than ±25 m and the first 2 fixes are ignored,
  * jumps away from the running average are removed,
  * stops automatically at ±3 m after 15 fixes, or after 60 s, or on "Use now".
- Precision shown = worse of averaged accuracy and real scatter of the fixes.
- A phone GNSS chip is typically 2-5 m in open sky. For sub-metre work use DGPS.

PHOTOS
- Stored on the phone (IndexedDB), downscaled to 1600 px.
- On export each photo is stamped with serial, name, meter, X/Y, precision,
  location, date and agent, and named 0012_Lastname_Firstname.jpg.

AUTOMATIC SYNC (Google Sheet + Drive)
- Server: apps-script/Code.gs, deployed as a Google Apps Script web app bound to
  a Google Sheet (setup steps at the top of that file).
- Paste the /exec URL in the app: Export > Sync > Server settings > Test & save
  (or set SYNC_URL_DEFAULT in index.html so every phone gets it automatically).
- Each saved/edited record + stamped house photo is sent when the phone is online;
  edits update the same Sheet row; deletions are marked DELETED (row kept).
- Header chip: ☁ ✓ all synced · ☁ n waiting · ☁ ! error · ☁ off not configured.
- Token in Code.gs must equal SYNC_TOKEN in index.html. The token is visible in
  the public app code: it only stops casual misuse, it is not real security.

NYANZA TRANSFORMERS
- nyanza-transformers.js: 141 transformers (LV staking table) with TM coordinates from
  the LV design shapefiles. Transformer field = pick list filtered by sector; after a
  position capture the nearest transformer (< 1.5 km) is proposed.

AUTOMATIC ADMINISTRATIVE LOCATION
- nyanza-villages.js: official NISR village boundaries (TM Rwanda, 2012 census mapping),
  Nyanza district + 2 km around (1,018 villages, simplified to ~4 m).
  Source: NISR boundaries as published by Rwanda MoH NHIC (huggingface.co/datasets/nhic/rwanda-spatial).
- After a position capture, a map tap or typed X/Y, District/Sector/Cell/Village are set
  automatically. Warning when the point is < 25 m from a village boundary or outside the map.
- Check against 12,853 surveyed design customers: same village in 99.5 % of cases.

DUPLICATE CHECK
- A warning appears when the captured point is within 3 m of an existing record,
  and saving asks for confirmation.

ID CARD
- "Read ID card (photo)": offline OCR (Tesseract, files in ocr/, ~7 MB downloaded once)
  reads names and the 16-digit ID number from the front of the card; the agent confirms.
- "ID barcode": reads the 2D barcode on the back when the phone can decode it.

BARCODE / QR SCAN
- ▥ buttons next to Meter, ID and UPI open the camera.
- Android Chrome: native BarcodeDetector. iPhone: ZXing (zxing.min.js) fallback.

EXPORT (Export tab)
- Full package (ZIP): RESERVE Excel (Nyanza template, EDCL + REAL/PATRONICS logos,
  photo hyperlinks), data.csv, photos/, backup.json + backup_photos/.
- Restore: the same ZIP restores records and photos on any phone.
- Data lives ONLY on the phone until exported: export the package every evening.

UPDATING
- Bump CACHE in sw.js on every release so phones load the new version.
