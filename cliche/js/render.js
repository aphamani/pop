// Rendu DOM de la page stock : compteurs, onglets, grille, détail, tickets en attente.

import { LETTRES, POSITIONS, STATUT, LIBELLE_STATUT, compter, nbRangees } from "./stock.js";
import { LIBELLE_TICKET } from "./tickets.js";
import { dateFr } from "./pdf.js";
import { echapper, dateHeureFr } from "./ui.js";

const fmt = new Intl.NumberFormat("fr-FR");

export function renderStatsGlobales(el, stock) {
  const { total, vides, reserves, occupes } = compter(stock.emplacements);
  el.innerHTML = `
    <div class="stat"><div class="stat-label">Emplacements</div><div class="stat-value">${fmt.format(total)}</div></div>
    <div class="stat"><div class="stat-label">Vides</div><div class="stat-value">${fmt.format(vides)}</div></div>
    <div class="stat reserve"><div class="stat-label">Réservés</div><div class="stat-value">${fmt.format(reserves)}</div></div>
    <div class="stat full"><div class="stat-label">Occupés</div><div class="stat-value">${fmt.format(occupes)}</div></div>
  `;
}

export function renderOnglets(el, stock, lettreActive, onSelect) {
  el.innerHTML = "";
  for (const lettre of LETTRES) {
    const { total, vides } = compter(stock.parLettre.get(lettre));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.role = "tab";
    btn.setAttribute("aria-selected", String(lettre === lettreActive));
    btn.innerHTML = `
      <span class="tab-letter">${lettre}</span>
      <span class="tab-count">${fmt.format(vides)} libres / ${fmt.format(total)}</span>
    `;
    btn.addEventListener("click", () => onSelect(lettre));
    el.appendChild(btn);
  }
}

const CLASSE = { [STATUT.RESERVE]: "reserve", [STATUT.OCCUPE]: "full" };

export function renderGrille(el, stock, lettre, onCellClick) {
  const frag = document.createDocumentFragment();

  frag.appendChild(div("grid-head corner", "Rangée"));
  for (let p = 1; p <= POSITIONS; p++) frag.appendChild(div("grid-head", String(p)));

  const rangees = nbRangees(stock, lettre);
  for (let r = 1; r <= rangees; r++) {
    const label = div("row-label", `${r}${lettre}`);
    label.id = `row-${r}${lettre}`;
    frag.appendChild(label);

    for (let p = 1; p <= POSITIONS; p++) {
      const e = stock.parId.get(`${r}${lettre}${p}`);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      if (!e) {
        cell.disabled = true;
        frag.appendChild(cell);
        continue;
      }
      if (CLASSE[e.statut]) cell.classList.add(CLASSE[e.statut]);
      cell.dataset.id = e.id;
      cell.textContent = e.id;
      cell.title = `${e.id} — ${LIBELLE_STATUT[e.statut] ?? e.statut}`;
      frag.appendChild(cell);
    }
  }

  el.replaceChildren(frag);
  el.onclick = (ev) => {
    const cell = ev.target.closest(".cell[data-id]");
    if (cell) onCellClick(cell.dataset.id);
  };

  return compter(stock.parLettre.get(lettre));
}

export function renderStatsLettre(el, { total, vides, reserves, occupes }) {
  el.textContent = `${fmt.format(total)} emplacements · ${fmt.format(vides)} vides · ${fmt.format(reserves)} réservés · ${fmt.format(occupes)} occupés`;
}

// ---------- Tickets en attente ----------
export function renderInbox(el, tickets) {
  if (!tickets.length) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <h2>Tickets à réceptionner <span class="count">${tickets.length}</span></h2>
    <div class="inbox-list">
      ${tickets.map((t) => `
        <article class="ticket-card">
          <div class="ticket-card-head">
            <span class="mono">${t.id}</span>
            <span class="badge reserve">Machine ${echapper(t.machine)}</span>
          </div>
          <div class="muted small">${dateHeureFr(t.creeLe)} · ${t.nbCliches} cliché(s)</div>
          <div class="chips">${t.emplacements.map((id) => `<button type="button" class="chip chip-link" data-goto="${id}">${id}</button>`).join("")}</div>
          <button type="button" class="btn btn-primary" data-recevoir="${t.id}">Réceptionner</button>
        </article>
      `).join("")}
    </div>
  `;
}

// ---------- Détail ----------
export function renderDetail(el, e, ticket) {
  if (!e) {
    el.innerHTML = `<p class="detail-empty">Clique sur un emplacement pour voir le détail.</p>`;
    return;
  }
  const classe = CLASSE[e.statut] ?? "";
  let html = `
    <h3>${e.id}</h3>
    <span class="badge ${classe}">${LIBELLE_STATUT[e.statut] ?? e.statut}</span>
    <dl>
      <dt>Lettre</dt><dd>${e.lettre}</dd>
      <dt>Rangée</dt><dd>${e.rangee}</dd>
      <dt>Position</dt><dd>${e.position} / ${POSITIONS}</dd>
    </dl>
  `;

  if (e.ticketId && ticket === undefined) {
    html += `<p class="muted">Chargement du ticket…</p>`;
  } else if (e.ticketId && !ticket) {
    html += `<p class="error">Ticket ${echapper(e.ticketId)} introuvable.</p>`;
  } else if (ticket) {
    const r = ticket.reception;
    const index = ticket.emplacements.indexOf(e.id);
    html += `
      <h4>Ticket</h4>
      <dl>
        <dt>N°</dt><dd class="mono">${ticket.id}</dd>
        <dt>Statut</dt><dd>${LIBELLE_TICKET[ticket.statut]}</dd>
        <dt>Créé le</dt><dd>${dateHeureFr(ticket.creeLe)}</dd>
        <dt>Machine</dt><dd>${echapper(r?.machine ?? ticket.machine)}</dd>
        <dt>Clichés</dt><dd>${ticket.nbCliches}${index >= 0 ? ` (celui-ci : case ${index + 1})` : ""}</dd>
        <dt>Plan</dt><dd>${echapper(ticket.planNom ?? "")}</dd>
      </dl>
      <div class="chips">${ticket.emplacements.map((id) => `<button type="button" class="chip chip-link ${id === e.id ? "current" : ""}" data-goto="${id}">${id}</button>`).join("")}</div>
    `;
    if (r) {
      html += `
        <h4>Réception</h4>
        <dl>
          <dt>Client</dt><dd>${echapper(r.client)}</dd>
          <dt>Fournisseur</dt><dd>${echapper(r.fournisseur)}</dd>
          <dt>Date</dt><dd>${dateFr(r.dateReception)}</dd>
          <dt>N° cliché</dt><dd>${echapper(r.numeroCliche)}</dd>
          <dt>Signature</dt><dd>${echapper(r.signature)}</dd>
          <dt>Validé le</dt><dd>${dateHeureFr(r.valideLe)}</dd>
        </dl>
      `;
    }
    html += `
      <h4>Plan</h4>
      <div class="detail-preview" id="detail-preview"><p class="muted small">Chargement…</p></div>
      <div class="detail-actions">
        <button type="button" class="btn btn-sm" data-doc="plan" data-op="ouvrir">Agrandir</button>
        <button type="button" class="btn btn-sm" data-doc="plan" data-op="telecharger">Télécharger le plan</button>
        <button type="button" class="btn btn-sm" data-doc="plan" data-op="imprimer">Imprimer le plan</button>
        ${r ? `
          <button type="button" class="btn btn-sm" data-doc="fiches" data-op="telecharger">Télécharger les fiches</button>
          <button type="button" class="btn btn-sm" data-doc="fiches" data-op="imprimer">Imprimer les fiches</button>
        ` : ""}
      </div>
    `;
  }
  el.innerHTML = html;
}

function div(className, text) {
  const d = document.createElement("div");
  d.className = className;
  d.textContent = text;
  return d;
}
