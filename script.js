const video = document.getElementById('camera');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const food = document.getElementById('food');

let net;
let isProcessing = false;

async function loadBodyPix() {
  net = await bodyPix.load();
  console.log('BodyPix loaded');
  startProcessing();
}

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      loadBodyPix();
    };
  })
  .catch(err => {
    console.error('Camera access needed', err);
    alert('Camera access denied or unavailable. Run this in a secure context (HTTPS or localhost).');
  });

async function startProcessing() {
  if (isProcessing) return;
  isProcessing = true;
  processFrame();
}

async function processFrame() {
  if (!net) return;

  const segmentation = await net.segmentPerson(video, {
    flipHorizontal: false,
    internalResolution: 'low',
    segmentationThreshold: 0.8,
  });

  const foregroundColor = { r: 0, g: 0, b: 0, a: 255 };
  const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };

  const backgroundDarkeningMask = bodyPix.toMask(segmentation, foregroundColor, backgroundColor);

  bodyPix.drawMask(canvas, video, backgroundDarkeningMask, 1, 0, false);

  requestAnimationFrame(processFrame);
}

let isDragging = false;
let initialDistance = 0;
let scale = 1;

document.addEventListener('click', (e) => {
  if (e.target.closest('#menu')) return;
  placeFood(e.clientX, e.clientY);
});

document.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1 && !e.target.closest('#menu')) {
    const touch = e.touches[0];
    placeFood(touch.clientX, touch.clientY);
  }
});

function placeFood(x, y) {
  food.style.display = 'block';
  food.style.left = `${x}px`;
  food.style.top = `${y}px`;
}

food.addEventListener('touchstart', (e) => {
  isDragging = true;
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialDistance = Math.hypot(dx, dy);
  }
});

food.addEventListener('touchend', () => {
  isDragging = false;
  if (event.touches && event.touches.length < 2) {
    initialDistance = 0;
  }
});

food.addEventListener('touchmove', (e) => {
  e.preventDefault();

  if (e.touches.length === 1 && isDragging) {
    const touch = e.touches[0];
    food.style.left = `${touch.clientX}px`;
    food.style.top = `${touch.clientY}px`;
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const distance = Math.hypot(dx, dy);
    if (initialDistance > 0) {
      scale = distance / initialDistance;
      food.style.transform = `scale(${scale})`;
    }
    initialDistance = distance;
  }
}, { passive: false });

function changeFood(src) {
  food.src = src;
}
