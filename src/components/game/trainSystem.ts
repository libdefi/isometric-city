/**
 * Train System - Multi-carriage train spawning, movement, and rendering
 * Supports both freight and passenger trains on the rail network
 */

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT } from './types';

// ============================================================================
// Types
// ============================================================================

export type TrainType = 'passenger' | 'freight';

export type TrainDirection = 'north' | 'east' | 'south' | 'west';

export interface TrainCarriage {
  /** Carriage type */
  type: 'locomotive' | 'passenger_car' | 'freight_car';
  /** Position along the path (0-1 range per segment) */
  pathPosition: number;
  /** Current path segment index */
  pathIndex: number;
  /** Grid position (may be fractional) */
  gridX: number;
  gridY: number;
  /** Current direction */
  direction: TrainDirection;
}

export interface Train {
  id: number;
  type: TrainType;
  /** All carriages in this train, locomotive is first */
  carriages: TrainCarriage[];
  /** The path this train is following (grid coordinates) */
  path: Array<{ x: number; y: number }>;
  /** Overall train speed */
  speed: number;
  /** Primary color for this train */
  color: string;
  /** Whether train is currently moving */
  isMoving: boolean;
  /** Waiting time at stations */
  waitTimer: number;
}

// ============================================================================
// Constants
// ============================================================================

export const TRAIN_COLORS = {
  passenger: [
    '#1e88e5', // Blue
    '#e53935', // Red  
    '#43a047', // Green
    '#8e24aa', // Purple
    '#fb8c00', // Orange
  ],
  freight: [
    '#5d4037', // Brown
    '#616161', // Gray
    '#ef6c00', // Dark orange
    '#1565c0', // Dark blue
    '#2e7d32', // Dark green
  ],
  locomotive: '#2c2c2c',
  locomotiveAccent: '#ffc107',
};

export const TRAIN_CONFIG = {
  /** Base speed (grid units per second) */
  BASE_SPEED: 0.8,
  /** Speed variation range */
  SPEED_VARIATION: 0.2,
  /** Distance between carriages (as fraction of grid cell) */
  CARRIAGE_SPACING: 0.4,
  /** Number of carriages for passenger trains (including locomotive) */
  PASSENGER_CARRIAGES: 4,
  /** Number of carriages for freight trains (including locomotive) */
  FREIGHT_CARRIAGES: 5,
  /** Maximum trains on the network */
  MAX_TRAINS: 8,
  /** Spawn interval (ms) */
  SPAWN_INTERVAL: 15000,
  /** Station wait time (ms) */
  STATION_WAIT_TIME: 3000,
  /** Minimum rail tiles needed to spawn trains */
  MIN_RAIL_TILES: 6,
};

export const TRAIN_VISUALS = {
  /** Locomotive length (as fraction of tile) */
  LOCOMOTIVE_LENGTH: 0.35,
  LOCOMOTIVE_WIDTH: 0.18,
  /** Car length */
  CAR_LENGTH: 0.28,
  CAR_WIDTH: 0.15,
};

// ============================================================================
// Rail Network Analysis
// ============================================================================

/**
 * Check if a tile can have trains (rail or rail_station)
 */
export function isRailOrStation(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  const type = grid[y][x].building.type;
  return type === 'rail' || type === 'rail_station';
}

/**
 * Get valid movement directions from a rail tile
 */
export function getRailDirections(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): TrainDirection[] {
  const directions: TrainDirection[] = [];
  
  // North: x-1
  if (isRailOrStation(grid, gridSize, x - 1, y)) directions.push('north');
  // East: y-1
  if (isRailOrStation(grid, gridSize, x, y - 1)) directions.push('east');
  // South: x+1
  if (isRailOrStation(grid, gridSize, x + 1, y)) directions.push('south');
  // West: y+1
  if (isRailOrStation(grid, gridSize, x, y + 1)) directions.push('west');
  
  return directions;
}

/**
 * Get the opposite direction
 */
export function getOppositeDirection(dir: TrainDirection): TrainDirection {
  switch (dir) {
    case 'north': return 'south';
    case 'south': return 'north';
    case 'east': return 'west';
    case 'west': return 'east';
  }
}

/**
 * Get next tile in a direction
 */
export function getNextTile(
  x: number,
  y: number,
  direction: TrainDirection
): { x: number; y: number } {
  switch (direction) {
    case 'north': return { x: x - 1, y };
    case 'south': return { x: x + 1, y };
    case 'east': return { x, y: y - 1 };
    case 'west': return { x, y: y + 1 };
  }
}

/**
 * Find all rail stations on the grid
 */
export function findRailStations(
  grid: Tile[][],
  gridSize: number
): Array<{ x: number; y: number }> {
  const stations: Array<{ x: number; y: number }> = [];
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail_station') {
        stations.push({ x, y });
      }
    }
  }
  
  return stations;
}

/**
 * Find a path between two points on the rail network using BFS
 */
export function findRailPath(
  grid: Tile[][],
  gridSize: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> | null {
  if (!isRailOrStation(grid, gridSize, startX, startY) ||
      !isRailOrStation(grid, gridSize, endX, endY)) {
    return null;
  }
  
  // BFS
  const queue: Array<{ x: number; y: number; path: Array<{ x: number; y: number }> }> = [
    { x: startX, y: startY, path: [{ x: startX, y: startY }] }
  ];
  const visited = new Set<string>();
  visited.add(`${startX},${startY}`);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.x === endX && current.y === endY) {
      return current.path;
    }
    
    const directions = getRailDirections(grid, gridSize, current.x, current.y);
    for (const dir of directions) {
      const next = getNextTile(current.x, current.y, dir);
      const key = `${next.x},${next.y}`;
      
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          x: next.x,
          y: next.y,
          path: [...current.path, { x: next.x, y: next.y }]
        });
      }
    }
  }
  
  return null;
}

/**
 * Count rail tiles on the grid
 */
export function countRailTiles(grid: Tile[][], gridSize: number): number {
  let count = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x].building.type === 'rail') {
        count++;
      }
    }
  }
  return count;
}

// ============================================================================
// Train Spawning
// ============================================================================

/**
 * Spawn a new train at a station or random rail tile
 */
export function spawnTrain(
  grid: Tile[][],
  gridSize: number,
  trainId: number,
  existingTrains: Train[]
): Train | null {
  // First try to spawn at a station
  const stations = findRailStations(grid, gridSize);
  
  // Find a starting position (prefer stations)
  let startX = -1;
  let startY = -1;
  
  if (stations.length > 0) {
    // Pick a random station that has adjacent rail
    const stationsWithRail = stations.filter(station => {
      return getRailDirections(grid, gridSize, station.x, station.y).length > 0;
    });
    
    if (stationsWithRail.length > 0) {
      const station = stationsWithRail[Math.floor(Math.random() * stationsWithRail.length)];
      startX = station.x;
      startY = station.y;
    }
  }
  
  // If no suitable station, find a random rail tile
  if (startX === -1) {
    const railTiles: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x].building.type === 'rail' &&
            getRailDirections(grid, gridSize, x, y).length >= 2) {
          railTiles.push({ x, y });
        }
      }
    }
    
    if (railTiles.length === 0) return null;
    
    const tile = railTiles[Math.floor(Math.random() * railTiles.length)];
    startX = tile.x;
    startY = tile.y;
  }
  
  // Check if there's already a train at this position
  for (const train of existingTrains) {
    if (train.carriages.length > 0) {
      const loco = train.carriages[0];
      if (Math.abs(loco.gridX - startX) < 1 && Math.abs(loco.gridY - startY) < 1) {
        return null; // Too close to another train
      }
    }
  }
  
  // Determine train type
  const type: TrainType = Math.random() > 0.5 ? 'passenger' : 'freight';
  
  // Select color
  const colors = type === 'passenger' ? TRAIN_COLORS.passenger : TRAIN_COLORS.freight;
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Get initial direction
  const directions = getRailDirections(grid, gridSize, startX, startY);
  if (directions.length === 0) return null;
  
  const initialDirection = directions[Math.floor(Math.random() * directions.length)];
  
  // Create initial path
  const path: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  
  // Extend path forward
  let currentX = startX;
  let currentY = startY;
  let currentDir = initialDirection;
  
  for (let i = 0; i < 10; i++) {
    const next = getNextTile(currentX, currentY, currentDir);
    if (!isRailOrStation(grid, gridSize, next.x, next.y)) break;
    
    path.push({ x: next.x, y: next.y });
    
    // Get next direction (prefer straight, avoid reverse)
    const nextDirs = getRailDirections(grid, gridSize, next.x, next.y)
      .filter(d => d !== getOppositeDirection(currentDir));
    
    if (nextDirs.length === 0) break;
    
    currentX = next.x;
    currentY = next.y;
    currentDir = nextDirs.includes(currentDir) ? currentDir : nextDirs[0];
  }
  
  // Create carriages
  const numCarriages = type === 'passenger' 
    ? TRAIN_CONFIG.PASSENGER_CARRIAGES 
    : TRAIN_CONFIG.FREIGHT_CARRIAGES;
  
  const carriages: TrainCarriage[] = [];
  
  for (let i = 0; i < numCarriages; i++) {
    let carriageType: TrainCarriage['type'];
    if (i === 0) {
      carriageType = 'locomotive';
    } else if (type === 'passenger') {
      carriageType = 'passenger_car';
    } else {
      carriageType = 'freight_car';
    }
    
    carriages.push({
      type: carriageType,
      pathPosition: 0,
      pathIndex: 0,
      gridX: startX,
      gridY: startY,
      direction: initialDirection,
    });
  }
  
  return {
    id: trainId,
    type,
    carriages,
    path,
    speed: TRAIN_CONFIG.BASE_SPEED + (Math.random() - 0.5) * TRAIN_CONFIG.SPEED_VARIATION,
    color,
    isMoving: true,
    waitTimer: 0,
  };
}

// ============================================================================
// Train Movement
// ============================================================================

/**
 * Update a train's position
 * Returns true if the train should continue to exist, false to remove it
 */
export function updateTrain(
  train: Train,
  delta: number,
  speedMultiplier: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  if (!train.isMoving) {
    // Handle station wait
    if (train.waitTimer > 0) {
      train.waitTimer -= delta * speedMultiplier;
      if (train.waitTimer <= 0) {
        train.isMoving = true;
        train.waitTimer = 0;
      }
    }
    return true;
  }
  
  // Move locomotive
  const loco = train.carriages[0];
  const movement = train.speed * speedMultiplier * delta / 1000;
  
  // Update path position
  loco.pathPosition += movement;
  
  // Check if we need to advance to next path segment
  while (loco.pathPosition >= 1 && loco.pathIndex < train.path.length - 1) {
    loco.pathPosition -= 1;
    loco.pathIndex++;
    
    // Check if we reached a station
    const currentPos = train.path[loco.pathIndex];
    if (grid[currentPos.y][currentPos.x].building.type === 'rail_station') {
      train.isMoving = false;
      train.waitTimer = TRAIN_CONFIG.STATION_WAIT_TIME;
    }
  }
  
  // If we've reached the end of the path, extend it or reverse
  if (loco.pathIndex >= train.path.length - 1 && loco.pathPosition >= 0.5) {
    // Try to extend path
    const lastPos = train.path[train.path.length - 1];
    const prevPos = train.path.length > 1 ? train.path[train.path.length - 2] : lastPos;
    
    // Calculate current direction
    const dx = lastPos.x - prevPos.x;
    const dy = lastPos.y - prevPos.y;
    let currentDir: TrainDirection = 'north';
    if (dx > 0) currentDir = 'south';
    else if (dx < 0) currentDir = 'north';
    else if (dy > 0) currentDir = 'west';
    else if (dy < 0) currentDir = 'east';
    
    // Get possible directions (excluding reverse)
    const directions = getRailDirections(grid, gridSize, lastPos.x, lastPos.y)
      .filter(d => d !== getOppositeDirection(currentDir));
    
    if (directions.length > 0) {
      // Extend path
      const nextDir = directions.includes(currentDir) ? currentDir : directions[0];
      const next = getNextTile(lastPos.x, lastPos.y, nextDir);
      train.path.push({ x: next.x, y: next.y });
    } else {
      // Reverse direction - reverse the entire path
      train.path.reverse();
      // Reset all carriages to start of new path
      for (let i = 0; i < train.carriages.length; i++) {
        const carriage = train.carriages[i];
        carriage.pathIndex = 0;
        carriage.pathPosition = i * TRAIN_CONFIG.CARRIAGE_SPACING;
      }
    }
  }
  
  // Update locomotive grid position
  if (loco.pathIndex < train.path.length - 1) {
    const currentPos = train.path[loco.pathIndex];
    const nextPos = train.path[loco.pathIndex + 1];
    const t = loco.pathPosition;
    
    loco.gridX = currentPos.x + (nextPos.x - currentPos.x) * t;
    loco.gridY = currentPos.y + (nextPos.y - currentPos.y) * t;
    
    // Update direction
    const dx = nextPos.x - currentPos.x;
    const dy = nextPos.y - currentPos.y;
    if (dx > 0) loco.direction = 'south';
    else if (dx < 0) loco.direction = 'north';
    else if (dy > 0) loco.direction = 'west';
    else if (dy < 0) loco.direction = 'east';
  } else {
    // At end of path
    const pos = train.path[train.path.length - 1];
    loco.gridX = pos.x;
    loco.gridY = pos.y;
  }
  
  // Update following carriages
  for (let i = 1; i < train.carriages.length; i++) {
    const carriage = train.carriages[i];
    const spacing = i * TRAIN_CONFIG.CARRIAGE_SPACING;
    
    // Calculate carriage position along path
    let totalProgress = loco.pathIndex + loco.pathPosition - spacing;
    
    if (totalProgress < 0) {
      // Carriage hasn't entered the path yet
      carriage.pathIndex = 0;
      carriage.pathPosition = 0;
      const pos = train.path[0];
      carriage.gridX = pos.x;
      carriage.gridY = pos.y;
    } else {
      carriage.pathIndex = Math.floor(totalProgress);
      carriage.pathPosition = totalProgress - carriage.pathIndex;
      
      // Clamp to valid path range
      if (carriage.pathIndex >= train.path.length - 1) {
        carriage.pathIndex = train.path.length - 1;
        carriage.pathPosition = 0;
      }
      
      // Calculate position
      if (carriage.pathIndex < train.path.length - 1) {
        const currentPos = train.path[carriage.pathIndex];
        const nextPos = train.path[carriage.pathIndex + 1];
        const t = carriage.pathPosition;
        
        carriage.gridX = currentPos.x + (nextPos.x - currentPos.x) * t;
        carriage.gridY = currentPos.y + (nextPos.y - currentPos.y) * t;
        
        // Update direction
        const dx = nextPos.x - currentPos.x;
        const dy = nextPos.y - currentPos.y;
        if (dx > 0) carriage.direction = 'south';
        else if (dx < 0) carriage.direction = 'north';
        else if (dy > 0) carriage.direction = 'west';
        else if (dy < 0) carriage.direction = 'east';
      } else {
        const pos = train.path[carriage.pathIndex];
        carriage.gridX = pos.x;
        carriage.gridY = pos.y;
      }
    }
  }
  
  return true;
}

// ============================================================================
// Train Rendering
// ============================================================================

/**
 * Convert grid position to screen position for train rendering
 */
export function trainGridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
  gridSize: number
): { screenX: number; screenY: number } {
  const tileW = TILE_WIDTH * zoom;
  const tileH = TILE_HEIGHT * zoom;
  
  const baseX = (gridSize * tileW) / 2;
  const screenX = baseX + (gridX - gridY) * (tileW / 2) + offsetX;
  const screenY = (gridX + gridY) * (tileH / 2) + offsetY;
  
  // Center in tile
  return {
    screenX: screenX + tileW / 2,
    screenY: screenY + tileH / 2,
  };
}

/**
 * Draw a locomotive
 */
function drawLocomotive(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: TrainDirection,
  zoom: number,
  _trainColor: string
): void {
  const length = TILE_WIDTH * TRAIN_VISUALS.LOCOMOTIVE_LENGTH * zoom;
  const width = TILE_WIDTH * TRAIN_VISUALS.LOCOMOTIVE_WIDTH * zoom;
  
  ctx.save();
  ctx.translate(x, y);
  
  // Rotate based on direction (isometric)
  let angle = 0;
  switch (direction) {
    case 'north': angle = Math.PI * 0.75; break;
    case 'east': angle = Math.PI * 0.25; break;
    case 'south': angle = Math.PI * -0.25; break;
    case 'west': angle = Math.PI * -0.75; break;
  }
  ctx.rotate(angle);
  
  // Draw locomotive body
  ctx.fillStyle = TRAIN_COLORS.locomotive;
  ctx.beginPath();
  ctx.roundRect(-length / 2, -width / 2, length, width, 2 * zoom);
  ctx.fill();
  
  // Draw cabin
  ctx.fillStyle = shadeColor(TRAIN_COLORS.locomotive, 20);
  ctx.fillRect(-length / 4, -width / 2, length / 3, width);
  
  // Draw front
  ctx.fillStyle = TRAIN_COLORS.locomotiveAccent;
  ctx.beginPath();
  ctx.roundRect(length / 2 - 4 * zoom, -width / 2 + 1, 3 * zoom, width - 2, 1 * zoom);
  ctx.fill();
  
  // Draw stripe
  ctx.fillStyle = TRAIN_COLORS.locomotiveAccent;
  ctx.fillRect(-length / 2 + 2, -1 * zoom, length - 8, 2 * zoom);
  
  ctx.restore();
}

/**
 * Draw a passenger car
 */
function drawPassengerCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: TrainDirection,
  zoom: number,
  color: string
): void {
  const length = TILE_WIDTH * TRAIN_VISUALS.CAR_LENGTH * zoom;
  const width = TILE_WIDTH * TRAIN_VISUALS.CAR_WIDTH * zoom;
  
  ctx.save();
  ctx.translate(x, y);
  
  let angle = 0;
  switch (direction) {
    case 'north': angle = Math.PI * 0.75; break;
    case 'east': angle = Math.PI * 0.25; break;
    case 'south': angle = Math.PI * -0.25; break;
    case 'west': angle = Math.PI * -0.75; break;
  }
  ctx.rotate(angle);
  
  // Draw car body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-length / 2, -width / 2, length, width, 2 * zoom);
  ctx.fill();
  
  // Draw windows
  ctx.fillStyle = '#1a237e';
  const windowSize = 2 * zoom;
  const windowSpacing = 5 * zoom;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(
      -length / 2 + 3 * zoom + i * windowSpacing,
      -width / 2 + 1,
      windowSize,
      width - 2
    );
  }
  
  // Draw stripe
  ctx.fillStyle = shadeColor(color, -30);
  ctx.fillRect(-length / 2, -1 * zoom, length, 2 * zoom);
  
  ctx.restore();
}

/**
 * Draw a freight car
 */
function drawFreightCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: TrainDirection,
  zoom: number,
  color: string
): void {
  const length = TILE_WIDTH * TRAIN_VISUALS.CAR_LENGTH * zoom;
  const width = TILE_WIDTH * TRAIN_VISUALS.CAR_WIDTH * zoom;
  
  ctx.save();
  ctx.translate(x, y);
  
  let angle = 0;
  switch (direction) {
    case 'north': angle = Math.PI * 0.75; break;
    case 'east': angle = Math.PI * 0.25; break;
    case 'south': angle = Math.PI * -0.25; break;
    case 'west': angle = Math.PI * -0.75; break;
  }
  ctx.rotate(angle);
  
  // Draw car body (box car style)
  ctx.fillStyle = color;
  ctx.fillRect(-length / 2, -width / 2, length, width);
  
  // Draw edges/panels
  ctx.strokeStyle = shadeColor(color, -40);
  ctx.lineWidth = 1;
  ctx.strokeRect(-length / 2, -width / 2, length, width);
  
  // Draw panel lines
  ctx.beginPath();
  ctx.moveTo(-length / 4, -width / 2);
  ctx.lineTo(-length / 4, width / 2);
  ctx.moveTo(length / 4, -width / 2);
  ctx.lineTo(length / 4, width / 2);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Shade a color by a percentage
 */
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

/**
 * Draw a single train
 */
export function drawTrain(
  ctx: CanvasRenderingContext2D,
  train: Train,
  offsetX: number,
  offsetY: number,
  zoom: number,
  gridSize: number
): void {
  // Draw carriages from back to front for proper layering
  for (let i = train.carriages.length - 1; i >= 0; i--) {
    const carriage = train.carriages[i];
    
    const { screenX, screenY } = trainGridToScreen(
      carriage.gridX,
      carriage.gridY,
      offsetX,
      offsetY,
      zoom,
      gridSize
    );
    
    switch (carriage.type) {
      case 'locomotive':
        drawLocomotive(ctx, screenX, screenY, carriage.direction, zoom, train.color);
        break;
      case 'passenger_car':
        drawPassengerCar(ctx, screenX, screenY, carriage.direction, zoom, train.color);
        break;
      case 'freight_car':
        drawFreightCar(ctx, screenX, screenY, carriage.direction, zoom, train.color);
        break;
    }
  }
}

/**
 * Draw all trains
 */
export function drawTrains(
  ctx: CanvasRenderingContext2D,
  trains: Train[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  gridSize: number
): void {
  // Sort trains by position for proper draw order
  const sortedTrains = [...trains].sort((a, b) => {
    const aPos = a.carriages[0];
    const bPos = b.carriages[0];
    return (aPos.gridX + aPos.gridY) - (bPos.gridX + bPos.gridY);
  });
  
  for (const train of sortedTrains) {
    drawTrain(ctx, train, offsetX, offsetY, zoom, gridSize);
  }
}
