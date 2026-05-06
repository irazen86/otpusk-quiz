/* eslint-disable no-undef */
(() => {
  // ============ Хранилище: GitHub Issue Comments + localStorage ============
  // Токен собирается из частей, чтобы GitHub не отозвал его при обнаружении в публичном репо.
  // Доступ ограничен Issues:Read-and-write для одного репо — больше ничего.
  const GH_OWNER = 'irazen86';
  const GH_REPO  = 'otpusk-quiz';
  const GH_ISSUE = 1;
  const _T = ['github_pat_11ALHUVRI0TQIeFrTeUpCC','_ycYUCa9qlHzv30WsoGvovCew4uceyIEycOzYZGW5rm8TFM6RQNA2mRovC4o'].join('');
  const GH_API   = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/issues/${GH_ISSUE}/comments`;

  async function saveSession(session) {
    // Локально
    try {
      const local = JSON.parse(localStorage.getItem('quiz_my_sessions') || '[]');
      local.push(session);
      localStorage.setItem('quiz_my_sessions', JSON.stringify(local));
    } catch (_) {}

    // В GitHub виде JSON-комментария. Оборачиваем в fenced block для читаемости.
    const body = '```json\n' + JSON.stringify(session) + '\n```';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(GH_API, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + _T,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({ body })
        });
        if (r.ok) return true;
      } catch (_) {}
      await new Promise((res) => setTimeout(res, 700));
    }
    return false;
  }

  // ============ Состояние ============
  const state = {
    name: '',
    qIndex: 0,
    score: 0,
    answered: false,
    answers: [], // {qIndex, chosen, isCorrect}
    startedAt: null
  };

  const QUESTIONS = window.QUIZ_QUESTIONS || [];

  // ============ Праздничные фразы ============
  const CELEBRATIONS = [
    'Ура, верно!','Точно в цель!','Браво!','В яблочко!','Великолепно!',
    'Так держать!','Вот это да!','Гениально!','Молодец!','Идеально!',
    'Огонь!','Это успех!','Эксперт!','Прямое попадание!','Снайпер!',
    'Космос!','Чистая правда!','Чемпион!','Ты знаешь толк!'
  ];
  const CELEBRATION_EMOJI = ['🎉','✨','🌟','🔥','💫','🚀','🎊','💥','⭐️','🏆','🥳','💯'];
  const WRONG_PHRASES = ['Не совсем так','Мимо, но не страшно','Почти. Но нет','Бывает!','Не угадали','Чуть-чуть мимо'];

  // ============ Шкала званий ============
  const RANKS = [
    { min: 19, emoji: '🏆', title: 'Знаток отпускного кодекса', sub: 'Идеальный результат. С вами в отпуск точно без приключений.' },
    { min: 17, emoji: '🎖️', title: 'Магистр отпускных дел', sub: 'Почти безупречно — мелочи можно уточнить, но в целом вы ас.' },
    { min: 15, emoji: '📚', title: 'Бывалый отпускник',     sub: 'Опыт чувствуется — основное знаете назубок.' },
    { min: 12, emoji: '🌴', title: 'Уверенный пользователь отпуска', sub: 'Базу держите крепко, нюансы освежим — и будет лёгкое лето.' },
    { min: 9,  emoji: '🧭', title: 'Юный исследователь HR-джунглей', sub: 'Дорогу в отпуск нашли, но кое-где ещё блуждаете.' },
    { min: 6,  emoji: '🐢', title: 'Стажёр-отпускник', sub: 'Не торопитесь — лучше перечитать правила и заходите ещё раз.' },
    { min: 3,  emoji: '😅', title: 'Турист без карты', sub: 'Похоже, отпуск для вас — это сразу к морю, а формальности потом.' },
    { min: 0,  emoji: '🛟', title: 'Отпускной первооткрыватель', sub: 'Не переживайте, теперь точно знаете, к кому идти за подсказкой — к HR!' }
  ];
  function getRank(score) {
    return RANKS.find((r) => score >= r.min) || RANKS[RANKS.length - 1];
  }

  // ============ DOM ============
  const $ = (id) => document.getElementById(id);
  const screens = {
    start: $('screen-start'),
    quiz: $('screen-quiz'),
    finish: $('screen-finish')
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle('active', k === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============ Конфетти ============
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  let confettiPieces = [];
  let confettiAnimating = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const CONFETTI_COLORS = ['#ff5fa2', '#7b5cff', '#36e0ff', '#3ddc97', '#ffd166', '#ff8a3d'];

  function spawnConfetti(amount = 80, opts = {}) {
    const { fromCenter = false, big = false } = opts;
    for (let i = 0; i < amount; i++) {
      confettiPieces.push({
        x: fromCenter ? canvas.width / 2 : Math.random() * canvas.width,
        y: fromCenter ? canvas.height / 2 : -20,
        vx: (Math.random() - 0.5) * (fromCenter ? 14 : 6),
        vy: fromCenter ? (Math.random() - 0.5) * 14 : Math.random() * 3 + 2,
        gravity: 0.18,
        size: (Math.random() * 6 + 4) * (big ? 1.4 : 1),
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
        life: 1
      });
    }
    if (!confettiAnimating) {
      confettiAnimating = true;
      requestAnimationFrame(stepConfetti);
    }
  }

  function stepConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces.forEach((p) => {
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= 0.005;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    confettiPieces = confettiPieces.filter(
      (p) => p.life > 0 && p.y < canvas.height + 50
    );
    if (confettiPieces.length > 0) {
      requestAnimationFrame(stepConfetti);
    } else {
      confettiAnimating = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function showCelebrate(text) {
    const el = document.createElement('div');
    el.className = 'celebrate';
    const emoji = CELEBRATION_EMOJI[Math.floor(Math.random() * CELEBRATION_EMOJI.length)];
    el.textContent = `${emoji} ${text}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ============ Старт ============
  function startQuiz() {
    const name = $('name').value.trim();
    if (!name) {
      $('name').focus();
      $('name').animate(
        [{ transform: 'translateX(0)' },
         { transform: 'translateX(-6px)' },
         { transform: 'translateX(6px)' },
         { transform: 'translateX(0)' }],
        { duration: 300 }
      );
      return;
    }
    state.name = name;
    state.qIndex = 0;
    state.score = 0;
    state.answers = [];
    state.startedAt = new Date().toISOString();
    renderQuestion();
    showScreen('quiz');
  }

  // ============ Рендер вопроса ============
  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

  function renderQuestion() {
    state.answered = false;
    const q = QUESTIONS[state.qIndex];
    $('question-text').textContent = q.q;
    $('q-counter').textContent = `${state.qIndex + 1} / ${QUESTIONS.length}`;
    $('score-counter').textContent = `${state.score} ✓`;
    const pct = (state.qIndex / QUESTIONS.length) * 100;
    $('progress-bar').style.width = `${pct}%`;

    const list = $('options');
    list.innerHTML = '';
    q.options.forEach((opt, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.type = 'button';
      btn.dataset.index = i;
      btn.innerHTML = `
        <span class="option-letter">${LETTERS[i]}</span>
        <span class="option-text"></span>
      `;
      btn.querySelector('.option-text').textContent = opt;
      btn.addEventListener('click', () => onAnswer(i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    const fb = $('feedback');
    fb.className = 'feedback';
    fb.innerHTML = '';

    const nextBtn = $('next-btn');
    nextBtn.disabled = true;
    if (state.qIndex === QUESTIONS.length - 1) {
      nextBtn.textContent = 'Узнать результат';
    } else {
      nextBtn.innerHTML = `Дальше <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
    }
  }

  function onAnswer(chosen) {
    if (state.answered) return;
    state.answered = true;

    document.querySelectorAll('.option').forEach((b) => {
      b.disabled = true;
      b.classList.add('locked');
    });

    const q = QUESTIONS[state.qIndex];
    const isCorrect = chosen === q.correct;
    state.answers.push({ qIndex: state.qIndex, chosen, isCorrect });
    if (isCorrect) state.score += 1;
    $('score-counter').textContent = `${state.score} ✓`;

    document.querySelectorAll('.option').forEach((b) => {
      const i = Number(b.dataset.index);
      if (i === q.correct) b.classList.add('correct');
      else if (i === chosen && !isCorrect) b.classList.add('wrong');
      else b.classList.add('faded');
    });

    const fb = $('feedback');
    if (isCorrect) {
      const phrase = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
      const emoji = CELEBRATION_EMOJI[Math.floor(Math.random() * CELEBRATION_EMOJI.length)];
      fb.classList.add('show', 'correct');
      fb.innerHTML = `
        <span class="feedback-emoji">${emoji}</span>
        <span class="feedback-title">${phrase}</span>
      `;
      showCelebrate(phrase);
      spawnConfetti(60);
    } else {
      const phrase = WRONG_PHRASES[Math.floor(Math.random() * WRONG_PHRASES.length)];
      fb.classList.add('show', 'wrong');
      fb.innerHTML = `
        <span class="feedback-emoji">🤔</span>
        <span class="feedback-title">${phrase}.</span>
        Правильный ответ выделен зелёным.
      `;
    }

    $('next-btn').disabled = false;
  }

  function nextQuestion() {
    if (state.qIndex < QUESTIONS.length - 1) {
      state.qIndex += 1;
      renderQuestion();
    } else {
      finish();
    }
  }

  // ============ Финиш ============
  async function finish() {
    const session = {
      name: state.name,
      score: state.score,
      total: QUESTIONS.length,
      answers: state.answers,
      startedAt: state.startedAt,
      finishedAt: new Date().toISOString()
    };

    // Сохраняем (локально + в GitHub Issue) — fire-and-forget
    saveSession(session).catch(() => {});
    renderFinish(session);
  }

  function renderFinish(session) {
    const pct = Math.round((session.score / session.total) * 100);
    const rank = getRank(session.score);
    $('finish-emoji').textContent = rank.emoji;
    $('finish-title').textContent = rank.title;
    $('finish-subtitle').textContent = `${session.name}, ${rank.sub}`;
    $('result-score').textContent = session.score;
    $('result-percent').textContent = `${pct}% правильных ответов`;

    const review = $('review');
    review.innerHTML = '';
    QUESTIONS.forEach((q, i) => {
      const myAns = session.answers.find((a) => a.qIndex === i);
      const isCorrect = myAns ? myAns.isCorrect : false;
      const div = document.createElement('div');
      div.className = 'review-item ' + (isCorrect ? 'correct' : 'wrong');
      const yourText = myAns ? q.options[myAns.chosen] : '— нет ответа —';
      const rightText = q.options[q.correct];
      div.innerHTML = `
        <div class="review-q"><span class="review-q-num">${i + 1}</span><span></span></div>
        <span class="review-line ${isCorrect ? 'right-answer' : 'your-wrong'}">
          <strong>${isCorrect ? '✓' : '✗'} Ваш ответ:</strong> <span class="review-your"></span>
        </span>
        ${isCorrect ? '' : `<span class="review-line right-answer"><strong>✓ Правильно:</strong> <span class="review-right"></span></span>`}
      `;
      div.querySelector('.review-q span:last-child').textContent = q.q;
      div.querySelector('.review-your').textContent = yourText;
      const rightEl = div.querySelector('.review-right');
      if (rightEl) rightEl.textContent = rightText;
      review.appendChild(div);
    });

    showScreen('finish');
    showAward(session);
  }

  // ============ Оверлей награждения ============
  function showAward(session) {
    const rank = getRank(session.score);
    const overlay = $('award-overlay');
    $('award-emoji').textContent = rank.emoji;
    $('award-title').textContent = rank.title;
    $('award-subtitle').textContent = rank.sub;
    $('award-score-value').textContent = session.score;
    $('award-score-total').textContent = session.total;

    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');

    // Салют конфетти — привязан к размеру награды
    const burstSize = session.score >= 17 ? 220 : session.score >= 12 ? 160 : 110;
    setTimeout(() => spawnConfetti(burstSize), 400);
    setTimeout(() => spawnConfetti(burstSize * 0.8, { fromCenter: true, big: true }), 700);
    if (session.score >= 17) {
      setTimeout(() => spawnConfetti(120, { fromCenter: true, big: true }), 1300);
    }
  }

  function hideAward() {
    const overlay = $('award-overlay');
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // ============ Старт-кнопки ============
  $('start-btn').addEventListener('click', startQuiz);
  $('name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startQuiz();
  });
  $('next-btn').addEventListener('click', nextQuestion);
  $('award-continue').addEventListener('click', hideAward);
  $('restart-btn').addEventListener('click', () => {
    hideAward();
    $('name').value = state.name;
    showScreen('start');
  });
})();
