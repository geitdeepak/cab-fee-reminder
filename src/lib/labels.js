// Fee plans are stored with English labels; screens show them in the chosen language.
const PLAN_KEY = { monthly: 'planMonthly', quarterly: 'planQuarterly', yearly: 'planYearly' };

export function planLabel(t, plan) {
  return plan && PLAN_KEY[plan.id] ? t(PLAN_KEY[plan.id]) : (plan && plan.label) || '';
}
