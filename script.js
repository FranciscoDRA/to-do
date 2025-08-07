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
  deleteDoc,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getDoc
} from './firebase-config.js';

// --- ELEMENTOS PRINCIPALES ---
const loginBtn = document.getElementById('login-anon-btn');
const loginEmailBtn = document.getElementById('login-email-btn');
const emailSignInBtn = document.getElementById('email-signin-btn');
const emailSignUpBtn = document.getElementById('email-signup-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const emailLoginForm = document.getElementById('email-login-form');
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
const darkToggleBtn = document.getElementById('day-night-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsSection = document.getElementById('settings-section');
const backgroundSelector = document.getElementById('background-selector');
const avatarSelector = document.getElementById('avatar-selector');
const floatingAddBtn = document.getElementById('floating-add-btn');
const focusModeModal = document.getElementById('focus-mode');
const focusTask = document.getElementById('focus-task');
const pomodoroTimer = document.getElementById('pomodoro-timer');
const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');
const pinModal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinSubmitBtn = document.getElementById('pin-submit-btn');
const pinSetBtn = document.getElementById('pin-set-btn');
const statsSection = document.getElementById('stats-section');

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
const modalSubtasks = document.getElementById('modal-subtasks');
const modalTaskNotes = document.getElementById('modal-task-notes');

// --- ESTADO PRINCIPAL ---
let userId = null;
let currentSpace = 'personal';
let emocionActual = 'feliz';
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let pomodoroInterval = null;
let pomodoroTime = 25 * 60; // 25 minutes in seconds
let frequentTasks = JSON.parse(localStorage.getItem('frequentTasks')) || [];

// --- MICROINTERACCIONES Y ANIMACIONES ---
function animarElemento(el, clase) {
  el.classList.add(clase);
  el.addEventListener('animationend', () => el.classList.remove(clase), { once: true });
}

// --- MODO OSCURO/CLARO ---
darkToggleBtn?.addEventListener('click', () => {
  document.body.classList.toggle('day-mode');
  darkToggleBtn.textContent = document.body.classList.contains('day-mode') ? '🌙' : '☀️';
  animarElemento(darkToggleBtn, 'rotate');
  localStorage.setItem('dayMode', document.body.classList.contains('day-mode') ? 'true' : 'false');
});
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('dayMode') === 'true') {
    document.body.classList.add('day-mode');
    darkToggleBtn.textContent = '🌙';
  }
  if (localStorage.getItem('pinEnabled') === 'true') {
    pinModal.classList.remove('hidden');
    todoSection.classList.add('hidden');
  }
  const savedBg = localStorage.getItem('background') || 'default';
  backgroundSelector.value = savedBg;
  backgroundSelector.dispatchEvent(new Event('change'));
  const savedAvatar = localStorage.getItem('avatar') || 'default';
  avatarSelector.value = savedAvatar;
});

// --- LOGIN ---
loginBtn?.addEventListener('click', async () => {
  await signInAnonymously(auth);
});
loginEmailBtn?.addEventListener('click', () => {
  emailLoginForm.classList.toggle('hidden');
});
emailSignInBtn?.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert('Por favor, completa todos los campos.');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert('Error al iniciar sesión: ' + error.message);
  }
});
emailSignUpBtn?.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert('Por favor, completa todos los campos.');
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert('Error al registrarse: ' + error.message);
  }
});

// --- PIN LOCK ---
pinSubmitBtn?.addEventListener('click', () => {
  const pin = pinInput.value.trim();
  if (pin === localStorage.getItem('pin')) {
    pinModal.classList.add('hidden');
    todoSection.classList.remove('hidden');
  } else {
    alert('PIN incorrecto.');
  }
});
pinSetBtn?.addEventListener('click', () => {
  const pin = pinInput.value.trim();
  if (pin.length === 4 && /^\d+$/.test(pin)) {
    localStorage.setItem('pin', pin);
    localStorage.setItem('pinEnabled', 'true');
    pinModal.classList.add('hidden');
    todoSection.classList.remove('hidden');
  } else {
    alert('El PIN debe ser de 4 dígitos numéricos.');
  }
});

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    userId = user.uid;
    loginSection?.classList.add('hidden');
    if (localStorage.getItem('pinEnabled') === 'true') {
      pinModal.classList.remove('hidden');
    } else {
      todoSection?.classList.remove('hidden');
    }
    cargarTareas();
    cargarEmocion();
    actualizarAvatarEmocional(emocionActual);
    setEmocion(emocionActual);
    renderCalendar(currentMonth, currentYear);
    loadSuggestedTasks();
    loadStats();
  } else {
    loginSection?.classList.remove('hidden');
    todoSection?.classList.add('hidden');
    pinModal.classList.add('hidden');
  }
});

// --- TAREAS FIRESTORE ---
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
        li.draggable = true;
        li.dataset.id = docu.id;
        li.innerHTML = `
          <span>${tarea.texto}</span>
          <div class="task-actions">
            <button class="task-action-btn" onclick="completarTarea('${docu.id}', ${!tarea.completada})">${tarea.completada ? '✔️' : '⬜'}</button>
            <button class="task-action-btn" onclick="eliminarTarea('${docu.id}')">🗑️</button>
            <button class="task-action-btn focus-btn" onclick="startFocusMode('${docu.id}')">🎯</button>
          </div>
        `;
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);
        taskList.appendChild(li);
      });
    updateFrequentTasks();
  });
}

// --- DRAG AND DROP ---
let draggedTask = null;
function handleDragStart(e) {
  draggedTask = e.target;
  e.target.classList.add('dragging');
}
function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedTask = null;
}
calendarGrid.addEventListener('dragover', (e) => {
  e.preventDefault();
});
calendarGrid.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (draggedTask) {
    const dateStr = e.target.dataset.date;
    if (dateStr) {
      const tareaRef = doc(db, 'tareas', draggedTask.dataset.id);
      await updateDoc(tareaRef, { fecha: dateStr });
      renderModalTasks(dateStr);
      cargarTareas();
    }
  }
});

// --- AGREGAR TAREA ---
async function addTask(texto, fecha = selectedDate || new Date().toISOString().slice(0,10)) {
  if (!texto.trim()) return;
  await addDoc(collection(db, 'tareas'), {
    texto,
    completada: false,
    userId,
    space: currentSpace,
    createdAt: Date.now(),
    fecha,
    subtareas: [],
    notas: ''
  });
  frequentTasks.push(texto);
  localStorage.setItem('frequentTasks', JSON.stringify([...new Set(frequentTasks)].slice(-10)));
  updateFrequentTasks();
}
addTaskBtn?.addEventListener('click', async () => {
  await addTask(taskInput.value);
  taskInput.value = '';
  if (selectedDate) renderModalTasks(selectedDate);
});

// --- AGREGAR TAREA DESDE MODAL ---
modalAddTaskBtn?.addEventListener('click', async () => {
  const texto = modalTaskInput.value.trim();
  if (!texto || !selectedDate) return;
  await addTask(texto, selectedDate);
  modalTaskInput.value = '';
  renderModalTasks(selectedDate);
});

// --- COMPLETAR TAREA ---
window.completarTarea = async (id, completo) => {
  const tareaRef = doc(db, 'tareas', id);
  await updateDoc(tareaRef, { completada: completo });
  if (completo) {
    lanzarConfeti();
    avatarEmocional.classList.add('bounce');
    setTimeout(() => avatarEmocional.classList.remove('bounce'), 500);
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    updateAvatarBasedOnProgress();
    loadStats();
  }
  if (selectedDate) renderModalTasks(selectedDate);
};

// --- ELIMINAR TAREA ---
window.eliminarTarea = async (id) => {
  const tareaRef = doc(db, 'tareas', id);
  await deleteDoc(tareaRef);
  if (selectedDate) renderModalTasks(selectedDate);
};

// --- CAMBIAR ESPACIO ---
spaceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    spaceBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSpace = btn.dataset.space;
    cargarTareas();
    if (selectedDate) renderModalTasks(selectedDate);
  });
});

// --- SELECCIÓN EMOCIONAL CARDS ---
function setEmocion(emocion) {
  emocionActual = emocion;
  actualizarAvatarEmocional(emocionActual);
  emocionCards.forEach(card => card.classList.remove('selected'));
  document.querySelector(`.emocion-card[data-emocion="${emocion}"]`).classList.add('selected');
  addDoc(collection(db, 'emocion'), {
    emocion: emocionActual,
    userId,
    fecha: selectedDate || new Date().toISOString().slice(0,10)
  });
  if (selectedDate) renderModalTasks(selectedDate);
  loadSuggestedTasks();
  loadStats();
}
emocionCards.forEach(card => {
  card.onclick = () => setEmocion(card.dataset.emocion);
});

// --- ANIMACIÓN AVATAR EMOCIONAL ---
function actualizarAvatarEmocional(emocion) {
  const avatarType = avatarSelector.value;
  const avatars = {
    default: { feliz: '😊', triste: '😢', estresado: '😣', calmo: '😌' },
    cat: { feliz: '😺', triste: '😿', estresado: '🙀', calmo: '😸' },
    dog: { feliz: '🐶', triste: '🐕', estresado: '🐶😓', calmo: '🐕😊' },
    bird: { feliz: '🐦', triste: '🐥', estresado: '🐦😣', calmo: '🐦😌' }
  };
  avatarEmocional.textContent = avatars[avatarType][emocion] || avatars[avatarType].feliz;
  avatarEmocional.classList.remove('anim');
  void avatarEmocional.offsetWidth;
  avatarEmocional.classList.add('anim');
}
avatarEmocional.addEventListener('animationend', () => avatarEmocional.classList.remove('anim'));

// --- ACTUALIZAR AVATAR SEGÚN PROGRESO ---
async function updateAvatarBasedOnProgress() {
  const tareasRef = collection(db, 'tareas');
  onSnapshot(tareasRef, (snapshot) => {
    const tareas = snapshot.docs.filter(docu => docu.data().userId === userId && docu.data().space === currentSpace);
    const completed = tareas.filter(t => t.data().completada).length;
    const total = tareas.length;
    const progress = total > 0 ? completed / total : 0;
    if (progress > 0.8) setEmocion('feliz');
    else if (progress > 0.5) setEmocion('calmo');
    else if (progress > 0.2) setEmocion('estresado');
    else setEmocion('triste');
  });
}

// --- MODO CALMA ---
modoCalmaBtn?.addEventListener('click', () => {
  document.body.classList.toggle('modo-calma');
  semanaResumen.textContent = document.body.classList.contains('modo-calma') ? 'Respirá hondo 🌿' : 'Tu semana: 😊😊😣😌😢';
});

// --- MODO ENFOQUE ---
window.startFocusMode = async (taskId) => {
  const tareaRef = doc(db, 'tareas', taskId);
  const tareaDoc = await getDoc(tareaRef);
  if (tareaDoc.exists()) {
    focusTask.innerHTML = `<span>${tareaDoc.data().texto}</span>`;
    focusModeModal.classList.remove('hidden');
    pomodoroTime = 25 * 60;
    updatePomodoroTimer();
  }
};
pomodoroStartBtn?.addEventListener('click', () => {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroStartBtn.textContent = 'Iniciar';
  } else {
    pomodoroInterval = setInterval(() => {
      pomodoroTime--;
      updatePomodoroTimer();
      if (pomodoroTime <= 0) {
        clearInterval(pomodoroInterval);
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
  pomodoroTime = 25 * 60;
  updatePomodoroTimer();
  pomodoroStartBtn.textContent = 'Iniciar';
});
function updatePomodoroTimer() {
  const minutes = Math.floor(pomodoroTime / 60);
  const seconds = pomodoroTime % 60;
  pomodoroTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
focusModeModal.querySelector('.modal-close').addEventListener('click', () => {
  clearInterval(pomodoroInterval);
  pomodoroStartBtn.textContent = 'Iniciar';
  focusModeModal.classList.add('hidden');
});

// --- CONFIGURACIONES ---
settingsBtn?.addEventListener('click', () => {
  settingsSection.classList.toggle('hidden');
  statsSection.classList.add('hidden');
});

// --- SELECCIÓN DE FONDO ---
backgroundSelector?.addEventListener('change', () => {
  const value = backgroundSelector.value;
  const backgrounds = {
    default: 'radial-gradient(circle at 70% 8%, #232450 0%, #191932 100%)',
    ocean: 'radial-gradient(circle at 50% 50%, #1e90ff 0%, #00b7eb 100%)',
    forest: 'radial-gradient(circle at 50% 50%, #2e8b57 0%, #228b22 100%)',
    sunset: 'radial-gradient(circle at 50% 50%, #ff4500 0%, #ff8c00 100%)'
  };
  document.querySelector('.main-bg').style.background = backgrounds[value];
  localStorage.setItem('background', value);
});
window.addEventListener('DOMContentLoaded', () => {
  const savedBg = localStorage.getItem('background') || 'default';
  backgroundSelector.value = savedBg;
  backgroundSelector.dispatchEvent(new Event('change'));
});

// --- SELECCIÓN DE AVATAR ---
avatarSelector?.addEventListener('change', () => {
  localStorage.setItem('avatar', avatarSelector.value);
  actualizarAvatarEmocional(emocionActual);
});
window.addEventListener('DOMContentLoaded', () => {
  const savedAvatar = localStorage.getItem('avatar') || 'default';
  avatarSelector.value = savedAvatar;
});

// --- TAREAS SUGERIDAS ---
function loadSuggestedTasks() {
  const suggestions = {
    feliz: ['Celebrar con amigos', 'Hacer ejercicio', 'Escribir gratitudes'],
    triste: ['Meditar', 'Escribir en diario', 'Llamar a un amigo'],
    estresado: ['Respirar profundo', 'Tomar un descanso', 'Organizar escritorio'],
    calmo: ['Leer un libro', 'Pasear al aire libre', 'Planificar el día']
  };
  const datalist = document.getElementById('task-suggestions');
  datalist.innerHTML = '';
  [...(suggestions[emocionActual] || []), ...frequentTasks].forEach(task => {
    const option = document.createElement('option');
    option.value = task;
    datalist.appendChild(option);
  });
}
function updateFrequentTasks() {
  const datalist = document.getElementById('task-suggestions');
  frequentTasks = JSON.parse(localStorage.getItem('frequentTasks')) || [];
  frequentTasks.forEach(task => {
    if (!Array.from(datalist.options).some(opt => opt.value === task)) {
      const option = document.createElement('option');
      option.value = task;
      datalist.appendChild(option);
    }
  });
}

// --- ESTADÍSTICAS ---
function loadStats() {
  const emocionesRef = collection(db, 'emocion');
  onSnapshot(emocionesRef, (snapshot) => {
    // Implementar estadísticas si es necesario usando Chart.js
  });
}

// --- CONFETI ---
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

// --- CALENDARIO VISUAL ---
function renderCalendar(month, year) {
  calendarGrid.innerHTML = '';
  calendarMonth.textContent = `${getMonthName(month)} ${year}`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(dia => {
    let el = document.createElement('div');
    el.className = 'calendar-day calendar-label';
    el.textContent = dia;
    calendarGrid.appendChild(el);
  });

  for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
    let empty = document.createElement('div');
    empty.className = 'calendar-day calendar-empty';
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let el = document.createElement('div');
    el.className = 'calendar-day';
    el.dataset.date = dateStr;
    el.textContent = day;

    const today = new Date();
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      el.classList.add('today');
    }

    if (selectedDate === dateStr) {
      el.classList.add('selected');
      animarElemento(el, 'pulse');
    }
    el.onclick = () => {
      selectedDate = dateStr;
      renderCalendar(currentMonth, currentYear);
      renderModalTasks(dateStr);
      dayModal.classList.remove('hidden');
    };
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (draggedTask) {
        const tareaRef = doc(db, 'tareas', draggedTask.dataset.id);
        await updateDoc(tareaRef, { fecha: dateStr });
        renderModalTasks(dateStr);
        cargarTareas();
      }
    });
    calendarGrid.appendChild(el);
  }
}

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

// --- MODAL TASKS ---
function renderModalTasks(dateStr) {
  modalDate.textContent = `Día: ${new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  modalEmotion.textContent = `Emoción: 😶`;
  modalNotification.classList.add('hidden');
  const tareasRef = collection(db, 'tareas');
  onSnapshot(tareasRef, (snapshot) => {
    const tareas = snapshot.docs
      .filter(docu => docu.data().fecha === dateStr && docu.data().userId === userId)
      .map(docu => ({ id: docu.id, ...docu.data() }));
    if (tareas.length === 0) {
      modalTasks.innerHTML = `<span style="opacity:.5;">Sin tareas para este día</span>`;
      modalSubtasks.innerHTML = '';
      modalTaskNotes.value = '';
      return;
    }
    modalTasks.innerHTML = tareas.map(t => `
      <div>
        ${t.completada ? '✔️' : '⬜'} ${t.texto}
        <div>
          <button class="task-action-btn" onclick="completarTarea('${t.id}', ${!t.completada})">${t.completada ? '✔️' : '⬜'}</button>
          <button class="task-action-btn" onclick="eliminarTarea('${t.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
    if (tareas.length > 0) {
      const selectedTask = tareas[0];
      modalSubtasks.innerHTML = `
        <input id="subtask-input" placeholder="Subtarea..." />
        <button onclick="addSubtask('${selectedTask.id}')">+</button>
        ${selectedTask.subtareas.map((sub, i) => `
          <div>
            <input type="checkbox" ${sub.completada ? 'checked' : ''} onchange="toggleSubtask('${selectedTask.id}',${i})" />
            ${sub.texto}
          </div>
        `).join('')}
      `;
      modalTaskNotes.value = selectedTask.notas || '';
      modalTaskNotes.onchange = () => updateTaskNotes(selectedTask.id, modalTaskNotes.value);
    }
  });
}

// --- SUBTAREAS ---
window.addSubtask = async (taskId) => {
  const subtaskInput = document.getElementById('subtask-input');
  const texto = subtaskInput.value.trim();
  if (!texto) return;
  const tareaRef = doc(db, 'tareas', taskId);
  const tareaDoc = await getDoc(tareaRef);
  if (tareaDoc.exists()) {
    const subtareas = tareaDoc.data().subtareas || [];
    subtareas.push({ texto, completada: false });
    await updateDoc(tareaRef, { subtareas });
    renderModalTasks(selectedDate);
  }
  subtaskInput.value = '';
};
window.toggleSubtask = async (taskId, index) => {
  const tareaRef = doc(db, 'tareas', taskId);
  const tareaDoc = await getDoc(tareaRef);
  if (tareaDoc.exists()) {
    const subtareas = tareaDoc.data().subtareas || [];
    subtareas[index].completada = !subtareas[index].completada;
    await updateDoc(tareaRef, { subtareas });
    renderModalTasks(selectedDate);
  }
};

// --- NOTAS DE TAREAS ---
async function updateTaskNotes(taskId, notes) {
  const tareaRef = doc(db, 'tareas', taskId);
  await updateDoc(tareaRef, { notas: notes });
}

// --- CERRAR MODAL ---
modalClose?.addEventListener('click', () => {
  dayModal.classList.add('hidden');
  selectedDate = null;
  renderCalendar(currentMonth, currentYear);
});

// --- BOTÓN FLOTANTE ---
floatingAddBtn?.addEventListener('click', () => {
  dayModal.classList.remove('hidden');
  selectedDate = new Date().toISOString().slice(0,10);
  renderModalTasks(selectedDate);
});

// --- INICIALIZAR ---
window.addEventListener('DOMContentLoaded', () => {
  renderCalendar(currentMonth, currentYear);
  cargarEmocion();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }
});

// --- RESUMEN SEMANAL ---
function cargarEmocion() {
  semanaResumen.innerHTML = `<span style="font-size:1.6rem;">😊😊😣😌😢</span>`;
}
