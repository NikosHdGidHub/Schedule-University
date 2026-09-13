import { getTodayIndex, getWeekNumber, getDateByDayIndex } from './dateHelpers.js';

const START_NOTIFY_BEFORE_MS = 5 * 60 * 1000;   // за 5 минут до начала
const END_NOTIFY_BEFORE_MS   = 10 * 60 * 1000;  // за 10 минут до конца

// Хранилище запланированных уведомлений: ключ -> id таймера
const scheduledTimeouts = new Map();

export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  Notification.requestPermission();
}

function playSignal() {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
}

function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  playSignal();
  const notification = new Notification(title, {
    body,
    icon: '📚',
    silent: false,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
  setTimeout(() => notification.close(), 10000);
}

/**
 * Планирует уведомление ровно один раз. Если ключ уже в Map — выходим.
 * Никакие ранее установленные таймеры не отменяются.
 */
function scheduleNotificationOnce(key, delayMs, title, body) {
  if (scheduledTimeouts.has(key)) return;   // уже запланировано — не трогаем
  if (delayMs <= 0) return;                 // момент уже прошёл — нечего планировать
  const id = setTimeout(() => {
    scheduledTimeouts.delete(key);
    showNotification(title, body);
  }, delayMs);
  scheduledTimeouts.set(key, id);
}

/**
 * Основная функция. Вызывается регулярно (раз в минуту).
 * Идемпотентна: повторные вызовы не отменяют уже запланированные уведомления,
 * а только добавляют новые (например, для только что появившейся пары).
 */
export function scheduleNextLessonNotification(
  lessons,
  timeSlots,
  holidays,
  startRef,
  filterFn
) {
  const now = new Date();
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const todayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  // Проверка праздника
  const dayStr = String(todayDate.getDate()).padStart(2, '0');
  const monthStr = String(todayDate.getMonth() + 1).padStart(2, '0');
  const holiday = holidays.find(h => h.date === `${dayStr}.${monthStr}`);
  if (holiday) return;

  const todayLessons = lessons
    .filter(l => filterFn(l, todayDate, realWeek))
    .filter(l => l.day === todayIdx)
    .sort((a, b) => a.slot - b.slot);

  const dateKey = `${todayDate.getFullYear()}-${todayDate.getMonth() + 1}-${todayDate.getDate()}`;

  // Чистим таймеры за прошлые дни (актуально, если вкладка открыта сутками)
  for (const key of [...scheduledTimeouts.keys()]) {
    if (!key.startsWith(dateKey + '-')) {
      clearTimeout(scheduledTimeouts.get(key));
      scheduledTimeouts.delete(key);
    }
  }

  todayLessons.forEach(lesson => {
    const slot = timeSlots[lesson.slot];
    if (!slot) return;

    // ---------- Уведомление о начале пары (за 5 минут) ----------
    const [sh, sm] = slot.start.split(':').map(Number);
    const startDate = new Date(now);
    startDate.setHours(sh, sm, 0, 0);
    const startDelay = startDate.getTime() - now.getTime() - START_NOTIFY_BEFORE_MS;
    const startKey = `${dateKey}-s${lesson.slot}-start`;
    scheduleNotificationOnce(
      startKey,
      startDelay,
      `⏰ Через 5 минут: ${lesson.name}`,
      `Начало в ${slot.start}\nПреподаватель: ${lesson.teacher}\nАудитория: ${lesson.room}`
    );

    // ---------- Уведомление о конце пары (за 10 минут) ----------
    const [eh, em] = slot.end.split(':').map(Number);
    const endDate = new Date(now);
    endDate.setHours(eh, em, 0, 0);
    const endDelay = endDate.getTime() - now.getTime() - END_NOTIFY_BEFORE_MS;
    const endKey = `${dateKey}-s${lesson.slot}-end`;
    scheduleNotificationOnce(
      endKey,
      endDelay,
      `⏳ Скоро конец: ${lesson.name}`,
      `Конец в ${slot.end}\nПреподаватель: ${lesson.teacher}\nАудитория: ${lesson.room}`
    );
  });
}