import { Firework, WorldRenderState } from '@/components/game/types';

export function drawFireworks(
  ctx: CanvasRenderingContext2D,
  fireworks: Firework[],
  worldState: WorldRenderState
) {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0 || fireworks.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - 100;
  const viewTop = -currentOffset.y / currentZoom - 200;
  const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;
  
  for (const firework of fireworks) {
    if (firework.x < viewLeft || firework.x > viewRight || firework.y < viewTop || firework.y > viewBottom) {
      continue;
    }
    
    if (firework.state === 'launching') {
      const gradient = ctx.createLinearGradient(
        firework.x, firework.y,
        firework.x - firework.vx * 0.1, firework.y - firework.vy * 0.1
      );
      gradient.addColorStop(0, firework.color);
      gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(firework.x, firework.y);
      ctx.lineTo(firework.x - firework.vx * 0.08, firework.y - firework.vy * 0.08);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = firework.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(firework.x, firework.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      
    } else if (firework.state === 'exploding' || firework.state === 'fading') {
      for (const particle of firework.particles) {
        const alpha = Math.max(0, 1 - particle.age / particle.maxAge);
        if (alpha <= 0) continue;
        
        if (particle.trail.length > 1) {
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = particle.size * 0.5;
          ctx.lineCap = 'round';
          ctx.globalAlpha = alpha * 0.3;
          
          ctx.beginPath();
          ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
          for (let i = 1; i < particle.trail.length; i++) {
            ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
          }
          ctx.lineTo(particle.x, particle.y);
          ctx.stroke();
        }
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  
  ctx.restore();
}
