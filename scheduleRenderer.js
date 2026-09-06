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
 * Получить список занятий для конкретной даты с учётом временных корректировок
 * @param {number} dayIndex - 1..7 (ПН..ВС)
 * @param {Date} date - дата, для которой строим расписание
 * @param {number} weekNumber - номер недели
 * @param {Array} holidays - массив праздников
 * @param {Array} baseLessons - базовое расписание (массив объектов)
 * @param {Array} tempSchedule - временные изменения [{date, lessons: [{slot, name?, room?, teacher?, todo}]}]
 * @param {Array} timeSlots - временные слоты (для определения количества слотов)
 * @returns {Array} массив занятий для этого дня (отсортирован по slot)
 */
export function getLessonsForDate(dayIndex, date, weekNumber, holidays, baseLessons, tempSchedule, timeSlots) {
  // Базовые занятия для этого дня (без учёта корректировок)
  let dayLessons = baseLessons.filter(l => l.day === dayIndex);

  // Применяем фильтр по неделе и датам
  dayLessons = dayLessons.filter(l => filterLessonsForDay(l, date, weekNumber, holidays));

  // Поиск корректировки для этой даты (без проверки праздника)
  const yearShort = String(date.getFullYear()).slice(-2);
  const dayStr = String(date.getDate()).padStart(2, '0');
  const monthStr = String(date.getMonth() + 1).padStart(2, '0');
  const dateKey = `${dayStr}.${monthStr}.${yearShort}`;

  const correction = tempSchedule.find(item => {
    const parts = item.date.split('.');
    if (parts.length === 3) {
      return item.date === dateKey;
    } else if (parts.length === 2) {
      const full = `${item.date}.${yearShort}`;
      return full === dateKey;
    }
    return false;
  });

  // Группируем по слотам и применяем корректировки (как было)
  const slotMap = {};
  dayLessons.forEach(l => {
    if (!slotMap[l.slot]) slotMap[l.slot] = [];
    slotMap[l.slot].push(l);
  });

  if (correction) {
    correction.lessons.forEach(corr => {
      const slot = corr.slot;
      if (corr.todo === 'delete') {
        delete slotMap[slot];
      } else if (corr.todo === 'replace') {
        const newLesson = {
          day: dayIndex,
          slot: slot,
          name: corr.name || 'Занятие',
          room: corr.room || '—',
          teacher: corr.teacher || '—',
          weekType: 'both',
          isReplacement: true,
        };
        slotMap[slot] = [newLesson];
      }
    });
  }

  const result = [];
  const slots = Object.keys(slotMap).map(Number).sort((a, b) => a - b);
  for (const slot of slots) {
    result.push(...slotMap[slot]);
  }
  return result;
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
  tempSchedule,
  onAddHomework
) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();

  const displayWeek = state.filterToday ? getWeekNumber(startRef, now) : state.weekNumber;

  const daysToRender = state.filterToday ? [todayIdx] : [1, 2, 3, 4, 5, 6, 7];

  let html = '';
  for (const d of daysToRender) {
    const isToday = (d === todayIdx);
    const dayDate = getDateByDayIndex(startRef, displayWeek, d);

    // === ПРОВЕРКА НА ПРАЗДНИК ===
    const dayStr = String(dayDate.getDate()).padStart(2, '0');
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
    const holiday = holidays.find(h => h.date === `${dayStr}.${monthStr}`);

    const dayClass = isToday ? 'day-card today' : 'day-card';
    html += `<div class="${dayClass}">`;
    html += `<div class="day-header"><span>${DAY_NAMES[d-1]}, ${formatDate(dayDate)}</span>`;
    if (isToday) html += `<span class="date-badge">Сегодня</span>`;
    html += `</div><div class="lesson-list">`;

    // === ЕСЛИ ПРАЗДНИК → ПОКАЗЫВАЕМ СООБЩЕНИЕ ===
    if (holiday) {
      html += `
        <div class="holiday-message">
          <span class="holiday-icon">🙂</span>
          <span class="holiday-text">${holiday.description}</span>
        </div>
      `;
    } else {
      // === ИНАЧЕ — ОБЫЧНОЕ РАСПИСАНИЕ С УЧЁТОМ tempSchedule ===
      const dayLessons = getLessonsForDate(d, dayDate, displayWeek, holidays, lessons, tempSchedule, timeSlots);

      if (dayLessons.length === 0) {
        html += `<div class="no-lessons" style="padding:20px;text-align:center;color:var(--text-muted);">🎉 Занятий нет</div>`;
      } else {
      // Проходим по слотам по порядку
      for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
        const slot = timeSlots[slotIdx];
        // Находим все занятия в этом слоте
        const lessonsInSlot = dayLessons.filter(l => l.slot === slotIdx);
        if (lessonsInSlot.length > 0) {
          lessonsInSlot.forEach(lesson => {
            const timeDisplay = `${slot.start} – ${slot.end}`;
            const isCurrent = isToday && currentTime >= slot.start && currentTime <= slot.end;
            const currentClass = isCurrent ? 'lesson-item current' : 'lesson-item';
            // Если это замена, можно добавить пометку
            const replacementBadge = lesson.isReplacement ? ' 🔄' : '';
            html += `
              <div class="${currentClass}">
                <div class="lesson-time">${timeDisplay}</div>
                <div class="lesson-info">
                  <div class="lesson-name">${lesson.name}${replacementBadge}</div>
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
          // Пустой слот
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

  // Обработчики для кнопок ДЗ
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
export function renderCurrentLesson(container, timeSlots, lessons, holidays, startRef, tempSchedule) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const todayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  const dayLessons = getLessonsForDate(todayIdx, todayDate, realWeek, holidays, lessons, tempSchedule, timeSlots);
  const currentLessons = dayLessons.filter(l => {
    const slot = timeSlots[l.slot];
    return slot && currentTime >= slot.start && currentTime <= slot.end;
  });

  const parentBlock = container.parentElement;
  if (currentLessons.length === 0) {
    if (parentBlock) parentBlock.style.display = 'none';
    return;
  }
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
    const replacementBadge = lesson.isReplacement ? ' 🔄' : '';
    html += `
      <div class="current-lesson-item">
        <span class="lesson-name">${lesson.name}${replacementBadge}</span>
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
export function renderNextLesson(container, timeSlots, lessons, holidays, startRef, tempSchedule) {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const todayIdx = getTodayIndex();
  const realWeek = getWeekNumber(startRef, now);
  const todayDate = getDateByDayIndex(startRef, realWeek, todayIdx);

  // Получаем занятия на сегодня с учётом корректировок
  let todayLessons = getLessonsForDate(todayIdx, todayDate, realWeek, holidays, lessons, tempSchedule, timeSlots);
  // Сортируем по слотам
  todayLessons.sort((a, b) => a.slot - b.slot);

  let nextLesson = null;
  let targetDay = todayIdx;
  let targetWeek = realWeek;

  // Ищем будущую пару сегодня
  for (const lesson of todayLessons) {
    const slot = timeSlots[lesson.slot];
    if (slot && slot.start >= currentTime) {
      nextLesson = lesson;
      break;
    }
  }

  // Если нет, ищем в следующие дни (до 7 дней вперёд)
  if (!nextLesson) {
    for (let offset = 1; offset <= 7; offset++) {
      const dayIndex = todayIdx + offset;
      let weekNum = realWeek;
      let day = dayIndex;
      if (day > 7) {
        day = day - 7;
        weekNum = realWeek + 1;
      }
      const checkDate = getDateByDayIndex(startRef, weekNum, day);
      const dayLessons = getLessonsForDate(day, checkDate, weekNum, holidays, lessons, tempSchedule, timeSlots);
      if (dayLessons.length > 0) {
        nextLesson = dayLessons[0]; // берём первую пару дня
        targetDay = day;
        targetWeek = weekNum;
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

  // Вычисляем время начала
  const [h, m] = slot.start.split(':').map(Number);
  const startDate = new Date(now);
  startDate.setHours(h, m, 0, 0);
  const daysDiff = (targetWeek - realWeek) * 7 + (targetDay - todayIdx);
  if (daysDiff > 0) {
    startDate.setDate(startDate.getDate() + daysDiff);
  }

  const countdown = getTimeRemaining(startDate);
  const isUrgent = (startDate - now <= 600000 && startDate - now > 0);
  const dayPrefix = (daysDiff > 0) ? ` (${DAY_NAMES[targetDay-1]})` : '';
  const replacementBadge = nextLesson.isReplacement ? ' 🔄' : '';

  container.innerHTML = `
    <div class="main-info">
      <span class="lesson-name">${nextLesson.name}${replacementBadge}</span>
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