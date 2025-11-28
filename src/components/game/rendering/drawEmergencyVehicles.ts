import { EmergencyVehicle, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { DIRECTION_META } from '@/components/game/constants';
import { gridToScreen } from '@/components/game/utils';
import { isEntityBehindBuilding } from '@/components/game/renderHelpers';

export function drawEmergencyVehicles(
  ctx: CanvasRenderingContext2D,
  vehicles: EmergencyVehicle[],
  worldState: WorldRenderState
) {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0 || vehicles.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
  const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;
  
  for (const vehicle of vehicles) {
    if (vehicle.state === 'responding') {
      // Draw vehicle at target location when responding
      const { screenX, screenY } = gridToScreen(vehicle.targetX, vehicle.targetY, 0, 0);
      const vehicleX = screenX + TILE_WIDTH / 2;
      const vehicleY = screenY + TILE_HEIGHT / 2;
      
      if (vehicleX < viewLeft || vehicleX > viewRight || vehicleY < viewTop || vehicleY > viewBottom) {
        continue;
      }
      
      const behindBuilding = isEntityBehindBuilding(vehicle.targetX, vehicle.targetY, 0, vehicle.direction, currentGrid, currentGridSize);
      const opacity = behindBuilding ? 0.15 : 1;
      
      ctx.save();
      ctx.translate(vehicleX, vehicleY);
      ctx.globalAlpha = opacity;
      
      const color = vehicle.type === 'fire_truck' ? '#dc2626' : '#3b82f6';
      ctx.fillStyle = color;
      const vehicleWidth = 10;
      const vehicleHeight = 6;
      ctx.fillRect(-vehicleWidth / 2, -vehicleHeight / 2, vehicleWidth, vehicleHeight);
      
      // Flashing light
      const flash = Math.sin(vehicle.flashTimer * 10) > 0;
      if (flash) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -vehicleHeight / 2 - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
      ctx.restore();
      continue;
    }
    
    // Draw vehicle moving along path
    const meta = DIRECTION_META[vehicle.direction];
    const nextTileX = vehicle.tileX + meta.step.x;
    const nextTileY = vehicle.tileY + meta.step.y;
    
    const { screenX: currentScreenX, screenY: currentScreenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
    const { screenX: nextScreenX, screenY: nextScreenY } = gridToScreen(nextTileX, nextTileY, 0, 0);
    
    const vehicleScreenX = currentScreenX + (nextScreenX - currentScreenX) * vehicle.progress + TILE_WIDTH / 2;
    const vehicleScreenY = currentScreenY + (nextScreenY - currentScreenY) * vehicle.progress + TILE_HEIGHT / 2;
    
    if (vehicleScreenX < viewLeft || vehicleScreenX > viewRight || vehicleScreenY < viewTop || vehicleScreenY > viewBottom) {
      continue;
    }
    
    const behindBuilding = isEntityBehindBuilding(vehicle.tileX, vehicle.tileY, vehicle.progress, vehicle.direction, currentGrid, currentGridSize);
    const opacity = behindBuilding ? 0.15 : 1;
    
    const angle = meta.angle;
    
    ctx.save();
    ctx.translate(vehicleScreenX, vehicleScreenY);
    ctx.rotate(angle);
    ctx.globalAlpha = opacity;
    
    // Vehicle body
    const color = vehicle.type === 'fire_truck' ? '#dc2626' : '#3b82f6';
    ctx.fillStyle = color;
    const vehicleWidth = 10;
    const vehicleHeight = 6;
    ctx.fillRect(-vehicleWidth / 2, -vehicleHeight / 2, vehicleWidth, vehicleHeight);
    
    // Windows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-vehicleWidth / 2 + 1, -vehicleHeight / 2 + 1, vehicleWidth - 2, vehicleHeight - 2);
    
    // Flashing light
    const flash = Math.sin(vehicle.flashTimer * 10) > 0;
    if (flash) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -vehicleHeight / 2 - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  
  ctx.restore();
}
