// Утилиты для работы с датами и неделями
export const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const NUMBER_OF_DAYS = 7;

/**
 * Получить номер дня недели (1 = ПН … 7 = ВС) для текущей даты
 */
export function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

/**
 * Вычислить номер недели относительно опорного понедельника
 */
export function getWeekNumber(startRef, date = new Date()) {
  const diff = Math.floor((date - startRef) / (7 * 24 * 60 * 60 * 1000));
  return diff + 1;
}

/**
 * Тип недели: 'even' или 'odd'
 */
export function getWeekType(weekNumber) {
  return weekNumber % 2 === 0 ? 'even' : 'odd';
}

/**
 * Получить понедельник для заданной недели
 */
export function getWeekStartDate(startRef, weekNumber) {
  const start = new Date(startRef);
  start.setDate(start.getDate() + (weekNumber - 1) * 7);
  return start;
}

/**
 * Получить дату для дня недели (1..7) в указанной неделе
 */
export function getDateByDayIndex(startRef, weekNumber, dayIndex) {
  const weekStart = getWeekStartDate(startRef, weekNumber);
  const date = new Date(weekStart);
  date.setDate(date.getDate() + (dayIndex - 1));
  return date;
}

/**
 * Форматирование даты: "1 сентября"
 */
export function formatDate(date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/**
 * Короткий формат ДД.ММ
 */
export function formatDateShort(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}