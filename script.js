const video = document.getElementById('camera');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const food = document.getElementById('food');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const errorText = document.getElementById('error-text');
const foodInfo = document.getElementById('food-info');
const foodName = document.getElementById('food-name');
const foodDistance = document.getElementById('food-distance');

let net;
let isProcessing = false;
let personHeight = 0;
let lastSegmentationTime = 0;
let currentFoodName = 'Pizza';
let handDetector = null;
let estimatedDistance = 100;
let personFace = { x: 0, y: 0, width: 0 };

async function loadBodyPix() {
  try {
    net = await bodyPix.load();
    console.log('BodyPix loaded');
    
    // Try to load hand detector for proximity sensing
    try {
      const model = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        { runtime: 'mediapipe', modelType: 'full' }
      );
      handDetector = model;
      console.log('Hand detector loaded for proximity sensing');
    } catch (e) {
      console.log('Hand detector not available, using basic proximity detection');
    }
    
    loading.classList.add('hidden');
    startProcessing();
  } catch (err) {
    console.error('BodyPix load error:', err);
    showError('Failed to load AR model. Please refresh.');
  }
}

function showError(message) {
  errorText.textContent = message;
  error.classList.remove('hidden');
  loading.classList.add('hidden');
}

navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      loadBodyPix();
    };
  })
  .catch(err => {
    console.error('Camera access error:', err);
    showError('Camera access denied. Please enable camera permissions and refresh.');
  });

async function startProcessing() {
  if (isProcessing) return;
  isProcessing = true;
  processFrame();
}

async function processFrame() {
  if (!net || video.readyState < 2) return;

  const now = Date.now();
  const timeSinceLastSegmentation = now - lastSegmentationTime;

  // Throttle segmentation to 15fps max for performance
  if (timeSinceLastSegmentation < 66) {
    requestAnimationFrame(processFrame);
    return;
  }

  lastSegmentationTime = now;

  try {
    const segmentation = await net.segmentPerson(video, {
      flipHorizontal: false,
      internalResolution: 'low',
      segmentationThreshold: 0.8,
    });

    const { width, height, data } = segmentation;
    let minY = height, maxY = 0, minX = width, maxX = 0;
    
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 0.5) {
        const y = Math.floor(i / width);
        const x = i % width;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    
    personHeight = (maxY - minY) * (video.videoHeight / height);
    personFace = {
      x: minX * (video.videoWidth / width),
      y: minY * (video.videoHeight / height),
      width: (maxX - minX) * (video.videoWidth / width)
    };

    // Try hand detection for proximity
    if (handDetector) {
      try {
        const hands = await handDetector.estimateHands(video);
        if (hands && hands.length > 0) {
          // Hand detected - user is close
          estimatedDistance = 40 + Math.random() * 20; // Closer range
          proximityBar.classList.remove('hidden');
          proximityBar.style.width = ((estimatedDistance - 20) / 80 * 100) + '%';
        } else {
          // No hands - user is far
          estimatedDistance = Math.max(50, 100 - personHeight / 5);
          proximityBar.classList.add('hidden');
        }
      } catch (e) {
        estimatedDistance = Math.max(50, 100 - personHeight / 5);
      }
    } else {
      // Fallback: use person height as proxy for distance
      estimatedDistance = Math.max(50, 150 - personHeight / 3);
      proximityBar.style.width = ((estimatedDistance - 30) / 120 * 100) + '%';
    }

    const foregroundColor = { r: 0, g: 0, b: 0, a: 255 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 0 };

    const backgroundDarkeningMask = bodyPix.toMask(segmentation, foregroundColor, backgroundColor);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bodyPix.drawMask(canvas, video, backgroundDarkeningMask, 1, 0, false);

    // Scale food based on proximity + person height
    if (food.style.display !== 'none') {
      const baseSize = 15; // vw
      const proximityScale = Math.min(3, estimatedDistance / 40);
      const heightScale = Math.max(1, personHeight / 200);
      const finalScale = proximityScale * heightScale;
      
      food.style.setProperty('--scale', finalScale);
      food.style.width = `calc(${baseSize}vw * ${finalScale})`;
      
      // Update distance display
      foodDistance.textContent = `${Math.round(estimatedDistance)}cm`;
    }
  } catch (error) {
    console.error('Segmentation error:', error);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(processFrame);
}

let isDragging = false;
let initialDistance = 0;
let scale = 1;
let rotateAngle = 0;
let lastDragX = 0;
let lastDragY = 0;

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
  const foodWidth = parseInt(food.style.width || '60');
  food.style.left = `${x - foodWidth / 2}px`;
  food.style.top = `${y - foodWidth / 2}px`;
  rotateAngle = Math.random() * 10 - 5;
  food.style.transform = `rotate(${rotateAngle}deg) scale(${scale})`;
  foodInfo.classList.remove('hidden');
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
      food.style.transform = `rotate(${rotateAngle}deg) scale(${scale})`;
    }
    initialDistance = distance;
  }
}, { passive: false });

function changeFood(src, name, description) {
  food.src = src;
  currentFoodName = name;
  foodName.textContent = name;
  if (food.style.display === 'block') {
    scale = 1;
    rotateAngle = 0;
  }
}
