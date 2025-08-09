/*************************************************
 * TaskGarden – Lógica simple (sin módulos)
 * - Sin manifest / sin service worker
 * - 100% localStorage
 * - UI premium + mejoras
 **************************************************/
const LS_KEY = 'tg_state_ui_premium_v1';

function defaultState(){
  return {
    tasks: [], // {id, texto, completada, space, fecha, notas, createdAt}
    emotions: {}, // {'YYYY-MM-DD': 'feliz'|'triste'|'estresado'|'calmo'}
    settings: {
      dayMode: false,
      autoTheme: true,
      background: 'default',
      avatar: 'default',
      soundOn: true,
      pinEnabled: false,
      pin: ''
    },
    frequentTasks: []
  };
}
function loadState(){ try{ const raw=localStorage.getItem(LS_KEY); return raw?JSON.parse(raw):defaultState(); }catch{ return defaultState(); } }
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function uid(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36); }
function todayStr(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

let state = loadState();
let currentSpace='personal', emocionActual='feliz', selectedDate=null;
let currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let pomodoroInterval=null, pomodoroTime=25*60;
let audioCtx=null;

/* ===== DOM ===== */
const avatarEmocional = document.getElementById('avatar-emocional');
const modoCalmaBtn = document.getElementById('modo-calma-btn');
const darkToggleBtn = document.getElementById('day-night-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsSection = document.getElementById('settings-section');
const backgroundSelector = document.getElementById('background-selector');
const avatarSelector = document.getElementById('avatar-selector');
const autoThemeToggle = document.getElementById('auto-theme-toggle');
const soundToggle = document.getElementById('sound-toggle');
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
const modalDate = document.getElementById('day-title');
const modalEmotion = document.getElementById('modal-emotion');
const modalNotification = document.getElementById('modal-notification');
const modalTasks = document.getElementById('modal-tasks');
const modalTaskInput = document.getElementById('modal-task-input');
const modalAddTaskBtn = document.getElementById('modal-add-task-btn');
const modalTaskNotes = document.getElementById('modal-task-notes');

const focusModeModal = document.getElementById('focus-mode');
const focusTask = document.getElementById('focus-task');
const pomodoroTimer = document.getElementById('pomodoro-timer');
const pomodoroStartBtn = document.getElementById('pomodoro-start-btn');
const pomodoroResetBtn = document.getElementById('pomodoro-reset-btn');

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

/* ===== Utils ===== */
const setHidden = (el, v)=> el && el.classList.toggle('hidden', !!v);
const pulse = (el)=>{ el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim'); };
function playBeep(){
  if (!state.settings.soundOn) return;
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type='sine'; o.frequency.value=880;
  g.gain.value=0.0001; g.gain.exponentialRampToValueAtTime(0.08,audioCtx.currentTime+.01);
  g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+.18);
  o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+.2);
}

/* ===== Tema ===== */
function autoThemeApplyByHour(){ const h=new Date().getHours(); state.settings.dayMode = (h>=7 && h<19); }
function applyDayMode(){
  document.body.classList.toggle('day-mode', !!state.settings.dayMode);
  darkToggleBtn.textContent = state.settings.dayMode ? '🌙' : '☀️';
}
darkToggleBtn?.addEventListener('click', ()=>{
  if (state.settings.autoTheme) { state.settings.autoTheme=false; autoThemeToggle.checked=false; }
  state.settings.dayMode=!state.settings.dayMode; saveState(); applyDayMode(); darkToggleBtn.classList.add('pulse');
  setTimeout(()=>darkToggleBtn.classList.remove('pulse'),220);
});

/* ===== Fondo + Avatar ===== */
function applyBackground(){
  const bgMap={
    default:'radial-gradient(1200px 800px at 70% -10%, #2a2f6a33, transparent 60%), var(--bg)',
    ocean:'radial-gradient(1200px 800px at 70% -10%, #1e90ff44, transparent 60%), #071224',
    forest:'radial-gradient(1200px 800px at 70% -10%, #2e8b5744, transparent 60%), #071b14',
    sunset:'radial-gradient(1200px 800px at 70% -10%, #ff7b0044, transparent 60%), #1a0b07'
  };
  document.body.style.background = bgMap[state.settings.background] || '';
}
backgroundSelector?.addEventListener('change', ()=>{ state.settings.background=backgroundSelector.value; saveState(); applyBackground(); });
avatarSelector?.addEventListener('change', ()=>{ state.settings.avatar=avatarSelector.value; saveState(); actualizarAvatar(emocionActual); });

/* ===== PIN ===== */
function maybeLock(){ if (state.settings.pinEnabled) setHidden(pinModal,false); }
pinSubmitBtn?.addEventListener('click', ()=>{
  const pin=(pinInput.value||'').trim();
  if (pin && pin===state.settings.pin){ setHidden(pinModal,true); pinInput.value=''; }
  else alert('PIN incorrecto.');
});
pinSetBtn?.addEventListener('click', ()=>{
  const pin=(pinInput.value||'').trim();
  if(/^\d{4}$/.test(pin)){ state.settings.pin=pin; state.settings.pinEnabled=true; saveState(); alert('PIN configurado.'); setHidden(pinModal,true); pinInput.value=''; }
  else alert('El PIN debe ser 4 dígitos numéricos.');
});
pinDisableBtn?.addEventListener('click', ()=>{ state.settings.pinEnabled=false; state.settings.pin=''; saveState(); alert('PIN desactivado.'); setHidden(pinModal,true); pinInput.value=''; });
openPinBtn?.addEventListener('click', ()=> setHidden(pinModal,false));

/* ===== Emociones ===== */
function setEmocion(e){
  emocionActual=e;
  const key= selectedDate || todayStr();
  state.emotions[key]=e; saveState();
  actualizarAvatar(e);
  emocionCards.forEach(c=>c.classList.toggle('selected', c.dataset.emocion===e));
  loadSuggestedTasks(); renderCalendar(currentMonth,currentYear);
}
emocionCards.forEach(c=> c.addEventListener('click', ()=> setEmocion(c.dataset.emocion)));
function actualizarAvatar(e){
  const map={
    default:{feliz:'😊',triste:'😢',estresado:'😣',calmo:'😌'},
    cat:{feliz:'😺',triste:'😿',estresado:'🙀',calmo:'😸'},
    dog:{feliz:'🐶',triste:'🐶😓',estresado:'🐶😓',calmo:'🐶😊'},
    bird:{feliz:'🐦',triste:'🐥',estresado:'🐦😣',calmo:'🐦😌'}
  };
  const set= map[state.settings.avatar] || map.default;
  avatarEmocional.textContent = set[e] || '😊'; pulse(avatarEmocional);
}

/* ===== Sugerencias ===== */
function loadSuggestedTasks(){
  const base={
    feliz:['Celebrar con amigos','Hacer ejercicio','Escribir gratitudes'],
    triste:['Meditar','Escribir en diario','Llamar a un amigo'],
    estresado:['Respirar profundo','Tomar un descanso','Organizar escritorio'],
    calmo:['Leer un libro','Pasear al aire libre','Planificar el día']
  };
  const dl=document.getElementById('task-suggestions'); if(!dl) return;
  dl.innerHTML=''; const set=new Set([...(base[emocionActual]||[]), ...(state.frequentTasks||[])]);
  set.forEach(v=>{ const o=document.createElement('option'); o.value=v; dl.appendChild(o); });
}
function pushFrequent(texto){
  if(!texto) return;
  state.frequentTasks = Array.from(new Set([texto, ...(state.frequentTasks||[])])).slice(0,10);
  saveState();
}

/* ===== Tareas ===== */
function addTask(texto, fecha = selectedDate || todayStr()){
  const t=(texto||'').trim(); if(!t) return;
  state.tasks.push({ id:uid(), texto:t, completada:false, space:currentSpace, fecha, notas:'', createdAt:Date.now() });
  saveState(); pushFrequent(t); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
}
function toggleTask(id, complete){
  const task=state.tasks.find(x=>x.id===id); if(!task) return;
  task.completada=!!complete; saveState();
  if(complete){ confetti(); playBeep(); avatarEmocional.classList.add('bounce'); setTimeout(()=>avatarEmocional.classList.remove('bounce'),500); if('vibrate' in navigator) navigator.vibrate(40); updateAvatarByProgress(); }
  renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
}
function deleteTask(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  if(!confirm(`¿Eliminar la tarea?\n• ${t.texto}`)) return;
  state.tasks = state.tasks.filter(x=>x.id!==id); saveState(); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
}

addTaskBtn?.addEventListener('click', ()=>{ addTask(taskInput.value); taskInput.value=''; });
taskInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addTask(taskInput.value); taskInput.value=''; } });

function renderTaskList(){
  taskList.innerHTML='';
  const items = state.tasks.filter(t=>t.space===currentSpace)
    .sort((a,b)=> Number(a.completada)-Number(b.completada) || a.createdAt-b.createdAt);
  items.forEach(t=>{
    const li=document.createElement('li');
    li.className='task-item'+(t.completada?' complete':'');
    li.dataset.id=t.id; li.draggable=true;
    li.innerHTML = `
      <span>${t.texto}</span>
      <div class="task-actions">
        <button data-action="toggle" title="Completar">${t.completada?'✔️':'⬜'}</button>
        <button data-action="delete" title="Borrar">🗑️</button>
        <button data-action="focus"  title="Enfocar">🎯</button>
      </div>`;
    li.addEventListener('dragstart', ()=> li.classList.add('dragging'));
    li.addEventListener('dragend',   ()=> li.classList.remove('dragging'));
    li.addEventListener('click', (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      const action=b.dataset.action;
      if(action==='toggle') toggleTask(t.id, !t.completada);
      if(action==='delete') deleteTask(t.id);
      if(action==='focus') startFocusMode(t.id);
    });
    taskList.appendChild(li);
  });
}

/* Spaces */
spaceBtns.forEach(btn=>{
  btn.addEventListener('click',()=>{
    spaceBtns.forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    currentSpace=btn.dataset.space; renderTaskList(); if(selectedDate) renderModalTasks(selectedDate); updateTodayCounter();
  });
});

/* Progreso -> emoción */
function updateAvatarByProgress(){
  const tasks=state.tasks.filter(t=>t.space===currentSpace);
  const total=tasks.length, completed=tasks.filter(t=>t.completada).length;
  const p= total? completed/total : 0;
  if(p>0.8) setEmocion('feliz'); else if(p>0.5) setEmocion('calmo'); else if(p>0.2) setEmocion('estresado'); else setEmocion('triste');
}

/* Modo calma */
modoCalmaBtn?.addEventListener('click', ()=>{
  document.body.classList.toggle('modo-calma');
  const s=document.getElementById('semana-resumen');
  if(s) s.textContent = document.body.classList.contains('modo-calma') ? 'Respirá hondo 🌿' : 'Tu semana: 😊😊😣😌😢';
});

/* Focus/Pomodoro */
function startFocusMode(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  focusTask.textContent=t.texto; setHidden(focusModeModal,false);
  pomodoroTime=25*60; updatePomodoroTimer();
}
pomodoroStartBtn?.addEventListener('click', ()=>{
  if(pomodoroInterval){ clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroStartBtn.textContent='Iniciar'; }
  else{
    pomodoroInterval=setInterval(()=>{
      pomodoroTime--; updatePomodoroTimer();
      if(pomodoroTime<=0){ clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroStartBtn.textContent='Iniciar'; if('vibrate' in navigator) navigator.vibrate(180); alert('¡Pomodoro completado!'); }
    },1000);
    pomodoroStartBtn.textContent='Pausar';
  }
});
pomodoroResetBtn?.addEventListener('click', ()=>{ clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroTime=25*60; updatePomodoroTimer(); pomodoroStartBtn.textContent='Iniciar'; });
function updatePomodoroTimer(){ const m=Math.floor(pomodoroTime/60), s=String(pomodoroTime%60).padStart(2,'0'); pomodoroTimer.textContent=`${m}:${s}`; }
modalCloses.forEach(b=> b.addEventListener('click', ()=>{ const id=b.getAttribute('data-close'); if(id==='focus-mode'){ clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroStartBtn.textContent='Iniciar'; } setHidden(document.getElementById(id),true); }));

/* Confetti bubbles */
function confetti(){
  const wrap=document.createElement('div'); wrap.className='bubbles';
  for(let i=0;i<16;i++){
    const s=document.createElement('span'); s.className='bubble';
    s.style.left=`${Math.random()*100}vw`; s.style.top=`${Math.random()*80+10}vh`;
    s.style.width=s.style.height=`${Math.random()*18+16}px`; s.style.background=`rgba(190,220,255,0.${Math.floor(Math.random()*5+5)})`;
    s.style.animationDelay=`${Math.random()}s`; s.addEventListener('animationend',()=>s.remove());
    wrap.appendChild(s); setTimeout(()=> s.classList.add('explode'), 380+Math.random()*420);
  }
  document.body.appendChild(wrap); setTimeout(()=> wrap.remove(), 1600);
}

/* Calendario */
function getMonthName(m){ return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m]; }
function renderCalendar(month,year){
  calendarGrid.innerHTML=''; calendarMonth.textContent=`${getMonthName(month)} ${year}`;
  const first=new Date(year,month,1).getDay(); // 0 dom
  const days=new Date(year,month+1,0).getDate();
  // Headers L-M-X-J-V-S-D
  ['L','M','X','J','V','S','D'].forEach(d=>{ const el=document.createElement('div'); el.className='calendar-day calendar-label'; el.textContent=d; calendarGrid.appendChild(el); });
  for(let i=0;i<(first===0?6:first-1);i++){ const e=document.createElement('div'); e.className='calendar-day calendar-empty'; calendarGrid.appendChild(e); }
  for(let d=1; d<=days; d++){
    const date=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el=document.createElement('div'); el.className='calendar-day'; el.textContent=d;
    const now=new Date(); if(now.getFullYear()===year && now.getMonth()===month && now.getDate()===d) el.classList.add('today');
    if(selectedDate===date) el.classList.add('selected');
    const emo=state.emotions[date]; if(emo){ const map={feliz:'😊',triste:'😢',estresado:'😣',calmo:'😌'}; const s=document.createElement('span'); s.className='emoji-small'; s.textContent=map[emo]||'😶'; el.appendChild(s); }
    el.addEventListener('click', ()=>{ selectedDate=date; renderCalendar(currentMonth,currentYear); renderModalTasks(date); setHidden(dayModal,false); });
    el.addEventListener('dragover', e=>e.preventDefault());
    el.addEventListener('drop', e=>{ e.preventDefault(); const li=document.querySelector('.task-item.dragging'); if(!li) return; const id=li.dataset.id; const t=state.tasks.find(x=>x.id===id); if(!t) return; t.fecha=date; saveState(); renderModalTasks(date); renderTaskList(); });
    calendarGrid.appendChild(el);
  }
}
prevMonthBtn.onclick=()=>{ currentMonth--; if(currentMonth<0){currentMonth=11; currentYear--; } selectedDate=null; renderCalendar(currentMonth,currentYear); setHidden(dayModal,true); };
nextMonthBtn.onclick=()=>{ currentMonth++; if(currentMonth>11){currentMonth=0; currentYear++; } selectedDate=null; renderCalendar(currentMonth,currentYear); setHidden(dayModal,true); };

function renderModalTasks(date){
  modalDate.textContent = `Día: ${new Date(date).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}`;
  const emo=state.emotions[date]; const emoMap={feliz:'😊',triste:'😢',estresado:'😣',calmo:'😌'};
  modalEmotion.textContent = `Emoción: ${emo? (emoMap[emo]||'😶') : '😶'}`;
  modalNotification.classList.toggle('hidden', !!emo);
  const tasks=state.tasks.filter(t=>t.fecha===date && t.space===currentSpace);
  modalTasks.innerHTML = tasks.length? tasks.map(t=>`
    <div class="calendar-task ${t.completada?'complete':''}">
      <span>${t.completada?'✔️':'⬜'} ${t.texto}</span>
      <div class="task-actions">
        <button data-act="toggle" data-id="${t.id}">${t.completada?'✔️':'⬜'}</button>
        <button data-act="delete" data-id="${t.id}">🗑️</button>
      </div>
    </div>`).join('') : `<span class="muted">Sin tareas para este día</span>`;
  modalTasks.querySelectorAll('button[data-act]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id=b.getAttribute('data-id'); const act=b.getAttribute('data-act');
      if(act==='toggle') toggleTask(id, !(state.tasks.find(x=>x.id===id)?.completada));
      if(act==='delete') deleteTask(id);
      renderModalTasks(date);
    });
  });
}
modalAddTaskBtn?.addEventListener('click', ()=>{ const t=(modalTaskInput.value||'').trim(); if(!t||!selectedDate) return; addTask(t, selectedDate); modalTaskInput.value=''; renderModalTasks(selectedDate); });
modalTaskInput?.addEventListener('keydown', e=>{ if(e.key==='Enter') modalAddTaskBtn.click(); });

/* Floating add -> hoy */
document.getElementById('floating-add-btn')?.addEventListener('click', ()=>{ selectedDate=todayStr(); renderModalTasks(selectedDate); setHidden(dayModal,false); });

/* Anti-stress bubbles */
function makeBubbles(){
  if(!antistressContainer) return; antistressContainer.innerHTML='';
  for(let i=0;i<10;i++){ const b=document.createElement('div'); b.className='antistress-bubble'; b.addEventListener('pointerdown', ()=>{ b.classList.add('exploding'); setTimeout(()=>{ b.remove(); if(antistressContainer.childElementCount===0) makeBubbles(); },280); }); antistressContainer.appendChild(b); }
}
openAntistressBtn?.addEventListener('click', ()=>{ setHidden(antistressModal,false); makeBubbles(); });
closeAntistressModal?.addEventListener('click', ()=> setHidden(antistressModal,true));
antistressModal?.addEventListener('click', e=>{ if(e.target===antistressModal) setHidden(antistressModal,true); });

/* Atajos */
window.addEventListener('keydown', e=>{
  if(e.key==='Escape'){ [focusModeModal, dayModal, antistressModal, pinModal].some(m=> m && !m.classList.contains('hidden') && (setHidden(m,true), true)); }
});

/* Contador hoy */
function updateTodayCounter(){ const n = state.tasks.filter(t=>t.fecha===todayStr() && t.completada && t.space===currentSpace).length; todayCounter.textContent=`Hoy: ${n} ✔️`; }

/* Settings toggles */
settingsBtn?.addEventListener('click', ()=>{ settingsSection.classList.toggle('hidden'); });
autoThemeToggle?.addEventListener('change', ()=>{ state.settings.autoTheme=autoThemeToggle.checked; if(state.settings.autoTheme){ autoThemeApplyByHour(); } saveState(); applyDayMode(); });
soundToggle?.addEventListener('change', ()=>{ state.settings.soundOn=soundToggle.checked; saveState(); });

/* Init */
function init(){
  backgroundSelector.value = state.settings.background || 'default';
  avatarSelector.value = state.settings.avatar || 'default';
  autoThemeToggle.checked = !!state.settings.autoTheme;
  soundToggle.checked = !!state.settings.soundOn;

  if(state.settings.autoTheme) autoThemeApplyByHour();
  applyDayMode(); applyBackground();

  setEmocion(emocionActual); // también carga sugerencias
  renderCalendar(currentMonth,currentYear);
  renderTaskList(); updateTodayCounter();
  maybeLock();

  // Re‑aplicar tema al volver (por si cambió la hora)
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && state.settings.autoTheme){ autoThemeApplyByHour(); applyDayMode(); } });
}
window.addEventListener('DOMContentLoaded', init);
