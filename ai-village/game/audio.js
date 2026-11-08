// Village sound: a soft breeze, the odd bird, and the jukebox that gets louder as you walk up to it.
// If the Artlist files are in assets/sound/ they are used; otherwise the same sounds are made in code.

const SOUND_FILES = {
  ambience: 'assets/sound/village-birds.aac',
  birds: ['assets/sound/bird-chirp.aac', 'assets/sound/bird-song.aac'],
  jukebox: 'assets/sound/jukebox.mp3',
};

function loadAudio(src, loop) {
  return new Promise((resolve) => {
    const el = new Audio();
    el.preload = 'auto';
    el.loop = loop;
    el.volume = 0;
    el.addEventListener('canplaythrough', () => resolve(el), { once: true });
    el.addEventListener('error', () => resolve(null), { once: true });
    el.src = src;
  });
}

class VillageAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.indoors = false;
  }

  start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    this.outdoor = ctx.createGain();   // breeze + birds, quieter indoors
    this.outdoor.gain.value = 1;
    this.outdoor.connect(this.master);

    this.jukebox = ctx.createGain();   // the tune, set by distance
    this.jukebox.gain.value = 0;
    const warm = ctx.createBiquadFilter(); // old speaker sound
    warm.type = 'lowpass';
    warm.frequency.value = 2200;
    this.music = ctx.createGain();
    this.music.connect(warm).connect(this.jukebox).connect(this.master);

    this.startBreeze();
    this.files = {};
    Promise.all([
      loadAudio(SOUND_FILES.ambience, true),
      loadAudio(SOUND_FILES.jukebox, true),
      ...SOUND_FILES.birds.map((src) => loadAudio(src, false)),
    ]).then(([ambience, jukebox, ...birds]) => {
      this.files = { ambience, jukebox, birds: birds.filter(Boolean) };
      if (ambience) { ambience.play(); this.applyVolumes(); }
      if (jukebox) jukebox.play(); else this.startTune();
      this.scheduleBird();
    });
  }

  // Sound files are plain <audio> elements (so they also work when the page is opened from disk);
  // their volume follows the same settings as the sounds made in code.
  applyVolumes() {
    const f = this.files || {};
    const on = this.muted ? 0 : 1;
    if (f.ambience) f.ambience.volume = 0.12 * on * (this.indoors ? 0.25 : 1);
    if (f.jukebox) f.jukebox.volume = Math.min(1, (this.jukeboxLevel || 0) * 0.9 * on);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.1);
    this.applyVolumes();
  }

  // During a session with Rosie the village sounds go softer (Harm, 2026-11-08).
  setSessionQuiet(quiet) {
    this.sessionQuiet = quiet;
    if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(quiet ? 0.3 : 0.7, this.ctx.currentTime, 0.6);
  }

  setIndoors(indoors) {
    this.indoors = indoors;
    if (this.ctx) this.outdoor.gain.setTargetAtTime(indoors ? 0.25 : 1, this.ctx.currentTime, 0.4);
    this.applyVolumes();
  }

  // 0 when far away, rising gently as the CEO walks up to the jukebox.
  setJukeboxDistance(dist) {
    if (!this.ctx) return;
    const near = this.indoors ? 0 : Math.max(0, 1 - dist / 420);
    this.jukebox.gain.setTargetAtTime(near * near * 0.32, this.ctx.currentTime, 0.25);
    const level = near * near * 0.35;
    if (Math.abs(level - (this.jukeboxLevel || 0)) > 0.005) { this.jukeboxLevel = level; this.applyVolumes(); }
  }

  // The water sound: soft everywhere, a bit fuller when the CEO stands by the fountain.
  setFountainDistance(dist) {
    if (!this.ctx || !this.near) return;
    const near = this.indoors ? 0 : Math.max(0, 1 - dist / 380);
    this.near.gain.setTargetAtTime(0.3 + near * near * 0.9, this.ctx.currentTime, 0.4);
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  startBreeze() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 380;
    band.Q.value = 0.6;
    const level = ctx.createGain();
    level.gain.value = 0.004;                 // Harm (2026-10-31): the rushing was far too loud; now a whisper
    const sway = ctx.createOscillator();   // the breeze rises and falls
    sway.frequency.value = 0.07;
    const swayDepth = ctx.createGain();
    swayDepth.gain.value = 0.002;
    sway.connect(swayDepth).connect(level.gain);
    this.near = ctx.createGain();             // a little louder only right by the fountain (setFountainDistance)
    this.near.gain.value = 0.3;
    src.connect(band).connect(level).connect(this.near).connect(this.outdoor);
    src.start();
    sway.start();
  }

  scheduleBird() {
    const wait = 6000 + Math.random() * 14000;
    setTimeout(() => {
      const birds = (this.files && this.files.birds) || [];
      if (birds.length) {
        const el = birds[Math.floor(Math.random() * birds.length)];
        el.currentTime = 0;
        el.volume = this.muted ? 0 : 0.1 * (this.indoors ? 0.3 : 1);
        el.play();
      } else this.bird();
      this.scheduleBird();
    }, wait);
  }

  bird() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.outdoor);
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1800;
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const len = 0.05 + Math.random() * 0.08;
      const f = base * (0.85 + Math.random() * 0.4);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + len);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len + 0.04 + Math.random() * 0.08;
    }
  }

  // A relaxed swing loop: Cmaj7 Am7 Dm7 G7 Em7 A7 Dm7 G7.
  startTune() {
    const chords = [
      [48, [60, 64, 67, 71]], [45, [60, 64, 67, 69]], [50, [60, 62, 65, 69]], [43, [59, 62, 65, 67]],
      [52, [59, 62, 64, 67]], [45, [61, 64, 67, 69]], [50, [60, 62, 65, 69]], [43, [59, 62, 65, 67]],
    ];
    const melody = [
      [76, 0, 1.5], [74, 1.5, 0.5], [72, 2, 2],
      [72, 0, 1], [69, 1, 1], [67, 2, 2],
      [69, 0, 1.5], [72, 1.5, 0.5], [74, 2, 1], [72, 3, 1],
      [71, 0, 3], [67, 3, 1],
      [67, 0, 1.5], [71, 1.5, 0.5], [74, 2, 2],
      [73, 0, 1], [76, 1, 1], [74, 2, 2],
      [72, 0, 1.5], [69, 1.5, 0.5], [72, 2, 1], [74, 3, 1],
      [71, 0, 2], [74, 2, 1], [71, 3, 1],
    ];
    const bars = [];
    let k = 0;
    for (let b = 0; b < 8; b++) {
      bars.push([]);
      let beat = 0;
      while (k < melody.length && beat < 4) {
        bars[b].push(melody[k]);
        beat = melody[k][1] + melody[k][2];
        k++;
      }
    }

    const beatLen = 60 / 96;
    let bar = 0;
    let next = this.ctx.currentTime + 0.2;
    const swing = (beat) => (beat % 1 === 0.5 ? beat + 0.17 : beat);
    const tick = () => {
      while (next < this.ctx.currentTime + 1.2) {
        const [bass, chord] = chords[bar % 8];
        const walk = [bass, bass + 4, bass + 7, bass + 9];
        for (let b = 0; b < 4; b++) this.pluck(walk[b], next + b * beatLen, beatLen * 0.9, 0.11, 'sine');
        for (const b of [1, 3]) for (const n of chord) this.pluck(n, next + swing(b) * beatLen, beatLen * 0.5, 0.025, 'triangle');
        for (const [n, at, len] of bars[bar % 8]) this.pluck(n + 12, next + swing(at) * beatLen, len * beatLen * 0.9, 0.035, 'triangle');
        this.brush(next, beatLen);
        next += 4 * beatLen;
        bar++;
      }
    };
    tick();
    setInterval(tick, 300);
  }

  pluck(midi, when, len, vol, type) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.12, len));
    osc.connect(g).connect(this.music);
    osc.start(when);
    osc.stop(when + len + 0.05);
  }

  brush(when, beatLen) {
    const ctx = this.ctx;
    if (!this.brushBuf) this.brushBuf = this.noiseBuffer(0.3);
    for (let b = 0; b < 4; b++) {
      const src = ctx.createBufferSource();
      src.buffer = this.brushBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5000;
      const g = ctx.createGain();
      const t = when + b * beatLen;
      g.gain.setValueAtTime(b % 2 ? 0.02 : 0.012, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(hp).connect(g).connect(this.music);
      src.start(t);
      src.stop(t + 0.15);
    }
  }
}
