import { getTodayIndex, getWeekNumber, getDateByDayIndex, DAY_NAMES } from './dateHelpers.js';

let notificationTimeout = null;
let lastScheduledLessonId = null;

export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  Notification.requestPermission();
}

function showLessonNotification(lesson, startTime, dayName = 'сегодня') {
  if (Notification.permission !== 'granted') return;

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

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

  const notification = new Notification(`⏰ Скоро начнётся: ${lesson.name} в ${startTime}`, {
    body: `Преподаватель: ${lesson.teacher}\nАудитория: ${lesson.room}`,
    icon: '📚',
    silent: false,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  });
  setTimeout(() => notification.close(), 10000);
}

export function scheduleNextLessonNotification(
  lessons,
  timeSlots,
  holidays,
  startRef,
  filterFn
) {
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

  const holiday = holidays.find(h => {
    const d = new Date(todayDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return h.date === `${day}.${month}`;
  });
  if (holiday) return;

  const todayLessons = lessons
    .filter(l => filterFn(l, todayDate, realWeek))
    .filter(l => l.day === todayIdx)
    .sort((a, b) => a.slot - b.slot);

  let foundLesson = null;
  let foundDay = todayIdx;
  let foundWeek = realWeek;

  for (const lesson of todayLessons) {
    const slot = timeSlots[lesson.slot];
    if (slot && slot.start >= currentTime) {
      foundLesson = lesson;
      break;
    }
  }

  if (!foundLesson) {
    for (let offset = 1; offset <= 7; offset++) {
      const dayIndex = todayIdx + offset;
      let weekNum = realWeek;
      let day = dayIndex;
      if (day > 7) {
        day = day - 7;
        weekNum = realWeek + 1;
      }
      const checkDate = getDateByDayIndex(startRef, weekNum, day);
      const holidayCheck = holidays.find(h => {
        const d = new Date(checkDate);
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        return h.date === `${dayStr}.${monthStr}`;
      });
      if (holidayCheck) continue;

      const dayLessons = lessons
        .filter(l => filterFn(l, checkDate, weekNum))
        .filter(l => l.day === day)
        .sort((a, b) => a.slot - b.slot);
      if (dayLessons.length > 0) {
        foundLesson = dayLessons[0];
        foundDay = day;
        foundWeek = weekNum;
        break;
      }
    }
  }

  if (!foundLesson) return;

  const slot = timeSlots[foundLesson.slot];
  if (!slot) return;

  const [h, m] = slot.start.split(':').map(Number);
  const startDate = new Date(now);
  startDate.setHours(h, m, 0, 0);
  const daysDiff = (foundWeek - realWeek) * 7 + (foundDay - todayIdx);
  if (daysDiff > 0) {
    startDate.setDate(startDate.getDate() + daysDiff);
  }

  const timeToStart = startDate.getTime() - now.getTime();
  const notifyAt = timeToStart - 5 * 60 * 1000;

  const lessonId = `${foundLesson.day}-${foundLesson.slot}-${foundLesson.name}`;
  if (lessonId === lastScheduledLessonId) return;

  lastScheduledLessonId = lessonId;

  if (notifyAt > 1000) {
    notificationTimeout = setTimeout(() => {
      const dayName = (daysDiff > 0) ? DAY_NAMES[foundDay-1] : 'сегодня';
      showLessonNotification(foundLesson, slot.start, dayName);
      lastScheduledLessonId = null;
      notificationTimeout = null;
    }, notifyAt);
  } else {
    lastScheduledLessonId = null;
  }
}