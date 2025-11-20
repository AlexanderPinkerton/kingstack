const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

let sharedCanvasCtx: CanvasRenderingContext2D | null = null;

function getCanvasContext() {
  if (sharedCanvasCtx || typeof document === "undefined") return sharedCanvasCtx;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  sharedCanvasCtx = canvas.getContext("2d");
  return sharedCanvasCtx;
}

export function colorToHex(color: string) {
  if (!color) return "#000000";
  if (hexPattern.test(color)) {
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
    }
    return color.toLowerCase();
  }
  const ctx = getCanvasContext();
  if (!ctx) return "#000000";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`;
}

function hexToRgb(hex: string) {
  const normalized = colorToHex(hex).replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = channel(r);
  const G = channel(g);
  const B = channel(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1: string, hex2: string) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(background?: string, text?: string) {
  const bgHex = background ? colorToHex(background) : "#000000";
  const textHex = text ? colorToHex(text) : "";
  if (!textHex) {
    return relativeLuminance(bgHex) > 0.6 ? "#0f172a" : "#ffffff";
  }
  const ratio = contrastRatio(bgHex, textHex);
  if (ratio < 3.5) {
    return relativeLuminance(bgHex) > 0.6 ? "#0f172a" : "#ffffff";
  }
  return textHex;
}

