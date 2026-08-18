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
      phones: new Set(),
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

test("XLSX imports all 60 contacts from every workbook sheet", async () => {
  const workbook = XLSX.utils.book_new();
  const headers = ["Имя", "Фамилия", "Email", "Компания"];
  const contacts = Array.from({ length: 60 }, (_, index) => [
    `Имя${index + 1}`,
    `Фамилия${index + 1}`,
    `contact${index + 1}@example.test`,
    index < 18 ? "Первая команда" : "Вторая команда",
  ]);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, ...contacts.slice(0, 18)]),
    "Команда 1",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Компания", "Email", "Фамилия", "Имя"],
      ...contacts.slice(18).map(([firstName, lastName, email, company]) => [
        company,
        email,
        lastName,
        firstName,
      ]),
    ]),
    "Команда 2",
  );
  const file = new File(
    [XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })],
    "60-контактов.xlsx",
  );

  const parsed = await parseCsvFile(file);
  const mapping = suggestMapping(parsed.headers);
  const validation = validateRows(parsed.rows, mapping, {
    emails: new Set(),
    phones: new Set(),
    telegramChatIds: new Set(),
    vkUserIds: new Set(),
  });

  assert.deepEqual(parsed.sheetNames, ["Команда 1", "Команда 2"]);
  assert.equal(parsed.rows.length, 60);
  assert.equal(validation.summary.ready, 60);
  assert.equal(validation.rows.at(17)?.sheetName, "Команда 1");
  assert.equal(validation.rows.at(18)?.sheetName, "Команда 2");
  assert.equal(validation.rows.at(-1)?.input?.email, "contact60@example.test");
});

test("XLSX detects a service header row and imports only aggregate contact queues", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Распределение контактов"],
      ["Обновлено: сегодня"],
      [],
      ["№", "Telegram ID", "Кому писать", "Ответственный", "Статус"],
      [1, "10001", "ООО Альфа", "Шабалин Егор", "Не начато"],
      [2, "10002", "ООО Бета", "Алла Артина", "В работе"],
    ]),
    "Все назначения",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Служебный лист"],
      ["№", "Telegram ID", "Кому писать"],
      [1, "10001", "ООО Альфа"],
    ]),
    "Шабалин Егор",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Телефоны"],
      [],
      [],
      ["№", "Контакт / организация", "Мобильные номера", "Ответственный", "Статус"],
      [1, "ООО Гамма", "+7 900 000 00 01", "Путин Дмитрий", "Готово"],
    ]),
    "Все мобильные",
  );
  const file = new File(
    [XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })],
    "распределение.xlsx",
  );

  const parsed = await parseCsvFile(file);
  const mapping = suggestMapping(parsed.headers);
  const validation = validateRows(parsed.rows, mapping, {
    emails: new Set(),
    phones: new Set(),
    telegramChatIds: new Set(),
    vkUserIds: new Set(),
    members: [
      { id: "egor", displayName: "Шабалин Егор" },
      { id: "alla", displayName: "Алла Артина" },
      { id: "putin", displayName: "Путин Дмитрий" },
    ],
  }, parsed.headers);

  assert.deepEqual(parsed.sheetNames, ["Все назначения", "Все мобильные"]);
  assert.equal(parsed.rows.length, 3);
  assert.equal(validation.summary.ready, 3);
  assert.equal(validation.rows[0]?.input?.responsibleParticipantId, "egor");
  assert.equal(validation.rows[2]?.input?.phone, "+7 900 000 00 01");
  assert.equal(validation.rows[2]?.input?.lastName, "Гамма");
  assert.equal(validation.rows[2]?.input?.customFields?.Статус, "Готово");
});

test("a cell with several phone numbers keeps the first phone and preserves the source value", async () => {
  const parsed = await parseCsvFile(
    spreadsheetFile(
      [
        ["Контакт / организация", "Мобильные номера"],
        ["ООО Альфа", "+7 900 000-00-01, +7 900 000-00-02"],
      ],
      "xlsx",
      "xlsx",
    ),
  );
  const mapping = suggestMapping(parsed.headers);
  const validation = validateRows(parsed.rows, mapping, {
    emails: new Set(),
    phones: new Set(),
    telegramChatIds: new Set(),
    vkUserIds: new Set(),
  }, parsed.headers);

  assert.equal(validation.summary.ready, 1);
  assert.equal(validation.rows[0]?.input?.phone, "+7 900 000-00-01");
  assert.equal(
    validation.rows[0]?.input?.customFields?.["Мобильные номера"],
    "+7 900 000-00-01, +7 900 000-00-02",
  );
});
