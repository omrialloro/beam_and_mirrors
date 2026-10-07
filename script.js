const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ── DOM ────────────────────────────────────────────────────────────────────
const clearBtn    = document.getElementById('clearBtn');
const captureBtn  = document.getElementById('captureBtn');
const addMirrorBtn = document.getElementById('addMirrorBtn');
const addBeamBtn   = document.getElementById('addBeamBtn');
const randomBtn   = document.getElementById('randomBtn');
const exportBtn   = document.getElementById('exportBtn');
const displayBtn  = document.getElementById('displayBtn');
const delBtn      = document.getElementById('delBtn');
const countEl     = document.getElementById('countEl');
const controlsBar = document.getElementById('controls');

// context panels
const ctxSelectIdle = document.getElementById('ctx-select-idle');
const ctxSelSpinner = document.getElementById('ctx-sel-spinner');
const ctxSelBeam    = document.getElementById('ctx-sel-beam');

const slBright = document.getElementById('sl-brightness'),vBright = document.getElementById('v-brightness');

// selection sliders — spinner
const slSsSpeed = document.getElementById('sl-ss-speed'), vSsSpeed = document.getElementById('v-ss-speed');
const slSsDir   = document.getElementById('sl-ss-dir'),   vSsDir   = document.getElementById('v-ss-dir');
const slSsLen   = document.getElementById('sl-ss-len'),   vSsLen   = document.getElementById('v-ss-len');
const slSsLeak  = document.getElementById('sl-ss-leak'),  vSsLeak  = document.getElementById('v-ss-leak');
const slSsLR=document.getElementById('sl-ss-lr'),vSsLR=document.getElementById('v-ss-lr');
const slSsLG=document.getElementById('sl-ss-lg'),vSsLG=document.getElementById('v-ss-lg');
const slSsLB=document.getElementById('sl-ss-lb'),vSsLB=document.getElementById('v-ss-lb');
// selection sliders — beam
const slSbDir=document.getElementById('sl-sb-dir'),vSbDir=document.getElementById('v-sb-dir');
const slSbWidth=document.getElementById('sl-sb-width'),vSbWidth=document.getElementById('v-sb-width');
const slSbR=document.getElementById('sl-sb-r'),vSbR=document.getElementById('v-sb-r');
const slSbG=document.getElementById('sl-sb-g'),vSbG=document.getElementById('v-sb-g');
const slSbB=document.getElementById('sl-sb-b'),vSbB=document.getElementById('v-sb-b');

// ── state ──────────────────────────────────────────────────────────────────
let mirrorBrightness = 1.0;
const objects = [];
let mouseX = -9999, mouseY = -9999, mouseOnCanvas = false;
let selectedIdx = -1, isDragging = false, dragOffX = 0, dragOffY = 0;

function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize(); window.addEventListener('resize', resize);

// ── display window (popup mirror, canvas only — no toolbar) ────────────────
// The popup runs its own physics/rAF loop (via the shared stepAndDrawCore),
// so we only need to (re)sync it when the object list or brightness actually
// changes — not on every animation frame.
const displayChannel = new BroadcastChannel('beam-mirrors');
function broadcastState() {
  displayChannel.postMessage({ type: 'state', objects: objects.map(o => ({ ...o })), mirrorBrightness });
}
displayChannel.onmessage = e => { if (e.data.type === 'request-state') broadcastState(); };
displayBtn.addEventListener('click', () => {
  window.open('display.html', 'beamMirrorsDisplay', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
});

// ── helpers ────────────────────────────────────────────────────────────────
function speedLabel(s) {
  if (s === 0) return 'stopped';
  return (Math.abs(s) * SPEED_SCALE * 360).toFixed(1) + '°/s';
}
function angleToDeg(rad) {
  return Math.round(((rad * 180 / Math.PI) % 360 + 360) % 360);
}
function updateCount() {
  countEl.textContent = objects.length + ' obj' + (objects.length !== 1 ? 's' : '');
}

// ── context switching — controls bar ──────────────────────────────────────
function showContext(ctx) {
  ctxSelectIdle.style.display = 'none';
  ctxSelSpinner.style.display = 'none';
  ctxSelBeam.style.display    = 'none';
  delBtn.style.display        = 'none';
  controlsBar.classList.remove('mode-selected');
  if (ctx === 'select-idle')   { ctxSelectIdle.style.display = 'flex'; }
  if (ctx === 'sel-spinner')   { ctxSelSpinner.style.display = 'flex'; delBtn.style.display = 'inline-block'; controlsBar.classList.add('mode-selected'); }
  if (ctx === 'sel-beam')      { ctxSelBeam.style.display    = 'flex'; delBtn.style.display = 'inline-block'; controlsBar.classList.add('mode-selected'); }
}

// ── hit testing ───────────────────────────────────────────────────────────
function hitTest(ox, oy, obj) {
  if (obj.type === 'spinner') {
    const cos = Math.cos(obj.angle), sin = Math.sin(obj.angle);
    const half = obj.length / 2;
    const ax = obj.x - cos * half, ay = obj.y - sin * half;
    const bx = obj.x + cos * half, by = obj.y + sin * half;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx*dx + dy*dy;
    const t = Math.max(0, Math.min(1, ((ox-ax)*dx + (oy-ay)*dy) / len2));
    const px = ax + t*dx - ox, py = ay + t*dy - oy;
    return Math.sqrt(px*px + py*py) < HIT_RADIUS;
  }
  const dx = ox - obj.x, dy = oy - obj.y;
  return Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS;
}
function findHit(ox, oy) {
  for (let i = objects.length - 1; i >= 0; i--)
    if (hitTest(ox, oy, objects[i])) return i;
  return -1;
}

// ── select object → populate inspector ────────────────────────────────────
function selectObject(idx) {
  selectedIdx = idx;
  if (idx === -1) { showContext('select-idle'); return; }
  wakeControls();
  const o = objects[idx];
  if (o.type === 'spinner') {
    showContext('sel-spinner');
    document.getElementById('sel-label').textContent = `⊙ MIRROR #${idx+1}`;
    slSsSpeed.value = o.speed;   vSsSpeed.textContent = speedLabel(o.speed);
    const dirDeg = angleToDeg(o.angle);
    slSsDir.value = dirDeg;      vSsDir.textContent   = dirDeg + '°';
    slSsLen.value   = o.length;  vSsLen.textContent   = o.length + 'px';
    const avgLeak = (o.leakR + o.leakG + o.leakB) / 3;
    slSsLeak.value  = avgLeak;   vSsLeak.textContent  = Math.round(avgLeak * 100) + '%';
    slSsLR.value = o.leakR; vSsLR.textContent = Math.round(o.leakR*100)+'%';
    slSsLG.value = o.leakG; vSsLG.textContent = Math.round(o.leakG*100)+'%';
    slSsLB.value = o.leakB; vSsLB.textContent = Math.round(o.leakB*100)+'%';
  } else {
    showContext('sel-beam');
    document.getElementById('sel-label-b').textContent = `— BEAM #${idx+1}`;
    slSbDir.value = o.dir; vSbDir.textContent = o.dir + '°';
    const w = o.width || 1;
    slSbWidth.value = w; vSbWidth.textContent = w.toFixed(1) + '×';
    slSbR.value = o.r; vSbR.textContent = Math.round(o.r*100)+'%';
    slSbG.value = o.g; vSbG.textContent = Math.round(o.g*100)+'%';
    slSbB.value = o.b; vSbB.textContent = Math.round(o.b*100)+'%';
  }
}

// ── inspector sliders → object ─────────────────────────────────────────────
slSsSpeed.addEventListener('input', () => {
  if (selectedIdx < 0) return;
  objects[selectedIdx].speed = parseFloat(slSsSpeed.value);
  vSsSpeed.textContent = speedLabel(objects[selectedIdx].speed);
  broadcastState();
});
slSsDir.addEventListener('input', () => {
  if (selectedIdx < 0) return;
  const deg = parseInt(slSsDir.value);
  objects[selectedIdx].angle = deg * Math.PI / 180;
  vSsDir.textContent = deg + '°';
  broadcastState();
});
slSsLen.addEventListener('input', () => {
  if (selectedIdx < 0) return;
  objects[selectedIdx].length = parseInt(slSsLen.value);
  vSsLen.textContent = objects[selectedIdx].length + 'px';
  broadcastState();
});
slSsLeak.addEventListener('input', () => {
  if (selectedIdx < 0) return;
  const v = parseFloat(slSsLeak.value);
  objects[selectedIdx].leakR = v; objects[selectedIdx].leakG = v; objects[selectedIdx].leakB = v;
  vSsLeak.textContent = Math.round(v*100)+'%';
  slSsLR.value = v; vSsLR.textContent = Math.round(v*100)+'%';
  slSsLG.value = v; vSsLG.textContent = Math.round(v*100)+'%';
  slSsLB.value = v; vSsLB.textContent = Math.round(v*100)+'%';
  broadcastState();
});
slSsLR.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].leakR=parseFloat(slSsLR.value); vSsLR.textContent=Math.round(objects[selectedIdx].leakR*100)+'%'; broadcastState(); });
slSsLG.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].leakG=parseFloat(slSsLG.value); vSsLG.textContent=Math.round(objects[selectedIdx].leakG*100)+'%'; broadcastState(); });
slSsLB.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].leakB=parseFloat(slSsLB.value); vSsLB.textContent=Math.round(objects[selectedIdx].leakB*100)+'%'; broadcastState(); });
slSbDir.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].dir=parseInt(slSbDir.value); vSbDir.textContent=objects[selectedIdx].dir+'°'; broadcastState(); });
slSbWidth.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].width=parseFloat(slSbWidth.value); vSbWidth.textContent=objects[selectedIdx].width.toFixed(1)+'×'; broadcastState(); });
slSbR.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].r=parseFloat(slSbR.value); vSbR.textContent=Math.round(objects[selectedIdx].r*100)+'%'; broadcastState(); });
slSbG.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].g=parseFloat(slSbG.value); vSbG.textContent=Math.round(objects[selectedIdx].g*100)+'%'; broadcastState(); });
slSbB.addEventListener('input', () => { if (selectedIdx<0) return; objects[selectedIdx].b=parseFloat(slSbB.value); vSbB.textContent=Math.round(objects[selectedIdx].b*100)+'%'; broadcastState(); });

// ── delete ─────────────────────────────────────────────────────────────────
delBtn.addEventListener('click', () => {
  if (selectedIdx < 0) return;
  objects.splice(selectedIdx, 1);
  selectObject(-1); updateCount();
  broadcastState();
});

// ── add new object — spawns at a random free spot so new objects don't land
// on top of existing ones, already selected, so it can be moved/tweaked/
// deleted immediately via the select-mode inspector ─────────────────────────
const SPAWN_MIN_DIST = 100;
function randomFreePos(minDist) {
  const pick = () => ({
    x: canvas.width / 3 + Math.random() * (canvas.width / 3),
    y: canvas.height / 3 + Math.random() * (canvas.height / 3)
  });
  for (let attempt = 0; attempt < 30; attempt++) {
    const p = pick();
    if (objects.every(o => Math.hypot(o.x - p.x, o.y - p.y) >= minDist)) return p;
  }
  return pick();
}
function spawnMirror() {
  const pos = randomFreePos(SPAWN_MIN_DIST);
  objects.push({ type: 'spinner', x: pos.x, y: pos.y, speed: 2.0, angle: 0,
    length: 150, hue: Math.random() * 360, leakR: 0, leakG: 0, leakB: 0 });
  selectObject(objects.length - 1);
  updateCount();
  broadcastState();
}
function spawnBeam() {
  const pos = randomFreePos(SPAWN_MIN_DIST);
  objects.push({ type: 'beam', x: pos.x, y: pos.y, dir: 45,
    phase: Math.random() * Math.PI * 2, r: 0, g: 1, b: 0, width: 1 });
  selectObject(objects.length - 1);
  updateCount();
  broadcastState();
}
addMirrorBtn.addEventListener('click', spawnMirror);
addBeamBtn.addEventListener('click', spawnBeam);

// ── random composition — 6-10 mirrors + 1-3 beams, random speed/direction,
// clustered around the canvas center so the result isn't too sparse ────────
function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function randomComposition() {
  objects.length = 0;
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const spread = Math.min(canvas.width, canvas.height) * 0.35;
  const randomPos = () => ({ x: cx + (Math.random() * 2 - 1) * spread, y: cy + (Math.random() * 2 - 1) * spread });

  const mirrorCount = randomInt(6, 10);
  for (let i = 0; i < mirrorCount; i++) {
    const pos = randomPos();
    const speed = (Math.random() * 2 - 1) * 10;
    const dirDeg = randomInt(0, 359);
    objects.push({ type: 'spinner', x: pos.x, y: pos.y, speed, angle: dirDeg * Math.PI / 180,
      length: 150, hue: Math.random() * 360, leakR: 0, leakG: 0, leakB: 0 });
  }

  const beamCount = randomInt(1, 3);
  for (let i = 0; i < beamCount; i++) {
    const pos = randomPos();
    objects.push({ type: 'beam', x: pos.x, y: pos.y, dir: randomInt(0, 359),
      phase: Math.random() * Math.PI * 2, r: 0, g: 1, b: 0, width: 1 });
  }

  selectObject(-1);
  updateCount();
  broadcastState();
}
randomBtn.addEventListener('click', randomComposition);

// ── export composition as JSON — lets a saved composition be handed back
// later (e.g. as a default to load) ─────────────────────────────────────────
function downloadJSON() {
  const data = { mirrorBrightness, objects: objects.map(o => ({ ...o })) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `beam-composition-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
exportBtn.addEventListener('click', downloadJSON);

slBright.addEventListener('input', () => { mirrorBrightness = parseFloat(slBright.value); vBright.textContent = Math.round(mirrorBrightness * 100) + '%'; broadcastState(); });

// ── mouse events — click to select, drag to move ───────────────────────────
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  if (isDragging && selectedIdx >= 0) {
    objects[selectedIdx].x = mouseX - dragOffX;
    objects[selectedIdx].y = mouseY - dragOffY;
    canvas.style.cursor = 'grabbing';
    broadcastState();
  } else {
    canvas.style.cursor = findHit(mouseX, mouseY) >= 0 ? 'grab' : 'default';
  }
});
canvas.addEventListener('mouseenter', () => { mouseOnCanvas = true; });
canvas.addEventListener('mouseleave', () => { mouseOnCanvas = false; isDragging = false; });

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const hit = findHit(x, y);
  if (hit >= 0) {
    selectObject(hit);
    isDragging = true;
    dragOffX = x - objects[hit].x;
    dragOffY = y - objects[hit].y;
    canvas.style.cursor = 'grabbing';
  } else {
    selectObject(-1);
  }
  e.preventDefault();
});
document.addEventListener('mouseup', () => {
  if (isDragging) { isDragging = false; canvas.style.cursor = 'default'; }
});

// ── save/clear ─────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => { objects.length = 0; selectObject(-1); updateCount(); broadcastState(); });
// ── capture video ──────────────────────────────────────────────────────────
// Renders offline at a fixed 1/30s timestep per frame, independent of real
// wall-clock/render performance, so the output is always full quality —
// heavy scenes just take longer to render, never play back slow or choppy.
const CAPTURE_SECONDS = 20;
const CAPTURE_FPS = 30;
const CAPTURE_FRAMES = CAPTURE_SECONDS * CAPTURE_FPS;
const FRAME_DT = 1 / CAPTURE_FPS;
const MEDIABUNNY_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.50.6/+esm';
// render at native pixel density so thin glowing lines aren't already soft
// before compression — the live canvas is CSS-pixel sized, which looks fine
// on screen (GPU-composited) but bakes in less detail than a Retina display has
const CAPTURE_SCALE = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

const canRecord = typeof VideoEncoder !== 'undefined';
let isRecording = false;
if (!canRecord) {
  captureBtn.disabled = true;
  captureBtn.title = 'video capture not supported in this browser';
}

let mediabunnyPromise = null;
function loadMediabunny() {
  if (!mediabunnyPromise) mediabunnyPromise = import(MEDIABUNNY_URL);
  return mediabunnyPromise;
}

captureBtn.addEventListener('click', async () => {
  if (!canRecord || isRecording) return;
  isRecording = true;
  captureBtn.classList.add('recording');
  captureBtn.textContent = '● rendering 0%';

  try {
    const { Output, BufferTarget, Mp4OutputFormat, CanvasSource, QUALITY_VERY_HIGH } = await loadMediabunny();

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width * CAPTURE_SCALE;
    offCanvas.height = canvas.height * CAPTURE_SCALE;
    const offCtx = offCanvas.getContext('2d');
    offCtx.scale(CAPTURE_SCALE, CAPTURE_SCALE);

    // snapshot the composition at click-time so the live canvas stays fully
    // interactive while this renders in the background
    const snapshot = objects.map(o => ({ ...o }));

    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const videoSource = new CanvasSource(offCanvas, { codec: 'avc', bitrate: QUALITY_VERY_HIGH });
    output.addVideoTrack(videoSource);
    await output.start();

    for (let f = 0; f < CAPTURE_FRAMES; f++) {
      const t = f * FRAME_DT;
      stepAndDrawCore(offCtx, snapshot, FRAME_DT, t, -1, mirrorBrightness);
      await videoSource.add(t, FRAME_DT);
      if (f % 3 === 0) {
        captureBtn.textContent = `● rendering ${Math.round((f + 1) / CAPTURE_FRAMES * 100)}%`;
        await new Promise(r => setTimeout(r, 0)); // yield so the UI stays responsive
      }
    }

    await output.finalize();
    const blob = new Blob([output.target.buffer], { type: 'video/mp4' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `beam-composition-${Date.now()}.mp4`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    captureBtn.textContent = '● capture';
  } catch (err) {
    console.error('video capture failed', err);
    captureBtn.textContent = '● capture failed';
    setTimeout(() => { captureBtn.textContent = '● capture'; }, 2000);
  } finally {
    isRecording = false;
    captureBtn.classList.remove('recording');
  }
});

// ── touch: tap to select, drag to move (mirrors mouse behavior) ────────────
function getTouchPos(touch) {
  const rect = canvas.getBoundingClientRect();
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

let touchDragId = -1;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const pos = getTouchPos(t);
  const hit = findHit(pos.x, pos.y);
  if (hit >= 0) {
    selectObject(hit);
    touchDragId = t.identifier;
    dragOffX = pos.x - objects[hit].x;
    dragOffY = pos.y - objects[hit].y;
  } else {
    selectObject(-1);
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (touchDragId === -1) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== touchDragId) continue;
    const pos = getTouchPos(t);
    objects[selectedIdx].x = pos.x - dragOffX;
    objects[selectedIdx].y = pos.y - dragOffY;
    broadcastState();
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === touchDragId) touchDragId = -1;
}, { passive: false });

canvas.addEventListener('touchcancel', () => { touchDragId = -1; }, { passive: false });

// ── draw ───────────────────────────────────────────────────────────────────
let last = performance.now();
function draw(now) {
  const dt = Math.min((now-last)/1000,0.05); last=now; const t=now/1000;
  stepAndDrawCore(ctx, objects, dt, t, selectedIdx, mirrorBrightness);

  // keep the DIR readout tracking a spinning mirror's live angle while it's
  // selected, unless the user is mid-drag on the slider themselves
  if (selectedIdx >= 0 && objects[selectedIdx]?.type === 'spinner' && document.activeElement !== slSsDir) {
    const dirDeg = angleToDeg(objects[selectedIdx].angle);
    slSsDir.value = dirDeg;
    vSsDir.textContent = dirDeg + '°';
  }

  // hover glow
  if(mouseOnCanvas&&!isDragging){
    const hi=findHit(mouseX,mouseY);
    if(hi>=0&&hi!==selectedIdx){
      const ho=objects[hi];ctx.save();ctx.strokeStyle='rgba(170,136,255,0.22)';ctx.lineWidth=8;ctx.shadowBlur=0;
      if(ho.type==='spinner'){const cos=Math.cos(ho.angle),sin=Math.sin(ho.angle),half=ho.length/2;ctx.beginPath();ctx.moveTo(ho.x-cos*half,ho.y-sin*half);ctx.lineTo(ho.x+cos*half,ho.y+sin*half);ctx.stroke();}
      else{ctx.beginPath();ctx.arc(ho.x,ho.y,HIT_RADIUS*0.7,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  }

  requestAnimationFrame(draw);
}

// init
showContext('select-idle');
canvas.style.cursor = 'default';
requestAnimationFrame(draw);

// ── auto-hide controls bar after 5s of no tuning/dragging ──────────────────
const CONTROLS_HIDE_MS = 5000;
let controlsHideTimer = null;
function wakeControls() {
  controlsBar.classList.remove('controls-hidden');
  clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(() => controlsBar.classList.add('controls-hidden'), CONTROLS_HIDE_MS);
}
controlsBar.addEventListener('input', wakeControls);
canvas.addEventListener('mousedown', wakeControls);
canvas.addEventListener('mousemove', () => { if (isDragging) wakeControls(); });
wakeControls();
