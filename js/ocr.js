// ocr.js
// functions for preprocessing and recognizing images with Tesseract

export async function preprocessImage(file) {
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

export async function recognize(file, model) {
    const processedImage = await preprocessImage(file);
    let recognitionOptions = { logger: m => console.log(m) };

    if (model === 'fast') {
        recognitionOptions = {
            ...recognitionOptions,
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        };
    } else if (model === 'custom') {
        recognitionOptions = {
            ...recognitionOptions,
            lang: 'ukr',
            tessedit_char_blacklist: '!?@#$%^&*()'
        };
    }

    const { data: { text } } = await Tesseract.recognize(processedImage, 'ukr+eng', recognitionOptions);
    return text;
}