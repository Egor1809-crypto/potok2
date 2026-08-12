import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "@e965/xlsx";

import {
  parseCsvFile,
  suggestMapping,
  validateRows,
} from "../components/imports/csv-import.ts";

function spreadsheetFile(rows, extension, bookType) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Контакты",
  );
  const buffer = XLSX.write(workbook, { type: "buffer", bookType });
  return new File([buffer], `контакты.${extension}`);
}

test("TSV parser keeps every row beyond the former 10,000-row limit", async () => {
  const total = 10_005;
  const rows = Array.from(
    { length: total },
    (_, index) => `Имя${index}\tФамилия${index}\tuser${index}@example.test`,
  );
  const file = new File(
    [`Имя\tФамилия\tEmail\n${rows.join("\n")}`],
    "контакты.tsv",
    { type: "text/tab-separated-values" },
  );

  const parsed = await parseCsvFile(file);

  assert.equal(parsed.format, "TSV");
  assert.equal(parsed.rows.length, total);
  assert.deepEqual(parsed.rows.at(-1)?.values, [
    `Имя${total - 1}`,
    `Фамилия${total - 1}`,
    `user${total - 1}@example.test`,
  ]);
});

for (const [extension, bookType, expectedFormat] of [
  ["xlsx", "xlsx", "XLSX"],
  ["xls", "biff8", "XLS"],
]) {
  test(`${expectedFormat} workbook is parsed and all valid contacts are available for import`, async () => {
    const parsed = await parseCsvFile(
      spreadsheetFile(
        [
          ["Имя", "Фамилия", "Email", "Компания"],
          ["Анна", "Иванова", "anna@example.test", "Альфа"],
          ["Илья", "Петров", "ilya@example.test", "Бета"],
        ],
        extension,
        bookType,
      ),
    );
    const mapping = suggestMapping(parsed.headers);
    const validation = validateRows(parsed.rows, mapping, {
      emails: new Set(),
      telegramChatIds: new Set(),
      vkUserIds: new Set(),
    });

    assert.equal(parsed.format, expectedFormat);
    assert.equal(parsed.sheetName, "Контакты");
    assert.equal(parsed.rows.length, 2);
    assert.equal(validation.summary.ready, 2);
    assert.deepEqual(
      validation.rows.map((row) => row.input?.email),
      ["anna@example.test", "ilya@example.test"],
    );
  });
}
