// Génération des PDF avec pdf-lib (chargé en global depuis vendor/pdf-lib.min.js).
// Les positions viennent de pdf-config.js.

import { PLAN, FICHES, DEBUG_GRILLE } from "./pdf-config.js";
import { lireBinaire } from "./fs.js";

const MM = 72 / 25.4; // 1 mm en points PDF

const lib = () => {
  if (!window.PDFLib) throw new Error("pdf-lib non chargé (vendor/pdf-lib.min.js).");
  return window.PDFLib;
};

export const LIBELLES_CHAMPS = {
  client: "Client",
  fournisseur: "Fournisseur",
  dateReception: "Date de réception",
  signature: "Signature",
  numeroCliche: "N° cliché",
  machine: "Machine",
  emplacements: "Emplacements",
};

/** Plan BE + emplacements sous les cases couleurs + récap en haut à droite. */
export async function annoterPlan(planBytes, { machine, emplacements }) {
  const { PDFDocument, StandardFonts } = lib();
  const doc = await PDFDocument.load(planBytes, { ignoreEncryption: true });
  const page = choisirPage(doc, PLAN.page);
  const police = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);

  if (DEBUG_GRILLE) dessinerGrille(page, police);

  emplacements.forEach((id, i) => {
    const pos = PLAN.cases[i];
    if (pos) ecrireTexte(page, gras, id, pos, pos.police ?? PLAN.police);
  });

  const r = PLAN.recap;
  const taille = r.police ?? PLAN.police;
  const lignes = [
    `Machine : ${machine}`,
    ...decouper(`Emplacements : ${emplacements.join(", ")}`, police, taille, r.largeurMax * MM),
  ];
  lignes.forEach((txt, i) => ecrireTexte(page, i === 0 ? gras : police, txt, { x: r.x, y: r.y + i * r.interligne }, taille));

  return doc.save();
}

/** Remplit les fiches configurées et les assemble en un seul PDF (pour 1 seule impression). */
export async function remplirFiches(valeurs) {
  const { PDFDocument, StandardFonts } = lib();
  const sortie = await PDFDocument.create();

  for (const fiche of FICHES) {
    let doc;
    let modeleManquant = false;
    try {
      doc = await PDFDocument.load(await lireBinaire(fiche.fichier), { ignoreEncryption: true });
    } catch {
      doc = await PDFDocument.create();
      doc.addPage([210 * MM, 297 * MM]); // A4
      modeleManquant = true;
    }

    const page = choisirPage(doc, fiche.page);
    const police = await doc.embedFont(StandardFonts.Helvetica);
    const gras = await doc.embedFont(StandardFonts.HelveticaBold);

    if (DEBUG_GRILLE) dessinerGrille(page, police);
    if (modeleManquant) {
      ecrireTexte(page, gras, `${fiche.nom} — modèle manquant : ${fiche.fichier}`, { x: 15, y: 15 }, 12);
    }

    for (const [champ, pos] of Object.entries(fiche.champs)) {
      let val = valeurs[champ];
      if (champ === "dateReception") val = dateFr(val);
      if (Array.isArray(val)) val = val.join(", ");
      if (val == null || val === "") continue;
      const texte = modeleManquant ? `${LIBELLES_CHAMPS[champ] ?? champ} : ${val}` : String(val);
      ecrireTexte(page, police, texte, pos, pos.police ?? fiche.police);
    }

    const pages = await sortie.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => sortie.addPage(p));
  }

  return sortie.save();
}

// ---------- utilitaires ----------

function choisirPage(doc, numero) {
  const pages = doc.getPages();
  return pages[Math.min(Math.max(numero, 1), pages.length) - 1];
}

function ecrireTexte(page, font, texte, { x, y }, taille) {
  const { height } = page.getSize();
  page.drawText(nettoyer(texte), {
    x: x * MM,
    y: height - y * MM - taille * 0.8, // y = haut du texte
    size: taille,
    font,
  });
}

// Les polices standard ne gèrent que l'alphabet latin (WinAnsi).
function nettoyer(texte) {
  return String(texte).replace(/[^\x20-\x7E\xA0-\xFFŒœ—’€]/g, "?");
}

function decouper(texte, font, taille, largeurMax) {
  const mots = nettoyer(texte).split(" ");
  const lignes = [];
  let ligne = "";
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ligne && font.widthOfTextAtSize(essai, taille) > largeurMax) {
      lignes.push(ligne);
      ligne = mot;
    } else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

function dessinerGrille(page, font) {
  const { rgb } = lib();
  const { width, height } = page.getSize();
  const gris = rgb(0.75, 0.75, 0.85);
  const rouge = rgb(0.85, 0.2, 0.2);
  for (let mm = 0; mm * MM <= width; mm += 10) {
    const x = mm * MM;
    page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: mm % 50 ? 0.25 : 0.6, color: gris });
    page.drawText(String(mm), { x: x + 1, y: height - 8, size: 6, font, color: rouge });
  }
  for (let mm = 0; mm * MM <= height; mm += 10) {
    const y = height - mm * MM;
    page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: mm % 50 ? 0.25 : 0.6, color: gris });
    page.drawText(String(mm), { x: 1, y: y - 7, size: 6, font, color: rouge });
  }
}

export function dateFr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso ?? "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}
