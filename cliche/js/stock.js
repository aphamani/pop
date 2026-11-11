// Chargement, écriture et requêtes sur le stock de clichés.

import { lireTexte, ecrire } from "./fs.js";

export const LETTRES = ["A", "B", "C", "D", "E", "F", "G"];
export const POSITIONS = 12;
export const CHEMIN_STOCK = "data/stock.json";

export const STATUT = { VIDE: "vide", RESERVE: "reserve", OCCUPE: "occupe" };
export const LIBELLE_STATUT = { vide: "Vide", reserve: "Réservé", occupe: "Occupé" };

/** Retourne { stock, texte } ; texte sert à détecter les changements. */
export async function chargerStock() {
  const texte = await lireTexte(CHEMIN_STOCK);
  return { stock: creerIndex(JSON.parse(texte).emplacements), texte };
}

/**
 * Relit le stock à jour sur le disque, applique `modif(stock)`, puis réécrit.
 * Relire juste avant d'écrire limite les conflits entre les 2 PC.
 */
export async function modifierStock(modif) {
  const { stock } = await chargerStock();
  const resultat = await modif(stock);
  await ecrire(CHEMIN_STOCK, serialiser(stock.emplacements));
  return resultat;
}

// Une ligne par emplacement : fichier lisible et diff propre.
function serialiser(emplacements) {
  return `{\n  "emplacements": [\n    ${emplacements.map((e) => JSON.stringify(e)).join(",\n    ")}\n  ]\n}\n`;
}

export function creerIndex(emplacements) {
  const parId = new Map();
  const parLettre = new Map(LETTRES.map((l) => [l, []]));
  for (const e of emplacements) {
    parId.set(e.id, e);
    parLettre.get(e.lettre)?.push(e);
  }
  return { emplacements, parId, parLettre };
}

export function compter(liste) {
  const c = { total: liste.length, vides: 0, reserves: 0, occupes: 0 };
  for (const e of liste) {
    if (e.statut === STATUT.RESERVE) c.reserves++;
    else if (e.statut === STATUT.OCCUPE) c.occupes++;
    else c.vides++;
  }
  return c;
}

export function nbRangees(stock, lettre) {
  return (stock.parLettre.get(lettre) ?? []).reduce((max, e) => Math.max(max, e.rangee), 0);
}

/** Tickets ayant encore des emplacements réservés (= en attente de réception). */
export function ticketsEnAttente(stock) {
  const ids = new Set();
  for (const e of stock.emplacements) if (e.statut === STATUT.RESERVE && e.ticketId) ids.add(e.ticketId);
  return [...ids];
}
