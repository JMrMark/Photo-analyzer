const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultDiv = document.getElementById('result');
const textOutput = document.getElementById('text-output');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const modelSelect = document.getElementById('model-select');
const themeSelect = document.getElementById('theme-select');
const loadingDiv = document.getElementById('loading');

// user/quota state
let isVIP = false;
const userInfoSpan = document.getElementById('status-msg');
const quotaMsgDiv = document.getElementById('quota-msg');

const QUOTA_LIMIT = 5; // free user simultaneous
const REFILL_INTERVAL = 5 * 60 * 1000; // 5 minutes in ms

function loadQuota() {
    const data = JSON.parse(localStorage.getItem('quota') || '{}');
    return {
        tokens: data.tokens != null ? data.tokens : QUOTA_LIMIT,
        lastRefill: data.lastRefill || Date.now()
    };
}

function saveQuota(q) {
    localStorage.setItem('quota', JSON.stringify(q));
}

function refillQuota() {
    const q = loadQuota();
    const now = Date.now();
    const elapsed = now - q.lastRefill;
    const intervals = Math.floor(elapsed / REFILL_INTERVAL);
    if (intervals > 0) {
        q.tokens = Math.min(QUOTA_LIMIT, q.tokens + intervals);
        q.lastRefill += intervals * REFILL_INTERVAL;
        saveQuota(q);
    }
    return q;
}

function canUpload(count=1) {
    if (isVIP) return true;
    const q = refillQuota();
    if (q.tokens >= count) {
        q.tokens -= count;
        saveQuota(q);
        return true;
    }
    return false;
}

function updateQuotaDisplay() {
    if (isVIP) {
        quotaMsgDiv.textContent = 'VIP: необмежено';
    } else {
        const q = refillQuota();
        let msg = `Доступні спроби: ${q.tokens}`;
        if (q.tokens < QUOTA_LIMIT) {
            const nextIn = REFILL_INTERVAL - (Date.now() - q.lastRefill);
            const mins = Math.ceil(nextIn / 60000);
            msg += `. Наступна за ${mins} хв.`;
        }
        quotaMsgDiv.textContent = msg;
    }
}

// call periodically to refresh message
setInterval(updateQuotaDisplay, 10000);
updateQuotaDisplay();

// Google sign-in setup (using Identity Services)
const loginBtn = document.getElementById('login-btn');

function handleGoogleResponse(response) {
    // simple VIP flag, not verifying token here for demo
    if (response.credential) {
        isVIP = true;
        userInfoSpan.textContent = '(VIP)';
        quotaMsgDiv.textContent = 'VIP: необмежено';
    }
}

// load Google script
(function(){
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
        google.accounts.id.initialize({
            client_id: 'YOUR_GOOGLE_CLIENT_ID',
            callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(loginBtn, { theme: 'outline', size: 'small' });
    };
    document.head.appendChild(script);
})();

// initialize theme from storage or default
function applyTheme(theme) {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    themeSelect.value = theme;
}

// batch handler for multiple files with quota enforcement
function handleFiles(files) {
    if (!files.length) return;
    const count = files.length;
    if (!canUpload(count)) {
        alert('Перевищено ліміт. Зачекайте або увійдіть у Google для VIP-доступу.');
        updateQuotaDisplay();
        return;
    }

    // clear previous results when starting a new batch
    textOutput.value = '';
    resultDiv.style.display = 'none';

    // process sequentially and append results
    (async () => {
        for (const file of files) {
            await processImage(file);
        }
    })();
}


const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeSelect.addEventListener('change', () => {
    const t = themeSelect.value;
    applyTheme(t);
    localStorage.setItem('theme', t);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) {
        handleFiles(files);
    } else {
        alert('Будь ласка, виберіть зображення.');
    }
});

async function preprocessImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image
            ctx.drawImage(img, 0, 0);

            // Get image data
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;

            // Convert to grayscale
            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = gray;     // Red
                data[i + 1] = gray; // Green
                data[i + 2] = gray; // Blue
            }

            // Increase contrast
            const contrast = 1.5; // Adjust as needed
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            for (let i = 0; i < data.length; i += 4) {
                data[i] = factor * (data[i] - 128) + 128;
                data[i + 1] = factor * (data[i + 1] - 128) + 128;
                data[i + 2] = factor * (data[i + 2] - 128) + 128;
            }

            // Apply threshold for binarization
            const threshold = 128;
            for (let i = 0; i < data.length; i += 4) {
                const brightness = data[i];
                const newValue = brightness > threshold ? 255 : 0;
                data[i] = newValue;
                data[i + 1] = newValue;
                data[i + 2] = newValue;
            }

            // Put back the image data
            ctx.putImageData(imageData, 0, 0);

            // Convert to blob
            canvas.toBlob(resolve, 'image/png');
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

async function processImage(file) {
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';

    try {
        // Preprocess the image for better OCR
        const processedImage = await preprocessImage(file);

        // Choose recognition strategy based on selected model
        const model = modelSelect.value;
        let recognitionOptions = { logger: m => console.log(m) };

        if (model === 'fast') {
            recognitionOptions = {
                ...recognitionOptions,
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // example config
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            };
        } else if (model === 'custom') {
            // custom model could apply different languages or config
            recognitionOptions = {
                ...recognitionOptions,
                lang: 'ukr',
                tessedit_char_blacklist: '!?@#$%^&*()'
            };
        }

        const { data: { text } } = await Tesseract.recognize(processedImage, 'ukr+eng', recognitionOptions);

        // append each file result
        textOutput.value += `\n\n=== ${file.name} ===\n` + text;
        resultDiv.style.display = 'block';
    } catch (error) {
        console.error(error);
        alert('Помилка при аналізі фото: ' + error.message);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

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