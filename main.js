// Tarjetón interactivo (GitHub Pages)
// - Renderiza candidatos desde data.json
// - Permite una sola marca por dispositivo (localStorage)
// - (Opcional) Reporta el voto y consulta métricas en Google Apps Script

// ========= Config =========
const API_URL = "https://script.google.com/macros/s/AKfycbzrcOa_YqUlAyU9ECe99Bosk_VQttAOmB5l3oLy2dmeL0Cg9gTiHd133pxn0qsKd-MvJA/exec";
const POLL_INTERVAL_MS = 7000;

// ========= Estado =========
let DATA = null;
let bySlug = {};
let selectedName = null;
let globalTotals = { total: 0, candidates: {} };
let lastSent = null;

// ========= Utilidades (un voto por dispositivo) =========
const KEYS = {
  deviceId: 'consulta_device_id_8m',
  hasVoted: 'consulta_has_voted_8m'
};

function getCookie(name){
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name, value, days = 365){
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function getDeviceId(){
  let id = localStorage.getItem(KEYS.deviceId) || getCookie('device_id_8m');
  if (!id){
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : ('dev-' + Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem(KEYS.deviceId, id);
    setCookie('device_id_8m', id, 365);
  }
  return id;
}

function hasVoted(){
  return localStorage.getItem(KEYS.hasVoted) === 'true';
}

function markVoted(){
  localStorage.setItem(KEYS.hasVoted, 'true');
}

// ========= UI helpers =========
function toast(msg){
  let el = document.getElementById('__toast');
  if (!el){
    el = document.createElement('div');
    el.id = '__toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:.95rem;z-index:9999;opacity:.98';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el.__t);
  el.__t = setTimeout(() => { el.style.display = 'none'; }, 2200);
}

function lockVotingUI(){
  document.querySelectorAll('.tile').forEach(t => {
    t.classList.add('disabled');
    t.style.pointerEvents = 'none';
  });
}

function focusTile(el){
  if (!el) return;
  document.querySelectorAll('.tile').forEach(t => t.setAttribute('tabindex','-1'));
  el.setAttribute('tabindex','0');
  el.focus();
}

// ========= Carga de datos =========
async function loadData(){
  const res = await fetch('data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo cargar data.json (' + res.status + ')');
  DATA = await res.json();
  bySlug = Object.fromEntries((DATA.records || []).map(r => [r.slug, r]));
}

// ========= Render =========
function render(){
  const content = document.getElementById('content');
  if (!content || !DATA) return;

  content.innerHTML = '';

  (DATA.consultas || []).forEach((g, gidx) => {
    const sec = document.createElement('section');
    sec.className = 'consulta';

    const h = document.createElement('h2');
    h.textContent = g.title || '';
    sec.appendChild(h);

    if (g.subtitle){
      const p = document.createElement('p');
      p.className = 'subtitle';
      p.textContent = g.subtitle;
      sec.appendChild(p);
    }

    const grid = document.createElement('div');
    grid.className = 'grid';

    (g.candidates || []).forEach((slug, idx) => {
      const c = bySlug[slug];
      if (!c) return;

      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', 'false');
      tile.setAttribute('tabindex', (gidx === 0 && idx === 0) ? '0' : '-1');
      tile.dataset.slug = slug;

      tile.innerHTML = `
        <img class="photo" loading="lazy" src="${c.photo}" alt="Foto de ${c.name}" onerror="this.onerror=null;this.src='assets/photo-placeholder.png';">
        <div class="logo-wrap"><img class="logo" loading="lazy" src="${c.logo}" alt="Logo de ${c.name}" onerror="this.onerror=null;this.src='assets/logo-placeholder.png';"></div>
        <div class="name">${c.name}</div>
        <div class="xmark">X</div>
      `;

      tile.addEventListener('click', () => selectBySlug(slug));
      tile.addEventListener('keydown', (e) => {
        const tiles = [...sec.querySelectorAll('.tile')];
        const i = tiles.indexOf(tile);
        const max = tiles.length - 1;

        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          selectBySlug(slug);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown'){
          e.preventDefault();
          focusTile(tiles[Math.min(max, i + 1)]);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp'){
          e.preventDefault();
          focusTile(tiles[Math.max(0, i - 1)]);
        }
      });

      grid.appendChild(tile);
    });

    sec.appendChild(grid);
    content.appendChild(sec);
  });

  if (hasVoted()) lockVotingUI();
}

// ========= Envío del voto (opcional) =========
async function enviarRegistro(nombreCandidato, deviceId){
  if (!API_URL) return;
  try{
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidato: nombreCandidato, deviceId })
    });
    lastSent = deviceId;
  } catch (_e){
    // intencional: silencioso
  }
}

// ========= Selección única =========
function selectBySlug(slug){
  if (hasVoted()){
    toast('Ya registraste tu participación en este dispositivo.');
    return;
  }

  document.querySelectorAll('.tile').forEach(t => {
    t.classList.remove('selected');
    t.setAttribute('aria-checked', 'false');
  });

  const chosen = document.querySelector(`.tile[data-slug="${slug}"]`);
  if (chosen){
    chosen.classList.add('selected');
    chosen.setAttribute('aria-checked', 'true');
  }

  const rec = bySlug[slug];
  selectedName = rec ? rec.name : null;
  if (!selectedName) return;

  markVoted();
  lockVotingUI();
  toast('Tu selección ha sido registrada.');

  const pv = document.getElementById('panelVoto');
  if (pv) pv.hidden = false;
  const sn = document.getElementById('selNombre');
  if (sn) sn.textContent = selectedName;

  const deviceId = getDeviceId();
  if (lastSent !== deviceId) enviarRegistro(selectedName, deviceId);

  // actualiza KPIs cuando llegue la siguiente ronda de métricas
  updateGlobalUI();
}

// ========= Métricas globales =========
async function fetchGlobalTotals(){
  if (!API_URL) return;
  try{
    const res = await fetch(API_URL + '?metrics=1', { cache: 'no-store' });
    const data = await res.json();
    if (!data || typeof data.total !== 'number' || !data.candidates) return;
    globalTotals = data;
    updateGlobalUI();
  } catch (_e){
    // silencioso
  }
}

function updateGlobalUI(){
  if (!DATA) return;

  const total = globalTotals.total || 0;

  // KPI total
  const kpiTotal = document.getElementById('kpiTotal');
  if (kpiTotal) kpiTotal.textContent = String(total);

  // KPI candidato seleccionado
  const kpiCandidato = document.getElementById('kpiCandidato');
  const barCandidato = document.getElementById('barCandidato');

  if (selectedName && kpiCandidato && barCandidato){
    const vC = (globalTotals.candidates && globalTotals.candidates[selectedName]) ? globalTotals.candidates[selectedName] : 0;
    const pC = total > 0 ? Math.round((vC / total) * 100) : 0;
    kpiCandidato.textContent = pC + '%';
    barCandidato.style.width = pC + '%';
  }

  // Tabla por consulta
  const tablaConsultas = document.getElementById('tablaConsultas');
  if (!tablaConsultas) return;

  const sumConsulta = (DATA.consultas || []).map(c => {
    const names = (c.candidates || []).map(s => bySlug[s]?.name).filter(Boolean);
    const votos = names.reduce((acc, n) => acc + ((globalTotals.candidates && globalTotals.candidates[n]) ? globalTotals.candidates[n] : 0), 0);
    return { title: c.title, votos };
  });

  const rows = sumConsulta.map(({ title, votos }) => {
    const pct = total > 0 ? Math.round((votos / total) * 100) : 0;
    return `
      <tr>
        <td class="t-left">${title}</td>
        <td class="t-right">${votos}</td>
        <td class="t-right">${pct}%</td>
      </tr>
      <tr class="row-meter">
        <td colspan="3">
          <div class="meter meter--thin"><div class="meter__bar" style="width:${pct}%"></div></div>
        </td>
      </tr>
    `;
  }).join('');

  const empty = '<tr><td colspan="3" class="muted t-left">Aún no hay votos registrados.</td></tr>';

  tablaConsultas.innerHTML = `
    <table class="table">
      <thead>
        <tr><th class="t-left">Consulta</th><th class="t-right">Votos</th><th class="t-right">%</th></tr>
      </thead>
      <tbody>${rows || empty}</tbody>
      ${total > 0 ? `<tfoot><tr class="total"><td class="t-left">Total</td><td class="t-right">${total}</td><td class="t-right">100%</td></tr></tfoot>` : ''}
    </table>
  `;
}

// ========= Init =========
async function init(){
  try{
    await loadData();
    render();
    updateGlobalUI();

    // si ya votó, mostramos el panel (sin nombre) solo cuando haya selección
    if (hasVoted()) lockVotingUI();

    // métricas
    fetchGlobalTotals();
    setInterval(fetchGlobalTotals, POLL_INTERVAL_MS);
  } catch (e){
    console.error(e);
    toast('Error cargando el tarjetón. Revisa que data.json exista y que main.js no tenga errores.');
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
