import { readFileSync, writeFileSync } from "node:fs";
const r = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
writeFileSync(new URL("preview.html", import.meta.url), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fig 1</title><style>${r("iso.css")}${r("mind.css")}body{margin:0;background:#0c1120;padding:24px}</style><body class="iso mind" style="max-width:1100px;margin:auto">${r("mind-body.html")}<script>${r("mind-script.js")}</script>`);
