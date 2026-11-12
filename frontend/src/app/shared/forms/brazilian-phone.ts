export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
}

export function formatBrazilianPhone(value: string): string {
  const digits = phoneDigits(value).slice(0, 11);
  if (digits.length < 3) return digits ? `(${digits}` : '';
  const local = digits.slice(2);
  return `(${digits.slice(0, 2)}) ${local.slice(0, 5)}${local.length > 5 ? '-' + local.slice(5) : ''}`;
}
