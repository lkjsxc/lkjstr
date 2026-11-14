// Runs before the first paint (a classic script in <head>): the saved theme and language, so nothing flashes.
try {
  const s = JSON.parse(localStorage.getItem('lkjstr:settings') ?? '{}') as {
    theme?: string;
    language?: string;
  };
  const root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  const lang =
    s.language === 'ja' || s.language === 'en'
      ? s.language
      : navigator.language.startsWith('ja')
        ? 'ja'
        : 'en';
  root.lang = lang;
} catch {
  // storage blocked: system theme, browser language
}
