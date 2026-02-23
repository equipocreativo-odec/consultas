// Tarjetón interactivo (GitHub Pages)
// - Renderiza candidatos desde data.json
// - Permite marcar uno o varios candidatos
//   * Si se marca MÁS de uno y se confirma el voto, se registra como "VOTOS NULOS"
// - Un voto por dispositivo (localStorage)
// - Consulta métricas en tiempo real desde Google Apps Script

const API_URL = "https://script.google.com/macros/s/AKfycbzrcOa_YqUlAyU9ECe99Bosk_VQttAOmB5l3oLy2dmeL0Cg9gTiHd133pxn0qsKd-MvJA/exec";
const POLL_INTERVAL_MS = 7000;
const NULL_LABEL = "VOTOS NULOS";

let DATA = null;
let bySlug = {};
let selectedSlugs = new Set();
let selectedName = null;
let globalTotals = { total: 0, candidates: {} };
let lastSent = null;

const KEYS = { deviceId: 'consulta_device_id_8m', hasVoted: 'consulta_has_voted_8m' };

function getCookie(name){
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name, value, days=365){
  const maxAge = days*24*60*60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}
function getDeviceId(){
  let id = localStorage.getItem(KEYS.deviceId) || getCookie('device_id_8m');
  if (!id){
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('dev-' + Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem(KEYS.deviceId, id);
    setCookie('device_id_8m', id, 365);
  }
  return id;
}
function hasVoted(){ return localStorage.getItem(KEYS.hasVoted) === 'true'; }
function markVoted(){ localStorage.setItem(KEYS.hasVoted, 'true'); }

function toast(msg){
  let el = document.getElementById('__toast');
  if (!el){
    el = document.createElement('div');
    el.id='__toast';
    el.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:.95rem;z-index:9999;opacity:.98';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.style.display='block';
  clearTimeout(el.__t);
  el.__t=setTimeout(()=>{el.style.display='none'},2200);
}

function setMetricsStatus(msg){
  const el = document.getElementById('metricsStatus');
  if (el) el.textContent = msg;
}

function lockVotingUI(){
  document.querySelectorAll('.tile').forEach(t=>{t.classList.add('disabled'); t.style.pointerEvents='none';});
  const btn = document.getElementById('btnVotar');
  if (btn){ btn.disabled = true; btn.textContent = 'Voto registrado'; }
}

function focusTile(el){
  if (!el) return;
  document.querySelectorAll('.tile').forEach(t=>t.setAttribute('tabindex','-1'));
  el.setAttribute('tabindex','0');
  el.focus();
}

function updateVoteButton(){
  const btn = document.getElementById('btnVotar');
  if (!btn) return;
  btn.disabled = hasVoted() || selectedSlugs.size === 0;
}

async function loadData(){
  const res = await fetch('data.json', { cache:'no-store' });
  if (!res.ok) throw new Error('No se pudo cargar data.json ('+res.status+')');
  DATA = await res.json();
  bySlug = Object.fromEntries((DATA.records || []).map(r=>[r.slug, r]));
}

function render(){
  const content = document.getElementById('content');
  if (!content || !DATA) return;
  content.innerHTML='';

  (DATA.consultas || []).forEach((g, gidx)=>{
    const sec = document.createElement('section');
    sec.className='consulta';

    const h = document.createElement('h2');
    h.textContent = g.title || '';
    sec.appendChild(h);

    if (g.subtitle){
      const p = document.createElement('p');
      p.className='subtitle';
      p.textContent=g.subtitle;
      sec.appendChild(p);
    }

    const grid = document.createElement('div');
    grid.className='grid';

    (g.candidates || []).forEach((slug, idx)=>{
      const c = bySlug[slug];
      if (!c) return;

      const tile = document.createElement('div');
      tile.className='tile';
      tile.setAttribute('role','checkbox');
      tile.setAttribute('aria-checked', selectedSlugs.has(slug) ? 'true':'false');
      tile.setAttribute('tabindex', (gidx===0 && idx===0) ? '0':'-1');
      tile.dataset.slug=slug;

      tile.innerHTML = `
        <img class="photo" loading="lazy" src="${c.photo}" alt="Foto de ${c.name}" onerror="this.onerror=null;this.src='assets/photo-placeholder.png';">
        <div class="logo-wrap"><img class="logo" loading="lazy" src="${c.logo}" alt="Logo de ${c.name}" onerror="this.onerror=null;this.src='assets/logo-placeholder.png';"></div>
        <div class="name">${c.name}</div>
        <div class="xmark">X</div>
      `;

      if (selectedSlugs.has(slug)) tile.classList.add('selected');

      tile.addEventListener('click', ()=>toggleBySlug(slug));
      tile.addEventListener('keydown', (e)=>{
        const tiles=[...sec.querySelectorAll('.tile')];
        const i=tiles.indexOf(tile); const max=tiles.length-1;
        if (e.key==='Enter' || e.key===' ') { e.preventDefault(); toggleBySlug(slug); }
        else if (e.key==='ArrowRight' || e.key==='ArrowDown') { e.preventDefault(); focusTile(tiles[Math.min(max,i+1)]); }
        else if (e.key==='ArrowLeft' || e.key==='ArrowUp') { e.preventDefault(); focusTile(tiles[Math.max(0,i-1)]); }
      });

      grid.appendChild(tile);
    });

    sec.appendChild(grid);
    content.appendChild(sec);
  });

  if (hasVoted()) lockVotingUI();
  updateVoteButton();
}

function toggleBySlug(slug){
  if (hasVoted()){ toast('Ya registraste tu participación en este dispositivo.'); return; }
  if (selectedSlugs.has(slug)) selectedSlugs.delete(slug); else selectedSlugs.add(slug);
  const el = document.querySelector(`.tile[data-slug="${slug}"]`);
  if (el){
    const on = selectedSlugs.has(slug);
    el.classList.toggle('selected', on);
    el.setAttribute('aria-checked', on ? 'true':'false');
  }
  updateVoteButton();
}

async function enviarRegistro(valorVoto, deviceId){
  try{
    await fetch(API_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ candidato: valorVoto, deviceId }) });
    lastSent = deviceId;
  } catch (_e){ /* silencioso */ }
}

function confirmarVoto(){
  if (hasVoted()){ toast('Ya registraste tu participación en este dispositivo.'); return; }
  if (selectedSlugs.size===0){ toast('Marca al menos un candidato para registrar el voto.'); return; }

  let valorVoto = NULL_LABEL;
  let textoPanel = NULL_LABEL;

  if (selectedSlugs.size===1){
    const slug=[...selectedSlugs][0];
    const rec=bySlug[slug];
    valorVoto = rec ? rec.name : NULL_LABEL;
    textoPanel = valorVoto;
  } else {
    textoPanel = `${NULL_LABEL} (marcaste ${selectedSlugs.size})`;
  }

  selectedName = valorVoto;
  markVoted();
  lockVotingUI();
  toast('Tu voto ha sido registrado.');

  const pv=document.getElementById('panelVoto'); if (pv) pv.hidden=false;
  const sn=document.getElementById('selNombre'); if (sn) sn.textContent=textoPanel;

  const deviceId=getDeviceId();
  if (lastSent !== deviceId) enviarRegistro(valorVoto, deviceId);

  // Forzar una lectura de métricas después de votar
  fetchGlobalTotals();
}

async function fetchGlobalTotals(){
  const url = API_URL + '?metrics=1&t=' + Date.now();
  try{
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok){
      setMetricsStatus('Resultados no disponibles (HTTP ' + res.status + ').');
      return;
    }
    const data = await res.json();
    const total = Number(data?.total);
    const candidates = data?.candidates;
    if (!Number.isFinite(total) || !candidates || typeof candidates !== 'object'){
      setMetricsStatus('Resultados no disponibles (respuesta inválida).');
      return;
    }
    globalTotals = { total, candidates };
    setMetricsStatus('Resultados en tiempo real. Última actualización: ' + new Date().toLocaleTimeString());
    updateGlobalUI();
  } catch (e){
    setMetricsStatus('Sin conexión con resultados en tiempo real.');
    console.error('metrics fetch error', e);
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
    const p = total > 0 ? Math.round((v/total)*100) : 0;
    kpiCandidato.textContent = p + '%';
    barCandidato.style.width = p + '%';
  }

  const tablaConsultas = document.getElementById('tablaConsultas');
  if (!tablaConsultas) return;

  const sumConsulta = (DATA.consultas || []).map(c => {
    const names = (c.candidates || []).map(s => bySlug[s]?.name).filter(Boolean);
    const votos = names.reduce((acc,n)=> acc + ((globalTotals.candidates && globalTotals.candidates[n]) ? globalTotals.candidates[n] : 0), 0);
    return { title: c.title, votos };
  });

  const nullVotes = (globalTotals.candidates && globalTotals.candidates[NULL_LABEL]) ? globalTotals.candidates[NULL_LABEL] : 0;

  const rowsConsultas = sumConsulta.map(({title, votos})=>{
    const pct = total > 0 ? Math.round((votos/total)*100) : 0;
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

  const pctNull = total > 0 ? Math.round((nullVotes/total)*100) : 0;
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

  // SIEMPRE incluimos votos nulos, aunque total sea 0
  const bodyHtml = (rowsConsultas || '') + rowNull;

  tablaConsultas.innerHTML = `
    <table class="table">
      <thead>
        <tr><th class="t-left">Categoría</th><th class="t-right">Votos</th><th class="t-right">%</th></tr>
      </thead>
      <tbody>${bodyHtml}</tbody>
      ${total > 0 ? `<tfoot><tr class="total"><td class="t-left">Total</td><td class="t-right">${total}</td><td class="t-right">100%</td></tr></tfoot>` : ''}
    </table>
  `;
}

async function init(){
  try{
    await loadData();
    render();
    updateGlobalUI();

    const btn = document.getElementById('btnVotar');
    if (btn) btn.addEventListener('click', confirmarVoto);

    if (hasVoted()) lockVotingUI();

    setMetricsStatus('Actualizando resultados…');
    fetchGlobalTotals();
    setInterval(fetchGlobalTotals, POLL_INTERVAL_MS);
  } catch (e){
    console.error(e);
    toast('Error cargando el tarjetón. Revisa que data.json exista y que main.js no tenga errores.');
    setMetricsStatus('Resultados no disponibles.');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
