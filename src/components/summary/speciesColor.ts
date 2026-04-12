/**
 * Shared color helpers for plant / tree species.
 * Imported by FieldCanvas (2D), FieldCanvas3D, and SummaryPage.
 */

export const SPECIES_PALETTE = [
  '#BFFF00','#DB7093','#123456','#4DE111','#FFD300','#2E5894','#03C03C','#A52A2A',
  '#ACE5EE','#00703C','#B76E79','#007FFF','#BCB88A','#C19A6B','#3F00FF','#002E1B',
  '#DA8A67','#00FFFF','#1B4D3E','#800000','#A1CAF1','#2ECC71','#EAA221','#1B263B',
  '#6B8E23','#E0B0FF','#AFEEEE','#71BC78','#B5A642','#08457E','#93C572','#80461B',
  '#00BFFF','#3CB371','#F1E5AC','#48D1CC','#98FF98','#704214','#6495ED','#8FBC8B',
  '#CD7F32','#00CED1','#006400','#FFB6C1','#1E90FF','#228B22','#F8DE7E','#5F9EA0',
  '#0BDA51','#E6E6FA','#32CD32','#FFBF00','#4169E1','#00FF00','#FF0000','#0000FF',
  '#39FF14','#FFD700','#00FFFF','#00FF7F','#FF00FF','#8A2BE2','#50C878','#FF4500',
  '#191970','#2E8B57','#DC143C','#4682B4','#228B22','#D4AF37','#00BFFF','#00A86B',
  '#B22222','#5D3FD3','#7FFF00','#FF6700','#1E90FF','#32CD32','#E0115F','#0077BE',
  '#ADFF2F','#FF1493','#00CED1','#00FA9A','#FF7F50','#89CFF0','#98FF98','#F4A460',
  '#B0E0E6','#66CDAA','#FFDAB9','#7DF9FF','#CCFF00','#FF8C00','#ADD8E6','#90EE90',
  '#E97451','#72A0C1','#FFFFFF',
]

function lightenHex(hex: string, amount = 40): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`
}

/** Deterministic color pair for a species name. Same name → same color every time. */
export function speciesColor(name: string): { base: string; hover: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  const base = SPECIES_PALETTE[Math.abs(h) % SPECIES_PALETTE.length]
  return { base, hover: lightenHex(base) }
}
