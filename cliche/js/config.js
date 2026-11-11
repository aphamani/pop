// Réglages généraux de l'application.

// Lettres utilisables par machine, par ordre de priorité.
// Chaque sous-liste est un « palier » : l'algo ne passe au palier suivant
// que s'il n'y a vraiment plus assez de place dans le palier courant.
export const MACHINES = {
  "924": [["A", "B"], ["C"]], // C seulement en dernier recours
  "618": [["C", "E", "F", "G"]],
  "Masterflex": [["D"]],
};

export const NOMS_MACHINES = Object.keys(MACHINES);

// Nombre max de couleurs (= cases sur le plan = clichés par ticket).
export const MAX_CLICHES = 8;

// Intervalle de rafraîchissement automatique (ms) pour voir les changements
// faits depuis l'autre PC.
export const RAFRAICHISSEMENT_MS = 8000;
