(function () {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.expand(); // занять максимум места
  }

  // --- helpers ---
  function addBase64Padding(s) {
    const pad = s.length % 4;
    return pad ? s + "====".slice(pad) : s;
  }

  function base64UrlToBytes(s) {
    // URL-safe -> обычный base64
    const b64 = addBase64Padding(s.replace(/-/g, '+').replace(/_/g, '/'));
    // atob -> строка в Latin-1 c кодами байт 0..255
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function decodePayload(encoded) {
    try {
      const bytes = base64UrlToBytes(encoded);
      // корректно собираем UTF-8
      const text = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(text);
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

  function setAnswer(content) {
    // чистим контейнер (если кликнут повторно — ничего не сломается)
    answerContainer.innerHTML = '';

    // делаем содержимое «как у подсказки»: обычный HTML, рендер MathJax
    const div = document.createElement('div');
    div.className = 'step';     // тот же стиль, что и у подсказок
    div.innerHTML = content;    // если у вас текст, можно обернуть в <p> или экранировать
    answerContainer.appendChild(div);

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([answerContainer]).catch(console.error);
    }
  }

  let answerShown = false;
  function showAnswer() {
    if (answerShown) return;

    // поддержка массива ответа
    let rendered = answer;
    if (Array.isArray(rendered)) rendered = rendered.join('<br/>');
    if (typeof rendered !== 'string') rendered = String(rendered ?? '');

    setAnswer(rendered);

    answerCard.style.display = 'block';
    answerShown = true;
    answerBtn.disabled = true;
    answerBtn.textContent = 'Ответ показан';

    if (tg) {
      tg.sendData(JSON.stringify({
        action: 'show_answer',
        original_message_id: payload?.original_message_id
      }));
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
