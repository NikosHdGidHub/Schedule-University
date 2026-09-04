import {
  DAY_NAMES,
  getTodayIndex,
  getWeekNumber,
  getDateByDayIndex,
  getWeekType,
  formatDate,
  formatDateShort,
} from './dateHelpers.js';

/**
 * Проверяет доступность занятия по дате (dateStart/dateEnd)
 */
function isLessonAvailable(lesson, date) {
  if (!lesson.dateStart && !lesson.dateEnd) return true;

  const parseDate = (str) => {
    if (!str) return null;
    const parts = str.split('.').map(Number);
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year < 100) year += 2000;
      return new Date(year, month - 1, day);
    } else if (parts.length === 2) {
      const [day, month] = parts;
      return new Date(date.getFullYear(), month - 1, day);
    }
    throw new Error(`Некорректный формат даты: "${str}"`);
  };

  const startDate = parseDate(lesson.dateStart);
  const endDate = parseDate(lesson.dateEnd);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  if (startDate && target < startDate) return false;
  if (endDate && target > endDate) return false;
  return true;
}

/**
 * Фильтр для занятий: учитывает неделю, дату, праздники
 */
export function filterLessonsForDay(lesson, date, weekNumber, holidays) {
  // Проверка праздника
  const dayStr = String(date.getDate()).padStart(2, '0');
  const monthStr = String(date.getMonth() + 1).padStart(2, '0');
  const key = `${dayStr}.${monthStr}`;
  if (holidays.some(h => h.date === key)) return false;

  if (!isLessonAvailable(lesson, date)) return false;

  const weekType = getWeekType(weekNumber);
  if (lesson.weekType === 'both') return true;
  return lesson.weekType === weekType;
}

/**
 * Рендеринг расписания
 */
export function renderSchedule(
  container,
  state,
  timeSlots,
  lessons,
  holidays,
  startRef,
  onAddHomework // колбэк для открытия модалки ДЗ
) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();

  const displayWeek = state.filterToday ? getWeekNumber(startRef, now) : state.weekNumber;

  // Группируем занятия по дням и слотам
  const grouped = {};
  for (let d = 1; d <= 7; d++) {
    grouped[d] = new Array(timeSlots.length).fill(null);
  }

  for (let d = 1; d <= 7; d++) {
    const dayDate = getDateByDayIndex(startRef, displayWeek, d);
    const dayLessons = lessons.filter(l =>
      l.day === d && filterLessonsForDay(l, dayDate, displayWeek, holidays)
    );
    dayLessons.forEach(lesson => {
      if (!grouped[d][lesson.slot]) grouped[d][lesson.slot] = [];
      grouped[d][lesson.slot].push(lesson);
    });
  }

  const daysToRender = state.filterToday ? [todayIdx] : [1, 2, 3, 4, 5, 6, 7];

  let html = '';
  for (const d of daysToRender) {
    const isToday = (d === todayIdx);
    const dayDate = getDateByDayIndex(startRef, displayWeek, d);
    const holiday = holidays.find(h => {
      const day = String(dayDate.getDate()).padStart(2, '0');
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      return h.date === `${day}.${month}`;
    });

    const dayClass = isToday ? 'day-card today' : 'day-card';
    html += `<div class="${dayClass}">`;
    html += `<div class="day-header"><span>${DAY_NAMES[d-1]}, ${formatDate(dayDate)}</span>`;
    if (isToday) html += `<span class="date-badge">Сегодня</span>`;
    html += `</div><div class="lesson-list">`;

    if (holiday) {
      html += `
        <div class="holiday-message">
          <span class="holiday-icon">🙂</span>
          <span class="holiday-text">${holiday.description}</span>
        </div>
      `;
    } else {
      let hasLessons = false;
      for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
        if (grouped[d][slotIdx] && grouped[d][slotIdx].length > 0) {
          hasLessons = true;
          break;
        }
      }

      if (!hasLessons && state.filterToday && isToday) {
        html += `<div class="no-lessons" style="padding:20px;text-align:center;color:var(--text-muted);">🎉 Сегодня занятий нет</div>`;
      } else {
        for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
          const slot = timeSlots[slotIdx];
          const lessonsInSlot = grouped[d][slotIdx] || [];

          if (lessonsInSlot.length > 0) {
            lessonsInSlot.forEach(lesson => {
              const timeDisplay = `${slot.start} – ${slot.end}`;
              const isCurrent = isToday && currentTime >= slot.start && currentTime <= slot.end;
              const currentClass = isCurrent ? 'lesson-item current' : 'lesson-item';

              html += `
                <div class="${currentClass}">
                  <div class="lesson-time">${timeDisplay}</div>
                  <div class="lesson-info">
                    <div class="lesson-name">${lesson.name}</div>
                    <div class="lesson-meta">
                      <span><span class="icon">🏛️</span> ${lesson.room}</span>
                      <span><span class="icon">👨‍🏫</span> ${lesson.teacher}</span>
                    </div>
                  </div>
                  <button class="lesson-add-hw" data-day="${lesson.day}" data-subject="${lesson.name}" title="Добавить домашнее задание">➕</button>
                </div>
              `;
            });
          } else {
            const emptyText = (slot.start === '10:00') ? '😴 Можно выспаться' : 'Нет пары';
            html += `
              <div class="lesson-item empty-slot">
                <div class="lesson-time">${slot.start} – ${slot.end}</div>
                <div class="lesson-info">
                  <div class="lesson-name" style="color:var(--text-empty);font-style:italic;">${emptyText}</div>
                </div>
              </div>
            `;
          }
        }
      }
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;

  // Вешаем обработчики на кнопки "+"
  container.querySelectorAll('.lesson-add-hw').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const day = parseInt(this.dataset.day);
      const subject = this.dataset.subject;
      if (onAddHomework) onAddHomework(day, subject);
    });
  });
}

/**
 * Обновить блок "Текущая пара"
 */
export function renderCurrentLesson(container, timeSlots, lessons, holidays, startRef) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const dayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  // Проверка праздника
  const holiday = holidays.find(h => {
    const day = String(dayDate.getDate()).padStart(2, '0');
    const month = String(dayDate.getMonth() + 1).padStart(2, '0');
    return h.date === `${day}.${month}`;
  });

  const parentBlock = container.parentElement; // это #currentLessonBlock

  if (holiday) {
    if (parentBlock) parentBlock.style.display = 'none';
    return;
  }

  const dayLessons = lessons.filter(l =>
    l.day === todayIdx && filterLessonsForDay(l, dayDate, realWeek, holidays)
  );

  const currentLessons = dayLessons.filter(l => {
    const slot = timeSlots[l.slot];
    return slot && currentTime >= slot.start && currentTime <= slot.end;
  });

  if (currentLessons.length === 0) {
    if (parentBlock) parentBlock.style.display = 'none';
    return;
  }

  // Показываем блок
  if (parentBlock) parentBlock.style.display = 'block';

  let html = '<div class="current-lesson-label">🔴 Идёт сейчас</div>';
  currentLessons.forEach(lesson => {
    const slot = timeSlots[lesson.slot];
    const end = new Date();
    const [h, m] = slot.end.split(':').map(Number);
    end.setHours(h, m, 0, 0);
    const diff = end - now;
    const timeLeft = diff > 0
      ? `Осталось ${Math.floor(diff/60000)} мин ${Math.floor((diff%60000)/1000)} сек`
      : 'Заканчивается';
    html += `
      <div class="current-lesson-item">
        <span class="lesson-name">${lesson.name}</span>
        <span class="lesson-meta">🏛️ ${lesson.room} | 👨‍🏫 ${lesson.teacher}</span>
        <span class="time-left">⏳ ${timeLeft}</span>
      </div>
    `;
  });
  container.innerHTML = html;
}

/**
 * Обновить блок "Следующая пара"
 */
export function renderNextLesson(container, timeSlots, lessons, holidays, startRef) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const todayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  // Проверка праздника
  const holiday = holidays.find(h => {
    const day = String(todayDate.getDate()).padStart(2, '0');
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    return h.date === `${day}.${month}`;
  });
  if (holiday) {
    container.innerHTML = `<div class="no-lessons">🎉 Сегодня праздник</div>`;
    return;
  }

  const todayLessons = lessons
    .filter(l => l.day === todayIdx && filterLessonsForDay(l, todayDate, realWeek, holidays))
    .sort((a, b) => a.slot - b.slot);

  let nextLesson = null;
  let targetDay = todayIdx;

  // Ищем будущую пару сегодня
  for (const lesson of todayLessons) {
    const slot = timeSlots[lesson.slot];
    if (slot && slot.start >= currentTime) {
      nextLesson = lesson;
      break;
    }
  }

  // Если нет, ищем в следующие дни
  if (!nextLesson) {
    for (let offset = 1; offset <= 7; offset++) {
      let checkDay = todayIdx + offset;
      if (checkDay > 7) checkDay -= 7;
      const checkDate = getDateByDayIndex(startRef, realWeek, checkDay);
      const dayLessons = lessons
        .filter(l => l.day === checkDay && filterLessonsForDay(l, checkDate, realWeek, holidays))
        .sort((a, b) => a.slot - b.slot);
      if (dayLessons.length > 0) {
        nextLesson = dayLessons[0];
        targetDay = checkDay;
        break;
      }
    }
  }

  if (!nextLesson) {
    container.innerHTML = `<div class="no-lessons">🎉 На этой неделе занятий нет</div>`;
    return;
  }

  const slot = timeSlots[nextLesson.slot];
  if (!slot) {
    container.innerHTML = `<div class="no-lessons">⚠️ Ошибка времени</div>`;
    return;
  }

  const [h, m] = slot.start.split(':').map(Number);
  const startDate = new Date(now);
  startDate.setHours(h, m, 0, 0);
  if (targetDay !== todayIdx) {
    let diff = targetDay - todayIdx;
    if (diff < 0) diff += 7;
    startDate.setDate(startDate.getDate() + diff);
  }

  const countdown = getTimeRemaining(startDate);
  const isUrgent = (startDate - now <= 600000 && startDate - now > 0);
  const dayPrefix = targetDay !== todayIdx ? ` (${DAY_NAMES[targetDay-1]})` : '';

  container.innerHTML = `
    <div class="main-info">
      <span class="lesson-name">${nextLesson.name}</span>
      <span class="lesson-meta">
        <span>🏛️ ${nextLesson.room}</span>
        <span>👨‍🏫 ${nextLesson.teacher}</span>
        <span>⏰ ${slot.start}${dayPrefix}</span>
      </span>
    </div>
    <div class="countdown ${isUrgent ? 'urgent' : ''}">${countdown}</div>
  `;
}

function getTimeRemaining(targetDate) {
  const diff = targetDate - Date.now();
  if (diff <= 0) return '🔴 Идёт сейчас!';
  const seconds = Math.floor(diff / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}