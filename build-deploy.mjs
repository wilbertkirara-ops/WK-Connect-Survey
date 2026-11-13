// Build the public deploy folder: copies runtime files only and minifies the app script.
// Usage: node build-deploy.mjs <outDir>
import fs from "fs"; import path from "path"; import { minify } from "terser";
const out=process.argv[2]; if(!out) throw new Error("outDir?");
const src=path.dirname(new URL(import.meta.url).pathname);
const keep=["sw.js","manifest.webmanifest","LICENSE","favicon-32.png","apple-touch-icon.png","icon-192.png","icon-512.png","icon-maskable-512.png",
  "rw-admin.js","nyanza-transformers.js","nyanza-villages.js","exceljs.min.js","jszip.min.js","zxing.min.js","nyanza-template.xlsx","leaflet","ocr"];
fs.rmSync(out,{recursive:true,force:true}); fs.mkdirSync(out,{recursive:true});
for(const k of keep) fs.cpSync(path.join(src,k),path.join(out,k),{recursive:true});
let html=fs.readFileSync(path.join(src,"index.html"),"utf8");
const m=html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
const r=await minify(m[1],{compress:{passes:2},mangle:{toplevel:false},format:{preamble:"/* WK Connect Survey (c) 2026 Ir Wilbert KIRARA, Expert Surveyor in Electrical Power Lines. All rights reserved. */"}});
html=html.replace(m[1],r.code).replace(/\n\s+/g,"\n");
fs.writeFileSync(path.join(out,"index.html"),html);
fs.writeFileSync(path.join(out,".nojekyll"),"");
console.log("deploy built:",out,"index.html",html.length,"bytes");
