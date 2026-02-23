// ====== Config ======
const API_URL = "https://script.google.com/macros/s/AKfycbzrcOa_YqUlAyU9ECe99Bosk_VQttAOmB5l3oLy2dmeL0Cg9gTiHd133pxn0qsKd-MvJA/exec"; // <-- tu WebApp

// ====== Datos (candidatos + consultas) ======
const DATA = {
  records: [
    { name: "Claudia Nayibe López Hernández", slug: "claudia-nayibe-lopez-hernandez", photo: "assets/photo-claudia-nayibe-lopez-hernandez.png", logo: "assets/logo-claudia-nayibe-lopez-hernandez.png" },
    { name: "Leonardo Humberto Huerta Gutiérrez", slug: "leonardo-humberto-huerta-gutierrez", photo: "assets/photo-leonardo-humberto-huerta-gutierrez.png", logo: "assets/logo-leonardo-humberto-huerta-gutierrez.png" },
    { name: "Mauricio Cárdenas Santamaría", slug: "mauricio-cardenas-santamaria", photo: "assets/photo-mauricio-cardenas-santamaria.png", logo: "assets/logo-mauricio-cardenas-santamaria.png" },
    { name: "David Andrés Luna Sánchez", slug: "david-andres-luna-sanchez", photo: "assets/photo-david-andres-luna-sanchez.png", logo: "assets/logo-david-andres-luna-sanchez.png" },
    { name: "Victoria Eugenia Dávila Hoyos", slug: "victoria-eugenia-davila-hoyos", photo: "assets/photo-victoria-eugenia-davila-hoyos.png", logo: "assets/logo-victoria-eugenia-davila-hoyos.png" },
    { name: "Juan Manuel Galán Pachón", slug: "juan-manuel-galan-pachon", photo: "assets/photo-juan-manuel-galan-pachon.png", logo: "assets/logo-juan-manuel-galan-pachon.png" },
    { name: "Paloma Susana Valencia Laserna", slug: "paloma-susana-valencia-laserna", photo: "assets/photo-paloma-susana-valencia-laserna.png", logo: "assets/logo-paloma-susana-valencia-laserna.png" },
    { name: "Juan Carlos Pinzón Bueno", slug: "juan-carlos-pinzon-bueno", photo: "assets/photo-juan-carlos-pinzon-bueno.png", logo: "assets/logo-juan-carlos-pinzon-bueno.png" },
    { name: "Aníbal Gaviria Correa", slug: "anibal-gaviria-correa", photo: "assets/photo-anibal-gaviria-correa.png", logo: "assets/logo-anibal-gaviria-correa.png" },
    { name: "Enrique Peñalosa Londoño", slug: "enrique-penalosa-londono", photo: "assets/photo-enrique-penalosa-londono.png", logo: "assets/logo-enrique-penalosa-londono.png" },
    { name: "Juan Daniel Oviedo Arango", slug: "juan-daniel-oviedo-arango", photo: "assets/photo-juan-daniel-oviedo-arango.png", logo: "assets/logo-juan-daniel-oviedo-arango.png" },
    { name: "Héctor Elías Pineda Salazar", slug: "hector-elias-pineda-salazar", photo: "assets/photo-hector-elias-pineda-salazar.png", logo: "assets/logo-hector-elias-pineda-salazar.png" },
    { name: "Edison Lucio Torres Moreno", slug: "edison-lucio-torres-moreno", photo: "assets/photo-edison-lucio-torres-moreno.png", logo: "assets/logo-edison-lucio-torres-moreno.png" },
    { name: "Roy Leonardo Barreras Montealegre", slug: "roy-leonardo-barreras-montealegre", photo: "assets/photo-roy-leonardo-barreras-montealegre.png", logo: "assets/logo-roy-leonardo-barreras-montealegre.png" },
    { name: "Martha Viviana Bernal Amaya", slug: "martha-viviana-bernal-amaya", photo: "assets/photo-martha-viviana-bernal-amaya.png", logo: "assets/logo-martha-viviana-bernal-amaya.png" },
    { name: "Daniel Quintero Calle", slug: "daniel-quintero-calle", photo: "assets/photo-daniel-quintero-calle.png", logo: "assets/logo-daniel-quintero-calle.png" }
  ],
  consultas: [
    { title: "Consulta de las Soluciones", subtitle: "Salud, seguridad y educación", candidates: ["claudia-nayibe-lopez-hernandez","leonardo-humberto-huerta-gutierrez"] },
    { title: "La Gran Consulta por Colombia", subtitle: "", candidates: ["mauricio-cardenas-santamaria","david-andres-luna-sanchez","victoria-eugenia-davila-hoyos","juan-manuel-galan-pachon","paloma-susana-valencia-laserna","juan-carlos-pinzon-bueno","anibal-gaviria-correa","enrique-penalosa-londono","juan-daniel-oviedo-arango"] },
    { title: "Consulta del Frente por la Vida", subtitle: "", candidates: ["hector-elias-pineda-salazar","edison-lucio-torres-moreno","roy-leonardo-barreras-montealegre","martha-viviana-bernal-amaya","daniel-quintero-calle"] }
  ]
};

// ====== Mapeos ======
const bySlug = Object.fromEntries(DATA.records.map(r => [r.slug, r]));

// Mapa candidato -> consulta (por nombre)
const consultaByCandidate = (() => {
  const m = {};
  DATA.consultas.forEach(con => con.candidates.forEach(slug => {
    const nm = bySlug[slug]?.name; if (nm) m[nm] = con.title;
  }));
  return m;
})();

// ====== Estado global ======
let selectedName = null; // candidato elegido en este dispositivo
let globalTotals = { total: 0, candidates: {} }; // totales globales del endpoint

// ====== Utilidades “un voto por dispositivo” ======
const KEYS = { deviceId: 'consulta_device_id_8m', hasVoted: 'consulta_has_voted_8m' };
function getCookie(n){
  const m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(n,v,d=365){
  const s = d*24*60*60; document.cookie = `${n}=${encodeURIComponent(v)}; path=/; max-age=${s}`;
}
function getDeviceId(){
  let id = localStorage.getItem(KEYS.deviceId) || getCookie('device_id_8m');
  if (!id){
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('dev-' + Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem(KEYS.deviceId, id); setCookie('device_id_8m', id, 365);
  }
  return id;
}
function hasVoted(){ return localStorage.getItem(KEYS.hasVoted) === 'true'; }
function markVoted(){ localStorage.setItem(KEYS.hasVoted, 'true'); }

// ====== Toast ======
function toast(msg){
  let el = document.getElementById('__toast');
  if(!el){
    el = document.createElement('div'); el.id='__toast';
    el.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);font-size:.95rem;z-index:9999;opacity:.98';
    document.body.appendChild(el);
  }
  el.textContent=msg; el.style.display='block'; clearTimeout(el.__t); el.__t=setTimeout(()=>{el.style.display='none'}, 2200);
}

// ====== Render ======
function render(){
  const content = document.getElementById('content');
  if(!content) return;
  content.innerHTML = '';

  DATA.consultas.forEach((g, gidx) => {
    const sec = document.createElement('section');
    sec.className = 'consulta';

    const h = document.createElement('h2'); h.textContent = g.title; sec.appendChild(h);
    if (g.subtitle){
      const p = document.createElement('p'); p.className='subtitle'; p.textContent=g.subtitle; sec.appendChild(p);
    }

    const grid = document.createElement('div'); grid.className='grid';

    g.candidates.forEach((slug, idx) => {
      const c = bySlug[slug]; if(!c) return;
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'radio');
      tile.setAttribute('aria-checked', 'false');
      tile.setAttribute('tabindex', (gidx===0 && idx===0) ? '0' : '-1');
      tile.dataset.slug = slug;

      tile.innerHTML = `
        <img class="photo" loading="lazy" src="${c.photo}" alt="Foto de ${c.name}" onerror="this.onerror=null;this.src='assets/photo-placeholder.png';">
        <div class="logo-wrap"><img class="logo" loading="lazy" src="${c.logo}" alt="Logo de ${c.name}" onerror="this.onerror=null;this.src='assets/logo-placeholder.png';"></div>
        <div class="name">${c.name}</div>
        <div class="xmark">X</div>`;

      tile.addEventListener('click', () => selectBySlug(slug));
      tile.addEventListener('keydown', (e) => {
        const tiles = [...sec.querySelectorAll('.tile')];
        const i = tiles.indexOf(tile); const max = tiles.length - 1;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBySlug(slug); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusTile(tiles[Math.min(max, i+1)]); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusTile(tiles[Math.max(0, i-1)]); }
      });

      grid.appendChild(tile);
    });

    sec.appendChild(grid); content.appendChild(sec);
  });

  if (hasVoted()) lockVotingUI();
}

function focusTile(el){
  if(!el) return; document.querySelectorAll('.tile').forEach(t=>t.setAttribute('tabindex','-1')); el.setAttribute('tabindex','0'); el.focus();
}

function lockVotingUI(){
  document.querySelectorAll('.tile').forEach(t=>{ t.classList.add('disabled'); t.style.pointerEvents='none'; });
}

// ====== Envío del registro (silencioso) ======
let lastSent = null;
async function enviarRegistro(nombreCandidato, deviceId){
  try{
    await fetch(API_URL, {
      method:'POST', mode:'no-cors',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ candidato:nombreCandidato, deviceId })
    });
    lastSent = deviceId;
  }catch(e){ /* silencioso */ }
}

// ====== Selección única + un voto por dispositivo ======
function selectBySlug(slug){
  if (hasVoted()){ toast('Ya registraste tu participación en este dispositivo.'); return; }

  // Limpia selección
  document.querySelectorAll('.tile').forEach(t=>{ t.classList.remove('selected'); t.setAttribute('aria-checked','false'); });
  const chosen = document.querySelector(`.tile[data-slug="${slug}"]`);
  if (chosen){ chosen.classList.add('selected'); chosen.setAttribute('aria-checked','true'); }

  // Estado
  const rec = bySlug[slug]; selectedName = rec ? rec.name : null; if(!selectedName) return;

  // Bloquea y marca (solo 1 vez por dispositivo)
  markVoted(); lockVotingUI(); toast('Tu selección ha sido registrada.');

  // Notifica al backend (con deviceId para evitar duplicados)
  const deviceId = getDeviceId();
  if (lastSent !== deviceId) enviarRegistro(selectedName, deviceId);

  // Muestra panel; porcentajes globales se actualizan en el próximo fetch
  const pv = document.getElementById('panelVoto'); if (pv) pv.hidden = false;
  const sn = document.getElementById('selNombre'); if (sn) sn.textContent = selectedName;
}

// ====== Lectura de métricas globales (vivo) ======
async function fetchGlobalTotals(){
  try{
    const res = await fetch(API_URL + '?metrics=1', { cache:'no-cache' });
    const data = await res.json();
    if (!data || typeof data.total !== 'number' || !data.candidates) return;
    globalTotals = data;
    updateGlobalUI();
  }catch(e){ /* ignorar */ }
}

function updateGlobalUI(){
  const total = globalTotals.total || 0;

  // KPI candidato seleccionado (global)
  if (selectedName){
    const vC = globalTotals.candidates[selectedName] || 0;
    const pC = total>0 ? Math.round((vC/total)*100) : 0;
    const kpiTotal = document.getElementById('kpiTotal'); if (kpiTotal) kpiTotal.textContent = String(total);
    const kpiCandidato = document.getElementById('kpiCandidato'); if (kpiCandidato) kpiCandidato.textContent = pC + '%';
    const barCandidato = document.getElementById('barCandidato'); if (barCandidato) barCandidato.style.width = pC + '%';
  } else {
    const kpiTotal = document.getElementById('kpiTotal'); if (kpiTotal) kpiTotal.textContent = String(total);
  }

  // Tabla por consulta (global)
  const sumConsulta = DATA.consultas.map(c => {
    const names = c.candidates.map(s => bySlug[s]?.name).filter(Boolean);
    const votos = names.reduce((acc,n) => acc + (globalTotals.candidates[n] || 0), 0);
    return { title:c.title, votos };
  });

  const rows = sumConsulta.map(({title,votos}) => {
    const pct = total>0 ? Math.round((votos/total)*100) : 0;
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
      </tr>`;
  }).join('');

  const tablaConsultas = document.getElementById('tablaConsultas');
  if (tablaConsultas){
    tablaConsultas.innerHTML = `
      <table class="table">
        <thead>
          <tr><th class="t-left">Consulta</th><th class="t-right">Votos</th><th class="t-right">%</th></tr>
        </thead>
        <tbody>${ rows || '<tr><td colspan="3" class="muted t-left">Aún no hay votos registrados.</td></tr>' }</tbody>
        ${ total>0 ? `<tfoot><tr class="total"><td class="t-left">Total</td><td class="t-right">${total}</td><td class="t-right">100%</td></tr></tfoot>` : '' }
      </table>`;
  }
}

// ====== Init ======
function init(){
  render();
  fetchGlobalTotals(); // primera carga
  setInterval(fetchGlobalTotals, 7000); // ~cada 7s
  if (hasVoted()) lockVotingUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
