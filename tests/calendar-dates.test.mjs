import assert from "node:assert/strict";
import test from "node:test";
import { calendarDayKey, calendarMonthDays, parseCalendarDate } from "../lib/calendar/dates.ts";

test("calendar links accept civil dates and reject invalid or overflowing query dates", () => {
  assert.equal(parseCalendarDate("2024-02-29")?.toISOString(), "2024-02-29T12:00:00.000Z");
  for (const value of [null, "", "2026-02-29", "2026-04-31", "2026-13-01", "2026-09-00", "2026-9-13", "0099-01-01", "2026-09-13T00:00:00Z"]) {
    assert.equal(parseCalendarDate(value), null, String(value));
  }
});

test("mini calendar fills Monday-first weeks across month and year boundaries", () => {
  const september = calendarMonthDays(parseCalendarDate("2026-09-13"));
  assert.equal(september.length, 35);
  assert.equal(september[0].key, "2026-08-31");
  assert.equal(september.at(-1).key, "2026-10-04");
  assert.equal(september.filter(day => day.currentMonth).length, 30);
  const december = calendarMonthDays(parseCalendarDate("2024-12-01"));
  assert.equal(december.length, 42);
  assert.equal(december[0].key, "2024-11-25");
  assert.equal(december.at(-1).key, "2025-01-05");
  const february = calendarMonthDays(parseCalendarDate("2024-02-01"));
  assert.equal(february.filter(day => day.currentMonth).length, 29);
});

test("scheduled indicators use the selected Russian time zone at midnight", () => {
  const instant = "2026-09-30T13:00:00Z";
  assert.equal(calendarDayKey(instant, "Europe/Kaliningrad"), "2026-09-30");
  assert.equal(calendarDayKey(instant, "Asia/Kamchatka"), "2026-10-01");
});
