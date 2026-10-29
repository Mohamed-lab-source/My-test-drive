// Today's exchange rates from a free, key-less public API (rates are
// published once a day). Returns "how much of `base` one unit of each
// currency is worth" — the same shape fx_rates.rate_to_base uses.
const ENDPOINT = 'https://open.er-api.com/v6/latest/';

export async function fetchLiveRates(base: string, currencies: string[]): Promise<{ rates: Record<string, number>; updated: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(base), { signal: controller.signal });
    if (!res.ok) throw new Error(`Rates service replied ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (json.result !== 'success' || !json.rates) throw new Error('Rates service returned no data');
    const out: Record<string, number> = {};
    for (const c of currencies) {
      const perBase = json.rates[c]; // units of c for 1 base
      if (perBase && perBase > 0) out[c] = 1 / perBase;
    }
    return { rates: out, updated: json.time_last_update_utc ?? '' };
  } finally {
    clearTimeout(timer);
  }
}
