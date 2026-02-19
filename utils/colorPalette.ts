
// Generate a comprehensive color palette with 30+ colors
// Organized by spectrum (hue) from left to right
// Organized by shade (lightness) from dark to light, top to bottom

export const COLOR_PALETTE = [
  // Reds (0-30°)
  '#8B0000', '#B22222', '#DC143C', '#FF0000', '#FF6347', '#FF7F7F',
  
  // Oranges (30-60°)
  '#8B4500', '#D2691E', '#FF8C00', '#FFA500', '#FFB347', '#FFDAB9',
  
  // Yellows (60-90°)
  '#8B8B00', '#DAA520', '#FFD700', '#FFFF00', '#FFFFE0', '#FFFACD',
  
  // Greens (90-150°)
  '#006400', '#228B22', '#32CD32', '#00FF00', '#90EE90', '#98FB98',
  
  // Cyans (150-210°)
  '#008B8B', '#20B2AA', '#00CED1', '#00FFFF', '#AFEEEE', '#E0FFFF',
  
  // Blues (210-270°)
  '#00008B', '#0000CD', '#0000FF', '#4169E1', '#87CEEB', '#B0E0E6',
  
  // Purples (270-330°)
  '#4B0082', '#8B008B', '#9370DB', '#BA55D3', '#DDA0DD', '#E6E6FA',
  
  // Magentas/Pinks (330-360°)
  '#8B0045', '#C71585', '#FF1493', '#FF69B4', '#FFB6C1', '#FFC0CB',
  
  // Grays
  '#000000', '#404040', '#808080', '#C0C0C0', '#E0E0E0', '#FFFFFF',
];

// Organize colors into a grid structure (6 columns x 9 rows)
export const COLOR_GRID_COLUMNS = 6;
export const COLOR_GRID_ROWS = Math.ceil(COLOR_PALETTE.length / COLOR_GRID_COLUMNS);
