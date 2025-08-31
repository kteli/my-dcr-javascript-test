// ---------- Validation / normalization helpers (global-scope) ----------

function escapeHTML(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  function toNumberOrZero(x) {
    const n = typeof x === 'string' ? Number(x.replace(/,/g, '')) : Number(x);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  
  function toStringOrEmpty(x) {
    return (typeof x === 'string' ? x.trim() : '') || '';
  }
  
  function toStringArray(a) {
    if (!Array.isArray(a)) return [];
    return a.map(v => toStringOrEmpty(v)).filter(Boolean);
  }
  
  function unique(arr) { return Array.from(new Set(arr)); }
  
  function validateAndNormalizeCountry(raw, idx) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: `Item #${idx} is not an object` };
    }
  
    const name = toStringOrEmpty(raw.name);
    if (!name) return { ok: false, error: `Item #${idx} missing "name"` };
  
    const capital = toStringOrEmpty(raw.capital);
    const region  = toStringOrEmpty(raw.region);
    const population = toNumberOrZero(raw.population);
    const area       = toNumberOrZero(raw.area);
  
    const borders   = unique(toStringArray(raw.borders));
    const timezones = unique(toStringArray(raw.timezones));
  
    // languages supports ["English"] or [{name:"English"}]
    let languages = [];
    if (Array.isArray(raw.languages)) {
      languages = raw.languages.map(l => {
        if (typeof l === 'string') return { name: toStringOrEmpty(l) };
        if (l && typeof l === 'object') return { name: toStringOrEmpty(l.name) };
        return { name: '' };
      }).map(l => l.name).filter(Boolean);
      languages = unique(languages).map(name => ({ name }));
    }
  
    return {
      ok: true,
      value: { name, capital, region, population, area, borders, timezones, languages }
    };
  }
  
  function validateCountriesData(raw) {
    const errors = [];
    const out = [];
  
    if (!Array.isArray(raw)) {
      return { data: [], errors: ['Root JSON is not an array'], skipped: 0 };
    }
  
    raw.forEach((item, i) => {
      const res = validateAndNormalizeCountry(item, i);
      if (res.ok) out.push(res.value);
      else errors.push(res.error);
    });
  
    return { data: out, errors, skipped: errors.length };
  }
  
  function sanitizeItemsPerPage(v) {
    if (v === 'all') return 'all';
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= 2000) return Math.floor(n);
    return 50; // default
  }
  
  function safeMaxValue(arr) {
    const m = d3.max(arr, d => d.value);
    return Number.isFinite(m) && m > 0 ? m : 1;
  }
  
  // Whitelists
  const ALLOWED_DATA_TYPES  = new Set([
    'population','borders','timezones','languages','region-countries','region-timezones'
  ]);
  const ALLOWED_CHART_TYPES = new Set(['bubble','treemap']);
  