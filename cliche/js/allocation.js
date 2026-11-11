// Algorithme de choix des emplacements.
//
// Pour chaque palier de lettres de la machine (voir config.js) :
//   1. N places COLLÉES sur une même rangée (première trouvée : lettre, rangée, position)
//   2. sinon N places sur une même rangée avec trous, la plus resserrée
//   3. sinon les N premières places libres du palier
// On ne passe au palier suivant (ex. C pour la 924) que si le palier n'a pas N places libres.

import { MACHINES } from "./config.js";
import { STATUT } from "./stock.js";

/**
 * @param {Array} emplacements liste complète du stock
 * @param {string} machine
 * @param {number} n nombre de clichés
 * @returns {{ ids: string[], mode: "colles"|"meme-rangee"|"disperses", lettres: string[] } | null}
 */
export function allouer(emplacements, machine, n) {
  const paliers = MACHINES[machine];
  if (!paliers) throw new Error(`Machine inconnue : ${machine}`);
  if (!(n >= 1)) throw new Error("Nombre de clichés invalide.");

  for (const lettres of paliers) {
    const rangees = rangeesLibres(emplacements, lettres);

    // 1. Collés
    for (const r of rangees) {
      const debut = blocConsecutif(r.libres, n);
      if (debut !== null) {
        return resultat(r, Array.from({ length: n }, (_, i) => debut + i), "colles", lettres);
      }
    }

    // 2. Même rangée, écart minimal
    let meilleur = null;
    for (const r of rangees) {
      for (let i = 0; i + n <= r.libres.length; i++) {
        const ecart = r.libres[i + n - 1] - r.libres[i];
        if (!meilleur || ecart < meilleur.ecart) meilleur = { r, positions: r.libres.slice(i, i + n), ecart };
      }
    }
    if (meilleur) return resultat(meilleur.r, meilleur.positions, "meme-rangee", lettres);

    // 3. Dispersés sur plusieurs rangées
    const tous = rangees.flatMap((r) => r.libres.map((p) => `${r.rangee}${r.lettre}${p}`));
    if (tous.length >= n) return { ids: tous.slice(0, n), mode: "disperses", lettres };
  }
  return null;
}

function resultat(r, positions, mode, lettres) {
  return { ids: positions.map((p) => `${r.rangee}${r.lettre}${p}`), mode, lettres };
}

/** Rangées triées (ordre des lettres du palier, puis rangée) avec positions libres triées. */
function rangeesLibres(emplacements, lettres) {
  const map = new Map();
  for (const e of emplacements) {
    if (!lettres.includes(e.lettre) || e.statut !== STATUT.VIDE) continue;
    const cle = `${e.lettre}|${e.rangee}`;
    if (!map.has(cle)) map.set(cle, { lettre: e.lettre, rangee: e.rangee, libres: [] });
    map.get(cle).libres.push(e.position);
  }
  const rangees = [...map.values()];
  for (const r of rangees) r.libres.sort((a, b) => a - b);
  rangees.sort((a, b) => lettres.indexOf(a.lettre) - lettres.indexOf(b.lettre) || a.rangee - b.rangee);
  return rangees;
}

/** Première position de départ d'un bloc de n positions consécutives, ou null. */
function blocConsecutif(libres, n) {
  let debut = 0;
  for (let i = 0; i < libres.length; i++) {
    if (i > 0 && libres[i] !== libres[i - 1] + 1) debut = i;
    if (i - debut + 1 >= n) return libres[debut];
  }
  return null;
}

export const LIBELLE_MODE = {
  colles: "Emplacements collés",
  "meme-rangee": "Pas assez de places collées : même rangée avec trous",
  disperses: "Pas assez de place sur une rangée : emplacements dispersés",
};
