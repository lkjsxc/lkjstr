// Pictures of the mock world, drawn as SVG data URLs: nothing is fetched, so the mock works offline and under the
// production Content-Security-Policy (`img-src data:`).
const url = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** An avatar: two tones of one hue and a simple motif chosen by `n`. */
export function avatar(hue: number, n: number): string {
  const a = `hsl(${hue} 55% 46%)`;
  const b = `hsl(${(hue + 40) % 360} 60% 68%)`;
  const motifs = [
    `<circle cx="32" cy="38" r="16" fill="${b}"/><circle cx="32" cy="22" r="9" fill="#fff" opacity=".85"/>`,
    `<path d="M8 50 32 12l24 38z" fill="${b}"/><circle cx="44" cy="20" r="6" fill="#fff" opacity=".9"/>`,
    `<rect x="14" y="14" width="16" height="16" fill="${b}"/><rect x="34" y="34" width="16" height="16" fill="${b}"/><rect x="34" y="14" width="16" height="16" fill="#fff" opacity=".8"/>`,
    `<circle cx="32" cy="32" r="20" fill="none" stroke="${b}" stroke-width="7"/><circle cx="32" cy="32" r="6" fill="#fff"/>`,
    `<path d="M0 44q16-18 32 0t32 0v20H0z" fill="${b}"/><circle cx="20" cy="20" r="7" fill="#fff" opacity=".9"/>`,
  ];
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${a}"/>${motifs[n % motifs.length]}</svg>`,
  );
}

/** A "photo": sky, sun and two ridges in the given hue, at any size. */
export function photo(w: number, h: number, hue: number): string {
  const sky = `hsl(${hue} 60% 78%)`;
  const far = `hsl(${(hue + 20) % 360} 35% 55%)`;
  const near = `hsl(${(hue + 30) % 360} 40% 32%)`;
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${sky}"/><circle cx="${w * 0.72}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.1}" fill="#fff" opacity=".85"/><path d="M0 ${h * 0.62}L${w * 0.25} ${h * 0.42}L${w * 0.5} ${h * 0.6}L${w * 0.78} ${h * 0.38}L${w} ${h * 0.58}V${h}H0z" fill="${far}"/><path d="M0 ${h * 0.8}L${w * 0.3} ${h * 0.62}L${w * 0.62} ${h * 0.82}L${w} ${h * 0.66}V${h}H0z" fill="${near}"/></svg>`,
  );
}

/** A banner: a wide band of the profile's hue. */
export function banner(hue: number): string {
  return photo(1500, 500, hue);
}

/** A custom emoji: a rounded tile with one glyph. */
export function emojiTile(glyph: string, hue: number): string {
  return url(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="hsl(${hue} 70% 88%)"/><text x="32" y="34" font-size="38" font-family="sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="middle" fill="hsl(${hue} 60% 30%)">${glyph}</text></svg>`,
  );
}

export const hueColor = (hue: number): string => {
  // The average tone of `photo`, for the reserved box before the image paints.
  const c = (v: number): string =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  const [s, l] = [0.4, 0.6];
  const f = (k: number): number => {
    const a = s * Math.min(l, 1 - l);
    const t = (k + hue / 30) % 12;
    return l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1));
  };
  return `#${c(f(0))}${c(f(8))}${c(f(4))}`;
};
