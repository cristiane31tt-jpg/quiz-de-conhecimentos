/* Sons gerados com Web Audio API (sem arquivos externos). */

const SoundFX = {
    ctx: null,
    enabled: true,
    storageKey: 'quiz_sfx_enabled',

    init: function () {
        this.enabled = readFlag(this.storageKey, true);
        // Cria o contexto apenas no primeiro gesto do usuario (politica de autoplay).
        const unlock = this.unlock.bind(this);
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
    },

    unlock: function () {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        try {
            this.ctx = new Ctor();
        } catch (e) {
            this.ctx = null;
        }
    },

    isEnabled: function () {
        return this.enabled;
    },

    toggle: function () {
        this.enabled = !this.enabled;
        writeFlag(this.storageKey, this.enabled);
        return this.enabled;
    },

    tone: function (freq, startOffset, duration, peak) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + startOffset;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    },

    play: function (type) {
        if (!this.enabled) return;
        if (!this.ctx) this.unlock();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        try {
            if (type === 'correct') {
                this.tone(660, 0, 0.12, 0.18);
                this.tone(990, 0.09, 0.16, 0.15);
            } else if (type === 'wrong') {
                this.tone(300, 0, 0.16, 0.12);
                this.tone(210, 0.11, 0.2, 0.1);
            } else if (type === 'finish') {
                this.tone(523, 0, 0.14, 0.14);
                this.tone(659, 0.12, 0.14, 0.14);
                this.tone(784, 0.24, 0.14, 0.14);
                this.tone(1046, 0.36, 0.26, 0.13);
            }
        } catch (e) {
            /* audio indisponivel: o quiz continua normalmente */
        }
    }
};

function readFlag(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        return raw === '1';
    } catch (e) {
        return fallback;
    }
}

function writeFlag(key, value) {
    try {
        window.localStorage.setItem(key, value ? '1' : '0');
    } catch (e) {
        /* armazenamento indisponivel */
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundFX;
}