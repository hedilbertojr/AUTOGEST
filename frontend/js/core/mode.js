export const isDemo =
  typeof document !== 'undefined' &&
  document.querySelector('meta[name="autogest-mode"]')?.content === 'demo';
