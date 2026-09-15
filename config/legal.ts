/** Operator name and INN confirmed by the product owner on 2026-09-15. */
export const legalConfig = {
  operatorName: "ООО «АСПБ»",
  inn: "6455071119",
  ogrn: "",
  address: "",
  privacyEmail: "info@tech-pravo.ru",
  version: "2026-09-15",
  approved: true,
} as const;

export const registrationConsent = {
  version: legalConfig.version,
  purpose: "Создание и обслуживание аккаунта в сервисе «Поток», предоставление доступа к рабочему пространству и поддержка пользователя.",
  data: "Имя, логин, сведения об аккаунте; при регистрации через Яндекс ID — идентификатор Яндекса, имя и адрес электронной почты.",
  operations: "Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, предоставление доступа для обслуживания сервиса, блокирование, удаление и уничтожение с использованием средств автоматизации.",
  duration: "На время использования аккаунта, до отзыва согласия. После отзыва обработка на основании согласия прекращается; данные, для хранения которых есть иное законное основание, обрабатываются в пределах этого основания.",
  withdrawal: `Отозвать согласие, запросить сведения, исправление или удаление данных можно по адресу ${legalConfig.privacyEmail}. Укажите логин аккаунта и суть обращения; пароль отправлять не нужно.`,
};
export function registrationConsentStatement() {
  return [`Оператор: ${legalConfig.operatorName}. ИНН: ${legalConfig.inn}. Контакт: ${legalConfig.privacyEmail}.`, registrationConsent.purpose, registrationConsent.data, registrationConsent.operations, registrationConsent.duration, registrationConsent.withdrawal, "Согласие не распространяется на рекламные рассылки, дополнительные cookies или обработку данных других людей."].join("\n");
}
