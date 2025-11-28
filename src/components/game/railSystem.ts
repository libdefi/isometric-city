/**
 * Rail System - Rail tracks with train support
 * Handles rail network detection and rail track rendering
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, CarDirection } from './types';

// ============================================================================
// Types
// ============================================================================

/** Rail type based on adjacent rail analysis */
export type RailOrientation = 'ns' | 'ew' | 'intersection';

/** Rail info for a tile */
export interface RailInfo {
  orientation: RailOrientation;
  // Which directions have rails
  hasNorth: boolean;
  hasEast: boolean;
  hasSouth: boolean;
  hasWest: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Colors for rail rendering */
export const RAIL_COLORS = {
  BALLAST: '#6b7280',        // Gray gravel/ballast
  BALLAST_DARK: '#4b5563',   // Darker ballast
  TIE: '#4a3728',            // Wooden railroad ties
  RAIL_METAL: '#374151',     // Dark steel rails
  RAIL_SHINE: '#9ca3af',     // Highlight on rails
};

/** Rail rendering constants */
export const RAIL_CONFIG = {
  TRACK_SPACING: 0.20,       // Distance between two tracks (as ratio of tile width)
  RAIL_WIDTH: 0.03,          // Width of each rail
  TIE_WIDTH: 0.05,           // Width of railroad ties
  TIE_SPACING: 0.15,         // Distance between ties
  BALLAST_WIDTH: 0.35,       // Width of ballast bed
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
 * Analyze rail orientation
 */
export function analyzeRail(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): RailInfo {
  if (!isRail(grid, gridSize, x, y)) {
    return {
      orientation: 'intersection',
      hasNorth: false,
      hasEast: false,
      hasSouth: false,
      hasWest: false,
    };
  }

  const adj = getAdjacentRails(grid, gridSize, x, y);
  
  // Count connections
  const connectionCount = [adj.north, adj.east, adj.south, adj.west].filter(Boolean).length;
  
  // Determine orientation
  const isNSRail = adj.north || adj.south;
  const isEWRail = adj.east || adj.west;
  
  let orientation: RailOrientation = 'intersection';
  
  if (connectionCount >= 3) {
    orientation = 'intersection';
  } else if (isNSRail && !isEWRail) {
    orientation = 'ns';
  } else if (isEWRail && !isNSRail) {
    orientation = 'ew';
  } else if (connectionCount >= 2) {
    orientation = 'intersection';
  } else if (isNSRail) {
    orientation = 'ns';
  } else if (isEWRail) {
    orientation = 'ew';
  }
  
  return {
    orientation,
    hasNorth: adj.north,
    hasEast: adj.east,
    hasSouth: adj.south,
    hasWest: adj.west,
  };
}

// ============================================================================
// Rail Drawing Functions
// ============================================================================

/**
 * Draw railroad tie (crossbeam)
 */
function drawRailTie(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const perpX = -dy / len * width;
  const perpY = dx / len * width;
  
  ctx.fillStyle = RAIL_COLORS.TIE;
  ctx.beginPath();
  ctx.moveTo(x1 + perpX, y1 + perpY);
  ctx.lineTo(x2 + perpX, y2 + perpY);
  ctx.lineTo(x2 - perpX, y2 - perpY);
  ctx.lineTo(x1 - perpX, y1 - perpY);
  ctx.closePath();
  ctx.fill();
  
  // Add wood grain detail
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Draw a single rail track (steel rail)
 */
function drawRailTrack(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  // Main rail body
  ctx.strokeStyle = RAIL_COLORS.RAIL_METAL;
  ctx.lineWidth = TILE_WIDTH * RAIL_CONFIG.RAIL_WIDTH;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  // Highlight on rail (metallic shine)
  ctx.strokeStyle = RAIL_COLORS.RAIL_SHINE;
  ctx.lineWidth = TILE_WIDTH * RAIL_CONFIG.RAIL_WIDTH * 0.3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Draw ballast bed (gravel base for tracks)
 */
function drawBallast(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const perpX = -dy / len * width;
  const perpY = dx / len * width;
  
  // Draw ballast as a slightly raised bed
  const gradient = ctx.createLinearGradient(
    x1 + perpX, y1 + perpY,
    x1 - perpX, y1 - perpY
  );
  gradient.addColorStop(0, RAIL_COLORS.BALLAST_DARK);
  gradient.addColorStop(0.5, RAIL_COLORS.BALLAST);
  gradient.addColorStop(1, RAIL_COLORS.BALLAST_DARK);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x1 + perpX, y1 + perpY);
  ctx.lineTo(x2 + perpX, y2 + perpY);
  ctx.lineTo(x2 - perpX, y2 - perpY);
  ctx.lineTo(x1 - perpX, y1 - perpY);
  ctx.closePath();
  ctx.fill();
}

/**
 * Main function to draw rail segment with two parallel tracks
 */
export function drawRailSegment(
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
  
  // Edge midpoints for connections
  const northEdgeX = x + w * 0.25;
  const northEdgeY = y + h * 0.25;
  const eastEdgeX = x + w * 0.75;
  const eastEdgeY = y + h * 0.25;
  const southEdgeX = x + w * 0.75;
  const southEdgeY = y + h * 0.75;
  const westEdgeX = x + w * 0.25;
  const westEdgeY = y + h * 0.75;
  
  const trackSpacing = w * RAIL_CONFIG.TRACK_SPACING;
  const ballastWidth = w * RAIL_CONFIG.BALLAST_WIDTH;
  const tieWidth = w * RAIL_CONFIG.TIE_WIDTH;
  
  // Draw based on orientation
  if (railInfo.orientation === 'ns' || (railInfo.hasNorth && railInfo.hasSouth)) {
    // North-South rails
    const startX = northEdgeX;
    const startY = northEdgeY;
    const endX = southEdgeX;
    const endY = southEdgeY;
    
    // Calculate perpendicular direction for track offset
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len;
    const perpY = dx / len;
    
    // Draw ballast bed
    drawBallast(ctx, startX, startY, endX, endY, ballastWidth);
    
    // Draw ties at intervals
    if (zoom >= 0.6) {
      const tieSpacing = w * RAIL_CONFIG.TIE_SPACING;
      const numTies = Math.floor(len / tieSpacing);
      
      for (let i = 0; i <= numTies; i++) {
        const t = i / numTies;
        const tieX = startX + dx * t;
        const tieY = startY + dy * t;
        
        // Tie extends perpendicular to track
        const tieX1 = tieX + perpX * ballastWidth;
        const tieY1 = tieY + perpY * ballastWidth;
        const tieX2 = tieX - perpX * ballastWidth;
        const tieY2 = tieY - perpY * ballastWidth;
        
        drawRailTie(ctx, tieX1, tieY1, tieX2, tieY2, tieWidth);
      }
    }
    
    // Draw two parallel rail tracks
    // Track 1 (left)
    const track1StartX = startX + perpX * trackSpacing;
    const track1StartY = startY + perpY * trackSpacing;
    const track1EndX = endX + perpX * trackSpacing;
    const track1EndY = endY + perpY * trackSpacing;
    drawRailTrack(ctx, track1StartX, track1StartY, track1EndX, track1EndY);
    
    // Track 2 (right)
    const track2StartX = startX - perpX * trackSpacing;
    const track2StartY = startY - perpY * trackSpacing;
    const track2EndX = endX - perpX * trackSpacing;
    const track2EndY = endY - perpY * trackSpacing;
    drawRailTrack(ctx, track2StartX, track2StartY, track2EndX, track2EndY);
  } else if (railInfo.orientation === 'ew' || (railInfo.hasEast && railInfo.hasWest)) {
    // East-West rails
    const startX = eastEdgeX;
    const startY = eastEdgeY;
    const endX = westEdgeX;
    const endY = westEdgeY;
    
    // Calculate perpendicular direction for track offset
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.hypot(dx, dy);
    const perpX = -dy / len;
    const perpY = dx / len;
    
    // Draw ballast bed
    drawBallast(ctx, startX, startY, endX, endY, ballastWidth);
    
    // Draw ties at intervals
    if (zoom >= 0.6) {
      const tieSpacing = w * RAIL_CONFIG.TIE_SPACING;
      const numTies = Math.floor(len / tieSpacing);
      
      for (let i = 0; i <= numTies; i++) {
        const t = i / numTies;
        const tieX = startX + dx * t;
        const tieY = startY + dy * t;
        
        // Tie extends perpendicular to track
        const tieX1 = tieX + perpX * ballastWidth;
        const tieY1 = tieY + perpY * ballastWidth;
        const tieX2 = tieX - perpX * ballastWidth;
        const tieY2 = tieY - perpY * ballastWidth;
        
        drawRailTie(ctx, tieX1, tieY1, tieX2, tieY2, tieWidth);
      }
    }
    
    // Draw two parallel rail tracks
    // Track 1 (top)
    const track1StartX = startX + perpX * trackSpacing;
    const track1StartY = startY + perpY * trackSpacing;
    const track1EndX = endX + perpX * trackSpacing;
    const track1EndY = endY + perpY * trackSpacing;
    drawRailTrack(ctx, track1StartX, track1StartY, track1EndX, track1EndY);
    
    // Track 2 (bottom)
    const track2StartX = startX - perpX * trackSpacing;
    const track2StartY = startY - perpY * trackSpacing;
    const track2EndX = endX - perpX * trackSpacing;
    const track2EndY = endY - perpY * trackSpacing;
    drawRailTrack(ctx, track2StartX, track2StartY, track2EndX, track2EndY);
  } else {
    // Intersection or complex junction - draw all connected directions
    // Draw ballast for the whole tile
    ctx.fillStyle = RAIL_COLORS.BALLAST;
    ctx.beginPath();
    ctx.moveTo(topCorner.x, topCorner.y);
    ctx.lineTo(rightCorner.x, rightCorner.y);
    ctx.lineTo(bottomCorner.x, bottomCorner.y);
    ctx.lineTo(leftCorner.x, leftCorner.y);
    ctx.closePath();
    ctx.fill();
    
    // Draw tracks for each direction
    if (railInfo.hasNorth) {
      const startX = cx;
      const startY = cy;
      const endX = northEdgeX;
      const endY = northEdgeY;
      
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      
      // Two parallel tracks
      drawRailTrack(
        ctx,
        startX + perpX * trackSpacing, startY + perpY * trackSpacing,
        endX + perpX * trackSpacing, endY + perpY * trackSpacing
      );
      drawRailTrack(
        ctx,
        startX - perpX * trackSpacing, startY - perpY * trackSpacing,
        endX - perpX * trackSpacing, endY - perpY * trackSpacing
      );
    }
    
    if (railInfo.hasEast) {
      const startX = cx;
      const startY = cy;
      const endX = eastEdgeX;
      const endY = eastEdgeY;
      
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      
      drawRailTrack(
        ctx,
        startX + perpX * trackSpacing, startY + perpY * trackSpacing,
        endX + perpX * trackSpacing, endY + perpY * trackSpacing
      );
      drawRailTrack(
        ctx,
        startX - perpX * trackSpacing, startY - perpY * trackSpacing,
        endX - perpX * trackSpacing, endY - perpY * trackSpacing
      );
    }
    
    if (railInfo.hasSouth) {
      const startX = cx;
      const startY = cy;
      const endX = southEdgeX;
      const endY = southEdgeY;
      
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      
      drawRailTrack(
        ctx,
        startX + perpX * trackSpacing, startY + perpY * trackSpacing,
        endX + perpX * trackSpacing, endY + perpY * trackSpacing
      );
      drawRailTrack(
        ctx,
        startX - perpX * trackSpacing, startY - perpY * trackSpacing,
        endX - perpX * trackSpacing, endY - perpY * trackSpacing
      );
    }
    
    if (railInfo.hasWest) {
      const startX = cx;
      const startY = cy;
      const endX = westEdgeX;
      const endY = westEdgeY;
      
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy);
      const perpX = -dy / len;
      const perpY = dx / len;
      
      drawRailTrack(
        ctx,
        startX + perpX * trackSpacing, startY + perpY * trackSpacing,
        endX + perpX * trackSpacing, endY + perpY * trackSpacing
      );
      drawRailTrack(
        ctx,
        startX - perpX * trackSpacing, startY - perpY * trackSpacing,
        endX - perpX * trackSpacing, endY - perpY * trackSpacing
      );
    }
  }
}
