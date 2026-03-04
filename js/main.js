// main.js - entry point, ties UI with logic
import { recognize } from './ocr.js';
import { canUpload, updateQuotaDisplay, initGoogleLogin, REFILL_INTERVAL } from './auth.js';
import { initTheme } from './theme.js';

console.log('Main module loading...');

// Progress functions
function updateProgress(percent) {
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = percent + '%';
    }
}

function resetProgress() {
    updateProgress(0);
}

// Make functions global for ocr.js module
window.updateProgress = updateProgress;
window.resetProgress = resetProgress;
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultDiv = document.getElementById('result');
const textOutput = document.getElementById('text-output');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const modelSelect = document.getElementById('model-select');
const themeSelect = document.getElementById('theme-select');
const loadingDiv = document.getElementById('loading');

const userInfoSpan = document.getElementById('status-msg');
const quotaMsgDiv = document.getElementById('quota-msg');
const loginBtn = document.getElementById('login-btn');

// Verify all elements loaded
if (!dropZone || !fileInput) {
    console.error('Critical DOM elements not found!');
}

console.log('DOM elements loaded, initializing...');

// Initialize features
initTheme(themeSelect);
updateQuotaDisplay(quotaMsgDiv);
setInterval(() => updateQuotaDisplay(quotaMsgDiv), 10000);
initGoogleLogin('YOUR_GOOGLE_CLIENT_ID', loginBtn, userInfoSpan, quotaMsgDiv);

function handleFiles(files) {
    if (!files.length) return;
    
    console.log('Handling files:', files.length);
    
    const count = files.length;
    if (!canUpload(count)) {
        alert('Перевищено ліміт. Зачекайте або увійдіть у Google для VIP-доступу.');
        updateQuotaDisplay(quotaMsgDiv);
        return;
    }

    textOutput.value = '';
    resultDiv.style.display = 'none';
    if (loadingDiv) loadingDiv.style.display = 'block';
    resetProgress(); // Reset progress at start

    const documentType = modelSelect.value;
    const languageSelectEl = document.getElementById('language-select');
    const enhanceCheckboxEl = document.getElementById('enhance-checkbox');
    const language = languageSelectEl ? languageSelectEl.value : 'ukr+eng';
    const enhance = enhanceCheckboxEl ? enhanceCheckboxEl.checked : true;

    (async () => {
        try {
            for (const file of files) {
                console.log('Processing file:', file.name, 'Type:', documentType, 'Lang:', language, 'Enhance:', enhance);
                const result = await recognize(file, documentType, language, enhance);
                const confidence = result.confidence ? `[${result.confidence.toFixed(1)}%]` : '';
                textOutput.value += `\n\n=== ${file.name} ${confidence} ===\n` + result.text;
                resultDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Error processing files:', error);
            alert('Помилка при обробці: ' + error.message);
        } finally {
            updateProgress(100); // Complete progress
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    })();
}

// Event bindings
console.log('Setting up event listeners...');

dropZone.addEventListener('click', () => {
    console.log('Drop zone clicked');
    fileInput.click();
});

fileInput.addEventListener('change', e => {
    console.log('Files selected via input');
    handleFiles(Array.from(e.target.files));
});

dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    console.log('Files dropped:', files.length);
    if (files.length) {
        handleFiles(files);
    } else {
        alert('Будь ласка, виберіть зображення.');
    }
});

downloadBtn.addEventListener('click', () => {
    console.log('Download clicked');
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
    console.log('Clear clicked');
    textOutput.value = '';
    resultDiv.style.display = 'none';
});

// Paste from clipboard support
document.addEventListener('paste', async e => {
    e.preventDefault();
    console.log('Paste event detected');

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
    if (!imageItems.length) {
        console.log('No images found in clipboard');
        return;
    }

    console.log('Found images in clipboard:', imageItems.length);

    try {
        const files = [];
        for (const item of imageItems) {
            const blob = item.getAsFile();
            if (blob) {
                // Create a File object with a generated name
                const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
                files.push(file);
            }
        }

        if (files.length) {
            console.log('Processing pasted images:', files.length);
            handleFiles(files);
        }
    } catch (error) {
        console.error('Error processing pasted images:', error);
        alert('Помилка при обробці вставленого зображення: ' + error.message);
    }
});

console.log('Main module initialized successfully!');
