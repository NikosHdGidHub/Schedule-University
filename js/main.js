// Импорты
import { AppState } from './state.js';
import { loadScheduleData, listenHomeworks, addHomework, updateHomework, deleteHomework, toggleHomeworkDone, getHomeworksData } from './data.js';
import { renderSchedule, renderCurrentLesson, renderNextLesson, filterLessonsForDay } from './scheduleRenderer.js';
import { renderHomeworks } from './homeworksRenderer.js';
import { scheduleNextLessonNotification, requestNotificationPermission } from './notifications.js';
import { applyTheme, getSavedTheme } from './theme.js';
import { getWeekNumber, getWeekStartDate, formatDateShort, getTodayIndex } from './dateHelpers.js';
import { auth, loginAnonymously, onAuthState } from './firebaseConfig.js';

// DOM-элементы
const dom = {
  themeToggle: document.getElementById('themeToggle'),
  currentLessonBlock: document.getElementById('currentLessonBlock'),
  currentLessonContent: document.getElementById('currentLessonContent'),
  nextLessonContent: document.getElementById('nextLessonContent'),
  scheduleContainer: document.getElementById('scheduleContainer'),
  filterBtn: document.getElementById('todayFilterBtn'),
  mainTabs: document.querySelectorAll('#mainTabs .tab-btn'),
  homeworksContainer: document.getElementById('homeworksContainer'),
  hwList: document.getElementById('hwList'),
  hwModal: document.getElementById('hwModal'),
  hwModalClose: document.getElementById('hwModalClose'),
  hwForm: document.getElementById('hwForm'),
  hwEditId: document.getElementById('hwEditId'),
  hwDay: document.getElementById('hwDay'),
  hwSubject: document.getElementById('hwSubject'),
  hwDescription: document.getElementById('hwDescription'),
  hwDeadline: document.getElementById('hwDeadline'),
  hwModalTitle: document.getElementById('hwModalTitle'),
  exportHwBtn: document.getElementById('exportHwBtn'),
  importHwBtn: document.getElementById('importHwBtn'),
  prevWeekBtn: document.getElementById('prevWeekBtn'),
  nextWeekBtn: document.getElementById('nextWeekBtn'),
  weekNumberDisplay: document.getElementById('weekNumberDisplay'),
  weekParityDisplay: document.getElementById('weekParityDisplay'),
};

// Состояние приложения
const state = new AppState();

// Данные расписания
let timeSlots = [];
let holidays = [];
let lessons = [];
let startRef = null;

// Обновление кнопки "Сегодня"
function updateFilterButton() {
  const btn = dom.filterBtn;
  if (state.filterToday) {
    btn.textContent = '📌 Только сегодня';
    btn.classList.add('active');
  } else {
    btn.textContent = '📅 Все дни';
    btn.classList.remove('active');
  }
}

// Обновление вкладок
function updateTabs() {
  dom.mainTabs.forEach(btn => {
    const isActive = btn.dataset.tab === state.activeTab;
    btn.classList.toggle('active', isActive);
  });
}

// Инициализация
async function init() {
  // 1. Сразу загружаем данные расписания
  const data = await loadScheduleData();
  timeSlots = data.timeSlots;
  holidays = data.holidays;
  lessons = data.lessons;
  startRef = data.startWeekReference;

  // 2. Восстанавливаем тему и фильтр
  const savedTheme = getSavedTheme();
  applyTheme(savedTheme);
  state.setTheme(savedTheme);

  const savedFilter = localStorage.getItem('filterToday');
  if (savedFilter === 'true') state.toggleFilterToday();

  const realWeek = getWeekNumber(startRef);
  const todayIdx = getTodayIndex();

  // Определяем начальную неделю:
  // если сегодня воскресенье и фильтр "Сегодня" не включён → показываем следующую неделю
  let initialWeek = realWeek;
  if (todayIdx === 7 && !state.filterToday) {
    initialWeek = realWeek + 1;
  }
  state.setWeekNumber(initialWeek);

  // 3. Подписка на изменения состояния
  state.subscribe(() => {
    renderAll();
    updateWeekDisplay();
    updateFilterButton();
    updateTabs();
  });

  // 4. Первый рендер
  renderAll();
  dom.scheduleContainer.style.display = 'flex';
  dom.homeworksContainer.style.display = 'none';
  dom.homeworksContainer.classList.remove('active');
  updateTabs();
  updateFilterButton();
  updateWeekDisplay();

  // 5. Обновление текущей/следующей пары (каждую секунду)
  setInterval(() => {
    renderCurrentLesson(dom.currentLessonContent, timeSlots, lessons, holidays, startRef);
    renderNextLesson(dom.nextLessonContent, timeSlots, lessons, holidays, startRef);
  }, 1000);

  // 6. Уведомления
  requestNotificationPermission();
  scheduleNotifications();
  setInterval(scheduleNotifications, 60000);

  // 7. Фоновые задачи (авторизация, Firestore)
  loginAnonymously()
    .then(userCredential => {
      // console.log('Анонимный вход выполнен, uid:', userCredential.user.uid);
    })
    .catch(error => {
      console.warn('Ошибка анонимного входа:', error);
    });

  onAuthState((user) => {
    if (user) {
      console.log('Пользователь авторизован');
    } else {
      console.log('Пользователь не авторизован');
    }
  });

  listenHomeworks((hw) => {
    renderHomeworks(dom.hwList, hw, handleToggleDone, handleDeleteHomework);
  });

  attachEventHandlers();
}

// Рендеринг всего расписания
function renderAll() {
  renderSchedule(
    dom.scheduleContainer,
    state,
    timeSlots,
    lessons,
    holidays,
    startRef,
    (day, subject) => openHomeworkModal(day, subject)
  );
  renderCurrentLesson(dom.currentLessonContent, timeSlots, lessons, holidays, startRef);
  renderNextLesson(dom.nextLessonContent, timeSlots, lessons, holidays, startRef);
}

// Обновление отображения недели
function updateWeekDisplay() {
  const weekNum = state.weekNumber;
  const weekStart = getWeekStartDate(startRef, weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const range = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;
  const parity = weekNum % 2 === 0 ? 'чётная' : 'нечётная';
  dom.weekNumberDisplay.textContent = range;
  dom.weekParityDisplay.textContent = `(${parity})`;
}

// Планирование уведомлений
function scheduleNotifications() {
  scheduleNextLessonNotification(
    lessons,
    timeSlots,
    holidays,
    startRef,
    (lesson, date, weekNum) => {
      return filterLessonsForDay(lesson, date, weekNum, holidays);
    }
  );
}

// ---------- Обработчики событий ----------
function attachEventHandlers() {
  // Переключение вкладок
  dom.mainTabs.forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      state.setActiveTab(tab);
      if (tab === 'schedule') {
        dom.scheduleContainer.style.display = 'flex';
        dom.homeworksContainer.style.display = 'none';
        dom.homeworksContainer.classList.remove('active');
      } else {
        dom.scheduleContainer.style.display = 'none';
        dom.homeworksContainer.style.display = 'block';
        dom.homeworksContainer.classList.add('active');
        renderHomeworks(dom.hwList, getHomeworksData(), handleToggleDone, handleDeleteHomework);
      }
    });
  });

  // Фильтр "Сегодня"
  dom.filterBtn.addEventListener('click', function() {
    state.toggleFilterToday();
    localStorage.setItem('filterToday', state.filterToday ? 'true' : 'false');

    // Корректируем неделю при переключении фильтра
    const realWeek = getWeekNumber(startRef);
    const todayIdx = getTodayIndex();
    if (!state.filterToday && todayIdx === 7) {
      // Фильтр выключен, сегодня воскресенье → показываем следующую неделю
      state.setWeekNumber(realWeek + 1);
    } else if (state.filterToday) {
      // Фильтр включён → возвращаемся на реальную неделю
      state.setWeekNumber(realWeek);
    }
    // Кнопка обновится через подписку
  });

  // Тема
  dom.themeToggle.addEventListener('click', function() {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    state.setTheme(newTheme);
  });

  // Навигация по неделям
  dom.prevWeekBtn.addEventListener('click', () => {
    state.setWeekNumber(state.weekNumber - 1);
  });
  dom.nextWeekBtn.addEventListener('click', () => {
    state.setWeekNumber(state.weekNumber + 1);
  });

  // Модалка ДЗ
  dom.hwModalClose.addEventListener('click', closeHomeworkModal);
  dom.hwModal.addEventListener('click', function(e) {
    if (e.target === this) closeHomeworkModal();
  });
  dom.hwForm.addEventListener('submit', handleHomeworkSubmit);

  // Экспорт/Импорт
  dom.exportHwBtn.addEventListener('click', exportHomeworks);
  dom.importHwBtn.addEventListener('click', importHomeworks);
}

// ---------- Модалка ДЗ ----------
function openHomeworkModal(day, subject, editId = null) {
  const modal = dom.hwModal;
  const title = dom.hwModalTitle;
  if (editId) {
    const hw = getHomeworksData().find(h => h.id === editId);
    if (!hw) return;
    title.textContent = '✏️ Редактировать задание';
    dom.hwEditId.value = hw.id;
    dom.hwDay.value = hw.day;
    dom.hwSubject.value = hw.subject;
    dom.hwDescription.value = hw.description;
    dom.hwDeadline.value = hw.deadline || '';
  } else {
    title.textContent = '➕ Добавить задание';
    dom.hwEditId.value = '';
    dom.hwDay.value = day || 1;
    dom.hwSubject.value = subject || '';
    dom.hwDescription.value = '';
    dom.hwDeadline.value = '';
  }
  modal.classList.add('active');
}

function closeHomeworkModal() {
  dom.hwModal.classList.remove('active');
  dom.hwForm.reset();
  dom.hwEditId.value = '';
}

async function handleHomeworkSubmit(e) {
  e.preventDefault();
  const id = dom.hwEditId.value;
  const day = parseInt(dom.hwDay.value);
  const subject = dom.hwSubject.value.trim();
  const description = dom.hwDescription.value.trim();
  const deadline = dom.hwDeadline.value || '';
  if (!subject || !description) {
    alert('Заполните название предмета и описание');
    return;
  }
  const hw = { day, subject, description, deadline };
  if (id) {
    await updateHomework(id, hw);
  } else {
    await addHomework(hw);
  }
  closeHomeworkModal();
}

// Обработчики для ДЗ
async function handleToggleDone(id) {
  const hw = getHomeworksData().find(h => h.id === id);
  if (hw) await toggleHomeworkDone(id, hw.done);
}

async function handleDeleteHomework(id) {
  await deleteHomework(id);
}

// Экспорт/Импорт
function exportHomeworks() {
  const data = getHomeworksData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homeworks_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importHomeworks() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) {
          for (const hw of data) {
            await addHomework(hw);
          }
          alert('Импорт выполнен!');
        } else {
          alert('Неверный формат файла');
        }
      } catch (err) {
        alert('Ошибка при чтении файла');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Запуск
document.addEventListener('DOMContentLoaded', init);