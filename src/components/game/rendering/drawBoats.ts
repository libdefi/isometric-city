import { Boat, WorldRenderState } from '@/components/game/types';

export function drawBoats(
  ctx: CanvasRenderingContext2D,
  boats: Boat[],
  worldState: WorldRenderState
) {
  const { offset: currentOffset, zoom: currentZoom } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (boats.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - 100;
  const viewTop = -currentOffset.y / currentZoom - 100;
  const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
  
  for (const boat of boats) {
    if (boat.x < viewLeft || boat.x > viewRight || boat.y < viewTop || boat.y > viewBottom) {
      continue;
    }
    
    // Draw wake particles
    for (const wake of boat.wake) {
      ctx.fillStyle = `rgba(255, 255, 255, ${wake.opacity * 0.4})`;
      ctx.beginPath();
      ctx.arc(wake.x, wake.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw boat
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    
    const boatLength = boat.sizeVariant === 1 ? 14 : 10;
    const boatWidth = boat.sizeVariant === 1 ? 6 : 4;
    
    // Boat hull
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(boatLength / 2, 0);
    ctx.lineTo(-boatLength / 2, boatWidth / 2);
    ctx.lineTo(-boatLength / 2, -boatWidth / 2);
    ctx.closePath();
    ctx.fill();
    
    // Boat cabin (lighter)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(-boatLength / 4, -boatWidth / 4, boatLength / 3, boatWidth / 2);
    
    ctx.restore();
  }
  
  ctx.restore();
}
