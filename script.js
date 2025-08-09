/*************************************************
 * TaskGarden – Versión simple (sin módulos)
 * - Sin Manifest / Service Worker
 * - 100% localStorage
 * - Mejoras: confirmación borrar, sonido opcional, auto tema, atajos, contador diario
 **************************************************/

// ====== Helpers/Estado ======
const LS_KEY = 'tg_state_v2';

function defaultState() {
  return {
    tasks: [],               // {id, texto, completada, space, fecha, notas}
    emotions: {},            // {'YYYY-MM-DD': 'feliz'|'triste'|'estresado'|'calmo'}
    settings: {
      dayMode: false,        // si autoTheme = false, este controla el tema
      autoTheme: true,       // auto día/noche por hora
      background: 'default',
      avatar: 'default',
      soundOn: true,
      pinEnabled: false,
      pin: ''
    },
    frequentTasks: []        // últimas 10 agregadas
  };
}

let state = loadState();
let currentSpace = 'personal';
let emocionActual = 'feliz';
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let pomodoroInterval = null;
let pomodoroTime = 25 * 60; // seg
let completionOsc = null;    // WebAudio “beep”

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch {
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ====== DOM ======
const avatarEmocional = document.getElementById('avatar-emocional');
const modoCalmaBtn = document.getElementById('modo-calma-btn');
const darkToggleBtn = document.getElementById('day-night-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsSection = document.getElementById('settings-section');
const backgroundSelector = document.getElementById('background-selector');
const avatarSelector = document.getElementById('avatar-selector');
const autoThemeToggle = document.getElementById('auto-theme-toggle');
const soundToggle = document.getElementById('sound-toggle');

const floatingAddBtn = document.getElementById('floating-add-btn');
const focusModeModal = document.getElementById('focus-mode');
const focusTask = document.getElementById('focus-task');
const pomodoroTimer = document.getElementById('pomodoro-timer');
const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
const statsSection = document.getElementById('stats-section');
const semanaResumen = document.getElementById('semana-resumen');
const todayCounter = document.getElementById('today-counter');

const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const taskList = document.getElementById('task-list');

const emocionCards = document.querySelectorAll('.emocion-card');
const spaceBtns = document.querySelectorAll('.space-btn');

const calendarGrid = document.getElementById('calendar-grid');
const calendarMonth = document.getElementById('calendar-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const calendarTasks = document.getElementById('calendar-tasks');

const dayModal = document.getElementById('day-modal');
const modalCloses = document.querySelectorAll('.modal-close');
const modalDate = document.getElementById('modal-date');
const modalEmotion = document.getElementById('modal-emotion');
const modalNotification = document.getElementById('modal-notification');
const modalTasks = document.getElementById('modal-tasks');
const modalTaskInput = document.getElementById('modal-task-input');
const modalAddTaskBtn = document.getElementById('modal-add-task-btn');
const modalTaskNotes = document.getElementById('modal-task-notes');

const openAntistressBtn = document.getElementById('open-antistress-btn');
const antistressModal = document.getElementById('antistress-modal');
const closeAntistressModal = document.getElementById('close-antistress-modal');
const antistressContainer = document.getElementById('antistress-bubbles-container');

const pinModal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinSubmitBtn = document.getElementById('pin-submit-btn');
const pinSetBtn = document.getElementById('pin-set-btn');
const pinDisableBtn = document.getElementById('pin-disable-btn');
const openPinBtn = document.getElementById('open-pin-btn');

// ====== UI Utils ======
function animarElemento(el, clase) {
  if (!el) return;
  el.classList.add(clase);
  el.addEventListener('animationend', () => el.classList.remove(clase), { once: true });
}
function setHidden(el, hidden) { if (!el) return; el.classList.toggle('hidden', !!hidden); }

// ====== Tema día/noche ======
function autoThemeApplyByHour() {
  const hr = new Date().getHours();
  const isDay = hr >= 7 && hr < 19;
  state.settings.dayMode = isDay;
}
function applyDayMode() {
  document.body.classList.toggle('day-mode', !!state.settings.dayMode);
  darkToggleBtn.textContent = state.settings.dayMode ? '🌙' : '☀️';
}
darkToggleBtn?.addEventListener('click', () => {
  if (state.settings.autoTheme) {
    // Si estaba en auto, al tocar se desactiva auto y se hace manual
    state.settings.autoTheme = false;
    autoThemeToggle.checked = false;
  }
  state.settings.dayMode = !state.settings.dayMode;
  saveState();
  applyDayMode();
  animarElemento(darkToggleBtn, 'rotate');
});

// ====== Background + Avatar ======
function applyBackground() {
  const backgrounds = {
    default: 'radial-gradient(circle at 70% 8%, #232450 0%, #191932 100%)',
    ocean: 'radial-gradient(circle at 50% 50%, #1e90ff 0%, #00b7eb 100%)',
    forest: 'radial-gradient(circle at 50% 50%, #2e8b57 0%, #228b22 100%)',
    sunset: 'radial-gradient(circle at 50% 50%, #ff4500 0%, #ff8c00 100%)'
  };
  const bg = document.querySelector('.main-bg');
  if (bg) bg.style.background = backgrounds[state.settings.background] || backgrounds.default;
}
backgroundSelector?.addEventListener('change', () => {
  state.settings.background = backgroundSelector.value;
  saveState();
  applyBackground();
});
avatarSelector?.addEventListener('change', () => {
  state.settings.avatar = avatarSelector.value;
  saveState();
  actualizarAvatarEmocional(emocionActual);
});

// ====== PIN (local) ======
function maybeLock() {
  if (state.settings.pinEnabled) {
    setHidden(pinModal, false);
  }
}
pinSubmitBtn?.addEventListener('click', () => {
  const pin = (pinInput.value || '').trim();
  if (pin && pin === state.settings.pin) {
    setHidden(pinModal, true);
    pinInput.value = '';
  } else {
    alert('PIN incorrecto.');
  }
});
pinSetBtn?.addEventListener('click', () => {
  const pin = (pinInput.value || '').trim();
  if (/^\d{4}$/.test(pin)) {
    state.settings.pin = pin;
    state.settings.pinEnabled = true;
    saveState();
    alert('PIN configurado.');
    setHidden(pinModal, true);
    pinInput.value = '';
  } else {
    alert('El PIN debe ser 4 dígitos numéricos.');
  }
});
pinDisableBtn?.addEventListener('click', () => {
  state.settings.pinEnabled = false;
  state.settings.pin = '';
  saveState();
  alert('PIN desactivado.');
  setHidden(pinModal, true);
  pinInput.value = '';
});
openPinBtn?.addEventListener('click', () => setHidden(pinModal, false));

// ====== Emociones & Avatar ======
function setEmocion(emocion) {
  emocionActual = emocion;
  const key = selectedDate || todayStr();
  state.emotions[key] = emocionActual;
  saveState();

  actualizarAvatarEmocional(emocionActual);
  emocionCards.forEach(card => card.classList.toggle('selected', card.dataset.emocion === emocionActual));
  loadSuggestedTasks();
  renderCalendar(currentMonth, currentYear);
}
emocionCards.forEach(card => card.addEventListener('click', () => setEmocion(card.dataset.emocion)));

function actualizarAvatarEmocional(emocion) {
  const avatarType = state.settings.avatar || 'default';
  const avatars = {
    default: { feliz: '😊', triste: '😢', estresado: '😣', calmo: '😌' },
    cat:     { feliz: '😺', triste: '😿', estresado: '🙀', calmo: '😸' },
    dog:     { feliz: '🐶', triste: '🐶😓', estresado: '🐶😓', calmo: '🐶😊' },
    bird:    { feliz: '🐦', triste: '🐥', estresado: '🐦😣', calmo: '🐦😌' }
  };
  avatarEmocional.textContent = (avatars[avatarType] && avatars[avatarType][emocion]) || '😊';
  avatarEmocional.classList.remove('anim');
  void avatarEmocional.offsetWidth;
  avatarEmocional.classList.add('anim');
}

// ====== Sugerencias ======
function loadSuggestedTasks() {
  const suggestions = {
    feliz: ['Celebrar con amigos', 'Hacer ejercicio', 'Escribir gratitudes'],
    triste: ['Meditar', 'Escribir en diario', 'Llamar a un amigo'],
    estresado: ['Respirar profundo', 'Tomar un descanso', 'Organizar escritorio'],
    calmo: ['Leer un libro', 'Pasear al aire libre', 'Planificar el día']
  };
  const datalist = document.getElementById('task-suggestions');
  if (!datalist) return;
  datalist.innerHTML = '';
  const uniq = new Set([...(suggestions[emocionActual] || []), ...(state.frequentTasks || [])]);
  uniq.forEach(task => {
    const option = document.createElement('option');
    option.value = task;
    datalist.appendChild(option);
  });
}
function updateFrequentTasks(texto) {
  if (!texto) return;
  const arr = [texto, ...(state.frequentTasks || [])];
  state.frequentTasks = Array.from(new Set(arr)).slice(0, 10);
  saveState();
}

// ====== Sonido (WebAudio) ======
let audioCtx = null;
function playBeep() {
  if (!state.settings.soundOn) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, audioCtx.currentTime);
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + 0.2);
}

// ====== Tareas (localStorage) ======
function addTask(texto, fecha = selectedDate || todayStr()) {
  const t = (texto || '').trim();
  if (!t) return;
  state.tasks.push({
    id: uid(),
    texto: t,
    completada: false,
    space: currentSpace,
    fecha,
    notas: '',
    createdAt: Date.now()
  });
  saveState();
  updateFrequentTasks(t);
  renderTaskList();
  updateTodayCounter();
  if (selectedDate) renderModalTasks(selectedDate);
}
function toggleTask(id, complete) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completada = !!complete;
  saveState();
  if (complete) {
    lanzarBurbujas();
    playBeep();
    avatarEmocional.classList.add('bounce');
    setTimeout(() => avatarEmocional.classList.remove('bounce'), 500);
    if ('vibrate' in navigator) navigator.vibrate(50);
    updateAvatarBasedOnProgress();
  }
  renderTaskList();
  updateTodayCounter();
  if (selectedDate) renderModalTasks(selectedDate);
}
function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const ok = confirm(`¿Eliminar la tarea?\n\n• ${task.texto}`);
  if (!ok) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveState();
  renderTaskList();
  updateTodayCounter();
  if (selectedDate) renderModalTasks(selectedDate);
}

addTaskBtn?.addEventListener('click', () => {
  addTask(taskInput.value);
  taskInput.value = '';
});
taskInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTask(taskInput.value);
    taskInput.value = '';
  }
});

function renderTaskList() {
  if (!taskList) return;
  taskList.innerHTML = '';
  const items = state.tasks
    .filter(t => t.space === currentSpace)
    .sort((a,b) => Number(a.completada) - Number(b.completada) || a.createdAt - b.createdAt);

  items.forEach(t => {
    const li = document.createElement('li');
    li.className = 'task-item' + (t.completada ? ' complete' : '');
    li.draggable = true;
    li.dataset.id = t.id;
    li.innerHTML = `
      <span>${t.texto}</span>
      <div class="task-actions">
        <button class="task-action-btn" data-action="toggle">${t.completada ? '✔️' : '⬜'}</button>
        <button class="task-action-btn" data-action="delete">🗑️</button>
        <button class="task-action-btn focus-btn" data-action="focus">🎯</button>
      </div>
    `;
    // drag
    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    // acciones
    li.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'toggle') toggleTask(t.id, !t.completada);
      if (action === 'delete') deleteTask(t.id);
      if (action === 'focus') startFocusMode(t.id);
    });
    taskList.appendChild(li);
  });
}

// ====== Espacios ======
spaceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    spaceBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSpace = btn.dataset.space;
    renderTaskList();
    if (selectedDate) renderModalTasks(selectedDate);
    updateTodayCounter();
  });
});

// ====== Progreso -> avatar ======
function updateAvatarBasedOnProgress() {
  const tasks = state.tasks.filter(t => t.space === currentSpace);
  const total = tasks.length;
  const completed = tasks.filter(t => t.completada).length;
  const progress = total ? completed/total : 0;
  if (progress > 0.8) setEmocion('feliz');
  else if (progress > 0.5) setEmocion('calmo');
  else if (progress > 0.2) setEmocion('estresado');
  else setEmocion('triste');
}

// ====== Modo Calma ======
modoCalmaBtn?.addEventListener('click', () => {
  document.body.classList.toggle('modo-calma');
  if (semanaResumen)
    semanaResumen.textContent = document.body.classList.contains('modo-calma') ? 'Respirá hondo 🌿' : 'Tu semana: 😊😊😣😌😢';
});

// ====== Focus / Pomodoro ======
function startFocusMode(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  focusTask.innerHTML = `<span>${t.texto}</span>`;
  setHidden(focusModeModal, false);
  pomodoroTime = 25 * 60;
  updatePomodoroTimer();
}
pomodoroStartBtn?.addEventListener('click', () => {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    pomodoroStartBtn.textContent = 'Iniciar';
  } else {
    pomodoroInterval = setInterval(() => {
      pomodoroTime--;
      updatePomodoroTimer();
      if (pomodoroTime <= 0) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroStartBtn.textContent = 'Iniciar';
        if ('vibrate' in navigator) navigator.vibrate(200);
        alert('¡Pomodoro completado!');
      }
    }, 1000);
    pomodoroStartBtn.textContent = 'Pausar';
  }
});
pomodoroResetBtn?.addEventListener('click', () => {
  clearInterval(pomodoroInterval);
  pomodoroInterval = null;
  pomodoroTime = 25 * 60;
  updatePomodoroTimer();
  pomodoroStartBtn.textContent = 'Iniciar';
});
function updatePomodoroTimer() {
  const m = Math.floor(pomodoroTime / 60);
  const s = String(pomodoroTime % 60).padStart(2, '0');
  pomodoroTimer.textContent = `${m}:${s}`;
}
modalCloses.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close');
    if (id === 'focus-mode') {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      pomodoroStartBtn.textContent = 'Iniciar';
    }
    document.getElementById(id)?.classList.add('hidden');
  });
});

// ====== Burbujas celebratorias ======
function lanzarBurbujas() {
  const bubbles = document.createElement('div');
  bubbles.className = 'bubbles';
  for (let i = 0; i < 16; i++) {
    const span = document.createElement('span');
    span.className = 'bubble';
    span.style.left = `${Math.random() * 100}vw`;
    span.style.top = `${Math.random() * 80 + 10}vh`;
    span.style.width = span.style.height = `${Math.random() * 18 + 16}px`;
    span.style.background = `rgba(190,220,255,0.${Math.floor(Math.random()*5+5)})`;
    span.style.animationDelay = `${Math.random()}s`;
    span.addEventListener('animationend', () => span.remove());
    bubbles.appendChild(span);
    setTimeout(() => span.classList.add('explode'), 400 + Math.random() * 400);
  }
  document.body.appendChild(bubbles);
  setTimeout(() => bubbles.remove(), 1600);
}

// ====== Calendario ======
function getMonthName(m) {
  return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m];
}
function renderCalendar(month, year) {
  if (!calendarGrid || !calendarMonth) return;
  calendarGrid.innerHTML = '';
  calendarMonth.textContent = `${getMonthName(month)} ${year}`;

  const firstDay = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Encabezados L M X J V S D
  ['L','M','X','J','V','S','D'].forEach(dia => {
    const el = document.createElement('div');
    el.className = 'calendar-day calendar-label';
    el.textContent = dia;
    calendarGrid.appendChild(el);
  });

  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day calendar-empty';
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = day;

    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      el.classList.add('today');
    }
    if (selectedDate === dateStr) {
      el.classList.add('selected');
      animarElemento(el, 'pulse');
    }

    // Emoji de emoción del día (si existe)
    const emo = state.emotions[dateStr];
    if (emo) {
      const map = { feliz:'😊', triste:'😢', estresado:'😣', calmo:'😌' };
      const emEl = document.createElement('span');
      emEl.className = 'emoji-small';
      emEl.textContent = map[emo] || '😶';
      el.appendChild(emEl);
    }

    el.addEventListener('click', () => {
      selectedDate = dateStr;
      renderCalendar(currentMonth, currentYear);
      renderModalTasks(dateStr);
      setHidden(dayModal, false);
    });

    // Drag&Drop desde lista
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const li = document.querySelector('.task-item.dragging');
      if (!li) return;
      const id = li.dataset.id;
      const t = state.tasks.find(x => x.id === id);
      if (!t) return;
      t.fecha = dateStr;
      saveState();
      renderModalTasks(dateStr);
      renderTaskList();
    });

    calendarGrid.appendChild(el);
  }
}
prevMonthBtn.onclick = () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
  setHidden(dayModal, true);
};
nextMonthBtn.onclick = () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
  setHidden(dayModal, true);
};

// Modal día -> render tareas del día
function renderModalTasks(dateStr) {
  if (!modalDate || !modalEmotion || !modalNotification || !modalTasks) return;
  modalDate.textContent = `Día: ${new Date(dateStr).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}`;
  const emo = state.emotions[dateStr];
  const emoMap = { feliz:'😊', triste:'😢', estresado:'😣', calmo:'😌' };
  modalEmotion.textContent = `Emoción: ${emo ? (emoMap[emo] || '😶') : '😶'}`;
  modalNotification.classList.toggle('hidden', !!emo);

  const tareas = state.tasks.filter(t => t.fecha === dateStr && t.space === currentSpace);
  if (tareas.length === 0) {
    modalTasks.innerHTML = `<span style="opacity:.5;">Sin tareas para este día</span>`;
    return;
  }
  modalTasks.innerHTML = tareas.map(t => `
      <div class="calendar-task${t.completada ? ' complete' : ''}">
        <span>${t.completada ? '✔️' : '⬜'} ${t.texto}</span>
        <div class="task-actions">
          <button class="task-action-btn" data-act="toggle" data-id="${t.id}">${t.completada ? '✔️' : '⬜'}</button>
          <button class="task-action-btn" data-act="delete" data-id="${t.id}">🗑️</button>
        </div>
      </div>
  `).join('');

  // Bind acciones
  modalTasks.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'toggle') toggleTask(id, !(state.tasks.find(x => x.id === id)?.completada));
      if (act === 'delete') deleteTask(id);
      renderModalTasks(dateStr);
    });
  });
}
modalAddTaskBtn?.addEventListener('click', () => {
  const t = (modalTaskInput.value || '').trim();
  if (!t || !selectedDate) return;
  addTask(t, selectedDate);
  modalTaskInput.value = '';
  renderModalTasks(selectedDate);
});
modalTaskInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') modalAddTaskBtn.click();
});
document.querySelector('#day-modal .modal-close')?.addEventListener('click', () => {
  setHidden(dayModal, true);
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
});

// Botón flotante abre el modal del día de hoy
floatingAddBtn?.addEventListener('click', () => {
  selectedDate = todayStr();
  renderModalTasks(selectedDate);
  setHidden(dayModal, false);
});

// ====== Anti-stress ======
function crearBurbujasAntiEstres() {
  if (!antistressContainer) return;
  antistressContainer.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const b = document.createElement('div');
    b.className = 'antistress-bubble';
    b.title = '¡Haz click para explotar!';
    b.addEventListener('pointerdown', () => {
      b.classList.add('exploding');
      setTimeout(() => {
        b.remove();
        if (antistressContainer.childElementCount === 0) crearBurbujasAntiEstres();
      }, 300);
    });
    antistressContainer.appendChild(b);
  }
}
openAntistressBtn?.addEventListener('click', () => {
  setHidden(antistressModal, false);
  crearBurbujasAntiEstres();
});
closeAntistressModal?.addEventListener('click', () => setHidden(antistressModal, true));
antistressModal?.addEventListener('click', (e) => {
  if (e.target === antistressModal) setHidden(antistressModal, true);
});

// ====== Atajos de teclado ======
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Cierra el primer modal visible
    [focusModeModal, dayModal, antistressModal, pinModal].some(m => {
      if (!m.classList.contains('hidden')) { setHidden(m, true); return true; }
      return false;
    });
  }
});

// ====== Contador de hoy ======
function updateTodayCounter() {
  const ts = state.tasks.filter(t => t.fecha === todayStr() && t.completada);
  todayCounter.textContent = `Hoy: ${ts.length} ✔️`;
}

// ====== Settings toggles ======
autoThemeToggle?.addEventListener('change', () => {
  state.settings.autoTheme = autoThemeToggle.checked;
  if (state.settings.autoTheme) {
    autoThemeApplyByHour();
  }
  saveState();
  applyDayMode();
});
soundToggle?.addEventListener('change', () => {
  state.settings.soundOn = soundToggle.checked;
  saveState();
});

settingsBtn?.addEventListener('click', () => {
  settingsSection.classList.toggle('hidden');
  statsSection?.classList.add('hidden');
});

// ====== Init ======
function init() {
  // Settings -> UI
  backgroundSelector.value = state.settings.background || 'default';
  avatarSelector.value = state.settings.avatar || 'default';
  autoThemeToggle.checked = !!state.settings.autoTheme;
  soundToggle.checked = !!state.settings.soundOn;

  // Tema
  if (state.settings.autoTheme) autoThemeApplyByHour();
  applyDayMode();
  applyBackground();

  // Emoción actual (por defecto feliz)
  setEmocion(emocionActual);

  // Calendario y lista
  renderCalendar(currentMonth, currentYear);
  renderTaskList();
  loadSuggestedTasks();
  updateTodayCounter();

  // PIN si está activo
  maybeLock();

  // Recalcular tema cuando vuelve la pestaña (por si cambia la hora)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.settings.autoTheme) {
      autoThemeApplyByHour();
      applyDayMode();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
