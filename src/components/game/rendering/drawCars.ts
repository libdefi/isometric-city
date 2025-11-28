import { Car, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { DIRECTION_META } from '@/components/game/constants';
import { gridToScreen } from '@/components/game/utils';
import { isEntityBehindBuilding } from '@/components/game/renderHelpers';

export function drawCars(
  ctx: CanvasRenderingContext2D,
  cars: Car[],
  worldState: WorldRenderState
) {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Early exit if no grid data
  if (!currentGrid || currentGridSize <= 0 || cars.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  // Calculate viewport for culling
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
  const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;
  
  for (const car of cars) {
    const meta = DIRECTION_META[car.direction];
    const nextTileX = car.tileX + meta.step.x;
    const nextTileY = car.tileY + meta.step.y;
    
    const { screenX: currentScreenX, screenY: currentScreenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
    const { screenX: nextScreenX, screenY: nextScreenY } = gridToScreen(nextTileX, nextTileY, 0, 0);
    
    const carScreenX = currentScreenX + (nextScreenX - currentScreenX) * car.progress + TILE_WIDTH / 2;
    const carScreenY = currentScreenY + (nextScreenY - currentScreenY) * car.progress + TILE_HEIGHT / 2;
    
    // Viewport culling
    if (carScreenX < viewLeft || carScreenX > viewRight || carScreenY < viewTop || carScreenY > viewBottom) {
      continue;
    }
    
    // Check if car is behind a building
    const behindBuilding = isEntityBehindBuilding(car.tileX, car.tileY, car.progress, car.direction, currentGrid, currentGridSize);
    const opacity = behindBuilding ? 0.15 : 1;
    
    // Calculate lane offset (perpendicular to travel direction)
    // For north/south: offset left/right, for east/west: offset up/down
    let laneOffsetX = 0;
    let laneOffsetY = 0;
    if (car.direction === 'north' || car.direction === 'south') {
      laneOffsetX = car.laneOffset;
    } else {
      laneOffsetY = car.laneOffset;
    }
    
    const finalCarX = carScreenX + laneOffsetX;
    const finalCarY = carScreenY + laneOffsetY;
    
    const angle = meta.angle;
    
    // Draw car body (simple rectangle with rotation)
    ctx.save();
    ctx.translate(finalCarX, finalCarY);
    ctx.rotate(angle);
    ctx.globalAlpha = opacity;
    
    // Car body
    ctx.fillStyle = car.color;
    const carWidth = 8;
    const carHeight = 5;
    ctx.fillRect(-carWidth / 2, -carHeight / 2, carWidth, carHeight);
    
    // Car windows (darker)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-carWidth / 2 + 1, -carHeight / 2 + 1, carWidth - 2, carHeight - 2);
    
    // Front indicator (brighter spot)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(carWidth / 2 - 2, -carHeight / 2, 2, carHeight);
    
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  
  ctx.restore();
}
