import { getTodayIndex, getWeekNumber, getDateByDayIndex, getWeekType } from './dateHelpers.js';

let notificationTimeout = null;
let lastScheduledLessonId = null;

/**
 * Запросить разрешение на уведомления
 */
export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  Notification.requestPermission();
}

/**
 * Показать уведомление о скором начале пары
 */
function showLessonNotification(lesson, startTime, dayName = 'сегодня') {
  if (Notification.permission !== 'granted') return;
  new Notification(`⏰ Скоро начнётся: ${lesson.name} в ${startTime}`, {
    body: `Преподаватель: ${lesson.teacher}\nАудитория: ${lesson.room}`,
    icon: '📚',
    silent: false,
    vibrate: [200, 100, 200],
  });
}

/**
 * Планирует уведомление за 5 минут до ближайшего занятия
 * (вызывается при обновлении данных или раз в минуту)
 */
export function scheduleNextLessonNotification(
  lessons,
  timeSlots,
  holidays,
  startRef,
  filterFn // функция для фильтрации занятий по дате и неделе (из scheduleRenderer)
) {
  // Отменяем старый таймер, если есть
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
    notificationTimeout = null;
    lastScheduledLessonId = null;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const todayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  // Проверяем праздник
  const holiday = holidays.find(h => {
    const d = new Date(todayDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return h.date === `${day}.${month}`;
  });
  if (holiday) return;

  // Получаем занятия на сегодня (с учётом недели)
  const todayLessons = lessons
    .filter(l => filterFn(l, todayDate, realWeek))
    .filter(l => l.day === todayIdx)
    .sort((a, b) => a.slot - b.slot);

  let foundLesson = null;
  let foundDay = todayIdx;

  // Ищем первую пару, которая ещё не началась (старт >= текущего времени)
  for (const lesson of todayLessons) {
    const slot = timeSlots[lesson.slot];
    if (slot && slot.start >= currentTime) {
      foundLesson = lesson;
      break;
    }
  }

  // Если сегодня нет будущих пар, ищем в следующие дни
  if (!foundLesson) {
    for (let offset = 1; offset <= 7; offset++) {
      let checkDay = todayIdx + offset;
      if (checkDay > 7) checkDay -= 7;
      const checkDate = getDateByDayIndex(startRef, realWeek, checkDay);
      const dayLessons = lessons
        .filter(l => filterFn(l, checkDate, realWeek))
        .filter(l => l.day === checkDay)
        .sort((a, b) => a.slot - b.slot);
      if (dayLessons.length > 0) {
        foundLesson = dayLessons[0];
        foundDay = checkDay;
        break;
      }
    }
  }

  if (!foundLesson) {
    // Нет занятий – не планируем
    return;
  }

  const slot = timeSlots[foundLesson.slot];
  if (!slot) return;

  const [h, m] = slot.start.split(':').map(Number);
  const startDate = new Date(now);
  startDate.setHours(h, m, 0, 0);
  if (foundDay !== todayIdx) {
    let diff = foundDay - todayIdx;
    if (diff < 0) diff += 7;
    startDate.setDate(startDate.getDate() + diff);
  }

  const timeToStart = startDate.getTime() - now.getTime();
  const notifyAt = timeToStart - 5 * 60 * 1000; // за 5 минут

  const lessonId = `${foundLesson.day}-${foundLesson.slot}-${foundLesson.name}`;
  if (lessonId === lastScheduledLessonId) {
    // Уже запланировано для этого урока
    return;
  }

  lastScheduledLessonId = lessonId;

  if (notifyAt > 1000) {
    notificationTimeout = setTimeout(() => {
      const dayName = foundDay === todayIdx ? 'сегодня' : `${DAY_NAMES[foundDay-1]}`;
      showLessonNotification(foundLesson, slot.start, dayName);
      lastScheduledLessonId = null;
      notificationTimeout = null;
    }, notifyAt);
  } else {
    // Урок уже близко, уведомление не показываем (или можно показать сразу)
    lastScheduledLessonId = null;
  }
}