/* ═══════════════════════════════════════════════════════════════
   NAVLIFE · FEATURE PACK v2.0
   PWA · Уведомления · Итог дня · Настроение · Рефлексия
   Календарь Неделя/Месяц · Защита от пропусков · Splash
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const N = window.__nav;
if (!N) { console.error('[NavLife] Bridge not found'); return; }

const { go, saveState, toast, openModal, closeModal, todayKey, fmtDate,
        esc, toMin, dowShort, monNames, nutritionToday, SFX, buzz, flash } = N;

/* ════════ 1. РАСШИРЕНИЕ STATE ════════ */
function extendState(){
  const S = N.S;
  if (!S.mood) S.mood = {};
  if (!S.reflections) S.reflections = [];
  if (!S.meta) S.meta = {};
  if (!S.meta.endOfDayShown) S.meta.endOfDayShown = {};
  if (!S.meta.notifShown) S.meta.notifShown = {};
  if (typeof S.meta.lastVisitDate === 'undefined') S.meta.lastVisitDate = null;
  if (typeof S.meta.missedDaysShown === 'undefined') S.meta.missedDaysShown = false;
  if (typeof S.meta.pwaHintShown === 'undefined') S.meta.pwaHintShown = false;
  if (typeof S.viewMode === 'undefined') S.viewMode = 'day';
  if (typeof S.shared.notifications === 'undefined') S.shared.notifications = false;
  saveState();
}
extendState();

/* ════════ 2. SERVICE WORKER ════════ */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('[SW] reg failed:', err.message);
    });
  });
}

/* ════════ 3. SPLASH ════════ */
(function splash(){
  const sp = document.createElement('div');
  sp.id = 'navlife-splash';
  sp.innerHTML = `
    <div style="text-align:center;animation:splashIn .6s cubic-bezier(.22,1,.36,1)">
      <div style="font-size:56px;line-height:1;margin-bottom:12px">🧭</div>
      <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:600;letter-spacing:-.01em">NavLife</div>
      <div style="font-size:11.5px;opacity:.55;margin-top:6px;letter-spacing:.14em;text-transform:uppercase">маршрут дня</div>
    </div>`;
  sp.style.cssText = `position:fixed;inset:0;z-index:9999;display:grid;place-items:center;
    background:var(--paper);transition:opacity .5s ease;pointer-events:none`;
  document.body.appendChild(sp);
  const st = document.createElement('style');
  st.textContent = '@keyframes splashIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}';
  document.head.appendChild(st);
  setTimeout(() => {
    sp.style.opacity = '0';
    setTimeout(() => sp.remove(), 520);
  }, 400);
})();

/* ════════ 4. УВЕДОМЛЕНИЯ ════════ */
async function requestNotifPermission(){
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch(e){ return false; }
}

function tickNotifications(){
  const S = N.S;
  if (!S.shared.notifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const ds = todayKey();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  S.navlife.schedule
    .filter(i => i.date === ds && !i.completed)
    .forEach(it => {
      const start = toMin(it.startTime);
      const diff = start - nowMin;
      if (diff >= 0 && diff <= 1) {
        if (S.meta.notifShown[it.id]) return;
        S.meta.notifShown[it.id] = Date.now();
        saveState();
        try {
          new Notification('NavLife · Сейчас', {
            body: `Сейчас ${it.startTime} — ${it.title}`,
            icon: 'icon.svg',
            tag: it.id,
            silent: false
          });
        } catch(e){}
      }
    });
}
setInterval(tickNotifications, 45000);

/* ════════ 5. ЗАЩИТА ОТ ПРОПУСКОВ ════════ */
function checkMissedDays(){
  const S = N.S;
  const today = todayKey();
  const last = S.meta.lastVisitDate;
  S.meta.lastVisitDate = today;
  saveState();
  if (!last || last === today || S.meta.missedDaysShown) return;
  const days = Math.round((new Date(today) - new Date(last)) / 86400000);
  if (days >= 2) {
    S.meta.missedDaysShown = true;
    saveState();
    setTimeout(() => openWelcomeBack(days), 900);
  }
}
function openWelcomeBack(days){
  openModal(`
    <div class="modal-handle"></div>
    <div style="text-align:center;padding:16px 4px 8px">
      <div style="font-size:56px;margin-bottom:14px">🌱</div>
      <div class="h2" style="margin-bottom:10px">С возвращением</div>
      <p class="muted" style="max-width:340px;margin:0 auto 24px;font-size:14px">
        Тебя не было ${days} ${days < 5 ? 'дня' : 'дней'}. Это нормально — жизнь бывает разной.
        Давай просто начнём сегодня, без вины и без давления.
      </p>
      <button class="btn btn-primary btn-full btn-lg" id="wbOk" type="button">Начать сегодня</button>
    </div>`, m => {
    const b = m.querySelector('#wbOk');
    if (b) b.onclick = () => { closeModal(m); toast('Рады видеть 👋'); SFX.ok(); buzz(12); };
  });
}

/* ════════ 6. ИТОГ ДНЯ ════════ */
function checkEndOfDay(force){
  const S = N.S;
  const ds = todayKey();
  if (!force && S.meta.endOfDayShown[ds]) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items = S.navlife.schedule.filter(i => i.date === ds);
  if (!force && items.length === 0) return;
  const done = items.filter(i => i.completed).length;
  const allDone = items.length > 0 && done === items.length;
  const isLateEvening = nowMin >= 21 * 60 + 30;
  if (!force && !isLateEvening && !allDone) return;

  S.meta.endOfDayShown[ds] = true;
  saveState();

  const nut = nutritionToday();
  const goals = S.nutrition.goals;
  const sessionsToday = S.neurofit.sessions.filter(s => s.d === ds).length;
  const streak = S.neurofit.streak;
  const leftover = items.filter(i => !i.completed);
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate()+1); return fmtDate(d); })();

  openModal(`
    <div class="modal-handle"></div>
    <div style="text-align:center;padding:8px 0 4px">
      <div class="tiny" style="letter-spacing:.16em;color:var(--moss)">ИТОГ ДНЯ</div>
      <div class="h2" style="margin:10px 0 6px;font-size:24px">Хорошая работа</div>
      <p class="muted" style="margin-bottom:22px">Вот что получилось сегодня</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="stat" style="padding:14px"><b>${done} / ${items.length}</b><span>дел выполнено</span></div>
      <div class="stat" style="padding:14px"><b>${sessionsToday}</b><span>тренировок мозга</span></div>
      <div class="stat" style="padding:14px"><b>${nut.kcal}</b><span>ккал из ${goals.calories}</span></div>
      <div class="stat" style="padding:14px"><b>${nut.water}</b><span>мл воды из ${goals.water}</span></div>
    </div>
    <div style="text-align:center;padding:16px;background:var(--amber-soft);border-radius:14px;margin-bottom:18px">
      <div class="tiny" style="color:var(--amber-dim);margin-bottom:6px">СЕРИЯ</div>
      <div style="font-family:'Fraunces',serif;font-size:32px;font-weight:600;color:var(--amber-dim);line-height:1">🔥 ${streak}</div>
      <div class="tiny" style="color:var(--amber-dim);margin-top:4px">${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд</div>
    </div>
    ${leftover.length ? `
      <div style="padding:14px 16px;background:var(--paper);border-radius:14px;margin-bottom:14px">
        <div class="tiny" style="margin-bottom:8px">ОСТАЛОСЬ НА СЕГОДНЯ</div>
        <div style="font-size:13.5px;line-height:1.55;color:var(--ink-soft)">${leftover.map(i => esc(i.title)).join(' · ')}</div>
      </div>
      <p class="muted" style="margin-bottom:14px;text-align:center;font-size:12.5px">
        Перенести невыполненное в расписание на завтра?
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" id="eodSkip" type="button">Оставить</button>
        <button class="btn btn-primary btn-full" id="eodMove" type="button">Перенести (${leftover.length})</button>
      </div>` : `
      <button class="btn btn-primary btn-full btn-lg" id="eodClose" type="button">Отлично!</button>`}
  `, m => {
    const bMove = m.querySelector('#eodMove');
    if (bMove) bMove.onclick = () => {
      let cnt = 0;
      leftover.forEach(it => {
        N.S.navlife.schedule.push({
          id: 'sch_' + Math.random().toString(36).slice(2,9),
          title: it.title, type: it.type || 'task',
          startTime: it.startTime, endTime: it.endTime,
          date: tomorrow, completed: false,
          programId: it.programId || null,
          goalStepId: it.goalStepId || null,
          fromBase: false, fromRecurring: false
        });
        it.completed = true;
        cnt++;
      });
      saveState();
      closeModal(m);
      toast(`Перенесено на завтра: ${cnt}`);
      SFX.win();
      go('today');
    };
    const bSkip = m.querySelector('#eodSkip');
    if (bSkip) bSkip.onclick = () => closeModal(m);
    const bClose = m.querySelector('#eodClose');
    if (bClose) bClose.onclick = () => { closeModal(m); SFX.win(); };
  });
}

/* ════════ 7. НАСТРОЕНИЕ ════════ */
const MOODS = [
  { v: 1, em: '😞', label: 'Плохо' },
  { v: 2, em: '😐', label: 'Нейтр.' },
  { v: 3, em: '🙂', label: 'Хорошо' },
  { v: 4, em: '😄', label: 'Отлично' },
  { v: 5, em: '🤩', label: 'Супер' },
];

function openMoodModal(){
  const S = N.S;
  const ds = todayKey();
  const cur = S.mood[ds] || { m: 0, e: 0 };
  let m = cur.m, e = cur.e;

  function html(){
    return `
      <div class="modal-handle"></div>
      <div class="h2" style="margin-bottom:6px">Как ты сегодня?</div>
      <p class="muted" style="margin-bottom:18px">Пара секунд — и можно закрывать</p>
      <div class="tiny" style="margin-bottom:10px">НАСТРОЕНИЕ</div>
      <div style="display:flex;justify-content:space-between;gap:6px;margin-bottom:22px">
        ${MOODS.map(x => `
          <button data-m="${x.v}" type="button" style="
            flex:1;aspect-ratio:1;max-width:58px;border-radius:50%;font-size:26px;
            background:${m === x.v ? 'var(--moss-soft)' : 'var(--paper)'};
            border:2px solid ${m === x.v ? 'var(--moss)' : 'var(--line)'};
            display:grid;place-items:center;cursor:pointer;transition:all .18s;
            transform:${m === x.v ? 'scale(1.08)' : 'scale(1)'};
          ">${x.em}</button>`).join('')}
      </div>
      <div class="tiny" style="margin-bottom:10px">ЭНЕРГИЯ</div>
      <div style="display:flex;gap:6px;margin-bottom:22px">
        ${[1,2,3,4,5].map(x => `
          <button data-e="${x}" type="button" style="
            flex:1;padding:12px 4px;border-radius:10px;font-weight:700;font-size:15px;
            background:${e === x ? 'var(--moss)' : 'var(--paper)'};
            color:${e === x ? '#fff' : 'var(--ink-soft)'};
            border:1px solid ${e === x ? 'var(--moss)' : 'var(--line)'};
            cursor:pointer;transition:all .15s;
          ">${x}</button>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost btn-full" id="moodCancel" type="button">Отмена</button>
        <button class="btn btn-primary btn-full" id="moodSave" type="button" ${(!m || !e) ? 'disabled style="opacity:.5;pointer-events:none"' : ''}>Сохранить</button>
      </div>`;
  }
  function bind(layer){
    const modal = layer.querySelector('.modal');
    const redraw = () => { modal.innerHTML = html(); bind(layer); };
    modal.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { m = +b.dataset.m; SFX.tap(); buzz(6); redraw(); });
    modal.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { e = +b.dataset.e; SFX.tap(); buzz(6); redraw(); });
    const c = modal.querySelector('#moodCancel');
    if (c) c.onclick = () => closeModal(layer);
    const s = modal.querySelector('#moodSave');
    if (s) s.onclick = () => {
      if (!m || !e) return;
      N.S.mood[ds] = { m, e, ts: Date.now() };
      saveState();
      closeModal(layer);
      toast('Записано ✓');
      SFX.ok();
      if (N.currentScreen === 'stats' || N.currentScreen === 'today') go(N.currentScreen);
    };
  }
  const layer = openModal(html());
  bind(layer);
}

function moodStripHtml(){
  const S = N.S;
  const today = todayKey();
  const cur = S.mood[today];
  if (cur) {
    const mm = MOODS.find(x => x.v === cur.m);
    return `
      <button class="card tappable" data-mood-open type="button" style="width:100%;text-align:left;background:var(--moss-soft);border-color:transparent;margin-top:14px">
        <div class="between">
          <div>
            <div class="tiny" style="color:var(--moss)">НАСТРОЕНИЕ СЕГОДНЯ</div>
            <div style="font-size:22px;margin-top:6px;display:flex;align-items:center;gap:10px">
              <span>${mm ? mm.em : '🙂'}</span>
              <span style="font-size:14px;color:var(--moss);font-weight:600">Энергия ${cur.e}/5</span>
            </div>
          </div>
          <div style="font-size:26px;color:var(--moss);opacity:.7">✎</div>
        </div>
      </button>`;
  }
  return `
    <button class="card tappable" data-mood-open type="button" style="width:100%;text-align:left;margin-top:14px">
      <div class="between">
        <div>
          <div class="tiny">ДНЕВНИК НАСТРОЕНИЯ</div>
          <div style="font-size:15px;font-weight:600;margin-top:6px">Как ты сегодня?</div>
          <div class="muted" style="font-size:12.5px;margin-top:2px">1 тап · пара секунд</div>
        </div>
        <div style="font-size:30px">🙂</div>
      </div>
    </button>`;
}

/* ════════ 8. РЕФЛЕКСИЯ ════════ */
function currentWeekKey(){
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function openReflectionModal(){
  const S = N.S;
  const wk = currentWeekKey();
  const ex = S.reflections.find(r => r.week === wk);
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:6px">Неделя в фокусе</div>
    <p class="muted" style="margin-bottom:18px">5 минут рефлексии. Ответы можно перечитать через месяц.</p>
    <div class="field">
      <label>Что получилось?</label>
      <textarea id="rfQ1" style="min-height:70px;width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:inherit;background:var(--surface);color:var(--ink);font-size:14px" placeholder="Победы, приятные моменты">${ex ? esc(ex.q1||'') : ''}</textarea>
    </div>
    <div class="field">
      <label>Что не получилось?</label>
      <textarea id="rfQ2" style="min-height:70px;width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:inherit;background:var(--surface);color:var(--ink);font-size:14px" placeholder="Что было сложно">${ex ? esc(ex.q2||'') : ''}</textarea>
    </div>
    <div class="field">
      <label>Что изменить на следующей неделе?</label>
      <textarea id="rfQ3" style="min-height:70px;width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:inherit;background:var(--surface);color:var(--ink);font-size:14px" placeholder="1–3 конкретных изменения">${ex ? esc(ex.q3||'') : ''}</textarea>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button class="btn btn-ghost btn-full" id="rfCancel" type="button">Отмена</button>
      <button class="btn btn-primary btn-full" id="rfSave" type="button">Сохранить</button>
    </div>
  `, m => {
    m.querySelector('#rfCancel').onclick = () => closeModal(m);
    m.querySelector('#rfSave').onclick = () => {
      const q1 = m.querySelector('#rfQ1').value.trim();
      const q2 = m.querySelector('#rfQ2').value.trim();
      const q3 = m.querySelector('#rfQ3').value.trim();
      if (!q1 && !q2 && !q3) { toast('Хотя бы одно поле'); return; }
      const idx = N.S.reflections.findIndex(r => r.week === wk);
      const obj = { week: wk, date: todayKey(), q1, q2, q3, ts: Date.now() };
      if (idx >= 0) N.S.reflections[idx] = obj;
      else N.S.reflections.push(obj);
      saveState();
      closeModal(m);
      toast('Записано ✓');
      SFX.ok();
      if (N.currentScreen === 'stats') go('stats');
    };
  });
}

function openReflectionHistory(){
  const list = (N.S.reflections || []).slice().sort((a,b) => b.ts - a.ts);
  openModal(`
    <div class="modal-handle"></div>
    <div class="h2" style="margin-bottom:16px">Дневник рефлексии</div>
    ${list.length ? list.map(r => `
      <div class="card" style="padding:16px">
        <div class="tiny" style="margin-bottom:10px">${esc(r.week)} · ${esc(r.date)}</div>
        ${r.q1 ? `<div style="font-size:13px;margin-bottom:8px;line-height:1.5"><b style="color:var(--moss)">Что получилось:</b> ${esc(r.q1)}</div>` : ''}
        ${r.q2 ? `<div style="font-size:13px;margin-bottom:8px;line-height:1.5"><b style="color:var(--rust)">Что не получилось:</b> ${esc(r.q2)}</div>` : ''}
        ${r.q3 ? `<div style="font-size:13px;line-height:1.5"><b style="color:var(--amber-dim)">План:</b> ${esc(r.q3)}</div>` : ''}
      </div>`).join('') : `<p class="muted" style="margin-bottom:20px;text-align:center;padding:24px 0">Пока нет записей. Сделай первую — 5 минут.</p>`}
    <button class="btn btn-primary btn-full btn-lg" id="rflClose" type="button">Закрыть</button>
  `, m => { m.querySelector('#rflClose').onclick = () => closeModal(m); });
}

/* ════════ 9. КАЛЕНДАРЬ: НЕДЕЛЯ / МЕСЯЦ ════════ */
function renderWeekHtml(){
  const S = N.S;
  const base = S.navlife.viewDate || todayKey();
  const d0 = new Date(base + 'T00:00:00');
  const dow = (d0.getDay() + 6) % 7;
  const mon = new Date(d0); mon.setDate(d0.getDate() - dow);

  const cols = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    const ds = fmtDate(d);
    const items = S.navlife.schedule.filter(x => x.date === ds)
      .sort((a,b) => toMin(a.startTime) - toMin(b.startTime));
    cols.push({ d, ds, isToday: ds === todayKey(), dow: dowShort[d.getDay()], items });
  }
  const end = new Date(mon); end.setDate(mon.getDate() + 6);
  const label = `${mon.getDate()} ${monNames[mon.getMonth()].slice(0,3)} — ${end.getDate()} ${monNames[end.getMonth()].slice(0,3)}`;

  return `
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="icon-btn" id="wkPrev" type="button">‹</button>
      <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;text-align:center;flex:1">${label}</div>
      <button class="icon-btn" id="wkNext" type="button">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px">
      ${cols.map(c => `
        <div style="border-radius:12px;background:${c.isToday ? 'var(--moss-soft)' : 'var(--surface-raised)'};
          border:1px solid ${c.isToday ? 'var(--moss)' : 'var(--line)'};padding:8px 5px;min-height:200px;display:flex;flex-direction:column;gap:5px">
          <div style="text-align:center;font-size:10.5px;font-weight:700;color:${c.isToday ? 'var(--moss)' : 'var(--ink-mute)'};letter-spacing:.06em">${c.dow}</div>
          <div style="text-align:center;font-family:'Fraunces',serif;font-size:14px;font-weight:600;color:${c.isToday ? 'var(--moss)' : 'var(--ink)'};margin-bottom:2px">${c.d.getDate()}</div>
          ${c.items.slice(0, 5).map(it => `
            <div title="${esc(it.title)}" style="font-size:9.5px;font-weight:600;padding:3px 5px;border-radius:6px;
              background:${it.completed ? 'var(--moss)' : (it.programId ? 'var(--amber-soft)' : 'var(--paper)')};
              color:${it.completed ? '#fff' : (it.programId ? 'var(--amber-dim)' : 'var(--ink)')};
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
              ${it.completed ? 'text-decoration:line-through;opacity:.7;' : ''}">${esc(it.startTime)} ${esc(it.title)}</div>`).join('')}
          ${c.items.length > 5 ? `<div style="font-size:9px;color:var(--ink-mute);text-align:center">+${c.items.length - 5}</div>` : ''}
          ${c.items.length === 0 ? `<div style="flex:1;display:grid;place-items:center;font-size:18px;opacity:.2">·</div>` : ''}
        </div>`).join('')}
    </div>`;
}

function renderMonthHtml(){
  const S = N.S;
  const base = S.navlife.viewDate || todayKey();
  const bd = new Date(base + 'T00:00:00');
  const y = bd.getFullYear(), mo = bd.getMonth();
  const startDow = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(y, mo, d));
  while (cells.length % 7) cells.push(null);

  const label = `${monNames[mo][0].toUpperCase()}${monNames[mo].slice(1)} ${y}`;
  const today = todayKey();

  return `
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:14px">
      <button class="icon-btn" id="moPrev" type="button">‹</button>
      <div style="font-family:'Fraunces',serif;font-size:15px;font-weight:600;text-align:center;flex:1">${label}</div>
      <button class="icon-btn" id="moNext" type="button">›</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">
      ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<div style="text-align:center;font-size:10.5px;font-weight:700;color:var(--ink-mute);letter-spacing:.06em">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
      ${cells.map(c => {
        if (!c) return '<div></div>';
        const ds = fmtDate(c);
        const isToday = ds === today;
        const items = S.navlife.schedule.filter(x => x.date === ds);
        const done = items.filter(x => x.completed).length;
        const allDone = items.length > 0 && done === items.length;
        const mood = S.mood[ds];
        const mem = mood ? MOODS.find(x => x.v === mood.m) : null;
        return `<button data-mo-date="${ds}" type="button" style="
          aspect-ratio:1;border-radius:10px;padding:2px;cursor:pointer;
          background:${isToday ? 'var(--moss-soft)' : 'var(--surface-raised)'};
          border:1px solid ${isToday ? 'var(--moss)' : 'var(--line)'};
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
        ">
          <div style="font-family:'Fraunces',serif;font-size:13px;font-weight:600;color:${isToday ? 'var(--moss)' : 'var(--ink)'}">${c.getDate()}</div>
          ${items.length ? `<div style="font-size:8.5px;color:var(--ink-mute);font-weight:600">${done}/${items.length}</div>` : '<div style="height:10px"></div>'}
          <div style="display:flex;gap:2px;align-items:center;height:10px">
            ${allDone ? '<span style="width:5px;height:5px;border-radius:50%;background:var(--moss)"></span>' : ''}
            ${mem ? `<span style="font-size:9px;line-height:1">${mem.em}</span>` : ''}
          </div>
        </button>`;
      }).join('')}
    </div>`;
}

/* ════════ 10. ГРАФИК НАСТРОЕНИЯ ДЛЯ STATS ════════ */
function moodChartHtml(){
  const S = N.S;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = fmtDate(d);
    days.push({ ds, dow: dowShort[d.getDay()], entry: S.mood[ds] });
  }
  const hasAny = days.some(x => x.entry);
  if (!hasAny) {
    return `<div class="card">
      <div class="h3" style="font-family:'Fraunces',serif;font-size:16px;margin-bottom:6px">Настроение за неделю</div>
      <p class="muted" style="font-size:12.5px;margin-bottom:14px">Начни вести дневник — 1 тап вечером</p>
      <button class="btn btn-ghost btn-full" data-mood-open type="button">Отметить настроение сегодня</button>
    </div>`;
  }
  return `<div class="card">
    <div class="between" style="margin-bottom:16px">
      <div>
        <div class="h3" style="font-family:'Fraunces',serif;font-size:16px">Настроение за неделю</div>
        <div class="muted" style="font-size:12px;margin-top:2px">Эмодзи + уровень энергии</div>
      </div>
      <button class="btn btn-line btn-sm" data-mood-open type="button">+ Отметить</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">
      ${days.map(x => {
        const mm = x.entry ? MOODS.find(m => m.v === x.entry.m) : null;
        const e = x.entry ? x.entry.e : 0;
        const hp = (e / 5) * 100;
        return `<div style="text-align:center">
          <div style="font-size:10.5px;color:var(--ink-mute);font-weight:600;margin-bottom:4px">${x.dow}</div>
          <div style="font-size:24px;height:32px;line-height:32px">${mm ? mm.em : '<span style="opacity:.25">·</span>'}</div>
          <div style="height:44px;border-radius:6px;background:var(--paper);border:1px solid var(--line);position:relative;overflow:hidden;margin-top:4px">
            <div style="position:absolute;bottom:0;left:0;right:0;height:${hp}%;background:linear-gradient(180deg,var(--moss),var(--moss-dim));transition:height .5s cubic-bezier(.22,1,.36,1)"></div>
          </div>
          <div style="font-size:9.5px;color:var(--ink-mute);margin-top:3px;font-weight:600">${e ? e + '/5' : '—'}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ════════ 11. ПАТЧИ ЭКРАНОВ ════════ */
function patchToday(){
  try {
    const host = document.querySelector('#screens');
    if (!host) return;
    if (!host.querySelector('[data-mood-open]')) {
      const quick = host.querySelector('.cat-title');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = moodStripHtml();
      const node = wrapper.firstElementChild;
      if (node) {
        if (quick && quick.parentNode) quick.parentNode.insertBefore(node, quick);
        else host.appendChild(node);
      }
    }
    host.querySelectorAll('[data-mood-open]').forEach(b => {
      if (b._moodBound) return;
      b._moodBound = true;
      b.addEventListener('click', e => { e.stopPropagation(); openMoodModal(); });
    });
    if (!host.querySelector('[data-eod-open]')) {
      const btn = document.createElement('button');
      btn.setAttribute('data-eod-open', '');
      btn.className = 'btn btn-ghost btn-full';
      btn.type = 'button';
      btn.style.marginTop = '14px';
      btn.textContent = '📋 Итог дня';
      btn.addEventListener('click', () => checkEndOfDay(true));
      host.appendChild(btn);
    }
  } catch(e){ console.warn('[patchToday]', e); }
}

function patchStats(){
  try {
    const host = document.querySelector('#screens');
    if (!host) return;
    if (host.querySelector('[data-mood-open]')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = moodChartHtml();
    const moodNode = wrapper.firstElementChild;

    const refCard = document.createElement('div');
    refCard.className = 'card';
    const rcount = N.S.reflections.length;
    refCard.innerHTML = `
      <div class="between">
        <div>
          <div class="h3" style="font-family:'Fraunces',serif;font-size:16px">Дневник рефлексии</div>
          <div class="muted" style="font-size:12.5px;margin-top:2px">5 минут раз в неделю · ${rcount} ${rcount === 1 ? 'запись' : 'записей'}</div>
        </div>
        <div style="font-size:24px">📓</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary btn-full" id="statsReflect" type="button">Написать сейчас</button>
        <button class="btn btn-ghost" id="statsReflectHist" type="button" style="flex:0 0 auto">Все</button>
      </div>`;

    const allCards = host.querySelectorAll('.card');
    const anchor = allCards[allCards.length - 1];
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(moodNode, anchor);
      anchor.parentNode.insertBefore(refCard, anchor);
    } else {
      host.appendChild(moodNode);
      host.appendChild(refCard);
    }

    host.querySelectorAll('[data-mood-open]').forEach(b => {
      if (b._moodBound) return;
      b._moodBound = true;
      b.addEventListener('click', e => { e.stopPropagation(); openMoodModal(); });
    });
    const rb = host.querySelector('#statsReflect');
    if (rb) rb.onclick = openReflectionModal;
    const rh = host.querySelector('#statsReflectHist');
    if (rh) rh.onclick = openReflectionHistory;
  } catch(e){ console.warn('[patchStats]', e); }
}

function patchSchedule(){
  try {
    const host = document.querySelector('#screens');
    if (!host) return;
    if (host.querySelector('[data-view-switch]')) return;

    const cur = N.S.viewMode || 'day';
    const switcher = document.createElement('div');
    switcher.setAttribute('data-view-switch', '');
    switcher.style.cssText = 'display:flex;gap:6px;margin-bottom:14px';
    switcher.innerHTML = [
      ['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']
    ].map(([k, l]) => `<button class="food-tab ${cur === k ? 'on' : ''}" data-vm="${k}" type="button" style="flex:1">${l}</button>`).join('');

    const toolbar = host.querySelector('.sched-toolbar');
    if (toolbar && toolbar.parentNode) {
      toolbar.parentNode.insertBefore(switcher, toolbar);
    } else {
      host.appendChild(switcher);
    }

    switcher.querySelectorAll('[data-vm]').forEach(b => {
      b.onclick = () => { N.S.viewMode = b.dataset.vm; saveState(); SFX.tap(); go('schedule'); };
    });

    if (cur === 'week' || cur === 'month') {
      const dsSw = host.querySelector('.date-switch');
      if (dsSw) dsSw.style.display = 'none';
      const addBtn = host.querySelector('#addEvent');
      if (addBtn) addBtn.style.display = 'none';
      const list = host.querySelector('#schedList');
      if (list) list.style.display = 'none';
      const hint = host.querySelector('.sched-hint');
      if (hint) hint.style.display = 'none';

      const container = document.createElement('div');
      container.style.marginBottom = '14px';
      container.innerHTML = cur === 'week' ? renderWeekHtml() : renderMonthHtml();
      switcher.parentNode.insertBefore(container, switcher.nextSibling);

      const prev = container.querySelector('#wkPrev, #moPrev');
      const next = container.querySelector('#wkNext, #moNext');
      if (prev) prev.onclick = () => {
        const d = new Date(N.S.navlife.viewDate + 'T00:00:00');
        if (cur === 'week') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1);
        N.S.navlife.viewDate = fmtDate(d);
        saveState(); go('schedule');
      };
      if (next) next.onclick = () => {
        const d = new Date(N.S.navlife.viewDate + 'T00:00:00');
        if (cur === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
        N.S.navlife.viewDate = fmtDate(d);
        saveState(); go('schedule');
      };
      container.querySelectorAll('[data-mo-date]').forEach(cell => {
        cell.onclick = () => {
          N.S.navlife.viewDate = cell.dataset.moDate;
          N.S.viewMode = 'day';
          saveState(); go('schedule');
        };
      });
    }
  } catch(e){ console.warn('[patchSchedule]', e); }
}

function patchProfile(){
  try {
    const host = document.querySelector('#screens');
    if (!host) return;

    if (!host.querySelector('[data-notif-sw]')) {
      const settings = Array.from(host.querySelectorAll('.card'))
        .find(c => c.textContent.includes('Тёмная тема'));
      if (settings) {
        const row = document.createElement('div');
        row.className = 'between';
        row.setAttribute('data-notif-sw', '');
        row.style.cssText = 'padding:12px 0;border-bottom:1px solid var(--line)';
        row.innerHTML = `
          <div>
            <div class="h3">Уведомления о событиях</div>
            <div class="muted" style="font-size:11.5px;margin-top:2px">За минуту до старта</div>
          </div>
          <div class="switch ${N.S.shared.notifications ? 'on' : ''}" id="notifSw"></div>`;
        const vib = Array.from(settings.children).find(c => c.textContent.includes('Вибрация'));
        if (vib && vib.parentNode) vib.parentNode.insertBefore(row, vib.nextSibling);
        else settings.appendChild(row);
        const sw = row.querySelector('#notifSw');
        sw.onclick = async () => {
          if (!N.S.shared.notifications) {
            const ok = await requestNotifPermission();
            if (!ok) { toast('Разреши уведомления в браузере'); return; }
            N.S.shared.notifications = true;
          } else {
            N.S.shared.notifications = false;
          }
          sw.classList.toggle('on', N.S.shared.notifications);
          saveState();
          SFX.tap();
          toast(N.S.shared.notifications ? 'Уведомления включены' : 'Выключено');
        };
      }
    }

    if (!N.S.meta.pwaHintShown && !window.matchMedia('(display-mode: standalone)').matches && !host.querySelector('[data-pwa-hint]')) {
      const hint = document.createElement('div');
      hint.className = 'card';
      hint.setAttribute('data-pwa-hint', '');
      hint.style.cssText = 'background:var(--moss-soft);border-color:transparent';
      hint.innerHTML = `
        <div class="between" style="align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div class="tiny" style="color:var(--moss);margin-bottom:6px">УСТАНОВИ КАК ПРИЛОЖЕНИЕ</div>
            <div style="font-size:13px;line-height:1.55;color:var(--moss)">
              Открой меню браузера → «Установить приложение» (Chrome) или «На экран «Домой»» (Safari).
              Заработает оффлайн, со своей иконкой.
            </div>
          </div>
          <button class="icon-btn" id="pwaDismiss" type="button" style="width:28px;height:28px;font-size:12px;background:transparent;border-color:transparent;color:var(--moss)">✕</button>
        </div>`;
      const allCards = host.querySelectorAll('.card');
      if (allCards.length > 1 && allCards[1].parentNode) {
        allCards[1].parentNode.insertBefore(hint, allCards[1].nextSibling);
      } else {
        host.appendChild(hint);
      }
      const d = hint.querySelector('#pwaDismiss');
      if (d) d.onclick = () => { N.S.meta.pwaHintShown = true; saveState(); hint.remove(); };
    }
  } catch(e){ console.warn('[patchProfile]', e); }
}

/* ════════ 12. ХУК ПОСЛЕ go() ════════
   app.js вызывает window.__afterGo(name) в конце go().
   Здесь мы навешиваем патчи на отрисованный экран. */
window.__afterGo = function(name){
  requestAnimationFrame(() => {
    if (name === 'today')    patchToday();
    if (name === 'stats')    patchStats();
    if (name === 'schedule') patchSchedule();
    if (name === 'profile')  patchProfile();
  });
};

/* ════════ 13. СТАРТОВЫЕ ПРОВЕРКИ ════════ */
setTimeout(() => {
  checkMissedDays();
  const cs = N.currentScreen;
  if (cs === 'today')    patchToday();
  if (cs === 'stats')    patchStats();
  if (cs === 'schedule') patchSchedule();
  if (cs === 'profile')  patchProfile();
}, 500);

/* Ежедневный триггер итога дня */
setInterval(() => {
  const S = N.S;
  const ds = todayKey();
  if (!S.meta.endOfDayShown[ds]) {
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() >= 21 * 60 + 30) {
      if (N.currentScreen === 'today') checkEndOfDay(false);
    }
  }
}, 60000);

/* Триггер «все дела закрыты» */
document.addEventListener('click', () => {
  setTimeout(() => {
    const S = N.S;
    const ds = todayKey();
    if (S.meta.endOfDayShown[ds]) return;
    const items = S.navlife.schedule.filter(i => i.date === ds);
    if (items.length > 3 && items.every(i => i.completed) && N.currentScreen === 'today') {
      checkEndOfDay(false);
    }
  }, 400);
});

/* ════════ 14. POINTER-SPOTLIGHT + СЧЁТЧИКИ ════════ */
let rafId = null;
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const card = e.target.closest('.card.tappable, .ex-item, .k-item');
  if (!card) return;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
}, { passive: true });

const counters = new WeakSet();
const animCount = el => {
  if (counters.has(el)) return;
  counters.add(el);
  const raw = el.textContent.trim();
  const m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return;
  const [, pre, numStr, post] = m;
  const target = parseFloat(numStr.replace(',', '.'));
  if (!isFinite(target) || target === 0) return;
  const decimals = (numStr.split(/[.,]/)[1] || '').length;
  const dur = 700, t0 = performance.now();
  const tick = t => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = (target * e).toFixed(decimals);
    el.textContent = pre + v + post;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = raw;
  };
  requestAnimationFrame(tick);
};

const io = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) { animCount(en.target); io.unobserve(en.target); }
  });
}, { threshold: 0.4 });

const scan = root => {
  root.querySelectorAll('.stat b, .result-num b, .hist-day-val').forEach(el => {
    if (!counters.has(el)) io.observe(el);
  });
};

const host = document.getElementById('screens');
if (host) {
  new MutationObserver(() => scan(host)).observe(host, { childList: true, subtree: false });
  scan(host);
}

console.log('[NavLife] Feature Pack v2 loaded ✓');
})();