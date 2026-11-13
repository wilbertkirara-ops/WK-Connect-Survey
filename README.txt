AS-BUILT COLLECTION — PWA (installable phone app, with satellite map)
=====================================================================
Keep ALL files/folders together when hosting (index.html, sw.js, manifest,
icons, and the /leaflet folder).

INSTALL
-------
1. Host the whole folder over HTTPS (free options):
   - Netlify Drop: https://app.netlify.com/drop  → drag the folder in.
   - GitHub Pages: upload all files (keep the leaflet/ folder), enable Pages.
2. Open the https link on the phone (Android Chrome / iPhone Safari).
3. Install:
   - Android: tap "Install" in the app header (or browser menu > Install app).
   - iPhone: Share > Add to Home Screen.

MAP (on the New Entry page)
---
- The satellite map sits at the top of the New Entry page (page 1), so you
  see your captured point and all saved records while filling the form.
- Layer switcher (top-right of map): Satellite (Esri) or Streets (OSM).
- "My location" centres on your live GPS position.
- "Save area offline": while ONLINE, zoom to your project area and tap it to
  pre-download that area's satellite tiles. They are then available with NO
  signal in the field. Any area you simply pan over online is also cached.
- Marker colour = GPS precision (green <=5 m, amber <=15 m, red >15 m).

COORDINATES: X/Y stored in ITRF2005 / TM Rwanda (CM 30E, k0 0.9999, FE 500000,
FN 5000000, GRS80). NOTE: this is NOT EPSG:4083 (that code is REGCAN95 / UTM 28N). GPS auto-converts.
NOTE: GPS + tile download need https:// (not file://).

GPS ACCURACY
------------
Capture now AVERAGES many GPS fixes (weighted by quality) instead of taking one
reading. Hold the phone still over the point; precision improves as fixes
accumulate and auto-locks at about +/-3 m after >=8 fixes. Sample count and the
best single-fix accuracy are shown. Averaging reduces random error but cannot
beat the phone chip's hardware limit — use a survey GNSS for sub-metre work.

ADMINISTRATIVE LOCATION (cascading)
-----------------------------------
District, Sector, Cell and Village are now dropdowns using Rwanda's full
official hierarchy (30 districts, 416 sectors, 2,149 cells, 14,837 villages).
Pick District -> the Sector list filters to that district -> Cell filters to
the sector -> Village filters to the cell. Data is bundled (rw-admin.js) and
works offline.

GPS (further improved)
----------------------
Adds positional-jump rejection (discards fixes that leap away from the running
average) and reports the WORSE of two precision estimates: the model estimate
and the empirical scatter (standard error) of the collected fixes — so the
number shown reflects real stability, not just the chip's optimistic figure.
Auto-locks at ~+/-3 m after >=10 converged fixes.

EDIT THE POINT ON THE MAP
-------------------------
The captured point shows as a draggable pin.
- DRAG the pin to move it; X/Y (TM Rwanda) update instantly.
- Or tap "Tap-to-set", then tap the map to drop/move the point.
- Typing E/N by hand also moves the pin.
Hand-moved points are flagged "Manual" (blue) and their GPS accuracy is cleared.
Editing a saved record shows its pin on the map so you can correct it, then Update.


OUTPUT FILE (matches RESERVE.xlsx)
----------------------------------
The "Excel" button generates a .xlsx in the exact RESERVE template layout
(same banner, headers, columns and borders). Records fill from row 6 down.
Category is marked "X" under RESIDENTIAL or NON RESIDENTIAL automatically.
New fields Poles and House No feed template columns B and C.
X and Y (TM Rwanda, metres) are appended as columns S and T. District is kept
"CSV" gives a full export of every field (incl. X/Y, District) if you need it.

WHY GPS "WASN'T WORKING" + GITHUB PAGES
---------------------------------------
Browser GPS only runs on a SECURE origin (https:// or localhost). Opened as a
local file (file://) or inside a preview, the browser blocks location outright.
GitHub Pages serves over https, so GPS WILL work there.
  1. Create a repo, upload the CONTENTS of this folder (keep the leaflet/ folder
     and all files together).
  2. Settings > Pages > Deploy from branch > main / root.
  3. Open https://USERNAME.github.io/REPO/ on the phone, ALLOW location.
Also: capture now stops on its own after enough fixes/seconds (the old version
demanded +/-3 m, which phones rarely reach, so it looked stuck). Typical phone
precision is 3-8 m under open sky; use a survey GNSS for sub-metre.
