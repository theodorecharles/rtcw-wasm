import { createHash } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { basename, join } from "node:path";

const [source, ...files] = process.argv.slice(2);
if (!source || files.length === 0) {
  console.error("usage: node write-data-manifest.mjs MAIN_DIR FILE...");
  process.exit(2);
}

const entries = [];
for (const file of files) {
  const absolute = join(source, file);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(absolute)) hash.update(chunk);
  entries.push({
    path: `Main/${basename(file)}`,
    size: statSync(absolute).size,
    sha256: hash.digest("hex"),
  });
}

process.stdout.write(`${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
