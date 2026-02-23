// Tarjetón interactivo (GitHub Pages)
// - Renderiza candidatos desde data.json
// - Permite marcar uno o varios candidatos
//   * Si se marca MÁS de uno y se confirma el voto, se registra como "VOTOS NULOS"
// - Un voto por dispositivo (localStorage)
// - (Opcional) Reporta el voto y consulta métricas en Google Apps Script

// ========= Config =========
const API_URL = "https://script.google.com/macros/s/AKfycbzrcOa_YqUlAyU9ECe99Bosk_VQttAOmB5l3oLy2dmeL0Cg9gTiHd133pxn0qsKd-MvJA/exec";
const POLL_INTERVAL_MS = 7000;
const NULL_LABEL = "VOTOS NULOS"; // clave usada en el backend/metrics

// ========= Estado =========
let DATA = null;
let bySlug = {};
let selectedSlugs = new Set();
let selectedName = null; // nombre de candidato (si único) o NULL_LABEL (si nulo)
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
  const btn = document.getElementById('btnVotar');
  if (btn){
    btn.disabled = true;
    btn.textContent = 'Voto registrado';
  }
}

function focusTile(el){
  if (!el) return;
  document.querySelectorAll('.tile').forEach(t => t.setAttribute('tabindex','-1'));
  el.setAttribute('tabindex','0');
  el.focus();
}

function updateVoteButton(){
  const btn = document.getElementById('btnVotar');
  if (!btn) return;
  btn.disabled = hasVoted() || selectedSlugs.size === 0;
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
      tile.setAttribute('role', 'checkbox');
      tile.setAttribute('aria-checked', 'false');
      tile.setAttribute('tabindex', (gidx === 0 && idx === 0) ? '0' : '-1');
      tile.dataset.slug = slug;

      tile.innerHTML = `
        <img class="photo" loading="lazy" src="${c.photo}" alt="Foto de ${c.name}" onerror="this.onerror=null;this.src='assets/photo-placeholder.png';">
        <div class="logo-wrap"><img class="logo" loading="lazy" src="${c.logo}" alt="Logo de ${c.name}" onerror="this.onerror=null;this.src='assets/logo-placeholder.png';"></div>
        <div class="name">${c.name}</div>
        <div class="xmark">X</div>
      `;

      tile.addEventListener('click', () => toggleBySlug(slug));
      tile.addEventListener('keydown', (e) => {
        const tiles = [...sec.querySelectorAll('.tile')];
        const i = tiles.indexOf(tile);
        const max = tiles.length - 1;

        if (e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          toggleBySlug(slug);
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
  updateVoteButton();
}

// ========= Selección múltiple =========
function toggleBySlug(slug){
  if (hasVoted()){
    toast('Ya registraste tu participación en este dispositivo.');
    return;
  }

  if (selectedSlugs.has(slug)) selectedSlugs.delete(slug);
  else selectedSlugs.add(slug);

  const el = document.querySelector(`.tile[data-slug="${slug}"]`);
  if (el){
    const isOn = selectedSlugs.has(slug);
    el.classList.toggle('selected', isOn);
    el.setAttribute('aria-checked', isOn ? 'true' : 'false');
  }

  updateVoteButton();
}

// ========= Envío del voto (opcional) =========
async function enviarRegistro(valorVoto, deviceId){
  if (!API_URL) return;
  try{
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidato: valorVoto, deviceId })
    });
    lastSent = deviceId;
  } catch (_e){
    // intencional: silencioso
  }
}

// ========= Confirmación del voto =========
function confirmarVoto(){
  if (hasVoted()){
    toast('Ya registraste tu participación en este dispositivo.');
    return;
  }

  if (selectedSlugs.size === 0){
    toast('Marca al menos un candidato para registrar el voto.');
    return;
  }

  // Regla: más de un marcado => VOTOS NULOS
  let valorVoto = NULL_LABEL;
  let textoPanel = NULL_LABEL;

  if (selectedSlugs.size === 1){
    const slug = [...selectedSlugs][0];
    const rec = bySlug[slug];
    valorVoto = rec ? rec.name : NULL_LABEL;
    textoPanel = valorVoto;
  } else {
    textoPanel = `${NULL_LABEL} (marcaste ${selectedSlugs.size})`;
  }

  selectedName = valorVoto;

  markVoted();
  lockVotingUI();
  toast('Tu voto ha sido registrado.');

  const pv = document.getElementById('panelVoto');
  if (pv) pv.hidden = false;
  const sn = document.getElementById('selNombre');
  if (sn) sn.textContent = textoPanel;

  const deviceId = getDeviceId();
  if (lastSent !== deviceId) enviarRegistro(valorVoto, deviceId);

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

  const kpiTotal = document.getElementById('kpiTotal');
  if (kpiTotal) kpiTotal.textContent = String(total);

  const kpiCandidato = document.getElementById('kpiCandidato');
  const barCandidato = document.getElementById('barCandidato');
  if (selectedName && kpiCandidato && barCandidato){
    const v = (globalTotals.candidates && globalTotals.candidates[selectedName]) ? globalTotals.candidates[selectedName] : 0;
    const p = total > 0 ? Math.round((v / total) * 100) : 0;
    kpiCandidato.textContent = p + '%';
    barCandidato.style.width = p + '%';
  }

  const tablaConsultas = document.getElementById('tablaConsultas');
  if (!tablaConsultas) return;

  const sumConsulta = (DATA.consultas || []).map(c => {
    const names = (c.candidates || []).map(s => bySlug[s]?.name).filter(Boolean);
    const votos = names.reduce((acc, n) => acc + ((globalTotals.candidates && globalTotals.candidates[n]) ? globalTotals.candidates[n] : 0), 0);
    return { title: c.title, votos };
  });

  const nullVotes = (globalTotals.candidates && globalTotals.candidates[NULL_LABEL]) ? globalTotals.candidates[NULL_LABEL] : 0;

  const rowsConsultas = sumConsulta.map(({ title, votos }) => {
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

  const pctNull = total > 0 ? Math.round((nullVotes / total) * 100) : 0;
  const rowNull = `
    <tr class="row-null">
      <td class="t-left">${NULL_LABEL}</td>
      <td class="t-right">${nullVotes}</td>
      <td class="t-right">${pctNull}%</td>
    </tr>
    <tr class="row-meter row-null">
      <td colspan="3">
        <div class="meter meter--thin"><div class="meter__bar meter__bar--null" style="width:${pctNull}%"></div></div>
      </td>
    </tr>
  `;

  const empty = '<tr><td colspan="3" class="muted t-left">Aún no hay votos registrados.</td></tr>';

  const bodyHtml = (rowsConsultas || '') + (total > 0 ? rowNull : '');

  tablaConsultas.innerHTML = `
    <table class="table">
      <thead>
        <tr><th class="t-left">Categoría</th><th class="t-right">Votos</th><th class="t-right">%</th></tr>
      </thead>
      <tbody>${bodyHtml || empty}</tbody>
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

    const btn = document.getElementById('btnVotar');
    if (btn) btn.addEventListener('click', confirmarVoto);

    if (hasVoted()) lockVotingUI();

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
