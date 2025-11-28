/**
 * Rail System - Rail track rendering with 2 tracks per tile
 * Handles rail network detection, track rendering, and rail station integration
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail orientation based on connections */
export type RailOrientation = 'ns' | 'ew' | 'ne' | 'nw' | 'se' | 'sw' | 'cross';

/** Rail rendering info for a tile */
export interface RailInfo {
  orientation: RailOrientation;
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Rail rendering constants */
export const RAIL_CONFIG = {
  TRACK_WIDTH: 1.5,              // Width of each rail track
  TRACK_SPACING: 8,              // Distance between the 2 tracks
  SLEEPER_WIDTH: 12,             // Width of railroad sleepers/ties
  SLEEPER_HEIGHT: 2,             // Height of sleepers
  SLEEPER_SPACING: 8,            // Distance between sleepers
  BALLAST_WIDTH_RATIO: 0.22,    // Width of gravel ballast as ratio of tile width
};

/** Colors for rail rendering */
export const RAIL_COLORS = {
  TRACK: '#4a5568',              // Dark gray for steel tracks
  TRACK_HIGHLIGHT: '#718096',    // Lighter gray for track highlights
  SLEEPER: '#8b4513',            // Brown for wooden sleepers
  BALLAST: '#6b7280',            // Gray for gravel ballast
  BALLAST_DARK: '#4b5563',       // Darker gray for ballast shadows
};

// ============================================================================
// Rail Analysis Functions
// ============================================================================

/**
 * Check if a tile is a rail
 */
function isRail(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
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
    north: isRail(grid, gridSize, x - 1, y),
    east: isRail(grid, gridSize, x, y - 1),
    south: isRail(grid, gridSize, x + 1, y),
    west: isRail(grid, gridSize, x, y + 1),
  };
}

/**
 * Determine rail orientation based on connections
 */
export function analyzeRailOrientation(
  adj: { north: boolean; east: boolean; south: boolean; west: boolean }
): RailOrientation {
  const { north, east, south, west } = adj;
  const connectionCount = [north, east, south, west].filter(Boolean).length;

  // 4-way crossing
  if (connectionCount >= 3) {
    return 'cross';
  }

  // 2-way connections (straights and curves)
  if (north && south && !east && !west) return 'ns';
  if (east && west && !north && !south) return 'ew';
  if (north && east && !south && !west) return 'ne';
  if (north && west && !east && !south) return 'nw';
  if (south && east && !north && !west) return 'se';
  if (south && west && !north && !east) return 'sw';

  // 1-way connection (default to NS for terminals)
  if (north || south) return 'ns';
  return 'ew';
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Draw a straight rail track segment (either NS or EW)
 */
function drawStraightTrack(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  trackSpacing: number
): void {
  // Calculate perpendicular offset for dual tracks
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  const perpX = -dy / len;
  const perpY = dx / len;

  // Draw sleepers (railroad ties) first
  const numSleepers = Math.floor(len / RAIL_CONFIG.SLEEPER_SPACING);
  ctx.fillStyle = RAIL_COLORS.SLEEPER;
  
  for (let i = 0; i <= numSleepers; i++) {
    const t = i / numSleepers;
    const sx = startX + dx * t;
    const sy = startY + dy * t;
    
    // Draw sleeper perpendicular to track direction
    const sleeperHalfWidth = RAIL_CONFIG.SLEEPER_WIDTH / 2;
    ctx.fillRect(
      sx + perpX * sleeperHalfWidth - perpY * RAIL_CONFIG.SLEEPER_HEIGHT / 2,
      sy + perpY * sleeperHalfWidth + perpX * RAIL_CONFIG.SLEEPER_HEIGHT / 2,
      RAIL_CONFIG.SLEEPER_WIDTH,
      RAIL_CONFIG.SLEEPER_HEIGHT
    );
  }

  // Draw left track
  ctx.strokeStyle = RAIL_COLORS.TRACK;
  ctx.lineWidth = RAIL_CONFIG.TRACK_WIDTH;
  ctx.beginPath();
  ctx.moveTo(startX + perpX * trackSpacing / 2, startY + perpY * trackSpacing / 2);
  ctx.lineTo(endX + perpX * trackSpacing / 2, endY + perpY * trackSpacing / 2);
  ctx.stroke();

  // Draw right track
  ctx.beginPath();
  ctx.moveTo(startX - perpX * trackSpacing / 2, startY - perpY * trackSpacing / 2);
  ctx.lineTo(endX - perpX * trackSpacing / 2, endY - perpY * trackSpacing / 2);
  ctx.stroke();

  // Add subtle highlights to tracks
  ctx.strokeStyle = RAIL_COLORS.TRACK_HIGHLIGHT;
  ctx.lineWidth = 0.5;
  
  ctx.beginPath();
  ctx.moveTo(startX + perpX * trackSpacing / 2, startY + perpY * trackSpacing / 2);
  ctx.lineTo(endX + perpX * trackSpacing / 2, endY + perpY * trackSpacing / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(startX - perpX * trackSpacing / 2, startY - perpY * trackSpacing / 2);
  ctx.lineTo(endX - perpX * trackSpacing / 2, endY - perpY * trackSpacing / 2);
  ctx.stroke();
}

/**
 * Draw a curved rail track segment
 */
function drawCurvedTrack(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  startAngle: number,
  endAngle: number,
  radius: number,
  trackSpacing: number
): void {
  // Draw sleepers along the curve
  const numSleepers = 6;
  ctx.fillStyle = RAIL_COLORS.SLEEPER;
  
  for (let i = 0; i <= numSleepers; i++) {
    const t = i / numSleepers;
    const angle = startAngle + (endAngle - startAngle) * t;
    const sx = centerX + Math.cos(angle) * radius;
    const sy = centerY + Math.sin(angle) * radius;
    
    // Sleeper perpendicular to curve
    const perpAngle = angle + Math.PI / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(perpAngle);
    ctx.fillRect(-RAIL_CONFIG.SLEEPER_WIDTH / 2, -RAIL_CONFIG.SLEEPER_HEIGHT / 2, RAIL_CONFIG.SLEEPER_WIDTH, RAIL_CONFIG.SLEEPER_HEIGHT);
    ctx.restore();
  }

  // Draw inner track
  ctx.strokeStyle = RAIL_COLORS.TRACK;
  ctx.lineWidth = RAIL_CONFIG.TRACK_WIDTH;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - trackSpacing / 2, startAngle, endAngle);
  ctx.stroke();

  // Draw outer track
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + trackSpacing / 2, startAngle, endAngle);
  ctx.stroke();

  // Add highlights
  ctx.strokeStyle = RAIL_COLORS.TRACK_HIGHLIGHT;
  ctx.lineWidth = 0.5;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - trackSpacing / 2, startAngle, endAngle);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + trackSpacing / 2, startAngle, endAngle);
  ctx.stroke();
}

/**
 * Draw ballast (gravel bed) under the tracks
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: RailOrientation
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const ballastWidth = w * RAIL_CONFIG.BALLAST_WIDTH_RATIO;

  // Diamond corners
  const topX = x + w / 2;
  const topY = y;
  const rightX = x + w;
  const rightY = y + h / 2;
  const bottomX = x + w / 2;
  const bottomY = y + h;
  const leftX = x;
  const leftY = y + h / 2;

  ctx.fillStyle = RAIL_COLORS.BALLAST;
  
  if (orientation === 'ns') {
    // NS ballast - vertical strip
    const offset = ballastWidth * 0.707; // diagonal offset
    ctx.beginPath();
    ctx.moveTo(leftX + offset, leftY - offset);
    ctx.lineTo(topX + offset, topY + offset);
    ctx.lineTo(rightX - offset, rightY - offset);
    ctx.lineTo(bottomX - offset, bottomY + offset);
    ctx.closePath();
    ctx.fill();
  } else if (orientation === 'ew') {
    // EW ballast - horizontal strip
    const offset = ballastWidth * 0.707;
    ctx.beginPath();
    ctx.moveTo(topX - offset, topY + offset);
    ctx.lineTo(rightX - offset, rightY + offset);
    ctx.lineTo(bottomX + offset, bottomY - offset);
    ctx.lineTo(leftX + offset, leftY - offset);
    ctx.closePath();
    ctx.fill();
  } else {
    // For curves and crosses, draw full diamond
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Main function to draw rail tracks on a tile
 */
export function drawRailTracks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  railInfo: RailInfo,
  zoom: number
): void {
  const w = TILE_WIDTH;
  const h = TILE_HEIGHT;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Diamond corner points
  const topCorner = { x: x + w / 2, y: y };
  const rightCorner = { x: x + w, y: y + h / 2 };
  const bottomCorner = { x: x + w / 2, y: y + h };
  const leftCorner = { x: x, y: y + h / 2 };

  // Edge midpoints (where tracks connect)
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;

  const trackSpacing = RAIL_CONFIG.TRACK_SPACING;

  // Draw ballast first (underneath the tracks)
  drawBallast(ctx, x, y, railInfo.orientation);

  // Draw tracks based on orientation
  switch (railInfo.orientation) {
    case 'ns':
      // Straight north-south tracks
      if (railInfo.hasNorth) {
        drawStraightTrack(ctx, cx, cy, northEdgeX, northEdgeY, trackSpacing);
      }
      if (railInfo.hasSouth) {
        drawStraightTrack(ctx, cx, cy, southEdgeX, southEdgeY, trackSpacing);
      }
      break;

    case 'ew':
      // Straight east-west tracks
      if (railInfo.hasEast) {
        drawStraightTrack(ctx, cx, cy, eastEdgeX, eastEdgeY, trackSpacing);
      }
      if (railInfo.hasWest) {
        drawStraightTrack(ctx, cx, cy, westEdgeX, westEdgeY, trackSpacing);
      }
      break;

    case 'ne':
      // Northeast curve
      {
        const curveRadius = w * 0.35;
        const curveCenterX = cx + curveRadius;
        const curveCenterY = cy - curveRadius;
        drawCurvedTrack(ctx, curveCenterX, curveCenterY, Math.PI, Math.PI * 1.5, curveRadius, trackSpacing);
      }
      break;

    case 'nw':
      // Northwest curve
      {
        const curveRadius = w * 0.35;
        const curveCenterX = cx - curveRadius;
        const curveCenterY = cy - curveRadius;
        drawCurvedTrack(ctx, curveCenterX, curveCenterY, Math.PI * 1.5, Math.PI * 2, curveRadius, trackSpacing);
      }
      break;

    case 'se':
      // Southeast curve
      {
        const curveRadius = w * 0.35;
        const curveCenterX = cx + curveRadius;
        const curveCenterY = cy + curveRadius;
        drawCurvedTrack(ctx, curveCenterX, curveCenterY, Math.PI * 0.5, Math.PI, curveRadius, trackSpacing);
      }
      break;

    case 'sw':
      // Southwest curve
      {
        const curveRadius = w * 0.35;
        const curveCenterX = cx - curveRadius;
        const curveCenterY = cy + curveRadius;
        drawCurvedTrack(ctx, curveCenterX, curveCenterY, 0, Math.PI * 0.5, curveRadius, trackSpacing);
      }
      break;

    case 'cross':
      // Crossing - draw all four directions
      if (railInfo.hasNorth) {
        drawStraightTrack(ctx, cx, cy, northEdgeX, northEdgeY, trackSpacing);
      }
      if (railInfo.hasEast) {
        drawStraightTrack(ctx, cx, cy, eastEdgeX, eastEdgeY, trackSpacing);
      }
      if (railInfo.hasSouth) {
        drawStraightTrack(ctx, cx, cy, southEdgeX, southEdgeY, trackSpacing);
      }
      if (railInfo.hasWest) {
        drawStraightTrack(ctx, cx, cy, westEdgeX, westEdgeY, trackSpacing);
      }
      break;
  }
}

/**
 * Get the expected train flow direction for a rail tile
 */
export function getTrainFlowDirection(railInfo: RailInfo): CarDirection[] {
  switch (railInfo.orientation) {
    case 'ns':
      return ['north', 'south'];
    case 'ew':
      return ['east', 'west'];
    case 'ne':
    case 'nw':
    case 'se':
    case 'sw':
    case 'cross':
      // Curves and crossings allow multiple directions
      const dirs: CarDirection[] = [];
      if (railInfo.hasNorth) dirs.push('north');
      if (railInfo.hasEast) dirs.push('east');
      if (railInfo.hasSouth) dirs.push('south');
      if (railInfo.hasWest) dirs.push('west');
      return dirs;
    default:
      return ['north', 'south'];
  }
}
