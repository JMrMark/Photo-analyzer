// ocr.js - Enhanced OCR with advanced preprocessing

export async function preprocessImage(file, documentType = 'document', enhance = true) {
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
    for (let i = 0; i < 256; i++) sum += i * histogram[i];

    let sumB = 0;
    let wB = 0;
    let max = 0;
    let threshold = 0;

    for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;

        const wF = total - wB;
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

    return threshold;
}

// Apply local contrast enhancement (similar to CLAHE)
function applyLocalContrastEnhancement(data, width, height, blockSize) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const tempData = new ImageData(data, width);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(tempData, 0, 0);
    const original = ctx.getImageData(0, 0, width, height).data;

    for (let y = 0; y < height; y += blockSize) {
        for (let x = 0; x < width; x += blockSize) {
            const endY = Math.min(y + blockSize, height);
            const endX = Math.min(x + blockSize, width);

            let min = 255, max = 0;
            for (let py = y; py < endY; py++) {
                for (let px = x; px < endX; px++) {
                    const idx = (py * width + px) * 4;
                    const val = original[idx];
                    min = Math.min(min, val);
                    max = Math.max(max, val);
                }
            }

            const range = max - min || 1;
            for (let py = y; py < endY; py++) {
                for (let px = x; px < endX; px++) {
                    const idx = (py * width + px) * 4;
                    const val = original[idx];
                    const enhanced = ((val - min) / range) * 255;
                    data[idx] = enhanced;
                    data[idx + 1] = enhanced;
                    data[idx + 2] = enhanced;
                }
            }
        }
    }
}

// Adaptive binarization using Niblack method
function adaptiveBinarization(data, width, height) {
    const threshold = getOtsuThreshold(data);
    const result = new Uint8ClampedArray(data.length);
    
    const k = 0.15;
    const windowSize = 15;
    const w2 = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i += 4) {
        const y = Math.floor((i / 4) / width);
        const x = (i / 4) % width;

        let sum = 0, count = 0;
        let sumSq = 0;

        for (let dy = -w2; dy <= w2; dy++) {
            for (let dx = -w2; dx <= w2; dx++) {
                const ny = Math.max(0, Math.min(height - 1, y + dy));
                const nx = Math.max(0, Math.min(width - 1, x + dx));
                const idx = ((ny * width + nx) * 4);
                sum += data[idx];
                sumSq += data[idx] * data[idx];
                count++;
            }
        }

        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);
        const stdDev = Math.sqrt(Math.max(0, variance));
        const adaptiveThreshold = mean * (1 - k * (stdDev / 128 - 1));

        const val = data[i] > adaptiveThreshold ? 255 : 0;
        result[i] = val;
        result[i + 1] = val;
        result[i + 2] = val;
        result[i + 3] = data[i + 3];
    }

    return result;
}

// Morphological closing to eliminate small holes
function morphologicalClose(data, width, height) {
    // Dilation
    const dilated = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i++) dilated[i] = data[i];

    const kernel = 1;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0) continue;
        const y = Math.floor((i / 4) / width);
        const x = (i / 4) % width;

        for (let dy = -kernel; dy <= kernel; dy++) {
            for (let dx = -kernel; dx <= kernel; dx++) {
                const ny = Math.max(0, Math.min(height - 1, y + dy));
                const nx = Math.max(0, Math.min(width - 1, x + dx));
                const idx = ((ny * width + nx) * 4);
                dilated[idx] = 255;
                dilated[idx + 1] = 255;
                dilated[idx + 2] = 255;
            }
        }
    }

    return dilated;
}

// Post-process OCR results
function postProcessText(text) {
    // Common OCR error corrections
    const corrections = {
        'l0': '10', // lowercase L followed by 0 -> 10
        'O0': '00', // O followed by 0 -> 00
        'O1': '01',
        'lll': '111',
        '|O': '10',
        '|l': '11',
    };

    let result = text;
    for (const [wrong, right] of Object.entries(corrections)) {
        result = result.replace(new RegExp(wrong, 'g'), right);
    }

    // Remove multiple spaces
    result = result.replace(/\s{2,}/g, ' ');

    return result.trim();
}

export async function recognize(file, documentType = 'document', language = 'ukr+eng', enhance = true) {
    try {
        console.log('Starting enhanced recognition for:', file.name, 'Type:', documentType, 'Enhance:', enhance);
        const processedImage = await preprocessImage(file, documentType, enhance);
        console.log('Image preprocessed');

        let recognitionOptions = { 
            logger: m => console.log(m),
        };

        // Configure based on document type
        switch (documentType) {
            case 'receipt':
                recognitionOptions.tessedit_pageseg_mode = 6; // Uniform block of text
                recognitionOptions.tessedit_char_whitelist = '0123456789.,грн$-+()';
                break;
            case 'handwriting':
                recognitionOptions.tessedit_pageseg_mode = 3; // Automatic page segmentation
                break;
            case 'quality':
                recognitionOptions.tessedit_pageseg_mode = 11; // Sparse text
                break;
            default: // document
                recognitionOptions.tessedit_pageseg_mode = 3; // Automatic
                break;
        }

        console.log('Starting Tesseract recognition with language:', language);
        const { data: { text, confidence } } = await Tesseract.recognize(processedImage, language, recognitionOptions);
        console.log('Recognition complete, confidence:', confidence);

        const processed = postProcessText(text);
        return {
            text: processed,
            confidence: confidence < 0 ? 0 : Math.min(100, Math.max(0, confidence))
        };
    } catch (err) {
        console.error('Recognition error:', err);
        throw err;
    }
}
