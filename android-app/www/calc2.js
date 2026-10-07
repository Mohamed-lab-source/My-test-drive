/* ======================================================================
 * Jarvis 4.0 — Numbers pack 1: Finance & Math (offline)
 * Loads after cognition.js. Pure, synchronous, never touches the network.
 * ====================================================================== */

var xi = { type: "integer" };
var xb = { type: "boolean" };

const c2r = (n, d = 2) => { const p = Math.pow(10, d); return Math.round(Number(n) * p) / p; };
const c2n = (v, name) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`I need a number for ${name || "that"}.`); return n; };
const c2list = v => { const a = (Array.isArray(v) ? v : String(v || "").split(/[,\s]+/)).map(Number).filter(Number.isFinite); if (!a.length) throw new Error("Give me some numbers."); return a; };

/* ---- Finance ---------------------------------------------------------------- */
function compoundInterest({ principal, annual_rate, years, times_per_year } = {}) {
  const P = c2n(principal, "the principal"), r = c2n(annual_rate, "the rate") / 100, t = c2n(years, "years");
  const n = Math.max(1, Math.round(clampNum(times_per_year, 1, 365, 12)));
  const amount = P * Math.pow(1 + r / n, n * t);
  return { principal: c2r(P), finalAmount: c2r(amount), interestEarned: c2r(amount - P), compounds: `${n}×/year` };
}
function simpleInterest({ principal, annual_rate, years } = {}) {
  const P = c2n(principal, "the principal"), r = c2n(annual_rate, "the rate") / 100, t = c2n(years, "years");
  const interest = P * r * t;
  return { principal: c2r(P), interest: c2r(interest), finalAmount: c2r(P + interest) };
}
function savingsGoal({ target, monthly, current, annual_rate } = {}) {
  const goal = c2n(target, "the target"), m = c2n(monthly, "the monthly amount");
  let bal = Number(current || 0), r = clampNum(annual_rate, 0, 100, 0) / 100 / 12, months = 0;
  if (m <= 0 && bal < goal) throw new Error("With nothing going in each month, you won't reach it.");
  while (bal < goal && months < 1200) { bal = bal * (1 + r) + m; months++; }
  return { target: c2r(goal), monthly: c2r(m), months, years: c2r(months / 12, 1), reachable: bal >= goal };
}
function roiCalc({ gain, cost } = {}) {
  const g = c2n(gain, "the gain/return"), c = c2n(cost, "the cost");
  if (c === 0) throw new Error("Cost can't be zero.");
  return { roiPercent: c2r((g - c) / c * 100), profit: c2r(g - c) };
}
function inflationAdjust({ amount, annual_rate, years, direction } = {}) {
  const a = c2n(amount, "the amount"), r = c2n(annual_rate, "the inflation rate") / 100, t = c2n(years, "years");
  const future = /past|ago|back/i.test(direction || "") ? a / Math.pow(1 + r, t) : a * Math.pow(1 + r, t);
  return { amount: c2r(a), years: t, adjusted: c2r(future), note: /past/i.test(direction || "") ? "What it was worth then." : "What it'll be worth then." };
}
function salaryConvert({ amount, from, to, hours_per_week } = {}) {
  const a = c2n(amount, "the amount"); const h = clampNum(hours_per_week, 1, 168, 40);
  const perYear = { hourly: a * h * 52, daily: a * 5 * 52, weekly: a * 52, monthly: a * 12, annual: a, yearly: a };
  const f = String(from || "annual").toLowerCase(); const annual = perYear[f]; if (annual == null) throw new Error("from must be hourly, daily, weekly, monthly or annual.");
  const out = { annual: c2r(annual), monthly: c2r(annual / 12), weekly: c2r(annual / 52), daily: c2r(annual / 260), hourly: c2r(annual / (h * 52)) };
  const t = String(to || "").toLowerCase(); if (t && out[t] != null) return { from: f, to: t, result: out[t] };
  return out;
}
function overtimePay({ hourly, hours, multiplier } = {}) {
  const rate = c2n(hourly, "the hourly rate"), h = c2n(hours, "overtime hours"), m = clampNum(multiplier, 1, 5, 1.5);
  return { overtimeRate: c2r(rate * m), hours: h, overtimePay: c2r(rate * m * h) };
}
function vatCalc({ amount, rate, mode } = {}) {
  const a = c2n(amount, "the amount"), r = clampNum(rate, 0, 100, 14) / 100;
  if (/extract|remove|inclusive|included/i.test(mode || "")) { const net = a / (1 + r); return { gross: c2r(a), net: c2r(net), vat: c2r(a - net) }; }
  return { net: c2r(a), vat: c2r(a * r), gross: c2r(a * (1 + r)) };
}
function marginCalc({ cost, price } = {}) {
  const c = c2n(cost, "the cost"), p = c2n(price, "the price");
  if (p === 0) throw new Error("Price can't be zero.");
  return { profit: c2r(p - c), marginPercent: c2r((p - c) / p * 100), markupPercent: c2r((p - c) / c * 100) };
}
function markupPrice({ cost, markup_percent } = {}) {
  const c = c2n(cost, "the cost"), m = c2n(markup_percent, "the markup %") / 100;
  return { cost: c2r(c), price: c2r(c * (1 + m)), profit: c2r(c * m) };
}
function breakEven({ fixed_costs, price, variable_cost } = {}) {
  const F = c2n(fixed_costs, "fixed costs"), p = c2n(price, "the price"), v = c2n(variable_cost, "the variable cost per unit");
  if (p <= v) throw new Error("Price must exceed the variable cost per unit.");
  return { unitsToBreakEven: Math.ceil(F / (p - v)), revenueAtBreakEven: c2r(Math.ceil(F / (p - v)) * p) };
}
function ruleOf72({ annual_rate } = {}) {
  const r = c2n(annual_rate, "the rate"); if (r <= 0) throw new Error("Rate must be above zero.");
  return { rate: r, yearsToDouble: c2r(72 / r, 1) };
}
function aprToApy({ apr, times_per_year } = {}) {
  const r = c2n(apr, "the APR") / 100, n = Math.max(1, Math.round(clampNum(times_per_year, 1, 365, 12)));
  return { apr: c2r(r * 100), apy: c2r((Math.pow(1 + r / n, n) - 1) * 100) };
}
function netWorth({ assets, liabilities } = {}) {
  const a = c2n(assets, "total assets"), l = Number(liabilities || 0);
  return { assets: c2r(a), liabilities: c2r(l), netWorth: c2r(a - l) };
}
function retirementEstimate({ current_savings, monthly, annual_rate, years } = {}) {
  const r = savingsGoal; // reuse compounding loop inline
  let bal = Number(current_savings || 0); const m = c2n(monthly, "the monthly contribution"); const rate = clampNum(annual_rate, 0, 100, 7) / 100 / 12; const months = Math.round(c2n(years, "years") * 12);
  for (let i = 0; i < months; i++) bal = bal * (1 + rate) + m;
  return { years: c2r(months / 12, 0), projected: c2r(bal), contributed: c2r(Number(current_savings || 0) + m * months) };
}
function emergencyFund({ monthly_expenses, months } = {}) {
  const e = c2n(monthly_expenses, "monthly expenses"); const m = clampNum(months, 1, 24, 6);
  return { monthlyExpenses: c2r(e), monthsCovered: m, targetFund: c2r(e * m) };
}
function debtPayoff({ balance, annual_rate, monthly_payment } = {}) {
  let bal = c2n(balance, "the balance"); const r = clampNum(annual_rate, 0, 100, 0) / 100 / 12; const pay = c2n(monthly_payment, "the monthly payment");
  if (pay <= bal * r) throw new Error("That payment won't cover the monthly interest — the debt would grow.");
  let months = 0, interest = 0; while (bal > 0 && months < 1200) { const i = bal * r; interest += i; bal = bal + i - pay; months++; }
  return { months, years: c2r(months / 12, 1), totalInterest: c2r(interest) };
}
function downPayment({ price, percent } = {}) {
  const p = c2n(price, "the price"), pc = clampNum(percent, 0, 100, 20) / 100;
  return { price: c2r(p), downPayment: c2r(p * pc), financed: c2r(p * (1 - pc)) };
}
function salaryTaxEgypt({ annual_income } = {}) {
  // Simplified Egyptian personal income tax brackets (indicative, not official advice).
  let income = c2n(annual_income, "annual income");
  const brackets = [[40000, 0], [55000, 0.10], [70000, 0.15], [200000, 0.20], [400000, 0.225], [Infinity, 0.25]];
  let tax = 0, prev = 0;
  for (const [cap, rate] of brackets) { if (income <= prev) break; const slice = Math.min(income, cap) - prev; tax += slice * rate; prev = cap; }
  return { annualIncome: c2r(income), estimatedTax: c2r(tax), takeHome: c2r(income - tax), note: "Rough brackets, not official tax advice." };
}
function profitShare({ amount, people, weights } = {}) {
  const a = c2n(amount, "the amount");
  if (weights) { const w = c2list(weights); const tot = w.reduce((s, x) => s + x, 0); return { amount: c2r(a), shares: w.map(x => c2r(a * x / tot)) }; }
  const n = Math.max(1, Math.round(c2n(people, "the number of people"))); return { amount: c2r(a), people: n, each: c2r(a / n) };
}
function percentOf({ part, whole } = {}) { const p = c2n(part, "the part"), w = c2n(whole, "the whole"); if (!w) throw new Error("Whole can't be zero."); return { percent: c2r(p / w * 100) }; }
function percentChange({ from, to } = {}) { const a = c2n(from, "the start value"), b = c2n(to, "the end value"); if (!a) throw new Error("Start value can't be zero."); return { change: c2r((b - a) / Math.abs(a) * 100), direction: b >= a ? "increase" : "decrease" }; }
function percentIncrease({ value, percent } = {}) { const v = c2n(value, "the value"), p = c2n(percent, "the percent"); return { result: c2r(v * (1 + p / 100)), change: c2r(v * p / 100) }; }

/* ---- Math ------------------------------------------------------------------- */
function average({ numbers } = {}) { const a = c2list(numbers); return { count: a.length, mean: c2r(a.reduce((s, x) => s + x, 0) / a.length, 4), sum: c2r(a.reduce((s, x) => s + x, 0), 4) }; }
function median({ numbers } = {}) { const a = c2list(numbers).sort((x, y) => x - y); const m = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; return { median: c2r(m, 4) }; }
function modeCalc({ numbers } = {}) { const a = c2list(numbers); const f = {}; a.forEach(x => f[x] = (f[x] || 0) + 1); const max = Math.max(...Object.values(f)); const modes = Object.keys(f).filter(k => f[k] === max).map(Number); return { mode: modes, occurrences: max }; }
function stdDev({ numbers } = {}) { const a = c2list(numbers); const m = a.reduce((s, x) => s + x, 0) / a.length; const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; return { mean: c2r(m, 4), variance: c2r(v, 4), stdDev: c2r(Math.sqrt(v), 4) }; }
function sumNumbers({ numbers } = {}) { const a = c2list(numbers); return { count: a.length, sum: c2r(a.reduce((s, x) => s + x, 0), 6) }; }
function minMax({ numbers } = {}) { const a = c2list(numbers); return { min: Math.min(...a), max: Math.max(...a), range: c2r(Math.max(...a) - Math.min(...a), 6) }; }
function gcdCalc({ a, b } = {}) { let x = Math.abs(Math.round(c2n(a, "a"))), y = Math.abs(Math.round(c2n(b, "b"))); while (y) { [x, y] = [y, x % y]; } return { gcd: x }; }
function lcmCalc({ a, b } = {}) { const x = Math.abs(Math.round(c2n(a, "a"))), y = Math.abs(Math.round(c2n(b, "b"))); let g = x, h = y; while (h) { [g, h] = [h, g % h]; } return { lcm: g ? x / g * y : 0 }; }
function primeCheck({ number } = {}) { const n = Math.round(c2n(number, "a number")); if (n < 2) return { number: n, prime: false }; for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return { number: n, prime: false, divisibleBy: i }; return { number: n, prime: true }; }
function factorialCalc({ n } = {}) { const x = Math.round(c2n(n, "n")); if (x < 0 || x > 170) throw new Error("Give me 0–170."); let f = 1; for (let i = 2; i <= x; i++) f *= i; return { n: x, factorial: f }; }
function fibonacci({ n } = {}) { const x = Math.round(clampNum(n, 1, 90, 10)); const seq = [0, 1]; for (let i = 2; i < x; i++) seq.push(seq[i - 1] + seq[i - 2]); return { count: x, sequence: seq.slice(0, x), nth: seq[x - 1] }; }
function quadratic({ a, b, c } = {}) { const A = c2n(a, "a"), B = c2n(b, "b"), C = c2n(c, "c"); if (A === 0) throw new Error("a can't be zero."); const d = B * B - 4 * A * C; if (d < 0) return { realRoots: false, note: "No real roots (discriminant < 0)." }; const r1 = (-B + Math.sqrt(d)) / (2 * A), r2 = (-B - Math.sqrt(d)) / (2 * A); return { discriminant: c2r(d, 4), roots: d === 0 ? [c2r(r1, 4)] : [c2r(r1, 4), c2r(r2, 4)] }; }
function factorsOf({ number } = {}) { const n = Math.abs(Math.round(c2n(number, "a number"))); const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return { number: n, factors: f, count: f.length }; }
function combinations({ n, r } = {}) { const N = Math.round(c2n(n, "n")), R = Math.round(c2n(r, "r")); if (R > N || R < 0) throw new Error("Need 0 ≤ r ≤ n."); let res = 1; for (let i = 0; i < R; i++) res = res * (N - i) / (i + 1); return { result: Math.round(res) }; }
function permutations({ n, r } = {}) { const N = Math.round(c2n(n, "n")), R = Math.round(c2n(r, "r")); if (R > N || R < 0) throw new Error("Need 0 ≤ r ≤ n."); let res = 1; for (let i = 0; i < R; i++) res *= (N - i); return { result: res }; }
function roundTo({ value, decimals } = {}) { return { result: c2r(c2n(value, "the value"), Math.round(clampNum(decimals, 0, 10, 0))) }; }
function sciNotation({ value } = {}) { const v = c2n(value, "the value"); return { value: v, scientific: v.toExponential(4) }; }
function pythagoras({ a, b, c } = {}) { const A = Number(a), B = Number(b), C = Number(c); if (A && B) return { hypotenuse: c2r(Math.hypot(A, B), 4) }; if (C && A) return { otherSide: c2r(Math.sqrt(C * C - A * A), 4) }; if (C && B) return { otherSide: c2r(Math.sqrt(C * C - B * B), 4) }; throw new Error("Give me two of a, b (legs) or c (hypotenuse)."); }
function circleCalc({ radius } = {}) { const r = c2n(radius, "the radius"); return { radius: r, diameter: c2r(2 * r, 4), circumference: c2r(2 * Math.PI * r, 4), area: c2r(Math.PI * r * r, 4) }; }
function rectangleArea({ length, width } = {}) { const l = c2n(length, "length"), w = c2n(width, "width"); return { area: c2r(l * w, 4), perimeter: c2r(2 * (l + w), 4) }; }
function triangleArea({ base, height } = {}) { return { area: c2r(0.5 * c2n(base, "base") * c2n(height, "height"), 4) }; }
function sphereCalc({ radius } = {}) { const r = c2n(radius, "the radius"); return { volume: c2r(4 / 3 * Math.PI * r ** 3, 4), surfaceArea: c2r(4 * Math.PI * r * r, 4) }; }
function cylinderCalc({ radius, height } = {}) { const r = c2n(radius, "the radius"), h = c2n(height, "the height"); return { volume: c2r(Math.PI * r * r * h, 4), surfaceArea: c2r(2 * Math.PI * r * (r + h), 4) }; }
function speedDistanceTime({ speed, distance, time } = {}) { const s = Number(speed), d = Number(distance), t = Number(time); if (s && t && !d) return { distance: c2r(s * t, 4) }; if (d && t && !s) return { speed: c2r(d / t, 4) }; if (d && s) return { time: c2r(d / s, 4) }; throw new Error("Give me two of speed, distance, time."); }
function ratioSimplify({ a, b } = {}) { let x = Math.round(c2n(a, "a")), y = Math.round(c2n(b, "b")); let g = Math.abs(x), h = Math.abs(y); while (h) { [g, h] = [h, g % h]; } g = g || 1; return { ratio: `${x / g}:${y / g}` }; }
function proportionSolve({ a, b, c } = {}) { const A = c2n(a, "a"), B = c2n(b, "b"), C = c2n(c, "c"); if (!A) throw new Error("a can't be zero."); return { x: c2r(B * C / A, 4), note: `${A}:${B} = ${C}:x` }; }
function nthRoot({ value, n } = {}) { const v = c2n(value, "the value"), r = c2n(n, "the root"); if (v < 0 && r % 2 === 0) throw new Error("No real even root of a negative number."); return { result: c2r(Math.sign(v) * Math.pow(Math.abs(v), 1 / r), 6) }; }
function logCalc({ value, base } = {}) { const v = c2n(value, "the value"); if (v <= 0) throw new Error("Value must be positive."); const b = Number(base || 10); return { result: c2r(Math.log(v) / Math.log(b), 6), base: b }; }
const C2_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const C2_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numToWords({ number } = {}) {
  let n = Math.round(c2n(number, "a number")); if (Math.abs(n) > 999999999999) throw new Error("That's too large.");
  const three = x => { let s = ""; if (x >= 100) { s += C2_ONES[Math.floor(x / 100)] + " hundred"; x %= 100; if (x) s += " "; } if (x >= 20) { s += C2_TENS[Math.floor(x / 10)]; if (x % 10) s += "-" + C2_ONES[x % 10]; } else if (x > 0) s += C2_ONES[x]; return s; };
  if (n === 0) return { number: 0, words: "zero" };
  const neg = n < 0; n = Math.abs(n);
  const scales = [["billion", 1e9], ["million", 1e6], ["thousand", 1e3]]; let words = "";
  for (const [name, val] of scales) { if (n >= val) { words += (words ? " " : "") + three(Math.floor(n / val)) + " " + name; n %= val; } }
  if (n) words += (words ? " " : "") + three(n);
  return { number: (neg ? -1 : 1) * Math.round(c2n(number)), words: (neg ? "negative " : "") + words };
}
function ordinalNum({ number } = {}) { const n = Math.round(c2n(number, "a number")); const s = ["th", "st", "nd", "rd"], v = n % 100; return { ordinal: n + (s[(v - 20) % 10] || s[v] || s[0]) }; }

/* ===== Registration =========================================================== */
FEATURE_TOOLS.push(
  xfn("compound_interest", "Compound interest: final amount and interest earned.", { principal: xn, annual_rate: xn, years: xn, times_per_year: xi }, ["principal", "annual_rate", "years"]),
  xfn("simple_interest", "Simple interest on a principal.", { principal: xn, annual_rate: xn, years: xn }, ["principal", "annual_rate", "years"]),
  xfn("savings_goal", "How long to reach a savings target at a monthly contribution.", { target: xn, monthly: xn, current: xn, annual_rate: xn }, ["target", "monthly"]),
  xfn("roi", "Return on investment as a percentage.", { gain: xn, cost: xn }, ["gain", "cost"]),
  xfn("inflation_adjust", "Adjust an amount for inflation forward or back in time.", { amount: xn, annual_rate: xn, years: xn, direction: xs }, ["amount", "annual_rate", "years"]),
  xfn("salary_convert", "Convert pay between hourly, daily, weekly, monthly and annual.", { amount: xn, from: xs, to: xs, hours_per_week: xn }, ["amount", "from"]),
  xfn("overtime_pay", "Overtime pay at a multiplier.", { hourly: xn, hours: xn, multiplier: xn }, ["hourly", "hours"]),
  xfn("vat_calc", "Add or extract VAT/sales tax.", { amount: xn, rate: xn, mode: { type: "string", enum: ["add", "extract"] } }, ["amount"]),
  xfn("margin_calc", "Profit margin and markup from cost and price.", { cost: xn, price: xn }, ["cost", "price"]),
  xfn("markup_price", "Selling price from cost and markup percent.", { cost: xn, markup_percent: xn }, ["cost", "markup_percent"]),
  xfn("break_even", "Units to break even from fixed costs, price and variable cost.", { fixed_costs: xn, price: xn, variable_cost: xn }, ["fixed_costs", "price", "variable_cost"]),
  xfn("rule_of_72", "Years to double money at a rate (rule of 72).", { annual_rate: xn }, ["annual_rate"]),
  xfn("apr_to_apy", "Convert APR to APY.", { apr: xn, times_per_year: xi }, ["apr"]),
  xfn("net_worth", "Net worth from assets minus liabilities.", { assets: xn, liabilities: xn }, ["assets"]),
  xfn("retirement_estimate", "Project a retirement pot from contributions and growth.", { current_savings: xn, monthly: xn, annual_rate: xn, years: xn }, ["monthly", "years"]),
  xfn("emergency_fund", "Target emergency fund from monthly expenses.", { monthly_expenses: xn, months: xn }, ["monthly_expenses"]),
  xfn("debt_payoff", "Months and interest to clear a debt at a monthly payment.", { balance: xn, annual_rate: xn, monthly_payment: xn }, ["balance", "monthly_payment"]),
  xfn("down_payment", "Down payment and financed amount.", { price: xn, percent: xn }, ["price"]),
  xfn("salary_tax_egypt", "Rough Egyptian income tax and take-home.", { annual_income: xn }, ["annual_income"]),
  xfn("profit_share", "Split an amount between people, evenly or by weights.", { amount: xn, people: xi, weights: xs }, ["amount"]),
  xfn("percent_of", "What percent one number is of another.", { part: xn, whole: xn }, ["part", "whole"]),
  xfn("percent_change", "Percent change between two values.", { from: xn, to: xn }, ["from", "to"]),
  xfn("percent_increase", "Increase/decrease a value by a percent.", { value: xn, percent: xn }, ["value", "percent"]),
  xfn("average", "Mean of a list of numbers.", { numbers: xs }, ["numbers"]),
  xfn("median", "Median of a list of numbers.", { numbers: xs }, ["numbers"]),
  xfn("mode_calc", "Most frequent value(s) in a list.", { numbers: xs }, ["numbers"]),
  xfn("std_dev", "Standard deviation of a list.", { numbers: xs }, ["numbers"]),
  xfn("sum_numbers", "Sum of a list of numbers.", { numbers: xs }, ["numbers"]),
  xfn("min_max", "Smallest, largest and range of a list.", { numbers: xs }, ["numbers"]),
  xfn("gcd", "Greatest common divisor of two integers.", { a: xn, b: xn }, ["a", "b"]),
  xfn("lcm", "Lowest common multiple of two integers.", { a: xn, b: xn }, ["a", "b"]),
  xfn("prime_check", "Is a number prime?", { number: xn }, ["number"]),
  xfn("factorial", "Factorial of n (0–170).", { n: xi }, ["n"]),
  xfn("fibonacci", "The Fibonacci sequence up to n terms.", { n: xi }, ["n"]),
  xfn("quadratic", "Solve ax²+bx+c=0.", { a: xn, b: xn, c: xn }, ["a", "b", "c"]),
  xfn("factors", "All factors of a number.", { number: xn }, ["number"]),
  xfn("combinations", "nCr — combinations.", { n: xi, r: xi }, ["n", "r"]),
  xfn("permutations", "nPr — permutations.", { n: xi, r: xi }, ["n", "r"]),
  xfn("round_to", "Round a number to a number of decimals.", { value: xn, decimals: xi }, ["value"]),
  xfn("scientific_notation", "Express a number in scientific notation.", { value: xn }, ["value"]),
  xfn("pythagoras", "Right-triangle side from the other two (a, b legs; c hypotenuse).", { a: xn, b: xn, c: xn }),
  xfn("circle", "Area, circumference and diameter of a circle.", { radius: xn }, ["radius"]),
  xfn("rectangle_area", "Area and perimeter of a rectangle.", { length: xn, width: xn }, ["length", "width"]),
  xfn("triangle_area", "Area of a triangle from base and height.", { base: xn, height: xn }, ["base", "height"]),
  xfn("sphere", "Volume and surface area of a sphere.", { radius: xn }, ["radius"]),
  xfn("cylinder", "Volume and surface area of a cylinder.", { radius: xn, height: xn }, ["radius", "height"]),
  xfn("speed_distance_time", "Solve for the missing one of speed, distance, time.", { speed: xn, distance: xn, time: xn }),
  xfn("ratio_simplify", "Simplify a ratio a:b.", { a: xn, b: xn }, ["a", "b"]),
  xfn("proportion_solve", "Solve a:b = c:x for x.", { a: xn, b: xn, c: xn }, ["a", "b", "c"]),
  xfn("nth_root", "The nth root of a value.", { value: xn, n: xn }, ["value", "n"]),
  xfn("log_calc", "Logarithm of a value in a given base (default 10).", { value: xn, base: xn }, ["value"]),
  xfn("number_to_words", "Write a number out in English words.", { number: xn }, ["number"]),
  xfn("ordinal", "The ordinal form of a number (1st, 2nd, 3rd…).", { number: xn }, ["number"]),
);
Object.assign(FEATURE_HANDLERS, {
  compound_interest: a => compoundInterest(a), simple_interest: a => simpleInterest(a), savings_goal: a => savingsGoal(a), roi: a => roiCalc(a),
  inflation_adjust: a => inflationAdjust(a), salary_convert: a => salaryConvert(a), overtime_pay: a => overtimePay(a), vat_calc: a => vatCalc(a),
  margin_calc: a => marginCalc(a), markup_price: a => markupPrice(a), break_even: a => breakEven(a), rule_of_72: a => ruleOf72(a),
  apr_to_apy: a => aprToApy(a), net_worth: a => netWorth(a), retirement_estimate: a => retirementEstimate(a), emergency_fund: a => emergencyFund(a),
  debt_payoff: a => debtPayoff(a), down_payment: a => downPayment(a), salary_tax_egypt: a => salaryTaxEgypt(a), profit_share: a => profitShare(a),
  percent_of: a => percentOf(a), percent_change: a => percentChange(a), percent_increase: a => percentIncrease(a),
  average: a => average(a), median: a => median(a), mode_calc: a => modeCalc(a), std_dev: a => stdDev(a), sum_numbers: a => sumNumbers(a), min_max: a => minMax(a),
  gcd: a => gcdCalc(a), lcm: a => lcmCalc(a), prime_check: a => primeCheck(a), factorial: a => factorialCalc(a), fibonacci: a => fibonacci(a),
  quadratic: a => quadratic(a), factors: a => factorsOf(a), combinations: a => combinations(a), permutations: a => permutations(a),
  round_to: a => roundTo(a), scientific_notation: a => sciNotation(a), pythagoras: a => pythagoras(a), circle: a => circleCalc(a),
  rectangle_area: a => rectangleArea(a), triangle_area: a => triangleArea(a), sphere: a => sphereCalc(a), cylinder: a => cylinderCalc(a),
  speed_distance_time: a => speedDistanceTime(a), ratio_simplify: a => ratioSimplify(a), proportion_solve: a => proportionSolve(a),
  nth_root: a => nthRoot(a), log_calc: a => logCalc(a), number_to_words: a => numToWords(a), ordinal: a => ordinalNum(a),
});
TOOL_GROUPS.finance2 = {
  about: "money maths: compound/simple interest, savings goals, ROI, inflation, salary, VAT, margins, break-even, debt payoff, tax, net worth",
  tools: ["compound_interest", "simple_interest", "savings_goal", "roi", "inflation_adjust", "salary_convert", "overtime_pay", "vat_calc", "margin_calc", "markup_price", "break_even", "rule_of_72", "apr_to_apy", "net_worth", "retirement_estimate", "emergency_fund", "debt_payoff", "down_payment", "salary_tax_egypt", "profit_share", "percent_of", "percent_change", "percent_increase"],
  match: /\b(compound interest|simple interest|save up|savings goal|how long to save|roi|return on investment|inflation|salary|wage|per hour|annual|overtime|vat|sales tax|margin|markup|break ?even|double my money|rule of 72|apy|apr|net worth|retirement|pension|emergency fund|pay ?off|debt|down ?payment|income tax|take home|split .* profit|percent of|percent change|percentage change|increase .* by|what percent)\b/i,
};
TOOL_GROUPS.math2 = {
  about: "pure maths: averages, median, mode, std-dev, GCD/LCM, primes, factorial, Fibonacci, quadratic, geometry, roots, number-to-words",
  tools: ["average", "median", "mode_calc", "std_dev", "sum_numbers", "min_max", "gcd", "lcm", "prime_check", "factorial", "fibonacci", "quadratic", "factors", "combinations", "permutations", "round_to", "scientific_notation", "pythagoras", "circle", "rectangle_area", "triangle_area", "sphere", "cylinder", "speed_distance_time", "ratio_simplify", "proportion_solve", "nth_root", "log_calc", "number_to_words", "ordinal"],
  match: /\b(average|mean of|median|mode|standard deviation|std ?dev|sum of|total of|minimum|maximum|gcd|greatest common|lcm|lowest common|prime|factorial|fibonacci|quadratic|factors of|combinations?|permutations?|ncr|npr|round|scientific notation|pythagoras|hypotenuse|circle|area of|perimeter|volume of|sphere|cylinder|distance.*speed|ratio|proportion|square root|cube root|nth root|logarithm|\blog\b|in words|spell the number|ordinal)\b/i,
};

async function initCalc2() { /* stateless */ }
