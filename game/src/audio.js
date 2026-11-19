// Every sound is synthesised with WebAudio at runtime: engine, siren, gunfire, steps and a loop.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio() {
  const api = { ctx: null, master: null, muted: false, engineGain: null, engineOsc: null, sirenGain: null, sirenOsc: null, beat: 0, nextNote: 0, step: 0, ready: false };

  function init() {
    if (api.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      api.ctx = new Ctx();
      api.master = api.ctx.createGain();
      api.master.gain.value = 0.5;
      api.master.connect(api.ctx.destination);

      api.engineGain = api.ctx.createGain();
      api.engineGain.gain.value = 0;
      api.engineOsc = api.ctx.createOscillator();
      api.engineOsc.type = 'sawtooth';
      api.engineOsc.frequency.value = 60;
      const filter = api.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      api.engineOsc.connect(filter); filter.connect(api.engineGain); api.engineGain.connect(api.master);
      api.engineOsc.start();
      api.engineFilter = filter;

      api.sirenGain = api.ctx.createGain();
      api.sirenGain.gain.value = 0;
      api.sirenOsc = api.ctx.createOscillator();
      api.sirenOsc.type = 'square'; api.sirenOsc.frequency.value = 700;
      api.sirenOsc.connect(api.sirenGain); api.sirenGain.connect(api.master);
      api.sirenOsc.start();
      api.ready = true;
    } catch { /* audio is optional; the game stays silent if blocked */ }
  }
  api.resume = () => { init(); if (api.ctx && api.ctx.state === 'suspended') api.ctx.resume().catch(() => {}); };

  function tone(freq, dur, type, gain, when = 0) {
    if (!api.ctx || api.muted) return;
    try {
      const t = api.ctx.currentTime + when;
      const o = api.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
      const g = api.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(api.master); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }
  function noise(dur, gain, filterFreq) {
    if (!api.ctx || api.muted) return;
    try {
      const len = Math.floor(api.ctx.sampleRate * dur);
      const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = api.ctx.createBufferSource(); src.buffer = buf;
      const f = api.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 2000;
      const g = api.ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(api.master); src.start();
    } catch { /* ignore */ }
  }

  api.shot = () => { noise(0.12, 0.5, 1500); tone(90, 0.12, 'square', 0.25); };
  api.punch = () => { noise(0.09, 0.3, 600); };
  api.step = () => { noise(0.05, 0.08, 400); };
  api.crash = () => { noise(0.35, 0.6, 900); tone(70, 0.3, 'sawtooth', 0.2); };
  api.cash = () => { tone(NOTE(88), 0.1, 'triangle', 0.18); tone(NOTE(95), 0.12, 'triangle', 0.16, 0.08); };

  api.setEngine = (speed, active) => {
    if (!api.ready) return;
    const t = api.ctx.currentTime;
    api.engineGain.gain.setTargetAtTime(active && !api.muted ? 0.10 : 0, t, 0.05);
    api.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.5, t, 0.05);
    if (api.engineFilter) api.engineFilter.frequency.setTargetAtTime(400 + Math.abs(speed) * 3, t, 0.05);
  };
  api.setSiren = (active, t) => {
    if (!api.ready) return;
    const now = api.ctx.currentTime;
    api.sirenGain.gain.setTargetAtTime(active && !api.muted ? 0.055 : 0, now, 0.08);
    if (active) api.sirenOsc.frequency.setTargetAtTime(Math.sin(t * 6) > 0 ? 880 : 620, now, 0.02);
  };

  // A simple original synthwave loop: two oscillators and a kick, scheduled from the game clock.
  const bass = [45, 45, 48, 43, 41, 41, 45, 40];
  const lead = [69, 72, 76, 72, 67, 71, 74, 71];
  api.music = (time) => {
    if (!api.ready || api.muted) return;
    if (time < api.nextNote) return;
    api.nextNote = time + 0.28;
    const i = api.step % 8;
    tone(NOTE(bass[i]), 0.26, 'triangle', 0.10);
    if (i % 2 === 0) tone(NOTE(lead[i] + 12), 0.22, 'sine', 0.045);
    if (i % 4 === 0) { tone(120, 0.12, 'sine', 0.14); noise(0.04, 0.05, 3000); }
    api.step += 1;
  };
  api.toggleMute = () => { api.muted = !api.muted; if (api.master) api.master.gain.value = api.muted ? 0 : 0.5; return api.muted; };
  return api;
}
