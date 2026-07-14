const fs = require("node:fs");
const path = require("node:path");
const { cases } = require("../test/email-template-fixtures.cjs");

const outputDirectory = path.resolve(__dirname, "../../.email-previews");
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const preview of cases) {
  const rendered = preview.render();
  fs.writeFileSync(path.join(outputDirectory, `${preview.name}.html`), rendered.html, "utf8");
  fs.writeFileSync(path.join(outputDirectory, `${preview.name}.txt`), `Subject: ${rendered.subject}\n\n${rendered.text}\n`, "utf8");
}

console.log(`Rendered ${cases.length} email preview variants to ${outputDirectory}`);
