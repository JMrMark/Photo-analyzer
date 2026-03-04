// theme.js
export function applyTheme(theme, selectElement) {
    document.body.classList.remove('dark-theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        // Add inline style for dark theme to prevent flash
        const existingStyle = document.querySelector('style[data-theme="dark"]');
        if (!existingStyle) {
            const style = document.createElement('style');
            style.setAttribute('data-theme', 'dark');
            style.textContent = 'body { background-color: #1e1e2f !important; color: #eee !important; }';
            document.head.appendChild(style);
        }
    } else {
        // Remove dark theme inline styles for light theme
        const darkInlineStyles = document.querySelectorAll('style[data-theme="dark"]');
        darkInlineStyles.forEach(style => style.remove());
    }
    if (selectElement) selectElement.value = theme;
}

export function initTheme(selectElement) {
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved, selectElement);
    selectElement.addEventListener('change', () => {
        const t = selectElement.value;
        applyTheme(t, selectElement);
        localStorage.setItem('theme', t);
    });
}