// Управление глобальным состоянием приложения
export class AppState {
  constructor() {
    this.weekNumber = 1;
    this.filterToday = false;
    this.theme = 'light';
    this.activeTab = 'schedule';
    this.listeners = [];
  }

  setWeekNumber(value) {
    this.weekNumber = value;
    this.notify();
  }

  toggleFilterToday() {
    this.filterToday = !this.filterToday;
    this.notify();
  }

  setTheme(theme) {
    this.theme = theme;
    this.notify();
  }

  setActiveTab(tab) {
    this.activeTab = tab;
    this.notify();
  }

  subscribe(fn) {
    this.listeners.push(fn);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }
}