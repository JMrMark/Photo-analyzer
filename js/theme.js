// theme.js
export function applyTheme(theme, selectElement) {
    document.body.classList.remove('dark-theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
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