// City spelling helpers.
// Cities are typed by hand, so the same city appears as "Peshawar", "peshwar", "Peshawer"...
// buildCityIndex() groups spellings that are almost the same and picks the most used
// spelling as the "real" name. It is used for:
//  - suggestions while typing a city (no new spelling mistakes),
//  - saving a new order with the real spelling (peshwar -> Peshawar),
//  - reports and charts (old spellings are counted under the real city).
// Old orders in the database are NOT changed.

export const toTitleCaseCity = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const cityKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

function editDistance(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Two city keys are "the same city" when they differ by a small typo.
function sameCity(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const shortest = Math.min(a.length, b.length);
  if (shortest < 4) return false; // too short to guess (e.g. "Dir")
  const limit = shortest >= 7 ? 2 : 1;
  return editDistance(a, b) <= limit;
}

// names: city strings (repeats allowed; each repeat counts as one use).
// preferred: known correct spellings (e.g. from postex_city_codes); they win their group.
export function buildCityIndex(names = [], preferred = []) {
  const counts = new Map(); // title-case spelling -> uses
  const add = (n, w) => {
    const t = toTitleCaseCity(n);
    if (!t || !cityKey(t)) return;
    counts.set(t, (counts.get(t) || 0) + w);
  };
  preferred.forEach((n) => add(n, 100000));
  names.forEach((n) => add(n, 1));

  // Most used spellings first, so they become the canonical name of their group.
  const spellings = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const groups = []; // { name, key, uses }
  const canonicalOf = new Map(); // key -> canonical name

  spellings.forEach(([spelling, uses]) => {
    const k = cityKey(spelling);
    const group = groups.find((g) => sameCity(g.key, k));
    if (group) {
      group.uses += uses % 100000;
      canonicalOf.set(k, group.name);
    } else {
      groups.push({ name: spelling, key: k, uses: uses % 100000 });
      canonicalOf.set(k, spelling);
    }
  });

  const canonical = (name) => {
    const t = toTitleCaseCity(name);
    const k = cityKey(t);
    if (!k) return '';
    if (canonicalOf.has(k)) return canonicalOf.get(k);
    const group = groups.find((g) => sameCity(g.key, k));
    return group ? group.name : t;
  };

  return {
    canonical,
    list: groups.sort((a, b) => b.uses - a.uses).map((g) => g.name),
  };
}
