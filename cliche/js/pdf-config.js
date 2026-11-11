// =====================================================================
//  COORDONNÉES D'ÉCRITURE DANS LES PDF  —  à régler à la main
// =====================================================================
//
//  Toutes les positions sont en MILLIMÈTRES, mesurées depuis le coin
//  HAUT-GAUCHE de la page :  x → vers la droite,  y → vers le bas.
//  `y` = haut du texte.
//
//  Astuce : mets DEBUG_GRILLE à true, génère un PDF, une grille graduée
//  tous les 10 mm s'affiche par-dessus → tu lis directement les valeurs.
//  Remets false une fois réglé.
// =====================================================================

export const DEBUG_GRILLE = false;

// ---------------------------------------------------------------------
//  PLAN (importé par le BE) — annoté à l'envoi du ticket
// ---------------------------------------------------------------------
export const PLAN = {
  page: 1,      // page du plan où écrire (1 = première)
  police: 9,    // taille du texte (points)

  // Sous chaque case couleur, de GAUCHE à DROITE (8 cases).
  // Le 1er emplacement va dans la case 1, le 2e dans la case 2, etc.
  cases: [
    { x: 20, y: 185 },
    { x: 50, y: 185 },
    { x: 80, y: 185 },
    { x: 110, y: 185 },
    { x: 140, y: 185 },
    { x: 170, y: 185 },
    { x: 200, y: 185 },
    { x: 230, y: 185 },
  ],

  // Bloc en haut à droite : machine + tous les emplacements.
  recap: {
    x: 205,
    y: 10,
    police: 10,
    interligne: 5,  // mm entre 2 lignes
    largeurMax: 85, // mm ; au-delà, la liste passe à la ligne
  },
};

// ---------------------------------------------------------------------
//  FICHES (2 PDF) — remplies à la validation de la réception
// ---------------------------------------------------------------------
//  Champs disponibles :
//    client, fournisseur, dateReception, signature, numeroCliche,
//    machine, emplacements
//  Supprime un champ de la liste pour ne pas l'écrire.
//  Chaque champ peut avoir sa propre `police`.
export const FICHES = [
  {
    nom: "Fiche 1",
    fichier: "pdf/fiche-1.pdf",
    page: 1,
    police: 11,
    champs: {
      client:        { x: 60, y: 40 },
      fournisseur:   { x: 60, y: 50 },
      dateReception: { x: 60, y: 60 },
      signature:     { x: 60, y: 70 },
      numeroCliche:  { x: 60, y: 80 },
      machine:       { x: 60, y: 90 },
    },
  },
  {
    nom: "Fiche 2",
    fichier: "pdf/fiche-2.pdf",
    page: 1,
    police: 11,
    champs: {
      client:        { x: 60, y: 40 },
      fournisseur:   { x: 60, y: 50 },
      dateReception: { x: 60, y: 60 },
      signature:     { x: 60, y: 70 },
      numeroCliche:  { x: 60, y: 80 },
      machine:       { x: 60, y: 90 },
    },
  },
];
