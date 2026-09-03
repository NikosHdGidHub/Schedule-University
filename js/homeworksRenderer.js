import { DAY_NAMES } from './dateHelpers.js';

export function renderHomeworks(container, homeworksData, onToggleDone, onDelete) {
  if (!container) return;
  if (homeworksData.length === 0) {
    container.innerHTML = `<div class="hw-empty">📭 Пока нет заданий. Нажмите на <strong>➕</strong> рядом с парой в расписании, чтобы добавить.</div>`;
    return;
  }

  const groups = {};
  homeworksData.forEach(hw => {
    const day = hw.day || 1;
    if (!groups[day]) groups[day] = [];
    groups[day].push(hw);
  });

  let html = '';
  for (let d = 1; d <= 7; d++) {
    const items = groups[d] || [];
    if (items.length === 0) continue;
    html += `<div class="hw-day-group">`;
    html += `<div class="hw-day-title">${DAY_NAMES[d-1]}</div>`;
    items.forEach(hw => {
      const checked = hw.done ? 'checked' : '';
      const style = hw.done ? 'text-decoration: line-through; opacity: 0.6;' : '';
      html += `
        <div class="hw-item">
          <input type="checkbox" class="hw-checkbox" data-id="${hw.id}" ${checked}>
          <div class="hw-info">
            <div class="hw-subject" style="${style}">${hw.subject}</div>
            <div class="hw-description">${hw.description}</div>
            ${hw.deadline ? `<div class="hw-deadline">⏳ Дедлайн: ${hw.deadline}</div>` : ''}
          </div>
          <button class="hw-delete" data-id="${hw.id}">🗑️</button>
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;

  // Обработчики
  container.querySelectorAll('.hw-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
      const id = this.dataset.id;
      if (onToggleDone) onToggleDone(id);
    });
  });

  container.querySelectorAll('.hw-delete').forEach(btn => {
    btn.addEventListener('click', function() {
      if (confirm('Удалить задание?')) {
        if (onDelete) onDelete(this.dataset.id);
      }
    });
  });
}