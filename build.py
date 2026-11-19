# Builds the site: runs the figure build, then inlines it into src.html.
#   artifact.html: no document skeleton (for the Artifact host)
#   index.html: standalone and deployable
import subprocess
subprocess.run(["node", "mind/build.mjs"], check=True)
r = lambda f: open(f, encoding="utf-8").read()
s = r("src.html").replace("__DOTS__", r("build/b64.txt").strip())
s = s.replace("__ISO_CSS__", r("mind/iso.css") + r("mind/mind.css"))
s = s.replace("__MIND_BODY__", r("mind/mind-body.html"))
s = s.replace("__MIND_SCRIPT__", r("mind/mind-script.js"))
open("artifact.html", "w", encoding="utf-8").write(s)
head, rest = s.split("<style>", 1); css, body = rest.split("</style>", 1)
open("index.html", "w", encoding="utf-8").write('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + "<style>" + css + "</style>\n</head>\n<body>\n" + body + "\n</body>\n</html>\n")
print("built", len(s) // 1024, "KB")
