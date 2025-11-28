// Lighting System - Day/Night cycle lighting rendering
// Handles darkness overlay and light sources

import { Tile } from '@/types/game';
import { TILE_WIDTH, TILE_HEIGHT, WorldRenderState } from './types';
import { gridToScreen } from './utils';

// ============================================================================
// Lighting Calculation Helpers
// ============================================================================

/**
 * Calculate darkness level based on hour (0-23)
 * Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
 */
export function getDarkness(hour: number): number {
  if (hour >= 7 && hour < 18) return 0; // Full daylight
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2; // Dawn transition
  if (hour >= 18 && hour < 20) return (hour - 18) / 2; // Dusk transition
  return 1; // Night
}

/**
 * Get ambient color based on time of day
 */
export function getAmbientColor(hour: number): { r: number; g: number; b: number } {
  if (hour >= 7 && hour < 18) return { r: 255, g: 255, b: 255 };
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return { r: Math.round(60 + 40 * t), g: Math.round(40 + 30 * t), b: Math.round(70 + 20 * t) };
  }
  if (hour >= 18 && hour < 20) {
    const t = (hour - 18) / 2;
    return { r: Math.round(100 - 40 * t), g: Math.round(70 - 30 * t), b: Math.round(90 - 20 * t) };
  }
  return { r: 20, g: 30, b: 60 };
}

// Sets for building type categorization
const NON_LIT_TYPES = new Set(['grass', 'empty', 'water', 'road', 'tree', 'park', 'park_large', 'tennis']);
const RESIDENTIAL_TYPES = new Set(['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high']);
const COMMERCIAL_TYPES = new Set(['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall']);

/**
 * Pseudo-random function for deterministic lighting variation
 */
function pseudoRandom(seed: number, n: number): number {
  const s = Math.sin(seed + n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// ============================================================================
// Lighting Rendering
// ============================================================================

/**
 * Render day/night cycle lighting
 * Optimized for performance with early exits and grid-based culling
 */
export function renderLighting(
  ctx: CanvasRenderingContext2D,
  grid: Tile[][],
  gridSize: number,
  hour: number,
  offset: { x: number; y: number },
  zoom: number,
  canvasWidth: number,
  canvasHeight: number,
  isMobile: boolean
): void {
  const dpr = window.devicePixelRatio || 1;
  const darkness = getDarkness(hour);
  
  // Clear canvas first
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // If it's full daylight, just clear and return (early exit)
  if (darkness <= 0.01) return;
  
  // On mobile, use simplified lighting (just the overlay, skip individual lights)
  if (isMobile && darkness > 0) {
    const ambient = getAmbientColor(hour);
    const alpha = darkness * 0.45;
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    return;
  }
  
  const ambient = getAmbientColor(hour);
  
  // Apply darkness overlay
  const alpha = darkness * 0.55;
  ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${alpha})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Calculate viewport bounds once
  const viewWidth = canvasWidth / (dpr * zoom);
  const viewHeight = canvasHeight / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;
  
  // Calculate grid bounds to only iterate visible tiles
  const minGridY = Math.max(0, Math.floor((viewTop / TILE_HEIGHT) - gridSize / 2));
  const maxGridY = Math.min(gridSize - 1, Math.ceil((viewBottom / TILE_HEIGHT) + gridSize / 2));
  const minGridX = Math.max(0, Math.floor((viewLeft / TILE_WIDTH) + gridSize / 2));
  const maxGridX = Math.min(gridSize - 1, Math.ceil((viewRight / TILE_WIDTH) + gridSize / 2));
  
  const lightIntensity = Math.min(1, darkness * 1.2);
  
  // Collect light sources in a single pass through visible tiles
  const lightCutouts: Array<{x: number, y: number, type: 'road' | 'building', buildingType?: string, seed?: number}> = [];
  const coloredGlows: Array<{x: number, y: number, type: string}> = [];
  
  for (let y = minGridY; y <= maxGridY; y++) {
    for (let x = minGridX; x <= maxGridX; x++) {
      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      
      // Viewport culling
      if (screenX + TILE_WIDTH < viewLeft || screenX > viewRight ||
          screenY + TILE_HEIGHT * 3 < viewTop || screenY > viewBottom) {
        continue;
      }
      
      const tile = grid[y][x];
      const buildingType = tile.building.type;
      
      if (buildingType === 'road') {
        lightCutouts.push({ x, y, type: 'road' });
        coloredGlows.push({ x, y, type: 'road' });
      } else if (!NON_LIT_TYPES.has(buildingType) && tile.building.powered) {
        lightCutouts.push({ x, y, type: 'building', buildingType, seed: x * 1000 + y });
        
        if (buildingType === 'hospital' || buildingType === 'fire_station' || 
            buildingType === 'police_station' || buildingType === 'power_plant') {
          coloredGlows.push({ x, y, type: buildingType });
        }
      }
    }
  }
  
  // Draw light cutouts (destination-out)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  for (const light of lightCutouts) {
    const { screenX, screenY } = gridToScreen(light.x, light.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (light.type === 'road') {
      const lightRadius = 28;
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, lightRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * lightIntensity})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.35 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (light.type === 'building' && light.buildingType && light.seed !== undefined) {
      const buildingType = light.buildingType;
      const isResidential = RESIDENTIAL_TYPES.has(buildingType);
      const isCommercial = COMMERCIAL_TYPES.has(buildingType);
      const glowStrength = isCommercial ? 0.85 : isResidential ? 0.6 : 0.7;
      
      let numWindows = 2;
      if (buildingType.includes('medium') || buildingType.includes('low')) numWindows = 3;
      if (buildingType.includes('high') || buildingType === 'mall') numWindows = 5;
      if (buildingType === 'mansion' || buildingType === 'office_high') numWindows = 4;
      
      const windowSize = 5;
      const buildingHeight = -18;
      
      for (let i = 0; i < numWindows; i++) {
        const isLit = pseudoRandom(light.seed, i) < (isResidential ? 0.55 : 0.75);
        if (!isLit) continue;
        
        const wx = tileCenterX + (pseudoRandom(light.seed, i + 10) - 0.5) * 22;
        const wy = tileCenterY + buildingHeight + (pseudoRandom(light.seed, i + 20) - 0.5) * 16;
        
        const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, windowSize * 2.5);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${glowStrength * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowStrength * 0.4 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(wx, wy, windowSize * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Ground glow
      const groundGlow = ctx.createRadialGradient(
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, 0,
        tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6
      );
      groundGlow.addColorStop(0, `rgba(255, 255, 255, ${0.25 * lightIntensity})`);
      groundGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = groundGlow;
      ctx.beginPath();
      ctx.ellipse(tileCenterX, tileCenterY + TILE_HEIGHT / 4, TILE_WIDTH * 0.6, TILE_HEIGHT / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
  
  // Draw colored glows (source-over)
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);
  
  for (const glow of coloredGlows) {
    const { screenX, screenY } = gridToScreen(glow.x, glow.y, 0, 0);
    const tileCenterX = screenX + TILE_WIDTH / 2;
    const tileCenterY = screenY + TILE_HEIGHT / 2;
    
    if (glow.type === 'road') {
      const gradient = ctx.createRadialGradient(tileCenterX, tileCenterY, 0, tileCenterX, tileCenterY, 20);
      gradient.addColorStop(0, `rgba(255, 210, 130, ${0.25 * lightIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 190, 100, ${0.1 * lightIntensity})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(tileCenterX, tileCenterY, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      let glowColor: { r: number; g: number; b: number } | null = null;
      let glowRadius = 20;
      
      if (glow.type === 'hospital') {
        glowColor = { r: 255, g: 80, b: 80 };
        glowRadius = 25;
      } else if (glow.type === 'fire_station') {
        glowColor = { r: 255, g: 100, b: 50 };
        glowRadius = 22;
      } else if (glow.type === 'police_station') {
        glowColor = { r: 60, g: 140, b: 255 };
        glowRadius = 22;
      } else if (glow.type === 'power_plant') {
        glowColor = { r: 255, g: 200, b: 50 };
        glowRadius = 30;
      }
      
      if (glowColor) {
        const gradient = ctx.createRadialGradient(
          tileCenterX, tileCenterY - 15, 0,
          tileCenterX, tileCenterY - 15, glowRadius
        );
        gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.5 * lightIntensity})`);
        gradient.addColorStop(0.5, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${0.2 * lightIntensity})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(tileCenterX, tileCenterY - 15, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
