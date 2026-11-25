(function () {
  var STORAGE_KEY = 'baby-tracker-theme';
  var META_COLORS = { light: '#f4f6f9', night: '#0b0e13' };
  var mode = null;

  try {
    var stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'night') {
      mode = stored;
    }
  } catch (_err) {
    // Ignore restricted storage access.
  }

  if (mode === null) {
    var prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    mode = prefersDark ? 'night' : 'light';
  }

  var root = document.documentElement;
  root.dataset.theme = mode;

  var metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', META_COLORS[mode]);
  }
})();
