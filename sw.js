// Service Worker — ⚙️ Temps de production
// Même fonctionnement que celui de la Calculatrice, avec les correctifs :
// 1) commentaires réellement adaptés à cette app (plus de copié-collé du Calendrier) ;
// 2) RESSOURCES inclut le manifest et les DEUX icônes (rien ne reste hors cache hors ligne).

const NOM_CACHE = "temps-production-cache";
const NOM_INSTALLATION = "temps-production-installation";
const PREFIXE_CACHES = "temps-production-";
const PAGE_PRINCIPALE = "./⚙️-temps-de-production.html";
const RACINE = "./";

const RESSOURCES = [
  PAGE_PRINCIPALE,
  "./manifest.json",
  "./temps-production-icone-512.png",
  "./temps-production-maskable-512.png"
];

// INSTALLATION : précharge les ressources dans un cache d'installation,
// puis bascule immédiatement sur la nouvelle version.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(NOM_INSTALLATION);
    await Promise.all(RESSOURCES.map(async (ressource) => {
      try {
        const reponse = await fetch(ressource, { cache: "reload" });
        if (reponse && reponse.ok) {
          await cache.put(ressource, reponse.clone());
        }
      } catch (e) {
        // Ressource indisponible à l'installation : l'app s'installe quand même.
      }
    }));
    await self.skipWaiting();
  })());
});

// ACTIVATION : copie le cache d'installation vers le cache actif,
// supprime les caches obsolètes et prend le contrôle des onglets ouverts.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const installation = await caches.open(NOM_INSTALLATION);
    const actif = await caches.open(NOM_CACHE);
    const requetes = await installation.keys();
    for (const requete of requetes) {
      const reponse = await installation.match(requete);
      if (reponse) {
        await actif.put(requete, reponse.clone());
      }
    }
    const noms = await caches.keys();
    await Promise.all(noms.map((nom) => {
      if (nom.startsWith(PREFIXE_CACHES) && nom !== NOM_CACHE && nom !== NOM_INSTALLATION) {
        return caches.delete(nom);
      }
    }));
    await self.clients.claim();
  })());
});

// FETCH : réseau d'abord pour toujours servir la dernière version en ligne,
// repli sur le cache hors ligne, puis page principale pour la navigation.
self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET" || !requete.url.startsWith(self.location.origin)) return;
  event.respondWith((async () => {
    try {
      const reponse = await fetch(requete, { cache: "no-cache" });
      if (reponse && reponse.ok) {
        const cache = await caches.open(NOM_CACHE);
        // Mise à jour du cache ; un échec d'écriture n'est pas bloquant.
        cache.put(requete, reponse.clone()).catch(() => {});
      }
      return reponse;
    } catch (e) {
      const cache = await caches.open(NOM_CACHE);
      const enCache = await cache.match(requete, { ignoreSearch: true });
      if (enCache) {
        return enCache;
      }
      if (requete.mode === "navigate") {
        // Navigations hors ligne : essaie la page principale de
        // « Temps de production », puis la racine du site.
        const page = await cache.match(PAGE_PRINCIPALE, { ignoreSearch: true });
        if (page) {
          return page;
        }
        const racine = await cache.match(RACINE, { ignoreSearch: true });
        if (racine) {
          return racine;
        }
      }
      return new Response("Hors ligne et ressource absente du cache.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});