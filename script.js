const video = document.getElementById('webcam');
const captureArea = document.getElementById('capture-area');
const elementsLayer = document.getElementById('elements-layer');
const bgColorPicker = document.getElementById('bg-color-picker');
const customCols = document.getElementById('custom-cols');
const customRows = document.getElementById('custom-rows');
const canvasW = document.getElementById('canvas-w');
const canvasH = document.getElementById('canvas-h');
const toggleFrame = document.getElementById('toggle-frame');

let selectedElement = null;
let zCounter = 100;
let photoCount = 0;

// --- 1. LIVE CANVAS RESIZE ---
function updateCanvasSize() {
    captureArea.style.width = canvasW.value + 'px';
    captureArea.style.height = canvasH.value + 'px';
}
canvasW.oninput = updateCanvasSize;
canvasH.oninput = updateCanvasSize;
updateCanvasSize(); // Init

// --- 2. CAMERA INIT ---
navigator.mediaDevices.getUserMedia({ video: true }).then(s => video.srcObject = s);

// --- 3. DYNAMIC GRID LOGIC ---
function getGridPosition(index) {
    const cols = parseInt(customCols.value) || 1;
    const rows = parseInt(customRows.value) || 1;
    const currentW = parseInt(canvasW.value);
    const currentH = parseInt(canvasH.value);
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    const padding = 30;
    const gap = 15;
    const w = (currentW - (padding * 2) - (gap * (cols - 1))) / cols;
    const h = (currentH - (padding * 2) - (gap * (rows - 1))) / rows;

    return { x: padding + (col * (w + gap)), y: padding + (row * (h + gap)), w: w, h: h };
}

// --- 4. CAPTURE & LAYER ---
document.getElementById('btn-capture').onclick = () => {
    let t = 3;
    const cd = document.getElementById('countdown');
    cd.classList.remove('hidden');
    const interval = setInterval(() => {
        cd.innerText = t || "CHEESE!";
        if (t < 0) {
            clearInterval(interval);
            cd.classList.add('hidden');
            const pos = getGridPosition(photoCount);
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = video.videoWidth; 
            tempCanvas.height = video.videoHeight;
            const ctx = tempCanvas.getContext('2d');
            ctx.translate(tempCanvas.width, 0); ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0);

            createLayer(tempCanvas.toDataURL(), 'photo', pos.x, pos.y, pos.w);
            photoCount++;
        }
        t--;
    }, 1000);
};

function createLayer(content, type, x = 50, y = 50, width = 100) {
    const el = document.createElement('div');
    el.className = 'layer' + (type === 'photo' && toggleFrame.checked ? ' with-frame' : '');
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = width + 'px';
    el.style.zIndex = zCounter++;
    el.dataset.rotation = 0; el.dataset.scale = 1;

    if (type === 'photo') {
        const img = document.createElement('img'); img.src = content;
        el.appendChild(img);
    } else {
        el.innerText = content;
        el.style.fontSize = width + 'px'; el.style.color = 'white';
        el.style.whiteSpace = 'nowrap';
    }

    // INTERACTION LOGIC
    el.onmousedown = (e) => {
        if (selectedElement) selectedElement.classList.remove('selected');
        selectedElement = el;
        selectedElement.classList.add('selected');
        document.getElementById('active-tools').classList.remove('hidden');
        document.getElementById('empty-msg').classList.add('hidden');

        let offsetX = e.clientX - el.offsetLeft;
        let offsetY = e.clientY - el.offsetTop;

        document.onmousemove = (me) => {
            el.style.left = (me.clientX - offsetX) + 'px';
            el.style.top = (me.clientY - offsetY) + 'px';
        };
        document.onmouseup = () => document.onmousemove = null;
    };

    el.onwheel = (e) => {
        if (selectedElement !== el) return;
        e.preventDefault();
        let s = parseFloat(el.dataset.scale);
        let r = parseInt(el.dataset.rotation);
        if (e.altKey) r += e.deltaY > 0 ? 5 : -5;
        else s += e.deltaY > 0 ? -0.05 : 0.05;
        el.dataset.scale = s; el.dataset.rotation = r;
        el.style.transform = `rotate(${r}deg) scale(${s})`;
    };

    elementsLayer.appendChild(el);
}

// --- 5. EDITOR TOOLS ---
document.getElementById('add-text').onclick = () => {
    const t = document.getElementById('text-input').value;
    if (t) createLayer(t, 'text', 100, 100, 30);
};

document.querySelectorAll('.emoji').forEach(e => {
    e.onclick = () => createLayer(e.innerText, 'text', 150, 150, 40);
});

document.getElementById('delete-layer').onclick = () => {
    if (selectedElement) {
        selectedElement.remove();
        selectedElement = null;
        document.getElementById('active-tools').classList.add('hidden');
        document.getElementById('empty-msg').classList.remove('hidden');
    }
};

document.getElementById('bring-forward').onclick = () => { if(selectedElement) selectedElement.style.zIndex = ++zCounter; };
document.getElementById('send-backward').onclick = () => { if(selectedElement) selectedElement.style.zIndex = --zCounter; };

bgColorPicker.oninput = (e) => captureArea.style.backgroundColor = e.target.value;

document.getElementById('btn-reset').onclick = () => {
    if(confirm("Clear everything?")) { elementsLayer.innerHTML = ''; photoCount = 0; }
};

// --- 6. EXPORT LOGIC ---
document.getElementById('btn-download').onclick = () => {
    const canvas = document.getElementById('export-canvas');
    const ctx = canvas.getContext('2d');
    const curW = parseInt(canvasW.value);
    const curH = parseInt(canvasH.value);

    // High resolution x2
    canvas.width = curW * 2; 
    canvas.height = curH * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = bgColorPicker.value;
    ctx.fillRect(0, 0, curW, curH);

    const layers = Array.from(document.querySelectorAll('.layer')).sort((a,b) => a.style.zIndex - b.style.zIndex);
    
    layers.forEach(l => {
        ctx.save();
        const lx = parseInt(l.style.left) + l.offsetWidth/2;
        const ly = parseInt(l.style.top) + l.offsetHeight/2;
        ctx.translate(lx, ly);
        ctx.rotate(parseInt(l.dataset.rotation) * Math.PI / 180);
        
        const s = parseFloat(l.dataset.scale);
        if (l.querySelector('img')) {
            const img = l.querySelector('img'), w = l.offsetWidth * s, h = l.offsetHeight * s;
            if (l.classList.contains('with-frame')) {
                ctx.fillStyle = "white"; ctx.fillRect(-w/2-6, -h/2-6, w+12, h+12);
            }
            ctx.drawImage(img, -w/2, -h/2, w, h);
        } else {
            const fs = parseInt(window.getComputedStyle(l).fontSize);
            ctx.fillStyle = "white"; ctx.font = `bold ${fs * s}px Arial`;
            ctx.textAlign = "center"; ctx.fillText(l.innerText, 0, (fs*s)/3);
        }
        ctx.restore();
    });

    const a = document.createElement('a'); 
    a.download = `maroon-studio-${curW}x${curH}.png`;
    a.href = canvas.toDataURL('image/png'); 
    a.click();
};