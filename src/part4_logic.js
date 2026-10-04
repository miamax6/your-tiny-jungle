<script>
"use strict";

/* ══════════════ EMPREINTE DU DOCUMENT VIERGE ══════════════
   Capturée AVANT toute écriture dans le DOM. Ce script est le
   dernier du document : à cet instant tout est analysé, et rien
   n'est encore rendu. Une capture plus tardive figerait les cartes
   déjà générées dans le fichier téléchargé. */
const PRISTINE = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const wiki = (page, lg="fr") => `https://${lg}.wikipedia.org/wiki/` + encodeURIComponent(page.replace(/ /g,"_"));
const ecosia = q => "https://www.ecosia.org/images?q=" + encodeURIComponent(q);

/* ── Stagger : 34 ms entre éléments, plafonné à 12 éléments.
      « Keep stagger delays short (30-80ms) » — emilkowalski/skills.
      Au-delà, délai 0 : on ne fait jamais attendre l'utilisateur. */
const STAGGER_STEP = 34, STAGGER_MAX = 12;
const staggerAttr = i => (REDUCED || i >= STAGGER_MAX) ? "" : ` style="--stagger:${i*STAGGER_STEP}ms"`;
const staggerCls  = i => REDUCED ? "" : " stagger";

/* ══════════════════ PERSISTANCE ══════════════════
   localStorage peut échouer (navigation privée, données bloquées).
   Tout est encapsulé : la page doit fonctionner sans. */
const KEY = "maxiskaJungle.v3";
let store = { theme:"light", tab:"plantes", seeds:{} };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) store = Object.assign(store, JSON.parse(raw));
} catch(e){ /* ignoré volontairement */ }
let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch(e){}
    /* Prévient la synchro : définie plus bas, absente si le module
       n'est pas chargé — d'où le garde. */
    if (typeof jgTouch === "function") jgTouch();
  }, 250);
}
const seedState = id => (store.seeds[id] ||= { s:0, n:"" });

/* ══════════════════ CONTENU PILOTÉ PAR LES DONNÉES ══════════════════
   Aucun titre, aucune pièce, aucun texte de climat n'est codé en
   dur dans le HTML : tout vient du bloc #jungle-data. */
function paintSite(){
  document.title = SITE.title;
  $("#heroTitle").textContent = SITE.title;
  $("#barTitle").textContent  = SITE.title;
  $("#footTitle").textContent = SITE.title;
  $("#heroSub").textContent   = SITE.subtitle || "";
  const eb = [SITE.eyebrow, SITE.city].filter(Boolean).join(" · ");
  $("#heroEyebrow").textContent = eb;
  $("#heroEyebrow").hidden = !eb;
  $("#climateLine").textContent = SITE.climate || "";
  $("#climateLine").hidden = !SITE.climate;
  $("#roomLegend").innerHTML = ROOM_LIST.map(r =>
    `<li><span style="flex:none;width:22px;text-align:center">${esc(r.icon)}</span><span><strong>${esc(r.name)}</strong>${
      r.orientation ? " — " + esc(r.orientation) : ""}${r.details ? " (" + esc(r.details) + ")" : ""}</span></li>`).join("");
  const flag = $("#dsFlag");
  if (!IS_CONFIGURED){
    flag.hidden = false;
    flag.classList.add("is-demo");
    flag.innerHTML = `<span><strong>Données d'exemple</strong> — ${PLANTS.length} plantes et ${SEEDS.length} graines dans un appartement de ${SITE.city || "démonstration"}, pour te montrer à quoi ça ressemble. Remplace-les par les tiennes.</span>
      <button type="button" data-setup-btn>Configurer ma jungle</button>`;
  } else if (IS_IMPORTED && DATA.source !== "config"){
    /* Uniquement pour un jeu de données venu d'un fichier. Après un
       simple « Appliquer », la page est la sienne : pas de bandeau. */
    flag.hidden = false;
    flag.innerHTML = `<span>📦 Jeu de données importé — ${PLANTS.length} plantes, ${SEEDS.length} graines, ${ROOM_LIST.length} pièces.</span>
      <button type="button" data-setup-btn>Configurer</button>`;
  }
}

/* ══════════════════ THÈME ══════════════════
   Deux boutons (haut de page et bandeau collant) : un seul état. */
const themeBtns = $$("[data-theme-btn]");
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  themeBtns.forEach(b => {
    b.textContent = b.hasAttribute("data-theme-long")
      ? (t === "dark" ? "☀️ Mode clair" : "🌙 Mode sombre")
      : (t === "dark" ? "☀️" : "🌙");
  });
  store.theme = t; save();
}
applyTheme(store.theme === "dark" ? "dark" : "light");
themeBtns.forEach(b => b.addEventListener("click",
  () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")));

/* ══════════════════ ONGLETS ══════════════════
   Deux pistes superposées, la copie active clippée sur l'onglet
   courant : la couleur du texte bascule sans crossfade sale.
   Recette « Tabs with perfect color transitions » d'emilkowalski. */
const overlay = $("#tabsOverlay");
const tabBtns = $$(".tabs-track .tab");
let currentTab = null;

function moveOverlay(view, animate=true){
  const btn = tabBtns.find(b => b.dataset.view === view);
  if (!btn) return;
  const box = btn.offsetParent || btn.parentElement.parentElement;
  const L = btn.offsetLeft - 4;
  const R = Math.max(0, (box.clientWidth - 8) - L - btn.offsetWidth);
  if (!animate) overlay.style.transition = "none";
  overlay.style.clipPath = `inset(0 ${R}px 0 ${L}px round var(--r-pill))`;
  if (!animate) requestAnimationFrame(() => overlay.style.transition = "");
}

function showTab(view, {animate=true} = {}){
  if (view === currentTab) return;
  currentTab = view;
  tabBtns.forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  $$("[data-minitab]").forEach(b => b.classList.toggle("is-on", b.dataset.minitab === view));
  $$(".view").forEach(v => {
    const on = v.id === "view-" + view;
    v.classList.toggle("is-active", on);
    v.hidden = !on;
  });
  moveOverlay(view, animate);
  store.tab = view; save();

  // Entrée du panneau : jamais depuis scale(0) — opacity + léger décalage.
  if (animate && !REDUCED){
    const panel = $("#view-" + view);
    panel.animate(
      [{ opacity:0, transform:"translateY(6px)" }, { opacity:1, transform:"none" }],
      { duration:240, easing:EASE_OUT }
    );
  }
  renderAll({ stagger:true });
}
tabBtns.forEach(b => b.addEventListener("click", () => showTab(b.dataset.view)));
$$("[data-minitab]").forEach(b => b.addEventListener("click", () => {
  const already = currentTab === b.dataset.minitab;
  showTab(b.dataset.minitab);
  // Changer d'onglet depuis le bandeau collant : on ramène en haut du
  // contenu, sinon on atterrit au milieu d'une liste sans repère.
  const y = $("#view-" + b.dataset.minitab).offsetTop - 74;
  scrollTo({ top: Math.max(0, y), behavior: (REDUCED || already) ? "auto" : "smooth" });
}));

/* ══════════════════ REPLIABLE ══════════════════ */
const fold = $("#legendFold"), foldBtn = $("#legendBtn");
foldBtn.addEventListener("click", () => {
  const open = fold.getAttribute("open-state") === "1";
  fold.setAttribute("open-state", open ? "0" : "1");
  foldBtn.setAttribute("aria-expanded", String(!open));
});

/* ══════════════════ HERO — balancement ══════════════════
   WAAPI : contrôle JS, performance CSS, interruptible.
   Oscillation amortie, feuilles décalées. */
const sway = $("#sway"), leaves = $$(".leaf");
function damped(amp, steps, decay){
  const f = [];
  for (let i = 0; i <= steps; i++){
    const t = i/steps;
    const a = amp * Math.sin(t*Math.PI*2.4) * Math.pow(1-t, decay);
    f.push({ transform:`rotate(${a.toFixed(3)}deg)`, offset:t });
  }
  f[f.length-1].transform = "rotate(0deg)";
  return f;
}
function playSway(scale = 1){
  if (REDUCED) return;
  sway.getAnimations().forEach(a => a.cancel());
  [[-4.5,180,1700],[4,300,1900],[-3.5,420,1800]].forEach(([amp,delay,duration], i) => {
    const leaf = leaves[i]; if (!leaf) return;
    leaf.getAnimations().forEach(a => a.cancel());
    leaf.animate(damped(amp*scale,28,1.4), { duration, delay, easing:"linear" });
  });
  sway.animate(damped(3.4*scale,36,1.6), { duration:2200, easing:"linear" });
}
$("#hero").addEventListener("click", () => playSway(1));
/* Un souffle léger au chargement : c'est un moment rare (une fois
   par ouverture), donc le cadre d'emilkowalski autorise le plaisir.
   Amplitude réduite pour rester un indice, pas une distraction. */
addEventListener("load", () => setTimeout(() => playSway(0.55), 420), { once:true });

/* ══════════════════════════════════════════════════════════
   VUE PLANTES
   ══════════════════════════════════════════════════════════ */
const pState = { q:"", room:"all", sort:"alpha", asc:true };

$("#pRooms").innerHTML = ROOMS.map(r =>
  `<button class="btn${r.k===pState.room?" is-on":""}" type="button" data-room="${esc(r.k)}">${esc(r.lb)}</button>`
).join("");
$("#pRooms").addEventListener("click", e => {
  const b = e.target.closest("[data-room]"); if (!b) return;
  pState.room = b.dataset.room;
  $$("#pRooms .btn").forEach(x => x.classList.toggle("is-on", x === b));
  renderPlants({ stagger:true });
});
$("#pSearch").addEventListener("input", e => { pState.q = e.target.value; renderPlants(); });
$("#pSort").addEventListener("change", e => { pState.sort = e.target.value; renderPlants({ stagger:true }); });
$("#pDir").addEventListener("click", () => {
  pState.asc = !pState.asc;
  $("#pDir").textContent = pState.asc ? "⬇️" : "⬆️";
  renderPlants({ stagger:true });
});

function renderPlants({ stagger=false } = {}){
  const q = pState.q.trim().toLowerCase();
  let list = PLANTS.filter(p =>
    (pState.room === "all" || p.r.includes(pState.room)) &&
    (!q || p.n.toLowerCase().includes(q) || p.l.toLowerCase().includes(q) || p.no.toLowerCase().includes(q))
  );
  if (pState.sort === "alpha") list.sort((a,b) => a.n.localeCompare(b.n,"fr"));
  else if (pState.sort === "light") list.sort((a,b) => (ORDER[a.li]-ORDER[b.li]) || a.n.localeCompare(b.n,"fr"));
  else list.sort((a,b) => (ORDER[a.hu]-ORDER[b.hu]) || a.n.localeCompare(b.n,"fr"));
  if (!pState.asc) list.reverse();

  $("#pCount").textContent = list.length + (list.length > 1 ? " plantes" : " plante");
  $("#pGrid").innerHTML = list.map((p,i) => {
    const chips = p.r.map(r => {
      const m = ROOM_META[r] || {};
      return `<span class="chip" title="${esc((m.n||r) + (m.o ? " — " + m.o : ""))}">${r}</span>`;
    }).join("");
    return `<article class="card card-lift plant${stagger?staggerCls(i):""}" id="p-${slug(p.n)}"${stagger?staggerAttr(i):""}>
      <div>
        <div class="plant-name">${esc(p.n)}</div>
        <div style="display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-top:2px">
          <a class="plant-latin" href="${wiki(p.p,p.lg)}" target="_blank" rel="noopener">${esc(p.l)}</a>
          <a class="photo-link" href="${ecosia(p.l + " plante")}" target="_blank" rel="noopener" title="Voir des photos">📷 photos</a>
        </div>
      </div>
      <div class="plant-rooms">${chips}</div>
      <div class="plant-meta">
        <span class="label">Emplacement idéal</span>
        <span class="plant-where">${esc(p.rt)}</span>
      </div>
      <div class="plant-tags">
        <span class="tag tag-accent">${esc(LIGHT[p.li])}</span>
        <span class="tag tag-leaf">${esc(HUMID[p.hu])}</span>
        <span class="tag">${esc(p.sz)}</span>
      </div>
      <p class="plant-notes">${esc(p.no)}</p>
    </article>`;
  }).join("");
}

/* ── Groupes par exposition ── */
function link(n, suffix=""){
  return `<a class="jump" href="#p-${slug(n)}" data-jump="p-${slug(n)}">${esc(n)}</a>${suffix}`;
}
$("#pGroups").innerHTML = `
  <div class="card group-card" style="background:var(--leaf-soft)">
    <h3>Groupes par exposition recommandée</h3>
    ${GROUPS.map(g => `<div class="group-block"><h5>${esc(g.t)}</h5><p>${g.p.map(n=>link(n)).join(", ")}${g.suffix?esc(g.suffix):""}</p></div>`).join("")}
  </div>
  <div class="card group-card" style="background:var(--accent-soft);align-self:start">
    <h3>Plantes à grouper</h3>
    ${HUMID_GROUPS.map(g => `<div class="group-block"><h5>${esc(g.t)}</h5><p>${g.p.map(n=>link(n)).join(", ")}</p></div>`).join("")}
    <p style="margin-top:14px;font-size:13px;color:var(--text-dim)">
      Grouper les plantes qui ont les mêmes besoins d'humidité crée un microclimat : chacune transpire et fait monter l'hygrométrie autour des autres.
    </p>
  </div>`;

/* ── Saut vers une fiche (plante OU graine) ──────────────────
   Un seul gestionnaire pour les deux vues. Avant, celui des
   plantes écoutait [data-jump] sans filtre et attrapait aussi les
   liens de graines.

   Et surtout : ne JAMAIS appeler getAnimations().cancel() ici. Les
   cartes portent l'animation d'apparition CSS `pop`, dont l'état de
   base est opacity:0 ; l'annuler renvoyait la carte à cet état et
   la faisait disparaître. On retire la classe .stagger (la carte
   reprend son style normal) et le flash passe par sa propre classe. */
function highlight(el){
  el.classList.remove("stagger");
  el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block:"center" });
  if (REDUCED) return;
  el.classList.remove("is-hit");
  void el.offsetWidth;            // force le redémarrage de l'animation
  el.classList.add("is-hit");
}

document.addEventListener("click", e => {
  const a = e.target.closest("[data-jump]"); if (!a) return;
  const id = a.dataset.jump;
  if (!/^[ps]-/.test(id)) return;
  e.preventDefault();
  const seed = id.startsWith("s-");

  // Une fiche de graine n'existe que dans l'onglet Graines, et
  // inversement : on bascule d'abord si besoin.
  showTab(seed ? "graines" : "plantes");

  // Puis on lève les filtres, sinon la cible peut rester masquée.
  if (seed){
    if (sState.q || sState.filter !== "all"){
      sState.q = ""; sState.filter = "all";
      $("#sSearch").value = "";
      $$("#sFilters .btn").forEach(x => x.classList.toggle("is-on", x.dataset.sfilter === "all"));
      renderSeeds();
    }
  } else {
    if (pState.q || pState.room !== "all"){
      pState.q = ""; pState.room = "all";
      $("#pSearch").value = "";
      $$("#pRooms .btn").forEach(x => x.classList.toggle("is-on", x.dataset.room === "all"));
      renderPlants();
    }
  }

  // Deux frames : la première laisse le panneau s'afficher, la
  // seconde garantit que la mise en page est calculée avant le scroll.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) highlight(el);
  }));
});

/* ══════════════════════════════════════════════════════════
   VUE GRAINES
   ══════════════════════════════════════════════════════════ */
const NOW_M = new Date().getMonth() + 1;
const sState = { q:"", filter:"all", sort:"alpha", asc:true };
const firstMonth = s => Math.min(...[...(s.cal.i||[]), ...(s.cal.e||[])].concat([13]));

/* ── Encart « à faire ce mois-ci » ── */
function renderNow(){
  const inside  = SEEDS.filter(s => (s.cal.i||[]).includes(NOW_M));
  const outside = SEEDS.filter(s => (s.cal.e||[]).includes(NOW_M));
  const plant   = SEEDS.filter(s => (s.cal.p||[]).includes(NOW_M));
  const pill = s => `<button class="seed-pill" type="button" data-jump="s-${s.id}">${esc(s.n)}${s.fresh?"":" 🕰️"}</button>`;
  const group = (t,arr) => arr.length
    ? `<div class="now-group"><span class="label">${t}</span><div class="now-list">${arr.map(pill).join("")}</div></div>` : "";
  const body = group("Semis sous abri / intérieur", inside)
             + group("Semis en place / extérieur", outside)
             + group("Repiquage / plantation", plant);
  $("#nowCard").innerHTML = `
    <h3>À faire en ${MONTHS_FULL[NOW_M-1]}</h3>
    <p class="now-sub">Calculé à partir de la date du jour et du calendrier ci-dessous. 🕰️ = lot ancien (6-7 ans).</p>
    ${body || `<p class="now-empty">Rien à semer ce mois-ci. Repos du jardinier — profites-en pour trier tes sachets et tester les vieux lots.</p>`}`;
}

/* ── Astuce lot ancien ── */
$("#oldTip").innerHTML = `
  <div class="card fold" id="tipFold" open-state="0">
    <button class="fold-head" type="button" data-fold="tipFold" aria-expanded="false">
      <span>🕰️ Tester un lot de graines de 6-7 ans</span>
      <span class="fold-arrow">▼</span>
    </button>
    <div class="fold-body"><div>
      <div class="fold-inner" style="display:block">
        <p style="font-size:13.5px;color:var(--text-dim);margin-bottom:10px">
          Avant de réserver une place au potager à un vieux sachet, fais un test de germination : 10 graines sur un papier absorbant humide,
          dans une boîte fermée, au chaud. Compte celles qui germent dans le délai normal de l'espèce. 7/10 → sème normalement ;
          4/10 → double la densité de semis ; moins de 3/10 → le sachet est à jeter.
        </p>
        <p style="font-size:13.5px;color:var(--text-dim)">
          Durées germinatives indicatives (Gerbeaud) : <strong>concombre 10 ans</strong>, <strong>courgette 6-8 ans</strong>,
          <strong>tournesol 7 ans</strong>, <strong>radis 4-5 ans</strong>, <strong>piment/poivron 3 ans</strong>,
          <strong>persil 2 ans</strong>. Dans ton lot ancien, le concombre Akito et la courgette Gold Rush partent gagnants ;
          le radis et la coriandre sont les plus risqués.
        </p>
      </div>
    </div></div>
  </div>`;

document.addEventListener("click", e => {
  const b = e.target.closest("[data-fold]"); if (!b) return;
  const box = document.getElementById(b.dataset.fold);
  const open = box.getAttribute("open-state") === "1";
  box.setAttribute("open-state", open ? "0" : "1");
  b.setAttribute("aria-expanded", String(!open));
});

/* ── Calendrier 12 mois ── */
function renderCal(){
  const head = `<div class="cal-head"><div class="cal-corner"></div>${
    MONTHS.map((m,i) => `<div class="cal-m${i+1===NOW_M?" is-now":""}"><span class="m-long">${m}</span><span class="m-short">${MONTHS_SHORT[i]}</span></div>`).join("")
  }</div>`;
  const rows = [...SEEDS].sort((a,b) => (firstMonth(a)-firstMonth(b)) || a.n.localeCompare(b.n,"fr")).map(s => {
    const cells = MONTHS.map((_,i) => {
      const m = i+1;
      let bars = "";
      if ((s.cal.i||[]).includes(m)) bars += `<span class="bar bar-int" title="Semis sous abri"></span>`;
      if ((s.cal.e||[]).includes(m)) bars += `<span class="bar bar-ext" title="Semis en place"></span>`;
      if ((s.cal.p||[]).includes(m)) bars += `<span class="bar bar-plant" title="Repiquage / plantation"></span>`;
      if ((s.cal.h||[]).includes(m)) bars += `<span class="bar bar-harv" title="Floraison / récolte"></span>`;
      return `<div class="cal-cell${m===NOW_M?" is-now-col":""}">${bars}</div>`;
    }).join("");
    return `<div class="cal-row"><div class="cal-name">
      <a class="cal-seed jump" href="#s-${s.id}" data-jump="s-${s.id}">${esc(s.n)}${s.fresh?"":" 🕰️"}</a>
      <span class="cal-lat">${esc(s.l)}</span>
    </div>${cells}</div>`;
  }).join("");
  $("#calTable").innerHTML = head + rows;
}

/* ── Filtres graines ── */
const SFILTERS = [
  {k:"all",lb:"Toutes"},{k:"fresh",lb:"🌱 Fraîches"},{k:"old",lb:"🕰️ Anciennes (6-7 ans)"},
  {k:"now",lb:"📅 À semer ce mois-ci"},{k:"sown",lb:"✅ Semées"},{k:"todo",lb:"⬜ Pas encore semées"}
];
$("#sFilters").innerHTML = SFILTERS.map(f =>
  `<button class="btn${f.k===sState.filter?" is-on":""}" type="button" data-sfilter="${f.k}">${esc(f.lb)}</button>`
).join("");
$("#sFilters").addEventListener("click", e => {
  const b = e.target.closest("[data-sfilter]"); if (!b) return;
  sState.filter = b.dataset.sfilter;
  $$("#sFilters .btn").forEach(x => x.classList.toggle("is-on", x === b));
  renderSeeds({ stagger:true });
});
$("#sSearch").addEventListener("input", e => { sState.q = e.target.value; renderSeeds(); });
$("#sSort").addEventListener("change", e => { sState.sort = e.target.value; renderSeeds({ stagger:true }); });
$("#sDir").addEventListener("click", () => {
  sState.asc = !sState.asc;
  $("#sDir").textContent = sState.asc ? "⬇️" : "⬆️";
  renderSeeds({ stagger:true });
});

function monthList(arr){
  if (!arr || !arr.length) return "—";
  return arr.slice().sort((a,b)=>a-b).map(m => MONTHS[m-1]).join(" · ");
}

function renderSeeds({ stagger=false } = {}){
  const q = sState.q.trim().toLowerCase();
  let list = SEEDS.filter(s => {
    const st = seedState(s.id);
    if (sState.filter === "fresh" && !s.fresh) return false;
    if (sState.filter === "old"   &&  s.fresh) return false;
    if (sState.filter === "sown"  && !st.s) return false;
    if (sState.filter === "todo"  &&  st.s) return false;
    if (sState.filter === "now"   && !((s.cal.i||[]).includes(NOW_M) || (s.cal.e||[]).includes(NOW_M))) return false;
    if (q && !(s.n.toLowerCase().includes(q) || s.l.toLowerCase().includes(q) || s.no.toLowerCase().includes(q))) return false;
    return true;
  });
  if (sState.sort === "alpha") list.sort((a,b) => a.n.localeCompare(b.n,"fr"));
  else if (sState.sort === "month") list.sort((a,b) => (firstMonth(a)-firstMonth(b)) || a.n.localeCompare(b.n,"fr"));
  else list.sort((a,b) => (b.fresh-a.fresh) || a.n.localeCompare(b.n,"fr"));
  if (!sState.asc) list.reverse();

  const done = SEEDS.filter(s => seedState(s.id).s).length;
  $("#sCount").textContent = `${list.length} graine${list.length>1?"s":""} affichée${list.length>1?"s":""} · ${done}/${SEEDS.length} cochée${done>1?"s":""} comme semée${done>1?"s":""}`;

  $("#sGrid").innerHTML = list.map((s,i) => {
    const st = seedState(s.id);
    const rows = Object.entries(s.f).map(([k,v]) =>
      `<div class="seed-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
    const cal = [
      s.cal.i && s.cal.i.length ? ["Semis abri", monthList(s.cal.i)] : null,
      s.cal.e && s.cal.e.length ? ["Semis en place", monthList(s.cal.e)] : null,
      s.cal.p && s.cal.p.length ? ["Repiquage", monthList(s.cal.p)] : null,
      s.cal.h && s.cal.h.length ? ["Récolte / fleurs", monthList(s.cal.h)] : null
    ].filter(Boolean).map(([k,v]) => `<div class="seed-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const srcs = s.src.map(([lb,u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(lb)}</a>`).join(" · ");
    return `<article class="card card-lift seed${st.s?" is-sown":""}${stagger?staggerCls(i):""}" id="s-${s.id}"${stagger?staggerAttr(i):""}>
      <div class="seed-head">
        <div>
          <div class="seed-name">${esc(s.n)}</div>
          <a class="seed-lat" href="${wiki(s.w)}" target="_blank" rel="noopener">${esc(s.l)}</a>
          <a class="photo-link" style="margin-left:8px" href="${ecosia(s.l + " fleur plante")}" target="_blank" rel="noopener">📷</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex:none">
          <span class="tag ${s.fresh?"tag-leaf":"tag-accent"}">${s.fresh?"🌱 Fraîche":"🕰️ 6-7 ans"}</span>
          <span class="tag">${esc(s.ty)}</span>
        </div>
      </div>
      <dl class="seed-rows">${cal}${rows}</dl>
      <p class="seed-note">${esc(s.no)}</p>
      <label class="sown">
        <input type="checkbox" data-sown="${s.id}"${st.s?" checked":""}>
        <span class="box" aria-hidden="true"></span>
        <span>Semée cette année</span>
      </label>
      <textarea class="note-input" rows="1" placeholder="Note perso (date, emplacement, résultat…)" data-note="${s.id}">${esc(st.n)}</textarea>
      <p style="font-size:11px;color:var(--text-faint)">Source : ${srcs}</p>
    </article>`;
  }).join("");
}

$("#sGrid").addEventListener("change", e => {
  const cb = e.target.closest("[data-sown]"); if (!cb) return;
  const st = seedState(cb.dataset.sown);
  st.s = cb.checked ? 1 : 0;
  cb.closest(".seed").classList.toggle("is-sown", cb.checked);
  const done = SEEDS.filter(s => seedState(s.id).s).length;
  $("#sCount").textContent = $("#sCount").textContent.replace(/\d+\/\d+ coché\S*/, `${done}/${SEEDS.length} cochée${done>1?"s":""}`);
  save();
});
$("#sGrid").addEventListener("input", e => {
  const ta = e.target.closest("[data-note]"); if (!ta) return;
  seedState(ta.dataset.note).n = ta.value;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  save();
});

/* ══════════════════ EXPORT / IMPORT ══════════════════
   Le localStorage est cloisonné par navigateur : c'est le seul
   moyen de transporter ses cases cochées d'une machine à l'autre. */
const ioZone = $("#ioZone"), ioStatus = $("#ioStatus"), ioFile = $("#ioFile");
const STAMP = () => new Date().toISOString().slice(0,10);

function say(msg, err=false){
  ioStatus.textContent = msg;
  ioStatus.classList.toggle("is-err", err);
}

$("#ioExport").addEventListener("click", () => {
  const payload = {
    app: APP_ID,
    version: 4,
    exported: new Date().toISOString(),
    theme: store.theme,
    seeds: store.seeds
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url, download: `${slug(SITE.title)||"your-tiny-jungle"}_notes_${STAMP()}.json`
  });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  const n = Object.values(store.seeds).filter(s => s.s || (s.n||"").trim()).length;
  say(`Sauvegarde téléchargée — ${n} graine${n>1?"s":""} avec une coche ou une note.`);
});

$("#ioImport").addEventListener("click", () => { ioFile.value = ""; ioFile.click(); });

ioFile.addEventListener("change", () => {
  const f = ioFile.files && ioFile.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onerror = () => say("Impossible de lire ce fichier.", true);
  r.onload = () => {
    let data;
    try { data = JSON.parse(r.result); }
    catch(e){ return say("Ce fichier n'est pas du JSON valide.", true); }
    if (!isOurs(data) || typeof data.seeds !== "object" || !data.seeds){
      return say("Ce fichier n'est pas une sauvegarde Your Tiny Jungle.", true);
    }
    const known = new Set(SEEDS.map(s => s.id));
    const entries = Object.entries(data.seeds).filter(([id,v]) =>
      known.has(id) && v && typeof v === "object");
    const checks = entries.filter(([,v]) => v.s).length;
    const notes  = entries.filter(([,v]) => (v.n||"").trim()).length;
    const ignored = Object.keys(data.seeds).length - entries.length;
    if (!entries.length) return say("Sauvegarde lisible, mais elle ne contient aucune graine connue.", true);

    ioZone.innerHTML = `
      <span>Sauvegarde du <strong>${esc((data.exported||"").slice(0,10) || "?")}</strong> —
      ${entries.length} graine${entries.length>1?"s":""}, <strong>${checks}</strong> cochée${checks>1?"s":""},
      <strong>${notes}</strong> note${notes>1?"s":""}${ignored?` · ${ignored} entrée${ignored>1?"s":""} inconnue${ignored>1?"s":""} ignorée${ignored>1?"s":""}`:""}.
      Tes cases et notes actuelles seront remplacées.</span>
      <span class="io-actions">
        <button class="btn is-on" type="button" id="ioOk">Remplacer</button>
        <button class="btn" type="button" id="ioNo">Annuler</button>
      </span>`;
    ioZone.hidden = false;
    say("");
    // La zone de confirmation est plus bas dans la page : on l'amène
    // sous les yeux, sinon le clic sur « Importer » semble sans effet.
    ioZone.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block:"center" });

    $("#ioOk").onclick = () => {
      for (const [id,v] of entries) store.seeds[id] = { s: v.s ? 1 : 0, n: String(v.n || "") };
      if (data.theme === "dark" || data.theme === "light") applyTheme(data.theme);
      save();
      ioZone.hidden = true;
      renderSeeds({ stagger:true });
      say(`Import terminé — ${checks} case${checks>1?"s":""} cochée${checks>1?"s":""} et ${notes} note${notes>1?"s":""} restaurée${notes>1?"s":""}.`);
    };
    $("#ioNo").onclick = () => { ioZone.hidden = true; say("Import annulé, rien n'a changé."); };
  };
  r.readAsText(f);
});

/* ══════════════════ DÉMARRAGE ══════════════════ */
function renderAll({ stagger=false } = {}){
  if (currentTab === "plantes") renderPlants({ stagger });
  else renderSeeds({ stagger });
}
paintSite();
renderNow();
renderCal();
renderSeeds();
renderPlants();
showTab(store.tab === "graines" ? "graines" : "plantes", { animate:false });
moveOverlay(currentTab, false);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveOverlay(currentTab, false));
let rsz; addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => moveOverlay(currentTab, false), 120); });

/* ══════════════ BANDEAU COLLANT + RETOUR EN HAUT ══════════════
   Un seul écouteur de scroll, calé sur requestAnimationFrame et
   passif : pas de travail de mise en page pendant le défilement. */
const topbar = $("#topbar"), toTop = $("#toTop"), heroEl = $("#hero");
let ticking = false, lastTop = null, lastUp = null;

function onScroll(){
  const y = scrollY;
  // Seuil = bas du grand bandeau. Hystérésis de 40 px pour éviter
  // le clignotement quand on s'arrête pile sur la limite.
  const edge = heroEl.offsetTop + heroEl.offsetHeight - 40;
  const showBar = lastTop ? y > edge - 40 : y > edge;
  const showUp  = y > 520;
  if (showBar !== lastTop){
    topbar.classList.toggle("is-on", showBar);
    document.documentElement.classList.toggle("topbar-armed", showBar);
    lastTop = showBar;
  }
  if (showUp  !== lastUp ){ toTop .classList.toggle("is-on", showUp ); lastUp  = showUp;  }
  ticking = false;
}
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(onScroll);
}, { passive:true });
addEventListener("resize", () => { lastTop = null; onScroll(); }, { passive:true });
onScroll();

toTop.addEventListener("click", () => {
  scrollTo({ top:0, behavior: REDUCED ? "auto" : "smooth" });
});

/* ══════════════════════════════════════════════════════════
   ASSISTANT DE CONFIGURATION
   ══════════════════════════════════════════════════════════ */
const setup = $("#setup");
let draft = null;   // copie de travail : rien n'est appliqué avant « Appliquer »

/* Au premier passage on montre la fourche ; une fois configuré,
   ⚙️ doit tomber directement sur les réglages, pas sur un écran
   d'accueil qui ne s'adresse plus à personne. */
function openSetup(startAt){
  draft = {
    title: SITE.title, city: SITE.city, subtitle: SITE.subtitle,
    rooms: ROOM_LIST.map(r => ({...r}))
  };
  $("#fTitle").value = draft.title;
  $("#fCity").value  = draft.city;
  $("#fSub").value   = draft.subtitle;
  drawRooms();
  goStep(startAt != null ? startAt : (IS_CONFIGURED ? 1 : 0));
  setup.hidden = false;
  setup.classList.remove("is-off");
  requestAnimationFrame(() => setup.classList.add("is-on"));
  document.body.style.overflow = "hidden";
  if (!setup.querySelector('.pane[data-pane="0"]').classList.contains("is-on"))
    $("#fTitle").focus({ preventScroll:true });
}
function closeSetup(){
  setup.classList.remove("is-on");
  setup.classList.add("is-off");
  document.body.style.overflow = "";
  const done = () => { setup.hidden = true; setup.classList.remove("is-off"); };
  REDUCED ? done() : setTimeout(done, 150);
}
document.addEventListener("click", e => {
  const sb = e.target.closest("[data-setup-btn]");
  if (sb){ openSetup(); if (sb.hasAttribute("data-sync-step")) goStep(4); return; }
  if (e.target.closest("[data-setup-close]")) return closeSetup();
});
addEventListener("keydown", e => { if (e.key === "Escape" && !setup.hidden) closeSetup(); });

function goStep(n){
  $$(".step").forEach(b => b.classList.toggle("is-on", +b.dataset.step === n));
  $$(".pane").forEach(s => s.classList.toggle("is-on", +s.dataset.pane === n));
  /* Sur la fourche, la barre d'étapes n'a pas de sens : rien n'est
     encore commencé. Et le titre doit dire où l'on est. */
  $("#setupSteps").hidden = (n === 0);
  $("#setupTitle").textContent = n === 0 ? "Bienvenue" : "Configurer la page";
  if (n === 3) buildPrompt();
}
$("#setupSteps").addEventListener("click", e => {
  const b = e.target.closest("[data-step]"); if (b) goStep(+b.dataset.step);
});

/* ── Les trois routes de la fourche ───────────────────────────
   Chacune mène au premier endroit réellement utile, pas à
   l'étape 1 par convention. */
document.addEventListener("click", e => {
  const r = e.target.closest("[data-route]");
  if (!r) return;
  const route = r.dataset.route;
  if (route === "new")     return goStep(1);
  if (route === "restore") return goStep(4);
  if (route === "import"){
    /* On ouvre le sélecteur de fichier tout de suite : l'étape 3
       contient aussi le prompt, qui n'intéresse pas quelqu'un qui
       a déjà ses données. */
    goStep(3);
    $("#dsFile").value = "";
    $("#dsFile").click();
  }
});
["fTitle","fCity","fSub"].forEach(id => $("#"+id).addEventListener("input", e => {
  draft[{fTitle:"title",fCity:"city",fSub:"subtitle"}[id]] = e.target.value;
}));

/* ── Pièces ── */
function drawRooms(){
  $("#roomRows").innerHTML = draft.rooms.map((r,i) => `
    <div class="room-row" data-i="${i}">
      <input class="input r-emo" data-f="icon" value="${esc(r.icon||"")}" maxlength="4" aria-label="Emoji">
      <input class="input" data-f="name" value="${esc(r.name||"")}" placeholder="Nom de la pièce" aria-label="Nom">
      <input class="input r-ori" data-f="orientation" value="${esc(r.orientation||"")}" placeholder="Orientation" list="orientations" aria-label="Orientation">
      <button class="btn" type="button" data-del="${i}" aria-label="Supprimer cette pièce" title="Supprimer">✕</button>
      <input class="input r-det" data-f="details" value="${esc(r.details||"")}" placeholder="Détails (hauteur des fenêtres, largeur…)" aria-label="Détails">
    </div>`).join("") +
    `<datalist id="orientations">${ORIENTATIONS.map(o => `<option value="${o}">`).join("")}</datalist>`;
  checkRooms();
}
$("#roomRows").addEventListener("input", e => {
  const f = e.target.dataset.f; if (!f) return;
  draft.rooms[+e.target.closest(".room-row").dataset.i][f] = e.target.value;
  checkRooms();
});
$("#roomRows").addEventListener("click", e => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const row = b.closest(".room-row");
  const drop = () => { draft.rooms.splice(+b.dataset.del, 1); drawRooms(); };
  if (REDUCED) return drop();
  row.classList.add("is-going");
  setTimeout(drop, 140);
});
$("#addRoom").addEventListener("click", () => {
  draft.rooms.push({ icon:"🪟", name:"", orientation:"", details:"" });
  drawRooms();
  const rows = $$("#roomRows .room-row");
  const last = rows[rows.length-1];
  if (last){ last.classList.add("is-new"); last.querySelector('[data-f="name"]').focus(); }
});

/* Les emojis sont les clés de jointure : on prévient si l'édition
   casse le lien avec des plantes, plutôt que de le faire en silence. */
function checkRooms(){
  const icons = draft.rooms.map(r => r.icon).filter(Boolean);
  const dupes = icons.filter((v,i) => icons.indexOf(v) !== i);
  const used = new Set(PLANTS.flatMap(p => p.r));
  const lost = [...used].filter(i => !icons.includes(i));
  const msgs = [];
  if (dupes.length) msgs.push(`Emoji en double : ${[...new Set(dupes)].join(" ")} — chaque pièce doit avoir le sien.`);
  if (draft.rooms.some(r => !r.icon)) msgs.push("Une pièce n'a pas d'emoji.");
  if (lost.length) msgs.push(`${lost.join(" ")} : plus aucune pièce ne porte cet emoji, les plantes qui le référencent ne seront plus filtrables.`);
  const w = $("#roomWarn");
  w.hidden = !msgs.length;
  w.textContent = msgs.join(" ");
  $("#setupCount").textContent = `${draft.rooms.length} pièce${draft.rooms.length>1?"s":""} · ${PLANTS.length} plantes · ${SEEDS.length} graines`;
}

/* ── Étape 3 : le prompt ── */
function buildPrompt(){
  const rooms = draft.rooms.filter(r => r.icon && r.name);
  const site = { title: draft.title || "Your Tiny Jungle", city: draft.city || "", subtitle: draft.subtitle || "", eyebrow: SITE.eyebrow };
  $("#promptBox").value =
`Tu dois produire UN SEUL fichier JSON, sans aucun texte autour, sans bloc de code markdown.
Ce fichier alimente une application web de gestion de plantes d'intérieur et de semis.

CONTEXTE
Ville : ${site.city || "(à préciser)"}
Avant toute chose, cherche les dates de gelées de cette ville (dernière gelée de printemps, première gelée d'automne, normales climatiques récentes) et cale TOUT le calendrier de semis dessus. Cite la source dans le champ site.climate.

PIÈCES DU LOGEMENT (emoji = clé de jointure, à reprendre à l'identique)
${rooms.map(r => `${r.icon} ${r.name} — ${r.orientation || "?"}${r.details ? " (" + r.details + ")" : ""}`).join("\n") || "(aucune pièce définie)"}

STRUCTURE EXACTE ATTENDUE
{
  "app": "your-tiny-jungle",
  "schema": 1,
  "site": ${JSON.stringify(site)},
  "rooms": ${JSON.stringify(rooms)},
  "plants": [ { "name", "latin", "wikiPage", "wikiLang", "rooms", "placement", "light", "humidity", "size", "notes" } ],
  "plantGroups": [ { "title", "plants" } ],
  "humidityGroups": [ { "title", "plants" } ],
  "seeds": [ { "id", "name", "latin", "wikiPage", "fresh", "type", "calendar", "facts", "notes", "sources" } ]
}

RÈGLES
- "rooms" d'une plante : tableau des emojis des pièces où la poser, repris EXACTEMENT de la liste ci-dessus.
- "light" et "humidity" : uniquement "high", "med" ou "low".
- "wikiPage" : titre exact de la page Wikipédia ; "wikiLang" vaut "fr" ou "en" selon la langue où la page existe.
- "placement" : phrase courte avec les emojis, ex. "🛋️🍽️ éloigné des fenêtres".
- "plantGroups" et "humidityGroups" : "plants" contient des "name" repris à l'identique de la liste plants.
- Graines — "id" : minuscules, sans accent ni espace, unique.
- Graines — "calendar" : { "indoor": [], "outdoor": [], "transplant": [], "harvest": [] }, chaque tableau contenant des numéros de mois de 1 à 12, calés sur les gelées de la ville.
- Graines — "fresh" : true pour un sachet récent, false pour un vieux lot.
- Graines — "facts" : objet libre de 4 à 6 paires clé/valeur courtes (profondeur, espacement, température, germination, hauteur…).
- Graines — "sources" : tableau de [libellé, url]. OBLIGATOIRE, au moins une source réelle et vérifiable par graine. N'invente jamais une URL.
- Si deux sources se contredisent, retiens la plus fiable et explique l'arbitrage dans "notes".
- Tout le texte en français.

EXEMPLE DE PLANTE
{"name":"Monstera","latin":"Monstera deliciosa","wikiPage":"Monstera deliciosa","wikiLang":"fr","rooms":["${(rooms[0]||{}).icon || "🛋️"}"],"placement":"${(rooms[0]||{}).icon || "🛋️"} éloigné des fenêtres","light":"med","humidity":"med","size":"Très grande (2-3 m)","notes":"1,5-3 m des fenêtres, besoin de beaucoup d'espace"}

EXEMPLE DE GRAINE
{"id":"zinnia","name":"Zinnia elegans","latin":"Zinnia elegans","wikiPage":"Zinnia elegans","fresh":true,"type":"Annuelle","calendar":{"indoor":[3,4],"outdoor":[5],"transplant":[5],"harvest":[6,7,8,9,10]},"facts":{"Profondeur":"3 mm","Espacement":"30 cm","Germination":"7-14 jours à 15-25 °C","Hauteur":"15 cm à 1 m"},"notes":"Plantation définitive après les dernières gelées.","sources":[["Promesse de Fleurs","https://www.promessedefleurs.com/conseil-plantes-jardin/fichefamille/zinnia-semis-plantation-entretien/"]]}

MA LISTE
Plantes d'intérieur : (colle ici ta liste)
Graines : (colle ici ta liste, en distinguant les sachets récents des vieux lots)`;
}

$("#copyPrompt").addEventListener("click", async () => {
  const box = $("#promptBox");
  try { await navigator.clipboard.writeText(box.value); dsSay("Prompt copié."); }
  catch(e){ box.select(); dsSay("Copie automatique refusée par le navigateur — le texte est sélectionné, fais Ctrl+C.", true); }
});

/* ── Jeu de données : export / import / réinitialisation ── */
function dsSay(m, err=false){ const s=$("#dsStatus"); s.textContent=m; s.classList.toggle("is-err", err); }

$("#dsExport").addEventListener("click", () => {
  const out = JSON.stringify(DATA, null, 1);
  const url = URL.createObjectURL(new Blob([out], { type:"application/json" }));
  const a = Object.assign(document.createElement("a"), {
    href:url, download:`${slug(SITE.title)||"your-tiny-jungle"}_donnees_${new Date().toISOString().slice(0,10)}.json` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  dsSay(`Données exportées — ${PLANTS.length} plantes, ${SEEDS.length} graines.`);
});

/* ── Télécharger la page avec ses données ──────────────────
   La page se réécrit elle-même : on repart de l'empreinte vierge
   et on remplace le contenu du bloc #jungle-data. Résultat : un
   .html autonome par maison, rien à importer chez le destinataire. */
$("#pageDl").addEventListener("click", () => {
  const OPEN = '<script type="application/json" id="jungle-data">';
  const i = PRISTINE.indexOf(OPEN);
  const j = i < 0 ? -1 : PRISTINE.indexOf("</scr" + "ipt>", i);
  if (i < 0 || j < 0) return dsSay("Impossible de retrouver le bloc de données dans la page.", true);

  const out = Object.assign({}, DATA, { configured:true });
  out.site = Object.assign({}, out.site, {
    title: draft.title || SITE.title, city: draft.city || SITE.city, subtitle: draft.subtitle || SITE.subtitle });
  const rooms = draft.rooms.filter(r => r.icon && r.name);
  if (rooms.length) out.rooms = rooms;

  /* `</` doit être neutralisé, sinon il refermerait le <script>.
     `\/` est un échappement JSON valide. */
  const json = JSON.stringify(out, null, 1).replace(/<\//g, "<\\/");
  const html = PRISTINE.slice(0, i + OPEN.length) + "\n" + json + "\n" + PRISTINE.slice(j);

  const name = (slug(out.site.title) || "your-tiny-jungle") + ".html";
  /* blob.size compte les octets UTF-8 ; html.length compterait des
     unités UTF-16 et annoncerait une taille fausse. */
  const blob = new Blob([html], { type:"text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href:url, download:name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  dsSay(`${name} téléchargé — ${Math.round(blob.size/1024)} Ko, ${(out.plants||[]).length} plantes et ${(out.seeds||[]).length} graines incluses. Il s'ouvre n'importe où, sans rien importer.`);
  $("#setupCount").textContent = `↓ ${name} est dans tes téléchargements.`;
});

$("#dsImport").addEventListener("click", () => { $("#dsFile").value=""; $("#dsFile").click(); });
$("#dsFile").addEventListener("change", () => {
  const f = $("#dsFile").files && $("#dsFile").files[0]; if (!f) return;
  const r = new FileReader();
  r.onerror = () => dsSay("Impossible de lire ce fichier.", true);
  r.onload = () => {
    let d;
    try { d = JSON.parse(r.result); }
    catch(e){ return dsSay("Ce fichier n'est pas du JSON valide.", true); }
    const errs = validateDataset(d);
    if (errs.length) return dsSay("Fichier refusé — " + errs.join(" "), true);
    try { localStorage.setItem(DATA_KEY, JSON.stringify(d)); setFlag(true); if (typeof jgTouch === "function") jgTouch(); }
    catch(e){ return dsSay("Le navigateur refuse d'enregistrer ce jeu de données (trop volumineux ?).", true); }
    dsSay(`Données chargées : ${d.plants.length} plantes, ${d.seeds.length} graines. Rechargement…`);
    try { sessionStorage.setItem("maxiskaJungle.justImported","1"); } catch(e){}
    setTimeout(() => location.reload(), 700);
  };
  r.readAsText(f);
});

/* Contrôle avant écrasement : mieux vaut refuser que casser la page. */
function validateDataset(d){
  const e = [];
  if (!d || typeof d !== "object") return ["contenu illisible."];
  if (!isOurs(d)) e.push('la clé "app" doit valoir "your-tiny-jungle".');
  if (!Array.isArray(d.plants)) e.push('"plants" manquant ou n\'est pas une liste.');
  if (!Array.isArray(d.seeds))  e.push('"seeds" manquant ou n\'est pas une liste.');
  if (!Array.isArray(d.rooms) || !d.rooms.length) e.push('"rooms" manquant ou vide.');
  if (e.length) return e;
  if (!d.plants.every(p => p && p.name && Array.isArray(p.rooms))) e.push('une plante n\'a pas de "name" ou de "rooms".');
  if (!d.seeds.every(s => s && s.id && s.name && s.calendar)) e.push('une graine n\'a pas de "id", "name" ou "calendar".');
  const ids = d.seeds.map(s => s.id);
  if (new Set(ids).size !== ids.length) e.push("deux graines partagent le même id.");
  return e;
}

$("#dsReset").addEventListener("click", () => {
  if (!IS_IMPORTED && !IS_CONFIGURED) return dsSay("Cette page affiche déjà les données d'exemple.");
  try { localStorage.removeItem(DATA_KEY); } catch(e){}
  setFlag(false);
  dsSay("Retour aux données d'exemple. Rechargement…");
  setTimeout(() => location.reload(), 600);
});

/* ── Appliquer : identité + pièces, sur le jeu de données courant ── */
$("#applySetup").addEventListener("click", () => {
  const rooms = draft.rooms.filter(r => r.icon && r.name);
  if (!rooms.length){ goStep(2); return dsSay("Il faut au moins une pièce avec un emoji et un nom.", true); }
  const next = JSON.parse(JSON.stringify(DATA));
  next.site = Object.assign({}, next.site, { title:draft.title||"Ma Jungle", city:draft.city||"", subtitle:draft.subtitle||"" });
  next.rooms = rooms;
  next.configured = true;
  next.source = "config";
  try { localStorage.setItem(DATA_KEY, JSON.stringify(next)); setFlag(true); if (typeof jgTouch === "function") jgTouch(); }
  catch(e){ return dsSay("Le navigateur refuse d'enregistrer la configuration.", true); }
  /* Le rechargement efface le message : on le repasse par la session
     pour l'afficher après, au moment où l'utilisateur constate que la
     page a changé mais que son fichier, lui, n'a pas bougé. */
  try { sessionStorage.setItem("maxiskaJungle.justApplied","1"); } catch(e){}
  location.reload();
});

/* ── Premier lancement : l'assistant s'ouvre de lui-même ──────
   Après un court délai, pour que la page se peigne d'abord : une
   modale sur un écran encore vide donne l'impression que rien n'a
   chargé. Fermer ne compte PAS comme une configuration : tant que
   rien n'a été appliqué ou importé, l'assistant revient. Seuls
   « Appliquer » et « Importer des données » lèvent le drapeau. */
if (!IS_CONFIGURED) setTimeout(openSetup, REDUCED ? 0 : 620);

/* ── Message ponctuel après « Appliquer » ou un import ────────
   Ce bandeau ne doit JAMAIS affirmer une sauvegarde qui n'a pas eu
   lieu. Trois contextes, trois vérités différentes :
     file://            le disque n'a pas bougé   → enregistrer un .html
     http(s) sans synchro  rien n'est ailleurs    → activer la synchro
     http(s) avec synchro  ça dépend du push      → on attend son issue
   D'où le repeinturage piloté par jgSetState (part5) plutôt qu'un
   texte figé écrit une fois pour toutes. */
const JG_HOSTED = location.protocol === "https:" || location.protocol === "http:";
let jgTipMode = null;

function jgTipRepaint(){
  if (!jgTipMode) return;
  const tip = $("#applyTip");
  if (!tip || tip.dataset.hushed === "1") return;
  let configured = false, st = "local", detail = "";
  try {
    configured = (typeof jgConfigured === "function") && jgConfigured();
    st = (typeof jgState === "string") ? jgState : "local";
    detail = (typeof jgDetail === "string") ? jgDetail : "";
  } catch(e){ /* part5 pas encore évalué */ }

  const head = jgTipMode === "imported" ? "Données importées" : "Configuration appliquée";
  let body, btns = "";

  if (!JG_HOSTED){
    body = `✓ ${head} <strong>sur ce navigateur</strong>. Le fichier sur ton disque, lui, n'a pas changé — pour l'emporter ailleurs ou l'envoyer à quelqu'un, enregistre un fichier .html.`;
    btns = `<button type="button" data-setup-btn>Enregistrer un fichier</button>`;
  } else if (!configured){
    body = `⚠️ ${head} <strong>sur ce navigateur uniquement</strong>. Rien n'est sauvegardé ailleurs : si tu vides les données de ce navigateur, tout disparaît.`;
    btns = `<button type="button" data-setup-btn data-sync-step>Activer la synchro</button>`;
  } else if (st === "busy"){
    body = `⟳ ${head}. Chiffrement et envoi vers GitHub…`;
  } else if (st === "synced"){
    body = `✓ ${head} et <strong>enregistrée sur GitHub</strong>, chiffrée.`;
  } else if (st === "conflict"){
    body = `⚠️ ${head} ici, mais la version en ligne a changé entre-temps. Rien n'est envoyé tant que tu n'as pas tranché.`;
    btns = `<button type="button" data-setup-btn data-sync-step>Régler le conflit</button>`;
  } else if (st === "error"){
    body = `⚠️ ${head} ici, mais l'envoi vers GitHub a échoué${detail ? " — " + esc(detail) : ""}. Tes données ne sont que dans ce navigateur.`;
    btns = `<button type="button" data-setup-btn data-sync-step>Vérifier la synchro</button>`;
  } else {
    body = `${head} ici. Envoi vers GitHub en attente…`;
  }

  tip.hidden = false;
  tip.innerHTML = `<span>${body}</span>${btns}
    <button type="button" id="tipClose" style="color:var(--text-faint)">Masquer</button>`;
  $("#tipClose").addEventListener("click", () => {
    tip.dataset.hushed = "1";
    if (REDUCED) return tip.hidden = true;
    tip.style.transition = "opacity 140ms var(--ease-out), transform 140ms var(--ease-out)";
    tip.style.opacity = "0"; tip.style.transform = "scale(.98)";
    setTimeout(() => tip.hidden = true, 140);
  });
}

try {
  if (sessionStorage.getItem("maxiskaJungle.justApplied")){
    sessionStorage.removeItem("maxiskaJungle.justApplied");
    jgTipMode = "applied";
  } else if (sessionStorage.getItem("maxiskaJungle.justImported")){
    sessionStorage.removeItem("maxiskaJungle.justImported");
    jgTipMode = "imported";
  }
} catch(e){ /* sessionStorage indisponible : simple confort perdu */ }
/* Différé d'un tour de boucle : part5 (la synchro) est chargé après
   ce fichier, donc jgConfigured() n'existe pas encore à cet instant. */
if (jgTipMode) setTimeout(jgTipRepaint, 0);


$("#stamp").textContent = new Date().toLocaleDateString("fr-FR");
</script>
</body>
</html>
