export function applyTheme(theme) {
  document.body.classList.toggle('dark-theme', theme === 'dark');
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

export function getSavedTheme() {
  return localStorage.getItem('theme') || 'light';
}