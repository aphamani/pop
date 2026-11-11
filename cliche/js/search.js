// Analyse d'une saisie de recherche : "23C7" (emplacement) ou "23C" (rangée).

const RE_EMPLACEMENT = /^(\d+)\s*([A-Z])\s*(\d+)$/;
const RE_RANGEE = /^(\d+)\s*([A-Z])$/;

export function analyserRecherche(saisie) {
  const q = saisie.trim().toUpperCase();
  if (!q) return null;

  let m = q.match(RE_EMPLACEMENT);
  if (m) {
    return { type: "emplacement", id: `${+m[1]}${m[2]}${+m[3]}`, lettre: m[2], rangee: +m[1] };
  }

  m = q.match(RE_RANGEE);
  if (m) return { type: "rangee", lettre: m[2], rangee: +m[1] };

  if (/^[A-Z]$/.test(q)) return { type: "lettre", lettre: q };

  return { type: "invalide", saisie: q };
}
