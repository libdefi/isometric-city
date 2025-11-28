// Crime System - Crime incident spawning and management
// Handles spawning, updating, and tracking of crime incidents

import { WorldRenderState } from './types';

// Crime incident type
export type CrimeType = 'robbery' | 'burglary' | 'disturbance' | 'traffic';

export type CrimeIncident = {
  x: number;
  y: number;
  type: CrimeType;
  timeRemaining: number;
};

// ============================================================================
// Crime Spawning
// ============================================================================

/**
 * Spawn new crime incidents periodically (persistent like fires)
 */
export function spawnCrimeIncidents(
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>,
  crimeSpawnTimerRef: React.MutableRefObject<number>,
  policeServices: number[][],
  population: number
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
  
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
  crimeSpawnTimerRef.current -= delta * speedMultiplier;
  
  // Spawn new crimes every 3-5 seconds (game time adjusted)
  if (crimeSpawnTimerRef.current > 0) return;
  crimeSpawnTimerRef.current = 3 + Math.random() * 2;
  
  // Collect eligible tiles for crime (buildings with activity)
  const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];
  
  for (let y = 0; y < currentGridSize; y++) {
    for (let x = 0; x < currentGridSize; x++) {
      const tile = currentGrid[y][x];
      // Only consider populated buildings (residential/commercial/industrial)
      const isBuilding = tile.building.type !== 'grass' && 
          tile.building.type !== 'water' && 
          tile.building.type !== 'road' && 
          tile.building.type !== 'tree' &&
          tile.building.type !== 'empty';
      const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;
      
      if (isBuilding && hasActivity) {
        const policeCoverage = policeServices[y]?.[x] || 0;
        eligibleTiles.push({ x, y, policeCoverage });
      }
    }
  }
  
  if (eligibleTiles.length === 0) return;
  
  // Determine how many new crimes to spawn (based on city size and coverage)
  const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.policeCoverage, 0) / eligibleTiles.length;
  const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;
  
  // Max active crimes based on population (more people = more potential crime)
  const maxActiveCrimes = Math.max(2, Math.floor(population / 500));
  
  if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;
  
  // Try to spawn 1-2 crimes
  const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;
  
  for (let i = 0; i < crimesToSpawn; i++) {
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
    if (Math.random() > baseChance) continue;
    
    // Weight selection toward low-coverage areas
    const weightedTiles = eligibleTiles.filter(t => {
      const key = `${t.x},${t.y}`;
      if (activeCrimeIncidentsRef.current.has(key)) return false;
      // Higher weight for lower coverage
      const weight = Math.max(0.1, 1 - t.policeCoverage / 100);
      return Math.random() < weight;
    });
    
    if (weightedTiles.length === 0) continue;
    
    const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
    const key = `${target.x},${target.y}`;
    
    // Different crime types with different durations
    const crimeTypes: CrimeType[] = ['robbery', 'burglary', 'disturbance', 'traffic'];
    const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
    const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;
    
    activeCrimeIncidentsRef.current.set(key, {
      x: target.x,
      y: target.y,
      type: crimeType,
      timeRemaining: duration,
    });
  }
}

// ============================================================================
// Crime Updates
// ============================================================================

/**
 * Update crime incidents (decay over time if not responded to)
 */
export function updateCrimeIncidents(
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>
): void {
  const { speed: currentSpeed } = worldState;
  if (currentSpeed === 0) return;
  
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
  const keysToDelete: string[] = [];
  
  activeCrimeIncidentsRef.current.forEach((crime, key) => {
    // If police car is responding, don't decay
    if (activeCrimesRef.current.has(key)) return;
    
    // Update time remaining
    const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
    if (newTimeRemaining <= 0) {
      // Crime "resolved" without police (criminal escaped, situation de-escalated)
      keysToDelete.push(key);
    } else {
      // Update the crime's time remaining
      activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
    }
  });
  
  // Delete expired crimes
  keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
}

/**
 * Find active crime incidents that need police response
 */
export function findCrimeIncidents(
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, CrimeIncident>>
): { x: number; y: number }[] {
  return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
}
