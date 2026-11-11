// Tickets : création (BE), annulation (BE), réception (stock).
//
// Fichiers dans tickets/ :
//   <id>.json              données du ticket
//   <id>-plan.pdf          plan original importé par le BE
//   <id>-plan-annote.pdf   plan avec emplacements + machine
//   <id>-fiches.pdf        les 2 fiches remplies à la réception

import { lireJSON, ecrire, ecrireJSON, lireBinaire, lister } from "./fs.js";
import { modifierStock, STATUT } from "./stock.js";
import { allouer } from "./allocation.js";
import { annoterPlan, remplirFiches } from "./pdf.js";

export const STATUT_TICKET = { ENVOYE: "envoye", RECU: "recu", ANNULE: "annule" };
export const LIBELLE_TICKET = { envoye: "En attente de réception", recu: "Réceptionné", annule: "Annulé" };

const DOSSIER = "tickets";
export const fichiers = (id) => ({
  json: `${DOSSIER}/${id}.json`,
  plan: `${DOSSIER}/${id}-plan.pdf`,
  planAnnote: `${DOSSIER}/${id}-plan-annote.pdf`,
  fiches: `${DOSSIER}/${id}-fiches.pdf`,
});

function nouvelId() {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, "0");
  const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const heure = `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `T${date}-${heure}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export const lireTicket = (id) => lireJSON(fichiers(id).json);
export const lirePlanAnnote = (id) => lireBinaire(fichiers(id).planAnnote);
export const lireFiches = (id) => lireBinaire(fichiers(id).fiches);

export async function listerTickets() {
  const noms = (await lister(DOSSIER)).filter((n) => /^T.*\.json$/.test(n));
  const tickets = await Promise.all(noms.map((n) => lireJSON(`${DOSSIER}/${n}`).catch(() => null)));
  return tickets.filter(Boolean).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/** BE : réserve les emplacements, annote le plan, enregistre le ticket. */
export async function creerTicket({ machine, nbCliches, planBytes, planNom }) {
  const id = nouvelId();

  // 1. Réservation (relit le stock à jour juste avant)
  const allocation = await modifierStock((stock) => {
    const a = allouer(stock.emplacements, machine, nbCliches);
    if (!a) throw new Error(`Plus assez de place pour ${nbCliches} cliché(s) sur la machine ${machine}.`);
    for (const eid of a.ids) Object.assign(stock.parId.get(eid), { statut: STATUT.RESERVE, ticketId: id });
    return a;
  });

  try {
    // 2. Plan annoté
    const planAnnote = await annoterPlan(planBytes, { machine, emplacements: allocation.ids });

    // 3. Enregistrement
    const f = fichiers(id);
    const ticket = {
      id,
      statut: STATUT_TICKET.ENVOYE,
      creeLe: new Date().toISOString(),
      machine,
      nbCliches,
      emplacements: allocation.ids,
      modeAllocation: allocation.mode,
      planNom,
      reception: null,
      annuleLe: null,
    };
    await ecrire(f.plan, planBytes);
    await ecrire(f.planAnnote, planAnnote);
    await ecrireJSON(f.json, ticket);
    return { ticket, planAnnote };
  } catch (err) {
    // Échec après réservation : on libère les places.
    await liberer(id).catch(() => {});
    throw err;
  }
}

/** BE : annule un ticket pas encore réceptionné et libère ses emplacements. */
export async function annulerTicket(id) {
  const ticket = await lireTicket(id);
  if (ticket.statut !== STATUT_TICKET.ENVOYE) {
    throw new Error("Seul un ticket en attente de réception peut être annulé.");
  }
  await liberer(id);
  ticket.statut = STATUT_TICKET.ANNULE;
  ticket.annuleLe = new Date().toISOString();
  await ecrireJSON(fichiers(id).json, ticket);
  return ticket;
}

function liberer(id) {
  return modifierStock((stock) => {
    for (const e of stock.emplacements) {
      if (e.ticketId === id && e.statut === STATUT.RESERVE) Object.assign(e, { statut: STATUT.VIDE, ticketId: null });
    }
  });
}

/**
 * Stock : valide la réception.
 * reception = { client, fournisseur, dateReception, signature, numeroCliche, machine }
 * Retourne les fiches remplies (1 PDF de plusieurs pages) à imprimer.
 */
export async function validerReception(id, reception) {
  const ticket = await lireTicket(id);
  if (ticket.statut !== STATUT_TICKET.ENVOYE) throw new Error(`Ce ticket est déjà ${LIBELLE_TICKET[ticket.statut].toLowerCase()}.`);

  const fiches = await remplirFiches({ ...reception, emplacements: ticket.emplacements });

  await modifierStock((stock) => {
    for (const eid of ticket.emplacements) {
      const e = stock.parId.get(eid);
      if (e && e.ticketId === id) e.statut = STATUT.OCCUPE;
    }
  });

  ticket.statut = STATUT_TICKET.RECU;
  ticket.reception = { ...reception, valideLe: new Date().toISOString() };
  await ecrire(fichiers(id).fiches, fiches);
  await ecrireJSON(fichiers(id).json, ticket);
  return { ticket, fiches };
}
