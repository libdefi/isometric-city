import { WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { gridToScreen } from '@/components/game/utils';

export function drawIncidentIndicators(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  activeCrimeIncidents: Map<string, { x: number; y: number; type: 'robbery' | 'burglary' | 'disturbance' | 'traffic'; timeRemaining: number }>,
  incidentAnimTime: number,
  delta: number
) {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0) {
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
  
  // Draw fire incidents
  for (let y = 0; y < currentGridSize; y++) {
    for (let x = 0; x < currentGridSize; x++) {
      const tile = currentGrid[y][x];
      if (!tile.building.onFire) continue;
      
      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      const indicatorX = screenX + TILE_WIDTH / 2;
      const indicatorY = screenY + TILE_HEIGHT / 2 - 20;
      
      if (indicatorX < viewLeft || indicatorX > viewRight ||
          indicatorY < viewTop || indicatorY > viewBottom) {
        continue;
      }
      
      // Pulsing fire icon
      const pulse = 1 + Math.sin(incidentAnimTime * 4) * 0.2;
      const iconSize = 12 * pulse;
      
      // Fire icon background
      ctx.fillStyle = 'rgba(220, 38, 38, 0.9)';
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, iconSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Fire icon (triangle flame)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(indicatorX, indicatorY - iconSize / 2);
      ctx.lineTo(indicatorX - iconSize / 3, indicatorY + iconSize / 2);
      ctx.lineTo(indicatorX + iconSize / 3, indicatorY + iconSize / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  // Draw crime incidents
  activeCrimeIncidents.forEach((crime, key) => {
    const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
    const indicatorX = screenX + TILE_WIDTH / 2;
    const indicatorY = screenY + TILE_HEIGHT / 2 - 20;
    
    if (indicatorX < viewLeft || indicatorX > viewRight ||
        indicatorY < viewTop || indicatorY > viewBottom) {
      return;
    }
    
    // Pulsing crime icon
    const pulse = 1 + Math.sin(incidentAnimTime * 4 + 0.5) * 0.2;
    const iconSize = 12 * pulse;
    
    // Crime icon background
    ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, iconSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Crime icon (exclamation mark)
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${iconSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', indicatorX, indicatorY);
  });
  
  ctx.restore();
}
