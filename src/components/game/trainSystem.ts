/**
 * Train System - Manages trains on rail tracks
 */

import { Tile } from '@/types/game';
import { Train, CarDirection, TILE_WIDTH, TILE_HEIGHT } from './types';
import { TRAIN_COLORS, DIRECTION_META } from './constants';
import { gridToScreen } from './utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a tile is a rail
 */
export function isRailTile(grid: Tile[][], gridSize: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  return grid[y][x].building.type === 'rail';
}

/**
 * Get available movement directions from a rail tile
 */
export function getRailDirectionOptions(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection[] {
  const directions: CarDirection[] = [];
  
  if (isRailTile(grid, gridSize, x - 1, y)) directions.push('north');
  if (isRailTile(grid, gridSize, x, y - 1)) directions.push('east');
  if (isRailTile(grid, gridSize, x + 1, y)) directions.push('south');
  if (isRailTile(grid, gridSize, x, y + 1)) directions.push('west');
  
  return directions;
}

/**
 * Pick next direction for a train (avoid going backwards)
 */
export function pickNextTrainDirection(
  currentDirection: CarDirection,
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getRailDirectionOptions(grid, gridSize, x, y);
  
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];
  
  // Avoid turning around (going opposite direction)
  const opposites: Record<CarDirection, CarDirection> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };
  
  const opposite = opposites[currentDirection];
  const filteredOptions = options.filter(d => d !== opposite);
  
  if (filteredOptions.length > 0) {
    // Prefer continuing straight
    if (filteredOptions.includes(currentDirection)) {
      return currentDirection;
    }
    return filteredOptions[Math.floor(Math.random() * filteredOptions.length)];
  }
  
  // If we have to turn around, do it
  return options[0];
}

// ============================================================================
// Train Spawning
// ============================================================================

/**
 * Spawn a train at a random rail tile
 */
export function spawnRandomTrain(
  grid: Tile[][],
  gridSize: number,
  trains: Train[],
  trainIdCounter: number
): { train: Train | null; newId: number } {
  // Try to find a rail tile to spawn on
  for (let attempt = 0; attempt < 20; attempt++) {
    const tileX = Math.floor(Math.random() * gridSize);
    const tileY = Math.floor(Math.random() * gridSize);
    
    if (!isRailTile(grid, gridSize, tileX, tileY)) continue;
    
    const options = getRailDirectionOptions(grid, gridSize, tileX, tileY);
    if (options.length === 0) continue;
    
    const direction = options[Math.floor(Math.random() * options.length)];
    const trackOffset = 0; // Centered on track
    
    const train: Train = {
      id: trainIdCounter,
      tileX,
      tileY,
      direction,
      progress: Math.random() * 0.8,
      speed: 0.4 + Math.random() * 0.2, // Trains are slower but steady
      age: 0,
      maxAge: 2400 + Math.random() * 3600, // Trains live longer
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      trackOffset,
    };
    
    return { train, newId: trainIdCounter + 1 };
  }
  
  return { train: null, newId: trainIdCounter };
}

// ============================================================================
// Train Update Logic
// ============================================================================

/**
 * Update train positions and handle track navigation
 */
export function updateTrains(
  trains: Train[],
  grid: Tile[][],
  gridSize: number,
  delta: number,
  speedMultiplier: number
): Train[] {
  const updatedTrains: Train[] = [];
  
  for (const train of trains) {
    // Age train
    train.age += delta;
    if (train.age > train.maxAge) {
      continue; // Remove old train
    }
    
    // Check if still on rail
    if (!isRailTile(grid, gridSize, train.tileX, train.tileY)) {
      continue; // Remove train if not on rail
    }
    
    // Update progress
    train.progress += train.speed * delta * speedMultiplier;
    
    let alive = true;
    
    // Handle tile transitions
    let guard = 0;
    while (train.progress >= 1 && guard < 4) {
      guard++;
      const meta = DIRECTION_META[train.direction];
      train.tileX += meta.step.x;
      train.tileY += meta.step.y;
      
      // Check if new tile is valid rail
      if (!isRailTile(grid, gridSize, train.tileX, train.tileY)) {
        alive = false;
        break;
      }
      
      train.progress -= 1;
      
      // Pick next direction
      const nextDirection = pickNextTrainDirection(train.direction, grid, gridSize, train.tileX, train.tileY);
      if (!nextDirection) {
        alive = false;
        break;
      }
      train.direction = nextDirection;
    }
    
    if (alive) {
      updatedTrains.push(train);
    }
  }
  
  return updatedTrains;
}

// ============================================================================
// Train Drawing
// ============================================================================

/**
 * Draw a train on the canvas
 */
export function drawTrain(
  ctx: CanvasRenderingContext2D,
  train: Train,
  zoom: number
): void {
  const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
  const centerX = screenX + TILE_WIDTH / 2;
  const centerY = screenY + TILE_HEIGHT / 2;
  const meta = DIRECTION_META[train.direction];
  
  // Calculate train position
  const trainX = centerX + meta.vec.dx * train.progress + meta.normal.nx * train.trackOffset;
  const trainY = centerY + meta.vec.dy * train.progress + meta.normal.ny * train.trackOffset;
  
  ctx.save();
  ctx.translate(trainX, trainY);
  ctx.rotate(meta.angle);
  
  const scale = 0.7; // Train size
  const length = 18; // Train length
  
  // Draw train body
  ctx.fillStyle = train.color;
  ctx.beginPath();
  ctx.moveTo(-length * scale, -6 * scale);
  ctx.lineTo(length * scale, -6 * scale);
  ctx.lineTo((length + 2) * scale, 0);
  ctx.lineTo(length * scale, 6 * scale);
  ctx.lineTo(-length * scale, 6 * scale);
  ctx.closePath();
  ctx.fill();
  
  // Add border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Windows
  ctx.fillStyle = 'rgba(200, 220, 255, 0.8)';
  const windowWidth = 4 * scale;
  const windowHeight = 4 * scale;
  const windowSpacing = 6 * scale;
  
  // Draw 3 windows
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(
      i * windowSpacing - windowWidth / 2,
      -windowHeight / 2,
      windowWidth,
      windowHeight
    );
  }
  
  // Front of train (yellow/white stripe)
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(
    (length - 2) * scale,
    -4 * scale,
    3 * scale,
    8 * scale
  );
  
  // Wheels (simple black rectangles)
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-length * scale, 6 * scale, 3 * scale, 2 * scale);
  ctx.fillRect((length - 3) * scale, 6 * scale, 3 * scale, 2 * scale);
  ctx.fillRect(-length * scale, -8 * scale, 3 * scale, 2 * scale);
  ctx.fillRect((length - 3) * scale, -8 * scale, 3 * scale, 2 * scale);
  
  ctx.restore();
}

/**
 * Draw all trains in the viewport
 */
export function drawTrains(
  ctx: CanvasRenderingContext2D,
  trains: Train[],
  grid: Tile[][],
  gridSize: number,
  offset: { x: number; y: number },
  zoom: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  const dpr = window.devicePixelRatio || 1;
  
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  const viewWidth = canvasWidth / (dpr * zoom);
  const viewHeight = canvasHeight / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;
  
  // Check if train is behind a building (for occlusion)
  const isTrainBehindBuilding = (tileX: number, tileY: number): boolean => {
    const trainDepth = tileX + tileY;
    
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const checkX = tileX + dx;
        const checkY = tileY + dy;
        
        if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) {
          continue;
        }
        
        const tile = grid[checkY]?.[checkX];
        if (!tile) continue;
        
        const buildingType = tile.building.type;
        const skipTypes = ['rail', 'road', 'grass', 'empty', 'water', 'tree'];
        if (skipTypes.includes(buildingType)) {
          continue;
        }
        
        const buildingDepth = checkX + checkY;
        if (buildingDepth > trainDepth) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Draw each train
  for (const train of trains) {
    const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[train.direction];
    const trainX = centerX + meta.vec.dx * train.progress + meta.normal.nx * train.trackOffset;
    const trainY = centerY + meta.vec.dy * train.progress + meta.normal.ny * train.trackOffset;
    
    // Cull trains outside viewport
    if (trainX < viewLeft - 40 || trainX > viewRight + 40 || 
        trainY < viewTop - 60 || trainY > viewBottom + 60) {
      continue;
    }
    
    // Skip if behind building
    if (isTrainBehindBuilding(train.tileX, train.tileY)) {
      continue;
    }
    
    drawTrain(ctx, train, zoom);
  }
  
  ctx.restore();
}
