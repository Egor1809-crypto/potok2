import manifest from "./runeicons.generated.json";

export const runeCategories: Record<string, string> = {
  identity: "Люди и защита", messaging: "Общение", metrics: "Аналитика", money: "Покупки и финансы",
  schedule: "Время и события", documents: "Файлы", tools: "Инструменты", arrows: "Стрелки",
  code: "Разработка", gadgets: "Устройства", indicators: "Статусы", layouts: "Интерфейсы",
  nature: "Природа", playback: "Медиа", senses: "Действия", other: "Разное",
};
const names: Record<string, string> = {
  "arrow-down-left":"Стрелка вниз-влево","arrow-down-right":"Стрелка вниз-вправо","arrow-down-to-line":"Скачать до линии","arrow-down":"Стрелка вниз","arrow-left-right":"Стрелки влево-вправо","arrow-left":"Стрелка влево","arrow-right":"Стрелка вправо","arrow-up-down":"Стрелки вверх-вниз","arrow-up-from-line":"Загрузить от линии","arrow-up-left":"Стрелка вверх-влево","arrow-up-right":"Стрелка вверх-вправо","arrow-up":"Стрелка вверх","chevron-down":"Уголок вниз","chevron-left":"Уголок влево","chevron-right":"Уголок вправо","chevron-up":"Уголок вверх","corner-down-right":"Поворот вправо","move":"Перемещение","rotate-ccw":"Поворот против часовой","rotate-cw":"Поворот по часовой","skip-forward":"Следующий трек","step-back":"Шаг назад","unfold-horizontal":"Развернуть по горизонтали","unfold-vertical":"Развернуть по вертикали",
  "braces":"Фигурные скобки","code-xml":"Код XML","code":"Код","compass":"Компас","copy":"Копировать","drafting-compass":"Циркуль","git-branch":"Ветка Git","git-commit-horizontal":"Коммит Git","group":"Группировать","link-2":"Ссылка · цепь","link":"Ссылка","server-cog":"Настройки сервера","server":"Сервер","terminal":"Терминал","ungroup":"Разгруппировать",
  "archive":"Архив","box":"Коробка","clipboard-list":"Планшет со списком","clipboard":"Планшет","file-down":"Скачать файл","file-image":"Файл изображения","file-lock":"Защищённый файл","file-pen-line":"Заполнить документ","file-pen":"Редактировать файл","file-plus":"Новый файл","file-symlink":"Ярлык файла","file-text":"Текстовый файл","file":"Файл","folder-closed":"Закрытая папка","folder-input":"Добавить в папку","folder-open":"Открытая папка","folder-plus":"Новая папка","folder-symlink":"Ярлык папки","folder-up":"Перейти выше","folder":"Папка","folders":"Папки","import":"Импорт","inbox":"Входящие","paperclip":"Скрепка","save":"Сохранение",
  "battery-full":"Полная батарея","battery-low":"Низкий заряд","battery-medium":"Средний заряд","laptop":"Ноутбук","printer":"Принтер","tablet":"Планшетный компьютер","tv":"Телевизор","watch":"Наручные часы",
  "fingerprint-pattern":"Отпечаток пальца","lock-open":"Открытый замок","lock":"Замок","log-in":"Вход","log-out":"Выход","shield-check":"Щит с галочкой","shield-x":"Щит с крестиком","shield":"Щит","user-cog":"Настройки пользователя","user-minus":"Удалить пользователя","user-plus":"Добавить пользователя","user-round-plus":"Добавить участника","users":"Команда",
  "check":"Галочка","circle-alert":"Внимание в круге","circle-check":"Галочка в круге","circle-dot":"Точка в круге","circle-question-mark":"Вопрос в круге","circle-stop":"Стоп в круге","circle-user":"Профиль","circle-x":"Крестик в круге","cross":"Медицинский крест","info":"Информация","minus":"Минус","plus":"Плюс","square-arrow-out-up-right":"Внешняя ссылка","square-arrow-up-right":"Стрелка в квадрате","square-check":"Галочка в квадрате","square-stop":"Стоп в квадрате","triangle-alert":"Предупреждение","x":"Крестик",
  "columns-3":"Три столбца","grid-2x2":"Сетка 2 × 2","grid-3x3":"Сетка 3 × 3","grip-horizontal":"Горизонтальные точки","grip-vertical":"Вертикальные точки","kanban":"Канбан","layers-2":"Слои","layout-grid":"Макет","menu":"Меню","panel-bottom":"Нижняя панель","panel-left-close":"Закрыть левую панель","panel-left":"Левая панель","panel-right-close":"Закрыть правую панель","panel-top":"Верхняя панель",
  "contact":"Контакт","mail-check":"Письмо доставлено","mail-plus":"Новое письмо","mail":"Конверт","message-circle-warning":"Сообщение с предупреждением","message-circle":"Чат","message-square-text":"Текстовое сообщение","message-square":"Сообщение","phone-incoming":"Входящий звонок","phone-outgoing":"Исходящий звонок","phone":"Телефон","send":"Отправка",
  "activity":"Активность","chart-area":"Диаграмма с областями","chart-bar":"Столбчатая диаграмма","chart-line":"Линейный график","chart-pie":"Круговая диаграмма","sliders-horizontal":"Горизонтальные настройки","sliders-vertical":"Вертикальные настройки","trending-up":"Рост",
  "credit-card":"Банковская карта","dollar-sign":"Доллар","euro":"Евро","gift":"Подарок","indian-rupee":"Рупия","package":"Посылка","pound-sterling":"Фунт","receipt":"Чек","shopping-bag":"Пакет с покупками","shopping-basket":"Корзина покупок","shopping-cart":"Тележка","tag":"Ценник","truck":"Доставка","wallet":"Кошелёк",
  "cloud-download":"Скачать из облака","cloud-rain":"Дождь","cloud-snow":"Снег","cloud-upload":"Загрузить в облако","cloud":"Облако","earth":"Земля","moon":"Луна","sun":"Солнце","sunrise":"Рассвет","sunset":"Закат","wind":"Ветер","apple":"Яблоко","globe":"Глобус","wifi-low":"Слабый Wi-Fi","wifi":"Wi-Fi","zap":"Молния",
  "camera":"Камера","clapperboard":"Кинохлопушка","film":"Фильм","image-plus":"Добавить изображение","image":"Изображение","images":"Галерея","mic-off":"Микрофон выключен","mic":"Микрофон","pause":"Пауза","play":"Воспроизведение","video":"Видео","volume-1":"Тихий звук","volume-2":"Громкий звук",
  "alarm-clock":"Будильник","calendar":"Календарь","clock-alert":"Срок","clock":"Часы","history":"История","refresh-cw":"Обновление","repeat":"Повтор",
  "ear":"Слух","eye-closed":"Закрытый глаз","eye-off":"Скрыть","eye":"Глаз","hand":"Рука","pointer":"Указатель","thumbs-down":"Не нравится","thumbs-up":"Нравится",
  "bell-off":"Уведомления выключены","bookmark":"Закладка","flag-triangle-right":"Треугольный флаг","flag":"Флаг","funnel":"Воронка","heart":"Сердце","house":"Дом","list-filter":"Фильтр списка","map-pin":"Метка на карте","map":"Карта","pencil":"Карандаш","scissors":"Ножницы","search":"Поиск","settings-2":"Регуляторы","settings":"Настройки","share-2":"Поделиться","sparkles":"Искры","star":"Звезда","trash-2":"Корзина удаления","trash":"Удаление",
};
const synonyms: Record<string, string> = {
  identity: "безопасность защита доступ пароль сотрудники коллеги люди", metrics: "аналитика статистика отчёт показатели результаты рост диаграммы",
  messaging: "письмо почта общение чат звонок телефон рассылка", money: "покупка оплата деньги продажи магазин скидка",
  schedule: "дата время событие встреча сроки", documents: "документы вложения файл папка",
  tools: "инструмент поиск настройка", code: "программирование технологии сервер код", gadgets: "техника устройство",
  indicators: "статус результат проверка ошибка", layouts: "интерфейс панель макет", nature: "погода природа",
  playback: "медиа фото видео звук", senses: "взаимодействие жесты действия", arrows: "навигация направление переход", other: "разное",
};
const featured = ["lock", "shield-check", "users", "chart-bar", "chart-pie", "zap", "mail", "calendar", "gift", "star", "heart", "check", "clock", "phone", "send"];
export const runeEmailIcons = manifest.map(icon => ({
  id: icon.id, name: names[icon.basename] || icon.basename, path: icon.path,
  keywords: `${icon.basename.replaceAll("-", " ")} ${synonyms[icon.folder]} runeicons rune pixel пиксель пиксельные`,
  collection: "pixel" as const, category: runeCategories[icon.folder],
})).sort((a, b) => {
  const rank = (id: string) => { const base = manifest.find(icon => icon.id === id)!.basename; const index = featured.indexOf(base); return index < 0 ? 999 : index; };
  return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "ru");
});
