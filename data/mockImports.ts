import type { ImportJob } from "@/types";

export const recentImports: ImportJob[] = [
  {
    id: "import-august-conference",
    fileName: "участники_конференции_август.xlsx",
    source: "xlsx",
    status: "complete",
    progress: 100,
    mapping: [
      { sourceColumn: "ФИО", targetField: "fullName", sampleValue: "Иван Петров" },
      { sourceColumn: "Эл. почта", targetField: "email", sampleValue: "ivan.petrov@lexbridge.example" },
      { sourceColumn: "Компания", targetField: "companyName", sampleValue: "Лексбридж Лигал" },
      { sourceColumn: "Должность", targetField: "role", sampleValue: "Старший партнёр" },
      { sourceColumn: "Город", targetField: "city", sampleValue: "Москва" },
    ],
    summary: {
      total: 4_821,
      ready: 4_701,
      duplicates: 78,
      invalidEmails: 32,
      missingEmails: 10,
    },
    createdAt: "2026-08-10T08:25:00Z",
  },
];

export const mockImports = recentImports;
