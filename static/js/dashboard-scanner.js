// dashboard-scanner.js
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const toggleCameraBtn = document.getElementById('toggleCamera');
const stopBtn = document.getElementById('stopBtn');

let scanning = false;
let stream = null;
let useFront = false;
let lastHandled = null;

async function startCamera() {
  if (stream) stopCamera();
  const constraints = {
    video: {
      facingMode: useFront ? 'user' : 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    // mobile autoplay helpers
    video.muted = true;
    video.playsInline = true;
    await video.play();
    statusEl.textContent = 'Camera started — point at a QR code';
    scanning = true;
    requestAnimationFrame(tick);
  } catch (err) {
    console.error('Camera error', err);
    statusEl.textContent = 'Camera access denied or not available: ' + (err.message || err);
  }
}

function stopCamera() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.pause();
  video.srcObject = null;
  statusEl.textContent = 'Camera stopped';
}

function tick() {
  if (!scanning) return;
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  if (canvas.width === 0 || canvas.height === 0) {
    requestAnimationFrame(tick);
    return;
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

  if (code) {
    drawRect(ctx, code.location);
    handleDecoded(code.data);
  } else {
    requestAnimationFrame(tick);
  }
}

function drawRect(ctx, loc) {
  ctx.strokeStyle = "#FF3B3B";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
  ctx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
  ctx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
  ctx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
  ctx.closePath();
  ctx.stroke();
}

function showToast(msg, duration = 2200) {
  const t = document.getElementById('sse-toast');
  if (!t) return;
  t.style.display = 'block';
  t.textContent = msg;
  setTimeout(() => { t.style.display = 'none'; }, duration);
}

function updateRow(token, status, lunch_scanned) {
  const row = document.querySelector(`#student-${token}`) || document.querySelector(`[data-token="${token}"]`);
  if (!row) {
    showToast("Scanned: " + token);
    return;
  }
  const statusCell = row.querySelector('.status-cell');
  const lunchCell = row.querySelector('.lunch-cell');
  if (statusCell && status) statusCell.textContent = status;
  if (lunchCell && typeof lunch_scanned !== 'undefined') lunchCell.textContent = lunch_scanned ? 'claimed' : 'not claimed';
  row.classList.add('flash');
  setTimeout(()=> row.classList.remove('flash'), 800);
}

function handleDecoded(text) {
  if (text === lastHandled) return;
  lastHandled = text;
  statusEl.textContent = 'QR detected';
  messageEl.textContent = 'Scanned: ' + text;

  const ticketMatch = text.match(/\/ticket\/([^/?#\s]+)/i);
  const lunchMatch = text.match(/\/lunch_ticket\/([^/?#\s]+)/i);
  let token = null;
  let endpoint = null;

  if (ticketMatch) {
    token = ticketMatch[1];
    endpoint = '/api/verify';
  } else if (lunchMatch) {
    token = lunchMatch[1];
    endpoint = '/api/verify_lunch';
  } else {
    token = text.trim();
    endpoint = '/api/verify';
  }

  if (!token) {
    statusEl.textContent = 'Could not extract token';
    lastHandled = null;
    return;
  }

  // Improved fetch handler: updates lunch-cell when lunch QR scanned
  statusEl.textContent = 'Verifying...';
  fetch(`${endpoint}?token=${encodeURIComponent(token)}`)
    .then(resp => resp.json())
    .then(data => {
      if (data.status === 'success') {
        statusEl.textContent = 'OK: ' + data.message;
        showToast(data.message);

        if (endpoint === '/api/verify') {
          // Entry verify: toggle status between inside/outside based on message
          let newStatus = null;
          if (/Entry allowed/i.test(data.message)) newStatus = 'inside';
          else if (/Exit recorded/i.test(data.message)) newStatus = 'outside';
          updateRow(token, newStatus, undefined);
        } else if (endpoint === '/api/verify_lunch') {
          // Lunch verify: mark lunch as claimed
          // token may be like "lunch_<token>" sometimes; normalize
          let baseToken = token.replace(/^lunch_/, '');
          updateRow(baseToken, undefined, true);
        }
      } else {
        statusEl.textContent = 'Error: ' + data.message;
        showToast(data.message);
      }

      // cooldown before next scan
      setTimeout(()=> { lastHandled = null; statusEl.textContent = 'Ready for next QR'; requestAnimationFrame(tick); }, 1400);
    })
    .catch(err => {
      console.error(err);
      statusEl.textContent = 'Network error';
      showToast('Network error');
      setTimeout(() => { lastHandled = null; requestAnimationFrame(tick); }, 1400);
    });
}

toggleCameraBtn.addEventListener('click', () => {
  useFront = !useFront;
  startCamera();
});
stopBtn.addEventListener('click', () => stopCamera());
window.addEventListener('load', () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = 'getUserMedia not supported by your browser';
    return;
  }
  startCamera();
});
// expose controls so template buttons can call them
window.startCamera = startCamera;
window.stopCamera = stopCamera;
