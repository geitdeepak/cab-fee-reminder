// FR-03 / 5.4 worked example: locked_fare x plan_months x (1 - discount%).
export function computeCycleAmount(fare, months, discountPct) {
  const gross = fare * months;
  const discount = Math.round(gross * (discountPct / 100));
  return gross - discount;
}

export function feeBreakdown(fare, months, discountPct) {
  const gross = fare * months;
  const discount = Math.round(gross * (discountPct / 100));
  return { gross, discount, cycleAmount: gross - discount };
}
