// scripts/lib/sales-parser.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSalesReport, classifyProductType } from "./sales-parser.mjs";

const HEADER = "Title\tProduct Type Identifier\tUnits\tBegin Date\tApple Identifier";

test("parses rows with header-name column resolution", () => {
  const tsv = [
    HEADER,
    "Adhkar\t1F\t3\t05/13/2026\t111",
    "Wobli\t7T\t12\t05/13/2026\t222",
  ].join("\n");
  assert.deepEqual(parseSalesReport(tsv), [
    { appleId: "111", title: "Adhkar", productType: "1F", units: 3, date: "2026-05-13" },
    { appleId: "222", title: "Wobli", productType: "7T", units: 12, date: "2026-05-13" },
  ]);
});

test("handles negative units (refunds) as-is", () => {
  const tsv = [HEADER, "Adhkar\t1F\t-2\t05/14/2026\t111"].join("\n");
  assert.equal(parseSalesReport(tsv)[0].units, -2);
});

test("empty report (header only) and blank input return []", () => {
  assert.deepEqual(parseSalesReport(HEADER), []);
  assert.deepEqual(parseSalesReport(""), []);
});

test("ignores trailing blank lines", () => {
  const tsv = [HEADER, "Adhkar\t1\t5\t05/13/2026\t111", "", ""].join("\n");
  assert.equal(parseSalesReport(tsv).length, 1);
});

test("classifies product types", () => {
  for (const pt of ["1", "1F", "1T", "F1"]) assert.equal(classifyProductType(pt), "download");
  for (const pt of ["3", "3F"]) assert.equal(classifyProductType(pt), "redownload");
  for (const pt of ["7", "7F", "7T", "F7"]) assert.equal(classifyProductType(pt), "update");
  assert.equal(classifyProductType("IA1"), "other");
});
