// Page BE : création, suivi et annulation des tickets.

import { NOMS_MACHINES, MAX_CLICHES, RAFRAICHISSEMENT_MS } from "./config.js";
import { chargerStock } from "./stock.js";
import { allouer, LIBELLE_MODE } from "./allocation.js";
import {
  creerTicket, annulerTicket, listerTickets, lirePlanAnnote,
  STATUT_TICKET, LIBELLE_TICKET,
} from "./tickets.js";
import { estConnecte } from "./fs.js";
import {
  $, echapper, dateHeureFr, toast, urlPdf, telecharger, imprimer,
  initConnexion, exigerConnexion,
} from "./ui.js";

const els = {
  connexion: $("connexion"),
  form: $("form-ticket"),
  plan: $("plan"),
  machine: $("machine"),
  nb: $("nb"),
  proposition: $("proposition"),
  btn: $("btn-envoyer"),
  preview: $("preview"),
  previewTitre: $("preview-titre"),
  liste: $("liste-tickets"),
  voirAnnules: $("voir-annules"),
};

const state = { stock: null, texteStock: "", planBytes: null, planNom: "", tickets: [], previewUrl: null };

// ---------- Init ----------
els.machine.innerHTML = NOMS_MACHINES.map((m) => `<option value="${m}">${m}</option>`).join("");
els.nb.max = MAX_CLICHES;

els.plan.addEventListener("change", onPlan);
els.machine.addEventListener("change", majProposition);
els.nb.addEventListener("input", majProposition);
els.form.addEventListener("submit", onEnvoyer);
els.voirAnnules.addEventListener("change", renderTickets);
els.liste.addEventListener("click", onActionTicket);

await rafraichir();
initConnexion(els.connexion, rafraichir);
setInterval(rafraichir, RAFRAICHISSEMENT_MS);

async function rafraichir() {
  try {
    const { stock, texte } = await chargerStock();
    if (texte !== state.texteStock) {
      state.stock = stock;
      state.texteStock = texte;
      majProposition();
    }
  } catch (err) {
    els.proposition.innerHTML = `<p class="error">${echapper(err.message)}</p>`;
  }
  if (estConnecte()) {
    state.tickets = await listerTickets().catch(() => state.tickets);
  }
  renderTickets();
}

// ---------- Formulaire ----------
async function onPlan() {
  const f = els.plan.files[0];
  if (!f) return;
  state.planBytes = new Uint8Array(await f.arrayBuffer());
  state.planNom = f.name;
  afficherPreview(state.planBytes, `Aperçu : ${f.name}`);
}

function nbValide() {
  const n = Number(els.nb.value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CLICHES ? n : null;
}

function majProposition() {
  if (!state.stock) return;
  const n = nbValide();
  if (!n) {
    els.proposition.innerHTML = `<p class="error">Entre un nombre de clichés entre 1 et ${MAX_CLICHES}.</p>`;
    return;
  }
  const a = allouer(state.stock.emplacements, els.machine.value, n);
  if (!a) {
    els.proposition.innerHTML = `<p class="error">Plus assez de place pour ${n} cliché(s) sur la machine ${echapper(els.machine.value)}.</p>`;
    return;
  }
  els.proposition.innerHTML = `
    <div class="proposition-head">
      <span>Emplacements proposés</span>
      <span class="mode ${a.mode}">${LIBELLE_MODE[a.mode]}</span>
    </div>
    <div class="chips">${a.ids.map((id, i) => `<span class="chip"><small>Case ${i + 1}</small>${id}</span>`).join("")}</div>
    <p class="muted small">Réservés réellement à l'envoi (le stock est relu juste avant).</p>
  `;
}

async function onEnvoyer(ev) {
  ev.preventDefault();
  try {
    exigerConnexion();
    if (!state.planBytes) throw new Error("Importe le plan PDF.");
    const n = nbValide();
    if (!n) throw new Error(`Nombre de clichés entre 1 et ${MAX_CLICHES}.`);

    els.btn.disabled = true;
    els.btn.textContent = "Envoi…";
    const { ticket, planAnnote } = await creerTicket({
      machine: els.machine.value,
      nbCliches: n,
      planBytes: state.planBytes,
      planNom: state.planNom,
    });

    toast(`Ticket ${ticket.id} envoyé : ${ticket.emplacements.join(", ")}`, "ok");
    afficherPreview(planAnnote, `Plan annoté : ${ticket.id}`);
    imprimer(planAnnote);

    els.form.reset();
    els.nb.value = 1;
    state.planBytes = null;
    state.planNom = "";
    await rafraichir();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    els.btn.disabled = false;
    els.btn.textContent = "Envoyer le ticket et imprimer le plan";
  }
}

function afficherPreview(bytes, titre) {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = urlPdf(bytes);
  els.previewTitre.textContent = titre;
  els.preview.innerHTML = `<iframe src="${state.previewUrl}" title="${echapper(titre)}"></iframe>`;
}

// ---------- Liste des tickets ----------
function renderTickets() {
  if (!estConnecte()) {
    els.liste.innerHTML = `<tr><td colspan="7" class="muted">Autorise l'accès au dossier pour voir les tickets.</td></tr>`;
    return;
  }
  const liste = state.tickets.filter((t) => els.voirAnnules.checked || t.statut !== STATUT_TICKET.ANNULE);
  if (!liste.length) {
    els.liste.innerHTML = `<tr><td colspan="7" class="muted">Aucun ticket.</td></tr>`;
    return;
  }
  els.liste.innerHTML = liste.map((t) => `
    <tr class="${t.statut}">
      <td>${dateHeureFr(t.creeLe)}</td>
      <td class="mono">${t.id}</td>
      <td>${echapper(t.machine)}</td>
      <td>${t.nbCliches}</td>
      <td class="mono">${t.emplacements.join(", ")}</td>
      <td><span class="badge ${t.statut}">${LIBELLE_TICKET[t.statut]}</span></td>
      <td class="actions">
        <button class="btn btn-sm" data-action="voir" data-id="${t.id}">Voir</button>
        <button class="btn btn-sm" data-action="imprimer" data-id="${t.id}">Imprimer</button>
        <button class="btn btn-sm" data-action="telecharger" data-id="${t.id}">Télécharger</button>
        ${t.statut === STATUT_TICKET.ENVOYE ? `<button class="btn btn-sm btn-danger" data-action="annuler" data-id="${t.id}">Annuler</button>` : ""}
      </td>
    </tr>
  `).join("");
}

async function onActionTicket(ev) {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  try {
    if (action === "annuler") {
      const t = state.tickets.find((x) => x.id === id);
      if (!confirm(`Annuler le ticket ${id} ?\nLes emplacements ${t?.emplacements.join(", ")} seront libérés.`)) return;
      btn.disabled = true;
      await annulerTicket(id);
      toast(`Ticket ${id} annulé, emplacements libérés.`, "ok");
      await rafraichir();
      return;
    }
    const plan = await lirePlanAnnote(id);
    if (action === "voir") afficherPreview(plan, `Plan annoté : ${id}`);
    if (action === "imprimer") imprimer(plan);
    if (action === "telecharger") telecharger(plan, `${id}-plan.pdf`);
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
}
