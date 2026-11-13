WK CONNECT SURVEY v2 — NYANZA (installable phone app / PWA)
==========================================================
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

EXPORT (Export tab)
- Full package (ZIP): RESERVE Excel (Nyanza template, EDCL + REAL/PATRONICS logos,
  photo hyperlinks), data.csv, photos/, backup.json + backup_photos/.
- Restore: the same ZIP restores records and photos on any phone.
- Data lives ONLY on the phone until exported: export the package every evening.

UPDATING
- Bump CACHE in sw.js on every release so phones load the new version.
