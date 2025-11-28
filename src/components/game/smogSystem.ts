// Smog System - Factory smoke particles
// Handles spawning, updating, and drawing of industrial smog

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  FactorySmog,
  WorldRenderState,
} from './types';
import {
  SMOG_PARTICLE_MAX_AGE,
  SMOG_PARTICLE_MAX_AGE_MOBILE,
  SMOG_SPAWN_INTERVAL_MEDIUM,
  SMOG_SPAWN_INTERVAL_LARGE,
  SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER,
  SMOG_DRIFT_SPEED,
  SMOG_RISE_SPEED,
  SMOG_MAX_ZOOM,
  SMOG_FADE_ZOOM,
  SMOG_BASE_OPACITY,
  SMOG_PARTICLE_SIZE_MIN,
  SMOG_PARTICLE_SIZE_MAX,
  SMOG_PARTICLE_GROWTH,
  SMOG_MAX_PARTICLES_PER_FACTORY,
  SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE,
} from './constants';
import { gridToScreen } from './utils';
import { findSmogFactories } from './gridFinders';

// ============================================================================
// Smog Updates
// ============================================================================

/**
 * Update smog particles - spawn new particles and update existing ones
 */
export function updateSmog(
  delta: number,
  worldState: WorldRenderState,
  factorySmogRef: React.MutableRefObject<FactorySmog[]>,
  smogLastGridVersionRef: React.MutableRefObject<number>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldState;
  
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }
  
  // Skip smog updates entirely when zoomed in enough that it won't be visible
  if (currentZoom > SMOG_FADE_ZOOM) {
    return;
  }
  
  const speedMultiplier = [0, 1, 2, 4][currentSpeed] || 1;
  const adjustedDelta = delta * speedMultiplier;
  
  // Mobile performance optimizations
  const maxParticles = isMobile ? SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE : SMOG_MAX_PARTICLES_PER_FACTORY;
  const particleMaxAge = isMobile ? SMOG_PARTICLE_MAX_AGE_MOBILE : SMOG_PARTICLE_MAX_AGE;
  const spawnMultiplier = isMobile ? SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER : 1;
  
  // Rebuild factory list if grid has changed
  const currentGridVersion = gridVersionRef.current;
  if (smogLastGridVersionRef.current !== currentGridVersion) {
    smogLastGridVersionRef.current = currentGridVersion;
    
    const factories = findSmogFactories(currentGrid, currentGridSize);
    
    // Create new smog entries for factories, preserving existing particles where possible
    const existingSmogMap = new Map<string, FactorySmog>();
    for (const smog of factorySmogRef.current) {
      existingSmogMap.set(`${smog.tileX},${smog.tileY}`, smog);
    }
    
    factorySmogRef.current = factories.map(factory => {
      const key = `${factory.x},${factory.y}`;
      const existing = existingSmogMap.get(key);
      
      const { screenX, screenY } = gridToScreen(factory.x, factory.y, 0, 0);
      const chimneyOffsetX = factory.type === 'factory_large' ? TILE_WIDTH * 1.2 : TILE_WIDTH * 0.6;
      const chimneyOffsetY = factory.type === 'factory_large' ? -TILE_HEIGHT * 1.2 : -TILE_HEIGHT * 0.7;
      
      if (existing && existing.buildingType === factory.type) {
        existing.screenX = screenX + chimneyOffsetX;
        existing.screenY = screenY + chimneyOffsetY;
        return existing;
      }
      
      return {
        tileX: factory.x,
        tileY: factory.y,
        screenX: screenX + chimneyOffsetX,
        screenY: screenY + chimneyOffsetY,
        buildingType: factory.type,
        particles: [],
        spawnTimer: Math.random(),
      };
    });
  }
  
  // Update each factory's smog
  for (const smog of factorySmogRef.current) {
    const baseSpawnInterval = smog.buildingType === 'factory_large' 
      ? SMOG_SPAWN_INTERVAL_LARGE 
      : SMOG_SPAWN_INTERVAL_MEDIUM;
    const spawnInterval = baseSpawnInterval * spawnMultiplier;
    
    smog.spawnTimer += adjustedDelta;
    
    // Spawn new particles
    while (smog.spawnTimer >= spawnInterval && smog.particles.length < maxParticles) {
      smog.spawnTimer -= spawnInterval;
      
      const spawnX = smog.screenX + (Math.random() - 0.5) * 8;
      const spawnY = smog.screenY + (Math.random() - 0.5) * 4;
      
      const vx = (Math.random() - 0.5) * SMOG_DRIFT_SPEED * 2;
      const vy = -SMOG_RISE_SPEED * (0.8 + Math.random() * 0.4);
      
      const size = SMOG_PARTICLE_SIZE_MIN + Math.random() * (SMOG_PARTICLE_SIZE_MAX - SMOG_PARTICLE_SIZE_MIN);
      const maxAge = particleMaxAge * (0.7 + Math.random() * 0.6);
      
      smog.particles.push({
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        age: 0,
        maxAge,
        size,
        opacity: SMOG_BASE_OPACITY * (0.8 + Math.random() * 0.4),
      });
    }
    
    // Reset spawn timer if we hit the particle limit
    if (smog.particles.length >= maxParticles) {
      smog.spawnTimer = 0;
    }
    
    // Update existing particles
    smog.particles = smog.particles.filter(particle => {
      particle.age += adjustedDelta;
      
      if (particle.age >= particle.maxAge) {
        return false;
      }
      
      particle.x += particle.vx * adjustedDelta;
      particle.y += particle.vy * adjustedDelta;
      
      particle.vx *= 0.995;
      particle.vy *= 0.998;
      
      particle.size += SMOG_PARTICLE_GROWTH * adjustedDelta;
      
      return true;
    });
  }
}

// ============================================================================
// Smog Drawing
// ============================================================================

/**
 * Draw smog particles
 */
export function drawSmog(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  factorySmogRef: React.MutableRefObject<FactorySmog[]>
): void {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0 || factorySmogRef.current.length === 0) {
    return;
  }
  
  // Calculate zoom-based opacity modifier
  let zoomOpacity = 1;
  if (currentZoom > SMOG_FADE_ZOOM) {
    return;
  } else if (currentZoom > SMOG_MAX_ZOOM) {
    zoomOpacity = 1 - (currentZoom - SMOG_MAX_ZOOM) / (SMOG_FADE_ZOOM - SMOG_MAX_ZOOM);
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
  
  for (const smog of factorySmogRef.current) {
    for (const particle of smog.particles) {
      if (particle.x < viewLeft || particle.x > viewRight || 
          particle.y < viewTop || particle.y > viewBottom) {
        continue;
      }
      
      const ageRatio = particle.age / particle.maxAge;
      let ageOpacity: number;
      if (ageRatio < 0.1) {
        ageOpacity = ageRatio / 0.1;
      } else {
        ageOpacity = 1 - ((ageRatio - 0.1) / 0.9);
      }
      
      const finalOpacity = particle.opacity * ageOpacity * zoomOpacity;
      if (finalOpacity <= 0.01) continue;
      
      ctx.fillStyle = `rgba(100, 100, 110, ${finalOpacity})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      const innerSize = particle.size * 0.6;
      ctx.fillStyle = `rgba(140, 140, 150, ${finalOpacity * 0.5})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y - particle.size * 0.1, innerSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}
