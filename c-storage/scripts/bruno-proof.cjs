// bruno-proof.cjs <report.json> <collection dir> <label>
// The proof that a Bruno run ran the whole collection. bru exits 0 for a request file it cannot
// parse (a skipped result) and for a run that reaches no request, so a pass needs all of these:
// the summary's passed requests equal the request files (which leaves nothing skipped), the
// results are as many, and every result passed with at least one test or assertion. A result's own
// status reads "pass" even when its tests fail, so the summary is the count to trust.
// Prints the number of request files on stdout, and what is wrong on stderr, each line led by
// <label>. Exits 1 when the proof fails. Used by scripts/e2e.sh and ops/check.sh, so the two
// cannot drift apart.
"use strict";
const fs = require("fs");
const path = require("path");

const [file, dir, label] = process.argv.slice(2);

function requestFiles(base, rel) {
  let n = 0;
  for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true })) {
    const p = path.join(rel, e.name);
    if (e.isDirectory()) {
      if (e.name !== "environments") n += requestFiles(base, p);
    } else if (e.name.endsWith(".yml") && e.name !== "folder.yml" && e.name !== "opencollection.yml") {
      n++;
    }
  }
  return n;
}

const want = requestFiles(dir, "");
console.log(want);

let runs;
try {
  runs = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(label + ": no readable report at " + file);
  process.exit(1);
}
let results = [];
let passed = 0;
let skipped = 0;
for (const run of runs) {
  results = results.concat(run.results);
  passed += run.summary.passedRequests;
  skipped += run.summary.skippedRequests;
}
let bad = 0;
for (const r of results) {
  const tests = (r.testResults || []).length + (r.assertionResults || []).length;
  if (r.status !== "pass" || tests === 0) {
    bad++;
    console.error(label + ": " + r.path + ": status " + r.status + ", " + tests + " tests" + (r.error ? ", " + r.error : ""));
  }
}
if (results.length !== want || passed !== want || bad > 0) {
  console.error(
    label + ": " + want + " request files, " + results.length + " results, " + passed + " passed, " +
      skipped + " skipped, " + bad + " not passing",
  );
  process.exit(1);
}
