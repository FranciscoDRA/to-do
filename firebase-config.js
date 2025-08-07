import {
  db,
  auth,
  collection,
  addDoc,
  onSnapshot,
  signInAnonymously,
  onAuthStateChanged,
  updateDoc,
  doc,
  deleteDoc
} from './firebase-config.js';

// --- ELEMENTOS PRINCIPALES ---
const loginBtn = document.getElementById('login-btn');
const loginSection = document.getElementById('login-section');
const todoSection = document.getElementById('app');
const addTaskBtn = document.getElementById('add-task-btn');
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const avatarEmocional = document.getElementById('avatar-emocional');
const modoCalmaBtn = document.getElementById('modo-calma-btn');
const semanaResumen = document.getElementById('semana-resumen');
const spaceBtns = document.querySelectorAll('.space-btn');
const emocionCards = document.querySelectorAll('.emocion-card');
const dayNightToggle = document.getElementById('day-night-toggle');
const voiceBtn = document.getElementById('voice-btn');

// --- CALENDAR ELEMENTS ---
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonth = document.getElementById('calendar-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const calendarTasks = document.getElementById('calendar-tasks');

// --- MODAL ELEMENTS ---
const dayModal = document.getElementById('day-modal');
const modalClose = document.querySelector('.modal-close');
const modalDate = document.getElementById('modal-date');
const modalEmotion = document.getElementById('modal-emotion');
const modalNotification = document.getElementById('modal-notification');
const modalTasks = document.getElementById('modal-tasks');
const modalTaskInput = document.getElementById('modal-task-input');
const modalAddTaskBtn = document.getElementById('modal-add-task-btn');

// --- ESTADO PRINCIPAL ---
let userId = null;
let currentSpace = 'personal';
let emocionActual = 'feliz';
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// --- DEMO DATA EMOCIONES Y TAREAS POR FECHA ---
const emocionesPorFecha = {
  '2025-08-02': '😊',
  '2025-08-03': '😊',
  '2025-08-04': '😣',
  '2025-08-05': '😌',
  '2025-08-06': '😢'
};
const tareasPorFecha = {
  '2025-08-02': [
    { id: '1', texto: 'Regar plantas', completada: false },
    { id: '2', texto: 'Meditación', completada: true }
  ],
  '2025-08-04': [
    { id: '3', texto: 'Enviar informe', completada: false }
  ]
};

// --- VOICE RECOGNITION ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}
voiceBtn?.addEventListener('click', () => {
  if (!recognition) {
    alert('Lo siento, la API de reconocimiento de voz no está soportada en este navegador.');
    return;
  }
  recognition.start();
  voiceBtn.style.opacity = '1';
  voiceBtn.style.transform = 'scale(1.2)';
  setTimeout(() => {
    voiceBtn.style.opacity = '0.8';
    voiceBtn.style.transform = 'scale(1)';
  }, 200);
});
if (recognition) {
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    if (transcript.startsWith('agregar tarea') || transcript.startsWith('añadir tarea')) {
      const taskText = transcript.replace(/agregar tarea|añadir tarea/, '').trim();
      if (taskText) {
        addDoc(collection(db, 'tareas'), {
          texto: taskText,
          completada: false,
          userId,
          space: currentSpace,
          createdAt: Date.now(),
          fecha: selectedDate || new Date().toISOString().slice(0,10)
        });
        taskInput.value = taskText;
        if (selectedDate) renderModalTasks(selectedDate);
      }
    }
  };
  recognition.onend = () => {
    voiceBtn.style.opacity = '0.8';
    voiceBtn.style.transform = 'scale(1)';
  };
}

// ---- DAY/NIGHT TOGGLE ----
dayNightToggle?.addEventListener('click', () => {
  document.body.classList.toggle('day-mode');
  dayNightToggle.textContent = document.body.classList.contains('day-mode') ? '🌙' : '☀️';
  dayNightToggle.classList.add('rotate');
  setTimeout(() => dayNightToggle.classList.remove('rotate'), 300);
  localStorage.setItem('dayMode', document.body.classList.contains('day-mode') ? 'true' : 'false');
});
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('dayMode') === 'true') {
    document.body.classList.add('day-mode');
    dayNightToggle.textContent = '🌙';
  }
});

// ---- LOGIN ----
loginBtn?.addEventListener('click', async () => {
  await signInAnonymously(auth);
});

// ---- AUTENTICACIÓN ----
onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    loginSection?.classList.add('hidden');
    todoSection?.classList.remove('hidden');
    cargarTareas();
    cargarEmocion();
    actualizarAvatarEmocional(emocionActual);
    setEmocion(emocionActual);
    renderCalendar(currentMonth, currentYear);
  } else {
    loginSection?.classList.remove('hidden');
    todoSection?.classList.add('hidden');
  }
});

// ---- TAREAS FIRESTORE ----
function cargarTareas() {
  const tareasRef = collection(db, 'tareas');
  onSnapshot(tareasRef, (snapshot) => {
    taskList.innerHTML = '';
    snapshot.docs
      .filter(docu => docu.data().userId === userId && docu.data().space === currentSpace)
      .forEach(docu => {
        const tarea = docu.data();
        const li = document.createElement('li');
        li.className = 'task-item' + (tarea.completada ? ' complete' : '');
        li.innerHTML = `
          <span>${tarea.texto}</span>
          <div class="task-actions">
            <button class="task-action-btn" onclick="completarTarea('${docu.id}', ${!tarea.completada})">${tarea.completada ? '✔️' : '⬜'}</button>
            <button class="task-action-btn" onclick="eliminarTarea('${docu.id}')">🗑️</button>
          </div>
        `;
        taskList.appendChild(li);
      });
  });
}

// ---- AGREGAR TAREA ----
addTaskBtn?.addEventListener('click', async () => {
  const texto = taskInput.value.trim();
  if (!texto) return;
  await addDoc(collection(db, 'tareas'), {
    texto,
    completada: false,
    userId,
    space: currentSpace,
    createdAt: Date.now(),
    fecha: selectedDate || new Date().toISOString().slice(0,10)
  });
  taskInput.value = '';
  if (selectedDate) renderModalTasks(selectedDate);
});

// ---- AGREGAR TAREA DESDE MODAL ----
modalAddTaskBtn?.addEventListener('click', async () => {
  const texto = modalTaskInput.value.trim();
  if (!texto || !selectedDate) return;
  await addDoc(collection(db, 'tareas'), {
    texto,
    completada: false,
    userId,
    space: currentSpace,
    createdAt: Date.now(),
    fecha: selectedDate
  });
  modalTaskInput.value = '';
  renderModalTasks(selectedDate);
});

// ---- COMPLETAR TAREA ----
window.completarTarea = async (id, completo) => {
  const tareaRef = doc(db, "tareas", id);
  await updateDoc(tareaRef, { completada: completo });
  if (completo) {
    lanzarConfeti();
    avatarEmocional.classList.add('bounce');
    setTimeout(() => avatarEmocional.classList.remove('bounce'), 500);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }
  if (selectedDate) renderModalTasks(selectedDate);
};

// ---- ELIMINAR TAREA ----
window.eliminarTarea = async (id) => {
  const tareaRef = doc(db, "tareas", id);
  await deleteDoc(tareaRef);
  if (selectedDate) renderModalTasks(selectedDate);
};

// ---- CAMBIAR ESPACIO ----
spaceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    spaceBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSpace = btn.dataset.space;
    cargarTareas();
    if (selectedDate) renderModalTasks(selectedDate);
  });
});

// ---- SELECCIÓN EMOCIONAL CARDS ----
function setEmocion(emocion) {
  emocionActual = emocion;
  actualizarAvatarEmocional(emocionActual);
  emocionCards.forEach(card => card.classList.remove('selected'));
  document.querySelector(`.emocion-card[data-emocion="${emocion}"]`).classList.add('selected');
  addDoc(collection(db, 'emocion'), {
    emocion: emocionActual,
    userId,
    fecha: new Date().toISOString().slice(0,10)
  });
  if (selectedDate) renderModalTasks(selectedDate);
}
emocionCards.forEach(card => {
  card.onclick = () => setEmocion(card.dataset.emocion);
});

// ---- ANIMACIÓN AVATAR EMOCIONAL ----
function actualizarAvatarEmocional(emocion) {
  const emojis = { feliz: '😊', triste: '😢', estresado: '😣', calmo: '😌' };
  avatarEmocional.textContent = emojis[emocion] || '😶';
  avatarEmocional.classList.remove('anim');
  void avatarEmocional.offsetWidth;
  avatarEmocional.classList.add('anim');
}
avatarEmocional.addEventListener('animationend', () => avatarEmocional.classList.remove('anim'));

// ---- MODO CALMA ----
modoCalmaBtn?.addEventListener('click', () => {
  document.body.classList.toggle('modo-calma');
  semanaResumen.textContent = document.body.classList.contains('modo-calma') ? 'Respirá hondo 🌿' : 'Tu semana: 😊😊😣😌😢';
});

// ---- RESUMEN SEMANAL ----
function cargarEmocion() {
  semanaResumen.innerHTML = `<span style="font-size:1.6rem;">😊😊😣😌😢</span>`;
}

// ---- CONFETI ----
function lanzarConfeti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti';
  for (let i = 0; i < 20; i++) {
    const span = document.createElement('span');
    span.style = `
      position: absolute;
      left: ${Math.random() * 98}vw;
      top: ${Math.random() * 98}vh;
      font-size: ${Math.random() * 0.8 + 0.8}rem;
      color: hsl(${Math.random() * 360},90%,65%);
      opacity: 0.7;
      animation: confeti-fall 1.5s ease-out forwards;
    `;
    span.textContent = ['✨', '🎉', '⭐'][Math.floor(Math.random() * 3)];
    confetti.appendChild(span);
  }
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 1500);
}

// ---- CALENDARIO VISUAL PREMIUM ----
function renderCalendar(month, year) {
  calendarGrid.innerHTML = '';
  calendarMonth.textContent = `${getMonthName(month)} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Nombres de días
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(dia => {
    let el = document.createElement('div');
    el.className = 'calendar-day calendar-label';
    el.textContent = dia;
    calendarGrid.appendChild(el);
  });

  // Espacios vacíos
  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    let empty = document.createElement('div');
    empty.className = 'calendar-day calendar-empty';
    calendarGrid.appendChild(empty);
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let el = document.createElement('div');
    el.className = 'calendar-day';
    el.textContent = day;

    // Día actual
    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      el.classList.add('today');
    }

    // Emoji emocional
    const emotion = emocionesPorFecha[dateStr];
    if (emotion) {
      let emoji = document.createElement('span');
      emoji.textContent = emotion;
      emoji.className = 'emoji-small';
      el.appendChild(emoji);
    }

    // Selección
    if (selectedDate === dateStr) {
      el.classList.add('selected');
    }

    el.onclick = () => {
      selectedDate = dateStr;
      renderCalendar(currentMonth, currentYear);
      renderModalTasks(dateStr);
      dayModal.classList.remove('hidden');
    };

    calendarGrid.appendChild(el);
  }
}

// ---- MODAL TASKS ----
function renderModalTasks(dateStr) {
  modalDate.textContent = `Día: ${new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  const emotion = emocionesPorFecha[dateStr];
  modalEmotion.textContent = `Emoción: ${emotion || '😶'}`;
  modalNotification.classList.toggle('hidden', !!emotion);

  const tareasRef = collection(db, 'tareas');
  onSnapshot(tareasRef, (snapshot) => {
    const tareas = snapshot.docs
      .filter(docu => docu.data().fecha === dateStr && docu.data().userId === userId)
      .map(docu => ({ id: docu.id, ...docu.data() }));
    
    if (tareas.length === 0) {
      modalTasks.innerHTML = `<span style="opacity:.5;">Sin tareas para este día</span>`;
      return;
    }
    
    modalTasks.innerHTML = tareas.map(t => `
      <div class="calendar-task${t.completada ? ' complete' : ''}">
        <span>${t.completada ? '✔️' : '⬜'} ${t.texto}</span>
        <div class="task-actions">
          <button class="task-action-btn" onclick="completarTarea('${t.id}', ${!t.completada})">${t.completada ? '✔️' : '⬜'}</button>
          <button class="task-action-btn" onclick="eliminarTarea('${t.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  });
}

// ---- CERRAR MODAL ----
modalClose?.addEventListener('click', () => {
  dayModal.classList.add('hidden');
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
});

// ---- CALENDARIO NAVEGACIÓN ----
function getMonthName(m) {
  return [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ][m];
}

prevMonthBtn.onclick = () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
  dayModal.classList.add('hidden');
};

nextMonthBtn.onclick = () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
  dayModal.classList.add('hidden');
};

// ---- INICIALIZAR ----
window.addEventListener('DOMContentLoaded', () => {
  renderCalendar(currentMonth, currentYear);
  cargarEmocion();
});