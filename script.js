/* ======================================================
   NeonCalc — JavaScript
   Calculator engine, Web Audio API sounds, confetti,
   particles, history, easter egg, keyboard support
   ====================================================== */

(function () {
  'use strict';

  /* ---------- DOM References ---------- */
  const $ = (s) => document.querySelector(s);
  const expressionEl = $('#expression');
  const resultEl = $('#result');
  const motivationEl = $('#motivation');
  const themeToggle = $('#theme-toggle');
  const soundToggle = $('#sound-toggle');
  const historyToggle = $('#history-toggle');
  const historyPanel = $('#history-panel');
  const historyList = $('#history-list');
  const historyClear = $('#history-clear');
  const buttonGrid = $('#button-grid');
  const particleCanvas = $('#particle-canvas');
  const confettiCanvas = $('#confetti-canvas');
  const calculator = $('#calculator');

  /* ---------- State ---------- */
  let currentInput = '';
  let lastExpression = '';
  let hasResult = false;
  let soundEnabled = true;
  const history = [];
  const MAX_HISTORY = 5;
  let easterEggBuffer = '';

  /* ====================================================
     AUDIO — Web Audio API
     ==================================================== */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, duration, type = 'sine', volume = 0.12) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) { /* silent fail */ }
  }

  const Sound = {
    number()   { playTone(600 + Math.random() * 200, 0.08, 'sine', 0.10); },
    operator() { playTone(440, 0.10, 'square', 0.06); },
    equals()   { playTone(880, 0.15, 'sine', 0.10); setTimeout(() => playTone(1100, 0.18, 'sine', 0.08), 100); },
    clear()    { playTone(300, 0.12, 'triangle', 0.10); },
    error()    { playTone(200, 0.25, 'sawtooth', 0.08); },
    easter()   { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.18, 'sine', 0.12), i * 120)); },
  };

  /* ====================================================
     CALCULATOR ENGINE
     ==================================================== */
  function sanitize(expr) {
    // Replace display symbols with JS operators
    return expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');
  }

  function evaluate(expr) {
    // Handle percentage: convert trailing % to /100
    let processed = expr.replace(/(\d+\.?\d*)%/g, '($1/100)');
    // Safety: only allow digits, operators, parentheses, dots
    if (/[^0-9+\-*/().% ]/.test(processed)) throw new Error('Invalid');
    // Prevent division by zero edge representation
    const result = Function('"use strict"; return (' + processed + ')')();
    if (!isFinite(result)) throw new Error('Infinity');
    return result;
  }

  function formatResult(num) {
    if (Number.isInteger(num) && Math.abs(num) < 1e15) return num.toString();
    const fixed = parseFloat(num.toPrecision(10));
    const str = fixed.toString();
    return str.length > 14 ? num.toExponential(6) : str;
  }

  /* ====================================================
     INPUT HANDLING
     ==================================================== */
  function appendValue(val) {
    if (hasResult && /[0-9.]/.test(val)) {
      currentInput = '';
      expressionEl.textContent = '';
      hasResult = false;
    }
    if (hasResult && /[+\-*/%]/.test(val)) {
      hasResult = false;
    }

    // Prevent double operators
    if (/[+\-*/%]$/.test(currentInput) && /[+\-*/%]/.test(val)) {
      currentInput = currentInput.slice(0, -1);
    }

    // Prevent multiple dots in one number
    if (val === '.') {
      const parts = currentInput.split(/[+\-*/%]/);
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('.')) return;
    }

    currentInput += val;
    expressionEl.textContent = prettify(currentInput);
    resultEl.classList.remove('glow');
  }

  function prettify(expr) {
    return expr
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ')
      .replace(/\-/g, ' − ')
      .replace(/\+/g, ' + ')
      .replace(/%/g, '%');
  }

  function calculate() {
    if (!currentInput) return;
    try {
      const sanitized = sanitize(currentInput);
      const result = evaluate(sanitized);
      const formatted = formatResult(result);
      lastExpression = prettify(currentInput) + ' =';
      expressionEl.textContent = lastExpression;
      resultEl.textContent = formatted;
      resultEl.classList.add('glow');
      hasResult = true;

      Sound.equals();
      addHistory(prettify(currentInput), formatted);
      showMotivation();

      // Confetti for 100 or 1000
      if (result === 100 || result === 1000) {
        launchConfetti();
      }

      currentInput = formatted;
    } catch (e) {
      triggerShake();
      Sound.error();
    }
  }

  function clearAll() {
    currentInput = '';
    expressionEl.textContent = '';
    resultEl.textContent = '0';
    resultEl.classList.remove('glow');
    hasResult = false;
    Sound.clear();
  }

  function backspace() {
    if (hasResult) return clearAll();
    currentInput = currentInput.slice(0, -1);
    expressionEl.textContent = prettify(currentInput);
    if (!currentInput) resultEl.textContent = '0';
  }

  /* ====================================================
     BUTTON CLICKS & RIPPLE
     ==================================================== */
  buttonGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    createRipple(e, btn);
    const val = btn.dataset.value;
    handleInput(val, btn);
  });

  function handleInput(val, btn) {
    // Easter egg tracking
    if (/[0-9]/.test(val)) easterEggBuffer += val;
    else easterEggBuffer = '';
    if (easterEggBuffer.endsWith('12345')) triggerEasterEgg();

    if (val === 'AC') return clearAll();
    if (val === 'backspace') return backspace();
    if (val === '=') return calculate();

    // Sound
    if (/[0-9.]/.test(val)) Sound.number();
    else Sound.operator();

    appendValue(val);
  }

  function createRipple(e, btn) {
    const circle = document.createElement('span');
    circle.classList.add('ripple-circle');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    circle.style.width = circle.style.height = size + 'px';
    circle.style.left = (e.clientX - rect.left - size / 2) + 'px';
    circle.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(circle);
    circle.addEventListener('animationend', () => circle.remove());
  }

  /* ====================================================
     KEYBOARD SUPPORT
     ==================================================== */
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (/^[0-9.]$/.test(key)) {
      e.preventDefault();
      handleInput(key, null);
      highlightBtn(key);
    } else if (['+', '-', '*', '/'].includes(key)) {
      e.preventDefault();
      handleInput(key, null);
      Sound.operator();
    } else if (key === '%') {
      e.preventDefault();
      handleInput('%', null);
      Sound.operator();
    } else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      handleInput('=', null);
    } else if (key === 'Backspace') {
      e.preventDefault();
      backspace();
    } else if (key === 'Escape' || key === 'Delete') {
      e.preventDefault();
      clearAll();
    }
  });

  function highlightBtn(val) {
    const btn = document.querySelector(`.btn[data-value="${val}"]`);
    if (!btn) return;
    btn.style.transform = 'translateY(-3px) scale(1.06)';
    setTimeout(() => btn.style.transform = '', 150);
  }

  /* ====================================================
     SHAKE ANIMATION
     ==================================================== */
  function triggerShake() {
    calculator.classList.add('shake');
    calculator.addEventListener('animationend', () => calculator.classList.remove('shake'), { once: true });
  }

  /* ====================================================
     MOTIVATIONAL TEXT
     ==================================================== */
  const MOTIVATIONS = [
    'Nice! 🔥', 'Smart move! 🧠', 'You got this! 💪', 'Math genius! ✨',
    'Brilliant! 🌟', 'Keep going! 🚀', 'Nailed it! 🎯', 'Smooth! 😎',
    'Big brain! 🧮', 'Calculated! 📐', 'Easy peasy! 🍋', 'On point! 🎯',
    'Impressive! 👏', 'Legend! 🏆', 'Boom! 💥',
  ];

  function showMotivation() {
    const msg = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    motivationEl.textContent = msg;
    motivationEl.classList.remove('show');
    // trigger reflow
    void motivationEl.offsetWidth;
    motivationEl.classList.add('show');
    setTimeout(() => motivationEl.classList.remove('show'), 2500);
  }

  /* ====================================================
     HISTORY
     ==================================================== */
  function addHistory(expr, result) {
    history.unshift({ expr, result });
    if (history.length > MAX_HISTORY) history.pop();
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    history.forEach(({ expr, result }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="hist-expr">${expr}</span><span class="hist-result">= ${result}</span>`;
      historyList.appendChild(li);
    });
  }

  historyToggle.addEventListener('click', () => {
    historyPanel.classList.toggle('hidden');
    historyPanel.classList.toggle('open');
  });

  historyClear.addEventListener('click', () => {
    history.length = 0;
    renderHistory();
  });

  /* ====================================================
     THEME TOGGLE
     ==================================================== */
  themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  });

  /* ====================================================
     SOUND TOGGLE
     ==================================================== */
  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    document.body.classList.toggle('sound-off', !soundEnabled);
  });

  /* ====================================================
     CONFETTI 🎉
     ==================================================== */
  const confCtx = confettiCanvas.getContext('2d');
  let confettiParts = [];
  let confettiRunning = false;

  function resizeCanvas(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function launchConfetti() {
    resizeCanvas(confettiCanvas);
    confettiParts = [];
    const colors = ['#a855f7', '#6366f1', '#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb923c'];
    for (let i = 0; i < 150; i++) {
      confettiParts.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * confettiCanvas.height * 0.4 - confettiCanvas.height * 0.1,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 2,
        rot: Math.random() * 360,
        rv: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }
    if (!confettiRunning) {
      confettiRunning = true;
      animateConfetti();
    }
  }

  function animateConfetti() {
    confCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParts.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.rot += p.rv;
      p.opacity -= 0.006;
      if (p.opacity <= 0) return;
      confCtx.save();
      confCtx.translate(p.x, p.y);
      confCtx.rotate((p.rot * Math.PI) / 180);
      confCtx.globalAlpha = Math.max(0, p.opacity);
      confCtx.fillStyle = p.color;
      confCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      confCtx.restore();
    });
    confettiParts = confettiParts.filter((p) => p.opacity > 0);
    if (confettiParts.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      confettiRunning = false;
      confCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  /* ====================================================
     PARTICLE BACKGROUND
     ==================================================== */
  const ptCtx = particleCanvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 45;

  function initParticles() {
    resizeCanvas(particleCanvas);
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * particleCanvas.width,
        y: Math.random() * particleCanvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.35 + 0.08,
      });
    }
  }

  function drawParticles() {
    ptCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const baseColor = isDark ? '255,255,255' : '100,60,180';

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = particleCanvas.width;
      if (p.x > particleCanvas.width) p.x = 0;
      if (p.y < 0) p.y = particleCanvas.height;
      if (p.y > particleCanvas.height) p.y = 0;

      ptCtx.beginPath();
      ptCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ptCtx.fillStyle = `rgba(${baseColor}, ${p.alpha})`;
      ptCtx.fill();
    });

    // Draw lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ptCtx.beginPath();
          ptCtx.moveTo(particles[i].x, particles[i].y);
          ptCtx.lineTo(particles[j].x, particles[j].y);
          ptCtx.strokeStyle = `rgba(${baseColor}, ${0.06 * (1 - dist / 120)})`;
          ptCtx.lineWidth = 0.6;
          ptCtx.stroke();
        }
      }
    }

    requestAnimationFrame(drawParticles);
  }

  /* ====================================================
     EASTER EGG — typing 12345
     ==================================================== */
  function triggerEasterEgg() {
    easterEggBuffer = '';
    Sound.easter();
    calculator.classList.add('easter-egg-active');
    launchConfetti();
    motivationEl.textContent = '🎉 Easter Egg! You found it! 🥚';
    motivationEl.classList.remove('show');
    void motivationEl.offsetWidth;
    motivationEl.classList.add('show');
    setTimeout(() => {
      calculator.classList.remove('easter-egg-active');
      motivationEl.classList.remove('show');
    }, 2500);
  }

  /* ====================================================
     INIT
     ==================================================== */
  window.addEventListener('resize', () => {
    resizeCanvas(particleCanvas);
    resizeCanvas(confettiCanvas);
  });

  initParticles();
  drawParticles();
})();
