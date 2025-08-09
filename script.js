/*************************************************
 * TaskGarden – UX Award Pack v1 (sin módulos)
 * - localStorage 100%
 * - recordatorios con datetime picker
 * - snackbar deshacer, edición inline, búsqueda, atajos
 **************************************************/
const LS_KEY = 'tg_state_ui_premium_v1';

function defaultState(){
  return {
    tasks: [], // {id, texto, completada, space, fecha, notas, createdAt, reminderAt}
    emotions: {}, // {'YYYY-MM-DD': 'feliz'|'triste'|'estresado'|'calmo'}
    settings: { dayMode:false, autoTheme:true, background:'default', avatar:'default', soundOn:true, pinEnabled:false, pin:'' },
    frequentTasks: []
  };
}
const uid = ()=> Math.random().toString(36).slice(2,9)+Date.now().toString(36);
const todayStr = ()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const loadState = ()=> { try{const r=localStorage.getItem(LS_KEY); return r?JSON.parse(r):defaultState();}catch{ return defaultState(); } };
let state = loadState();
const saveState = ()=> localStorage.setItem(LS_KEY, JSON.stringify(state));

/* ===== Global UI refs ===== */
let currentSpace='personal', emocionActual='feliz', selectedDate=null;
let currentMonth=new Date().getMonth(), currentYear=new Date().getFullYear();
let pomodoroInterval=null, pomodoroTime=25*60, audioCtx=null;
const $ = s=>document.querySelector(s);
const $$ = s=>document.querySelectorAll(s);

/* DOM */
const avatarEmocional = $('#avatar-emocional');
const modoCalmaBtn = $('#modo-calma-btn');
const darkToggleBtn = $('#day-night-toggle');
const settingsBtn = $('#settings-btn');
const settingsSection = $('#settings-section');
const backgroundSelector = $('#background-selector');
const avatarSelector = $('#avatar-selector');
const autoThemeToggle = $('#auto-theme-toggle');
const soundToggle = $('#sound-toggle');
const todayCounter = $('#today-counter');

const taskInput = $('#task-input');
const addTaskBtn = $('#add-task-btn');
const searchInput = $('#search-input');
const clearSearchBtn = $('#clear-search-btn');
const taskList = $('#task-list');
const emocionCards = $$('.emocion-card');
const spaceBtns = $$('.space-btn');

const calendarGrid = $('#calendar-grid');
const calendarMonth = $('#calendar-month');
const prevMonthBtn = $('#prev-month');
const nextMonthBtn = $('#next-month');
const calendarTasks = $('#calendar-tasks');

const dayModal = $('#day-modal');
const modalDate = $('#day-title');
const modalEmotion = $('#modal-emotion');
const modalNotification = $('#modal-notification');
const modalTasks = $('#modal-tasks');
const modalTaskInput = $('#modal-task-input');
const modalAddTaskBtn = $('#modal-add-task-btn');
const modalCloses = $$('.modal-close');

const focusModeModal = $('#focus-mode');
const focusTask = $('#focus-task');
const pomodoroTimer = $('#pomodoro-timer');
const pomodoroStartBtn = $('#pomodoro-start-btn');
const pomodoroResetBtn = $('#pomodoro-reset-btn');

const openAntistressBtn = $('#open-antistress-btn');
const antistressModal = $('#antistress-modal');
const closeAntistressModal = $('#close-antistress-modal');
const antistressContainer = $('#antistress-bubbles-container');

const pinModal = $('#pin-modal');
const pinInput = $('#pin-input');
const pinSubmitBtn = $('#pin-submit-btn');
const pinSetBtn = $('#pin-set-btn');
const pinDisableBtn = $('#pin-disable-btn');
const openPinBtn = $('#open-pin-btn');

const notifPermissionBtn = $('#notif-permission-btn');

const reminderModal = $('#reminder-modal');
const reminderDT = $('#reminder-dt');
const reminderSaveBtn = $('#reminder-save-btn');
const reminderClearBtn = $('#reminder-clear-btn');
const reminderFor = $('#reminder-for');

const snackbar = $('#snackbar');

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
function showToast(msg, withUndo=false, onUndo=()=>{}){
  snackbar.innerHTML = `<span>${msg}</span>${withUndo?'<button class="undo">Deshacer</button>':''}`;
  snackbar.classList.add('show');
  let timer = setTimeout(()=> snackbar.classList.remove('show'), 4000);
  const btn = snackbar.querySelector('.undo');
  if(btn){ btn.onclick = ()=>{ clearTimeout(timer); snackbar.classList.remove('show'); onUndo(); }; }
}
function autoThemeApplyByHour(){ const h=new Date().getHours(); state.settings.dayMode = (h>=7 && h<19); }
function applyDayMode(){ document.body.classList.toggle('day-mode', !!state.settings.dayMode); darkToggleBtn.textContent = state.settings.dayMode ? '🌙' : '☀️'; }

/* ===== Tema / Fondo / Avatar ===== */
darkToggleBtn?.addEventListener('click', ()=>{
  if (state.settings.autoTheme) { state.settings.autoTheme=false; autoThemeToggle.checked=false; }
  state.settings.dayMode=!state.settings.dayMode; saveState(); applyDayMode(); darkToggleBtn.classList.add('pulse');
  setTimeout(()=>darkToggleBtn.classList.remove('pulse'),220);
});
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
  const dl=$('#task-suggestions'); if(!dl) return;
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
  const newTask = { id:uid(), texto:t, completada:false, space:currentSpace, fecha, notas:'', createdAt:Date.now(), reminderAt:null };
  state.tasks.push(newTask);
  saveState(); pushFrequent(t); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
  showToast('Tarea creada');
}
function toggleTask(id, complete){
  const task=state.tasks.find(x=>x.id===id); if(!task) return;
  const prev = {...task};
  task.completada=!!complete; if(complete && task.reminderAt) task.reminderAt=null;
  saveState();
  if(complete){ confetti(); playBeep(); avatarEmocional.classList.add('bounce'); setTimeout(()=>avatarEmocional.classList.remove('bounce'),500); if('vibrate' in navigator) navigator.vibrate(40); updateAvatarByProgress(); }
  renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
  showToast(complete?'Tarea completada':'Tarea re‑abierta', true, ()=>{ Object.assign(task, prev); saveState(); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate); });
}
function deleteTask(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  const backup = {...t};
  state.tasks = state.tasks.filter(x=>x.id!==id);
  if (reminderTimers.has(id)) { clearTimeout(reminderTimers.get(id)); reminderTimers.delete(id); }
  saveState(); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate);
  showToast('Tarea eliminada', true, ()=>{ state.tasks.push(backup); saveState(); renderTaskList(); updateTodayCounter(); if(selectedDate) renderModalTasks(selectedDate); });
}

/* Edición inline (doble click o F2) */
function makeEditable(span, task){
  if (span.dataset.editing==='1') return;
  span.dataset.editing='1';
  const input=document.createElement('input');
  input.type='text'; input.value=task.texto; input.className='edit-input';
  input.style.width = Math.min(Math.max(span.textContent.length*9, 120), 360)+'px';
  span.replaceWith(input); input.focus(); input.select();
  const commit = (ok)=>{
    if(ok){
      const v=input.value.trim(); if(v && v!==task.texto){ task.texto=v; saveState(); renderTaskList(); }
      else renderTaskList();
    }else{ renderTaskList(); }
  };
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') commit(true); if(e.key==='Escape') commit(false); });
  input.addEventListener('blur',()=> commit(true));
}

addTaskBtn?.addEventListener('click', ()=>{ addTask(taskInput.value); taskInput.value=''; });
taskInput?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ addTask(taskInput.value); taskInput.value=''; } });

/* Render lista (con búsqueda + inline edit + recordatorios) */
let queryText = '';
function renderTaskList(){
  taskList.innerHTML='';
  const items = state.tasks
    .filter(t=>t.space===currentSpace && (!queryText || t.texto.toLowerCase().includes(queryText)))
    .sort((a,b)=> Number(a.completada)-Number(b.completada) || a.createdAt-b.createdAt);

  items.forEach(t=>{
    const li=document.createElement('li');
    li.className='task-item'+(t.completada?' complete':'');
    li.dataset.id=t.id; li.draggable=true;

    const span=document.createElement('span');
    span.textContent=t.texto;
    span.addEventListener('dblclick', ()=> makeEditable(span, t));
    li.appendChild(span);

    const actions=document.createElement('div'); actions.className='task-actions';
    actions.innerHTML = `
      <button data-action="toggle" title="Completar">${t.completada?'✔️':'⬜'}</button>
      <button data-action="bell" class="bell ${t.reminderAt?'has-reminder':''}" title="${t.reminderAt ? 'Quitar recordatorio' : 'Agregar recordatorio'}">🔔</button>
      <button data-action="delete" title="Borrar">🗑️</button>
      <button data-action="focus"  title="Enfocar">🎯</button>`;
    li.appendChild(actions);

    li.addEventListener('dragstart', ()=> li.classList.add('dragging'));
    li.addEventListener('dragend',   ()=> li.classList.remove('dragging'));
    li.addEventListener('keydown', e=>{ if(e.key==='F2') makeEditable(span, t); });

    li.addEventListener('click', async (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      const act=b.dataset.action;
      if(act==='toggle') toggleTask(t.id, !t.completada);
      if(act==='delete') deleteTask(t.id);
      if(act==='focus')  startFocusMode(t.id);
      if(act==='bell'){
        openReminderPicker(t);
      }
    });
    taskList.appendChild(li);
  });
}

/* Búsqueda */
searchInput?.addEventListener('input', ()=>{
  queryText = (searchInput.value||'').trim().toLowerCase();
  renderTaskList();
});
clearSearchBtn?.addEventListener('click', ()=>{ searchInput.value=''; queryText=''; renderTaskList(); });

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
  const s=$('#semana-resumen');
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

/* Confetti bubbles */
function confetti(){
  const wrap=document.createElement('div'); wrap.className='bubbles';
  for(let i=0;i<16;i++){
    const s=document.createElement('span'); s.className='bubble';
    s.style.left=`${Math.random()*100}vw`; s.style.top=`${Math.random()*80+10}vh`;
    s.style.width=s.style.height=`${Math.random()*18+16}px`;
    s.style.background=`rgba(190,220,255,0.${Math.floor(Math.random()*5+5)})`;
    s.style.animationDelay=`${Math.random()}s`; s.addEventListener('animationend',()=>s.remove());
    wrap.appendChild(s); setTimeout(()=> s.classList.add('explode'), 380+Math.random()*420);
  }
  document.body.appendChild(wrap); setTimeout(()=> wrap.remove(), 1600);
}

/* ===== Recordatorios ===== */
const reminderTimers = new Map(); // id -> timeoutId
async function ensureNotifPermission(){ if (!('Notification' in window)) return false; if (Notification.permission==='granted') return true; if (Notification.permission==='denied') return false; try{const r=await Notification.requestPermission(); return r==='granted';}catch{return false;} }
function scheduleReminderForTask(task){
  if (reminderTimers.has(task.id)) { clearTimeout(reminderTimers.get(task.id)); reminderTimers.delete(task.id); }
  if (!task.reminderAt) return;
  const when=new Date(task.reminderAt).getTime(), delay = when - Date.now();
  if (delay <= 0 || task.completada) { task.reminderAt=null; saveState(); return; }
  const tid = setTimeout(async ()=>{
    const can = await ensureNotifPermission();
    const title='⏰ Recordatorio', body=task.texto;
    if (can) new Notification(title, { body, vibrate:[40,20,40] });
    else { if('vibrate' in navigator) navigator.vibrate(120); alert(`${title}\n\n${body}`); }
    playBeep(); task.reminderAt=null; saveState(); renderTaskList(); if(selectedDate) renderModalTasks(selectedDate);
  }, delay);
  reminderTimers.set(task.id, tid);
}
function scheduleAllReminders(){ reminderTimers.forEach(id=>clearTimeout(id)); reminderTimers.clear(); state.tasks.forEach(scheduleReminderForTask); }

/* Picker UI */
let reminderTaskRef = null;
function openReminderPicker(task){
  reminderTaskRef = task;
  $('#reminder-for').textContent = `Para: ${task.texto}`;
  // valor por defecto: ahora + 30 min
  const base = task.reminderAt ? new Date(task.reminderAt) : new Date(Date.now()+30*60000);
  reminderDT.value = base.toISOString().slice(0,16);
  setHidden(reminderModal,false);
}
reminderSaveBtn?.addEventListener('click', ()=>{
  if(!reminderTaskRef) return;
  const val = reminderDT.value;
  if(!val){ alert('Selecciona fecha y hora.'); return; }
  reminderTaskRef.reminderAt = new Date(val).toISOString();
  saveState(); scheduleReminderForTask(reminderTaskRef); renderTaskList(); if(selectedDate) renderModalTasks(selectedDate);
  setHidden(reminderModal,true); showToast('Recordatorio guardado');
});
reminderClearBtn?.addEventListener('click', ()=>{
  if(!reminderTaskRef) return;
  reminderTaskRef.reminderAt = null; saveState(); scheduleReminderForTask(reminderTaskRef); renderTaskList(); if(selectedDate) renderModalTasks(selectedDate);
  setHidden(reminderModal,true); showToast('Recordatorio quitado');
});

/* Calendario */
function getMonthName(m){ return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m]; }
function renderCalendar(month,year){
  calendarGrid.innerHTML=''; calendarMonth.textContent=`${getMonthName(month)} ${year}`;
  const first=new Date(year,month,1).getDay(); const days=new Date(year,month+1,0).getDate();
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
        <button data-act="bell"   data-id="${t.id}" class="bell ${t.reminderAt?'has-reminder':''}">🔔</button>
        <button data-act="delete" data-id="${t.id}">🗑️</button>
      </div>
    </div>`).join('') : `<span class="muted">Sin tareas para este día</span>`;
  modalTasks.querySelectorAll('button[data-act]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const id=b.getAttribute('data-id'); const act=b.getAttribute('data-act');
      if(act==='toggle') toggleTask(id, !(state.tasks.find(x=>x.id===id)?.completada));
      if(act==='delete') deleteTask(id);
      if(act==='bell'){ const task = state.tasks.find(x=>x.id===id); if(task) openReminderPicker(task); }
      renderModalTasks(date);
    });
  });
}
modalAddTaskBtn?.addEventListener('click', ()=>{ const t=(modalTaskInput.value||'').trim(); if(!t||!selectedDate) return; addTask(t, selectedDate); modalTaskInput.value=''; renderModalTasks(selectedDate); });
modalCloses.forEach(b=> b.addEventListener('click', ()=>{ const id=b.getAttribute('data-close'); setHidden(document.getElementById(id),true); if(id==='focus-mode'){ clearInterval(pomodoroInterval); pomodoroInterval=null; pomodoroStartBtn.textContent='Iniciar'; } }));

/* Floating add -> hoy */
$('#floating-add-btn')?.addEventListener('click', ()=>{ selectedDate=todayStr(); renderModalTasks(selectedDate); setHidden(dayModal,false); });

/* Anti-stress */
function makeBubbles(){ if(!antistressContainer) return; antistressContainer.innerHTML=''; for(let i=0;i<10;i++){ const b=document.createElement('div'); b.className='antistress-bubble'; b.addEventListener('pointerdown', ()=>{ b.classList.add('exploding'); setTimeout(()=>{ b.remove(); if(antistressContainer.childElementCount===0) makeBubbles(); },280); }); antistressContainer.appendChild(b); } }
openAntistressBtn?.addEventListener('click', ()=>{ setHidden(antistressModal,false); makeBubbles(); });
closeAntistressModal?.addEventListener('click', ()=> setHidden(antistressModal,true));
antistressModal?.addEventListener('click', e=>{ if(e.target===antistressModal) setHidden(antistressModal,true); });

/* Atajos */
window.addEventListener('keydown', e=>{
  if(e.key==='Escape'){ [focusModeModal, dayModal, antistressModal, pinModal, reminderModal].some(m=> m && !m.classList.contains('hidden') && (setHidden(m,true), true)); }
  if((e.key==='n' || e.key==='N') && (e.ctrlKey||e.metaKey) || e.key==='N'){ taskInput?.focus(); e.preventDefault(); }
  if(e.key==='/'){ searchInput?.focus(); e.preventDefault(); }
  if(e.key==='s' || e.key==='S'){ settingsSection?.classList.toggle('hidden'); e.preventDefault(); }
  if(e.key==='d' || e.key==='D'){ darkToggleBtn?.click(); e.preventDefault(); }
});

/* Contador hoy */
function updateTodayCounter(){ const n = state.tasks.filter(t=>t.fecha===todayStr() && t.completada && t.space===currentSpace).length; todayCounter.textContent=`Hoy: ${n} ✔️`; }

/* Settings toggles */
settingsBtn?.addEventListener('click', ()=>{ settingsSection.classList.toggle('hidden'); });
autoThemeToggle?.addEventListener('change', ()=>{ state.settings.autoTheme=autoThemeToggle.checked; if(state.settings.autoTheme){ autoThemeApplyByHour(); } saveState(); applyDayMode(); });
soundToggle?.addEventListener('change', ()=>{ state.settings.soundOn=soundToggle.checked; saveState(); });
notifPermissionBtn?.addEventListener('click', async ()=>{ if (!('Notification' in window)) { alert('Este navegador no soporta notificaciones.'); return; } let res = Notification.permission; if (res !== 'granted'){ try{ res = await Notification.requestPermission(); }catch{} } if (res === 'granted'){ new Notification('✅ Notificaciones habilitadas', { body: 'Todo listo para tus recordatorios.' }); } else { alert('No se otorgaron permisos. Usaré avisos en pantalla como fallback.'); } });

/* Init */
function init(){
  backgroundSelector.value = state.settings.background || 'default';
  avatarSelector.value = state.settings.avatar || 'default';
  autoThemeToggle.checked = !!state.settings.autoTheme;
  soundToggle.checked = !!state.settings.soundOn;
  if(state.settings.autoTheme) autoThemeApplyByHour();
  applyDayMode(); applyBackground();

  setEmocion(emocionActual);
  renderCalendar(currentMonth,currentYear);
  renderTaskList();
  updateTodayCounter();
  scheduleAllReminders();
  maybeLock();

  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible' && state.settings.autoTheme){ autoThemeApplyByHour(); applyDayMode(); } });
}
window.addEventListener('DOMContentLoaded', init);
