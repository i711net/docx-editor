import { Chart, registerables } from 'chart.js';
import type { Sheet } from '@fortune-sheet/core';

Chart.register(...registerables);

export type ChartKind = 'bar' | 'line' | 'pie';

export interface ParsedRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

const CELL_RE = /^([A-Za-z]+)(\d+)$/;

function colLettersToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1; // 0-indexed
}

/** Parses an Excel-style range like "A1:C5" (or a single cell "A1") into
 * 0-indexed row/col bounds. Throws a user-facing message on anything it
 * can't parse, rather than silently guessing. */
export function parseA1Range(input: string): ParsedRange {
  const trimmed = input.trim().toUpperCase().replace(/\$/g, '');
  const parts = trimmed.split(':');
  if (parts.length < 1 || parts.length > 2 || trimmed === '') {
    throw new Error(`无法识别的区域"${input}"，请使用类似 A1:C5 的格式`);
  }
  const first = parts[0].match(CELL_RE);
  const second = parts.length === 2 ? parts[1].match(CELL_RE) : first;
  if (!first || !second) {
    throw new Error(`无法识别的区域"${input}"，请使用类似 A1:C5 的格式`);
  }

  const c1 = colLettersToIndex(first[1]);
  const r1 = Number(first[2]) - 1;
  const c2 = colLettersToIndex(second[1]);
  const r2 = Number(second[2]) - 1;

  return {
    startRow: Math.min(r1, r2),
    endRow: Math.max(r1, r2),
    startCol: Math.min(c1, c2),
    endCol: Math.max(c1, c2),
  };
}

export interface ChartData {
  labels: string[];
  series: { name: string; values: number[] }[];
}

/**
 * Reads the given range out of a Fortune-sheet `Sheet`'s celldata and turns
 * it into {labels, series} for charting. This is a heuristic, not a
 * spreadsheet formula engine (this is a basic-tier chart feature): with two
 * or more columns where the top-left cell isn't numeric, the first row is
 * treated as series names and the first column as category labels (the
 * common "header row + label column" table shape). With a single column,
 * row position becomes the label.
 */
export function extractChartData(sheet: Sheet, range: ParsedRange): ChartData {
  const { startRow, endRow, startCol, endCol } = range;
  const celldata = sheet.celldata ?? [];
  const grid: (string | number | null)[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: (string | number | null)[] = [];
    for (let c = startCol; c <= endCol; c++) {
      const cell = celldata.find((cd) => cd.r === r && cd.c === c);
      const v = cell?.v;
      if (!v) {
        row.push(null);
        continue;
      }
      if (typeof v.v === 'number') {
        row.push(v.v);
      } else if (typeof v.m === 'string' && v.m.trim() !== '' && !Number.isNaN(Number(v.m))) {
        // `.m` ("mask"/display text) is only present in some cell shapes;
        // when it looks numeric, prefer it (it reflects any number
        // formatting) over the raw value.
        row.push(Number(v.m));
      } else if (typeof v.v === 'string' && v.v.trim() !== '' && !Number.isNaN(Number(v.v))) {
        // Fortune-sheet cells (e.g. freshly imported from a real .xlsx) can
        // store a purely numeric value as a *string* in `.v` with no `.m`
        // at all — still a number as far as charting is concerned.
        row.push(Number(v.v));
      } else {
        row.push(v.m != null ? String(v.m) : v.v != null ? String(v.v) : null);
      }
    }
    grid.push(row);
  }

  if (grid.length === 0 || grid[0].length === 0) {
    throw new Error('所选区域内没有数据');
  }

  const numCols = grid[0].length;
  const hasHeaderRow = numCols >= 2 && typeof grid[0][0] !== 'number';

  if (numCols === 1) {
    return {
      labels: grid.map((_, i) => `第 ${i + 1} 行`),
      series: [{ name: '数值', values: grid.map((row) => (typeof row[0] === 'number' ? row[0] : 0)) }],
    };
  }

  const dataRows = hasHeaderRow ? grid.slice(1) : grid;
  const labels = dataRows.map((row) => (row[0] != null ? String(row[0]) : ''));
  const series: { name: string; values: number[] }[] = [];
  for (let c = 1; c < numCols; c++) {
    const name = hasHeaderRow && grid[0][c] != null ? String(grid[0][c]) : `系列 ${c}`;
    series.push({
      name,
      values: dataRows.map((row) => {
        const cell = row[c];
        return typeof cell === 'number' ? cell : 0;
      }),
    });
  }
  return { labels, series };
}

const SERIES_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#DB2777'];

/**
 * Renders the given data to an offscreen canvas with Chart.js and returns a
 * PNG data URL. This PNG (not a live chart object) is what actually gets
 * embedded into the sheet, and — on save — the real .xlsx, as a floating
 * picture. That's a deliberate, honestly-scoped tradeoff: our export path
 * (@corbe30/fortune-excel wrapping exceljs) has no support for writing
 * native Excel chart XML, so "insert as a picture of the chart" is the
 * option that's actually portable, matching the same "picture instead of
 * unsupported native object" tradeoff this project already made for
 * PDF-page-as-image import elsewhere.
 */
export async function renderChartToDataUrl(
  kind: ChartKind,
  data: ChartData,
  title: string,
  widthPx = 480,
  heightPx = 300,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx * 2; // 2x for a crisp embedded image
  canvas.height = heightPx * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建绘图画布');

  const chart = new Chart(ctx, {
    type: kind,
    data: {
      labels: data.labels,
      datasets:
        kind === 'pie'
          ? [
              {
                label: data.series[0]?.name ?? '数值',
                data: data.series[0]?.values ?? [],
                backgroundColor: data.labels.map((_, i) => SERIES_COLORS[i % SERIES_COLORS.length]),
              },
            ]
          : data.series.map((s, i) => ({
              label: s.name,
              data: s.values,
              backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
              borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
              fill: kind === 'bar',
            })),
    },
    options: {
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
      plugins: {
        title: { display: !!title, text: title, font: { size: 18 } },
        legend: { display: kind === 'pie' || data.series.length > 1 },
      },
    },
  });

  const url = canvas.toDataURL('image/png');
  chart.destroy();
  return url;
}
