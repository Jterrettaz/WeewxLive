/* WeewxLive — theme selector */
(function () {
  const key = 'weewxlive-theme';
  const themes = ['light', 'dark', 'navy'];

  function savedTheme() {
    try {
      const value = localStorage.getItem(key);
      return themes.includes(value) ? value : 'light';
    } catch (_) {
      return 'light';
    }
  }

  const current = savedTheme();
  document.documentElement.setAttribute('data-theme', current);

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('theme-select')) return;

    const select = document.createElement('select');
    select.id = 'theme-select';
    const labels = {
      en: ['Theme', 'Light', 'Dark', 'Navy'],
      fr: ['Thème', 'Clair', 'Sombre', 'Marine'],
      de: ['Design', 'Hell', 'Dunkel', 'Marineblau'],
      it: ['Tema', 'Chiaro', 'Scuro', 'Blu notte'],
      pl: ['Motyw strony', 'Jasny', 'Ciemny', 'Granatowy']
    };

    const lang = document.documentElement.lang.toLowerCase().split('-')[0];
    const t = labels[lang] || labels.en;
    select.setAttribute('aria-label', t[0]);

    const names = {
      light: '☀ ' + t[1],
      dark: '🌙 ' + t[2],
      navy: '🌌 ' + t[3]
    };

    themes.forEach(function (theme) {
      const option = document.createElement('option');
      option.value = theme;
      option.textContent = names[theme];
      select.appendChild(option);
    });

    select.value = current;

    select.addEventListener('change', function () {
      document.documentElement.setAttribute('data-theme', select.value);
      try {
        localStorage.setItem(key, select.value);
      } catch (_) {}
    });

    select.style.cssText =
      'padding:7px 10px;border-radius:8px;' +
      'background:var(--surface);color:var(--text);' +
      'border:1px solid var(--border);cursor:pointer;';

    const target = document.querySelector('.top .status')
                || document.querySelector('.top')
                || document.body;

    target.appendChild(select);
  });
})();
