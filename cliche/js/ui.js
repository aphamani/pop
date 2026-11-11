// Petits outils d'interface partagés par les 2 pages.

import { fsSupporte, restaurer, autoriser, estConnecte, nomDossierMemorise } from "./fs.js";

export const $ = (id) => document.getElementById(id);

export function echapper(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function dateHeureFr(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export function aujourdhuiISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// ---------- Toasts ----------
export function toast(message, type = "info") {
  let zone = document.querySelector(".toasts");
  if (!zone) {
    zone = document.createElement("div");
    zone.className = "toasts";
    document.body.appendChild(zone);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  zone.appendChild(t);
  setTimeout(() => t.remove(), type === "error" ? 7000 : 4000);
}

// ---------- PDF : URL, téléchargement, impression ----------
export const urlPdf = (bytes) => URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));

export function telecharger(bytes, nom) {
  const url = urlPdf(bytes);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Ouvre la fenêtre d'impression du navigateur avec le PDF. */
export function imprimer(bytes) {
  const url = urlPdf(bytes);
  const iframe = document.createElement("iframe");
  iframe.className = "print-frame";
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(url, "_blank"); // secours : nouvel onglet, Ctrl+P
      }
    }, 300);
  };
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 120000);
}

// ---------- Bandeau de connexion au dossier partagé ----------
/**
 * Affiche l'état d'accès au dossier et le bouton d'autorisation.
 * onConnecte est appelé une fois l'accès obtenu.
 */
export async function initConnexion(el, onConnecte) {
  const etat = await restaurer();

  const rendre = (msgErreur = "") => {
    if (estConnecte()) {
      el.className = "connexion ok";
      el.innerHTML = `<span>● Dossier partagé connecté${nomDossierMemorise() ? ` : <b>${echapper(nomDossierMemorise())}</b>` : ""}</span>`;
      return;
    }
    if (!fsSupporte) {
      el.className = "connexion erreur";
      el.innerHTML = `<span>Ce navigateur ne permet pas d'écrire dans le dossier partagé. Utilise <b>Chrome</b> ou <b>Edge</b>. Lecture seule.</span>`;
      return;
    }
    el.className = "connexion attente";
    el.innerHTML = `
      <span>${msgErreur ? echapper(msgErreur) : "Lecture seule. Autorise l'accès au dossier du projet pour créer et modifier les tickets."}</span>
      <button type="button" class="btn btn-primary">${nomDossierMemorise() ? `Autoriser « ${echapper(nomDossierMemorise())} »` : "Choisir le dossier du projet"}</button>
    `;
    el.querySelector("button").onclick = async () => {
      try {
        await autoriser();
        rendre();
        onConnecte();
      } catch (err) {
        if (err.name !== "AbortError") rendre(err.message);
      }
    };
  };

  rendre();
  if (etat === "granted") onConnecte();
}

export function exigerConnexion() {
  if (!estConnecte()) throw new Error("Autorise d'abord l'accès au dossier du projet (bandeau en haut).");
}
