// theme.js
export function applyTheme(theme, selectElement) {
    document.documentElement.setAttribute('data-theme', theme);
    if (selectElement) selectElement.value = theme;
}

export function initTheme(selectElement) {
    const saved = localStorage.getItem('theme') || 'light';
    applyTheme(saved, selectElement);
    selectElement.addEventListener('change', () => {
        const t = selectElement.value;
        applyTheme(t, selectElement);
        localStorage.setItem('theme', t);
    });
}