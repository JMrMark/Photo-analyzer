// Bundle all modules into single file for local development
// For production on Vercel, use the modular version

console.log('OCR App starting...');

// ========== THEME MODULE ==========
function applyTheme(theme) {
    document.body.classList.remove('dark-theme');
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        // Add inline style for dark theme to prevent flash
        const existingStyle = document.querySelector('style[data-theme="dark"]');
        if (!existingStyle) {
            const style = document.createElement('style');
            style.setAttribute('data-theme', 'dark');
            style.textContent = 'body { background-color: #1e1e2f !important; color: #eee !important; } .container { background-color: #2a2a3d !important; }';
            document.head.appendChild(style);
        }
    } else {
        // Remove dark theme inline styles for light theme
        const darkInlineStyles = document.querySelectorAll('style[data-theme="dark"]');
        darkInlineStyles.forEach(style => style.remove());
    }

    const select = document.getElementById('theme-select');
    if (select) select.value = theme;
    console.log('Theme applied:', theme);
}

function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
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

function initGoogleLogin(clientId, btnElement, userInfoElem, quotaElem) {
    function handleGoogleResponse(response) {
        if (response.credential) {
            userState.isVIP = true;
            userInfoElem.textContent = '(VIP)';
            quotaElem.textContent = 'VIP: необмежено';
            console.log('User signed in as VIP');
        }
    }

    // Load Google script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        console.log('Google Sign-In script loaded');
        if (window.google) {
            google.accounts.id.initialize({
                client_id: clientId,
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

                    // Upscale if image is too small
                    const minSize = 500;
                    let scale = 1;
                    if (img.width < minSize || img.height < minSize) {
                        scale = Math.ceil(minSize / Math.min(img.width, img.height));
                    }

                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    let data = imageData.data;

                    // Enhanced preprocessing
                    if (enhance) {
                        // Step 1: Convert to grayscale with proper luminosity formula
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];
                            // Proper luminosity formula
                            const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                            data[i] = gray;
                            data[i + 1] = gray;
                            data[i + 2] = gray;
                        }

                        // Step 2: Apply CLAHE-like contrast enhancement
                        const blockSize = 32;
                        applyLocalContrastEnhancement(data, canvas.width, canvas.height, blockSize);

                        // Step 3: Adaptive binarization instead of global threshold
                        data = adaptiveBinarization(data, canvas.width, canvas.height);

                        // Step 4: Morphological operations to clean noise
                        data = morphologicalClose(data, canvas.width, canvas.height);
                    } else {
                        // Simple preprocessing for speed
                        // Grayscale
                        for (let i = 0; i < data.length; i += 4) {
                            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                            data[i] = gray;
                            data[i + 1] = gray;
                            data[i + 2] = gray;
                        }

                        // Simple contrast
                        const contrast = 1.2;
                        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                        for (let i = 0; i < data.length; i += 4) {
                            data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
                            data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
                            data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
                        }

                        // Simple global threshold
                        const threshold = getOtsuThreshold(data);
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

// Get Otsu threshold for optimal binarization
function getOtsuThreshold(data) {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
    }

    const total = data.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let mB;
    let mF;
    let max = 0;
    let threshold = 0;
    let between;
    let variance;

    for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB == 0) continue;
        wF = total - wB;
        if (wF == 0) break;
        sumB += i * histogram[i];
        mB = sumB / wB;
        mF = (sum - sumB) / wF;
        between = wB * wF * (mB - mF) * (mB - mF);
        if (between > max) {
            max = between;
            threshold = i;
        }
    }
    return threshold;
}

// Apply local contrast enhancement (CLAHE-like)
function applyLocalContrastEnhancement(data, width, height, blockSize) {
    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            const startX = bx * blockSize;
            const startY = by * blockSize;
            const endX = Math.min(startX + blockSize, width);
            const endY = Math.min(startY + blockSize, height);

            // Calculate local histogram
            const localHist = new Array(256).fill(0);
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * width + x) * 4;
                    localHist[data[idx]]++;
                }
            }

            // Apply CLAHE transformation
            const cdf = new Array(256);
            cdf[0] = localHist[0];
            for (let i = 1; i < 256; i++) {
                cdf[i] = cdf[i - 1] + localHist[i];
            }

            const cdfMin = Math.min(...cdf.filter(v => v > 0));
            const cdfMax = cdf[255];
            const clipLimit = (endX - startX) * (endY - startY) * 0.1;

            // Clip histogram
            let clipped = 0;
            for (let i = 0; i < 256; i++) {
                if (localHist[i] > clipLimit) {
                    clipped += localHist[i] - clipLimit;
                    localHist[i] = clipLimit;
                }
            }

            // Redistribute clipped pixels
            const bonus = clipped / 256;
            for (let i = 0; i < 256; i++) {
                localHist[i] += bonus;
            }

            // Recalculate CDF
            cdf[0] = localHist[0];
            for (let i = 1; i < 256; i++) {
                cdf[i] = cdf[i - 1] + localHist[i];
            }

            // Apply transformation
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = (y * width + x) * 4;
                    const val = data[idx];
                    data[idx] = data[idx + 1] = data[idx + 2] = Math.round(((cdf[val] - cdfMin) / (cdfMax - cdfMin)) * 255);
                }
            }
        }
    }
}

// Adaptive binarization using Niblack's method
function adaptiveBinarization(data, width, height) {
    const windowSize = 15;
    const k = -0.2;
    const output = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;

            // Calculate local mean and std dev
            let sum = 0;
            let sumSq = 0;
            let count = 0;

            const half = Math.floor(windowSize / 2);
            for (let wy = Math.max(0, y - half); wy <= Math.min(height - 1, y + half); wy++) {
                for (let wx = Math.max(0, x - half); wx <= Math.min(width - 1, x + half); wx++) {
                    const widx = (wy * width + wx) * 4;
                    const val = data[widx];
                    sum += val;
                    sumSq += val * val;
                    count++;
                }
            }

            const mean = sum / count;
            const variance = (sumSq / count) - (mean * mean);
            const std = Math.sqrt(Math.max(0, variance));
            const threshold = mean + k * std;

            const val = data[idx] > threshold ? 255 : 0;
            output[idx] = output[idx + 1] = output[idx + 2] = val;
            output[idx + 3] = 255;
        }
    }

    return output;
}

// Morphological close operation to remove noise
function morphologicalClose(data, width, height) {
    const output = new Uint8ClampedArray(data.length);

    // Dilation followed by erosion
    const temp = morphologicalDilate(data, width, height);
    return morphologicalErode(temp, width, height);
}

function morphologicalDilate(data, width, height) {
    const output = new Uint8ClampedArray(data.length);
    const kernel = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let max = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    max = Math.max(max, data[idx]);
                }
            }
            const idx = (y * width + x) * 4;
            output[idx] = output[idx + 1] = output[idx + 2] = max;
            output[idx + 3] = 255;
        }
    }

    return output;
}

function morphologicalErode(data, width, height) {
    const output = new Uint8ClampedArray(data.length);
    const kernel = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let min = 255;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    min = Math.min(min, data[idx]);
                }
            }
            const idx = (y * width + x) * 4;
            output[idx] = output[idx + 1] = output[idx + 2] = min;
            output[idx + 3] = 255;
        }
    }

    return output;
}

async function recognize(file, lang = 'ukr+eng', documentType = 'document') {
    try {
        console.log('Starting OCR recognition...');

        // Preprocess image
        const processedBlob = await preprocessImage(file, documentType, true);
        console.log('Image preprocessing completed');

        // Load Tesseract
        if (!window.Tesseract) {
            throw new Error('Tesseract.js not loaded');
        }

        const result = await window.Tesseract.recognize(processedBlob, lang, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    window.updateProgress && window.updateProgress(Math.round(m.progress * 100));
                }
            }
        });

        console.log('OCR recognition completed');
        return result.data.text;
    } catch (error) {
        console.error('OCR recognition failed:', error);
        throw error;
    }
}

// ========== MAIN MODULE ==========

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
initTheme();
updateQuotaDisplay(quotaMsgDiv);
setInterval(() => updateQuotaDisplay(quotaMsgDiv), 10000);

// Get Google Client ID - REPLACE THIS WITH YOUR ACTUAL GOOGLE CLIENT ID
const googleClientId = 'YOUR_GOOGLE_CLIENT_ID'; // ← ЗАМІНІТЬ НА РЕАЛЬНИЙ CLIENT ID З GOOGLE CLOUD CONSOLE
initGoogleLogin(googleClientId, loginBtn, userInfoSpan, quotaMsgDiv);

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    console.log('Handling files:', files.length);

    // Check quota
    if (!canUpload(files.length)) {
        alert('Недостатньо спроб. Увійдіть як VIP або зачекайте поповнення квоти.');
        return;
    }

    // Show loading
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    resetProgress();

    try {
        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`Processing file ${i + 1}/${files.length}:`, file.name);

            const lang = document.getElementById('lang-select')?.value || 'ukr+eng';
            const model = modelSelect?.value || 'document';

            const text = await recognize(file, lang, model);
            results.push(text);
        }

        const combinedText = results.join('\n\n--- Новий файл ---\n\n');
        textOutput.value = combinedText;
        resultDiv.style.display = 'block';

        console.log('All files processed successfully');
    } catch (error) {
        console.error('Error processing files:', error);
        alert('Помилка при обробці файлів: ' + error.message);
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Event listeners
dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(Array.from(e.target.files));
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    handleFiles(files);
});

// Clipboard paste support
document.addEventListener('paste', (e) => {
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

// Result controls
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