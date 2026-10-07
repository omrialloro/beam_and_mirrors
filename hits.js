// hits.js — mirror-hit event layer, the hook point for driving audio.
// Each frame the main loop collects every beam→mirror contact (via traceRay's
// rec param in shared.js) and hands them to BeamHits.update(). A contact is
// identified by its key: beam id + the full path of contacts that led to it,
// so a beam hitting the same mirror twice yields two independent contacts.
//
// Events (subscribe with BeamHits.on(type, fn), returns an unsubscribe fn):
//   'hit-start'  a new contact appeared            → note on
//   'hit-update' an existing contact, every frame  → continuous params
//   'hit-end'    a contact disappeared             → note off
//   'frame'      {t, hits} all contacts this frame
//
// Hit fields: key, beamId, mirrorId, hue, depth, visit, path, x, y,
//   u (0..1 along mirror), offset (px from center), incidence (0° head-on …
//   90° grazing), side (±1 face), heading, mirrorAngle, r, g, b, energy,
//   since (time the contact started, seconds).
const BeamHits = (() => {
  const listeners = {};
  let contacts = new Map();

  function on(type, fn) {
    (listeners[type] ||= []).push(fn);
    return () => { listeners[type] = listeners[type].filter(f => f !== fn); };
  }
  function emit(type, payload) {
    const ls = listeners[type];
    if (ls) for (const fn of ls) fn(payload);
  }

  function update(hits, t) {
    const next = new Map();
    for (const h of hits) next.set(h.key, h);
    for (const [key, h] of next) {
      const prev = contacts.get(key);
      h.since = prev ? prev.since : t;
      emit(prev ? 'hit-update' : 'hit-start', h);
    }
    for (const [key, h] of contacts) if (!next.has(key)) emit('hit-end', h);
    contacts = next;
    emit('frame', { t, hits });
  }

  return { on, update, get contacts() { return contacts; } };
})();
window.BeamHits = BeamHits;
