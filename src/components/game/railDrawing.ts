/**
 * Rail Drawing System - Renders rail tracks with ties and rails
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Colors for rail rendering
// ============================================================================

export const RAIL_COLORS = {
  GRAVEL: '#6b5b4a',           // Rail bed gravel/ballast
  GRAVEL_DARK: '#5a4a3a',      // Darker gravel for depth
  GRAVEL_LIGHT: '#7c6c5c',     // Lighter gravel highlights
  TIE_WOOD: '#4a3728',         // Wooden railroad tie
  TIE_WOOD_DARK: '#3a2718',    // Darker tie edge
  RAIL_STEEL: '#a0a0a0',       // Steel rail
  RAIL_STEEL_DARK: '#707070',  // Rail shadow
  RAIL_STEEL_HIGHLIGHT: '#c0c0c0', // Rail highlight
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail
 */
export function isRailAt(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'rail' || type === 'rail_station';
}

/**
 * Get adjacent rail info for a tile
 */
export function getAdjacentRails(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): { north: boolean; east: boolean; south: boolean; west: boolean } {
  return {
    north: isRailAt(grid, gridSize, x - 1, y),
    east: isRailAt(grid, gridSize, x, y - 1),
    south: isRailAt(grid, gridSize, x + 1, y),
    west: isRailAt(grid, gridSize, x, y + 1),
  };
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Draw a single railroad tie (sleeper)
 */
function drawRailTie(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  
  // Draw the wooden tie
  ctx.fillStyle = RAIL_COLORS.TIE_WOOD;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  
  // Add darker edge for depth
  ctx.fillStyle = RAIL_COLORS.TIE_WOOD_DARK;
  ctx.fillRect(-width / 2, height / 2 - 1, width, 1);
  
  ctx.restore();
}

/**
 * Draw steel rails
 */
function drawRails(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  gauge: number // Distance between rails
): void {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  
  // Perpendicular vector for rail offset
  const perpX = -dy / len * gauge / 2;
  const perpY = dx / len * gauge / 2;
  
  // Draw left rail
  ctx.strokeStyle = RAIL_COLORS.RAIL_STEEL_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX + perpX, startY + perpY);
  ctx.lineTo(endX + perpX, endY + perpY);
  ctx.stroke();
  
  ctx.strokeStyle = RAIL_COLORS.RAIL_STEEL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX + perpX - 0.3, startY + perpY - 0.3);
  ctx.lineTo(endX + perpX - 0.3, endY + perpY - 0.3);
  ctx.stroke();
  
  // Draw right rail
  ctx.strokeStyle = RAIL_COLORS.RAIL_STEEL_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX - perpX, startY - perpY);
  ctx.lineTo(endX - perpX, endY - perpY);
  ctx.stroke();
  
  ctx.strokeStyle = RAIL_COLORS.RAIL_STEEL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(startX - perpX - 0.3, startY - perpY - 0.3);
  ctx.lineTo(endX - perpX - 0.3, endY - perpY - 0.3);
  ctx.stroke();
}

/**
 * Draw the rail bed (gravel/ballast)
 */
function drawRailBed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  adj: { north: boolean; east: boolean; south: boolean; west: boolean },
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  
  // Diamond corner points
  const topCorner = { x: x + w / 2, y: y };
  const rightCorner = { x: x + w, y: y + h / 2 };
  const bottomCorner = { x: x + w / 2, y: y + h };
  const leftCorner = { x: x, y: y + h / 2 };
  
  // Draw the gravel bed base (full tile)
  ctx.fillStyle = RAIL_COLORS.GRAVEL;
  ctx.beginPath();
  ctx.moveTo(topCorner.x, topCorner.y);
  ctx.lineTo(rightCorner.x, rightCorner.y);
  ctx.lineTo(bottomCorner.x, bottomCorner.y);
  ctx.lineTo(leftCorner.x, leftCorner.y);
  ctx.closePath();
  ctx.fill();
  
  // Add gravel texture when zoomed in
  if (zoom >= 0.8) {
    ctx.fillStyle = RAIL_COLORS.GRAVEL_DARK;
    const dotCount = 20;
    for (let i = 0; i < dotCount; i++) {
      const seed = (x * 23 + y * 37 + i * 11) % 100;
      const offsetX = (seed % 60 - 30) / 100 * w;
      const offsetY = ((seed * 7) % 60 - 30) / 100 * h;
      const dotX = x + w / 2 + offsetX;
      const dotY = y + h / 2 + offsetY;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.fillStyle = RAIL_COLORS.GRAVEL_LIGHT;
    for (let i = 0; i < dotCount / 2; i++) {
      const seed = (x * 29 + y * 41 + i * 13) % 100;
      const offsetX = (seed % 50 - 25) / 100 * w;
      const offsetY = ((seed * 5) % 50 - 25) / 100 * h;
      const dotX = x + w / 2 + offsetX;
      const dotY = y + h / 2 + offsetY;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw edge border
  if (zoom >= 0.6) {
    ctx.strokeStyle = RAIL_COLORS.GRAVEL_DARK;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(rightCorner.x, rightCorner.y);
    ctx.lineTo(bottomCorner.x, bottomCorner.y);
    ctx.lineTo(leftCorner.x, leftCorner.y);
    ctx.closePath();
    ctx.stroke();
  }
}

/**
 * Draw rails with ties on a tile
 */
export function drawRailTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  adj: { north: boolean; east: boolean; south: boolean; west: boolean },
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;
  
  // Edge midpoints
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  // Draw the gravel bed first
  drawRailBed(ctx, x, y, adj, zoom);
  
  // Rail gauge (distance between rails)
  const gauge = 8;
  
  // Tie dimensions
  const tieWidth = 14;
  const tieHeight = 3;
  const tieSpacing = 6;
  
  // Draw rails and ties for each connected direction
  const segments: { startX: number; startY: number; endX: number; endY: number; angle: number }[] = [];
  
  if (adj.north) {
    segments.push({
      startX: cx,
      startY: cy,
      endX: northEdgeX,
      endY: northEdgeY,
      angle: Math.atan2(northEdgeY - cy, northEdgeX - cx),
    });
  }
  
  if (adj.east) {
    segments.push({
      startX: cx,
      startY: cy,
      endX: eastEdgeX,
      endY: eastEdgeY,
      angle: Math.atan2(eastEdgeY - cy, eastEdgeX - cx),
    });
  }
  
  if (adj.south) {
    segments.push({
      startX: cx,
      startY: cy,
      endX: southEdgeX,
      endY: southEdgeY,
      angle: Math.atan2(southEdgeY - cy, southEdgeX - cx),
    });
  }
  
  if (adj.west) {
    segments.push({
      startX: cx,
      startY: cy,
      endX: westEdgeX,
      endY: westEdgeY,
      angle: Math.atan2(westEdgeY - cy, westEdgeX - cx),
    });
  }
  
  // If no connections, draw a cross pattern
  if (segments.length === 0) {
    segments.push(
      { startX: northEdgeX, startY: northEdgeY, endX: southEdgeX, endY: southEdgeY, angle: Math.atan2(southEdgeY - northEdgeY, southEdgeX - northEdgeX) },
      { startX: eastEdgeX, startY: eastEdgeY, endX: westEdgeX, endY: westEdgeY, angle: Math.atan2(westEdgeY - eastEdgeY, westEdgeX - eastEdgeX) }
    );
  }
  
  // Draw ties first (below rails)
  if (zoom >= 0.5) {
    for (const seg of segments) {
      const dx = seg.endX - seg.startX;
      const dy = seg.endY - seg.startY;
      const len = Math.hypot(dx, dy);
      const numTies = Math.max(2, Math.floor(len / tieSpacing));
      
      // Perpendicular angle for tie orientation
      const tieAngle = seg.angle + Math.PI / 2;
      
      for (let i = 0; i < numTies; i++) {
        const t = (i + 0.5) / numTies;
        const tieX = seg.startX + dx * t;
        const tieY = seg.startY + dy * t;
        drawRailTie(ctx, tieX, tieY, tieAngle, tieWidth, tieHeight);
      }
    }
  }
  
  // Draw rails on top
  for (const seg of segments) {
    drawRails(ctx, seg.startX, seg.startY, seg.endX, seg.endY, gauge);
  }
  
  // Handle curved/intersection rails
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  
  if (connectionCount >= 2) {
    // Draw connecting rails through center for turns
    const connected: { x: number; y: number }[] = [];
    if (adj.north) connected.push({ x: northEdgeX, y: northEdgeY });
    if (adj.east) connected.push({ x: eastEdgeX, y: eastEdgeY });
    if (adj.south) connected.push({ x: southEdgeX, y: southEdgeY });
    if (adj.west) connected.push({ x: westEdgeX, y: westEdgeY });
    
    // For 2-way connections that aren't straight, draw curved segment indication
    if (connectionCount === 2) {
      const isNS = adj.north && adj.south;
      const isEW = adj.east && adj.west;
      
      if (!isNS && !isEW) {
        // This is a turn - draw extra ties in the corner
        if (zoom >= 0.6) {
          const corners = [];
          if (adj.north && adj.east) corners.push({ x: cx + 6, y: cy - 4, angle: Math.PI / 4 });
          if (adj.north && adj.west) corners.push({ x: cx - 6, y: cy + 4, angle: -Math.PI / 4 });
          if (adj.south && adj.east) corners.push({ x: cx + 6, y: cy + 4, angle: -Math.PI / 4 });
          if (adj.south && adj.west) corners.push({ x: cx - 6, y: cy - 4, angle: Math.PI / 4 });
          
          for (const corner of corners) {
            drawRailTie(ctx, corner.x, corner.y, corner.angle, tieWidth * 0.8, tieHeight);
          }
        }
      }
    }
  }
}

/**
 * Draw a rail station building (platform with canopy)
 */
export function drawRailStation(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number, // 2x2
  zoom: number,
  visualHour: number
): void {
  const w = TILE_WIDTH * size;
  const h = TILE_HEIGHT * size;
  const isNight = visualHour >= 20 || visualHour < 6;
  
  // Platform base
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
  
  // Platform edge
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Yellow safety line
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  const inset = 8;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + inset);
  ctx.lineTo(x + w - inset * 1.5, y + h / 2);
  ctx.lineTo(x + w / 2, y + h - inset);
  ctx.lineTo(x + inset * 1.5, y + h / 2);
  ctx.closePath();
  ctx.stroke();
  
  // Draw canopy/roof structure
  const roofHeight = 25;
  const roofInset = 15;
  
  // Canopy supports (pillars)
  ctx.fillStyle = '#4b5563';
  const pillarPositions = [
    { x: x + w * 0.3, y: y + h * 0.3 },
    { x: x + w * 0.7, y: y + h * 0.3 },
    { x: x + w * 0.3, y: y + h * 0.7 },
    { x: x + w * 0.7, y: y + h * 0.7 },
  ];
  
  for (const pos of pillarPositions) {
    ctx.fillRect(pos.x - 2, pos.y - roofHeight, 4, roofHeight);
  }
  
  // Canopy roof
  ctx.fillStyle = '#374151';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + roofInset - roofHeight);
  ctx.lineTo(x + w - roofInset, y + h / 2 - roofHeight);
  ctx.lineTo(x + w / 2, y + h - roofInset - roofHeight);
  ctx.lineTo(x + roofInset, y + h / 2 - roofHeight);
  ctx.closePath();
  ctx.fill();
  
  // Roof highlight
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + roofInset - roofHeight);
  ctx.lineTo(x + w - roofInset, y + h / 2 - roofHeight);
  ctx.lineTo(x + w / 2 + 5, y + h * 0.4 - roofHeight);
  ctx.lineTo(x + roofInset + 5, y + h / 2 - 5 - roofHeight);
  ctx.closePath();
  ctx.fill();
  
  // Station sign
  if (zoom >= 0.6) {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(x + w / 2 - 15, y + h * 0.35 - roofHeight - 8, 30, 10);
    
    // Sign text (simplified)
    ctx.fillStyle = '#ffffff';
    ctx.font = '6px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STATION', x + w / 2, y + h * 0.35 - roofHeight);
  }
  
  // Platform lights at night
  if (isNight && zoom >= 0.5) {
    ctx.fillStyle = '#fef3c7';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    
    for (const pos of pillarPositions) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - roofHeight + 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
  }
  
  // Benches (when zoomed in)
  if (zoom >= 0.8) {
    ctx.fillStyle = '#78716c';
    const benchPositions = [
      { x: x + w * 0.4, y: y + h * 0.5 },
      { x: x + w * 0.6, y: y + h * 0.5 },
    ];
    
    for (const pos of benchPositions) {
      ctx.fillRect(pos.x - 5, pos.y - 2, 10, 4);
    }
  }
}
