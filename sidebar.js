// sidebar.js — collapsible live readout of BeamHits: contacts grouped by
// mirror, plus a short log of start/end events. Re-renders at ~10Hz; the
// event stream itself runs every frame.
const hitsSidebar = document.getElementById('hitsSidebar');
const hitsToggle  = document.getElementById('hitsToggle');
const hitsSummary = document.getElementById('hitsSummary');
const hitsList    = document.getElementById('hitsList');
const hitsLog     = document.getElementById('hitsLog');

const SIDEBAR_KEY = 'beamMirrors.sidebarCollapsed';
function setCollapsed(c) {
  hitsSidebar.classList.toggle('collapsed', c);
  hitsToggle.textContent = c ? '›' : '‹';
  hitsToggle.title = c ? 'show hits' : 'hide hits';
  try { localStorage.setItem(SIDEBAR_KEY, c ? '1' : '0'); } catch (e) {}
}
let initCollapsed = false;
try { initCollapsed = localStorage.getItem(SIDEBAR_KEY) === '1'; } catch (e) {}
setCollapsed(initCollapsed);
hitsToggle.addEventListener('click', () => setCollapsed(!hitsSidebar.classList.contains('collapsed')));

const LOG_MAX = 14;
const logEntries = [];
let eventsThisSec = 0, eventsPerSec = 0;
setInterval(() => { eventsPerSec = eventsThisSec; eventsThisSec = 0; }, 1000);

function logEvent(kind, h) {
  eventsThisSec++;
  logEntries.unshift({ kind, text: `${h.beamId}→${h.mirrorId}${h.visit > 1 ? ' #' + h.visit : ''}`, d: h.depth });
  if (logEntries.length > LOG_MAX) logEntries.length = LOG_MAX;
}
BeamHits.on('hit-start', h => logEvent('start', h));
BeamHits.on('hit-end',   h => logEvent('end', h));

const idNum = id => parseInt(String(id).slice(1)) || 0;
const rgb = h => `rgb(${Math.round(h.r * 255)},${Math.round(h.g * 255)},${Math.round(h.b * 255)})`;

function render() {
  if (hitsSidebar.classList.contains('collapsed')) return;
  const byMirror = new Map();
  for (const h of BeamHits.contacts.values()) {
    if (!byMirror.has(h.mirrorId)) byMirror.set(h.mirrorId, []);
    byMirror.get(h.mirrorId).push(h);
  }
  const total = BeamHits.contacts.size;
  hitsSummary.textContent = `${total} contact${total !== 1 ? 's' : ''} · ${byMirror.size} mirror${byMirror.size !== 1 ? 's' : ''} · ${eventsPerSec} ev/s`;

  const mirrors = [...byMirror.keys()].sort((a, b) => idNum(a) - idNum(b));
  let html = '';
  for (const id of mirrors) {
    const hits = byMirror.get(id).sort((a, b) => idNum(a.beamId) - idNum(b.beamId) || a.depth - b.depth);
    html += `<div class="hm"><div class="hm-head"><span class="hm-sw" style="background:hsl(${hits[0].hue},100%,70%)"></span>${id}<span class="hm-n">×${hits.length}</span></div>`;
    for (const h of hits) {
      html += `<div class="hr">
        <span class="hr-beam" style="color:${rgb(h)}">${h.beamId}</span>
        <span class="hr-meta" title="nth hit of this mirror by this beam · bounce depth">#${h.visit} · d${h.depth}</span>
        <span class="hr-ang${h.side < 0 ? ' back' : ''}" title="incidence (0° head-on, 90° grazing) · ${h.side < 0 ? 'back' : 'front'} face">∠${h.incidence.toFixed(0)}°</span>
        <span class="hr-pos" title="position on mirror ${(h.u * 100).toFixed(0)}%"><i style="left:${(h.u * 100).toFixed(1)}%"></i></span>
        <span class="hr-e" title="energy">${Math.round(h.energy * 100)}%</span>
      </div>`;
    }
    html += '</div>';
  }
  hitsList.innerHTML = html || '<div class="hits-empty">no mirror contacts</div>';
  hitsLog.innerHTML = logEntries.map(e =>
    `<div class="hl ${e.kind}"><span>${e.kind === 'start' ? '+' : '−'}</span>${e.text}<span class="hl-d">d${e.d}</span></div>`
  ).join('');
}
setInterval(render, 100);
