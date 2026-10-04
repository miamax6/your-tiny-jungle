<script>
/* ════════════════════════════════════════════════════════════════
   SYNCHRONISATION CHIFFRÉE — dépôt GitHub privé
   Le code est public, les données ne le sont pas : tout ce qui part
   chez GitHub est une enveloppe AES-256-GCM. La phrase secrète ne
   quitte jamais l'appareil, GitHub ne voit jamais de clair.
   ════════════════════════════════════════════════════════════════ */
"use strict";

const JG_CFG = "jg.cfg", JG_META = "jg.meta";
const JG_DEFAULTS = { owner:"", repo:"", path:"jungle/datas.json", branch:"main", token:"", pass:"" };

function jgRead(k, fallback){
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback; }
  catch(e){ return fallback; }
}
function jgWrite(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }

let jgCfg  = Object.assign({}, JG_DEFAULTS, jgRead(JG_CFG, {}));
let jgMeta = Object.assign({ sha:null, dirty:false, at:0, sig:null }, jgRead(JG_META, {}));

/* Empreinte du contenu synchronisable. Sans elle, le simple fait
   d'ouvrir la page (qui mémorise l'onglet actif) marquait les
   données « modifiées » : un commit par ouverture, et des conflits
   inventés de toutes pièces. */
function jgSig(obj){
  const s = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return s.length + ":" + h.toString(16);
}

const jgConfigured = () => !!(jgCfg.owner && jgCfg.repo && jgCfg.path && jgCfg.token && jgCfg.pass);

/* ── Chiffrement ──────────────────────────────────────────────
   AES-256-GCM, clé dérivée par PBKDF2-SHA256 250 000 tours,
   sel 16 o et IV 12 o tirés au hasard à chaque écriture. */
const jgB64  = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const jgUnb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function jgDeriveKey(pass, salt, iter){
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations:iter, hash:"SHA-256" }, base,
    { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
}
async function jgEncrypt(text, pass){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const iter = 250000;
  const key  = await jgDeriveKey(pass, salt, iter);
  const ct   = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(text)));
  return JSON.stringify({ v:1, kdf:"PBKDF2-SHA256", iter, salt:jgB64(salt), iv:jgB64(iv), ct:jgB64(ct) });
}
async function jgDecrypt(envelope, pass){
  const e = JSON.parse(envelope);
  const key = await jgDeriveKey(pass, jgUnb64(e.salt), e.iter);
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name:"AES-GCM", iv:jgUnb64(e.iv) }, key, jgUnb64(e.ct)));
}

/* ── Ce qu'on synchronise ─────────────────────────────────────
   Assemblé à la volée depuis les clés déjà en place : pas de
   troisième copie locale à garder cohérente, donc pas de migration
   ni de risque de perdre l'existant. */
function jgCollect(){
  return {
    schema: 1,
    dataset: jgRead(DATA_KEY, null) || EMBEDDED,
    state: { seeds: store.seeds || {}, theme: store.theme || "light" }
  };
}
function jgApply(blob){
  if (!blob || typeof blob !== "object") throw new Error("contenu illisible");
  if (blob.dataset && blob.dataset.app) jgWrite(DATA_KEY, blob.dataset);
  if (blob.state){
    const next = Object.assign({}, store, {
      seeds: blob.state.seeds || {},
      theme: blob.state.theme === "dark" ? "dark" : "light"
    });
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch(e){}
  }
  try { localStorage.setItem(CONFIG_KEY, "1"); } catch(e){}
}

/* ── API GitHub ───────────────────────────────────────────────
   api.github.com autorise le CORS : appel direct depuis la page. */
function jgApiUrl(){
  return `https://api.github.com/repos/${encodeURIComponent(jgCfg.owner)}/${encodeURIComponent(jgCfg.repo)}/contents/${jgCfg.path.split("/").map(encodeURIComponent).join("/")}`;
}
function jgHeaders(){
  return { "Authorization":"Bearer " + jgCfg.token, "Accept":"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28" };
}
function jgHttpError(status){
  if (status === 401) return "Jeton refusé (401). Il est peut-être expiré ou mal copié.";
  if (status === 403) return "Accès refusé (403). Le jeton n'a sans doute pas la permission « Contents : Read and write ».";
  if (status === 404) return "Dépôt ou chemin introuvable (404). Vérifie le compte, le dépôt, et que le jeton donne bien accès à CE dépôt.";
  if (status === 409 || status === 422) return "Conflit côté GitHub : le fichier a changé entre-temps.";
  return "Erreur GitHub " + status + ".";
}

async function jgFetchRemote(){
  const url = jgApiUrl() + "?ref=" + encodeURIComponent(jgCfg.branch) + "&t=" + Date.now();
  const r = await fetch(url, { headers: jgHeaders(), cache: "no-store" });
  if (r.status === 404) return { missing:true };
  if (!r.ok) throw new Error(jgHttpError(r.status));
  const j = await r.json();
  /* GitHub renvoie du base64 découpé en lignes ; atob n'en veut pas. */
  const txt = new TextDecoder().decode(jgUnb64((j.content || "").replace(/\s/g, "")));
  return { sha:j.sha, envelope:txt };
}
async function jgPutRemote(envelope, sha){
  const body = {
    message: "jungle: " + new Date().toISOString().slice(0,19).replace("T"," "),
    content: jgB64(new TextEncoder().encode(envelope)),
    branch: jgCfg.branch
  };
  if (sha) body.sha = sha;
  const r = await fetch(jgApiUrl(), { method:"PUT", headers: Object.assign({ "Content-Type":"application/json" }, jgHeaders()), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(jgHttpError(r.status));
  const j = await r.json();
  return j.content && j.content.sha;
}

/* ── États ────────────────────────────────────────────────────
   Local · Synchronisé · Modifié · Synchro… · Conflit · Erreur */
let jgState = "local", jgDetail = "";
function jgSetState(s, detail=""){
  jgState = s; jgDetail = detail;
  const pill = document.getElementById("syncPill");
  if (!pill) return;
  const map = {
    local:   ["Local",        "is-local"],
    synced:  ["Synchronisé",  "is-ok"],
    dirty:   ["Modifié",      "is-dirty"],
    busy:    ["Synchro…",     "is-busy"],
    conflict:["Conflit",      "is-conflict"],
    error:   ["Erreur",       "is-error"]
  };
  const [label, cls] = map[s] || map.local;
  pill.className = "sync-pill " + cls;
  pill.textContent = label;
  pill.title = detail || label;
  pill.hidden = (s === "local" && !jgConfigured());
  const box = document.getElementById("syncStatus");
  if (box){ box.textContent = detail || label; box.classList.toggle("is-err", s === "error" || s === "conflict"); }
  const bar = document.getElementById("conflictBar");
  if (bar) bar.hidden = (s !== "conflict");
  /* Le bandeau d'après-import suit l'état réel du push : sans ce
     rappel, il affirmerait une sauvegarde encore en vol. */
  if (typeof jgTipRepaint === "function") jgTipRepaint();
}

/* ── Pull ─────────────────────────────────────────────────────
   Silencieux à l'ouverture, au retour sur l'onglet et au retour
   du réseau. Si le distant a bougé ET qu'on a des modifications
   locales non envoyées, on ne tranche pas tout seul : conflit. */
async function jgPull({ silent=false, takeRemote=false } = {}){
  if (!jgConfigured()) return;
  if (jgState === "busy") return;
  jgSetState("busy");
  try {
    const rem = await jgFetchRemote();
    if (rem.missing){ jgSetState(jgMeta.dirty ? "dirty" : "synced", "Aucune donnée en ligne pour l'instant."); return; }
    if (rem.sha === jgMeta.sha && !takeRemote){ jgSetState(jgMeta.dirty ? "dirty" : "synced"); return; }
    if (jgMeta.dirty && !takeRemote){ jgSetState("conflict", "La version en ligne a changé, et tu as des modifications locales non envoyées."); return; }
    let clear;
    try { clear = await jgDecrypt(rem.envelope, jgCfg.pass); }
    catch(e){ jgSetState("error", "Phrase secrète incorrecte."); return; }
    jgApply(JSON.parse(clear));
    jgMeta = { sha:rem.sha, dirty:false, at:Date.now(), sig:jgSig(jgCollect()) };
    jgWrite(JG_META, jgMeta);
    jgSetState("synced", "Données récupérées depuis GitHub.");
    /* On recharge toujours, y compris pour un pull silencieux : le
       jeu de données vient de changer sous la page déjà peinte, et
       seul un rechargement le reflète. « silent » ne concerne que
       les messages, pas le rechargement. */
    location.reload();
  } catch(e){ jgSetState("error", e.message || String(e)); }
}

/* ── Push ─────────────────────────────────────────────────────
   Relit toujours le sha distant avant d'écrire : sans ça, deux
   appareils s'écrasent mutuellement sans que personne ne le voie. */
async function jgPush({ force=false } = {}){
  if (!jgConfigured()) return;
  if (jgState === "busy") return;
  jgSetState("busy");
  try {
    const rem = await jgFetchRemote();
    if (!rem.missing && rem.sha !== jgMeta.sha && !force){
      jgSetState("conflict", "La version en ligne a changé depuis ta dernière synchro.");
      return;
    }
    const envelope = await jgEncrypt(JSON.stringify(jgCollect()), jgCfg.pass);
    const sha = await jgPutRemote(envelope, rem.missing ? null : rem.sha);
    jgMeta = { sha: sha || null, dirty:false, at:Date.now(), sig:jgSig(jgCollect()) };
    jgWrite(JG_META, jgMeta);
    jgSetState("synced", "Envoyé à " + new Date().toLocaleTimeString("fr-FR") + ".");
  } catch(e){ jgSetState("error", e.message || String(e)); }
}

/* ── Anti-rebond : 1,8 s après la dernière modification ─────── */
let jgTimer = null;
function jgTouch(){
  if (!jgConfigured()) return;
  const sig = jgSig(jgCollect());
  if (sig === jgMeta.sig){           // rien n'a bougé pour de vrai
    if (jgMeta.dirty){ jgMeta.dirty = false; jgWrite(JG_META, jgMeta); }
    if (jgState === "dirty") jgSetState("synced");
    return;
  }
  jgMeta.dirty = true; jgWrite(JG_META, jgMeta);
  if (jgState !== "busy" && jgState !== "conflict") jgSetState("dirty");
  clearTimeout(jgTimer);
  jgTimer = setTimeout(() => jgPush(), 1800);
}

/* ── Réveils ──────────────────────────────────────────────────
   Pas de rechargement pendant une saisie : on attend le retour. */
addEventListener("visibilitychange", () => { if (!document.hidden) jgPull({ silent:true }); });
addEventListener("online", () => jgPull({ silent:true }));
addEventListener("beforeunload", () => { if (jgMeta.dirty && jgConfigured()) { clearTimeout(jgTimer); } });

/* ── Écran de réglages ────────────────────────────────────────
   Les champs sont reliés à jgCfg par un écouteur : un oubli ici
   rend un champ « non modifiable » sans la moindre erreur. */
function jgPaintSettings(){
  ["owner","repo","path","branch","token","pass"].forEach(k => {
    const el = document.getElementById("sy_" + k);
    if (el && el.value !== jgCfg[k]) el.value = jgCfg[k] || "";
  });
  const info = document.getElementById("syncWhere");
  if (info) info.textContent = jgConfigured()
    ? `${jgCfg.owner}/${jgCfg.repo} → ${jgCfg.path} (branche ${jgCfg.branch})`
    : "Non configuré sur cet appareil.";
  jgSetState(jgState, jgDetail);
}

function jgBindSettings(){
  ["owner","repo","path","branch","token","pass"].forEach(k => {
    const el = document.getElementById("sy_" + k);
    if (!el) return;
    el.addEventListener("input", e => {
      jgCfg[k] = e.target.value.trim();
      jgWrite(JG_CFG, jgCfg);
      jgPaintSettings();
    });
  });
  const show = document.getElementById("sy_show");
  if (show) show.addEventListener("change", e => {
    ["token","pass"].forEach(k => {
      const el = document.getElementById("sy_" + k);
      if (el) el.type = e.target.checked ? "text" : "password";
    });
  });
  const now = document.getElementById("syncNow");
  if (now) now.addEventListener("click", async () => {
    if (!jgConfigured()) return jgSetState("error", "Il manque le compte, le dépôt, le jeton ou la phrase secrète.");
    await jgPull({ silent:false });
    if (jgState !== "conflict" && jgState !== "error") await jgPush();
  });
  const wipe = document.getElementById("syncWipe");
  if (wipe) wipe.addEventListener("click", () => {
    if (!confirmInline()) return;
    try { localStorage.removeItem(JG_CFG); localStorage.removeItem(JG_META); } catch(e){}
    jgCfg = Object.assign({}, JG_DEFAULTS); jgMeta = { sha:null, dirty:false, at:0 };
    jgPaintSettings(); jgSetState("local", "Configuration effacée de cet appareil.");
  });
  const keepMine = document.getElementById("cfKeepMine");
  if (keepMine) keepMine.addEventListener("click", () => jgPush({ force:true }));
  const takeTheirs = document.getElementById("cfTakeRemote");
  if (takeTheirs) takeTheirs.addEventListener("click", () => { jgMeta.dirty = false; jgWrite(JG_META, jgMeta); jgPull({ takeRemote:true }); });
}

/* Confirmation sans alert() : une pastille qui demande un 2e clic. */
let jgWipeArmed = false, jgWipeTimer = null;
function confirmInline(){
  const b = document.getElementById("syncWipe");
  if (jgWipeArmed){ clearTimeout(jgWipeTimer); jgWipeArmed = false; b.textContent = "🗑️ Vider cet appareil"; return true; }
  jgWipeArmed = true; b.textContent = "Confirmer ?";
  jgWipeTimer = setTimeout(() => { jgWipeArmed = false; b.textContent = "🗑️ Vider cet appareil"; }, 4000);
  return false;
}

jgBindSettings();
jgPaintSettings();
if (jgConfigured()){
  jgSetState(jgMeta.dirty ? "dirty" : "synced");
  /* Reprise d'un envoi perdu. Un import appelle jgTouch() — qui
     programme le push à 1,8 s — puis recharge la page à 0,7 s : le
     minuteur meurt avec la page. Au retour, jgMeta.dirty est encore
     vrai mais jgPull sort sans rien envoyer si le distant n'a pas
     bougé. Sans cette reprise, les données importées restaient
     indéfiniment locales alors que la pastille disait « Modifié ». */
  jgPull({ silent:true }).then(() => {
    if (jgMeta.dirty && jgState !== "conflict" && jgState !== "error" && jgState !== "busy") jgPush();
  });
}
</script>
