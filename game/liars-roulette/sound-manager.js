// Web Audio API Context
/* export const audioCtx = new (
  window.AudioContext || window.webkitAudioContext
)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
masterGain.gain.value = 0.5;

const SoundGen = {
  createNoiseBuffer: function () {
    if (this.noiseBuffer) return this.noiseBuffer;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  },
  gun: function () {
    const t = audioCtx.currentTime;
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(1000, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.5);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.5);

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(1, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  },
  click: function () {
    const t = audioCtx.currentTime;
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(1500, t);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.1);

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, t);
    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  },
  card: function () {
    const t = audioCtx.currentTime;
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1200, t + 0.1);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.1);
  },
  deal: function () {
    const t = audioCtx.currentTime;
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    noise.connect(gain);
    gain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 0.05);
  },
  select: function () {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  },
  drama: function () {
    const t = audioCtx.currentTime;
    this.playLowImpact(t);
    this.playLowImpact(t + 0.2);
  },
  playLowImpact: function (t) {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(10, t + 0.8);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.8);
  },
  heartbeat: function () {
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  },
  cheer: function () {
    const t = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + i * 0.15);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.1, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 1.0);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 1.0);
    });
    const noise = audioCtx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 1000;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 2.5);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(t);
    noise.stop(t + 2.5);
  },
  devil: function () {
    const t = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(50, t);
    osc1.frequency.linearRampToValueAtTime(30, t + 2.0);
    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.4, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + 2.0);

    const osc2 = audioCtx.createOscillator();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(60, t);
    osc2.frequency.linearRampToValueAtTime(40, t + 2.0);
    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.2, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 2.0);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t);
    osc2.stop(t + 2.0);
  },
};

export function playSound(type) {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  const slider = document.getElementById("volume-slider");
  const vol = slider ? parseFloat(slider.value) : 0.5;

  const audioEl = document.getElementById(`sfx-${type}`);
  if (audioEl) {
    audioEl.volume = type === "devil" ? vol * 0.3 : vol;
    audioEl.currentTime = 0;
    audioEl.play().catch((e) => console.log("Audio play failed:", e));
    return;
  }

  if (SoundGen[type]) {
    SoundGen[type]();
  }
}

export function playBGM(type) {
  const mainBgm = document.getElementById("bgm-main");
  const rouletteBgm = document.getElementById("bgm-roulette");
  const slider = document.getElementById("volume-slider");
  const vol = slider ? parseFloat(slider.value) : 0.5;
  const bgmVol = vol * 0.1;

  if (type === "main") {
    if (rouletteBgm) {
      rouletteBgm.pause();
      rouletteBgm.currentTime = 0;
    }
    if (mainBgm) {
      mainBgm.volume = bgmVol;
      if (mainBgm.paused) mainBgm.play().catch(() => {});
    }
  } else if (type === "roulette") {
    if (mainBgm) {
      mainBgm.pause();
    }
    if (rouletteBgm) {
      rouletteBgm.volume = bgmVol;
      if (rouletteBgm.paused) rouletteBgm.play().catch(() => {});
    }
  }
}

export function setupUISounds() {
  const uiButtons = document.querySelectorAll("button, .btn, .btn-icon");
  uiButtons.forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (!btn.disabled) playSound("select");
    });
    btn.addEventListener("click", () => {
      if (!btn.disabled) playSound("deal");
    });
  });
}
