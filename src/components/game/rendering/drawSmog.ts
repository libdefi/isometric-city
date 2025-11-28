import { FactorySmog, WorldRenderState } from '@/components/game/types';
import { SMOG_MAX_ZOOM, SMOG_FADE_ZOOM } from '@/components/game/constants';

export function drawSmog(
  ctx: CanvasRenderingContext2D,
  factorySmog: FactorySmog[],
  worldState: WorldRenderState
) {
  const { offset: currentOffset, zoom: currentZoom } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  // Don't render smog if zoomed in too far
  if (currentZoom > SMOG_MAX_ZOOM || factorySmog.length === 0) {
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
  
  // Calculate fade factor for zoom levels between SMOG_FADE_ZOOM and SMOG_MAX_ZOOM
  const zoomFadeFactor = currentZoom > SMOG_FADE_ZOOM
    ? 1 - (currentZoom - SMOG_FADE_ZOOM) / (SMOG_MAX_ZOOM - SMOG_FADE_ZOOM)
    : 1;
  
  for (const factory of factorySmog) {
    // Cull factories outside viewport
    if (factory.centerX < viewLeft - 100 || factory.centerX > viewRight + 100 ||
        factory.centerY < viewTop - 100 || factory.centerY > viewBottom + 100) {
      continue;
    }
    
    for (const particle of factory.particles) {
      // Cull particles outside viewport
      if (particle.x < viewLeft || particle.x > viewRight ||
          particle.y < viewTop || particle.y > viewBottom) {
        continue;
      }
      
      const finalOpacity = particle.opacity * zoomFadeFactor;
      ctx.fillStyle = `rgba(80, 80, 80, ${finalOpacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}
