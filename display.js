// display.js — popup "stage display" window: renders the shared composition
// with no toolbar/controls. State (object list + brightness) arrives over a
// BroadcastChannel from the main window (script.js); physics/animation then
// run locally here via the same stepAndDrawCore used everywhere else, so this
// window keeps animating smoothly between syncs rather than needing a message
// on every frame.
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
resize(); window.addEventListener('resize', resize);

let objects = [];
let mirrorBrightness = 1.0;

const displayChannel = new BroadcastChannel('beam-mirrors');
displayChannel.onmessage = e => {
  if (e.data.type !== 'state') return;
  objects = e.data.objects;
  mirrorBrightness = e.data.mirrorBrightness;
};
// ask the main window for its current state (covers popup opened after, or reloaded)
displayChannel.postMessage({ type: 'request-state' });

let last = performance.now();
function draw(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now; const t = now / 1000;
  stepAndDrawCore(ctx, objects, dt, t, -1, mirrorBrightness);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
