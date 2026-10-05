<script>
/* ════════════════════════════════════════════════════════════════
   PWA ET VÉRIFICATION DE VERSION
   GitHub Pages sert une copie périmée jusqu'à une dizaine de
   minutes après un envoi : la page va donc vérifier elle-même si
   une version plus récente est en ligne, et se recharger.
   ════════════════════════════════════════════════════════════════ */
"use strict";
const APP_BUILD = "__APP_BUILD__";

/* En local (file://) il n'y a ni service worker ni manifeste : on
   n'essaie même pas, ça ne ferait qu'une erreur de console. */
const JG_ONLINE_APP = location.protocol === "https:" || location.protocol === "http:";

/* ── Nom du raccourci = nom personnalisé de l'appli ───────────
   Le manifeste statique porte « Your Tiny Jungle ». On le remplace
   par un manifeste produit à la volée avec le titre réglé par
   l'utilisateur. Les adresses doivent être absolues : un blob: n'a
   pas de dossier de base pour résoudre les chemins relatifs. */
function jgDynamicManifest(){
  try {
    const title = (typeof SITE !== "undefined" && SITE.title ? String(SITE.title) : "").trim();
    if (!title) return;
    const base = new URL("./", location.href).href;
    const abs = p => new URL(p, base).href;
    const m = {
      id: base, name: title, short_name: title,
      description: "Plantes d'intérieur et calendrier de semis",
      start_url: base, scope: base, display: "standalone",
      orientation: "portrait-primary", lang: "fr",
      background_color: "#f5ead8", theme_color: "#f5ead8",
      icons: [
        { src: abs("icons/icon-192.png?v=3"), sizes: "192x192", type: "image/png", purpose: "any" },
        { src: abs("icons/icon-512.png?v=3"), sizes: "512x512", type: "image/png", purpose: "any" },
        { src: abs("icons/maskable-192.png?v=3"), sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: abs("icons/maskable-512.png?v=3"), sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(m)], { type:"application/manifest+json" }));
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute("href", url);
    /* iOS lit le titre de la page et cette balise pour nommer le raccourci. */
    const ios = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (ios) ios.setAttribute("content", title);
  } catch(e){ /* le manifeste statique reste en place */ }
}
if (JG_ONLINE_APP) jgDynamicManifest();

if (JG_ONLINE_APP && "serviceWorker" in navigator){
  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ── Une version plus récente est-elle en ligne ? ──────────────
   Au plus une fois par minute, jamais pendant une saisie, et au
   plus un rechargement par version : sans ces trois garde-fous on
   obtient une boucle de rechargement. */
let jgLastCheck = 0, jgReloadedFor = null;
async function jgCheckBuild(){
  if (!JG_ONLINE_APP) return;
  const now = Date.now();
  if (now - jgLastCheck < 60000) return;
  jgLastCheck = now;
  try {
    const r = await fetch(location.pathname + "?v=" + now, { cache:"no-store" });
    if (!r.ok) return;
    const txt = await r.text();
    const m = /APP_BUILD\s*=\s*"([^"]+)"/.exec(txt);
    if (!m || m[1] === APP_BUILD) return;
    const busy = document.activeElement;
    if (busy && /^(INPUT|TEXTAREA|SELECT)$/.test(busy.tagName)) return;
    if (jgReloadedFor === m[1]) return;
    jgReloadedFor = m[1];
    location.reload();
  } catch(e){ /* hors ligne : on garde la version en place */ }
}
if (JG_ONLINE_APP){
  addEventListener("load", () => setTimeout(jgCheckBuild, 2500));
  addEventListener("visibilitychange", () => { if (!document.hidden) jgCheckBuild(); });
}

/* Numéro de version visible dans le pied de page. */
addEventListener("load", () => {
  const s = document.getElementById("stamp");
  if (s) s.textContent = s.textContent + " · build " + APP_BUILD;
});
</script>
