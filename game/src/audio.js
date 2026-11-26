// Sound for the valley: a WebAudio engine drone that follows the throttle,
// wind that rises with speed, a chime for each ring, a thud for touchdown
// and a crunch for a crash. No audio files, nothing fetched, and M mutes.
export function makeAudio() {
  const audio = {
    ctx: null, muted: false, engine: null, engineGain: null, wind: null, windGain: null,
    ensure() {
      if (audio.ctx) return;
      try {
        audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = audio.ctx;
        // Engine: two detuned saws through a low-pass, the classic prop hum.
        audio.engineGain = ctx.createGain();
        audio.engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 420;
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 62;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 93;
        o1.connect(filter); o2.connect(filter);
        filter.connect(audio.engineGain);
        audio.engineGain.connect(ctx.destination);
        audio.engine = [o1, o2];
        o1.start(); o2.start();
        // Wind: looped filtered noise, gain follows airspeed.
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf; noise.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = 0.6;
        audio.windGain = ctx.createGain();
        audio.windGain.gain.value = 0;
        noise.connect(band); band.connect(audio.windGain);
        audio.windGain.connect(ctx.destination);
        noise.start();
      } catch (e) { audio.ctx = null; }
    },
    update(throttle, speed, airborne) {
      if (!audio.ctx || audio.muted) return;
      const t = audio.ctx.currentTime;
      const target = airborne ? 0.05 + throttle * 0.09 : throttle * 0.05;
      audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
      const base = 55 + throttle * 55 + speed * 0.35;
      audio.engine[0].frequency.setTargetAtTime(base, t, 0.1);
      audio.engine[1].frequency.setTargetAtTime(base * 1.5, t, 0.1);
      audio.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0011), t, 0.2);
    },
    blip(freq, dur, type, vol) {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur);
    },
    ring() { audio.blip(880, 0.35, 'sine', 0.25); setTimeout(() => audio.blip(1318, 0.5, 'sine', 0.22), 90); },
    thud() { audio.blip(90, 0.3, 'triangle', 0.4); },
    crash() {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx, t = ctx.currentTime;
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.5;
      src.connect(g); g.connect(ctx.destination); src.start(t);
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.ctx && audio.engineGain) audio.engineGain.gain.value = audio.muted ? 0 : 0.08;
      if (audio.ctx && audio.windGain) audio.windGain.gain.value = audio.muted ? 0 : 0.02;
      return audio.muted;
    },
  };
  return audio;
}
