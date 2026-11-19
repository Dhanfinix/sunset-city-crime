// Every sound is synthesised with WebAudio at runtime: no audio files, no network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicTimer = 0;
  let step = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.32; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
    } catch { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, gain, target) {
    if (!enabled || !ensure()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(target || master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, gain) {
    if (!enabled || !ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = gain;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
    toggle() { enabled = !enabled; return enabled; },
    get enabled() { return enabled; },
    shot(big) { if (big) { noise(0.16, 0.5); tone(120, 0.14, 'square', 0.25); } else { noise(0.09, 0.25); tone(180, 0.08, 'square', 0.12); } },
    reload() { tone(420, 0.05, 'square', 0.1); setTimeout(() => tone(300, 0.06, 'square', 0.1), 140); },
    ui() { tone(660, 0.08, 'sine', 0.16); },
    cash() { tone(880, 0.1, 'triangle', 0.2); setTimeout(() => tone(1320, 0.14, 'triangle', 0.18), 90); },
    crash() { noise(0.3, 0.6); tone(70, 0.3, 'sawtooth', 0.2); },
    footstep() { noise(0.04, 0.08); },
    siren(on) { if (on && Math.floor(Date.now() / 500) % 2 === 0) tone(720, 0.22, 'sine', 0.06); },
    engine(speed, on) { if (on && Math.floor(Date.now() / 90) % 3 === 0) tone(60 + speed * 0.12, 0.08, 'sawtooth', 0.05); },
    // A simple original looping synth soundtrack (four-chord arpeggio in A minor).
    music(dt) {
      if (!enabled || !ensure()) return;
      musicTimer -= dt;
      if (musicTimer > 0) return;
      musicTimer = 0.26;
      const notes = [220, 261.63, 329.63, 392, 329.63, 261.63];
      const bass = [110, 130.81, 164.81, 196];
      const n = notes[step % notes.length];
      tone(n, 0.3, 'triangle', 0.12, musicGain);
      if (step % 3 === 0) tone(bass[Math.floor(step / 3) % bass.length], 0.6, 'sine', 0.14, musicGain);
      step += 1;
    },
  };
}
