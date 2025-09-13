(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.expand(); // занять максимум места
  }

  // --- helpers ---
  function decodePayload(encoded) {
    try {
      const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to decode payload', e);
      return null;
    }
  }

  // Получаем ?data=...
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('data');
  const payload = encoded ? decodePayload(encoded) : null;

  // Состояние
  let steps = Array.isArray(payload?.steps) ? payload.steps : [];
  let answer = payload?.answer ?? '';
  let idx = 0;

  // DOM
  const stepsContainer = document.getElementById('stepsContainer');
  const answerCard = document.getElementById('answerCard');
  const answerContainer = document.getElementById('answerContainer');
  const statusEl = document.getElementById('status');
  const nextBtn = document.getElementById('nextBtn');
  const answerBtn = document.getElementById('answerBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  function renderMath(el) {
    // перерендерим LaTeX в элементе
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([el]).catch(err => console.error(err));
    }
  }

  function appendStep(content) {
    const div = document.createElement('div');
    div.className = 'step';
    // Шаг может содержать LaTeX — оставляем как есть, MathJax отрендерит
    div.innerHTML = content;
    stepsContainer.appendChild(div);
    renderMath(div);
  }

  function showNextStep() {
    if (idx < steps.length) {
      appendStep(steps[idx]);
      idx += 1;
      statusEl.textContent = `Показано подсказок: ${idx}/${steps.length}`;
      if (tg) {
        tg.sendData(JSON.stringify({
          action: 'next_step',
          shown: idx,
          total: steps.length,
          original_message_id: payload?.original_message_id
        }));
      }
      if (idx >= steps.length) {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Подсказки закончились';
      }
    }
  }

  function showAnswer() {
    if (!answerCard.style.display || answerCard.style.display === 'none') {
      answerCard.style.display = 'block';
      answerContainer.innerHTML = answer;
      renderMath(answerContainer);
      if (tg) {
        tg.sendData(JSON.stringify({
          action: 'show_answer',
          original_message_id: payload?.original_message_id
        }));
      }
    }
  }

  function cancel() {
    if (tg) {
      tg.sendData(JSON.stringify({
        action: 'cancel',
        original_message_id: payload?.original_message_id
      }));
      tg.close();
    } else {
      window.close();
    }
  }

  // Инициализация
  if (!payload) {
    statusEl.textContent = 'Не удалось загрузить данные решения.';
    nextBtn.disabled = true;
    answerBtn.disabled = true;
    cancelBtn.disabled = false;
  } else {
    statusEl.textContent = 'Готово к показу подсказок.';
    if (steps.length === 0) {
      nextBtn.disabled = true;
      nextBtn.textContent = 'Нет подсказок';
    }
  }

  // Слушатели
  nextBtn.addEventListener('click', showNextStep);
  answerBtn.addEventListener('click', showAnswer);
  cancelBtn.addEventListener('click', cancel);
})();
