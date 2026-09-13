/** Built-in assets are hosted with the application, never generated or hotlinked. */
export const emailIcons = [
  ["lock", "Замок", "безопасность защита оплата"], ["shield", "Щит", "защита проверка право"],
  ["lightning", "Молния", "скорость быстро энергия"], ["people", "Команда", "люди коллеги сотрудники"],
  ["chart", "Диаграмма", "аналитика рост результаты"], ["pie", "Круговая диаграмма", "статистика доли отчёт"],
  ["rocket", "Ракета", "запуск рост старт"], ["target", "Цель", "план результат"],
  ["calendar", "Календарь", "событие встреча дата"], ["clock", "Часы", "время срок"],
  ["check", "Галочка", "готово успех проверка"], ["star", "Звезда", "качество избранное"],
  ["gift", "Подарок", "бонус акция"], ["mail", "Конверт", "письмо сообщение"],
  ["phone", "Телефон", "звонок контакт"], ["book", "Книга", "обучение знание курс"],
  ["briefcase", "Портфель", "работа бизнес"], ["sparkle", "Искры", "идеи ии творчество"],
].map(([id, name, keywords]) => ({ id, name, keywords, path: `/email-icons/${id}.png` }));
export const emailIconIds = emailIcons.map(icon => icon.id);
export function emailIconUrl(id: string) {
  const icon = emailIcons.find(icon => icon.id === id);
  return icon ? `https://mailflow-outreach.isakovegor820.chatgpt.site${icon.path}` : "";
}
export function emailIconMarkup(id: string, alignment = "left", size = 40) {
  const url = emailIconUrl(id);
  return url ? `<img src="${url}" alt="" role="presentation" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;max-width:100%;border:0;margin:0 ${alignment === "center" ? "auto" : "0"} 12px;">` : "";
}
