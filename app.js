"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
const clamp=(v,lo,hi)=>v<lo?lo:v>hi?hi:v;
function shuffle(a){const b=a.slice();for(let i=b.length-1;i>0;i--){const j=rnd(i+1);[b[i],b[j]]=[b[j],b[i]];}return b;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const uid=p=>p+'_'+Math.random().toString(36).slice(2,9);
const pad2=n=>String(n).padStart(2,'0');
const fmtDate=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayKey=()=>fmtDate(new Date());
const toMin=t=>{if(!t||typeof t!=='string')return 0;const[h,m]=t.split(':').map(Number);return (h||0)*60+(m||0);};
const dowNames=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const dowShort=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const monNames=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const TIMEOUT=Symbol('timeout');

const STORAGE_KEY='navlife-unified-v6';
const DEFAULT_STATE={
  version:6,
  shared:{onboarded:false,theme:'light',sound:true,haptics:true,name:'Игрок',avatar:'🧠',avatarType:'emoji',dailyGoal:3},
  navlife:{goals:[],schedule:[],programs:[],baseRoutine:[],dailyStats:{},viewDate:todayKey(),customKnowledge:[],baseSkip:{}},
  neurofit:{xp:0,streak:0,bestStreak:0,lastDay:null,todayDay:null,todayCount:0,
    totalSessions:0,totalMs:0,levels:{},manualDiff:{},records:{},sessions:[],catTried:{},preferredMode:'normal'},
  nutrition:{
    goals:{calories:2000,protein:100,fat:70,carbs:250,water:2000},
    user:{gender:'m',age:30,weight:75,height:180,activity:1.4,goalType:'maintain'},
    days:{},weights:[],myFoods:[],templates:[],viewDate:todayKey()
  }
};
let S=loadState();
let saveQ=false;
function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){
      const oldRaw=localStorage.getItem('navlife-unified-v5')||localStorage.getItem('navlife-unified-v4')||localStorage.getItem('navlife-unified-v3');
      if(oldRaw) return migrateState(JSON.parse(oldRaw));
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
    return migrateState(JSON.parse(raw));
  }catch(e){return JSON.parse(JSON.stringify(DEFAULT_STATE));}
}
function migrateState(p){
  return {
    version:6,
    shared:{...DEFAULT_STATE.shared,...(p.shared||{}),
      avatarType:(p.shared&&p.shared.avatar&&String(p.shared.avatar).startsWith('data:'))?'photo':((p.shared&&p.shared.avatarType)||'emoji')},
    navlife:{...DEFAULT_STATE.navlife,...(p.navlife||{}),
      customKnowledge:((p.navlife||{}).customKnowledge)||[],
      baseSkip:((p.navlife||{}).baseSkip)||{}},
    neurofit:{...DEFAULT_STATE.neurofit,...(p.neurofit||{}),
      levels:{...DEFAULT_STATE.neurofit.levels,...((p.neurofit||{}).levels||{})},
      manualDiff:{...DEFAULT_STATE.neurofit.manualDiff,...((p.neurofit||{}).manualDiff||{})},
      records:{...DEFAULT_STATE.neurofit.records,...((p.neurofit||{}).records||{})}},
    nutrition:{...DEFAULT_STATE.nutrition,...(p.nutrition||{}),
      goals:{...DEFAULT_STATE.nutrition.goals,...((p.nutrition||{}).goals||{})},
      user:{...DEFAULT_STATE.nutrition.user,...((p.nutrition||{}).user||{})}}
  };
}
function saveState(){
  if(saveQ) return;
  saveQ=true;
  requestAnimationFrame(()=>{
    saveQ=false;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(S));}catch(e){}
  });
}
function resetState(){try{localStorage.removeItem(STORAGE_KEY);}catch(e){} S=JSON.parse(JSON.stringify(DEFAULT_STATE));}
function applyTheme(){
  document.documentElement.dataset.theme=S.shared.theme;
  const m=document.querySelector('meta[name="theme-color"]');
  if(m) m.content=S.shared.theme==='dark'?'#000000':'#EDEFEA';
}
function avatarHtml(avatar,size=48){
  if(avatar&&String(avatar).startsWith('data:')){
    return `<img src="${avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block" alt="avatar">`;
  }
  return `<span style="font-size:${Math.round(size*0.7)}px;line-height:1">${avatar||'🧠'}</span>`;
}

let audioCtx=null;
function ensureAudio(){
  if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){audioCtx=null;}}
  if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function tone(freq,dur=.12,type='sine',gain=.06){
  if(!S.shared.sound) return;
  const ctx=ensureAudio(); if(!ctx) return;
  try{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=freq;
    const t=ctx.currentTime;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(gain,t+.012);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(ctx.destination);
    o.start();o.stop(t+dur+.02);
  }catch(e){}
}
const SFX={
  tap:()=>tone(520,.05,'sine',.03),
  ok:()=>{tone(660,.1,'sine',.055);setTimeout(()=>tone(880,.14,'sine',.05),70);},
  err:()=>tone(180,.2,'sawtooth',.04),
  levelup:()=>[0,80,160,260].forEach((d,i)=>setTimeout(()=>tone([523,659,784,1047][i],.18,'triangle',.06),d)),
  beep:i=>tone([392,494,587,698,784,880][i%6],.22,'sine',.06),
  win:()=>[0,100,200,340].forEach((d,i)=>setTimeout(()=>tone([523,659,784,1047][i],.22,'sine',.055),d)),
  endMelody:()=>[0,150,300,500].forEach((d,i)=>setTimeout(()=>tone([523,659,784,1047][i],.3,'sine',.06),d)),
  tick:()=>tone(700,.06,'sine',.04),
  timerStart:()=>{tone(523,.13,'sine',.06);setTimeout(()=>tone(784,.16,'sine',.06),110);},
  timerEnd:()=>{tone(880,.15,'sine',.07);setTimeout(()=>tone(880,.15,'sine',.07),180);setTimeout(()=>tone(1175,.28,'sine',.07),360);},
  timerLast3:()=>tone(600,.07,'sine',.045),
  pomodoroEnd:()=>{[0,150,300,450].forEach((d,i)=>setTimeout(()=>tone([523,659,784,1047][i],.25,'triangle',.06),d));}
};
function buzz(p){if(!S.shared.haptics||!navigator.vibrate) return;try{navigator.vibrate(p);}catch(e){}}

let flashT=null;
function flash(kind){
  const el=$('#flash');if(!el) return;
  el.className='flash '+kind+' on';
  clearTimeout(flashT);
  flashT=setTimeout(()=>{el.className='flash '+kind;},170);
}
let toastT=null;
function toast(msg,ms=2400,cls){
  const el=$('#toast');if(!el) return;
  el.textContent=msg;
  el.className='toast'+(cls?' '+cls:'');
  el.classList.add('on');
  clearTimeout(toastT);
  toastT=setTimeout(()=>el.classList.remove('on'),ms);
}

const LEVEL_NAMES=['Новичок','Ученик','Опытный','Продвинутый','Эксперт','Мастер'];
const STREAK_TO_LEVELUP=10;
const xpForLevel=lv=>Math.round(180*Math.pow(lv,1.35));
function levelInfo(xp){
  let lv=1,acc=0;
  while(lv<99&&acc+xpForLevel(lv)<=xp){acc+=xpForLevel(lv);lv++;}
  const need=xpForLevel(lv),into=xp-acc;
  return {level:lv,into,need,pct:clamp(into/need,0,1)};
}

let modalStack=[];
function openModal(html,after){
  const root=$('#modal-root');
  root.classList.add('open');
  const layer=document.createElement('div');
  layer.className='modal-layer';
  layer.innerHTML=`<div class="modal-backdrop"></div><div class="modal">${html}</div>`;
  root.appendChild(layer);
  modalStack.push(layer);
  $('.modal-backdrop',layer).onclick=()=>closeModal(layer);
  if(after) after(layer);
  return layer;
}
function closeModal(layer){
  const root=$('#modal-root');
  let target=layer||modalStack[modalStack.length-1];
  if(!target) return;
  const i=modalStack.indexOf(target);
  if(i>=0) modalStack.splice(i,1);
  target.style.transition='opacity .2s';
  target.style.opacity='0';
  setTimeout(()=>{
    if(target.parentNode) target.parentNode.removeChild(target);
    if(modalStack.length===0) root.classList.remove('open');
  },200);
}
function closeAllModals(){
  modalStack.forEach(l=>{if(l.parentNode) l.parentNode.removeChild(l);});
  modalStack=[];
  $('#modal-root').classList.remove('open');
}

let currentScreen=null;
function go(name){
  if(window.__exCleanup){try{window.__exCleanup();}catch(e){} window.__exCleanup=null;}
  if(window.__queue) window.__queue=[];
  closeAllModals();
  const host=$('#screens');
  host.innerHTML='';
  const noNav=['onboarding','goals','programs','knowledge','levels'];
  $('#nav').classList.toggle('hidden',noNav.includes(name));
  const renderers={
    onboarding:renderOnboarding,today:renderToday,schedule:renderSchedule,
    nutrition:renderNutrition,brain:renderBrain,stats:renderStats,
    profile:renderProfile,goals:renderGoals,programs:renderPrograms,
    knowledge:renderKnowledge,levels:renderLevels
  };
  const fn=renderers[name]||renderToday;
  const el=fn();
  el.classList.add('active');
  host.appendChild(el);
  currentScreen=name;
  $$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  window.scrollTo(0,0);
  /* Хук для Feature Pack */
  if(window.__afterGo){
    try{window.__afterGo(name);}catch(e){console.warn('[afterGo]',e);}
  }
}
$$('.nav-btn').forEach(b=>b.onclick=()=>{SFX.tap();buzz(8);go(b.dataset.nav);});

(function(){
  let last=0;
  document.addEventListener('touchend',e=>{
    const n=Date.now();
    if(n-last<=350){if(!e.target.closest('input, textarea')) e.preventDefault();}
    last=n;
  },{passive:false});
  ['gesturestart','gesturechange','gestureend'].forEach(ev=>
    document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  window.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey) e.preventDefault();},{passive:false});
})();

function refreshStreak(){
  const t=todayKey();
  if(S.neurofit.lastDay===t) return;
  const y=new Date(Date.now()-86400000).toISOString().slice(0,10);
  S.neurofit.streak=(S.neurofit.lastDay===y)?S.neurofit.streak+1:1;
  S.neurofit.lastDay=t;
  if(S.neurofit.streak>S.neurofit.bestStreak) S.neurofit.bestStreak=S.neurofit.streak;
  saveState();
}
function ensureToday(){
  const t=todayKey();
  if(S.neurofit.todayDay!==t){S.neurofit.todayDay=t;S.neurofit.todayCount=0;saveState();}
}

const BUILTIN_PROGRAMS=[
  {title:'Утро',category:'утро',description:'Начать день осознанно.',
   steps:[
     {title:'Подъём',type:'checkbox',instructions:'Встань и потянись.',why:'Плавное пробуждение.'},
     {title:'Открыть окно',type:'checkbox',instructions:'Проветри.',why:'Свежий воздух.'},
     {title:'Умыться',type:'checkbox',instructions:'Прохладной водой.',why:'Бодрость.'},
     {title:'Прополоскать рот',type:'checkbox',why:'Гигиена.'},
     {title:'Стакан воды',type:'checkbox',instructions:'200–300 мл.',why:'Восполнение жидкости.'},
     {title:'Заправить кровать',type:'checkbox',why:'Порядок в голове.'}
   ]},
  {title:'Зарядка',category:'физическая активность',description:'Полноценная тренировка.',
   steps:(()=>{
     const pos=['Положение 1','Положение 2','Положение 3','Положение 4','Положение 5'];
     const arr=[];
     pos.forEach((p,i)=>{
       arr.push({title:`${p} — левая нога`,type:'timer',duration:30,why:'Координация.'});
       if(i<pos.length-1) arr.push({title:'Смена ноги',type:'pause',duration:5,why:'Переход.'});
       arr.push({title:`${p} — правая нога`,type:'timer',duration:30,why:'Баланс.'});
       if(i<pos.length-1) arr.push({title:'Смена положения',type:'pause',duration:5,why:'Подготовка.'});
     });
     arr.push(
       {title:'Лыжник лицом к резинке',type:'reps',repetitions:20,why:'Разогрев.'},
       {title:'Отведение от груди лицом',type:'reps',repetitions:20,why:'Грудные.'},
       {title:'Выносы рук вверх',type:'reps',repetitions:20,why:'Плечи.'},
       {title:'Лыжник спиной',type:'reps',repetitions:20,why:'Спина.'},
       {title:'Отведение от груди спиной',type:'reps',repetitions:20,why:'Плечи.'},
       {title:'Робот правая',type:'reps',repetitions:20,why:'Координация.'},
       {title:'Робот левая',type:'reps',repetitions:20,why:'Симметрия.'},
       {title:'Удар правой',type:'reps',repetitions:20,why:'Скорость.'},
       {title:'Удар левой',type:'reps',repetitions:20,why:'Скорость.'},
       {title:'Отжимания',type:'reps',repetitions:20,why:'Грудь.'},
       {title:'Приседания',type:'reps',repetitions:20,why:'Ноги.'},
       {title:'Гиперэкстензия',type:'reps',repetitions:20,why:'Спина.'},
       {title:'Пресс',type:'reps',repetitions:20,why:'Пресс.'},
       {title:'Подтягивания',type:'reps',repetitions:8,why:'Широчайшие.'},
       {title:'Вис на турнике',type:'timer',duration:120,why:'Вытяжение.'},
       {title:'Растяжка',type:'timer',duration:360,why:'Гибкость.'}
     );
     return arr;
   })()},
  {title:'Контрастный душ',category:'утро',description:'Закаливание.',
   steps:[
     {title:'Горячая вода',type:'timer',duration:50,why:'Расширяет сосуды.'},
     {title:'Переключение',type:'pause',duration:3,why:'Смена.'},
     {title:'Холодная',type:'timer',duration:40,why:'Бодрит.'},
     {title:'Переключение',type:'pause',duration:3,why:'Смена.'},
     {title:'Горячая',type:'timer',duration:40,why:'Расширение.'},
     {title:'Переключение',type:'pause',duration:3,why:'Смена.'},
     {title:'Холодная',type:'timer',duration:30,why:'Сужаем.'},
     {title:'Переключение',type:'pause',duration:3,why:'Смена.'},
     {title:'Горячая',type:'timer',duration:30,why:'Расширяем.'},
     {title:'Переключение',type:'pause',duration:3,why:'Смена.'},
     {title:'Холодная финал',type:'timer',duration:30,why:'Контраст.'},
     {title:'Завершение',type:'checkbox',why:'Готово.'}
   ]},
  {title:'Помодоро',category:'концентрация',description:'Классическая техника: 4 блока по 25 минут с короткими перерывами и длинным отдыхом в конце.',
   steps:[
     {title:'Работа · блок 1',type:'timer',duration:1500,instructions:'Полная концентрация. Убери телефон, закрой лишние вкладки.',why:'25 минут — оптимальная длительность для глубокой работы.'},
     {title:'Короткий перерыв',type:'pause',duration:300,instructions:'Встань, попей воды, разомнись.',why:'Даёт мозгу восстановиться перед следующим блоком.'},
     {title:'Работа · блок 2',type:'timer',duration:1500,instructions:'Вернись к задаче.',why:'Второй цикл помодоро.'},
     {title:'Короткий перерыв',type:'pause',duration:300,instructions:'Не залипай в телефоне — лучше размяться.',why:'Восстановление.'},
     {title:'Работа · блок 3',type:'timer',duration:1500,instructions:'Третий блок.',why:'Держим темп.'},
     {title:'Короткий перерыв',type:'pause',duration:300,instructions:'Отдохни.',why:'Отдых.'},
     {title:'Работа · блок 4',type:'timer',duration:1500,instructions:'Финальный блок.',why:'Последний рывок.'},
     {title:'Длинный перерыв',type:'pause',duration:900,instructions:'15 минут полноценного отдыха.',why:'После 4 помодоро организму нужен полноценный перерыв.'}
   ]},
  {title:'Вечер',category:'вечер',description:'Плавный переход ко сну.',
   steps:[
     {title:'Проверить обувь',type:'checkbox',why:'Утром меньше забот.'},
     {title:'Одежда на завтра',type:'checkbox',why:'Экономит время.'},
     {title:'Рюкзак/сумка',type:'checkbox',why:'Ничего не забудешь.'},
     {title:'Вода на окно',type:'checkbox',why:'Утро с воды.'},
     {title:'Завтрак заранее',type:'checkbox',why:'Готово утром.'},
     {title:'Планы на завтра',type:'checkbox',why:'Чёткий план.'},
     {title:'Будильник',type:'checkbox',why:'Не проспишь.'},
     {title:'Растяжка, проветрить',type:'checkbox',why:'Расслабление.'},
     {title:'Гигиена',type:'checkbox',why:'Чистота.'},
     {title:'Читать 30 мин',type:'timer',duration:1800,why:'Успокаивает.'},
     {title:'Похвалить себя',type:'checkbox',why:'Позитив.'},
     {title:'Отбой',type:'checkbox',why:'Спокойной ночи.'}
   ]}
];

const KNOWLEDGE=[
  {category:'привычки',title:'Маленькие действия работают лучше больших планов',
   what:'Привычка — действие, которое мозг выполняет с минимальным усилием.',
   why:'Сила воли истощается за день, а привычка — нет.',
   how:'Мозг закрепляет связь «сигнал → действие → награда».',
   apply:'Выбери один сигнал и привяжи к нему короткое действие.',
   example:'После чистки зубов — 5 отжиманий.'},
  {category:'концентрация',title:'Что крадёт внимание и как это остановить',
   what:'Переключение между задачами создаёт «остаточное внимание».',
   why:'Даже короткое отвлечение снижает качество следующих 10–20 минут.',
   how:'Переключение требует времени на загрузку контекста.',
   apply:'Планируй один фокус-блок без переключений.',
   example:'20 минут без телефона дают больше, чем час с проверками.'},
  {category:'сон',title:'Как режим сна влияет на решения',
   what:'Качество сна определяет, насколько легко мозг фильтрует важное.',
   why:'Недосып повышает тягу к быстрым удовольствиям.',
   how:'Во сне мозг закрепляет память и восстанавливает самоконтроль.',
   apply:'Зафиксируй время отхода и лёгкий ритуал за 20–30 минут.',
   example:'Свет, тишина, дыхание — сигнал телу.'},
  {category:'обучение',title:'Активное вспоминание против перечитывания',
   what:'Активное вспоминание — попытка воспроизвести по памяти.',
   why:'Тренирует достать знание из памяти.',
   how:'Каждая попытка вспомнить укрепляет нейронный путь.',
   apply:'Закрывай текст и перескажи по памяти.',
   example:'Сначала вспомни перевод, потом проверь.'},
  {category:'время',title:'Почему список дел не работает без времени',
   what:'Список без привязки ко времени — набор намерений.',
   why:'Мозг откладывает решения без дедлайна.',
   how:'Конкретное время превращает намерение в обязательство.',
   apply:'Перенеси три главные задачи в интервалы.',
   example:'«Написать отчёт» → «14:00–14:40».'},
  {category:'привычки',title:'Что делать после пропущенного дня',
   what:'Один пропущенный день — статистика, а не новая линия.',
   why:'Единичный пропуск почти не влияет на устойчивость. Вина — влияет.',
   how:'Самокритика воспринимается как стресс.',
   apply:'Просто вернись к следующему действию.',
   example:'Пропустил зарядку — сделай завтрашнюю обычно.'}
];

const FOOD_DB=[
  {n:'Овсянка на воде',kcal:88,p:3,f:1.7,c:15},
  {n:'Рис варёный',kcal:116,p:2.2,f:0.5,c:25},
  {n:'Гречка варёная',kcal:110,p:4,f:1.2,c:21},
  {n:'Макароны варёные',kcal:131,p:5,f:1.1,c:25},
  {n:'Куриная грудка',kcal:165,p:31,f:3.6,c:0},
  {n:'Индейка филе',kcal:189,p:29,f:7,c:0},
  {n:'Говядина',kcal:250,p:26,f:16,c:0},
  {n:'Свинина',kcal:290,p:25,f:21,c:0},
  {n:'Лосось',kcal:208,p:20,f:13,c:0},
  {n:'Треска',kcal:82,p:18,f:0.7,c:0},
  {n:'Тунец консерв.',kcal:116,p:26,f:1,c:0},
  {n:'Яйцо куриное',kcal:155,p:13,f:11,c:1.1},
  {n:'Творог 5%',kcal:121,p:17,f:5,c:3},
  {n:'Творог 2%',kcal:103,p:18,f:2,c:3.3},
  {n:'Молоко 2.5%',kcal:52,p:2.8,f:2.5,c:4.7},
  {n:'Кефир 1%',kcal:40,p:3,f:1,c:4},
  {n:'Сыр твёрдый',kcal:364,p:25,f:29,c:2},
  {n:'Йогурт натуральный',kcal:66,p:5,f:3.5,c:4},
  {n:'Хлеб белый',kcal:265,p:9,f:3,c:49},
  {n:'Хлеб чёрный',kcal:210,p:7,f:1,c:40},
  {n:'Картофель варёный',kcal:87,p:2,f:0.1,c:20},
  {n:'Банан',kcal:89,p:1.1,f:0.3,c:23},
  {n:'Яблоко',kcal:52,p:0.3,f:0.2,c:14},
  {n:'Апельсин',kcal:47,p:0.9,f:0.1,c:12},
  {n:'Виноград',kcal:69,p:0.7,f:0.2,c:18},
  {n:'Авокадо',kcal:160,p:2,f:15,c:9},
  {n:'Огурец',kcal:15,p:0.7,f:0.1,c:3.6},
  {n:'Помидор',kcal:18,p:0.9,f:0.2,c:3.9},
  {n:'Морковь',kcal:41,p:0.9,f:0.2,c:10},
  {n:'Капуста белая',kcal:25,p:1.3,f:0.1,c:6},
  {n:'Брокколи',kcal:34,p:2.8,f:0.4,c:7},
  {n:'Орехи грецкие',kcal:654,p:15,f:65,c:14},
  {n:'Миндаль',kcal:579,p:21,f:50,c:22},
  {n:'Оливковое масло',kcal:884,p:0,f:100,c:0},
  {n:'Сливочное масло',kcal:717,p:0.8,f:81,c:0.1},
  {n:'Кофе с молоком',kcal:35,p:1.5,f:1.5,c:4},
  {n:'Чай без сахара',kcal:1,p:0,f:0,c:0.2},
  {n:'Сок апельсиновый',kcal:45,p:0.7,f:0.2,c:10},
  {n:'Протеиновый батончик',kcal:180,p:20,f:6,c:15},
  {n:'Шоколад тёмный 70%',kcal:598,p:7.8,f:43,c:46},
  {n:'Печенье',kcal:417,p:5,f:20,c:60},
  {n:'Салат Цезарь',kcal:190,p:9,f:14,c:7},
  {n:'Борщ',kcal:60,p:2.5,f:2.5,c:7},
  {n:'Суп куриный',kcal:45,p:3,f:2,c:3},
  {n:'Плов',kcal:200,p:7,f:7,c:27},
  {n:'Пицца Маргарита',kcal:266,p:11,f:10,c:33},
  {n:'Сэндвич с курицей',kcal:240,p:15,f:8,c:26}
];

function migrateBaseRefs(){
  if(!S.navlife.baseSkip) S.navlife.baseSkip={};
  const today=todayKey();
  S.navlife.schedule.forEach(item=>{
    if(item.fromBase && !item.baseRef && item.date>=today){
      const match=S.navlife.baseRoutine.find(b=>
        b.title===item.title && b.startTime===item.startTime
      );
      if(match) item.baseRef=match.id;
    }
  });
}
function ensureBaseEventsForFuture(){
  if(!S.navlife.baseSkip) S.navlife.baseSkip={};
  const start=new Date();start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+60);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const ds=fmtDate(d);
    S.navlife.baseRoutine.forEach(b=>{
      const skipKey=`${ds}|${b.id}`;
      if(S.navlife.baseSkip[skipKey]) return;
      const exists=S.navlife.schedule.some(s=>
        s.date===ds &&
        s.fromBase &&
        (s.baseRef===b.id ||
          (!s.baseRef && s.title===b.title && s.startTime===b.startTime))
      );
      if(exists) return;
      const prog=b.programTitle?S.navlife.programs.find(p=>p.title===b.programTitle):null;
      S.navlife.schedule.push({
        id:uid('sch'),title:b.title,type:'task',
        startTime:b.startTime,endTime:b.endTime,date:ds,
        completed:false,programId:prog?prog.id:null,goalStepId:null,
        fromBase:true,baseRef:b.id
      });
    });
  }
}
function syncBaseEvents(){
  const today=todayKey();
  const activeIds=new Set(S.navlife.baseRoutine.map(b=>b.id));
  S.navlife.schedule=S.navlife.schedule.filter(item=>{
    if(!item.fromBase||item.date<today) return true;
    if(item.baseRef && !activeIds.has(item.baseRef) && !item.completed) return false;
    return true;
  });
  Object.keys(S.navlife.baseSkip).forEach(k=>{
    const[id]=k.split('|');
    if(!activeIds.has(id)) delete S.navlife.baseSkip[k];
  });
  ensureBaseEventsForFuture();
}
function ensureRecurringEvents(){
  const templates=S.navlife.schedule.filter(i=>i.repeatRule&&i.repeatRule!=='none');
  templates.forEach(tpl=>{
    const start=new Date(tpl.date+'T00:00:00');
    const end=new Date();end.setDate(end.getDate()+60);
    const days=[];
    if(tpl.repeatRule==='daily'){
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) days.push(new Date(d));
    }else if(tpl.repeatRule==='every_other_day'){
      let c=0;
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){if(c%2===0)days.push(new Date(d));c++;}
    }else if(tpl.repeatRule.startsWith('weekly_')){
      const nums=tpl.repeatRule.split('_')[1].split(',').map(Number);
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
        if(nums.includes(d.getDay())) days.push(new Date(d));
      }
    }
    days.forEach(d=>{
      const ds=fmtDate(d);
      if(ds===tpl.date) return;
      const exists=S.navlife.schedule.some(s=>
        s.date===ds&&
        s.title===tpl.title&&
        s.startTime===tpl.startTime&&
        s.endTime===tpl.endTime
      );
      if(!exists){
        const ni={...tpl,id:uid('sch'),date:ds,completed:false,fromRecurring:true,repeatRule:undefined};
        if(ni.programId&&!S.navlife.programs.find(p=>p.id===ni.programId)) ni.programId=null;
        S.navlife.schedule.push(ni);
      }
    });
  });
}
function ensureBaseForDate(ds){
  const has=S.navlife.schedule.some(it=>it.date===ds&&it.fromBase);
  if(has||S.navlife.baseRoutine.length===0) return;
  S.navlife.baseRoutine.forEach(b=>{
    const skipKey=`${ds}|${b.id}`;
    if(S.navlife.baseSkip[skipKey]) return;
    const prog=b.programTitle?S.navlife.programs.find(p=>p.title===b.programTitle):null;
    S.navlife.schedule.push({
      id:uid('sch'),title:b.title,type:'task',
      startTime:b.startTime,endTime:b.endTime,date:ds,
      completed:false,programId:prog?prog.id:null,goalStepId:null,
      fromBase:true,baseRef:b.id
    });
  });
}
function cleanupPrograms(){
  const need=BUILTIN_PROGRAMS.map(p=>p.title);
  S.navlife.programs=S.navlife.programs.filter(p=>p.builtin===false||need.includes(p.title));
  need.forEach(title=>{
    if(!S.navlife.programs.find(p=>p.title===title&&p.builtin===true)){
      const bp=BUILTIN_PROGRAMS.find(p=>p.title===title);
      if(bp) S.navlife.programs.push({
        ...bp,id:uid('prog'),builtin:true,
        steps:bp.steps.map(s=>({...s,id:uid('pstep')}))
      });
    }
  });
}
function seedIfEmpty(){
  if(S.navlife.programs.length===0){
    S.navlife.programs=BUILTIN_PROGRAMS.map(p=>({...p,id:uid('prog'),builtin:true,
      steps:p.steps.map(s=>({...s,id:uid('pstep')}))}));
  }else cleanupPrograms();
  if(!S.navlife.baseRoutine||S.navlife.baseRoutine.length===0){
    S.navlife.baseRoutine=[
      {id:uid('base'),title:'Утро',startTime:'06:30',endTime:'06:50',programTitle:'Утро'},
      {id:uid('base'),title:'Зарядка',startTime:'06:50',endTime:'07:30',programTitle:'Зарядка'},
      {id:uid('base'),title:'Контрастный душ',startTime:'07:30',endTime:'07:50',programTitle:'Контрастный душ'},
      {id:uid('base'),title:'Завтрак',startTime:'08:00',endTime:'08:20'},
      {id:uid('base'),title:'Обед',startTime:'13:00',endTime:'13:30'},
      {id:uid('base'),title:'Ужин',startTime:'19:00',endTime:'19:30'},
      {id:uid('base'),title:'Вечер',startTime:'21:00',endTime:'22:00',programTitle:'Вечер'}
    ];
  }
  if(!S.navlife.customKnowledge) S.navlife.customKnowledge=[];
  if(!S.navlife.baseSkip) S.navlife.baseSkip={};
  if(S.navlife.goals.length===0){
    S.navlife.goals=[{
      id:uid('goal'),title:'Выучить английский',icon:'🇬🇧',
      description:'Хочу уверенно понимать английскую речь.',
      status:'active',createdAt:todayKey(),
      steps:[
        {id:uid('gstep'),title:'Повторять 20 слов',completed:false,linkedScheduleItemId:null,linkedProgramId:null},
        {id:uid('gstep'),title:'Слушать речь',completed:false,linkedScheduleItemId:null,linkedProgramId:null},
        {id:uid('gstep'),title:'Упражнения',completed:false,linkedScheduleItemId:null,linkedProgramId:null},
        {id:uid('gstep'),title:'Читать текст',completed:false,linkedScheduleItemId:null,linkedProgramId:null}
      ]
    }];
  }
}
function bootState(){
  seedIfEmpty();
  migrateBaseRefs();
  ensureRecurringEvents();
  ensureBaseEventsForFuture();
  refreshStreak();
  ensureToday();
  saveState();
}

function itemsForDate(ds){return S.navlife.schedule.filter(i=>i.date===ds).sort((a,b)=>toMin(a.startTime)-toMin(b.startTime));}
function findGoalStep(gid){
  for(const g of S.navlife.goals){
    const s=g.steps.find(x=>x.id===gid);
    if(s) return {...s,goal:g};
  }
  return null;
}
function computeDailyStats(ds){
  const items=itemsForDate(ds);
  const planned=items.length,completed=items.filter(i=>i.completed).length;
  const percentage=planned?Math.round(completed/planned*100):0;
  S.navlife.dailyStats[ds]={planned,completed,percentage};
  return {planned,completed,percentage,remaining:planned-completed};
}
function fmtMinToClock(m){return `${pad2(Math.floor(m/60)%24)}:${pad2(m%60)}`;}
function dateLabel(ds){
  const t=todayKey();
  const d=new Date(ds+'T00:00:00');
  const y=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const tm=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const base=`${dowNames[d.getDay()][0].toUpperCase()+dowNames[d.getDay()].slice(1)}, ${d.getDate()} ${monNames[d.getMonth()]}`;
  if(ds===t) return 'Сегодня, '+base;
  if(ds===y) return 'Вчера, '+base;
  if(ds===tm) return 'Завтра, '+base;
  return base;
}

function renderToday(){
  const ds=todayKey();
  ensureBaseForDate(ds);
  const d=new Date();
  const items=itemsForDate(ds);
  const nowMin=d.getHours()*60+d.getMinutes();
  let current=items.find(i=>!i.completed&&toMin(i.startTime)<=nowMin&&nowMin<toMin(i.endTime));
  let currentIdx=current?items.indexOf(current):-1;
  let next=null;
  if(current){next=items.slice(currentIdx+1).find(i=>!i.completed);}
  else{
    current=items.find(i=>!i.completed&&toMin(i.startTime)>=nowMin)||items.find(i=>!i.completed);
    if(current){currentIdx=items.indexOf(current);next=items.slice(currentIdx+1).find(i=>!i.completed);}
  }
  const stat=computeDailyStats(ds);
  const nut=nutritionToday();
  const kcalPct=Math.round(nut.kcal/Math.max(1,S.nutrition.goals.calories)*100);

  const root=document.createElement('div');
  root.className='screen';
  let heroHtml='';
  if(!current){
    heroHtml=`<div class="card" style="text-align:center;padding:32px 24px">
      <div style="font-size:42px;margin-bottom:8px">🌿</div>
      <div class="h2" style="margin-bottom:6px">На сегодня всё выполнено</div>
      <p class="muted">Отличная работа!</p>
    </div>`;
  }else{
    const total=Math.max(1,toMin(current.endTime)-toMin(current.startTime));
    const isActive=toMin(current.startTime)<=nowMin&&nowMin<toMin(current.endTime);
    const remain=isActive?Math.max(0,toMin(current.endTime)-nowMin):total;
    const prog=current.programId?S.navlife.programs.find(p=>p.id===current.programId):null;
    const gs=current.goalStepId?findGoalStep(current.goalStepId):null;
    const why=prog?prog.description:(gs?`Двигает цель «${gs.goal.title}».`:null);
    heroHtml=`<div class="hero"><div class="hero-inner">
      <div class="eyebrow">${isActive?'СЕЙЧАС':'СЛЕДУЮЩЕЕ'}</div>
      <div class="lead">${esc(current.title)}</div>
      ${why?`<p class="why">Зачем: ${esc(why)}</p>`:''}
      <div class="between" style="align-items:flex-end;flex-wrap:wrap;gap:14px">
        <div class="time">${isActive?fmtMinToClock(remain):current.startTime}<small>${isActive?'осталось':'начало'}</small></div>
        ${prog
          ?`<button class="btn btn-primary btn-lg" data-run="${prog.id}" data-sched="${current.id}">▶ Начать</button>`
          :`<button class="btn btn-primary btn-lg" data-complete="${current.id}">${isActive?'Завершить':'Отметить'}</button>`}
      </div>
    </div></div>`;
  }
  const routeHtml=items.length?items.map(it=>{
    let cls='';
    if(it.completed) cls='done';
    else if(current&&it.id===current.id) cls='now';
    else if(toMin(it.endTime)<nowMin) cls='skipped';
    return `<div class="route-item ${cls}">
      <div class="route-node"></div>
      <div class="route-row">
        <div class="route-time">${it.startTime}</div>
        <div class="route-title">${esc(it.title)}</div>
        ${!it.completed?`<button class="icon-btn" style="width:32px;height:32px;font-size:13px" data-complete="${it.id}">✓</button>`:''}
      </div>
    </div>`;
  }).join(''):`<p class="muted">Пусто. Добавь события в «Делах».</p>`;

  root.innerHTML=`
    <div class="between" style="margin-bottom:16px">
      <div>
        <div class="tiny">${dowNames[d.getDay()]}, ${d.getDate()} ${monNames[d.getMonth()]}</div>
        <div class="h1" style="margin-top:3px">Привет, ${esc(S.shared.name)}</div>
      </div>
      <div class="chip amber" style="padding:8px 14px">🔥 <b>${S.neurofit.streak}</b></div>
    </div>
    ${heroHtml}
    ${(current&&next)?`<div class="card" style="padding:14px 18px;display:flex;align-items:center;gap:12px">
      <div class="tiny" style="color:var(--moss)">ДАЛЕЕ</div>
      <div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(next.title)}</div>
      <div class="muted" style="font-size:12px">${next.startTime}–${next.endTime}</div></div>
      <div style="color:var(--ink-mute)">→</div>
    </div>`:''}
    <div class="h3" style="margin:22px 0 12px;font-family:'Fraunces',serif;font-size:16px">План дня</div>
    <div class="route-list">${routeHtml}</div>
    <div class="card" style="margin-top:22px">
      <div class="between" style="margin-bottom:10px">
        <div class="h3">Дела сегодня</div>
        <div class="tiny">${stat.completed} / ${stat.planned}</div>
      </div>
      <div class="bar"><i class="on" style="--p:${(stat.percentage/100).toFixed(3)}"></i></div>
      <p class="muted" style="margin-top:10px;font-size:12.5px">${stat.percentage}% плана · ${stat.remaining} осталось</p>
    </div>
    <div class="card tappable" data-goto="nutrition" style="background:var(--moss-soft);border-color:transparent">
      <div class="between">
        <div>
          <div class="tiny" style="color:var(--moss)">Питание сегодня</div>
          <div style="font-size:20px;font-family:'Fraunces',serif;font-weight:600;color:var(--moss);margin-top:4px">${nut.kcal} ккал</div>
          <div style="font-size:12px;color:var(--moss);opacity:.85;margin-top:2px">${kcalPct}% · 💧 ${nut.water} мл</div>
        </div>
        <div style="font-size:36px">🥗</div>
      </div>
    </div>
    <div class="cat-title" style="margin-top:22px"><span>🎯</span><span>Быстрый доступ</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      <button class="card tappable" data-goto="goals" style="text-align:center;padding:16px 8px;margin:0">
        <div style="font-size:26px;margin-bottom:4px">🎯</div>
        <div class="tiny" style="color:var(--ink)">Цели</div>
      </button>
      <button class="card tappable" data-goto="programs" style="text-align:center;padding:16px 8px;margin:0">
        <div style="font-size:26px;margin-bottom:4px">📋</div>
        <div class="tiny" style="color:var(--ink)">Программы</div>
      </button>
      <button class="card tappable" data-goto="knowledge" style="text-align:center;padding:16px 8px;margin:0">
        <div style="font-size:26px;margin-bottom:4px">📖</div>
        <div class="tiny" style="color:var(--ink)">Знания</div>
      </button>
    </div>
    <div class="card tappable" style="margin-top:16px;background:var(--amber-soft);border-color:transparent" data-goto="brain">
      <div class="between">
        <div>
          <div class="tiny" style="color:var(--amber-dim)">Уровень ${levelInfo(S.neurofit.xp).level} · ${S.neurofit.totalSessions} сессий</div>
          <div style="font-size:16px;font-weight:600;margin-top:6px;color:var(--amber-dim)">🧠 Тренировка мозга</div>
        </div>
        <div style="font-size:32px">→</div>
      </div>
    </div>
    <div style="height:20px"></div>`;
  root.addEventListener('click',e=>{
    const c=e.target.closest('[data-complete]');
    if(c){completeScheduleItem(c.dataset.complete,true);return;}
    const r=e.target.closest('[data-run]');
    if(r){startProgramRun(r.dataset.run,r.dataset.sched||null);return;}
    const gt=e.target.closest('[data-goto]');
    if(gt){SFX.tap();buzz(8);go(gt.dataset.goto);}
  });
  return root;
}
function completeScheduleItem(id,done){
  if(done===undefined) done=true;
  const it=S.navlife.schedule.find(i=>i.id===id);
  if(!it) return;
  it.completed=done;
  if(it.goalStepId){
    const g=S.navlife.goals.find(g=>g.steps.some(s=>s.id===it.goalStepId));
    if(g){const st=g.steps.find(s=>s.id===it.goalStepId);st.completed=done;}
  }
  computeDailyStats(it.date);
  saveState();
  toast(done?`«${it.title}» ✓`:`«${it.title}» снова в плане`);
  go(currentScreen||'today');
}

function renderSchedule(){
  ensureBaseForDate(S.navlife.viewDate);
  const d=new Date(S.navlife.viewDate+'T00:00:00');
  const items=itemsForDate(S.navlife.viewDate);
  const isToday=S.navlife.viewDate===todayKey();
  const dLabel=dateLabel(S.navlife.viewDate);

  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="h1" style="margin-bottom:16px">Расписание</div>
    <div class="sched-toolbar">
      <div class="date-switch">
        <button class="icon-btn" id="prevDay" type="button">‹</button>
        <div class="dlabel">${dLabel}</div>
        <button class="icon-btn" id="nextDay" type="button">›</button>
      </div>
      <button class="btn btn-primary btn-sm" id="addEvent" type="button">+ Событие</button>
    </div>
    ${isToday
      ?'<div class="date-hint today">✓ Это сегодня</div>'
      :'<button class="btn btn-ghost btn-sm btn-full" id="todayJump" type="button" style="margin-bottom:14px">↩ Вернуться к сегодня</button>'}
    ${items.length?`<p class="sched-hint">Удерживай и тяни <b>↕</b> — перемещай по времени</p>`:''}
    <div class="card sched-list" id="schedList" style="padding:8px 14px">
      ${items.length?items.map(it=>{
        const prog=it.programId?S.navlife.programs.find(p=>p.id===it.programId):null;
        const gs=it.goalStepId?findGoalStep(it.goalStepId):null;
        return `<div class="sched-row" data-id="${it.id}">
          <div class="sched-time"><b>${it.startTime}</b>${it.endTime}</div>
          <div class="sched-main">
            <div class="sched-title ${it.completed?'done':''}">${esc(it.title)}</div>
            <div class="sched-tags">
              ${prog?`<span class="tag-chip program">${esc(prog.title)}</span>`:''}
              ${gs?`<span class="tag-chip goal">${esc(gs.goal.title)}</span>`:''}
              ${it.fromRecurring?`<span class="tag-chip">повтор</span>`:''}
              ${it.fromBase?`<span class="tag-chip">база</span>`:''}
            </div>
          </div>
          <div class="sched-actions" data-no-drag>
            ${!it.completed?`<button class="icon-btn" style="width:34px;height:34px;font-size:13px" data-complete="${it.id}" type="button">✓</button>`:`<button class="icon-btn" style="width:34px;height:34px;font-size:13px" data-uncomplete="${it.id}" type="button">↺</button>`}
            <button class="icon-btn" style="width:34px;height:34px;font-size:13px" data-edit="${it.id}" type="button">✎</button>
            <button class="icon-btn btn-danger" style="width:34px;height:34px;font-size:13px" data-del="${it.id}" type="button">✕</button>
          </div>
        </div>`;
      }).join(''):`<div style="padding:32px 12px;text-align:center" class="muted">Пусто. Добавь первое событие.</div>`}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="between" style="margin-bottom:12px">
        <div>
          <div class="h3">Базовый распорядок</div>
          <p class="muted" style="font-size:12.5px;margin-top:4px">Появляется на 60 дней вперёд.</p>
        </div>
        <button class="btn btn-line btn-sm" id="addBase" type="button">+ Пункт</button>
      </div>
      <ul class="base-list">
        ${S.navlife.baseRoutine.map(b=>`<li>
          <time>${b.startTime}</time>
          <span style="flex:1">${esc(b.title)}${b.programTitle?` <span class="tag-chip program" style="margin-left:6px">${esc(b.programTitle)}</span>`:''}</span>
          <button class="icon-btn btn-danger" style="width:30px;height:30px;font-size:12px" data-delbase="${b.id}" type="button">✕</button>
        </li>`).join('')||`<li class="muted">Пока нет пунктов.</li>`}
      </ul>
    </div>
    <div style="height:20px"></div>`;
  root.addEventListener('click',e=>{
    if(root._dragJustEnded){root._dragJustEnded=false;return;}
    const c=e.target.closest('[data-complete]');
    if(c){completeScheduleItem(c.dataset.complete,true);return;}
    const u=e.target.closest('[data-uncomplete]');
    if(u){completeScheduleItem(u.dataset.uncomplete,false);return;}
    const ed=e.target.closest('[data-edit]');
    if(ed){openEventModal(ed.dataset.edit);return;}
    const dl=e.target.closest('[data-del]');
    if(dl){
      const it=S.navlife.schedule.find(i=>i.id===dl.dataset.del);
      if(!it) return;
      if(confirm('Удалить событие?')){
        if(it.fromBase&&it.baseRef&&it.date>=todayKey()){
          S.navlife.baseSkip[`${it.date}|${it.baseRef}`]=true;
        }
        S.navlife.schedule=S.navlife.schedule.filter(i=>i.id!==it.id);
        saveState();go('schedule');
      }
      return;
    }
    const db=e.target.closest('[data-delbase]');
    if(db){
      S.navlife.baseRoutine=S.navlife.baseRoutine.filter(b=>b.id!==db.dataset.delbase);
      syncBaseEvents();saveState();go('schedule');
      toast('Пункт удалён, будущие дни обновлены');
    }
  });
  $('#prevDay',root).onclick=()=>{
    const dd=new Date(S.navlife.viewDate+'T00:00:00');
    dd.setDate(dd.getDate()-1);S.navlife.viewDate=fmtDate(dd);saveState();go('schedule');
  };
  $('#nextDay',root).onclick=()=>{
    const dd=new Date(S.navlife.viewDate+'T00:00:00');
    dd.setDate(dd.getDate()+1);S.navlife.viewDate=fmtDate(dd);saveState();go('schedule');
  };
  const tj=$('#todayJump',root);
  if(tj) tj.onclick=()=>{S.navlife.viewDate=todayKey();saveState();go('schedule');};
  $('#addEvent',root).onclick=()=>openEventModal(null);
  $('#addBase',root).onclick=openBaseModal;
  setupDragDrop(root);
  return root;
}
function setupDragDrop(root){
  const list=$('#schedList',root);
  if(!list) return;
  const PX_PER_MIN=1.2;
  const SNAP=5;
  let dragState=null;
  let dragJustEnded=false;

  const cleanup=()=>{
    if(dragState){
      clearTimeout(dragState.holdTimer);
      if(dragState.row){
        dragState.row.classList.remove('dragging');
        dragState.row.style.transform='';
        dragState.row.style.zIndex='';
      }
      if(dragState.badge) dragState.badge.remove();
    }
    $$('.sched-row',list).forEach(r=>r.classList.remove('drag-ghost'));
    dragState=null;
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    document.removeEventListener('touchmove',onMove);
    document.removeEventListener('touchend',onUp);
    document.removeEventListener('touchcancel',onUp);
  };
  const onMove=ev=>{
    if(!dragState) return;
    const y=ev.touches?ev.touches[0].clientY:ev.clientY;
    const dy=y-dragState.startY;
    if(!dragState.active&&Math.abs(dy)>5){
      clearTimeout(dragState.holdTimer);
      cleanup();
      return;
    }
    if(!dragState.active) return;
    if(ev.cancelable) ev.preventDefault();
    const minutesDelta=Math.round(dy/PX_PER_MIN/SNAP)*SNAP;
    let newStart=clamp(dragState.startMin+minutesDelta,0,1440-dragState.durationMin);
    const newEnd=newStart+dragState.durationMin;
    dragState.moved=true;
    dragState.row.style.transform=`translateY(${(newStart-dragState.startMin)*PX_PER_MIN}px)`;
    if(dragState.badge) dragState.badge.textContent=`${fmtMinToClock(newStart)} – ${fmtMinToClock(newEnd)}`;
    dragState.newStart=newStart;
    dragState.newEnd=newEnd;
  };
  const onUp=()=>{
    if(!dragState){cleanup();return;}
    const st=dragState;
    if(st.active&&st.moved){
      const it=S.navlife.schedule.find(x=>x.id===st.id);
      if(it){
        it.startTime=fmtMinToClock(st.newStart);
        it.endTime=fmtMinToClock(st.newEnd);
        saveState();
        SFX.ok();
        const diff=st.newStart-st.startMin;
        if(diff!==0) toast(`Перенеслось на ${fmtMinToClock(st.newStart)}`);
      }
      dragJustEnded=true;
      cleanup();
      setTimeout(()=>go('schedule'),80);
    }else if(st.active){
      dragJustEnded=true;
      cleanup();
      openEventModal(st.id);
    }else{
      cleanup();
    }
  };
  const onStart=(row,ev)=>{
    if(ev.target.closest('[data-no-drag]')) return;
    if(ev.target.closest('button')) return;
    const id=row.dataset.id;
    const it=S.navlife.schedule.find(x=>x.id===id);
    if(!it) return;
    const clientY=ev.touches?ev.touches[0].clientY:ev.clientY;
    dragState={
      id,row,it,
      startY:clientY,
      startMin:toMin(it.startTime),
      durationMin:toMin(it.endTime)-toMin(it.startTime),
      active:false,moved:false,badge:null,holdTimer:null,
      newStart:toMin(it.startTime),
      newEnd:toMin(it.endTime)
    };
    dragState.holdTimer=setTimeout(()=>{
      if(!dragState) return;
      dragState.active=true;
      row.classList.add('dragging');
      $$('.sched-row',list).forEach(r=>{if(r!==row) r.classList.add('drag-ghost');});
      buzz([8,20,8]);
      SFX.tap();
      const badge=document.createElement('div');
      badge.className='sched-time-badge';
      badge.textContent=`${it.startTime} – ${it.endTime}`;
      row.appendChild(badge);
      dragState.badge=badge;
    },220);
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    document.addEventListener('touchmove',onMove,{passive:false});
    document.addEventListener('touchend',onUp);
    document.addEventListener('touchcancel',onUp);
  };
  $$('.sched-row',list).forEach(row=>{
    row.addEventListener('mousedown',ev=>onStart(row,ev));
    row.addEventListener('touchstart',ev=>onStart(row,ev),{passive:true});
  });
  root.addEventListener('click',e=>{
    if(dragJustEnded){
      dragJustEnded=false;
      e.stopPropagation();
      e.preventDefault();
      root._dragJustEnded=true;
      setTimeout(()=>{root._dragJustEnded=false;},50);
    }
  },true);
}
function openEventModal(editId){
  const it=editId?S.navlife.schedule.find(i=>i.id===editId):null;
  const isEd=!!it;
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">${isEd?'Изменить':'Новое событие'}</div>
    <div class="field"><label>Название</label><input id="evTitle" value="${it?esc(it.title):''}" placeholder="Например, Английский"></div>
    <div class="field-row">
      <div class="field"><label>Начало</label><input id="evStart" type="time" value="${it?it.startTime:'09:00'}"></div>
      <div class="field"><label>Конец</label><input id="evEnd" type="time" value="${it?it.endTime:'09:30'}"></div>
    </div>
    <div class="field"><label>Тип</label>
      <select id="evType"><option value="task" ${it&&it.type==='task'?'selected':''}>Задача</option><option value="event" ${it&&it.type==='event'?'selected':''}>Событие</option></select>
    </div>
    <div class="field"><label>Повторение</label>
      <select id="evRepeat">
        <option value="none">Нет</option>
        <option value="daily">Ежедневно</option>
        <option value="every_other_day">Через день</option>
        <option value="weekly">По дням недели</option>
      </select>
    </div>
    <div class="field" id="weekField" style="display:none">
      <label>Дни недели</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${dowShort.map((d,i)=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;padding:4px 8px;border:1px solid var(--line);border-radius:8px"><input type="checkbox" class="wcb" value="${i}"> ${d}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>Программа</label>
      <select id="evProg"><option value="">— нет —</option>${S.navlife.programs.map(p=>`<option value="${p.id}" ${it&&it.programId===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      ${isEd?`<button class="btn btn-line btn-danger" id="evDel" type="button">Удалить</button>`:''}
      <button class="btn btn-ghost btn-full" id="evCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="evSave" type="button">Сохранить</button>
    </div>`,m=>{
    const rep=$('#evRepeat',m),wf=$('#weekField',m);
    if(it&&it.repeatRule){
      if(it.repeatRule==='daily') rep.value='daily';
      else if(it.repeatRule==='every_other_day') rep.value='every_other_day';
      else if(it.repeatRule.startsWith('weekly_')) rep.value='weekly';
    }
    rep.onchange=()=>{wf.style.display=rep.value==='weekly'?'block':'none';};
    if(rep.value==='weekly'){
      wf.style.display='block';
      const days=(it&&it.repeatRule&&it.repeatRule.startsWith('weekly_'))?it.repeatRule.split('_')[1].split(',').map(Number):[];
      $$('.wcb',m).forEach(cb=>{cb.checked=days.includes(+cb.value);});
    }
    $('#evCancel',m).onclick=()=>closeModal(m);
    $('#evSave',m).onclick=()=>{
      const title=$('#evTitle',m).value.trim();
      if(!title){toast('Введи название');return;}
      const start=$('#evStart',m).value||'09:00';
      const end=$('#evEnd',m).value||'09:30';
      const type=$('#evType',m).value;
      const programId=$('#evProg',m).value||null;
      let rr=rep.value;
      if(rr==='weekly'){
        const days=[];$$('.wcb:checked',m).forEach(cb=>days.push(cb.value));
        if(!days.length){toast('Выберите день');return;}
        rr='weekly_'+days.join(',');
      }else if(rr==='none') rr=null;
      if(isEd){
        if(it.repeatRule){
          const today=todayKey();
          S.navlife.schedule=S.navlife.schedule.filter(x=>!(
            x.id!==it.id&&
            x.title===it.title&&
            x.startTime===it.startTime&&
            x.endTime===it.endTime&&
            x.fromRecurring&&
            x.date>=today
          ));
        }
        Object.assign(it,{title,startTime:start,endTime:end,type,programId,repeatRule:rr});
      }else{
        S.navlife.schedule.push({id:uid('sch'),title,type,startTime:start,endTime:end,
          date:S.navlife.viewDate,completed:false,programId,goalStepId:null,fromBase:false,fromRecurring:false,repeatRule:rr||null});
      }
      saveState();
      if(rr) ensureRecurringEvents();
      saveState();
      closeModal(m);go('schedule');toast('Сохранено');
    };
    const del=$('#evDel',m);
    if(del) del.onclick=()=>{
      if(it.fromBase&&it.baseRef&&it.date>=todayKey()){
        S.navlife.baseSkip[`${it.date}|${it.baseRef}`]=true;
      }
      S.navlife.schedule=S.navlife.schedule.filter(i=>i.id!==it.id);
      saveState();closeModal(m);go('schedule');
    };
  });
}
function openBaseModal(){
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">Пункт базового дня</div>
    <div class="field"><label>Название</label><input id="bTitle" placeholder="Например, Зарядка"></div>
    <div class="field-row">
      <div class="field"><label>Начало</label><input id="bStart" type="time" value="08:00"></div>
      <div class="field"><label>Конец</label><input id="bEnd" type="time" value="08:15"></div>
    </div>
    <div class="field"><label>Программа</label>
      <select id="bProg"><option value="">— нет —</option>${S.navlife.programs.map(p=>`<option value="${esc(p.title)}">${esc(p.title)}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-ghost btn-full" id="bCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="bSave" type="button">Добавить</button>
    </div>`,m=>{
    $('#bCancel',m).onclick=()=>closeModal(m);
    $('#bSave',m).onclick=()=>{
      const title=$('#bTitle',m).value.trim();
      if(!title){toast('Введи название');return;}
      S.navlife.baseRoutine.push({
        id:uid('base'),title,
        startTime:$('#bStart',m).value,endTime:$('#bEnd',m).value,
        programTitle:$('#bProg',m).value||undefined
      });
      S.navlife.baseRoutine.sort((a,b)=>toMin(a.startTime)-toMin(b.startTime));
      syncBaseEvents();saveState();closeModal(m);go('schedule');
      toast('Добавлено');
    };
  });
}

function renderGoals(){
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="row" style="margin-bottom:16px;gap:10px">
      <button class="icon-btn" id="back" type="button">←</button>
      <div class="h1" style="flex:1">Цели</div>
      <button class="btn btn-primary btn-sm" id="addGoal" type="button">+ Цель</button>
    </div>
    ${S.navlife.goals.length?S.navlife.goals.map(g=>{
      const total=g.steps.length,done=g.steps.filter(s=>s.completed).length;
      const pct=total?Math.round(done/total*100):0;
      return `<div class="card goal-card">
        <div class="goal-head">
          <div class="goal-icon">${g.icon||'🎯'}</div>
          <div style="flex:1">
            <div class="goal-title">${esc(g.title)}</div>
            ${g.description?`<p class="goal-desc">${esc(g.description)}</p>`:''}
          </div>
          <button class="icon-btn btn-danger" style="width:32px;height:32px;font-size:13px" data-delgoal="${g.id}">✕</button>
        </div>
        <div class="goal-progress">
          <div class="top"><span>${total?pct+'%':'нет шагов'}</span><span>${done}/${total}</span></div>
          <div class="bar"><i class="on" style="--p:${(pct/100).toFixed(3)}"></i></div>
        </div>
        <ul class="goal-steps">
          ${g.steps.map(s=>`<li class="${s.completed?'done':''}">
            <button class="check ${s.completed?'on':''}" data-tg="${g.id}|${s.id}">${s.completed?'✓':''}</button>
            <span style="flex:1">${esc(s.title)}</span>
          </li>`).join('')}
        </ul>
      </div>`;
    }).join(''):`<div class="card" style="text-align:center;padding:32px"><p class="muted">Пока нет целей.</p></div>`}
    <div style="height:20px"></div>`;
  $('#back',root).onclick=()=>go('today');
  $('#addGoal',root).onclick=openGoalModal;
  root.addEventListener('click',e=>{
    const t=e.target.closest('[data-tg]');
    if(t){
      const[gid,sid]=t.dataset.tg.split('|');
      const g=S.navlife.goals.find(x=>x.id===gid);
      const s=g.steps.find(x=>x.id===sid);
      s.completed=!s.completed;saveState();go('goals');
    }
    const dg=e.target.closest('[data-delgoal]');
    if(dg&&confirm('Удалить цель?')){
      S.navlife.goals=S.navlife.goals.filter(g=>g.id!==dg.dataset.delgoal);
      saveState();go('goals');
    }
  });
  return root;
}
function openGoalModal(){
  let steps=[''];
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">Новая цель</div>
    <div class="field-row">
      <div class="field" style="flex:0 0 70px"><label>Иконка</label><input id="gIcon" maxlength="2" value="🎯"></div>
      <div class="field"><label>Название</label><input id="gTitle" placeholder="Например, Выучить английский"></div>
    </div>
    <div class="field"><label>Описание</label><textarea id="gDesc" placeholder="Зачем тебе эта цель"></textarea></div>
    <div class="field"><label>Шаги</label>
      <div id="gSteps"></div>
      <button class="btn btn-line btn-sm" id="gAddStep" type="button" style="margin-top:6px">+ Шаг</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-ghost btn-full" id="gCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="gSave" type="button">Сохранить</button>
    </div>`,m=>{
    const draw=()=>{
      $('#gSteps',m).innerHTML=steps.map((s,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px">
        <input data-si="${i}" value="${esc(s)}" placeholder="Шаг" style="flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13.5px;background:var(--surface);color:var(--ink)">
        <button class="icon-btn btn-danger" style="width:36px;height:36px;font-size:13px" data-sdel="${i}" type="button">✕</button>
      </div>`).join('');
      $$('[data-si]',m).forEach(inp=>inp.oninput=()=>{steps[+inp.dataset.si]=inp.value;});
      $$('[data-sdel]',m).forEach(b=>b.onclick=()=>{steps.splice(+b.dataset.sdel,1);draw();});
    };
    draw();
    $('#gAddStep',m).onclick=()=>{steps.push('');draw();};
    $('#gCancel',m).onclick=()=>closeModal(m);
    $('#gSave',m).onclick=()=>{
      const title=$('#gTitle',m).value.trim();
      if(!title){toast('Введи название');return;}
      const st=steps.filter(s=>s.trim()).map(s=>({id:uid('gstep'),title:s.trim(),completed:false,linkedScheduleItemId:null,linkedProgramId:null}));
      S.navlife.goals.push({
        id:uid('goal'),title,icon:$('#gIcon',m).value||'🎯',
        description:$('#gDesc',m).value.trim(),
        status:'active',createdAt:todayKey(),steps:st
      });
      saveState();closeModal(m);go('goals');toast('Цель добавлена');
    };
  });
}

function renderPrograms(){
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="row" style="margin-bottom:16px;gap:10px">
      <button class="icon-btn" id="back" type="button">←</button>
      <div class="h1" style="flex:1">Программы</div>
      <button class="btn btn-primary btn-sm" id="addProg" type="button">+ Своя</button>
    </div>
    <div class="prog-grid">
      ${S.navlife.programs.map(p=>{
        const dur=p.steps.reduce((s,st)=>s+(st.type==='timer'?st.duration:20),0);
        return `<div class="card prog-card" data-prog="${p.id}">
          <div class="cat">${esc(p.category)}${p.builtin?'':'<span class="badge-custom">своя</span>'}</div>
          <h4>${esc(p.title)}</h4>
          <div class="desc">${esc(p.description||'')}</div>
          <div class="foot"><span>${p.steps.length} этапов</span><span>~${Math.round(dur/60)} мин</span></div>
        </div>`;
      }).join('')}
    </div>
    <div style="height:20px"></div>`;
  $('#back',root).onclick=()=>go('today');
  $('#addProg',root).onclick=()=>openProgramEditor(null);
  root.addEventListener('click',e=>{
    const p=e.target.closest('[data-prog]');
    if(p) openProgramView(p.dataset.prog);
  });
  return root;
}
function openProgramView(id){
  const p=S.navlife.programs.find(x=>x.id===id);
  if(!p) return;
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:6px">${esc(p.title)}</div>
    <p class="muted" style="margin-bottom:16px">${esc(p.description||'')}</p>
    <div style="max-height:44vh;overflow-y:auto;margin-bottom:16px">
      ${p.steps.map((s,i)=>`<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="font-family:'Fraunces',serif;color:var(--moss);font-weight:600;min-width:22px">${i+1}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${esc(s.title)}</div>
          ${s.instructions?`<div class="muted" style="font-size:12.5px;margin-top:2px">${esc(s.instructions)}</div>`:''}
          ${s.why?`<div style="font-size:12px;color:var(--moss);margin-top:2px">Зачем: ${esc(s.why)}</div>`:''}
        </div>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px">
      ${p.builtin?'':`<button class="btn btn-line" id="pvEdit" type="button">Изменить</button>`}
      <button class="btn btn-ghost btn-full" id="pvClose" type="button">Закрыть</button>
      <button class="btn btn-primary btn-full" id="pvStart" type="button">Начать</button>
    </div>`,m=>{
    $('#pvClose',m).onclick=()=>closeModal(m);
    $('#pvStart',m).onclick=()=>{closeModal(m);startProgramRun(p.id,null);};
    const ed=$('#pvEdit',m);
    if(ed) ed.onclick=()=>{closeModal(m);setTimeout(()=>openProgramEditor(p.id),150);};
  });
}
function openProgramEditor(editId){
  const p=editId?S.navlife.programs.find(x=>x.id===editId):null;
  const isEd=!!p;
  const isBuiltin=p&&p.builtin;
  let steps=p?JSON.parse(JSON.stringify(p.steps)):[
    {id:uid('pstep'),title:'',type:'timer',duration:30,instructions:'',why:''}
  ];
  const CATS_LIST=['утро','физическая активность','обучение','английский','чтение','концентрация','восстановление','дыхательные практики','вечер','подготовка ко сну','своё'];
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">${isEd?(isBuiltin?'Копия программы':'Изменить программу'):'Новая программа'}</div>
    <div class="field"><label>Название</label>
      <input id="pTitle" value="${p?esc(p.title):''}" placeholder="Например, Утренняя зарядка">
    </div>
    <div class="field"><label>Категория</label>
      <select id="pCat">${CATS_LIST.map(c=>`<option value="${esc(c)}" ${p&&p.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Описание</label>
      <textarea id="pDesc" placeholder="Зачем эта программа">${p?esc(p.description||''):''}</textarea>
    </div>
    <div class="field">
      <label>Этапы</label>
      <div id="pSteps"></div>
      <button class="btn btn-line btn-sm" id="addPStep" type="button" style="margin-top:8px">+ Этап</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      ${isEd&&!isBuiltin?`<button class="btn btn-line btn-danger" id="pDel" type="button">Удалить</button>`:''}
      <button class="btn btn-ghost btn-full" id="pCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="pSave" type="button">${isBuiltin?'Сохранить копию':'Сохранить'}</button>
    </div>`,m=>{
    const stepsEl=$('#pSteps',m);
    const drawSteps=()=>{
      stepsEl.innerHTML=steps.map((s,i)=>`
        <div class="pstep">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="font-family:'Fraunces',serif;color:var(--moss);font-weight:600;width:20px">${i+1}</div>
            <input data-si="${i}|title" value="${esc(s.title||'')}" placeholder="Название этапа"
              style="flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13.5px;background:var(--surface);color:var(--ink)">
            <button class="icon-btn" data-sup="${i}" type="button" style="width:30px;height:30px;font-size:12px">↑</button>
            <button class="icon-btn" data-sdown="${i}" type="button" style="width:30px;height:30px;font-size:12px">↓</button>
            <button class="icon-btn btn-danger" data-sdel="${i}" type="button" style="width:30px;height:30px;font-size:12px">✕</button>
          </div>
          <div class="field-row" style="margin-bottom:8px">
            <div class="field" style="flex:0 0 130px;margin:0">
              <label>Тип</label>
              <select data-si="${i}|type">
                <option value="timer" ${s.type==='timer'?'selected':''}>Таймер</option>
                <option value="reps" ${s.type==='reps'?'selected':''}>Повторы</option>
                <option value="checkbox" ${s.type==='checkbox'?'selected':''}>Чекбокс</option>
                <option value="pause" ${s.type==='pause'?'selected':''}>Пауза</option>
                <option value="instruction" ${s.type==='instruction'?'selected':''}>Инструкция</option>
              </select>
            </div>
            ${(s.type==='timer'||s.type==='pause')?`
              <div class="field" style="margin:0">
                <label>Секунд</label>
                <input type="number" min="1" data-si="${i}|duration" value="${s.duration||30}">
              </div>`:''}
            ${s.type==='reps'?`
              <div class="field" style="margin:0">
                <label>Повторений</label>
                <input type="number" min="1" data-si="${i}|repetitions" value="${s.repetitions||10}">
              </div>`:''}
          </div>
          <div class="field" style="margin-bottom:8px">
            <label>Инструкция</label>
            <input data-si="${i}|instructions" value="${esc(s.instructions||'')}" placeholder="Что делать">
          </div>
          <div class="field" style="margin:0">
            <label>Зачем этот этап</label>
            <input data-si="${i}|why" value="${esc(s.why||'')}" placeholder="Зачем">
          </div>
        </div>
      `).join('');
      $$('[data-si]',stepsEl).forEach(el=>{
        const[k,field]=el.dataset.si.split('|');
        const handler=()=>{
          const idx=+k;
          if(field==='duration'||field==='repetitions') steps[idx][field]=+el.value||0;
          else steps[idx][field]=el.value;
          if(field==='type') drawSteps();
        };
        el.oninput=handler;
        el.onchange=handler;
      });
      $$('[data-sup]',stepsEl).forEach(b=>b.onclick=()=>{
        const i=+b.dataset.sup;
        if(i>0){[steps[i-1],steps[i]]=[steps[i],steps[i-1]];drawSteps();}
      });
      $$('[data-sdown]',stepsEl).forEach(b=>b.onclick=()=>{
        const i=+b.dataset.sdown;
        if(i<steps.length-1){[steps[i+1],steps[i]]=[steps[i],steps[i+1]];drawSteps();}
      });
      $$('[data-sdel]',stepsEl).forEach(b=>b.onclick=()=>{
        if(steps.length<=1){toast('Хотя бы один этап');return;}
        steps.splice(+b.dataset.sdel,1);drawSteps();
      });
    };
    drawSteps();
    $('#addPStep',m).onclick=()=>{
      steps.push({id:uid('pstep'),title:'',type:'timer',duration:30,instructions:'',why:''});
      drawSteps();
      const last=stepsEl.lastElementChild;
      if(last) last.scrollIntoView({behavior:'smooth',block:'center'});
    };
    $('#pCancel',m).onclick=()=>closeModal(m);
    $('#pSave',m).onclick=()=>{
      const title=$('#pTitle',m).value.trim();
      if(!title){toast('Введи название');return;}
      const filtered=steps.filter(s=>s.title.trim());
      if(!filtered.length){toast('Добавь хотя бы один этап');return;}
      const cat=$('#pCat',m).value;
      const desc=$('#pDesc',m).value.trim();
      if(isEd&&!isBuiltin){
        Object.assign(p,{title,category:cat,description:desc,steps:filtered});
      }else{
        S.navlife.programs.push({
          id:uid('prog'),title,category:cat,description:desc,
          steps:filtered.map(s=>({...s,id:s.id||uid('pstep')})),
          builtin:false
        });
      }
      saveState();closeModal(m);go('programs');
      toast(isEd?'Обновлено':'Программа создана');
    };
    const del=$('#pDel',m);
    if(del) del.onclick=()=>{
      if(confirm('Удалить программу?')){
        S.navlife.programs=S.navlife.programs.filter(x=>x.id!==p.id);
        saveState();closeModal(m);go('programs');
      }
    };
  });
}
let runSession=null;
function startProgramRun(programId,scheduleId){
  const p=S.navlife.programs.find(x=>x.id===programId);
  if(!p) return;
  runSession={program:p,stepIndex:-1,scheduleId,timerHandle:null};
  $('#nav').classList.add('hidden');
  renderRunnerFrame();
  runCountdown(()=>advanceStep());
}
function renderRunnerFrame(){
  const host=$('#screens');
  host.innerHTML=`<div class="screen active" style="min-height:100vh;display:flex;flex-direction:column">
    <div class="between" style="margin-bottom:14px">
      <button class="icon-btn" id="rrClose" type="button">✕</button>
      <div class="ex-title" style="flex:1;text-align:center">${esc(runSession.program.title)}</div>
      <div style="width:40px"></div>
    </div>
    <div class="ex-bar"><i id="rrBar"></i></div>
    <div id="rrContent" style="flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center;padding:20px 0"></div>
  </div>`;
  $('#rrClose',host).onclick=()=>{
    if(runSession&&runSession.timerHandle) clearInterval(runSession.timerHandle);
    runSession=null;
    go('today');
  };
}
function runCountdown(done){
  const c=$('#rrContent');
  let n=3;
  c.innerHTML=`<div style="font-family:'Fraunces',serif;font-size:120px;color:var(--amber);font-weight:500;line-height:1">${n}</div>`;
  const box=c.querySelector('div');
  const iv=setInterval(()=>{
    n--;
    if(n>0){box.textContent=n;tone(660,.1,'sine',.05);}
    else{clearInterval(iv);box.textContent='СТАРТ';tone(880,.22,'sine',.07);setTimeout(done,500);}
  },700);
}
function advanceStep(){
  if(!runSession) return;
  if(runSession.timerHandle){clearInterval(runSession.timerHandle);runSession.timerHandle=null;}
  runSession.stepIndex++;
  const steps=runSession.program.steps;
  const c=$('#rrContent');
  const bar=$('#rrBar');
  if(bar) bar.style.transform=`scaleX(${runSession.stepIndex/steps.length})`;
  if(runSession.stepIndex>=steps.length){finishProgram();return;}
  const step=steps[runSession.stepIndex];
  const why=step.why?`<p class="muted" style="margin-bottom:16px">${esc(step.why)}</p>`:'';
  const instr=step.instructions?`<p class="muted" style="margin-bottom:16px">${esc(step.instructions)}</p>`:'';
  if(step.type==='timer'||step.type==='pause'){
    let rem=step.duration||30;
    SFX.timerStart();
    c.innerHTML=`
      <div class="tiny" style="margin-bottom:8px">${step.type==='pause'?'ПАУЗА':'ЭТАП'} ${runSession.stepIndex+1} ИЗ ${steps.length}</div>
      <div class="h1" style="margin-bottom:10px">${esc(step.title)}</div>
      ${instr}${why}
      <div id="rrBig" style="font-family:'Fraunces',serif;font-size:88px;color:var(--moss);font-weight:500;line-height:1">${pad2(Math.floor(rem/60))}:${pad2(rem%60)}</div>
      <button class="btn btn-ghost btn-full" id="rrSkip" type="button" style="margin-top:30px;max-width:320px;margin-left:auto;margin-right:auto">Пропустить →</button>`;
    $('#rrSkip').onclick=()=>advanceStep();
    runSession.timerHandle=setInterval(()=>{
      rem--;
      const big=$('#rrBig');
      if(big) big.textContent=`${pad2(Math.floor(rem/60))}:${pad2(rem%60)}`;
      if(rem===3||rem===2||rem===1) SFX.timerLast3();
      if(rem<=0){
        clearInterval(runSession.timerHandle);
        runSession.timerHandle=null;
        SFX.timerEnd();
        setTimeout(()=>advanceStep(),650);
      }
    },1000);
  }else if(step.type==='reps'){
    c.innerHTML=`
      <div class="tiny" style="margin-bottom:8px">ЭТАП ${runSession.stepIndex+1} ИЗ ${steps.length}</div>
      <div class="h1" style="margin-bottom:10px">${esc(step.title)}</div>
      ${why}
      <div style="font-family:'Fraunces',serif;font-size:88px;color:var(--moss);font-weight:500;line-height:1">${step.repetitions||''}</div>
      <div class="muted" style="margin-top:6px">повторений</div>
      <button class="btn btn-primary btn-full btn-lg" id="rrDone" type="button" style="margin-top:30px;max-width:320px;margin-left:auto;margin-right:auto">Готово →</button>`;
    $('#rrDone').onclick=()=>{SFX.tick();buzz(8);advanceStep();};
  }else if(step.type==='checkbox'){
    c.innerHTML=`
      <div class="tiny" style="margin-bottom:8px">ЭТАП ${runSession.stepIndex+1} ИЗ ${steps.length}</div>
      <div class="h1" style="margin-bottom:10px">${esc(step.title)}</div>
      ${instr}${why}
      <button class="btn btn-primary btn-full btn-lg" id="rrDone" type="button" style="margin-top:30px;max-width:320px;margin-left:auto;margin-right:auto">Отметить →</button>`;
    $('#rrDone').onclick=()=>{SFX.tick();buzz(8);advanceStep();};
  }else{
    c.innerHTML=`
      <div class="tiny" style="margin-bottom:8px">ЭТАП ${runSession.stepIndex+1} ИЗ ${steps.length}</div>
      <div class="h1" style="margin-bottom:10px">${esc(step.title)}</div>
      ${instr}${why}
      <button class="btn btn-primary btn-full btn-lg" id="rrDone" type="button" style="margin-top:30px;max-width:320px;margin-left:auto;margin-right:auto">Далее →</button>`;
    $('#rrDone').onclick=()=>{SFX.tick();buzz(8);advanceStep();};
  }
}
function finishProgram(){
  if(runSession&&runSession.timerHandle) clearInterval(runSession.timerHandle);
  const c=$('#rrContent');
  const wasScheduleId=runSession.scheduleId;
  const progId=runSession.program.id;
  const progTitle=runSession.program.title;
  const isPomodoro=progTitle==='Помодоро';
  c.innerHTML=`
    <div style="font-size:60px;margin-bottom:16px">✅</div>
    <div class="h1" style="margin-bottom:10px">Программа завершена</div>
    <p class="muted">«${esc(progTitle)}» пройдена.</p>
    <button class="btn btn-primary btn-full btn-lg" id="rrClose2" type="button" style="margin-top:24px;max-width:320px;margin-left:auto;margin-right:auto">Продолжить →</button>`;
  if(isPomodoro) SFX.pomodoroEnd();
  else SFX.endMelody();
  runSession=null;
  if(wasScheduleId) completeScheduleItem(wasScheduleId,true);
  else{
    const linked=S.navlife.schedule.find(i=>i.date===todayKey()&&i.programId===progId&&!i.completed);
    if(linked) completeScheduleItem(linked.id,true);
  }
  $('#rrClose2').onclick=()=>go('today');
}

function getAllKnowledge(){
  return [...KNOWLEDGE,...(S.navlife.customKnowledge||[]).map(k=>({...k,custom:true}))];
}
function renderKnowledge(){
  const list=getAllKnowledge();
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="row" style="margin-bottom:16px;gap:10px">
      <button class="icon-btn" id="back" type="button">←</button>
      <div class="h1" style="flex:1">Знания</div>
      <button class="btn btn-primary btn-sm" id="addK" type="button">+ Тема</button>
    </div>
    <div class="k-list">
      ${list.map((k,i)=>`<div class="k-item ${k.custom?'k-item-custom':''}" data-k="${i}">
        <div class="cat">${esc(k.category)}${k.custom?'<span class="badge-custom">своя</span>':''}</div>
        <h4>${esc(k.title)}</h4>
        <div class="preview">${esc((k.what||'').slice(0,110))}${(k.what||'').length>110?'…':''}</div>
        <div class="arrow">→</div>
      </div>`).join('')}
    </div>
    <div style="height:20px"></div>`;
  $('#back',root).onclick=()=>go('today');
  $('#addK',root).onclick=()=>openKnowledgeEditor(null);
  root.addEventListener('click',e=>{
    const it=e.target.closest('[data-k]');
    if(it) openKnowledgeModal(list[+it.dataset.k]);
  });
  return root;
}
function openKnowledgeModal(k){
  openModal(`
    <div class="modal-handle"></div>
    <div class="cat" style="color:var(--moss);font-size:12px;font-weight:600;margin-bottom:4px">
      ${esc(k.category)}${k.custom?'<span class="badge-custom">своя</span>':''}
    </div>
    <div class="h2" style="margin-bottom:16px">${esc(k.title)}</div>
    ${k.what?`<h3 style="font-size:13px;color:var(--moss);margin-bottom:4px;font-weight:700">Что это?</h3>
    <p class="muted" style="margin-bottom:14px">${esc(k.what)}</p>`:''}
    ${k.why?`<h3 style="font-size:13px;color:var(--moss);margin-bottom:4px;font-weight:700">Зачем?</h3>
    <p class="muted" style="margin-bottom:14px">${esc(k.why)}</p>`:''}
    ${k.how?`<h3 style="font-size:13px;color:var(--moss);margin-bottom:4px;font-weight:700">Как работает?</h3>
    <p class="muted" style="margin-bottom:14px">${esc(k.how)}</p>`:''}
    ${k.apply?`<h3 style="font-size:13px;color:var(--moss);margin-bottom:4px;font-weight:700">Как применить?</h3>
    <p class="muted" style="margin-bottom:14px">${esc(k.apply)}</p>`:''}
    ${k.example?`<h3 style="font-size:13px;color:var(--moss);margin-bottom:4px;font-weight:700">Пример</h3>
    <p class="muted" style="margin-bottom:14px">${esc(k.example)}</p>`:''}
    <div style="display:flex;gap:10px;margin-top:8px">
      ${k.custom?`<button class="btn btn-line" id="kcEdit" type="button">Изменить</button>`:''}
      <button class="btn btn-primary btn-full btn-lg" id="kcClose" type="button">Понятно</button>
    </div>`,m=>{
    $('#kcClose',m).onclick=()=>closeModal(m);
    const ed=$('#kcEdit',m);
    if(ed) ed.onclick=()=>{closeModal(m);setTimeout(()=>openKnowledgeEditor(k.id),150);};
  });
}
function openKnowledgeEditor(editId){
  const k=editId?(S.navlife.customKnowledge||[]).find(x=>x.id===editId):null;
  const isEd=!!k;
  const CATS_K=['привычки','концентрация','сон','обучение','время','здоровье','питание','спорт','мышление','своё'];
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">${isEd?'Изменить тему':'Новая тема'}</div>
    <div class="field"><label>Название темы</label>
      <input id="kTitle" value="${k?esc(k.title):''}" placeholder="Например, Сила маленьких шагов">
    </div>
    <div class="field"><label>Категория</label>
      <select id="kCat">${CATS_K.map(c=>`<option value="${esc(c)}" ${k&&k.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Что это? (кратко)</label>
      <textarea id="kWhat" placeholder="Простое объяснение">${k?esc(k.what||''):''}</textarea>
    </div>
    <div class="field"><label>Зачем это нужно?</label>
      <textarea id="kWhy" placeholder="Практическая польза">${k?esc(k.why||''):''}</textarea>
    </div>
    <div class="field"><label>Как это работает?</label>
      <textarea id="kHow" placeholder="Механизм">${k?esc(k.how||''):''}</textarea>
    </div>
    <div class="field"><label>Как применить?</label>
      <textarea id="kApply" placeholder="Конкретные действия">${k?esc(k.apply||''):''}</textarea>
    </div>
    <div class="field"><label>Пример</label>
      <textarea id="kExample" placeholder="Реальная ситуация">${k?esc(k.example||''):''}</textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      ${isEd?`<button class="btn btn-line btn-danger" id="kDel" type="button">Удалить</button>`:''}
      <button class="btn btn-ghost btn-full" id="kCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="kSave" type="button">Сохранить</button>
    </div>`,m=>{
    $('#kCancel',m).onclick=()=>closeModal(m);
    $('#kSave',m).onclick=()=>{
      const title=$('#kTitle',m).value.trim();
      if(!title){toast('Введи название');return;}
      const obj={
        id:k?k.id:uid('k'),
        category:$('#kCat',m).value,
        title,
        what:$('#kWhat',m).value.trim(),
        why:$('#kWhy',m).value.trim(),
        how:$('#kHow',m).value.trim(),
        apply:$('#kApply',m).value.trim(),
        example:$('#kExample',m).value.trim(),
        custom:true
      };
      if(!S.navlife.customKnowledge) S.navlife.customKnowledge=[];
      if(isEd){
        const idx=S.navlife.customKnowledge.findIndex(x=>x.id===k.id);
        if(idx>=0) S.navlife.customKnowledge[idx]=obj;
      }else{
        S.navlife.customKnowledge.push(obj);
      }
      saveState();closeModal(m);go('knowledge');
      toast(isEd?'Обновлено':'Тема добавлена');
    };
    const del=$('#kDel',m);
    if(del) del.onclick=()=>{
      if(confirm('Удалить тему?')){
        S.navlife.customKnowledge=S.navlife.customKnowledge.filter(x=>x.id!==k.id);
        saveState();closeModal(m);go('knowledge');
      }
    };
  });
}

function nutritionToday(date){
  const ds=date||todayKey();
  if(!S.nutrition.days[ds]){
    S.nutrition.days[ds]={meals:{breakfast:[],lunch:[],dinner:[],snack:[]},water:0,notes:''};
  }
  const d=S.nutrition.days[ds];
  if(!d.meals) d.meals={breakfast:[],lunch:[],dinner:[],snack:[]};
  ['breakfast','lunch','dinner','snack'].forEach(k=>{if(!d.meals[k]) d.meals[k]=[];});
  let kcal=0,prot=0,fat=0,carb=0;
  ['breakfast','lunch','dinner','snack'].forEach(m=>{
    (d.meals[m]||[]).forEach(item=>{
      const f=item.grams/100;
      kcal+=item.kcal*f;prot+=item.p*f;fat+=item.f*f;carb+=item.c*f;
    });
  });
  return {kcal:Math.round(kcal),protein:Math.round(prot),fat:Math.round(fat),carbs:Math.round(carb),water:d.water||0,data:d};
}
const MEAL_NAMES={breakfast:'Завтрак',lunch:'Обед',dinner:'Ужин',snack:'Перекус'};
let addFoodTarget=null;

function renderNutrition(){
  const ds=S.nutrition.viewDate||todayKey();
  if(!S.nutrition.days[ds]) S.nutrition.days[ds]={meals:{breakfast:[],lunch:[],dinner:[],snack:[]},water:0,notes:''};
  const d=S.nutrition.days[ds];
  if(!d.meals) d.meals={breakfast:[],lunch:[],dinner:[],snack:[]};
  ['breakfast','lunch','dinner','snack'].forEach(k=>{if(!d.meals[k]) d.meals[k]=[];});
  const nut=nutritionToday(ds);
  const g=S.nutrition.goals;
  const kcalLeft=Math.max(0,g.calories-nut.kcal);
  const over=nut.kcal>g.calories;
  const waterPct=Math.min(100,Math.round(nut.water/Math.max(1,g.water)*100));
  const R=86,C=2*Math.PI*R;
  const dash=C*(1-Math.min(1,nut.kcal/Math.max(1,g.calories)));
  const MEALS=[
    {id:'breakfast',name:'Завтрак',icon:'🌅'},
    {id:'lunch',name:'Обед',icon:'☀️'},
    {id:'dinner',name:'Ужин',icon:'🌙'},
    {id:'snack',name:'Перекус',icon:'🍎'}
  ];
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="between" style="margin-bottom:16px">
      <div>
        <div class="tiny">${ds===todayKey()?'СЕГОДНЯ':'ДРУГОЙ ДЕНЬ'}</div>
        <div class="h1">Питание</div>
      </div>
      <button class="icon-btn" id="nutDate" type="button">📅</button>
    </div>
    <div class="nutri-hero"><div style="position:relative;z-index:1">
      <div class="kcal-ring">
        <svg viewBox="0 0 200 200">
          <circle class="track" cx="100" cy="100" r="${R}"/>
          <circle class="fill ${over?'over':''}" cx="100" cy="100" r="${R}"
            stroke-dasharray="${C}" stroke-dashoffset="${dash}"/>
        </svg>
        <div class="kcal-ring-inner">
          <div class="big">${nut.kcal}</div>
          <div class="sub">ккал</div>
          <div class="left">${over?`+${nut.kcal-g.calories} сверх`:`осталось ${kcalLeft}`}</div>
        </div>
      </div>
      <div class="macro-bars">
        <div class="macro-bar-row">
          <div class="macro-bar-lbl">Белки</div>
          <div class="macro-bar-track"><div class="macro-bar-fill p" style="width:${Math.min(100,Math.round(nut.protein/Math.max(1,g.protein)*100))}%"></div></div>
          <div class="macro-bar-val">${nut.protein}/${g.protein}г</div>
        </div>
        <div class="macro-bar-row">
          <div class="macro-bar-lbl">Жиры</div>
          <div class="macro-bar-track"><div class="macro-bar-fill f" style="width:${Math.min(100,Math.round(nut.fat/Math.max(1,g.fat)*100))}%"></div></div>
          <div class="macro-bar-val">${nut.fat}/${g.fat}г</div>
        </div>
        <div class="macro-bar-row">
          <div class="macro-bar-lbl">Углев.</div>
          <div class="macro-bar-track"><div class="macro-bar-fill c" style="width:${Math.min(100,Math.round(nut.carbs/Math.max(1,g.carbs)*100))}%"></div></div>
          <div class="macro-bar-val">${nut.carbs}/${g.carbs}г</div>
        </div>
      </div>
    </div></div>
    <div class="water-card">
      <div class="water-head">
        <div class="water-title">💧 Вода</div>
        <div class="water-val">${nut.water}<small>/${g.water} мл</small></div>
      </div>
      <div class="water-track"><div class="water-fill" style="width:${waterPct}%"></div></div>
      <div class="water-btns">
        <button class="water-btn" data-water="200" type="button">+200</button>
        <button class="water-btn" data-water="300" type="button">+300</button>
        <button class="water-btn" data-water="500" type="button">+500</button>
        <button class="water-btn minus" data-water="-200" type="button">−200</button>
      </div>
    </div>
    <div class="nutri-quick">
      <button class="nutri-quick-btn" data-quick="weight" type="button">
        <div class="nutri-quick-em">⚖️</div>
        <div class="nutri-quick-txt">
          <div class="nutri-quick-t">Вес</div>
          <div class="nutri-quick-s">${S.nutrition.weights.length?S.nutrition.weights[S.nutrition.weights.length-1].weight+' кг':'Нет данных'}</div>
        </div>
      </button>
      <button class="nutri-quick-btn" data-quick="goals" type="button">
        <div class="nutri-quick-em">🎯</div>
        <div class="nutri-quick-txt">
          <div class="nutri-quick-t">Цели КБЖУ</div>
          <div class="nutri-quick-s">${g.calories} ккал</div>
        </div>
      </button>
    </div>
    ${MEALS.map(m=>{
      const items=d.meals[m.id]||[];
      const mealKcal=items.reduce((s,it)=>s+it.kcal*it.grams/100,0);
      return `
        <div class="meal-card" data-meal="${m.id}">
          <div class="meal-head" data-meal-toggle="${m.id}">
            <div class="meal-ico">${m.icon}</div>
            <div class="meal-info">
              <div class="meal-name">${m.name}</div>
              <div class="meal-kcal"><b>${Math.round(mealKcal)}</b> ккал${items.length?' · '+items.length+' прод.':''}</div>
            </div>
            <div class="meal-add" data-meal-add="${m.id}">+</div>
          </div>
          <div class="meal-body">
            ${items.length?items.map((it,idx)=>`
              <div class="food-row">
                <div class="food-row-main">
                  <div class="food-row-name">${esc(it.n)}</div>
                  <div class="food-row-macros">
                    <span>${it.grams}г</span>
                    <span class="mp">Б ${Math.round(it.p*it.grams/100)}</span>
                    <span class="mf">Ж ${Math.round(it.f*it.grams/100)}</span>
                    <span class="mc">У ${Math.round(it.c*it.grams/100)}</span>
                  </div>
                </div>
                <div class="food-row-kcal">${Math.round(it.kcal*it.grams/100)}<small> ккал</small></div>
                <button class="icon-btn btn-danger" style="width:30px;height:30px;font-size:12px" data-del-food="${m.id}|${idx}" type="button">✕</button>
              </div>
            `).join(''):`<div class="meal-empty">Пока пусто. Добавь продукты.</div>`}
          </div>
        </div>`;
    }).join('')}
    <div class="card" style="margin-top:16px">
      <div class="h3" style="margin-bottom:12px">Заметки о питании</div>
      <textarea class="nutri-note" id="nutNotes" placeholder="Как прошёл день...">${esc(d.notes||'')}</textarea>
    </div>
    <div class="card">
      <div class="h3" style="margin-bottom:12px;font-family:'Fraunces',serif;font-size:16px">История за 7 дней</div>
      <div class="daily-history">
        ${(()=>{
          const days=[];
          for(let i=6;i>=0;i--){
            const dd=new Date(Date.now()-i*86400000);
            const k=fmtDate(dd);
            const n=nutritionToday(k);
            days.push({k,n,label:dowShort[dd.getDay()]});
          }
          const maxK=Math.max(...days.map(x=>x.n.kcal),1);
          return days.map(x=>{
            const pct=Math.round(x.n.kcal/maxK*100);
            const cls=x.n.kcal>g.calories*1.1?'over':x.n.kcal<g.calories*0.7?'low':'good';
            return `<div class="hist-day">
              <div class="hist-day-lbl">${x.label}</div>
              <div class="hist-day-bar">
                <div class="hist-day-fill ${cls}" style="height:${pct}%"></div>
              </div>
              <div class="hist-day-val">${x.n.kcal}</div>
            </div>`;
          }).join('');
        })()}
      </div>
    </div>
    <div style="height:20px"></div>`;
  root.addEventListener('click',e=>{
    const t=e.target.closest('[data-meal-toggle]');
    if(t&&!e.target.closest('[data-meal-add]')&&!e.target.closest('[data-del-food]')){
      const card=t.closest('.meal-card');
      card.classList.toggle('open');
      return;
    }
    const add=e.target.closest('[data-meal-add]');
    if(add){openAddFoodModal(add.dataset.mealAdd,ds);return;}
    const df=e.target.closest('[data-del-food]');
    if(df){
      const[m,idx]=df.dataset.delFood.split('|');
      d.meals[m].splice(+idx,1);
      saveState();go('nutrition');
      return;
    }
    const w=e.target.closest('[data-water]');
    if(w){
      const delta=+w.dataset.water;
      d.water=Math.max(0,(d.water||0)+delta);
      SFX.tap();buzz(8);saveState();go('nutrition');
      return;
    }
    const q=e.target.closest('[data-quick]');
    if(q){
      if(q.dataset.quick==='weight') openWeightModal();
      else if(q.dataset.quick==='goals') openMacroGoalsModal();
    }
  });
  $('#nutDate',root).onclick=()=>{
    const nd=prompt('Дата (YYYY-MM-DD):',ds);
    if(nd&&/^\d{4}-\d{2}-\d{2}$/.test(nd)){
      S.nutrition.viewDate=nd;
      if(!S.nutrition.days[nd]) S.nutrition.days[nd]={meals:{breakfast:[],lunch:[],dinner:[],snack:[]},water:0,notes:''};
      saveState();go('nutrition');
    }
  };
  const nt=$('#nutNotes',root);
  if(nt) nt.oninput=()=>{d.notes=nt.value;saveState();};
  return root;
}
function openAddFoodModal(mealId,ds){
  addFoodTarget={mealId,ds};
  const allFoods=[...FOOD_DB,...(S.nutrition.myFoods||[])];
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:14px">Добавить в ${MEAL_NAMES[mealId]}</div>
    <div class="food-tabs">
      <button class="food-tab on" data-tab="db" type="button">📚 База</button>
      <button class="food-tab" data-tab="custom" type="button">✏️ Свой</button>
    </div>
    <div id="tab-db">
      <input class="food-search" id="foodSearch" placeholder="Поиск продукта..." autocomplete="off">
      <div class="food-list" id="foodList"></div>
      <div class="tiny" style="margin-bottom:8px">Порция (граммы)</div>
      <div class="portion-row" id="portionRow">
        ${[50,100,150,200,250,300].map(g=>`<button class="portion-btn ${g===100?'on':''}" data-portion="${g}" type="button">${g}г</button>`).join('')}
      </div>
      <div class="field"><label>Или точное значение</label>
        <input id="customGrams" type="number" value="100" min="1">
      </div>
      <div id="selectedFoodInfo" class="muted" style="text-align:center;margin-bottom:12px;font-size:13px">Выбери продукт</div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" id="afCancel" type="button">Отмена</button>
        <button class="btn btn-primary btn-full" id="afAdd" type="button" disabled>Добавить</button>
      </div>
    </div>
    <div id="tab-custom" style="display:none">
      <div class="field"><label>Название</label><input id="cfName" placeholder="Например, Мой салат"></div>
      <div class="field-row">
        <div class="field"><label>Ккал/100г</label><input id="cfKcal" type="number" placeholder="0"></div>
        <div class="field"><label>Белки/100г</label><input id="cfP" type="number" placeholder="0"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Жиры/100г</label><input id="cfF" type="number" placeholder="0"></div>
        <div class="field"><label>Углеводы/100г</label><input id="cfC" type="number" placeholder="0"></div>
      </div>
      <div class="field"><label>Граммы</label><input id="cfGrams" type="number" value="100" min="1"></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" id="cfCancel" type="button">Отмена</button>
        <button class="btn btn-primary btn-full" id="cfAdd" type="button">Добавить</button>
      </div>
    </div>`,m=>{
    let selectedFood=null;
    let grams=100;
    const listEl=$('#foodList',m);
    const searchEl=$('#foodSearch',m);
    const renderList=(filter)=>{
      const filtered=allFoods.filter(f=>!filter||f.n.toLowerCase().includes(filter.toLowerCase()));
      listEl.innerHTML=filtered.length?filtered.map((f,i)=>`
        <div class="food-item" data-fi="${i}">
          <div style="flex:1">
            <div class="food-item-name">${esc(f.n)}</div>
            <div class="food-item-info">Б ${f.p} · Ж ${f.f} · У ${f.c}</div>
          </div>
          <div class="food-item-kcal">${f.kcal}<small> ккал</small></div>
        </div>`).join(''):`<div style="padding:20px;text-align:center" class="muted">Не найдено</div>`;
      $$('.food-item',listEl).forEach(el=>{
        el.onclick=()=>{
          selectedFood=filtered[+el.dataset.fi];
          const kcal=Math.round(selectedFood.kcal*grams/100);
          $('#selectedFoodInfo',m).innerHTML=`<b>${esc(selectedFood.n)}</b><br>${grams}г = ${kcal} ккал`;
          $('#afAdd',m).disabled=false;
          SFX.tap();buzz(6);
        };
      });
    };
    renderList('');
    searchEl.oninput=()=>renderList(searchEl.value);
    $$('.portion-btn',m).forEach(b=>b.onclick=()=>{
      grams=+b.dataset.portion;
      $$('.portion-btn',m).forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      $('#customGrams',m).value=grams;
      if(selectedFood){
        const kcal=Math.round(selectedFood.kcal*grams/100);
        $('#selectedFoodInfo',m).innerHTML=`<b>${esc(selectedFood.n)}</b><br>${grams}г = ${kcal} ккал`;
      }
    });
    $('#customGrams',m).oninput=()=>{
      grams=Math.max(1,+$('#customGrams',m).value||0);
      $$('.portion-btn',m).forEach(x=>x.classList.remove('on'));
      if(selectedFood){
        const kcal=Math.round(selectedFood.kcal*grams/100);
        $('#selectedFoodInfo',m).innerHTML=`<b>${esc(selectedFood.n)}</b><br>${grams}г = ${kcal} ккал`;
      }
    };
    $$('[data-tab]',m).forEach(b=>b.onclick=()=>{
      $$('[data-tab]',m).forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      $('#tab-db',m).style.display=b.dataset.tab==='db'?'block':'none';
      $('#tab-custom',m).style.display=b.dataset.tab==='custom'?'block':'none';
    });
    $('#afCancel',m).onclick=()=>closeModal(m);
    $('#afAdd',m).onclick=()=>{
      if(!selectedFood) return;
      const day=S.nutrition.days[addFoodTarget.ds];
      day.meals[addFoodTarget.mealId].push({
        n:selectedFood.n,grams,
        kcal:selectedFood.kcal,p:selectedFood.p,f:selectedFood.f,c:selectedFood.c
      });
      saveState();closeModal(m);go('nutrition');
      toast(`Добавлено: ${selectedFood.n} ${grams}г`);
    };
    $('#cfCancel',m).onclick=()=>closeModal(m);
    $('#cfAdd',m).onclick=()=>{
      const n=$('#cfName',m).value.trim();
      const kcal=+$('#cfKcal',m).value||0;
      const p=+$('#cfP',m).value||0;
      const f=+$('#cfF',m).value||0;
      const c=+$('#cfC',m).value||0;
      const g=Math.max(1,+$('#cfGrams',m).value||100);
      if(!n||!kcal){toast('Введи название и ккал');return;}
      if(!S.nutrition.myFoods) S.nutrition.myFoods=[];
      S.nutrition.myFoods.push({n,kcal,p,f,c});
      const day=S.nutrition.days[addFoodTarget.ds];
      day.meals[addFoodTarget.mealId].push({n,grams:g,kcal,p,f,c});
      saveState();closeModal(m);go('nutrition');
      toast(`Добавлено: ${n} ${g}г`);
    };
  });
}
function openWeightModal(){
  const last=S.nutrition.weights.length?S.nutrition.weights[S.nutrition.weights.length-1].weight:S.nutrition.user.weight;
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">⚖️ Вес</div>
    <div class="field"><label>Текущий вес (кг)</label>
      <input id="wIn" type="number" step="0.1" value="${last}">
    </div>
    <p class="muted" style="margin-bottom:16px;font-size:12.5px">Запись сохраняется с датой.</p>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost btn-full" id="wCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="wSave" type="button">Сохранить</button>
    </div>`,m=>{
    $('#wCancel',m).onclick=()=>closeModal(m);
    $('#wSave',m).onclick=()=>{
      const w=parseFloat($('#wIn',m).value);
      if(!w||w<20||w>400){toast('Неверное значение');return;}
      const today=todayKey();
      const idx=S.nutrition.weights.findIndex(x=>x.date===today);
      if(idx>=0) S.nutrition.weights[idx].weight=w;
      else S.nutrition.weights.push({date:today,weight:w});
      S.nutrition.user.weight=w;
      saveState();closeModal(m);go('nutrition');toast('Вес сохранён');
    };
  });
}
function openMacroGoalsModal(){
  const g=S.nutrition.goals;
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">🎯 Дневные цели</div>
    <div class="field"><label>Калории (ккал)</label><input id="gKcal" type="number" value="${g.calories}"></div>
    <div class="field-row">
      <div class="field"><label>Белки (г)</label><input id="gP" type="number" value="${g.protein}"></div>
      <div class="field"><label>Жиры (г)</label><input id="gF" type="number" value="${g.fat}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Углеводы (г)</label><input id="gC" type="number" value="${g.carbs}"></div>
      <div class="field"><label>Вода (мл)</label><input id="gW" type="number" value="${g.water}"></div>
    </div>
    <button class="btn btn-ghost btn-full" id="calcTDEE" type="button" style="margin-bottom:16px">🧮 Рассчитать по формуле</button>
    <div style="display:flex;gap:10px">
      <button class="btn btn-ghost btn-full" id="mgCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="mgSave" type="button">Сохранить</button>
    </div>`,m=>{
    $('#mgCancel',m).onclick=()=>closeModal(m);
    $('#mgSave',m).onclick=()=>{
      S.nutrition.goals={
        calories:+$('#gKcal',m).value||2000,
        protein:+$('#gP',m).value||100,
        fat:+$('#gF',m).value||70,
        carbs:+$('#gC',m).value||250,
        water:+$('#gW',m).value||2000
      };
      saveState();closeModal(m);go('nutrition');toast('Цели сохранены');
    };
    $('#calcTDEE',m).onclick=()=>{
      const u=S.nutrition.user;
      const bmr=u.gender==='m'
        ? 10*u.weight+6.25*u.height-5*u.age+5
        : 10*u.weight+6.25*u.height-5*u.age-161;
      let tdee=Math.round(bmr*u.activity);
      if(u.goalType==='lose') tdee=Math.round(tdee*0.85);
      else if(u.goalType==='gain') tdee=Math.round(tdee*1.15);
      $('#gKcal',m).value=tdee;
      $('#gP',m).value=Math.round(u.weight*1.8);
      $('#gF',m).value=Math.round(tdee*0.25/9);
      $('#gC',m).value=Math.round(tdee*0.45/4);
      toast('Рассчитано по формуле Миффлина');
    };
  });
}

const CATS={memory:{name:'Память',icon:'🧠'},speed:{name:'Внимание',icon:'⚡'},math:{name:'Счёт',icon:'🔢'},logic:{name:'Логика',icon:'🧩'}};
const MODES={
  normal:{id:'normal',name:'Тренировка',emoji:'📋',desc:'Фиксированное число раундов.'},
  endless:{id:'endless',name:'Бесконечный',emoji:'♾️',desc:'Каждые 10 подряд — сложнее.'},
  survival:{id:'survival',name:'До ошибки',emoji:'💀',desc:'Одна ошибка — конец.'}
};
const EX={};

EX.nback={id:'nback',name:'N-back',cat:'memory',icon:'🧠',tag:'Рабочая память',
  about:'Сравнивай текущий стимул с тем, что был N шагов назад.',
  how:['Стимулы по одному.','Совпал с N-назад — жми.','Иначе не нажимай.'],
  hint:'Держи очередь последних N.',
  levels:['N=2 буквы','N=2 быстрее','N=3 буквы','N=3 цифры','N=4 буквы','N=4 цифры'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[
      {N:2,pool:'БКМНРСТАЕЛ'.split(''),ms:2000,total:24,matchP:.32},
      {N:2,pool:'БКМНРСТАЕЛ'.split(''),ms:1700,total:26,matchP:.30},
      {N:3,pool:'БКМНРСТАЕЛ'.split(''),ms:1700,total:26,matchP:.28},
      {N:3,pool:'0123456789'.split(''),ms:1500,total:28,matchP:.28},
      {N:4,pool:'БКМНРСТАЕЛ'.split(''),ms:1500,total:28,matchP:.25},
      {N:4,pool:'0123456789'.split(''),ms:1300,total:30,matchP:.25}
    ];
    const maxRounds=api.mode!=='normal'?9999:cfg[Math.min(api.level,cfg.length)-1].total;
    host.innerHTML=`<div class="stim-stage"><div class="stim" id="nbL">•</div></div>
      <button class="big-action" id="nbBtn" type="button">✓ Совпало</button>`;
    const L=$('#nbL',host),btn=$('#nbBtn',host);
    let hits=0,miss=0,fa=0,cr=0;const rts=[],seq=[];
    for(let i=0;i<maxRounds;i++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      let cur;
      if(i<c.N){cur=pick(c.pool);}
      else if(Math.random()<c.matchP){cur=seq[i-c.N];}
      else{let x;do{x=pick(c.pool);}while(x===seq[i-c.N]);cur=x;}
      seq.push(cur);
      const isMatch=i>=c.N&&cur===seq[i-c.N];
      L.textContent=cur;L.classList.remove('pop');void L.offsetWidth;L.classList.add('pop');
      btn.disabled=false;
      api.progress((i%20)/20);
      const t0=performance.now();
      const r=await api.raceAnswer(btn,c.ms);
      const rt=performance.now()-t0;
      btn.disabled=true;
      let ok;
      if(r===TIMEOUT){if(isMatch){miss++;ok=false;}else{cr++;ok=true;}}
      else{if(isMatch){hits++;rts.push(rt);ok=true;}else{fa++;ok=false;}}
      if(ok) api.ok();else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(280);L.textContent='•';await api.delay(140);
    }
    if(api.cancelled) return;
    const total=hits+miss+fa+cr;
    const acc=total?Math.round((hits+cr)/total*100):0;
    const avg=rts.length?Math.round(rts.reduce((a,b)=>a+b,0)/rts.length):0;
    api.finish({acc,rt:avg,level:api.level,detail:{'N':cfg[Math.min(api.level,cfg.length)-1].N,'Попад.':hits,'Проп.':miss,'Ложн.':fa}});
  }};

EX.gridmem={id:'gridmem',name:'Сетка памяти',cat:'memory',icon:'🔲',tag:'Зрительная память',
  about:'Запоминай подсвеченные клетки.',how:['Клетки подсветятся.','Запомни.','Тапни по ним.'],
  hint:'Ориентируйся на углы.',levels:['4×4 · 6','5×5 · 7','5×5 · 8','6×6 · 9','6×6 · 10','7×7 · 12'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{size:4,count:6,ms:1300},{size:5,count:7,ms:1200},{size:5,count:8,ms:1100},
      {size:6,count:9,ms:1000},{size:6,count:10,ms:900},{size:7,count:12,ms:800}];
    const maxR=api.mode==='normal'?4:9999;
    host.innerHTML=`<p class="muted" id="gmH" style="text-align:center;margin-bottom:14px">Приготовься…</p><div class="grid" id="gmG"></div>`;
    const grid=$('#gmG',host),hint=$('#gmH',host);
    let good=0,errs=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      const size=c.size,count=c.count,total=size*size,ms=c.ms;
      grid.style.gridTemplateColumns=`repeat(${size},1fr)`;
      grid.style.maxWidth=(size>=6?420:400)+'px';
      grid.innerHTML=Array.from({length:total},(_,i)=>`<div class="cell" data-i="${i}"></div>`).join('');
      const cells=$$('.cell',grid);
      const target=shuffle([...Array(total).keys()]).slice(0,count);
      hint.textContent='Запоминай…';
      api.progress((r%10)/10);
      await api.delay(280);
      target.forEach(i=>cells[i].classList.add('lit'));
      await api.delay(ms);
      target.forEach(i=>cells[i].classList.remove('lit'));
      hint.textContent='Повтори';
      const chosen=new Set();let e=0;
      await new Promise(resolve=>{
        let done=false;
        const fin=()=>{if(done)return;done=true;cells.forEach(x=>{x.onclick=null;});resolve();};
        cells.forEach((cell,i)=>{
          cell.onclick=()=>{
            if(api.cancelled||done) return;
            if(chosen.has(i)) return;
            SFX.tap();buzz(6);
            if(target.includes(i)){cell.classList.add('ok');chosen.add(i);if(chosen.size===target.length)fin();}
            else{cell.classList.add('bad');e++;flash('bad');setTimeout(()=>cell.classList.remove('bad'),500);}
          };
        });
        const t=setTimeout(fin,15000);
        api.onCancel(()=>{clearTimeout(t);fin();});
      });
      if(api.cancelled) break;
      const ok=chosen.size===target.length&&e===0;
      if(ok){good++;api.ok();}else api.bad();
      errs+=e;
      hint.textContent=ok?'✅ Верно':'❌';
      if(!api.recordResult(ok)) break;
      await api.delay(700);
    }
    if(api.cancelled) return;
    const acc=good+errs?Math.round(good/Math.max(1,good+errs)*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':good,'Ошибок':errs}});
  }};

EX.simon={id:'simon',name:'Последовательность',cat:'memory',icon:'🎨',tag:'Память',
  about:'Повторяй последовательность.',how:['Смотри.','Повтори.','Раунд длиннее.'],
  hint:'Проговаривай про себя.',levels:['4 · 4','4 · 5','4 · 6','6 · 5','6 · 6','6 · 7'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{colors:4,start:4,showMs:480,gapMs:160},{colors:4,start:5,showMs:440,gapMs:150},
      {colors:4,start:6,showMs:400,gapMs:140},{colors:6,start:5,showMs:360,gapMs:130},
      {colors:6,start:6,showMs:320,gapMs:120},{colors:6,start:7,showMs:280,gapMs:100}];
    const maxR=api.mode==='normal'?5:9999;
    const COLORS=['#3F6152','#B87F35','#4F7563','#A4503A','#8FAE9B','#D9A85E'];
    host.innerHTML=`<p class="muted" id="smH" style="text-align:center;margin-bottom:14px">Приготовься…</p><div class="pad" id="smP"></div>`;
    const pad=$('#smP',host),hint=$('#smH',host);
    let maxLen=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      const len=c.start+(api.mode==='normal'?r:Math.floor(api.streak/10)*3);
      const cols=c.colors<=4?2:3;
      pad.style.gridTemplateColumns=`repeat(${cols},1fr)`;
      pad.style.maxWidth=(cols*130)+'px';
      pad.innerHTML=COLORS.slice(0,c.colors).map((col,i)=>
        `<button class="pad-btn" data-i="${i}" type="button" style="background:${col}22;border-color:${col}66;color:${col};min-height:${c.colors===6?80:100}px"></button>`
      ).join('');
      const btns=$$('.pad-btn',pad);
      const seq=Array.from({length:len},()=>rnd(c.colors));
      hint.textContent=`Раунд ${r+1} · длина ${len}`;
      api.progress((r%10)/10);
      await api.delay(600);
      hint.textContent='Смотри…';
      btns.forEach(b=>b.disabled=true);
      for(const idx of seq){
        if(api.cancelled) break;
        const b=btns[idx];
        b.style.background=COLORS[idx];b.style.boxShadow=`0 0 22px ${COLORS[idx]}`;
        SFX.beep(idx);
        await api.delay(c.showMs);
        b.style.background=`${COLORS[idx]}22`;b.style.boxShadow='';
        await api.delay(c.gapMs);
      }
      if(api.cancelled) break;
      hint.textContent='Повтори';
      btns.forEach(b=>b.disabled=false);
      let pos=0;
      const ok=await new Promise(resolve=>{
        let done=false;
        const fin=v=>{if(done)return;done=true;btns.forEach(b=>{b.onclick=null;b.disabled=true;});resolve(v);};
        btns.forEach((b,i)=>{
          b.onclick=()=>{
            if(done||api.cancelled) return;
            SFX.beep(i);buzz(8);
            b.style.background=COLORS[i];b.style.boxShadow=`0 0 22px ${COLORS[i]}`;
            setTimeout(()=>{b.style.background=`${COLORS[i]}22`;b.style.boxShadow='';},160);
            if(seq[pos]===i){pos++;if(pos===seq.length)fin(true);}
            else{flash('bad');SFX.err();fin(false);}
          };
        });
        api.onCancel(()=>fin(false));
      });
      if(api.cancelled) break;
      if(ok){maxLen=Math.max(maxLen,len);api.ok();hint.textContent='✅';}
      else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(650);
    }
    if(api.cancelled) return;
    const c0=cfg[Math.min(api.level,cfg.length)-1].start;
    const reached=Math.max(0,maxLen-c0+1);
    const acc=clamp(Math.round(reached/5*100),0,100);
    api.finish({acc,rt:0,level:api.level,detail:{'Макс. длина':maxLen}});
  }};

EX.pairs={id:'pairs',name:'Парные карточки',cat:'memory',icon:'🃏',tag:'Память',
  about:'Найди все пары.',how:['Открывай по две.','Запоминай.','Найди все.'],
  hint:'Начинай с углов.',levels:['6 пар','8 пар','10 пар','12 пар','15 пар','18 пар'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{pairs:6,cols:4},{pairs:8,cols:4},{pairs:10,cols:5},{pairs:12,cols:6},{pairs:15,cols:6},{pairs:18,cols:6}];
    const c=cfg[Math.min(api.level,cfg.length)-1];
    const POOL=['🍀','🔥','💎','🌙','⚡','🎯','🌊','🪐','🎵','🦋','🌸','🍎','🎲','🗝','⚓','🧩','🌺','⭐'];
    const chosen=shuffle(POOL).slice(0,c.pairs);
    const deck=shuffle([...chosen,...chosen]);
    host.innerHTML=`<div class="grid" id="prG" style="grid-template-columns:repeat(${c.cols},1fr);max-width:440px"></div>
      <div class="ex-hud" style="margin-top:16px">
        <span class="hud-pill">Ходы <b id="prM">0</b></span>
        <span class="hud-pill">Пары <b id="prF">0</b>/${c.pairs}</span>
      </div>`;
    const grid=$('#prG',host),mEl=$('#prM',host),fEl=$('#prF',host);
    grid.innerHTML=deck.map((s,i)=>`<div class="cell" data-i="${i}" style="font-size:${c.pairs>=12?18:24}px"></div>`).join('');
    const cells=$$('.cell',grid);
    let first=null,lock=false,moves=0,found=0;
    await new Promise(resolve=>{
      cells.forEach((cell,i)=>{
        cell.onclick=async()=>{
          if(lock||api.cancelled) return;
          if(cell.classList.contains('ok')||cell===first) return;
          cell.textContent=deck[i];cell.classList.add('lit');
          SFX.tap();buzz(6);
          if(!first){first={cell,i};return;}
          moves++;mEl.textContent=moves;
          if(deck[first.i]===deck[i]){
            first.cell.classList.remove('lit');cell.classList.remove('lit');
            first.cell.classList.add('ok');cell.classList.add('ok');
            first=null;found++;fEl.textContent=found;
            SFX.ok();flash('ok');api.progress(found/c.pairs);
            if(found===c.pairs) resolve();
          }else{
            lock=true;SFX.err();const a=first;first=null;
            await api.delay(600);
            if(api.cancelled) return;
            a.cell.textContent='';a.cell.classList.remove('lit');
            cell.textContent='';cell.classList.remove('lit');
            lock=false;
          }
        };
      });
      api.onCancel(resolve);
    });
    if(api.cancelled) return;
    const perfect=c.pairs*2;
    const acc=Math.round(clamp(perfect/Math.max(perfect,moves),0,1)*100);
    api.finish({acc,rt:0,level:api.level,detail:{'Ходов':moves,'Идеально':perfect}});
  }};

EX.chunk={id:'chunk',name:'Чанкинг чисел',cat:'memory',icon:'🔢',tag:'Память',
  about:'Запоминай числа.',how:['Число на пару секунд.','Запомни.','Введи.'],
  hint:'Группируй по 2–3.',levels:['6 цифр','7','8','9','10','12 наоборот'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{len:6,rev:false,ms:400},{len:7,rev:false,ms:380},{len:8,rev:false,ms:350},
      {len:9,rev:false,ms:330},{len:10,rev:false,ms:300},{len:12,rev:true,ms:280}];
    const maxR=api.mode==='normal'?6:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:140px"><div class="stim" id="ckS" style="font-size:clamp(26px,8vw,44px)">—</div></div>
      <p class="muted" id="ckR" style="text-align:center;margin-top:6px;font-size:12.5px;min-height:16px"></p>
      <form class="answer-bar" id="ckF" style="display:none" autocomplete="off">
        <input class="answer-input" id="ckI" inputmode="numeric" placeholder="Число">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const stim=$('#ckS',host),form=$('#ckF',host),inp=$('#ckI',host),rev=$('#ckR',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      rev.textContent=c.rev?'⚠️ Введи в обратном!':'';
      let num='';for(let i=0;i<c.len;i++) num+=i===0?(1+rnd(9)):rnd(10);
      const expected=c.rev?num.split('').reverse().join(''):num;
      stim.style.display='';form.style.display='none';
      stim.textContent=num;stim.classList.remove('pop');void stim.offsetWidth;stim.classList.add('pop');
      api.progress((r%10)/10);
      await api.delay(600+c.len*c.ms);
      if(api.cancelled) break;
      stim.textContent='?';
      form.style.display='';inp.value='';
      setTimeout(()=>inp.focus(),30);
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim());};
        api.onCancel(()=>fin(null));
      });
      if(api.cancelled) break;
      const ok=v===expected;
      total++;
      if(ok){correct++;api.ok();stim.textContent='✅ '+expected;}
      else{api.bad();stim.textContent='❌ '+expected;}
      if(!api.recordResult(ok)) break;
      await api.delay(700);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.schulte={id:'schulte',name:'Таблица Шульте',cat:'speed',icon:'🔢',tag:'Концентрация',
  about:'Находи числа по порядку.',how:['Сетка чисел.','Нажимай по порядку.','Смотри в центр.'],
  hint:'Держи взгляд в центре.',levels:['4×4','5×5','5×5 цвет','6×6','6×6 альт','7×7'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{size:4,colored:false,alt:false},{size:5,colored:false,alt:false},
      {size:5,colored:true,alt:false},{size:6,colored:false,alt:false},
      {size:6,colored:false,alt:true},{size:7,colored:false,alt:false}];
    const c=cfg[Math.min(api.level,cfg.length)-1];
    const size=c.size,total=size*size;
    let sequence;
    if(c.alt){
      const ev=[],od=[];
      for(let i=1;i<=total;i++)(i%2===0?ev:od).push(i);
      sequence=[...ev.sort((a,b)=>a-b),...od.sort((a,b)=>b-a)];
    }else sequence=Array.from({length:total},(_,i)=>i+1);
    const nums=shuffle(sequence.slice());
    const CM={};
    if(c.colored){
      const pal=['#A4503A','#4F7563','#3F6152','#B87F35','#8FAE9B'];
      nums.forEach((n,i)=>CM[n]=pal[i%pal.length]);
    }
    host.innerHTML=`<div class="grid" id="scG" style="grid-template-columns:repeat(${size},1fr);max-width:${size>=6?440:400}px"></div>
      <div class="ex-hud" style="margin-top:16px">
        <span class="hud-pill">След. <b id="scN">${sequence[0]}</b></span>
        <span class="hud-pill">Время <b id="scT">0.0</b></span>
      </div>`;
    const grid=$('#scG',host),nEl=$('#scN',host),tEl=$('#scT',host);
    grid.innerHTML=nums.map(n=>`<div class="cell" data-n="${n}" style="font-size:${size>=6?14:size===5?16:22}px;${c.colored?`color:${CM[n]}`:''}">${n}</div>`).join('');
    const cells=$$('.cell',grid);
    let idx=0,errors=0;
    const t0=performance.now();
    const timer=setInterval(()=>{if(api.cancelled) return;tEl.textContent=((performance.now()-t0)/1000).toFixed(1);},100);
    api.onCancel(()=>clearInterval(timer));
    await new Promise(resolve=>{
      cells.forEach(cell=>{
        cell.onclick=()=>{
          if(api.cancelled) return;
          const n=+cell.dataset.n;
          if(n===sequence[idx]){
            cell.classList.add('done');SFX.tap();buzz(6);
            idx++;api.progress(idx/total);
            nEl.textContent=idx<total?sequence[idx]:'✓';
            if(idx>=total) resolve();
          }else{errors++;flash('bad');SFX.err();cell.classList.add('bad');setTimeout(()=>cell.classList.remove('bad'),320);}
        };
      });
      api.onCancel(resolve);
    });
    clearInterval(timer);
    if(api.cancelled) return;
    const secs=(performance.now()-t0)/1000;
    const norms=[16,28,32,44,52,70];
    const norm=norms[Math.min(api.level,norms.length)-1];
    const acc=clamp(Math.round(norm/secs*100-errors*4),5,100);
    api.finish({acc,rt:Math.round(secs*1000/total),level:api.level,detail:{'Время':secs.toFixed(1)+'с','Ошибок':errors}});
  }};

EX.stroop={id:'stroop',name:'Струп-тест',cat:'speed',icon:'🌈',tag:'Торможение',
  about:'Называй цвет шрифта.',how:['Слово-цвет.','Жми на ЦВЕТ ШРИФТА.','На высокой — правило меняется.'],
  hint:'Не читай — смотри на цвет.',levels:['6 · 50%','6 · 70%','6 · 85%','6 · быстро','6 · 95%','правило'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{colors:6,mismatchP:.5,ms:2600,swap:false},{colors:6,mismatchP:.7,ms:2400,swap:false},
      {colors:6,mismatchP:.85,ms:2200,swap:false},{colors:6,mismatchP:.9,ms:1800,swap:false},
      {colors:6,mismatchP:.95,ms:1600,swap:false},{colors:6,mismatchP:.95,ms:1500,swap:true}];
    const maxR=api.mode==='normal'?20:9999;
    const ALL=[{n:'КРАСНЫЙ',c:'#A4503A'},{n:'СИНИЙ',c:'#3F5A7A'},{n:'ЗЕЛЁНЫЙ',c:'#3F6152'},{n:'ЖЁЛТЫЙ',c:'#B87F35'},{n:'ФИОЛЕТОВЫЙ',c:'#6A4A7A'},{n:'РОЗОВЫЙ',c:'#A4507A'}];
    const c=cfg[Math.min(api.level,cfg.length)-1];const set=ALL.slice(0,c.colors);
    host.innerHTML=`<p class="muted" id="stR" style="text-align:center;margin-bottom:12px;font-size:12.5px;min-height:18px">${c.swap?'Правило: ЦВЕТ ШРИФТА':'&nbsp;'}</p>
      <div class="stim-stage" style="min-height:150px"><div class="stim text" id="stW">—</div></div>
      <div class="pad" id="stP" style="grid-template-columns:repeat(2,1fr);margin-top:14px;max-width:400px"></div>`;
    const word=$('#stW',host),pad=$('#stP',host),rule=$('#stR',host);
    pad.innerHTML=set.map((s,i)=>`<button class="pad-btn" data-i="${i}" type="button" style="font-size:13px">${s.n}</button>`).join('');
    const btns=$$('.pad-btn',pad);
    let correct=0,total=0;const rts=[];
    let ruleMode='ink';
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      if(c.swap&&r>0&&r%4===0){
        ruleMode=ruleMode==='ink'?'word':'ink';
        rule.textContent=ruleMode==='ink'?'🔀 ЦВЕТ ШРИФТА':'🔀 СЛОВО';
        await api.delay(600);
      }
      const w=pick(set);let ink=pick(set);
      if(c.mismatchP>0&&Math.random()<c.mismatchP){while(ink===w) ink=pick(set);}
      word.textContent=w.n;word.style.color=ink.c;
      word.classList.remove('pop');void word.offsetWidth;word.classList.add('pop');
      api.progress((r%20)/20);
      const t0=performance.now();
      const idx=await new Promise(resolve=>{
        let done=false;
        const fin=v=>{if(done)return;done=true;btns.forEach(b=>{b.onclick=null;});resolve(v);};
        btns.forEach((b,i)=>b.onclick=()=>fin(i));
        const t=setTimeout(()=>fin(-1),c.ms);
        api.onCancel(()=>{clearTimeout(t);fin(-1);});
      });
      if(api.cancelled) break;
      const rt=performance.now()-t0;
      const correctIdx=ruleMode==='ink'?set.findIndex(s=>s===ink):set.findIndex(s=>s===w);
      total++;
      const ok=idx===correctIdx;
      if(ok){correct++;rts.push(rt);api.ok();}else api.bad();
      word.textContent='—';word.style.color='';
      if(!api.recordResult(ok)) break;
      await api.delay(200);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    const avg=rts.length?Math.round(rts.reduce((a,b)=>a+b,0)/rts.length):0;
    api.finish({acc,rt:avg,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.gonogo={id:'gonogo',name:'Go / No-Go',cat:'speed',icon:'🚦',tag:'Самоконтроль',
  about:'Зелёный — жми, красный — нет.',how:['Появляется круг.','Зелёный — жми.','Красный — не жми.'],
  hint:'Палец наготове.',levels:['Средне','Быстро','Очень','Молния','Экстрим','Хардкор'],
  defaultLevel:1,
  async run(host,api){
    const speeds=[900,750,600,480,380,300],goP=[.68,.66,.64,.62,.60,.58];
    const maxR=api.mode==='normal'?24:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:280px"><div id="ggC" style="width:140px;height:140px;border-radius:50%;background:var(--paper);border:2px solid var(--line);transition:all .12s"></div></div>
      <p class="muted" style="text-align:center" id="ggH">Приготовься…</p>`;
    const circle=$('#ggC',host),hint=$('#ggH',host);
    let hits=0,miss=0,fa=0,cr=0;const rts=[];
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const L=Math.min(api.level,speeds.length);
      const speed=speeds[L-1],pGo=goP[L-1];
      const isGo=Math.random()<pGo;
      circle.style.background=isGo?'linear-gradient(135deg,#3F6152,#2E4A3E)':'linear-gradient(135deg,#A4503A,#8A3E2B)';
      circle.style.borderColor='transparent';
      circle.style.boxShadow=isGo?'0 0 40px rgba(63,97,82,.4)':'0 0 40px rgba(164,80,58,.4)';
      circle.style.transform='scale(1.05)';
      hint.textContent=isGo?'Жми!':'Не жми';
      api.progress((r%20)/20);
      const t0=performance.now();
      const clicked=await api.raceAnswer(circle,speed);
      const rt=performance.now()-t0;
      circle.style.background='var(--paper)';
      circle.style.borderColor='var(--line)';
      circle.style.boxShadow='none';
      circle.style.transform='scale(1)';
      let ok;
      if(isGo){
        if(clicked!==TIMEOUT){hits++;rts.push(rt);ok=true;}else{miss++;ok=false;}
      }else{
        if(clicked!==TIMEOUT){fa++;ok=false;}else{cr++;ok=true;}
      }
      if(ok) api.ok();else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(Math.max(100,260+rnd(180)-L*20));
    }
    if(api.cancelled) return;
    const total=hits+miss+fa+cr;
    const acc=total?Math.round((hits+cr)/total*100):0;
    const avg=rts.length?Math.round(rts.reduce((a,b)=>a+b,0)/rts.length):0;
    api.finish({acc,rt:avg,level:api.level,detail:{'Попад.':hits,'Проп.':miss,'Ложн.':fa}});
  }};

EX.flanker={id:'flanker',name:'Фланкер-тест',cat:'speed',icon:'➡️',tag:'Внимание',
  about:'Определи центральную стрелку.',how:['Ряд стрелок.','Смотри только ЦЕНТР.','Нажми.'],
  hint:'Смотри в центр.',levels:['5 · совпад','5 · 60%','5 · 80%','5 · быстро','7 · 90%','7 · экстрим'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{arrows:5,mismatchP:0,ms:2800},{arrows:5,mismatchP:.6,ms:2600},
      {arrows:5,mismatchP:.8,ms:2200},{arrows:5,mismatchP:.9,ms:1600},
      {arrows:7,mismatchP:.9,ms:1400},{arrows:7,mismatchP:.95,ms:1200}];
    const maxR=api.mode==='normal'?20:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:150px"><div class="stim text" id="flS" style="font-size:clamp(26px,8vw,42px);letter-spacing:.12em">—</div></div>
      <div class="pad" style="grid-template-columns:1fr 1fr;margin-top:14px;max-width:420px">
        <button class="pad-btn" data-d="L" type="button">← Влево</button>
        <button class="pad-btn" data-d="R" type="button">Вправо →</button>
      </div>`;
    const stim=$('#flS',host),btns=$$('.pad-btn',host);
    let correct=0,total=0;const rts=[];
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      const dir=Math.random()<.5?'L':'R';
      const congruent=Math.random()>=c.mismatchP;
      const flank=congruent?dir:(dir==='L'?'R':'L');
      const arrow=d=>d==='L'?'◀':'▶';
      const side=Math.floor((c.arrows-1)/2);
      stim.textContent=arrow(flank).repeat(side)+arrow(dir)+arrow(flank).repeat(side);
      stim.classList.remove('pop');void stim.offsetWidth;stim.classList.add('pop');
      api.progress((r%20)/20);
      const t0=performance.now();
      const ans=await new Promise(resolve=>{
        let done=false;
        const fin=v=>{if(done)return;done=true;btns.forEach(b=>{b.onclick=null;});resolve(v);};
        btns.forEach(b=>b.onclick=()=>fin(b.dataset.d));
        const t=setTimeout(()=>fin(null),c.ms);
        api.onCancel(()=>{clearTimeout(t);fin(null);});
      });
      if(api.cancelled) break;
      total++;
      const ok=ans===dir;
      if(ok){correct++;rts.push(performance.now()-t0);api.ok();}else api.bad();
      stim.textContent='—';
      if(!api.recordResult(ok)) break;
      await api.delay(180);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    const avg=rts.length?Math.round(rts.reduce((a,b)=>a+b,0)/rts.length):0;
    api.finish({acc,rt:avg,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.ruleswitch={id:'ruleswitch',name:'Переключение правил',cat:'speed',icon:'🔀',tag:'Гибкость',
  about:'Сортируй то по цвету, то по форме.',how:['Карточка с фигурой.','Сверху правило.','Нажми корзину.'],
  hint:'Сначала правило.',levels:['3ц · редко','3ц','3×3','4×3','4×4','4×4 быстро'],
  defaultLevel:1,
  async run(host,api){
    const cfg=[{colors:3,shapes:2,swapEvery:6,ms:3000},{colors:3,shapes:2,swapEvery:5,ms:2800},
      {colors:3,shapes:3,swapEvery:4,ms:2400},{colors:4,shapes:3,swapEvery:4,ms:2000},
      {colors:4,shapes:4,swapEvery:3,ms:1700},{colors:4,shapes:4,swapEvery:2,ms:1400}];
    const COLORS=['#A4503A','#3F5A7A','#3F6152','#B87F35'];
    const SHAPES=[{sym:'●'},{sym:'■'},{sym:'▲'},{sym:'◆'}];
    const maxR=api.mode==='normal'?20:9999;
    host.innerHTML=`<p id="rsR" style="text-align:center;font-size:13px;font-weight:600;margin-bottom:12px;padding:10px;border-radius:12px;background:var(--moss-soft);color:var(--moss)">По цвету</p>
      <div class="stim-stage" style="min-height:160px"><div id="rsC" style="font-size:96px;line-height:1">●</div></div>
      <div class="pad" id="rsP" style="grid-template-columns:1fr 1fr;margin-top:14px;max-width:420px"></div>`;
    const rule=$('#rsR',host),card=$('#rsC',host),pad=$('#rsP',host);
    let correct=0,total=0,ruleMode='color';
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      if(r===0||r%c.swapEvery===0){
        ruleMode=ruleMode==='color'?'shape':'color';
        rule.textContent=ruleMode==='color'?'🎨 По ЦВЕТУ':'🔷 По ФОРМЕ';
        if(r>0){SFX.tap();flash('ok');await api.delay(400);}
      }
      const ci=rnd(c.colors),si=rnd(c.shapes);
      card.textContent=SHAPES[si].sym;card.style.color=COLORS[ci];
      card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');
      let bins;
      if(ruleMode==='color') bins=COLORS.slice(0,c.colors).map(c=>({label:'•',color:c}));
      else bins=SHAPES.slice(0,c.shapes).map(s=>({label:s.sym,color:'var(--ink)'}));
      pad.innerHTML=bins.map((b,i)=>`<button class="pad-btn" data-i="${i}" type="button" style="color:${b.color};font-size:28px">${b.label}</button>`).join('');
      const btns=$$('.pad-btn',pad);
      api.progress((r%20)/20);
      const correctBin=ruleMode==='color'?ci:si;
      const ans=await new Promise(resolve=>{
        let done=false;
        const fin=v=>{if(done)return;done=true;btns.forEach(b=>{b.onclick=null;});resolve(v);};
        btns.forEach((b,i)=>b.onclick=()=>fin(i));
        const t=setTimeout(()=>fin(-1),c.ms);
        api.onCancel(()=>{clearTimeout(t);fin(-1);});
      });
      if(api.cancelled) break;
      total++;
      const ok=ans===correctBin;
      if(ok){correct++;api.ok();}else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(180);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.math={id:'math',name:'Быстрый счёт',cat:'math',icon:'➗',tag:'Устный счёт',
  about:'Решай примеры.',how:['Пример.','Введи ответ.'],hint:'Считай по частям.',
  levels:['Двузначные','×÷','Три операции','Скобки','Степени','Микс'],defaultLevel:1,
  async run(host,api){
    const ROUNDS=[12,12,14,14,14,12];
    function gen(L){
      let a,b,c,d,ans,text;
      if(L===1){a=15+rnd(85);b=15+rnd(85);const op=pick(['+','−']);if(op==='−'&&b>a)[a,b]=[b,a];ans=op==='+'?a+b:a-b;text=`${a} ${op} ${b}`;}
      else if(L===2){if(Math.random()<.5){a=6+rnd(14);b=4+rnd(12);ans=a*b;text=`${a} × ${b}`;}else{b=4+rnd(11);ans=4+rnd(14);a=b*ans;text=`${a} ÷ ${b}`;}}
      else if(L===3){const t=rnd(3);if(t===0){a=8+rnd(20);b=4+rnd(12);c=5+rnd(20);ans=a+b*c;text=`${a}+${b}×${c}`;}else if(t===1){a=8+rnd(15);b=4+rnd(10);c=5+rnd(20);ans=a*b-c;text=`${a}×${b}−${c}`;}else{a=20+rnd(70);b=15+rnd(50);c=10+rnd(30);ans=a+b-c;text=`${a}+${b}−${c}`;}}
      else if(L===4){const t=rnd(3);if(t===0){a=5+rnd(15);b=3+rnd(9);c=4+rnd(8);ans=(a+b)*c;text=`(${a}+${b})×${c}`;}else if(t===1){a=8+rnd(15);b=3+rnd(8);c=3+rnd(8);ans=(a-b)*c;text=`(${a}−${b})×${c}`;}else{a=5+rnd(20);b=3+rnd(8);c=3+rnd(7);d=2+rnd(8);ans=a+b*c-d;text=`${a}+${b}×${c}−${d}`;}}
      else if(L===5){const t=rnd(4);if(t===0){a=4+rnd(8);b=2+rnd(4);ans=a*a+b**3;text=`${a}²+${b}³`;}else if(t===1){const sq=[9,16,25,36,49,64,81,100,121,144,169,196][rnd(12)];a=Math.sqrt(sq);b=3+rnd(11);ans=a*b;text=`√${sq}×${b}`;}else if(t===2){a=3+rnd(7);b=2+rnd(4);ans=a**b;text=`${a}^${b}`;}else{const sq=[16,25,36,49,64,81,100,121,144][rnd(9)];a=Math.sqrt(sq);b=2+rnd(6);c=5+rnd(20);ans=a+b*b+c;text=`√${sq}+${b}²+${c}`;}}
      else{const t=rnd(5);if(t===0){a=3+rnd(6);b=2+rnd(4);c=2+rnd(4);ans=a**b+c*c;text=`${a}^${b}+${c}²`;}else if(t===1){a=[5,10,15,20,25,30,40,50][rnd(8)];b=[80,120,160,200,240,300,400,500][rnd(8)];ans=a*b/100;text=`${a}% от ${b}`;}else if(t===2){a=3+rnd(10);b=4+rnd(10);c=3+rnd(9);d=2+rnd(7);ans=a*b+c*d;text=`${a}×${b}+${c}×${d}`;}else if(t===3){b=3+rnd(6);const dv=3+rnd(10);a=b*dv;c=2+rnd(9);ans=dv+c*c;text=`${a}÷${b}+${c}²`;}else{const sq=[144,169,196,225,256,289][rnd(6)];a=Math.sqrt(sq);b=3+rnd(10);c=4+rnd(20);ans=a*b-c;text=`√${sq}×${b}−${c}`;}}
      return {text,ans};
    }
    const maxR=api.mode==='normal'?ROUNDS[Math.min(api.level,ROUNDS.length)-1]:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:130px"><div class="stim text" id="mtT" style="font-size:clamp(24px,7.5vw,40px)">—</div></div>
      <form class="answer-bar" id="mtF" autocomplete="off">
        <input class="answer-input" id="mtI" inputmode="decimal" placeholder="Ответ">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const task=$('#mtT',host),form=$('#mtF',host),inp=$('#mtI',host);
    let correct=0,total=0;const rts=[];
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const p=gen(api.level);
      task.textContent=p.text+' = ?';
      task.classList.remove('pop');void task.offsetWidth;task.classList.add('pop');
      inp.value='';
      setTimeout(()=>inp.focus(),30);
      api.progress((r%15)/15);
      const t0=performance.now();
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim());};
        api.onCancel(()=>fin(''));
      });
      if(api.cancelled) break;
      total++;
      const num=parseFloat(v.replace(',','.'));
      const ok=Math.abs(num-p.ans)<.01;
      if(ok){correct++;rts.push(performance.now()-t0);api.ok();task.textContent='✅ '+p.ans;}
      else{api.bad();task.textContent='❌ '+p.ans;}
      if(!api.recordResult(ok)) break;
      await api.delay(500);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    const avg=rts.length?Math.round(rts.reduce((a,b)=>a+b,0)/rts.length):0;
    api.finish({acc,rt:avg,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.chains={id:'chains',name:'Цепочки вычислений',cat:'math',icon:'⛓️',tag:'Память+счёт',
  about:'Применяй операции по порядку.',how:['Старт и цепочка.','Шаг за шагом.','Введи итог.'],
  hint:'Считай пошагово.',levels:['4 оп','5 оп','5 ×÷','6','7','8 микс'],defaultLevel:1,
  async run(host,api){
    const cfg=[{len:4,ops:['+','-'],range:[1,20],ms:9000},{len:5,ops:['+','-'],range:[1,25],ms:11000},
      {len:5,ops:['+','-','×','÷'],range:[1,15],ms:13000},{len:6,ops:['+','-','×','÷'],range:[1,15],ms:15000},
      {len:7,ops:['+','-','×','÷'],range:[1,12],ms:18000},{len:8,ops:['+','-','×','÷'],range:[1,10],ms:22000}];
    const maxR=api.mode==='normal'?6:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:220px"><div id="chC" style="text-align:center;font-size:20px;font-weight:600;line-height:1.7"></div></div>
      <form class="answer-bar" id="chF" autocomplete="off">
        <input class="answer-input" id="chI" inputmode="numeric" placeholder="Итог">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const ch=$('#chC',host),form=$('#chF',host),inp=$('#chI',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const c=cfg[Math.min(api.level,cfg.length)-1];
      let start=1+rnd(c.range[1]),ans=start;
      const steps=[];
      for(let i=0;i<c.len;i++){
        let op=pick(c.ops),n;
        if(op==='×'){n=2+rnd(6);}
        else if(op==='÷'){const dv=[2,3,4,5,6,7].filter(d=>ans%d===0);if(!dv.length){op=pick(['+','-']);n=1+rnd(c.range[1]);}else n=pick(dv);}
        else n=1+rnd(c.range[1]);
        steps.push({op,n});
        if(op==='+') ans+=n;else if(op==='-') ans-=n;else if(op==='×') ans*=n;else ans=Math.round(ans/n);
      }
      ch.innerHTML=`<div style="font-size:16px;color:var(--ink-soft);margin-bottom:10px">Старт: <b style="font-size:22px;color:var(--ink)">${start}</b></div>
        ${steps.map(s=>`<div style="font-size:18px">${s.op} ${s.n}</div>`).join('')}`;
      inp.value='';
      setTimeout(()=>inp.focus(),30);
      api.progress((r%10)/10);
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim());};
        const t=setTimeout(()=>fin(''),c.ms);
        api.onCancel(()=>{clearTimeout(t);fin('');});
      });
      if(api.cancelled) break;
      total++;
      const num=parseInt(v,10);
      const ok=num===ans;
      if(ok){correct++;api.ok();ch.innerHTML=`<div style="font-size:24px;color:var(--moss);font-weight:600">✅ ${ans}</div>`;}
      else{api.bad();ch.innerHTML=`<div style="font-size:24px;color:var(--rust);font-weight:600">❌ ${ans}</div>`;}
      if(!api.recordResult(ok)) break;
      await api.delay(800);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.compare={id:'compare',name:'Сравнение выражений',cat:'math',icon:'⚖️',tag:'Интуиция',
  about:'Что больше?',how:['Два выражения.','Выбери < = >.'],hint:'Округляй.',
  levels:['Суммы','Умножение','Смешан.','Проценты','Квадраты','Микс'],defaultLevel:1,
  async run(host,api){
    function gen(L){
      let la,ra,a,b;
      if(L===1){const a1=15+rnd(80),a2=15+rnd(80),b1=15+rnd(80),b2=15+rnd(80);la=`${a1}+${a2}`;ra=`${b1}+${b2}`;a=a1+a2;b=b1+b2;}
      else if(L===2){const a1=6+rnd(14),a2=4+rnd(12),b1=6+rnd(14),b2=4+rnd(12);la=`${a1}×${a2}`;ra=`${b1}×${b2}`;a=a1*a2;b=b1*b2;}
      else if(L===3){const a1=8+rnd(20),a2=4+rnd(12),a3=5+rnd(20),b1=8+rnd(20),b2=4+rnd(12),b3=5+rnd(20);la=`${a1}×${a2}+${a3}`;ra=`${b1}×${b2}+${b3}`;a=a1*a2+a3;b=b1*b2+b3;}
      else if(L===4){const pa=pick([15,20,25,30,35,40,45,60,75]),na=pick([40,80,120,160,200,240,300,400]),pb=pick([15,20,25,30,35,40,45,60,75]),nb=pick([40,80,120,160,200,240,300,400]);la=`${pa}% от ${na}`;ra=`${pb}% от ${nb}`;a=pa*na/100;b=pb*nb/100;}
      else if(L===5){const t=rnd(2);if(t===0){const a1=6+rnd(20),b1=6+rnd(20),b2=4+rnd(12);la=`${a1}²`;ra=`${b1}×${b2}`;a=a1*a1;b=b1*b2;}else{const sq1=[144,169,196,225,256,289,324,361,400][rnd(9)],sq2=[144,169,196,225,256,289,324,361,400][rnd(9)];const m1=4+rnd(12),m2=4+rnd(12);la=`√${sq1}×${m1}`;ra=`√${sq2}×${m2}`;a=Math.sqrt(sq1)*m1;b=Math.sqrt(sq2)*m2;}}
      else{const t=rnd(3);if(t===0){const a1=8+rnd(15),a2=6+rnd(15),a3=4+rnd(10),b1=8+rnd(15),b2=6+rnd(15),b3=4+rnd(10);la=`${a1}×${a2}−${a3}`;ra=`${b1}×${b2}−${b3}`;a=a1*a2-a3;b=b1*b2-b3;}else if(t===1){const pa=pick([12,18,22,28,32,38]),na=pick([150,250,350,450,550,650]),b1=8+rnd(15),b2=4+rnd(12),b3=5+rnd(20);la=`${pa}% от ${na}`;ra=`${b1}×${b2}+${b3}`;a=pa*na/100;b=b1*b2+b3;}else{const a1=3+rnd(6),a2=2+rnd(4),a3=3+rnd(8),b1=3+rnd(6),b2=2+rnd(4),b3=3+rnd(8);la=`${a1}³+${a3}`;ra=`${b1}²×${b2}+${b3}`;a=a1**3+a3;b=b1*b1*b2+b3;}}
      return {la,ra,a,b};
    }
    const maxR=api.mode==='normal'?15:9999;
    host.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px">
      <div class="card" style="text-align:center;padding:24px 12px;margin:0;font-size:17px;font-weight:600" id="cmpL">—</div>
      <div class="card" style="text-align:center;padding:24px 12px;margin:0;font-size:17px;font-weight:600" id="cmpR">—</div>
    </div>
    <div class="pad" style="grid-template-columns:repeat(3,1fr)">
      <button class="pad-btn" data-v="lt" type="button" style="font-size:22px">&lt;</button>
      <button class="pad-btn" data-v="eq" type="button" style="font-size:22px">=</button>
      <button class="pad-btn" data-v="gt" type="button" style="font-size:22px">&gt;</button>
    </div>`;
    const lEl=$('#cmpL',host),rEl=$('#cmpR',host),btns=$$('.pad-btn',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const p=gen(api.level);
      lEl.textContent=p.la;rEl.textContent=p.ra;
      lEl.classList.remove('pop');rEl.classList.remove('pop');
      void lEl.offsetWidth;lEl.classList.add('pop');rEl.classList.add('pop');
      api.progress((r%15)/15);
      const ans=await new Promise(resolve=>{
        let done=false;
        const fin=v=>{if(done)return;done=true;btns.forEach(b=>{b.onclick=null;});resolve(v);};
        btns.forEach(b=>b.onclick=()=>fin(b.dataset.v));
        const t=setTimeout(()=>fin(null),12000);
        api.onCancel(()=>{clearTimeout(t);fin(null);});
      });
      if(api.cancelled) break;
      total++;
      const trueVal=p.a>p.b?'gt':p.a<p.b?'lt':'eq';
      const ok=ans===trueVal;
      if(ok){correct++;api.ok();}else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(600);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.percent={id:'percent',name:'Проценты и доли',cat:'math',icon:'💯',tag:'Практика',
  about:'Скидки, проценты, доли.',how:['Задача.','Введи ответ.'],hint:'15% = 10%+5%.',
  levels:['15–25%','Дроби','30–45%','Смешан.','Сложные','Скидки+'],defaultLevel:1,
  async run(host,api){
    function gen(L){
      let text,ans;
      if(L===1){const p=pick([15,25,20]),n=pick([80,120,160,200,240,320]);text=`${p}% от ${n}`;ans=p/100*n;}
      else if(L===2){const n=pick([12,16,20,24,28,32,40,60,80,120]),d=pick([3,4,5,6,8,10,12]);const num=d===3?2:d===4?3:d===5?2:d===6?5:d===8?3:d===10?7:5;ans=num/d*(n*d/2);text=`${num}/${d} от ${n*d/2}`;}
      else if(L===3){const p=pick([30,35,40,45,55,65]),n=pick([120,160,200,240,320,400,500]);text=`${p}% от ${n}`;ans=p/100*n;}
      else if(L===4){const t=rnd(3);if(t===0){const p=pick([12,18,22,28,32]),n=pick([150,250,350,450,550]);text=`${p}% от ${n}`;ans=p/100*n;}else if(t===1){const n=pick([24,36,48,60,72]),d=pick([6,8,9,12]);const num=d===6?5:d===8?7:d===9?4:11;ans=num/d*n;text=`${num}/${d} от ${n}`;}else{const price=pick([240,360,480,600,840,1200]),pct=pick([12,18,22,28]);text=`Скидка ${pct}% на ${price}₽`;ans=price*(1-pct/100);}}
      else if(L===5){const t=rnd(3);if(t===0){const p=pick([7,13,17,23,37,47]),n=pick([200,300,400,600,800]);text=`${p}% от ${n}`;ans=p/100*n;}else if(t===1){const base=pick([1200,1800,2400,3600]),inc=pick([8,12,15,22]);text=`${base}₽ + ${inc}%`;ans=base*(1+inc/100);}else{const price=pick([2400,3600,4800]),d1=pick([10,15,20]),d2=pick([5,10,15]);text=`${price}₽, скидки ${d1}% и ${d2}%`;ans=price*(1-d1/100)*(1-d2/100);}}
      else{const t=rnd(4);if(t===0){const price=pick([800,1200,1600,2400]),d=pick([15,20,25,30]),tax=pick([8,10,12]);text=`${price}₽, −${d}%, +${tax}%`;ans=price*(1-d/100)*(1+tax/100);}else if(t===1){const p=pick([13,17,23,29,37]),n=pick([160,240,320,480,640]);text=`${p}% от ${n}`;ans=p/100*n;}else if(t===2){const total=pick([1000,1500,2000,2500]),p1=pick([20,25,30,35]),p2=pick([15,20,25]);text=`${p1}%+${p2}% от ${total}`;ans=total*(p1+p2)/100;}else{const price=pick([600,900,1200,1800]),up=pick([12,18,24]),down=pick([10,15,20]);text=`${price}₽ → +${up}% → −${down}%`;ans=price*(1+up/100)*(1-down/100);}}
      return {text,ans};
    }
    const maxR=api.mode==='normal'?12:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:150px"><div class="stim text" id="pcT" style="font-size:clamp(18px,5.5vw,28px);text-align:center;line-height:1.4">—</div></div>
      <form class="answer-bar" id="pcF" autocomplete="off">
        <input class="answer-input" id="pcI" inputmode="decimal" placeholder="Ответ">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const task=$('#pcT',host),form=$('#pcF',host),inp=$('#pcI',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const p=gen(api.level);
      task.textContent=p.text;
      task.classList.remove('pop');void task.offsetWidth;task.classList.add('pop');
      inp.value='';
      setTimeout(()=>inp.focus(),30);
      api.progress((r%12)/12);
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim());};
        api.onCancel(()=>fin(''));
      });
      if(api.cancelled) break;
      total++;
      const num=parseFloat(v.replace(',','.'));
      const ok=Math.abs(num-p.ans)<.5;
      if(ok){correct++;api.ok();task.textContent='✅ '+Math.round(p.ans*100)/100;}
      else{api.bad();task.textContent='❌ '+Math.round(p.ans*100)/100;}
      if(!api.recordResult(ok)) break;
      await api.delay(700);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.anagram={id:'anagram',name:'Анаграммы',cat:'logic',icon:'🔤',tag:'Скорость',
  about:'Собери слово.',how:['Перемешанные буквы.','Собери слово.'],hint:'Начни с гласных.',
  levels:['6 букв','7','8','9','10','12+'],defaultLevel:1,
  async run(host,api){
    const W={1:['КАРТИНА','ЗЕРКАЛО','ВОЛШЕБНО','МЫШЛЕНИЕ','РАДУГА'],
      2:['ТВОРЧЕСТВО','ИНТУИЦИЯ','СКОРОСТЬ','ВНИМАНИЕ','СОЗНАНИЕ'],
      3:['ВДОХНОВЕНИЕ','ВООБРАЖЕНИЕ','ПРИКЛЮЧЕНИЕ','ПРОСТРАНСТВО'],
      4:['МНОГООБРАЗИЕ','ВЗАИМОДЕЙСТВИЕ','ПРЕДСТАВЛЕНИЕ','ИССЛЕДОВАНИЕ'],
      5:['ПРОГРАММИРОВАНИЕ','ВЗАИМОПОНИМАНИЕ','СОВЕРШЕНСТВОВАНИЕ'],
      6:['АБСТРАГИРОВАНИЕ','ПЕРЕОСМЫСЛЕНИЕ','СИСТЕМАТИЗАЦИЯ']};
    const maxR=api.mode==='normal'?8:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:130px"><div class="stim text" id="anS" style="font-size:clamp(18px,5.5vw,28px);letter-spacing:.14em">—</div></div>
      <form class="answer-bar" id="anF" autocomplete="off">
        <input class="answer-input" id="anI" placeholder="Слово" style="font-size:16px;text-transform:uppercase">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const scr=$('#anS',host),form=$('#anF',host),inp=$('#anI',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const pool=W[Math.min(api.level,6)]||W[1];const w=pick(pool);
      let s=shuffle(w.split('')).join('');
      if(s===w) s=shuffle(w.split('')).join('');
      scr.textContent=s.split('').join(' ');
      scr.classList.remove('pop');void scr.offsetWidth;scr.classList.add('pop');
      inp.value='';
      setTimeout(()=>inp.focus(),30);
      api.progress((r%10)/10);
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim().toUpperCase());};
        api.onCancel(()=>fin(''));
      });
      if(api.cancelled) break;
      total++;
      const ok=v===w;
      if(ok){correct++;api.ok();scr.textContent='✅ '+w;}
      else{api.bad();scr.textContent='❌ '+w;}
      if(!api.recordResult(ok)) break;
      await api.delay(600);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.sequence={id:'sequence',name:'Последовательности',cat:'logic',icon:'🔗',tag:'Мышление',
  about:'Найди закономерность.',how:['Ряд чисел.','Определи.','Введи след.'],hint:'Разности, отношения.',
  levels:['Смеш.','Ступ.','Фибоначчи','Нелин.','Степени','Микс'],defaultLevel:1,
  async run(host,api){
    function gen(L){
      const types={1:['arith','square'],2:['step','geom'],3:['fib','step'],4:['mix','power'],5:['power','prime'],6:['mix','power','prime','interleave']}[L];
      const t=pick(types);let arr,next;
      if(t==='arith'){const a=1+rnd(20);const d=(pick([-1,1]))*(2+rnd(12));arr=[a,a+d,a+2*d,a+3*d];next=a+4*d;}
      else if(t==='geom'){const a=1+rnd(6);const r=2+rnd(L>=4?4:3);arr=[a,a*r,a*r*r,a*r**3];next=a*r**4;}
      else if(t==='square'){const s=2+rnd(8);arr=[s,s+1,s+2,s+3].map(x=>x*x);next=(s+4)**2;}
      else if(t==='fib'){const a=1+rnd(8),b=a+1+rnd(8);arr=[a,b];for(let i=0;i<3;i++)arr.push(arr[arr.length-1]+arr[arr.length-2]);next=arr[arr.length-1]+arr[arr.length-2];}
      else if(t==='step'){let a=1+rnd(10),d=1+rnd(5);const step=2+rnd(5);arr=[a];for(let i=0;i<3;i++){a+=d;arr.push(a);d+=step;}next=a+d;}
      else if(t==='prime'){const P=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47];const s=rnd(7);arr=P.slice(s,s+4);next=P[s+4];}
      else if(t==='mix'){const a=1+rnd(6),mul=2+rnd(4),add=pick([-4,-3,-2,-1,1,2,3,4]);arr=[a];for(let i=0;i<3;i++)arr.push(arr[arr.length-1]*mul+add);next=arr[arr.length-1]*mul+add;}
      else if(t==='power'){const s=2+rnd(3);arr=[s,s**2,s**3,s**4];next=s**5;}
      else{const a=1+rnd(15),b=80+rnd(40);arr=[a,b,a+4,b-4,a+8,b-8];next=a+12;}
      return {arr,next};
    }
    const maxR=api.mode==='normal'?8:9999;
    host.innerHTML=`<div class="stim-stage" style="min-height:130px"><div class="stim text" id="sqT" style="font-size:clamp(16px,5vw,26px)">—</div></div>
      <form class="answer-bar" id="sqF" autocomplete="off">
        <input class="answer-input" id="sqI" inputmode="numeric" placeholder="?">
        <button class="btn btn-primary" type="submit">✓</button>
      </form>`;
    const task=$('#sqT',host),form=$('#sqF',host),inp=$('#sqI',host);
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const p=gen(api.level);
      task.textContent=p.arr.join(' · ')+' · ?';
      task.classList.remove('pop');void task.offsetWidth;task.classList.add('pop');
      inp.value='';
      setTimeout(()=>inp.focus(),30);
      api.progress((r%10)/10);
      const v=await new Promise(resolve=>{
        let done=false;
        const fin=val=>{if(done)return;done=true;form.onsubmit=null;resolve(val);};
        form.onsubmit=e=>{e.preventDefault();fin(inp.value.trim());};
        api.onCancel(()=>fin(''));
      });
      if(api.cancelled) break;
      total++;
      const ok=Math.abs(parseFloat(v)-p.next)<.001;
      if(ok){correct++;api.ok();task.textContent='✅ '+p.next;}
      else{api.bad();task.textContent='❌ '+p.next;}
      if(!api.recordResult(ok)) break;
      await api.delay(650);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.sudoku={id:'sudoku',name:'Судоку 4×4',cat:'logic',icon:'🔲',tag:'Логика',
  about:'Заполни цифрами 1–4.',how:['Выбери клетку.','Выбери цифру.','Заполни всё.'],
  hint:'Строка, столбец, блок.',levels:['5','6','7','8','9','10'],defaultLevel:1,
  async run(host,api){
    function genBase(){const base=[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]];const dm=shuffle([1,2,3,4]);return base.map(r=>r.map(v=>dm[v-1]));}
    function safe(g,r,c,v){
      for(let i=0;i<4;i++) if(g[r][i]===v||g[i][c]===v) return false;
      const br=Math.floor(r/2)*2,bc=Math.floor(c/2)*2;
      for(let rr=br;rr<br+2;rr++) for(let cc=bc;cc<bc+2;cc++) if(g[rr][cc]===v) return false;
      return true;
    }
    function solve(g){
      for(let r=0;r<4;r++) for(let c=0;c<4;c++){
        if(g[r][c]===0){for(let v=1;v<=4;v++){if(safe(g,r,c,v)){g[r][c]=v;if(solve(g))return true;g[r][c]=0;}}return false;}
      }
      return true;
    }
    const maxR=api.mode==='normal'?4:9999;
    const hb=[5,6,7,8,9,10];
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const holes=hb[Math.min(api.level,hb.length)-1];
      const full=genBase();solve(full);
      const puzzle=full.map(r=>r.slice());
      const positions=shuffle([...Array(16).keys()]).slice(0,holes);
      positions.forEach(p=>{puzzle[Math.floor(p/4)][p%4]=0;});
      let solvedOK=true;
      const ug=puzzle.map(r=>r.slice());
      host.innerHTML=`<div class="grid" id="sdG" style="grid-template-columns:repeat(4,1fr);max-width:320px">
          ${puzzle.flatMap((row,ri)=>row.map((v,ci)=>`<div class="cell ${v?'locked':''}" data-r="${ri}" data-c="${ci}" style="font-size:28px">${v||''}</div>`)).join('')}
        </div>
        <div class="pad" id="sdP" style="grid-template-columns:repeat(4,1fr);max-width:320px;margin-top:16px">
          ${[1,2,3,4].map(n=>`<button class="pad-btn" data-n="${n}" type="button" style="min-height:56px;font-size:22px">${n}</button>`).join('')}
        </div>
        <p class="muted" id="sdH" style="text-align:center;margin-top:12px;font-size:12.5px">Выбери клетку, потом цифру</p>`;
      const grid=$('#sdG',host),pad=$('#sdP',host),hint=$('#sdH',host);
      let sel=null;
      const cells=$$('.cell',grid);
      cells.forEach(cell=>{
        cell.onclick=()=>{
          if(cell.classList.contains('locked')) return;
          cells.forEach(c=>c.style.borderColor='');
          cell.style.borderColor='var(--moss)';
          sel=cell;SFX.tap();
        };
      });
      let filled=holes;
      await new Promise(resolve=>{
        $$('.pad-btn',pad).forEach(btn=>{
          btn.onclick=()=>{
            if(!sel||api.cancelled) return;
            const n=+btn.dataset.n;
            const rr=+sel.dataset.r,cc=+sel.dataset.c;
            if(safe(ug,rr,cc,n)){ug[rr][cc]=n;sel.textContent=n;sel.classList.remove('bad');sel.classList.add('ok');SFX.ok();buzz(8);}
            else{ug[rr][cc]=n;sel.textContent=n;sel.classList.add('bad');SFX.err();flash('bad');solvedOK=false;}
            filled--;
            if(filled===0) resolve();
          };
        });
        api.onCancel(resolve);
      });
      cells.forEach((cell,i)=>{
        const rr=Math.floor(i/4),cc=i%4;
        if(puzzle[rr][cc]===0){
          if(ug[rr][cc]===full[rr][cc]){cell.classList.add('ok');cell.classList.remove('bad');}
          else{cell.classList.add('bad');cell.classList.remove('ok');}
        }
      });
      hint.textContent=solvedOK?'✅ Верно':'❌ Есть ошибки';
      total++;
      if(solvedOK){correct++;api.ok();}else api.bad();
      if(!api.recordResult(solvedOK)) break;
      await api.delay(900);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.magic={id:'magic',name:'Магический квадрат',cat:'logic',icon:'✨',tag:'Логика',
  about:'Сумма каждой линии = 15.',how:['Даны числа.','Расставь.','Сумма = 15.'],
  hint:'Центр — 5.',levels:['4','5','6','7','8','8 сложн.'],defaultLevel:1,
  async run(host,api){
    function mk(){const base=[[4,9,2],[3,5,7],[8,1,6]];const ops=rnd(8);let m=base.map(r=>r.slice());
      const rot=g=>g[0].map((_,i)=>g.map(r=>r[i]).reverse());
      const mir=g=>g.map(r=>r.slice().reverse());
      for(let i=0;i<ops%4;i++) m=rot(m);
      if(ops>=4) m=mir(m);
      return m;}
    const maxR=api.mode==='normal'?5:9999;
    const hb=[4,5,6,7,8,8];
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const holes=Math.min(hb[Math.min(api.level,hb.length)-1],8);
      const full=mk();
      const puzzle=full.map(r=>r.slice());
      const positions=shuffle([...Array(9).keys()]).slice(0,holes);
      positions.forEach(p=>{puzzle[Math.floor(p/3)][p%3]=0;});
      const used=new Set();puzzle.flat().forEach(v=>v&&used.add(v));
      const avail=[1,2,3,4,5,6,7,8,9].filter(v=>!used.has(v));
      host.innerHTML=`<p class="muted" style="text-align:center;margin-bottom:14px">Сумма каждой линии = 15</p>
        <div class="grid" id="mgG" style="grid-template-columns:repeat(3,1fr);max-width:300px;gap:6px">
          ${puzzle.flatMap((row,ri)=>row.map((v,ci)=>`<div class="cell ${v?'locked':''}" data-r="${ri}" data-c="${ci}" style="font-size:26px;aspect-ratio:1;min-height:60px">${v||''}</div>`)).join('')}
        </div>
        <div class="pad" id="mgP" style="grid-template-columns:repeat(4,1fr);max-width:320px;margin-top:16px">
          ${avail.map(n=>`<button class="pad-btn" data-n="${n}" type="button" style="min-height:52px;font-size:18px">${n}</button>`).join('')}
        </div>`;
      const grid=$('#mgG',host),pad=$('#mgP',host);
      const cells=$$('.cell',grid);
      const ug=puzzle.map(r=>r.slice());
      let sel=null;
      cells.forEach(cell=>{
        cell.onclick=()=>{
          if(cell.classList.contains('locked')) return;
          cells.forEach(c=>c.style.borderColor='');
          cell.style.borderColor='var(--moss)';
          sel=cell;SFX.tap();
        };
      });
      let remaining=holes;
      await new Promise(resolve=>{
        $$('.pad-btn',pad).forEach(btn=>{
          btn.onclick=()=>{
            if(!sel||api.cancelled||btn.disabled) return;
            const n=+btn.dataset.n;
            const rr=+sel.dataset.r,cc=+sel.dataset.c;
            ug[rr][cc]=n;sel.textContent=n;
            sel.style.color='var(--moss)';
            btn.disabled=true;btn.style.opacity=.3;
            SFX.tap();buzz(6);remaining--;
            if(remaining===0) resolve();
          };
        });
        api.onCancel(resolve);
      });
      const rowS=[0,1,2].map(rr=>ug[rr].reduce((a,b)=>a+b,0));
      const colS=[0,1,2].map(cc=>ug.reduce((a,row)=>a+row[cc],0));
      const d1=ug[0][0]+ug[1][1]+ug[2][2];
      const d2=ug[0][2]+ug[1][1]+ug[2][0];
      const ok=rowS.every(s=>s===15)&&colS.every(s=>s===15)&&d1===15&&d2===15;
      cells.forEach((cell,i)=>{
        if(puzzle[Math.floor(i/3)][i%3]===0) cell.classList.add(ok?'ok':'bad');
      });
      total++;
      if(ok){correct++;api.ok();}else api.bad();
      if(!api.recordResult(ok)) break;
      await api.delay(900);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

EX.signs={id:'signs',name:'Расставь знаки',cat:'logic',icon:'➕',tag:'Гибкость',
  about:'Расставь знаки, чтобы получить цель.',how:['Числа и цель.','Меняй знаки.','Проверь.'],
  hint:'× и ÷ считаются раньше + и −.',levels:['4 · +−','4 · все','5 · +−','5 · все','6 · все','6 · сложн.'],defaultLevel:1,
  async run(host,api){
    function compute(nums,ops){
      const n=nums.slice(),o=ops.slice();
      for(let i=0;i<o.length;i++){
        if(o[i]==='*'||o[i]==='/'){
          const v=o[i]==='*'?n[i]*n[i+1]:n[i]/n[i+1];
          n[i]=v;n.splice(i+1,1);o.splice(i,1);i--;
        }
      }
      let v=n[0];
      for(let i=0;i<o.length;i++){v=o[i]==='+'?v+n[i+1]:v-n[i+1];}
      return v;
    }
    function gen(L){
      const len=L<=2?4:L<=4?5:6;
      const ops=L===1||L===3?['+','-']:['+','-','*','/'];
      for(let a=0;a<500;a++){
        const nums=Array.from({length:len},()=>1+rnd(9));
        const expr=[];
        for(let i=0;i<len-1;i++) expr.push(pick(ops));
        const val=compute(nums,expr);
        if(Number.isInteger(val)&&Math.abs(val)<=200&&val!==0) return {nums,ops:expr,target:val};
      }
      return {nums:[3,4,5,6],ops:['+','+','+'],target:18};
    }
    const maxR=api.mode==='normal'?6:9999;
    const D={'+':'+','-':'−','*':'×','/':'÷'};
    let correct=0,total=0;
    for(let r=0;r<maxR;r++){
      if(api.cancelled) break;
      const puzzle=gen(api.level);
      const {nums,target}=puzzle;
      const useAll=!(api.level===1||api.level===3);
      const userOps=new Array(nums.length-1).fill('+');
      host.innerHTML=`<p class="muted" style="text-align:center;margin-bottom:14px">Получи <b style="color:var(--moss);font-size:20px">${target}</b></p>
        <div id="sgEq" class="signs-eq"></div>
        <p class="muted" style="text-align:center;margin-top:12px;font-size:12.5px">Нажимай на знаки. Считай сам.</p>
        <button class="btn btn-primary btn-full btn-lg" id="sgCheck" type="button" style="margin-top:18px">Проверить</button>`;
      const eq=$('#sgEq',host);
      const refresh=()=>{
        let s='';
        for(let i=0;i<nums.length;i++){
          s+=`<b>${nums[i]}</b>`;
          if(i<nums.length-1) s+=`<span class="op-slot" data-i="${i}">${D[userOps[i]]}</span>`;
        }
        eq.innerHTML=s;
        $$('.op-slot',eq).forEach(slot=>{
          slot.onclick=()=>{
            const i=+slot.dataset.i;
            const cycle=useAll?['+','-','*','/']:['+','-'];
            const idx=cycle.indexOf(userOps[i]);
            userOps[i]=cycle[(idx+1)%cycle.length];
            SFX.tap();buzz(6);refresh();
          };
        });
      };
      refresh();
      api.progress((r%10)/10);
      await new Promise(resolve=>{
        $('#sgCheck',host).onclick=()=>{SFX.tap();buzz(10);resolve();};
        api.onCancel(resolve);
      });
      if(api.cancelled) break;
      const result=compute(nums,userOps);
      const ok=Math.abs(result-target)<.001;
      total++;
      if(ok){correct++;api.ok();}else api.bad();
      eq.innerHTML+=`<div style="margin-top:14px;font-size:15px;font-family:'IBM Plex Sans',sans-serif;color:${ok?'var(--moss)':'var(--rust)'}">
        ${ok?'✅ Верно!':`❌ Твой ответ: ${result}, нужно: ${target}`}
      </div>`;
      if(!api.recordResult(ok)) break;
      await api.delay(1400);
    }
    if(api.cancelled) return;
    const acc=total?Math.round(correct/total*100):0;
    api.finish({acc,rt:0,level:api.level,detail:{'Верно':`${correct}/${total}`}});
  }};

const EX_LIST=Object.values(EX);

function createApi(refs,level,mode){
  const api={
    level,mode,cancelled:false,paused:false,
    streak:0,score:0,rounds:0,_handlers:[],_intervals:new Set(),
    onCancel(fn){
      if(api.cancelled){fn();return ()=>{};}
      api._handlers.push(fn);
      return ()=>{const i=api._handlers.indexOf(fn);if(i>=0)api._handlers.splice(i,1);};
    },
    cancel(){
      if(api.cancelled) return;
      api.cancelled=true;
      api._intervals.forEach(id=>clearInterval(id));
      api._intervals.clear();
      const hs=api._handlers.slice();api._handlers=[];
      hs.forEach(fn=>{try{fn();}catch(e){}});
    },
    pause(){api.paused=true;},
    resume(){api.paused=false;},
    delay(ms){
      return new Promise(resolve=>{
        if(api.cancelled) return resolve();
        let el=0;const STEP=50;
        const t=setInterval(()=>{
          if(api.cancelled){clearInterval(t);api._intervals.delete(t);return resolve();}
          if(api.paused) return;
          el+=STEP;
          if(el>=ms){clearInterval(t);api._intervals.delete(t);resolve();}
        },STEP);
        api._intervals.add(t);
        api.onCancel(()=>{clearInterval(t);api._intervals.delete(t);resolve();});
      });
    },
    raceAnswer(el,timeoutMs){
      return new Promise(resolve=>{
        if(api.cancelled) return resolve(TIMEOUT);
        let done=false,el2=0;const STEP=50;
        const fin=v=>{
          if(done) return;done=true;
          el.removeEventListener('click',onClick);
          el.removeEventListener('touchstart',onTouch);
          clearInterval(t);
          api._intervals.delete(t);
          unreg();
          resolve(v);
        };
        const onClick=e=>{if(api.cancelled||api.paused) return;e.preventDefault();SFX.tap();buzz(8);fin('clicked');};
        const onTouch=e=>{if(api.cancelled||api.paused) return;SFX.tap();buzz(8);fin('clicked');};
        el.addEventListener('click',onClick);
        el.addEventListener('touchstart',onTouch,{passive:true});
        const t=setInterval(()=>{
          if(done) return;
          if(api.cancelled||api.paused) return;
          el2+=STEP;
          if(el2>=timeoutMs) fin(TIMEOUT);
        },STEP);
        api._intervals.add(t);
        const unreg=api.onCancel(()=>fin(TIMEOUT));
      });
    },
    progress(p){refs.progress(clamp(p,0,1));},
    ok(){refs.feedback('ok');},
    bad(){refs.feedback('bad');},
    hud(html){refs.hud(html);},
    finish(r){refs.finish(r);},
    recordResult(isCorrect){
      api.rounds++;
      if(isCorrect){
        api.streak++;api.score++;
        if(api.mode!=='normal'&&api.streak>0&&api.streak%STREAK_TO_LEVELUP===0&&api.level<6){
          api.level++;
          refs.onLevelUp(api.level);
        }
        return true;
      }
      api.streak=0;
      return api.mode!=='survival';
    }
  };
  return api;
}
window.__queue=[];
function startQueue(ids){window.__queue=ids.slice();nextInQueue();}
function nextInQueue(){
  if(!window.__queue.length){go('brain');return;}
  const id=window.__queue.shift();
  const ex=EX[id];
  if(!ex){nextInQueue();return;}
  const level=getEffectiveLevel(id,ex);
  const man=(S.neurofit.manualDiff[id]||0)>0;
  const mode=S.neurofit.preferredMode||'normal';
  const rec=S.neurofit.records[id]||{};
  openModal(`
    <div class="modal-handle"></div>
    <div style="font-size:44px;text-align:center;margin-bottom:8px">${ex.icon}</div>
    <div class="h2" style="text-align:center;font-size:22px;margin-bottom:6px">${esc(ex.name)}</div>
    <p class="muted" style="text-align:center;margin-bottom:18px">${esc(ex.about)}</p>
    <div class="tiny" style="margin-bottom:10px">Режим</div>
    <div class="mode-grid">
      ${Object.keys(MODES).map(k=>{
        const m=MODES[k];const r=rec[k];
        return `<button class="mode-opt ${mode===k?'on':''}" data-mode="${k}" type="button">
          <span class="mode-em">${m.emoji}</span>
          <span class="mode-body">
            <span class="mode-title">${esc(m.name)}</span>
            <span class="mode-desc">${esc(m.desc)}</span>
            ${r&&r.score?`<span class="mode-best">🏆 Рекорд: ${r.score}</span>`:''}
          </span>
        </button>`;
      }).join('')}
    </div>
    <div style="padding:12px 14px;border-radius:var(--r);background:var(--paper);border:1px solid var(--line);margin-bottom:18px">
      <div class="tiny" style="margin-bottom:4px">Сложность</div>
      <div style="font-size:14px;font-weight:600">${LEVEL_NAMES[level-1]} — ${esc(ex.levels[level-1])}</div>
      <div class="muted" style="font-size:11.5px;margin-top:3px">${man?'Вручную':'Адаптивная'}</div>
    </div>
    <button class="btn btn-primary btn-full btn-lg" id="exGo" type="button">Начать</button>
    <button class="btn btn-ghost btn-full" id="exHint" type="button" style="margin-top:10px">Подсказка</button>`,m=>{
    let chosen=mode;
    $$('[data-mode]',m).forEach(b=>{
      b.onclick=()=>{
        chosen=b.dataset.mode;
        $$('[data-mode]',m).forEach(x=>x.classList.toggle('on',x.dataset.mode===chosen));
        S.neurofit.preferredMode=chosen;saveState();
        SFX.tap();buzz(6);
      };
    });
    $('#exGo',m).onclick=()=>{closeModal(m);ensureAudio();buzz(10);setTimeout(()=>runExercise(ex,level,chosen),120);};
    $('#exHint',m).onclick=()=>{closeModal(m);setTimeout(()=>openHintModal(ex,()=>runExercise(ex,level,chosen)),100);};
  });
}
function getEffectiveLevel(id,ex){
  const man=S.neurofit.manualDiff[id]||0;
  if(man>0) return clamp(man,1,ex.levels.length);
  return clamp(S.neurofit.levels[id]||ex.defaultLevel,1,ex.levels.length);
}
function setRecord(id,mode,data){
  if(!S.neurofit.records[id]) S.neurofit.records[id]={};
  const cur=S.neurofit.records[id][mode];
  const better=!cur||(data.score||0)>(cur.score||0);
  if(better) S.neurofit.records[id][mode]=data;
  saveState();
  return better;
}
function runExercise(ex,level,mode){
  $('#nav').classList.add('hidden');
  const host=$('#screens');host.innerHTML='';
  const md=MODES[mode];
  const screen=document.createElement('div');
  screen.className='screen active';
  screen.innerHTML=`
    <header class="ex-head">
      <button class="icon-btn" id="exExit" type="button">✕</button>
      <div class="ex-title">${ex.icon} ${esc(ex.name)}</div>
      <button class="icon-btn" id="exHelp" type="button">?</button>
    </header>
    ${mode!=='normal'?`<div class="mode-banner ${mode}">${md.emoji} ${esc(md.name)}</div>`:''}
    <div class="ex-bar"><i id="exBar"></i></div>
    <div class="ex-hud" id="exHud">${mode!=='normal'?`
      <span class="hud-pill moss">Очки <b id="hudScore">0</b></span>
      <span class="hud-pill gold">🔥 <b id="hudStreak">0</b></span>
      <span class="hud-pill">Ур. <b id="hudLevel">${level}</b></span>
    `:''}</div>
    <div class="ex-host" id="exHost"></div>`;
  host.appendChild(screen);
  const barEl=$('#exBar',screen);
  const hudEl=$('#exHud',screen);
  const exHost=$('#exHost',screen);
  const refs={
    progress(p){barEl.style.transform=`scaleX(${p})`;},
    feedback(kind){
      if(kind==='ok'){SFX.ok();flash('ok');}
      else{SFX.err();flash('bad');buzz(12);}
    },
    hud(html){hudEl.innerHTML=html;},
    onLevelUp(nl){
      SFX.levelup();flash('levelup');buzz([10,30,10]);
      toast(`🚀 Уровень ${nl}! ${LEVEL_NAMES[nl-1]}`,2000,'gold');
      const hl=$('#hudLevel');if(hl) hl.textContent=nl;
    },
    finish(r){onFinish(r);}
  };
  const api=createApi(refs,level,mode);
  const t0=Date.now();
  let finished=false;
  const updateHud=()=>{
    const sc=$('#hudScore');if(sc) sc.textContent=api.score;
    const st=$('#hudStreak');if(st) st.textContent=api.streak;
    const lv=$('#hudLevel');if(lv) lv.textContent=api.level;
  };
  const oK=api.ok,oB=api.bad;
  api.ok=()=>{oK();updateHud();};
  api.bad=()=>{oB();updateHud();};
  function cleanup(){api.cancel();window.__exCleanup=null;}
  function onFinish(result){
    if(finished) return;
    finished=true;
    const ms=Date.now()-t0;
    cleanup();
    setTimeout(()=>finishSession(ex,result,ms,api),40);
  }
  $('#exHelp',screen).onclick=()=>{api.pause();openHintModal(ex,()=>{api.resume();});};
  $('#exExit',screen).onclick=()=>{
    api.pause();
    openPauseModal(ex,
      ()=>{cleanup();window.__queue=[];setTimeout(()=>go('brain'),80);},
      ()=>{api.resume();}
    );
  };
  window.__exCleanup=cleanup;
  Promise.resolve().then(()=>ex.run(exHost,api)).catch(err=>{
    console.error(err);
    if(!finished) onFinish({acc:0,rt:0,level:api.level,detail:{'Ошибка':String(err).slice(0,60)}});
  });
}
function openPauseModal(ex,onExit,onResume){
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:4px">Пауза</div>
    <p class="muted" style="margin-bottom:22px">${esc(ex.name)}</p>
    <button class="btn btn-primary btn-full btn-lg" id="pzRes" type="button">Продолжить</button>
    <button class="btn btn-ghost btn-full btn-danger" id="pzQuit" type="button" style="margin-top:10px">Завершить</button>`,m=>{
    $('#pzRes',m).onclick=()=>{closeModal(m);if(onResume) onResume();};
    $('#pzQuit',m).onclick=()=>{closeModal(m);onExit();};
  });
}
function openHintModal(ex,onClose){
  openModal(`
    <div class="modal-handle"></div>
    <div class="row" style="margin-bottom:16px">
      <div style="font-size:36px">${ex.icon}</div>
      <div><div class="h2">${esc(ex.name)}</div><div class="muted" style="font-size:12.5px">${esc(ex.tag)}</div></div>
    </div>
    <div class="tiny" style="margin-bottom:10px">Как играть</div>
    <ol style="padding-left:20px;margin-bottom:18px">
      ${ex.how.map(h=>`<li style="margin-bottom:8px;font-size:14px;line-height:1.55">${esc(h)}</li>`).join('')}
    </ol>
    <div style="padding:14px 16px;border-radius:var(--r);background:var(--moss-soft);margin-bottom:20px">
      <div class="tiny" style="color:var(--moss);margin-bottom:6px">Подсказка</div>
      <p style="font-size:13.5px;line-height:1.6;color:var(--moss)">${esc(ex.hint)}</p>
    </div>
    <button class="btn btn-primary btn-full btn-lg" id="hOk" type="button">Продолжить</button>`,m=>{
    $('#hOk',m).onclick=()=>{closeModal(m);if(onClose) setTimeout(onClose,150);};
  });
}
function finishSession(ex,result,ms,api){
  const acc=clamp(Math.round(result.acc||0),0,100);
  const lvl=clamp(result.level||1,1,ex.levels.length);
  const rt=Math.round(result.rt||0);
  const man=(S.neurofit.manualDiff[ex.id]||0)>0;
  const mode=api.mode;
  let xp=12+Math.round(acc*0.35)+lvl*8;
  if(rt>0&&rt<700) xp+=8;
  if(mode!=='normal') xp+=Math.round(api.score*1.5);
  let leveled=false,dropped=false;
  if(mode==='normal'&&!man){
    let nl=lvl;
    if(acc>=82) nl=Math.min(6,lvl+1);
    else if(acc<55) nl=Math.max(1,lvl-1);
    if(nl>lvl){leveled=true;S.neurofit.levels[ex.id]=nl;}
    else if(nl<lvl){dropped=true;S.neurofit.levels[ex.id]=nl;}
    else S.neurofit.levels[ex.id]=lvl;
  }
  let newRec=false;
  if(mode!=='normal'){
    newRec=setRecord(ex.id,mode,{score:api.score,acc,level:api.level,date:todayKey()});
  }
  S.neurofit.xp+=xp;
  S.neurofit.totalSessions+=1;
  S.neurofit.todayCount+=1;
  S.neurofit.totalMs+=ms;
  S.neurofit.catTried[ex.cat]=true;
  S.neurofit.sessions.push({ex:ex.id,d:todayKey(),acc,rt,xp,lvl,mode,t:Date.now(),score:api.score});
  if(S.neurofit.sessions.length>250) S.neurofit.sessions=S.neurofit.sessions.slice(-250);
  refreshStreak();saveState();
  SFX.win();buzz([18,40,18]);
  renderResult(ex,{acc,rt,xp,lvl,detail:result.detail||{},leveled,dropped,ms,man,mode,
    score:api.score,streakMax:api.streak,levelReached:api.level,newRec});
}
function renderResult(ex,r){
  $('#nav').classList.add('hidden');
  const host=$('#screens');host.innerHTML='';
  const scr=document.createElement('div');
  scr.className='screen active';
  const accColor=r.acc>=85?'var(--moss)':r.acc>=60?'var(--amber)':'var(--rust)';
  const more=window.__queue.length>0;
  const li=levelInfo(S.neurofit.xp);
  const inf=r.mode!=='normal';
  scr.innerHTML=`
    <div class="result-hero">
      <div class="tiny" style="margin-bottom:10px">${ex.icon} ${esc(ex.name)}</div>
      ${inf?`
        <div class="result-score gold">${r.score}</div>
        <div class="muted" style="margin-top:8px">${r.mode==='survival'?'очков до ошибки':'очков набрано'}</div>
        ${r.newRec?`<div style="margin-top:12px"><span class="chip amber">🏆 Новый рекорд!</span></div>`:''}
      `:`
        <div class="result-score">+${r.xp} XP</div>
        <div class="muted" style="margin-top:8px">тренировка завершена</div>
      `}
    </div>
    <div class="card" style="padding:22px">
      <div class="result-num-row">
        <div class="result-num"><b style="color:${accColor}">${r.acc}%</b><span>точность</span></div>
        ${r.rt?`<div class="result-num-sep"></div>
        <div class="result-num"><b>${r.rt}<span style="font-size:14px;font-weight:500"> мс</span></b><span>реакция</span></div>`:''}
        <div class="result-num-sep"></div>
        <div class="result-num"><b>${Math.round(r.ms/1000)}<span style="font-size:14px;font-weight:500"> с</span></b><span>время</span></div>
      </div>
    </div>
    ${Object.keys(r.detail).length?`
    <div class="card">
      ${Object.entries(r.detail).map(([k,v])=>`<div class="res-row"><span class="muted">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>`:''}
    <div class="card">
      <div class="between" style="margin-bottom:10px">
        <span class="tiny">Уровень ${li.level}</span>
        <span class="tiny">+${r.xp} XP</span>
      </div>
      <div class="bar"><i class="on" style="--p:${li.pct.toFixed(3)}"></i></div>
    </div>
    <div style="margin-top:10px">
      ${more?`<button class="btn btn-primary btn-full btn-lg" id="rsNext" type="button">Следующее · ${window.__queue.length}</button>`:''}
      <button class="btn ${more?'btn-ghost':'btn-primary'} btn-full btn-lg" id="rsHome" type="button" style="${more?'margin-top:10px':''}">
        ${more?'Завершить':'К мозгу'}
      </button>
    </div>
    <div style="height:20px"></div>`;
  host.appendChild(scr);
  const nx=$('#rsNext',scr);if(nx) nx.onclick=()=>{SFX.tap();nextInQueue();};
  $('#rsHome',scr).onclick=()=>{SFX.tap();window.__queue=[];go('brain');};
}
function renderBrain(){
  const li=levelInfo(S.neurofit.xp);
  const cats=['memory','speed','math','logic'];
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="between" style="margin-bottom:18px">
      <div>
        <div class="tiny">УРОВЕНЬ ${li.level}</div>
        <div class="h1" style="margin-top:3px">Тренировка мозга</div>
      </div>
      <div class="chip moss" style="padding:8px 14px">🔥 <b>${S.neurofit.streak}</b></div>
    </div>
    <div class="hero" style="background:linear-gradient(155deg,#2A3A2F 0%,#1E2820 62%)">
      <div class="hero-inner">
        <div class="eyebrow">БЫСТРЫЙ СТАРТ</div>
        <div class="lead">Три упражнения подряд</div>
        <p class="why">Память, внимание, счёт — 5–7 минут.</p>
        <button class="btn btn-primary btn-lg" id="quickStart" type="button">▶ Начать</button>
      </div>
    </div>
    <div class="card">
      <div class="between" style="margin-bottom:10px">
        <div class="tiny">Уровень ${li.level} · ${li.into}/${li.need} XP</div>
        <div class="tiny">${S.neurofit.totalSessions} сессий</div>
      </div>
      <div class="bar"><i class="on" style="--p:${li.pct.toFixed(3)}"></i></div>
    </div>
    ${cats.map(cat=>{
      const list=EX_LIST.filter(e=>e.cat===cat);
      const cc=CATS[cat];
      if(!list.length) return '';
      return `
        <div class="cat-title"><span>${cc.icon}</span><span>${esc(cc.name)}</span></div>
        ${list.map(e=>{
          const lvl=getEffectiveLevel(e.id,e);
          const man=(S.neurofit.manualDiff[e.id]||0)>0;
          const rec=S.neurofit.records[e.id];
          const hr=rec&&(rec.survival||rec.endless);
          return `<button class="ex-item" data-ex="${e.id}" type="button">
            <div class="ex-ico">${e.icon}</div>
            <div class="ex-meta">
              <div class="ex-nm">${esc(e.name)} ${hr?'🏆':''}</div>
              <div class="ex-tg"><span>${esc(e.tag)}</span><span class="lvl">· ${LEVEL_NAMES[lvl-1]}${man?' 🎚':''}</span></div>
            </div>
            <span class="ex-arrow">›</span>
          </button>`;
        }).join('')}
      `;
    }).join('')}
    <div style="height:20px"></div>`;
  $('#quickStart',root).onclick=()=>{
    SFX.tap();buzz(10);ensureAudio();
    const seed=parseInt(todayKey().split('-').join(''),10);
    const plan=[];
    ['memory','speed','math'].forEach((c,i)=>{
      const list=EX_LIST.filter(e=>e.cat===c);
      if(list.length) plan.push(list[(seed+i*7)%list.length].id);
    });
    startQueue(plan);
  };
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-ex]');
    if(b){SFX.tap();buzz(8);ensureAudio();startQueue([b.dataset.ex]);}
  });
  return root;
}

function renderStats(){
  const li=levelInfo(S.neurofit.xp);
  const todayDs=todayKey();
  const todayItems=itemsForDate(todayDs);
  const todayDone=todayItems.filter(i=>i.completed).length;
  const todayPct=todayItems.length?Math.round(todayDone/todayItems.length*100):0;
  const nut=nutritionToday();
  const g=S.nutrition.goals;
  const kcalPct=Math.min(100,Math.round(nut.kcal/Math.max(1,g.calories)*100));
  const waterPct=Math.min(100,Math.round(nut.water/Math.max(1,g.water)*100));

  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=fmtDate(d);
    const trains=S.neurofit.sessions.filter(s=>s.d===ds).length;
    const doneCnt=S.navlife.schedule.filter(x=>x.date===ds&&x.completed).length;
    days.push({ds,dowShort:dowShort[d.getDay()],trains,done:doneCnt});
  }
  const maxV=Math.max(1,...days.map(x=>Math.max(x.trains,x.done)));

  const last=S.neurofit.sessions.slice(-30);
  const avgAcc=last.length?Math.round(last.reduce((a,b)=>a+b.acc,0)/last.length):0;
  const rtArr=last.filter(x=>x.rt>0);
  const avgRt=rtArr.length?Math.round(rtArr.reduce((a,b)=>a+b.rt,0)/rtArr.length):0;
  const mins=Math.round(S.neurofit.totalMs/60000);
  const totalDone=S.navlife.schedule.filter(i=>i.completed).length;

  const catStats=Object.keys(CATS).map(c=>{
    const list=S.neurofit.sessions.filter(s=>EX[s.ex]&&EX[s.ex].cat===c);
    const n=list.length;
    const acc=n?Math.round(list.reduce((a,b)=>a+b.acc,0)/n):0;
    return {key:c,name:CATS[c].name,icon:CATS[c].icon,n,acc};
  });

  const recs=[];
  Object.keys(S.neurofit.records||{}).forEach(exId=>{
    const r=S.neurofit.records[exId];
    ['endless','survival'].forEach(m=>{
      if(r[m]&&r[m].score) recs.push({exId,mode:m,score:r[m].score});
    });
  });
  recs.sort((a,b)=>b.score-a.score);

  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="h1" style="margin-bottom:18px">Прогресс</div>

    <div class="hero" style="background:linear-gradient(155deg,#22302A 0%,#1B211D 62%);margin-bottom:14px">
      <div class="hero-inner">
        <div class="between" style="align-items:flex-start;margin-bottom:14px">
          <div>
            <div class="eyebrow">УРОВЕНЬ ${li.level}</div>
            <div style="font-family:'Fraunces',serif;font-size:34px;font-weight:600;color:#fff;line-height:1;margin-top:4px">${li.into} / ${li.need} XP</div>
          </div>
          <div style="text-align:right">
            <div class="eyebrow" style="color:#9AA398">ВСЕГО</div>
            <div style="font-family:'Fraunces',serif;font-size:24px;font-weight:600;color:#F3E3C8;line-height:1;margin-top:6px">${S.neurofit.xp} XP</div>
          </div>
        </div>
        <div style="height:6px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden">
          <div style="height:100%;width:${(li.pct*100).toFixed(1)}%;background:linear-gradient(90deg,var(--amber),#F3E3C8);border-radius:4px;transition:width .5s"></div>
        </div>
        <p style="color:#C7CEC5;font-size:12.5px;margin-top:10px">До уровня ${li.level+1} — ${li.need-li.into} XP</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="card" style="margin:0;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:4px">🔥</div>
        <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;line-height:1">${S.neurofit.streak}</div>
        <div class="tiny" style="margin-top:4px">ДНЕЙ ПОДРЯД</div>
      </div>
      <div class="card" style="margin:0;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:4px">⭐</div>
        <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;line-height:1">${S.neurofit.bestStreak}</div>
        <div class="tiny" style="margin-top:4px">РЕКОРД СЕРИИ</div>
      </div>
      <div class="card" style="margin:0;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:4px">🧠</div>
        <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;line-height:1">${S.neurofit.totalSessions}</div>
        <div class="tiny" style="margin-top:4px">ТРЕНИРОВОК</div>
      </div>
      <div class="card" style="margin:0;padding:16px;text-align:center">
        <div style="font-size:28px;margin-bottom:4px">⏱</div>
        <div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;line-height:1">${mins}<span style="font-size:14px;font-weight:500"> мин</span></div>
        <div class="tiny" style="margin-top:4px">В ТРЕНИРОВКАХ</div>
      </div>
    </div>

    <div class="card">
      <div class="between" style="margin-bottom:12px">
        <div>
          <div class="h3" style="font-family:'Fraunces',serif;font-size:16px">Активность за неделю</div>
          <div class="muted" style="font-size:12px;margin-top:2px">Дела + тренировки мозга</div>
        </div>
        <div class="tiny">Пн–Вс</div>
      </div>
      <div class="chart" style="height:120px;padding:8px 4px 0">
        ${days.map(x=>{
          const total=x.trains+x.done;
          const pct=Math.round(total/maxV*100);
          return `<div class="chart-col">
            <div class="chart-bar" style="height:100%"><div class="fillbar" style="--h:${(pct/100).toFixed(3)}"></div></div>
            <div class="chart-lbl">${x.dowShort}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="h3" style="font-family:'Fraunces',serif;font-size:16px;margin-bottom:14px">Сегодня</div>

      <div style="margin-bottom:14px">
        <div class="between" style="margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">📋 Дела по плану</span>
          <span class="muted" style="font-size:12.5px">${todayDone} / ${todayItems.length}</span>
        </div>
        <div class="bar"><i class="on" style="--p:${(todayPct/100).toFixed(3)}"></i></div>
        <div class="tiny" style="margin-top:5px;font-size:11px">${todayPct}% выполнено</div>
      </div>

      <div style="margin-bottom:14px">
        <div class="between" style="margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">🥗 Калории</span>
          <span class="muted" style="font-size:12.5px">${nut.kcal} / ${g.calories} ккал</span>
        </div>
        <div class="bar"><i class="on" style="--p:${(kcalPct/100).toFixed(3)};background:var(--amber)"></i></div>
        <div class="tiny" style="margin-top:5px;font-size:11px">Б ${nut.protein}/${g.protein} · Ж ${nut.fat}/${g.fat} · У ${nut.carbs}/${g.carbs}</div>
      </div>

      <div>
        <div class="between" style="margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">💧 Вода</span>
          <span class="muted" style="font-size:12.5px">${nut.water} / ${g.water} мл</span>
        </div>
        <div class="bar"><i class="on" style="--p:${(waterPct/100).toFixed(3)};background:var(--blue)"></i></div>
      </div>
    </div>

    <div class="card">
      <div class="h3" style="font-family:'Fraunces',serif;font-size:16px;margin-bottom:14px">Тренировки мозга</div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1;text-align:center;padding:10px;background:var(--paper);border-radius:10px">
          <div class="tiny">Точность</div>
          <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:600;margin-top:2px">${avgAcc}%</div>
        </div>
        <div style="flex:1;text-align:center;padding:10px;background:var(--paper);border-radius:10px">
          <div class="tiny">Реакция</div>
          <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:600;margin-top:2px">${avgRt||'—'}${avgRt?'<span style="font-size:12px;font-weight:500"> мс</span>':''}</div>
        </div>
        <div style="flex:1;text-align:center;padding:10px;background:var(--paper);border-radius:10px">
          <div class="tiny">Всего дел</div>
          <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:600;margin-top:2px">${totalDone}</div>
        </div>
      </div>
      ${catStats.map(c=>`
        <div style="margin-bottom:12px">
          <div class="between" style="margin-bottom:5px">
            <span style="font-size:13px;font-weight:600">${c.icon} ${esc(c.name)}</span>
            <span class="muted" style="font-size:12px">${c.n} · ${c.acc}%</span>
          </div>
          <div class="bar"><i class="on" style="--p:${(c.acc/100).toFixed(3)}"></i></div>
        </div>
      `).join('')}
    </div>

    ${recs.length?`
    <div class="card">
      <div class="h3" style="font-family:'Fraunces',serif;font-size:16px;margin-bottom:14px">🏆 Личные рекорды</div>
      ${recs.slice(0,6).map(r=>{
        const e=EX[r.exId];if(!e) return '';
        const m=MODES[r.mode];
        return `<div class="res-row">
          <span class="muted" style="font-size:13px">${e.icon} ${esc(e.name)} <span style="opacity:.6">· ${m.emoji}</span></span>
          <b style="font-family:'Fraunces',serif;font-size:16px">${r.score}</b>
        </div>`;
      }).join('')}
    </div>`:''}

    <div style="height:20px"></div>`;
  return root;
}

const AVATARS=['🧠','🚀','🦉','🐺','🦊','🐙','🌟','⚡','🎯','🧩','🦁','🐬'];
function renderProfile(){
  const li=levelInfo(S.neurofit.xp);
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="h1" style="margin-bottom:18px">Профиль</div>
    <div class="card" style="text-align:center">
      <div class="avatar-preview">${avatarHtml(S.shared.avatar,120)}</div>
      <div style="font-size:20px;font-weight:600;font-family:'Fraunces',serif">${esc(S.shared.name)}</div>
      <div class="muted" style="margin-top:4px">Уровень ${li.level} · ${S.neurofit.xp} XP</div>
      <button class="btn btn-ghost" id="editName" type="button" style="margin-top:14px">Изменить</button>
    </div>
    <div class="stat-grid" style="margin-bottom:14px">
      <div class="stat"><b>${S.neurofit.streak} 🔥</b><span>серия</span></div>
      <div class="stat"><b>${S.neurofit.bestStreak}</b><span>рекорд серии</span></div>
      <div class="stat"><b>${S.neurofit.totalSessions}</b><span>тренировок</span></div>
      <div class="stat"><b>${S.navlife.goals.length}</b><span>целей</span></div>
    </div>
    <button class="card tappable" id="openLevels" type="button" style="width:100%;text-align:left">
      <div class="between">
        <div><div class="h3" style="margin-bottom:2px">🎚 Уровни упражнений</div><div class="muted" style="font-size:12.5px">Сложность вручную</div></div>
        <div style="font-size:18px;color:var(--ink-mute)">›</div>
      </div>
    </button>
    <button class="card tappable" id="openHelp" type="button" style="width:100%;text-align:left">
      <div class="between">
        <div><div class="h3" style="margin-bottom:2px">📖 Инструкция</div><div class="muted" style="font-size:12.5px">Как пользоваться</div></div>
        <div style="font-size:18px;color:var(--ink-mute)">›</div>
      </div>
    </button>
    <div class="card">
      <div class="h3" style="margin-bottom:16px;font-family:'Fraunces',serif;font-size:16px">Настройки</div>
      <div class="between" style="padding:12px 0;border-bottom:1px solid var(--line)">
        <div><div class="h3">Тёмная тема</div></div>
        <div class="switch ${S.shared.theme==='dark'?'on':''}" data-toggle="theme"></div>
      </div>
      <div class="between" style="padding:12px 0;border-bottom:1px solid var(--line)">
        <div><div class="h3">Звук</div></div>
        <div class="switch ${S.shared.sound?'on':''}" data-toggle="sound"></div>
      </div>
      <div class="between" style="padding:12px 0;border-bottom:1px solid var(--line)">
        <div><div class="h3">Вибрация</div></div>
        <div class="switch ${S.shared.haptics?'on':''}" data-toggle="haptics"></div>
      </div>
      <div style="padding:16px 0 4px">
        <div class="h3" style="margin-bottom:4px">Цель тренировок в день</div>
        <div class="muted" style="font-size:12.5px;margin-bottom:14px">Сколько раз тренировать мозг</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${[1,3,5,7].map(n=>`<button class="chip ${S.shared.dailyGoal===n?'moss':''}" data-goal="${n}" type="button">${n}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="h3" style="margin-bottom:12px;font-family:'Fraunces',serif;font-size:16px">Данные</div>
      <p class="muted" style="font-size:12.5px;margin-bottom:14px">Всё хранится локально.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" id="expBtn" type="button" style="flex:1;min-width:100px">Экспорт</button>
        <button class="btn btn-ghost" id="impBtn" type="button" style="flex:1;min-width:100px">Импорт</button>
        <button class="btn btn-ghost btn-danger" id="rstBtn" type="button" style="flex:1;min-width:100px">Сбросить</button>
      </div>
    </div>
    <div class="card" style="background:var(--rust-soft);border-color:transparent">
      <div class="tiny" style="color:var(--rust)">Важно</div>
      <p style="font-size:12.5px;margin-top:8px;line-height:1.6;color:var(--rust)">
        Приложение — тренажёр, а не медицинское устройство.
      </p>
    </div>
    <div style="height:20px"></div>`;
  $$('[data-toggle]',root).forEach(sw=>{
    sw.onclick=()=>{
      const k=sw.dataset.toggle;
      if(k==='theme'){S.shared.theme=S.shared.theme==='dark'?'light':'dark';applyTheme();sw.classList.toggle('on',S.shared.theme==='dark');}
      else{S.shared[k]=!S.shared[k];sw.classList.toggle('on',S.shared[k]);}
      saveState();SFX.tap();buzz(8);
    };
  });
  $$('[data-goal]',root).forEach(b=>b.onclick=()=>{S.shared.dailyGoal=+b.dataset.goal;saveState();SFX.tap();go('profile');});
  $('#editName',root).onclick=openNameModal;
  $('#openLevels',root).onclick=()=>{SFX.tap();go('levels');};
  $('#openHelp',root).onclick=()=>{SFX.tap();openHelpModal();};
  $('#expBtn',root).onclick=exportData;
  $('#impBtn',root).onclick=importData;
  $('#rstBtn',root).onclick=()=>{
    if(confirm('Удалить весь прогресс?')){resetState();applyTheme();go('onboarding');}
  };
  return root;
}
function openNameModal(){
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">Профиль</div>
    <div class="field"><label>Имя</label><input id="nmIn" value="${esc(S.shared.name)}" maxlength="20"></div>
    <div class="tiny" style="margin-bottom:10px">Текущий аватар</div>
    <div class="avatar-preview" id="avatarPreview" style="margin-bottom:16px">${avatarHtml(S.shared.avatar,120)}</div>
    <button class="btn btn-ghost btn-full" id="uploadAvatarBtn" type="button" style="margin-bottom:14px">📷 Загрузить свою фотографию</button>
    <input type="file" id="avatarInput" accept="image/*" style="display:none">
    <div class="tiny" style="margin-bottom:10px">Или выбери эмодзи</div>
    <div class="avatar-grid">
      ${AVATARS.map(a=>`<button class="avatar-opt ${S.shared.avatarType==='emoji'&&S.shared.avatar===a?'on':''}" data-av="${a}" type="button">${a}</button>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-ghost btn-full" id="nmCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="nmSave" type="button">Сохранить</button>
    </div>`,m=>{
    let newAvatar=S.shared.avatar;
    let newType=S.shared.avatarType||'emoji';
    const updatePreview=()=>{
      const el=$('#avatarPreview',m);
      if(el) el.innerHTML=avatarHtml(newAvatar,120);
    };
    $('#uploadAvatarBtn',m).onclick=()=>$('#avatarInput',m).click();
    $('#avatarInput',m).onchange=e=>{
      const file=e.target.files[0];
      if(!file) return;
      if(!file.type.startsWith('image/')){toast('Нужна картинка');return;}
      const reader=new FileReader();
      reader.onload=ev=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          canvas.width=200;canvas.height=200;
          const ctx=canvas.getContext('2d');
          const size=Math.min(img.width,img.height);
          const sx=(img.width-size)/2;
          const sy=(img.height-size)/2;
          ctx.drawImage(img,sx,sy,size,size,0,0,200,200);
          try{
            newAvatar=canvas.toDataURL('image/jpeg',0.85);
            newType='photo';
            updatePreview();
            $$('[data-av]',m).forEach(x=>x.classList.remove('on'));
            toast('Фотография загружена. Нажми Сохранить');
          }catch(err){toast('Не удалось обработать фото');}
        };
        img.onerror=()=>toast('Не удалось загрузить фото');
        img.src=ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    $$('[data-av]',m).forEach(b=>b.onclick=()=>{
      newAvatar=b.dataset.av;newType='emoji';
      SFX.tap();buzz(8);
      $$('[data-av]',m).forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      updatePreview();
    });
    $('#nmCancel',m).onclick=()=>closeModal(m);
    $('#nmSave',m).onclick=()=>{
      S.shared.name=($('#nmIn',m).value||'Игрок').slice(0,20).trim()||'Игрок';
      S.shared.avatar=newAvatar;
      S.shared.avatarType=newType;
      saveState();closeModal(m);go('profile');toast('Профиль обновлён');
    };
  });
}
function openHelpModal(){
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">Инструкция</div>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">🏠 Сегодня</h3>
    <p class="muted" style="margin-bottom:14px">Маршрут дня: что делать сейчас, что дальше.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">📅 Дела</h3>
    <p class="muted" style="margin-bottom:14px">Удерживай событие и тяни вверх/вниз — перемещение по времени. Шаг 5 минут.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">🥗 Питание</h3>
    <p class="muted" style="margin-bottom:14px">КБЖУ, вода, вес, дневник еды.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">🧠 Мозг</h3>
    <p class="muted" style="margin-bottom:14px">19 упражнений, 3 режима, 6 уровней.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">📊 Прогресс</h3>
    <p class="muted" style="margin-bottom:14px">Уровень, активность за неделю, категории, рекорды.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">📋 Программы</h3>
    <p class="muted" style="margin-bottom:14px">Готовые сценарии (Помодоро, Зарядка, Утро...) и свои собственные.</p>
    <h3 style="font-size:14px;margin-bottom:8px;color:var(--moss)">💾 Данные</h3>
    <p class="muted" style="margin-bottom:16px">Экспорт — файл JSON. Импорт — загрузить обратно.</p>
    <button class="btn btn-primary btn-full btn-lg" id="hOk" type="button">Понятно</button>`,m=>{
    $('#hOk',m).onclick=()=>closeModal(m);
  });
}
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='navlife-'+todayKey()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Файл сохранён');
}
function importData(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.json,application/json';
  inp.onchange=()=>{
    const f=inp.files[0];if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        S=migrateState(d);
        saveState();applyTheme();go('today');toast('Данные загружены');
      }catch(e){toast('Не удалось прочитать файл');}
    };
    r.readAsText(f);
  };
  inp.click();
}

function renderLevels(){
  const root=document.createElement('div');
  root.className='screen';
  root.innerHTML=`
    <div class="row" style="margin-bottom:16px;gap:10px">
      <button class="icon-btn" id="back" type="button">←</button>
      <div class="h1" style="flex:1">Уровни</div>
    </div>
    <div class="card" style="background:var(--moss-soft);border-color:transparent;margin-bottom:16px">
      <div class="tiny" style="color:var(--moss);margin-bottom:8px">Как работает</div>
      <p style="font-size:13px;line-height:1.6;color:var(--moss);margin-bottom:12px">
        По умолчанию сложность <b>адаптивная</b>. 🎚 = ручной режим.
      </p>
      <button class="btn btn-ghost btn-sm" id="resetAll" type="button">Сбросить на Авто</button>
    </div>
    ${Object.keys(CATS).map(catKey=>{
      const list=EX_LIST.filter(e=>e.cat===catKey);
      const cc=CATS[catKey];
      if(!list.length) return '';
      return `
        <div class="cat-title" style="margin-top:18px"><span>${cc.icon}</span><span>${esc(cc.name)}</span></div>
        ${list.map(ex=>{
          const man=S.neurofit.manualDiff[ex.id]||0;
          const auto=clamp(S.neurofit.levels[ex.id]||ex.defaultLevel,1,ex.levels.length);
          return `
            <div class="lvl-row">
              <div class="lico">${ex.icon}</div>
              <div class="lmeta">
                <div class="lnm">${esc(ex.name)}</div>
                <div class="lsub">${man>0?`🎚 ${LEVEL_NAMES[man-1]}`:`🤖 Авто: ${LEVEL_NAMES[auto-1]}`}</div>
              </div>
            </div>
            <div class="picker" data-picker="${ex.id}">
              <button class="${man===0?'on':''}" data-l="0" type="button">🤖 Авто</button>
              ${LEVEL_NAMES.map((nm,i)=>`<button class="${man===i+1?'on':''}" data-l="${i+1}" type="button">${i+1} ${esc(nm.slice(0,3))}</button>`).join('')}
            </div>`;
        }).join('')}
      `;
    }).join('')}
    <div style="height:20px"></div>`;
  $('#back',root).onclick=()=>go('profile');
  $('#resetAll',root).onclick=()=>{
    if(confirm('Сбросить?')){S.neurofit.manualDiff={};saveState();toast('Сброшено');go('levels');}
  };
  $$('[data-picker]',root).forEach(picker=>{
    const exId=picker.dataset.picker;
    $$('button',picker).forEach(btn=>btn.onclick=()=>{
      const lvl=+btn.dataset.l;
      if(lvl===0) delete S.neurofit.manualDiff[exId];else S.neurofit.manualDiff[exId]=lvl;
      saveState();SFX.tap();buzz(10);go('levels');
    });
  });
  return root;
}

function renderOnboarding(){
  let step=0,goal=3;
  const root=document.createElement('div');
  root.className='screen';root.style.padding='0';
  $('#nav').classList.add('hidden');
  const STEPS=[
    {em:'🧭',t:'Твой маршрут по дню',p:'NavLife превращает цели в конкретные действия и ведёт тебя шаг за шагом.'},
    {em:'🥗',t:'Питание и КБЖУ',p:'Веди дневник еды, считай калории, следи за водой и весом.'},
    {em:'🧠',t:'Тренировка мозга',p:'19 упражнений для памяти, внимания, счёта и логики.'},
    {em:'📊',t:'Единый прогресс',p:'Вся статистика в одном месте — дела, питание, тренировки.'}
  ];
  function draw(){
    const s=STEPS[step];
    root.innerHTML=`
      <div class="onb">
        <div class="onb-body">
          <div class="onb-art">${s.em}</div>
          <h1>${esc(s.t)}</h1>
          <p>${esc(s.p)}</p>
          ${step===STEPS.length-1?`
          <div class="onb-options" style="margin-top:22px">
            ${[1,3,5].map(n=>`
              <button class="opt ${goal===n?'on':''}" data-goal="${n}" type="button">
                <span class="opt-em">${n===1?'🌤':n===3?'🔥':'🚀'}</span>
                <span style="flex:1">
                  <span class="opt-title">${n} тренировк${n===1?'а':'и'} в день</span>
                  <span class="opt-desc">${n===1?'Спокойный ритм':n===3?'Оптимально':'Интенсивно'}</span>
                </span>
              </button>`).join('')}
          </div>`:''}
        </div>
        <div>
          <div class="onb-dots">${STEPS.map((_,i)=>`<i class="${i===step?'on':''}"></i>`).join('')}</div>
          <button class="btn btn-primary btn-full btn-lg" id="onbNext" type="button">${step===STEPS.length-1?'Начать':'Далее'}</button>
          ${step<STEPS.length-1?`<button class="btn btn-ghost btn-full" id="onbSkip" type="button" style="margin-top:10px">Пропустить</button>`:''}
        </div>
      </div>`;
    $$('[data-goal]',root).forEach(b=>b.onclick=()=>{goal=+b.dataset.goal;SFX.tap();buzz(8);draw();});
    $('#onbNext',root).onclick=()=>{
      SFX.tap();buzz(12);ensureAudio();
      if(step<STEPS.length-1){step++;draw();}
      else{S.shared.onboarded=true;S.shared.dailyGoal=goal;refreshStreak();saveState();go('today');}
    };
    const sk=$('#onbSkip',root);if(sk) sk.onclick=()=>{step=STEPS.length-1;draw();};
  }
  draw();
  return root;
}

/* ═══════════════════════════════════════════════════════════════════
   BRIDGE — экспорт внутренних API для feature-pack.js
   Размещено ДО init(), чтобы Feature Pack нашёл окно.__nav сразу.
   ═══════════════════════════════════════════════════════════════════ */
window.__nav = {
  get S(){ return S; },
  set S(v){ S = v; },
  get currentScreen(){ return currentScreen; },
  get modalStack(){ return modalStack; },
  get TIMEOUT(){ return TIMEOUT; },
  go, saveState, loadState, toast, openModal, closeModal,
  applyTheme, closeAllModals, completeScheduleItem,
  todayKey, fmtDate, esc, toMin, uid, pad2,
  dowShort, dowNames, monNames,
  nutritionToday, levelInfo,
  SFX, buzz, flash,
  DEFAULT_STATE, BUILTIN_PROGRAMS, KNOWLEDGE
};

function init(){
  applyTheme();
  bootState();
  if(!S.shared.onboarded) go('onboarding');
  else go('today');
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){ensureToday();if(currentScreen==='today') go('today');}
  });
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&modalStack.length>0) closeModal();
  });
  const unlock=()=>{
    ensureAudio();
    window.removeEventListener('touchstart',unlock);
    window.removeEventListener('click',unlock);
    window.removeEventListener('keydown',unlock);
  };
  window.addEventListener('touchstart',unlock,{once:true,passive:true});
  window.addEventListener('click',unlock,{once:true});
  window.addEventListener('keydown',unlock,{once:true});
  window.addEventListener('beforeunload',e=>{
    if(window.__exCleanup){e.preventDefault();e.returnValue='';}
  });
}
init();