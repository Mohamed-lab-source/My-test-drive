// Everyday calculators for life in Egypt. Amounts are plain numbers (major
// units) since these are what-ifs, not stored money.

// A restaurant bill: service on the food, then VAT on food + service.
export function restaurantBill(subtotal: number, servicePct = 12, vatPct = 14, people = 1) {
  const service = (subtotal * servicePct) / 100;
  const vat = ((subtotal + service) * vatPct) / 100;
  const total = subtotal + service + vat;
  return { service, vat, total, each: total / Math.max(1, people) };
}

// Gold priced by karat from today's 21k price per gram.
export function goldValue(grams: number, price21: number, karat: 24 | 21 | 18 = 21) {
  const perGram = (price21 * karat) / 21;
  return { perGram, value: perGram * grams };
}

// A bank certificate (شهادة) with simple interest paid out each period.
export function certificate(amount: number, ratePct: number, years: number, payout: 'monthly' | 'quarterly' | 'yearly' | 'end') {
  const yearly = (amount * ratePct) / 100;
  const perYear = payout === 'monthly' ? 12 : payout === 'quarterly' ? 4 : 1;
  const total = yearly * years;
  return { perPayout: payout === 'end' ? total : yearly / perYear, total, atMaturity: amount + total };
}

// Instalments vs paying cash: the monthly interest rate hidden in the plan.
export function instalmentRate(cashPrice: number, downPayment: number, monthly: number, months: number) {
  const financed = cashPrice - downPayment;
  const totalPaid = downPayment + monthly * months;
  if (financed <= 0 || months <= 0 || monthly <= 0) return { monthlyRate: 0, yearlyRate: 0, extra: totalPaid - cashPrice, totalPaid };
  if (monthly * months <= financed) return { monthlyRate: 0, yearlyRate: 0, extra: totalPaid - cashPrice, totalPaid };
  const pv = (r: number) => (monthly * (1 - Math.pow(1 + r, -months))) / r;
  let lo = 1e-9;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > financed) lo = mid;
    else hi = mid;
  }
  const r = (lo + hi) / 2;
  return { monthlyRate: r * 100, yearlyRate: (Math.pow(1 + r, 12) - 1) * 100, extra: totalPaid - cashPrice, totalPaid };
}

// Fuel for a trip.
export function fuelCost(km: number, litresPer100: number, pricePerLitre: number, people = 1) {
  const litres = (km * litresPer100) / 100;
  const cost = litres * pricePerLitre;
  return { litres, cost, each: cost / Math.max(1, people) };
}

// Which pack is cheaper per unit (kg, litre, piece).
export function unitPrices(a: { price: number; qty: number }, b: { price: number; qty: number }) {
  const ua = a.qty > 0 ? a.price / a.qty : Infinity;
  const ub = b.qty > 0 ? b.price / b.qty : Infinity;
  const cheaper: 'a' | 'b' | 'same' = Math.abs(ua - ub) < 1e-9 ? 'same' : ua < ub ? 'a' : 'b';
  const saving = cheaper === 'same' ? 0 : (Math.abs(ua - ub) / Math.max(ua, ub)) * 100;
  return { ua, ub, cheaper, saving };
}

// A raise: the new salary, the difference and what a day is worth.
export function raise(salary: number, pct: number) {
  const next = salary * (1 + pct / 100);
  return { next, diff: next - salary, perDay: next / 30, perHour: next / (22 * 8) };
}

// Ramadan's extra costs: iftars and suhoors, plus fixed extras (Eid
// clothes, Zakat al-Fitr, gatherings).
export function ramadanBudget(perIftar: number, perSuhoor: number, days: number, extras: number) {
  const food = (perIftar + perSuhoor) * days;
  return { food, total: food + extras, perDay: (food + extras) / Math.max(1, days) };
}
