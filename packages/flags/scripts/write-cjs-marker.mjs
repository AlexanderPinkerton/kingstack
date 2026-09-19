import { writeFileSync } from "node:fs";

writeFileSync(
  new URL("../dist/cjs/package.json", import.meta.url),
  '{"type":"commonjs"}\n',
);
