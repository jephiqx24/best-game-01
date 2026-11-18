// Where Is My Coin — the 30 coins, one per level. Each level hides fragments
// of its own coin: BTC only on the last level (30), every other level a
// different coin with its own glyph and brand colour, so levels are told
// apart at a glance. No images — every coin is drawn with CSS/SVG text.

/** One coin: id, display name, ticker, the glyph drawn on the coin face,
 *  the brand colour, and the glyph (ink) colour for contrast. */
export const COINS = [
  { id: 'doge', name: 'Dogecoin', ticker: 'DOGE', glyph: 'Ð', color: '#c2a633', ink: '#3a2f00' },
  { id: 'sol', name: 'Solana', ticker: 'SOL', glyph: '◎', color: '#9945ff', ink: '#ffffff' },
  { id: 'eth', name: 'Ethereum', ticker: 'ETH', glyph: 'Ξ', color: '#627eea', ink: '#ffffff' },
  { id: 'bnb', name: 'BNB', ticker: 'BNB', glyph: '◆', color: '#f0b90b', ink: '#3a2f00' },
  { id: 'dot', name: 'Polkadot', ticker: 'DOT', glyph: '●', color: '#e6007a', ink: '#ffffff' },
  { id: 'ltc', name: 'Litecoin', ticker: 'LTC', glyph: 'Ł', color: '#a6b9d0', ink: '#1f2a37' },
  { id: 'avax', name: 'Avalanche', ticker: 'AVAX', glyph: '▲', color: '#e84142', ink: '#ffffff' },
  { id: 'ada', name: 'Cardano', ticker: 'ADA', glyph: '₳', color: '#0033ad', ink: '#ffffff' },
  { id: 'near', name: 'NEAR Protocol', ticker: 'NEAR', glyph: '◐', color: '#00ec97', ink: '#003322' },
  { id: 'link', name: 'Chainlink', ticker: 'LINK', glyph: '⬡', color: '#2a5ada', ink: '#ffffff' },
  { id: 'shib', name: 'Shiba Inu', ticker: 'SHIB', glyph: 'S', color: '#ff6b35', ink: '#ffffff' },
  { id: 'atom', name: 'Cosmos', ticker: 'ATOM', glyph: '⚛', color: '#6b6fa3', ink: '#ffffff' },
  { id: 'xrp', name: 'XRP', ticker: 'XRP', glyph: '×', color: '#25a4e8', ink: '#ffffff' },
  { id: 'trx', name: 'TRON', ticker: 'TRX', glyph: 'T', color: '#ef0027', ink: '#ffffff' },
  { id: 'xlm', name: 'Stellar', ticker: 'XLM', glyph: '✦', color: '#08b5e5', ink: '#ffffff' },
  { id: 'uni', name: 'Uniswap', ticker: 'UNI', glyph: 'U', color: '#ff007a', ink: '#ffffff' },
  { id: 'matic', name: 'Polygon', ticker: 'MATIC', glyph: 'M', color: '#8247e5', ink: '#ffffff' },
  { id: 'pepe', name: 'Pepe', ticker: 'PEPE', glyph: 'P', color: '#4caf50', ink: '#ffffff' },
  { id: 'arb', name: 'Arbitrum', ticker: 'ARB', glyph: 'A', color: '#28a0f0', ink: '#ffffff' },
  { id: 'op', name: 'Optimism', ticker: 'OP', glyph: 'O', color: '#ff0420', ink: '#ffffff' },
  { id: 'ton', name: 'Toncoin', ticker: 'TON', glyph: '✈', color: '#0098ea', ink: '#ffffff' },
  { id: 'wif', name: 'dogwifhat', ticker: 'WIF', glyph: 'W', color: '#84cc16', ink: '#1a2e05' },
  { id: 'sui', name: 'Sui', ticker: 'SUI', glyph: '≈', color: '#4da2ff', ink: '#ffffff' },
  { id: 'floki', name: 'Floki', ticker: 'FLOKI', glyph: 'F', color: '#e8a020', ink: '#3a2f00' },
  { id: 'inj', name: 'Injective', ticker: 'INJ', glyph: 'I', color: '#0082ff', ink: '#ffffff' },
  { id: 'zec', name: 'Zcash', ticker: 'ZEC', glyph: 'Z', color: '#f4b728', ink: '#3a2f00' },
  { id: 'theta', name: 'Theta', ticker: 'THETA', glyph: 'Θ', color: '#2ab8e6', ink: '#ffffff' },
  { id: 'egld', name: 'MultiversX', ticker: 'EGLD', glyph: 'E', color: '#0f172a', ink: '#ffffff' },
  { id: 'kava', name: 'Kava', ticker: 'KAVA', glyph: 'K', color: '#ff564f', ink: '#ffffff' },
  { id: 'btc', name: 'Bitcoin', ticker: 'BTC', glyph: '₿', color: '#f7931a', ink: '#3a2400' },
];

/** The coin hidden on a level (levelIndex 0-based). Level 30 is Bitcoin. */
export function coinForLevel(levelIndex) {
  return COINS[levelIndex] ?? COINS[COINS.length - 1];
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour by a percent. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** The metallic face of a coin as a CSS background: a highlight at the top
 *  left, the brand colour, and a darker rim — plus an inset ring. */
export function coinFaceBackground(coin) {
  const light = shade(coin.color, 45);
  const dark = shade(coin.color, -38);
  return `radial-gradient(circle at 35% 30%, ${light}, ${coin.color} 55%, ${dark})`;
}

/** The clip-path polygon for one pie slice of the coin: piece k of n, angles
 *  measured clockwise from the top (12 o'clock), as a CSS polygon(). */
export function sliceClip(k, n) {
  const step = (Math.PI * 2) / n;
  const a0 = -Math.PI / 2 + k * step;
  const a1 = -Math.PI / 2 + (k + 1) * step;
  const points = ['50% 50%'];
  const segments = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 36));
  for (let i = 0; i <= segments; i += 1) {
    const a = a0 + (a1 - a0) * (i / segments);
    const x = (50 + 50 * Math.cos(a)).toFixed(2);
    const y = (50 + 50 * Math.sin(a)).toFixed(2);
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(', ')})`;
}

/** Set a coin's colours as CSS custom properties on an element, so the
 *  .coin-face styles in style.css paint it in that coin's brand colour. */
export function applyCoinStyle(el, coin) {
  el.style.setProperty('--coin', coin.color);
  el.style.setProperty('--coin-light', shade(coin.color, 45));
  el.style.setProperty('--coin-dark', shade(coin.color, -38));
  el.style.setProperty('--coin-ink', coin.ink);
}
