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

async function processImage(file) {
    loadingDiv.style.display = 'block';
    resultDiv.style.display = 'none';

    try {
        const { data: { text } } = await Tesseract.recognize(file, 'ukr+eng', {
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