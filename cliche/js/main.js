// Page stock : visualisation, recherche, détail, réception des tickets.

import { chargerStock, LETTRES, nbRangees, ticketsEnAttente } from "./stock.js";
import { analyserRecherche } from "./search.js";
import { NOMS_MACHINES, RAFRAICHISSEMENT_MS } from "./config.js";
import { lireTicket, lirePlanAnnote, lireFiches, validerReception } from "./tickets.js";
import {
  renderStatsGlobales, renderOnglets, renderGrille, renderStatsLettre,
  renderDetail, renderInbox,
} from "./render.js";
import {
  $, echapper, toast, urlPdf, telecharger, imprimer, aujourdhuiISO,
  initConnexion, exigerConnexion, dateHeureFr,
} from "./ui.js";

const els = {
  connexion: $("connexion"),
  stats: $("global-stats"),
  inbox: $("inbox"),
  tabs: $("tabs"),
  grid: $("grid"),
  gridScroll: $("grid-scroll"),
  gridTitle: $("grid-title"),
  letterStats: $("letter-stats"),
  detail: $("detail"),
  searchForm: $("search-form"),
  searchInput: $("search-input"),
  searchMsg: $("search-msg"),
  modal: $("modal-reception"),
  formReception: $("form-reception"),
  receptionTitre: $("reception-titre"),
  receptionRecap: $("reception-recap"),
  receptionPreview: $("reception-preview"),
  receptionErreur: $("reception-erreur"),
  btnValider: $("btn-valider"),
};

const state = {
  stock: null,
  texteStock: "",
  lettre: "A",
  selection: null,
  tickets: new Map(),   // cache id → ticket
  urlsPlan: new Map(),  // cache id → blob URL du plan annoté
  ticketReception: null,
};

// ---------- Init ----------
async function init() {
  els.grid.innerHTML = `<p class="loading">Chargement du stock…</p>`;
  try {
    await rafraichir(true);
  } catch (err) {
    els.grid.innerHTML = `<p class="fatal">${echapper(err.message)}<br>Lance le projet avec Live Server (pas en file://).</p>`;
    return;
  }

  els.searchForm.addEventListener("submit", onRecherche);
  els.inbox.addEventListener("click", onClicChip);
  els.inbox.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-recevoir]");
    if (b) ouvrirReception(b.dataset.recevoir);
  });
  els.detail.addEventListener("click", onClicChip);
  els.detail.addEventListener("click", onActionDetail);

  const selMachine = els.formReception.elements.machine;
  selMachine.innerHTML = NOMS_MACHINES.map((m) => `<option value="${m}">${m}</option>`).join("");
  els.formReception.addEventListener("submit", onValiderReception);
  $("btn-fermer").onclick = $("btn-annuler-reception").onclick = () => els.modal.close();

  initConnexion(els.connexion, () => rafraichir(true));
  setInterval(() => rafraichir().catch(() => {}), RAFRAICHISSEMENT_MS);
}

/** Relit le stock ; ne redessine que s'il a changé (ou si force). */
async function rafraichir(force = false) {
  const { stock, texte } = await chargerStock();
  if (!force && texte === state.texteStock) return;
  const premier = !state.stock;
  state.stock = stock;
  state.texteStock = texte;
  state.tickets.clear(); // les tickets ont pu changer aussi

  renderStatsGlobales(els.stats, stock);
  const scroll = els.gridScroll.scrollTop;
  afficherLettre(state.lettre);
  if (!premier) els.gridScroll.scrollTop = scroll;
  await majInbox();
  if (state.selection) selectionner(state.selection);
}

async function chargerTicket(id) {
  if (!state.tickets.has(id)) state.tickets.set(id, await lireTicket(id).catch(() => null));
  return state.tickets.get(id);
}

async function majInbox() {
  const ids = ticketsEnAttente(state.stock);
  const tickets = (await Promise.all(ids.map(chargerTicket))).filter(Boolean);
  tickets.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  renderInbox(els.inbox, tickets);
}

// ---------- Grille ----------
function afficherLettre(lettre) {
  state.lettre = lettre;
  renderOnglets(els.tabs, state.stock, lettre, (l) => {
    if (l !== state.lettre) {
      afficherLettre(l);
      els.gridScroll.scrollTop = 0;
    }
  });
  const rangees = nbRangees(state.stock, lettre);
  els.gridTitle.textContent = `Lettre ${lettre} — 1${lettre}1 à ${rangees}${lettre}12`;
  const stats = renderGrille(els.grid, state.stock, lettre, selectionner);
  renderStatsLettre(els.letterStats, stats);
  marquerSelection();
}

async function selectionner(id) {
  state.selection = id;
  const e = state.stock.parId.get(id);
  marquerSelection();
  renderDetail(els.detail, e, e?.ticketId ? undefined : null);
  if (!e?.ticketId) return;

  const ticket = await chargerTicket(e.ticketId);
  if (state.selection !== id) return; // l'utilisateur a cliqué ailleurs entre-temps
  renderDetail(els.detail, e, ticket);
  if (!ticket) return;

  const zone = $("detail-preview");
  try {
    const url = await urlPlan(ticket.id);
    if (state.selection === id && zone) zone.innerHTML = `<iframe src="${url}#view=FitH" title="Plan ${ticket.id}"></iframe>`;
  } catch (err) {
    if (zone) zone.innerHTML = `<p class="error small">${echapper(err.message)}</p>`;
  }
}

async function urlPlan(ticketId) {
  if (!state.urlsPlan.has(ticketId)) state.urlsPlan.set(ticketId, urlPdf(await lirePlanAnnote(ticketId)));
  return state.urlsPlan.get(ticketId);
}

function marquerSelection() {
  els.grid.querySelector(".cell.selected")?.classList.remove("selected");
  if (state.selection) els.grid.querySelector(`.cell[data-id="${state.selection}"]`)?.classList.add("selected");
}

/** Clic sur une pastille d'emplacement → aller à la case. */
function onClicChip(ev) {
  const chip = ev.target.closest("[data-goto]");
  if (chip) allerA(chip.dataset.goto);
}

function allerA(id) {
  const e = state.stock.parId.get(id);
  if (!e) return;
  if (e.lettre !== state.lettre) afficherLettre(e.lettre);
  selectionner(id);
  const cell = els.grid.querySelector(`.cell[data-id="${id}"]`);
  cell.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  cell.classList.remove("flash");
  void cell.offsetWidth; // relance l'animation
  cell.classList.add("flash");
}

async function onActionDetail(ev) {
  const b = ev.target.closest("[data-doc]");
  if (!b) return;
  const e = state.stock.parId.get(state.selection);
  const id = e?.ticketId;
  if (!id) return;
  try {
    if (b.dataset.doc === "plan") {
      if (b.dataset.op === "ouvrir") return window.open(await urlPlan(id), "_blank");
      const plan = await lirePlanAnnote(id);
      if (b.dataset.op === "telecharger") telecharger(plan, `${id}-plan.pdf`);
      else imprimer(plan);
    } else {
      const fiches = await lireFiches(id);
      if (b.dataset.op === "telecharger") telecharger(fiches, `${id}-fiches.pdf`);
      else imprimer(fiches);
    }
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------- Recherche ----------
function onRecherche(ev) {
  ev.preventDefault();
  const r = analyserRecherche(els.searchInput.value);
  if (!r) return message("");

  if (r.type === "invalide") {
    return message(`« ${r.saisie} » n'est pas un format valide. Exemple : 23C7, 23C ou C.`, "error");
  }
  if (!LETTRES.includes(r.lettre)) return message(`La lettre ${r.lettre} n'existe pas (A à G).`, "error");

  if (r.lettre !== state.lettre) afficherLettre(r.lettre);

  if (r.type === "lettre") {
    els.gridScroll.scrollTop = 0;
    return message(`Lettre ${r.lettre} affichée.`, "ok");
  }

  const max = nbRangees(state.stock, r.lettre);
  if (r.rangee < 1 || r.rangee > max) {
    return message(`La rangée ${r.rangee}${r.lettre} n'existe pas (1${r.lettre} à ${max}${r.lettre}).`, "error");
  }

  if (r.type === "rangee") {
    $(`row-${r.rangee}${r.lettre}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    return message(`Rangée ${r.rangee}${r.lettre}.`, "ok");
  }

  if (!state.stock.parId.has(r.id)) return message(`L'emplacement ${r.id} n'existe pas (positions 1 à 12).`, "error");

  allerA(r.id);
  message(`Emplacement ${r.id} trouvé.`, "ok");
}

function message(texte, type = "") {
  els.searchMsg.textContent = texte;
  els.searchMsg.className = `search-msg ${type}`;
}

// ---------- Réception ----------
async function ouvrirReception(id) {
  try {
    exigerConnexion();
  } catch (err) {
    return toast(err.message, "error");
  }
  state.tickets.delete(id);
  const t = await chargerTicket(id);
  if (!t) return toast(`Ticket ${id} introuvable.`, "error");

  state.ticketReception = t;
  const f = els.formReception;
  f.reset();
  f.elements.dateReception.value = aujourdhuiISO();
  f.elements.machine.value = t.machine;
  els.receptionErreur.textContent = "";
  els.receptionTitre.textContent = `Réception du ticket ${t.id}`;
  els.receptionRecap.innerHTML = `
    <dl>
      <dt>Créé le</dt><dd>${dateHeureFr(t.creeLe)}</dd>
      <dt>Machine (BE)</dt><dd>${echapper(t.machine)}</dd>
      <dt>Clichés</dt><dd>${t.nbCliches}</dd>
    </dl>
    <div class="chips">${t.emplacements.map((e, i) => `<span class="chip"><small>Case ${i + 1}</small>${e}</span>`).join("")}</div>
  `;
  els.receptionPreview.innerHTML = `<p class="muted small">Chargement du plan…</p>`;
  els.modal.showModal();
  f.elements.client.focus();

  try {
    els.receptionPreview.innerHTML = `<iframe src="${await urlPlan(id)}#view=FitH" title="Plan ${id}"></iframe>`;
  } catch (err) {
    els.receptionPreview.innerHTML = `<p class="error small">${echapper(err.message)}</p>`;
  }
}

async function onValiderReception(ev) {
  ev.preventDefault();
  const f = els.formReception;
  const champs = ["client", "fournisseur", "dateReception", "signature", "numeroCliche", "machine"];
  const reception = Object.fromEntries(champs.map((c) => [c, f.elements[c].value.trim()]));

  const manquant = champs.find((c) => !reception[c]);
  if (manquant) {
    els.receptionErreur.textContent = "Tous les champs sont obligatoires.";
    f.elements[manquant].focus();
    return;
  }

  const t = state.ticketReception;
  els.btnValider.disabled = true;
  els.btnValider.textContent = "Validation…";
  try {
    const { fiches } = await validerReception(t.id, reception);
    els.modal.close();
    toast(`Ticket ${t.id} réceptionné.`, "ok");
    imprimer(fiches);
    await rafraichir(true);
    allerA(t.emplacements[0]);
  } catch (err) {
    els.receptionErreur.textContent = err.message;
  } finally {
    els.btnValider.disabled = false;
    els.btnValider.textContent = "Valider la réception et imprimer";
  }
}

init();
