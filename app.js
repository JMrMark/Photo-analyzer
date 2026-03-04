// Bundle all modules into single file for local development
// For production on Vercel, use the modular version

console.log('OCR App starting...');

// ========== THEME MODULE ==========
function applyTheme(theme) {
    document.body.classList.remove('dark-theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
    console.log('Theme applied:', theme);
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    applyTheme(saved);
    const select = document.getElementById('theme-select');
    if (select) {
        select.addEventListener('change', () => {
            applyTheme(select.value);
            localStorage.setItem('theme', select.value);
        });
    }
}

// ========== AUTH MODULE ==========
let userState = { isVIP: false };
const QUOTA_LIMIT = 5;
const REFILL_INTERVAL = 5 * 60 * 1000;

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

function canUpload(count = 1) {
    if (userState.isVIP) return true;
    const q = refillQuota();
    if (q.tokens >= count) {
        q.tokens -= count;
        saveQuota(q);
        return true;
    }
    return false;
}

function updateQuotaDisplay(quotaElem) {
    if (userState.isVIP) {
        quotaElem.textContent = 'VIP: необмежено';
    } else {
        const q = refillQuota();
        let msg = `Доступні спроби: ${q.tokens}`;
        if (q.tokens < QUOTA_LIMIT) {
            const nextIn = REFILL_INTERVAL - (Date.now() - q.lastRefill);
            const mins = Math.ceil(nextIn / 60000);
            msg += `. Наступна за ${mins} хв.`;
        }
        quotaElem.textContent = msg;
    }
}

function initGoogleLogin(btnElement, userInfoElem, quotaElem) {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        console.log('Google Sign-In loaded');
        if (window.google) {
            function handleGoogleResponse(response) {
                if (response.credential) {
                    userState.isVIP = true;
                    userInfoElem.textContent = '(VIP)';
                    quotaElem.textContent = 'VIP: необмежено';
                    console.log('User signed in as VIP');
                }
            }
            google.accounts.id.initialize({
                client_id: 'YOUR_GOOGLE_CLIENT_ID',
                callback: handleGoogleResponse
            });
            google.accounts.id.renderButton(btnElement, { theme: 'outline', size: 'small' });
        }
    };
    document.head.appendChild(script);
}

// ========== OCR MODULE ==========
async function preprocessImage(file, documentType = 'document', enhance = true) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let scale = 1;
                    const minSize = 500;
                    if (img.width < minSize || img.height < minSize) {
                        scale = Math.ceil(minSize / Math.min(img.width, img.height));
                    }
                    
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let data = imageData.data;

                    if (enhance) {
                        // Grayscale
                        for (let i = 0; i < data.length; i += 4) {
                            const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
                            data[i] = gray;
                            data[i + 1] = gray;
                            data[i + 2] = gray;
                        }

                        // Adaptive contrast
                        const blockSize = 32;
                        const width = canvas.width;
                        const height = canvas.height;
                        for (let by = 0; by < height; by += blockSize) {
                            for (let bx = 0; bx < width; bx += blockSize) {
                                const endY = Math.min(by + blockSize, height);
                                const endX = Math.min(bx + blockSize, width);

                                let min = 255, max = 0;
                                for (let py = by; py < endY; py++) {
                                    for (let px = bx; px < endX; px++) {
                                        const idx = (py * width + px) * 4;
                                        const val = data[idx];
                                        min = Math.min(min, val);
                                        max = Math.max(max, val);
                                    }
                                }

                                const range = max - min || 1;
                                for (let py = by; py < endY; py++) {
                                    for (let px = bx; px < endX; px++) {
                                        const idx = (py * width + px) * 4;
                                        const val = data[idx];
                                        const enhanced = ((val - min) / range) * 255;
                                        data[idx] = enhanced;
                                        data[idx + 1] = enhanced;
                                        data[idx + 2] = enhanced;
                                    }
                                }
                            }
                        }

                        // Otsu threshold
                        const histogram = new Array(256).fill(0);
                        for (let i = 0; i < data.length; i += 4) {
                            histogram[data[i]]++;
                        }

                        let threshold = 128;
                        let sum = 0;
                        for (let i = 0; i < 256; i++) sum += i * histogram[i];

                        let sumB = 0, wB = 0, max = 0;
                        for (let i = 0; i < 256; i++) {
                            wB += histogram[i];
                            if (wB === 0) continue;
                            const wF = data.length / 4 - wB;
                            if (wF === 0) break;
                            sumB += i * histogram[i];
                            const mB = sumB / wB;
                            const mF = (sum - sumB) / wF;
                            const between = wB * wF * Math.pow(mB - mF, 2);
                            if (between > max) {
                                max = between;
                                threshold = i;
                            }
                        }

                        // Binarization
                        for (let i = 0; i < data.length; i += 4) {
                            const val = data[i] > threshold ? 255 : 0;
                            data[i] = val;
                            data[i + 1] = val;
                            data[i + 2] = val;
                        }
                    } else {
                        // Simple preprocessing
                        for (let i = 0; i < data.length; i += 4) {
                            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                            data[i] = gray;
                            data[i + 1] = gray;
                            data[i + 2] = gray;
                        }

                        const contrast = 1.2;
                        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                        for (let i = 0; i < data.length; i += 4) {
                            data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
                            data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
                            data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
                        }

                        const threshold = 128;
                        for (let i = 0; i < data.length; i += 4) {
                            const val = data[i] > threshold ? 255 : 0;
                            data[i] = val;
                            data[i + 1] = val;
                            data[i + 2] = val;
                        }
                    }

                    ctx.putImageData(imageData, 0, 0);
                    canvas.toBlob(resolve, 'image/png');
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        } catch (err) {
            reject(err);
        }
    });
}

async function recognize(file, documentType = 'document', language = 'ukr+eng', enhance = true) {
    try {
        console.log('Advanced recognition:', file.name, 'Type:', documentType);
        const processedImage = await preprocessImage(file, documentType, enhance);
        
        let recognitionOptions = { logger: m => console.log(m) };

        switch (documentType) {
            case 'receipt':
                recognitionOptions.tessedit_pageseg_mode = 6;
                break;
            case 'handwriting':
                recognitionOptions.tessedit_pageseg_mode = 3;
                break;
            case 'quality':
                recognitionOptions.tessedit_pageseg_mode = 11;
                break;
            default:
                recognitionOptions.tessedit_pageseg_mode = 3;
        }

        console.log('Recognition with language:', language);
        const { data: { text, confidence } } = await Tesseract.recognize(processedImage, language, recognitionOptions);
        
        // Post-process text
        let processed = text
            .replace(/\s{2,}/g, ' ')
            .trim();

        return {
            text: processed,
            confidence: Math.max(0, Math.min(100, confidence || 0))
        };
    } catch (err) {
        console.error('Recognition error:', err);
        throw err;
    }
}

// ========== MAIN APP ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready, initializing app...');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultDiv = document.getElementById('result');
    const textOutput = document.getElementById('text-output');
    const downloadBtn = document.getElementById('download-btn');
    const clearBtn = document.getElementById('clear-btn');
    const modelSelect = document.getElementById('model-select');
    const themeSelect = document.getElementById('theme-select');
    const languageSelect = document.getElementById('language-select');
    const enhanceCheckbox = document.getElementById('enhance-checkbox');
    const loadingDiv = document.getElementById('loading');
    const userInfoSpan = document.getElementById('status-msg');
    const quotaMsgDiv = document.getElementById('quota-msg');
    const loginBtn = document.getElementById('login-btn');

    if (!dropZone) {
        console.error('Critical elements not found!');
        return;
    }

    // Initialize
    initTheme();
    updateQuotaDisplay(quotaMsgDiv);
    setInterval(() => updateQuotaDisplay(quotaMsgDiv), 10000);
    initGoogleLogin(loginBtn, userInfoSpan, quotaMsgDiv);

    function handleFiles(files) {
        if (!files.length) return;
        console.log('Handling files:', files.length);
        
        if (!canUpload(files.length)) {
            alert('Перевищено ліміт. Зачекайте або увійдіть у Google для VIP-доступу.');
            updateQuotaDisplay(quotaMsgDiv);
            return;
        }

        textOutput.value = '';
        resultDiv.style.display = 'none';
        if (loadingDiv) loadingDiv.style.display = 'block';

        const documentType = modelSelect.value;
        const language = languageSelect.value;
        const enhance = enhanceCheckbox.checked;

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
                console.error('Error:', error);
                alert('Помилка: ' + error.message);
            } finally {
                if (loadingDiv) loadingDiv.style.display = 'none';
            }
        })();
    }

    // Events
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => handleFiles(Array.from(e.target.files)));

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) handleFiles(files);
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

    console.log('App initialized successfully!');
});
