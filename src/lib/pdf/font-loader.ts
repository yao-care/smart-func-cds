import type jsPDF from 'jspdf';

let cached: { regular: string; bold: string } | null = null;

async function fetchFontBase64(filename: string, exportName: string): Promise<string> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const url = `${base}/fonts/${filename}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  // nosemgrep: non-literal-regexp — exportName 僅來自本檔 loadChineseFontInto() 的兩個編譯期字面值
  // （'NotoSansTC_Regular_base64' / 'NotoSansTC_Bold_base64'），非外部輸入；且 [^']+ 為線性比對，無指數回溯。
  const match = text.match(new RegExp(`export const ${exportName} = '([^']+)'`));
  if (!match) throw new Error(`Cannot parse font module: ${filename}`);
  return match[1];
}

/**
 * Load Noto Sans TC (Regular + Bold) subset fonts into the given jsPDF doc.
 * Uses runtime fetch from public/fonts/ to avoid bundling ~960KB into the main chunk.
 * Caches across calls within the same page lifetime.
 *
 * The `'Identity-H'` encoding is required for CJK rendering — without it
 * jsPDF defaults to WinAnsi and CJK glyphs render as blanks.
 */
export async function loadChineseFontInto(doc: jsPDF): Promise<void> {
  if (!cached) {
    const [regular, bold] = await Promise.all([
      fetchFontBase64('NotoSansTC-subset-regular.js', 'NotoSansTC_Regular_base64'),
      fetchFontBase64('NotoSansTC-subset-bold.js', 'NotoSansTC_Bold_base64'),
    ]);
    cached = { regular, bold };
  }
  doc.addFileToVFS('NotoSansTC-Regular.ttf', cached.regular);
  doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal', 'Identity-H');
  doc.addFileToVFS('NotoSansTC-Bold.ttf', cached.bold);
  doc.addFont('NotoSansTC-Bold.ttf', 'NotoSansTC', 'bold', 'Identity-H');
}
