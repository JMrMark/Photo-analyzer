const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultDiv = document.getElementById('result');
const textOutput = document.getElementById('text-output');
const downloadBtn = document.getElementById('download-btn');
const loadingDiv = document.getElementById('loading');

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processImage(file);
    }
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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        processImage(file);
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

        const { data: { text } } = await Tesseract.recognize(processedImage, 'ukr+eng', {
            logger: m => console.log(m)
        });

        textOutput.value = text;
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