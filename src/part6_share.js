<script>
/* ════════════════════════════════════════════════════════════════
   PARTAGE DE LA CONFIGURATION PAR QR CODE
   Le QR encode un lien vers l'appli dont le fragment (#) contient
   la config. Un fragment n'est JAMAIS envoyé au serveur : il reste
   dans le navigateur. Il contient quand même le jeton et la phrase
   secrète, d'où le chiffrement par un code dit de vive voix.
   ════════════════════════════════════════════════════════════════ */
"use strict";

/* ── base64url ────────────────────────────────────────────────
   Le base64 ordinaire contient + / = qui doivent être réencodés
   dans une URL : on perdrait toute la place gagnée. */
const jgB64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const jgUnb64u = s => {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};

/* ── Code de protection ───────────────────────────────────────
   Alphabet sans I, L, O, 0, 1 : illisibles à l'oral comme à l'œil. */
const JG_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function jgMakeCode(n = 8){
  const r = crypto.getRandomValues(new Uint8Array(n));
  return [...r].map(b => JG_ALPHA[b % JG_ALPHA.length]).join("");
}
const jgNormCode = s => (s || "").replace(/[\s-]/g, "").toUpperCase();
const jgPrettyCode = c => c.length > 4 ? c.slice(0,4) + "-" + c.slice(4) : c;

/* ── Charge utile ─────────────────────────────────────────────
   Clés d'une lettre : un QR plus court se lit de plus loin. */
function jgPayloadObj(){
  return { o:jgCfg.owner, r:jgCfg.repo, p:jgCfg.path, b:jgCfg.branch, t:jgCfg.token, k:jgCfg.pass };
}
async function jgMakePayload(code){
  const json = JSON.stringify(jgPayloadObj());
  if (!code) return "p." + jgB64u(new TextEncoder().encode(json));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await jgDeriveKey(code, salt, 200000);
  const ct   = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(json)));
  const all  = new Uint8Array(salt.length + iv.length + ct.length);
  all.set(salt, 0); all.set(iv, salt.length); all.set(ct, salt.length + iv.length);
  return "e." + jgB64u(all);
}
async function jgReadPayload(payload, code){
  if (payload.startsWith("p.")) return JSON.parse(new TextDecoder().decode(jgUnb64u(payload.slice(2))));
  if (!payload.startsWith("e.")) throw new Error("format inconnu");
  const all  = jgUnb64u(payload.slice(2));
  const salt = all.slice(0,16), iv = all.slice(16,28), ct = all.slice(28);
  const key  = await jgDeriveKey(jgNormCode(code), salt, 200000);
  return JSON.parse(new TextDecoder().decode(
    await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct)));
}
const jgShareBase = () => location.origin + location.pathname;

/* ── Fenêtre de partage ───────────────────────────────────────
   Modules noirs sur blanc quel que soit le thème : un QR en
   couleurs inversées n'est pas lu par la moitié des téléphones. */
let jgShareCode = "";
async function jgDrawShare(){
  const protect = document.getElementById("qrProtect").checked;
  const codeIn  = document.getElementById("qrCode");
  jgShareCode = protect ? jgNormCode(codeIn.value) : "";
  const warn = document.getElementById("qrWarn");

  if (protect && jgShareCode.length < 6){
    warn.hidden = false;
    warn.textContent = "Le code doit faire au moins 6 caractères.";
    document.getElementById("qrBox").innerHTML = "";
    document.getElementById("qrLink").value = "";
    return;
  }
  warn.hidden = protect;
  if (!protect){
    warn.hidden = false;
    warn.textContent = "⚠️ Sans code, quiconque voit ce QR obtient ton jeton GitHub et ta phrase secrète.";
  }

  const link = jgShareBase() + "#partage=" + await jgMakePayload(jgShareCode);
  document.getElementById("qrLink").value = link;
  const t = qrcode(0, "L");
  t.addData(link);
  t.make();
  document.getElementById("qrBox").innerHTML = t.createSvgTag({ cellSize:4, margin:4, scalable:true });
  document.getElementById("qrCodeShow").textContent = protect ? jgPrettyCode(jgShareCode) : "—";
  document.getElementById("qrLen").textContent = link.length + " caractères · " + t.getModuleCount() + " modules";
}

function jgOpenShare(){
  if (!jgConfigured()){ jgSetState("error", "Configure d'abord la synchronisation avant de la partager."); return; }
  document.getElementById("qrCode").value = jgPrettyCode(jgMakeCode(8));
  document.getElementById("qrProtect").checked = true;
  jgModal("shareModal", true);
  jgDrawShare();
}

/* ── Import depuis un lien ────────────────────────────────────
   Au chargement ET sur hashchange : un lien ouvert alors que
   l'appli tourne déjà ne déclenche aucun rechargement. */
let jgPending = null;
function jgCheckHash(){
  const m = /[#&]partage=([^&]+)/.exec(location.hash || "");
  if (!m) return;
  jgPending = decodeURIComponent(m[1]);
  const enc = jgPending.startsWith("e.");
  document.getElementById("impCodeRow").hidden = !enc;
  document.getElementById("impCode").value = "";
  document.getElementById("impMsg").textContent = enc
    ? "Ce lien est protégé. Saisis le code que t'a donné l'autre appareil."
    : "Ce lien n'est pas protégé par un code.";
  document.getElementById("impMsg").classList.remove("is-err");
  jgModal("importModal", true);
}
async function jgDoImport(){
  const msg = document.getElementById("impMsg");
  try {
    const cfg = await jgReadPayload(jgPending, document.getElementById("impCode").value);
    if (!cfg || !cfg.o || !cfg.r) throw new Error("lien incomplet");
    jgCfg = Object.assign({}, JG_DEFAULTS, {
      owner:cfg.o, repo:cfg.r, path:cfg.p || JG_DEFAULTS.path,
      branch:cfg.b || "main", token:cfg.t || "", pass:cfg.k || "" });
    jgWrite(JG_CFG, jgCfg);
    jgMeta = { sha:null, dirty:false, at:0, sig:null }; jgWrite(JG_META, jgMeta);
    /* Le fragment disparaît de la barre d'adresse : sinon le jeton
       reste visible, et dans l'historique du navigateur. */
    history.replaceState(null, "", location.pathname + location.search);
    jgPending = null;
    jgModal("importModal", false);
    jgPaintSettings();
    jgSetState("busy", "Configuration importée, récupération des données…");
    jgPull({ silent:false, takeRemote:true });
  } catch(e){
    msg.textContent = "Code incorrect — rien n'a été importé.";
    msg.classList.add("is-err");
  }
}

/* ── Petites fenêtres ─────────────────────────────────────────
   Même grammaire d'animation que l'assistant. */
function jgModal(id, open){
  const m = document.getElementById(id);
  if (!m) return;
  if (open){
    m.hidden = false; m.classList.remove("is-off");
    requestAnimationFrame(() => m.classList.add("is-on"));
    document.body.style.overflow = "hidden";
  } else {
    m.classList.remove("is-on"); m.classList.add("is-off");
    document.body.style.overflow = "";
    const done = () => { m.hidden = true; m.classList.remove("is-off"); };
    REDUCED ? done() : setTimeout(done, 150);
  }
}

document.addEventListener("click", e => {
  if (e.target.closest("#shareOpen")) return jgOpenShare();
  if (e.target.closest("[data-share-close]")) return jgModal("shareModal", false);
  if (e.target.closest("[data-import-close]")) { jgPending = null; history.replaceState(null, "", location.pathname + location.search); return jgModal("importModal", false); }
  if (e.target.closest("#impGo")) return jgDoImport();
  if (e.target.closest("#qrNew")){ document.getElementById("qrCode").value = jgPrettyCode(jgMakeCode(8)); return jgDrawShare(); }
  if (e.target.closest("#qrCopy")){
    const box = document.getElementById("qrLink");
    navigator.clipboard.writeText(box.value)
      .then(() => document.getElementById("qrLen").textContent = "Lien copié.")
      .catch(() => { box.select(); document.getElementById("qrLen").textContent = "Copie refusée — texte sélectionné, fais Ctrl+C."; });
  }
});
["qrProtect","qrCode"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", jgDrawShare);
  if (el && el.type === "checkbox") el.addEventListener("change", jgDrawShare);
});
document.getElementById("impCode") && document.getElementById("impCode")
  .addEventListener("keydown", e => { if (e.key === "Enter") jgDoImport(); });

addEventListener("hashchange", jgCheckHash);
jgCheckHash();
</script>
