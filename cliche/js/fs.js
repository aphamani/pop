// Accès au dossier partagé du projet via l'API File System Access (Chrome / Edge).
// Le navigateur demande l'autorisation une fois par session ; le dossier choisi
// est mémorisé dans IndexedDB.
//
// Tant que le dossier n'est pas autorisé, les lectures passent par fetch()
// (lecture seule, servie par Live Server).

const DB = "cliche-fs";
const STORE = "handles";
const CLE = "racine";

let racine = null;   // FileSystemDirectoryHandle autorisé
let enAttente = null; // handle mémorisé mais permission à redemander

export const fsSupporte = "showDirectoryPicker" in window;
export const estConnecte = () => racine !== null;

// ---------- IndexedDB (mémoriser le dossier choisi) ----------

function ouvrirDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idb(mode, fn) {
  const db = await ouvrirDb();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

// ---------- Connexion ----------

/** Sans geste utilisateur : récupère le dossier mémorisé si déjà autorisé. */
export async function restaurer() {
  // Mode test : ?opfs utilise le stockage privé du navigateur au lieu d'un vrai dossier.
  if (new URLSearchParams(location.search).has("opfs")) {
    racine = await navigator.storage.getDirectory();
    return "granted";
  }
  if (!fsSupporte) return "non-supporte";
  const h = await idb("readonly", (s) => s.get(CLE)).catch(() => null);
  if (!h) return "absent";
  const perm = await h.queryPermission({ mode: "readwrite" });
  if (perm === "granted") racine = h;
  else enAttente = h;
  return perm;
}

/** Doit être appelé depuis un clic. */
export async function autoriser() {
  if (enAttente) {
    const perm = await enAttente.requestPermission({ mode: "readwrite" });
    if (perm === "granted") {
      racine = enAttente;
      enAttente = null;
      return;
    }
  }
  const h = await window.showDirectoryPicker({ id: "cliche", mode: "readwrite" });
  await verifierRacine(h);
  racine = h;
  enAttente = null;
  await idb("readwrite", (s) => s.put(h, CLE));
}

export const nomDossierMemorise = () => (racine ?? enAttente)?.name ?? null;

async function verifierRacine(h) {
  try {
    const data = await h.getDirectoryHandle("data");
    await data.getFileHandle("stock.json");
  } catch {
    throw new Error("Ce dossier ne contient pas data/stock.json. Choisis le dossier racine du projet.");
  }
}

// ---------- Fichiers ----------

async function resoudre(chemin, creer = false) {
  if (!racine) throw new Error("Dossier partagé non autorisé.");
  const parts = chemin.split("/").filter(Boolean);
  const nom = parts.pop();
  let dir = racine;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: creer });
  return { dir, nom };
}

export async function lireTexte(chemin) {
  if (!racine) {
    const r = await fetch(chemin, { cache: "no-store" });
    if (!r.ok) throw new Error(`${chemin} introuvable (HTTP ${r.status})`);
    return r.text();
  }
  const { dir, nom } = await resoudre(chemin);
  const fichier = await (await dir.getFileHandle(nom)).getFile();
  return fichier.text();
}

export const lireJSON = async (chemin) => JSON.parse(await lireTexte(chemin));

export async function lireBinaire(chemin) {
  if (!racine) {
    const r = await fetch(chemin, { cache: "no-store" });
    if (!r.ok) throw new Error(`${chemin} introuvable (HTTP ${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }
  const { dir, nom } = await resoudre(chemin);
  const fichier = await (await dir.getFileHandle(nom)).getFile();
  return new Uint8Array(await fichier.arrayBuffer());
}

/** data : string, Uint8Array ou Blob. */
export async function ecrire(chemin, data) {
  const { dir, nom } = await resoudre(chemin, true);
  const fh = await dir.getFileHandle(nom, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

export const ecrireJSON = (chemin, obj) => ecrire(chemin, JSON.stringify(obj, null, 2) + "\n");

/** Liste les noms de fichiers d'un dossier (nécessite l'autorisation). */
export async function lister(chemin) {
  if (!racine) return [];
  let dir = racine;
  for (const p of chemin.split("/").filter(Boolean)) {
    try {
      dir = await dir.getDirectoryHandle(p);
    } catch {
      return [];
    }
  }
  const noms = [];
  for await (const [nom, h] of dir.entries()) if (h.kind === "file") noms.push(nom);
  return noms;
}
