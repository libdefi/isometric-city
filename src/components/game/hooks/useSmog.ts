import { useRef, useCallback } from 'react';
import { FactorySmog, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import {
  SMOG_PARTICLE_MAX_AGE,
  SMOG_PARTICLE_MAX_AGE_MOBILE,
  SMOG_SPAWN_INTERVAL_MEDIUM,
  SMOG_SPAWN_INTERVAL_LARGE,
  SMOG_SPAWN_INTERVAL_MOBILE_MULTIPLIER,
  SMOG_DRIFT_SPEED,
  SMOG_RISE_SPEED,
  SMOG_FADE_ZOOM,
  SMOG_BASE_OPACITY,
  SMOG_PARTICLE_SIZE_MIN,
  SMOG_PARTICLE_SIZE_MAX,
  SMOG_PARTICLE_GROWTH,
  SMOG_MAX_PARTICLES_PER_FACTORY,
  SMOG_MAX_PARTICLES_PER_FACTORY_MOBILE,
} from '@/components/game/constants';
import { gridToScreen } from '@/components/game/utils';
import { findSmogFactories } from '@/components/game/gridFinders';

export function useSmog(
  worldStateRef: React.MutableRefObject<WorldRenderState>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean = false
) {
  const factorySmogRef = useRef<FactorySmog[]>([]);
  const smogLastGridVersionRef = useRef(-1);

  const findSmogFactoriesCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findSmogFactories(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const updateSmog = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
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
      
      const factories = findSmogFactoriesCallback();
      
      // Create new smog entries for factories, preserving existing particles where possible
      const existingSmogMap = new Map<string, FactorySmog>();
      for (const smog of factorySmogRef.current) {
        existingSmogMap.set(`${smog.tileX},${smog.tileY}`, smog);
      }
      
      factorySmogRef.current = factories.map(factory => {
        const key = `${factory.x},${factory.y}`;
        const existing = existingSmogMap.get(key);
        
        // Convert factory tile to screen position
        const { screenX, screenY } = gridToScreen(factory.x, factory.y, 0, 0);
        const factoryCenterX = screenX + TILE_WIDTH / 2;
        const factoryCenterY = screenY + TILE_HEIGHT / 2;
        
        return {
          tileX: factory.x,
          tileY: factory.y,
          centerX: factoryCenterX,
          centerY: factoryCenterY,
          size: factory.size,
          particles: existing?.particles || [],
          spawnTimer: existing?.spawnTimer || 0,
        };
      });
    }
    
    // Update each factory's smog particles
    for (const factory of factorySmogRef.current) {
      // Update spawn timer
      factory.spawnTimer -= adjustedDelta;
      
      // Spawn new particles based on factory size
      const spawnInterval = factory.size === 'large' 
        ? SMOG_SPAWN_INTERVAL_LARGE * spawnMultiplier
        : SMOG_SPAWN_INTERVAL_MEDIUM * spawnMultiplier;
      
      while (factory.spawnTimer <= 0 && factory.particles.length < maxParticles) {
        factory.spawnTimer += spawnInterval;
        
        // Spawn particle at factory location with some randomness
        const offsetX = (Math.random() - 0.5) * TILE_WIDTH * 0.5;
        const offsetY = (Math.random() - 0.5) * TILE_HEIGHT * 0.5;
        
        factory.particles.push({
          x: factory.centerX + offsetX,
          y: factory.centerY + offsetY,
          vx: (Math.random() - 0.5) * SMOG_DRIFT_SPEED,
          vy: -SMOG_RISE_SPEED * (0.5 + Math.random() * 0.5),
          age: 0,
          size: SMOG_PARTICLE_SIZE_MIN + Math.random() * (SMOG_PARTICLE_SIZE_MAX - SMOG_PARTICLE_SIZE_MIN),
          opacity: SMOG_BASE_OPACITY * (0.7 + Math.random() * 0.3),
        });
      }
      
      // Update existing particles
      const updatedParticles = [];
      for (const particle of factory.particles) {
        particle.age += adjustedDelta;
        
        // Remove old particles
        if (particle.age > particleMaxAge) {
          continue;
        }
        
        // Update position
        particle.x += particle.vx * adjustedDelta;
        particle.y += particle.vy * adjustedDelta;
        
        // Grow particle size over time
        particle.size += SMOG_PARTICLE_GROWTH * adjustedDelta;
        
        // Fade out near end of life
        const fadePoint = particleMaxAge * 0.7;
        if (particle.age > fadePoint) {
          const fadeFactor = 1 - (particle.age - fadePoint) / (particleMaxAge - fadePoint);
          particle.opacity = SMOG_BASE_OPACITY * fadeFactor;
        }
        
        // Apply wind drift (slight horizontal motion)
        particle.vx += (Math.random() - 0.5) * 2 * adjustedDelta;
        particle.vx = Math.max(-SMOG_DRIFT_SPEED * 2, Math.min(SMOG_DRIFT_SPEED * 2, particle.vx));
        
        updatedParticles.push(particle);
      }
      
      factory.particles = updatedParticles;
    }
  }, [worldStateRef, gridVersionRef, findSmogFactoriesCallback, isMobile]);

  return {
    factorySmog: factorySmogRef.current,
    factorySmogRef,
    updateSmog,
  };
}
