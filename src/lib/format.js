export function formatCurrency(n, symbol = '₹') {
  const num = Math.round(Number(n) || 0);
  return symbol + num.toLocaleString('en-IN');
}

export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
