// main.js - entry point, ties UI with logic
import { recognize } from './ocr.js';
import { canUpload, updateQuotaDisplay, initGoogleLogin, REFILL_INTERVAL } from './auth.js';
import { initTheme } from './theme.js';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultDiv = document.getElementById('result');
const textOutput = document.getElementById('text-output');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const modelSelect = document.getElementById('model-select');
const themeSelect = document.getElementById('theme-select');

const userInfoSpan = document.getElementById('status-msg');
const quotaMsgDiv = document.getElementById('quota-msg');
const loginBtn = document.getElementById('login-btn');

initTheme(themeSelect);
updateQuotaDisplay(quotaMsgDiv);
setInterval(() => updateQuotaDisplay(quotaMsgDiv), 10000);
initGoogleLogin('YOUR_GOOGLE_CLIENT_ID', loginBtn, userInfoSpan, quotaMsgDiv);

function handleFiles(files) {
    if (!files.length) return;
    const count = files.length;
    if (!canUpload(count)) {
        alert('Перевищено ліміт. Зачекайте або увійдіть у Google для VIP-доступу.');
        updateQuotaDisplay(quotaMsgDiv);
        return;
    }

    textOutput.value = '';
    resultDiv.style.display = 'none';

    (async () => {
        for (const file of files) {
            const text = await recognize(file, modelSelect.value);
            textOutput.value += `\n\n=== ${file.name} ===\n` + text;
            resultDiv.style.display = 'block';
        }
    })();
}

// event bindings

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFiles(Array.from(e.target.files)));

[dropZone].forEach(zone => {
    zone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) handleFiles(files);
        else alert('Будь ласка, виберіть зображення.');
    });
});


downloadBtn.addEventListener('click', () => {
    const text = textOutput.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analyzed_text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', () => {
    textOutput.value = '';
    resultDiv.style.display = 'none';
});
