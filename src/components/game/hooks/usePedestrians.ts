import { useRef, useCallback } from 'react';
import { Pedestrian, PedestrianDestType, CarDirection, WorldRenderState } from '@/components/game/types';
import { PEDESTRIAN_SKIN_COLORS, PEDESTRIAN_SHIRT_COLORS, PEDESTRIAN_MIN_ZOOM } from '@/components/game/constants';
import { isRoadTile, findPathOnRoads, getDirectionToTile } from '@/components/game/utils';
import { findResidentialBuildings, findPedestrianDestinations } from '@/components/game/gridFinders';

export function usePedestrians(
  worldStateRef: React.MutableRefObject<WorldRenderState>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean = false
) {
  const pedestriansRef = useRef<Pedestrian[]>([]);
  const pedestrianIdRef = useRef(0);
  const pedestrianSpawnTimerRef = useRef(0);
  const cachedRoadTileCountRef = useRef<{ count: number; gridVersion: number }>({ count: 0, gridVersion: -1 });

  const findResidentialBuildingsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findResidentialBuildings(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findPedestrianDestinationsCallback = useCallback((): { x: number; y: number; type: PedestrianDestType }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findPedestrianDestinations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnPedestrian = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    const residentials = findResidentialBuildingsCallback();
    if (residentials.length === 0) {
      return false;
    }
    
    const destinations = findPedestrianDestinationsCallback();
    if (destinations.length === 0) {
      return false;
    }
    
    // Pick a random residential building as home
    const home = residentials[Math.floor(Math.random() * residentials.length)];
    
    // Pick a random destination
    const dest = destinations[Math.floor(Math.random() * destinations.length)];
    
    // Find path from home to destination via roads
    const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y);
    if (!path || path.length === 0) {
      return false;
    }
    
    // Start at a random point along the path for better distribution
    const startIndex = Math.floor(Math.random() * path.length);
    const startTile = path[startIndex];
    
    // Determine initial direction based on next tile in path
    let direction: CarDirection = 'south';
    if (startIndex + 1 < path.length) {
      const nextTile = path[startIndex + 1];
      const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    } else if (startIndex > 0) {
      // At end of path, use previous tile to determine direction
      const prevTile = path[startIndex - 1];
      const dir = getDirectionToTile(prevTile.x, prevTile.y, startTile.x, startTile.y);
      if (dir) direction = dir;
    }
    
    pedestriansRef.current.push({
      id: pedestrianIdRef.current++,
      tileX: startTile.x,
      tileY: startTile.y,
      direction,
      progress: Math.random(),
      speed: 0.12 + Math.random() * 0.08, // Pedestrians are slower than cars
      pathIndex: startIndex,
      age: 0,
      maxAge: 60 + Math.random() * 90, // 60-150 seconds lifespan
      skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
      shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
      walkOffset: Math.random() * Math.PI * 2,
      sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
      destType: dest.type,
      homeX: home.x,
      homeY: home.y,
      destX: dest.x,
      destY: dest.y,
      returningHome: startIndex >= path.length - 1, // If starting at end, they're returning
      path,
    });
    
    return true;
  }, [worldStateRef, findResidentialBuildingsCallback, findPedestrianDestinationsCallback]);

  const updatePedestrians = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    // Clear pedestrians if zoomed out (mobile requires higher zoom level)
    const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
    if (currentZoom < minZoomForPedestrians) {
      pedestriansRef.current = [];
      return;
    }
    
    if (!currentGrid || currentGridSize <= 0) {
      pedestriansRef.current = [];
      return;
    }
    
    // Speed multiplier
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Get cached road tile count (only recalculate when grid changes)
    const currentGridVersion = gridVersionRef.current;
    let roadTileCount: number;
    if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
      roadTileCount = cachedRoadTileCountRef.current.count;
    } else {
      // Recalculate and cache
      roadTileCount = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          if (currentGrid[y][x].building.type === 'road') {
            roadTileCount++;
          }
        }
      }
      cachedRoadTileCountRef.current = { count: roadTileCount, gridVersion: currentGridVersion };
    }
    
    // Spawn pedestrians - scale with road network size, reduced on mobile
    // Mobile: max 50 pedestrians, 0.8 per road tile
    // Desktop: max 200+ pedestrians, 3 per road tile
    const maxPedestrians = isMobile 
      ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8)))
      : Math.max(200, roadTileCount * 3);
    pedestrianSpawnTimerRef.current -= delta;
    if (pedestriansRef.current.length < maxPedestrians && pedestrianSpawnTimerRef.current <= 0) {
      // Spawn fewer pedestrians at once on mobile
      let spawnedCount = 0;
      const spawnBatch = isMobile 
        ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
        : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
      for (let i = 0; i < spawnBatch; i++) {
        if (spawnPedestrian()) {
          spawnedCount++;
        }
      }
      // Slower spawn rate on mobile
      pedestrianSpawnTimerRef.current = spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
    }
    
    const updatedPedestrians: Pedestrian[] = [];
    
    for (const ped of [...pedestriansRef.current]) {
      let alive = true;
      
      // Update age
      ped.age += delta;
      if (ped.age > ped.maxAge) {
        continue;
      }
      
      // Update walk animation
      ped.walkOffset += delta * 8;
      
      // Check if still on valid road
      if (!isRoadTile(currentGrid, currentGridSize, ped.tileX, ped.tileY)) {
        continue;
      }
      
      // Move pedestrian along path
      ped.progress += ped.speed * delta * speedMultiplier;
      
      // Handle single-tile paths (already at destination)
      if (ped.path.length === 1 && ped.progress >= 1) {
        if (!ped.returningHome) {
          ped.returningHome = true;
          const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            ped.tileX = returnPath[0].x;
            ped.tileY = returnPath[0].y;
            if (returnPath.length > 1) {
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
              if (dir) ped.direction = dir;
            }
          } else {
            continue; // Remove pedestrian
          }
        } else {
          continue; // Arrived home, remove
        }
      }
      
      while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
        ped.pathIndex++;
        ped.progress -= 1;
        
        const currentTile = ped.path[ped.pathIndex];
        
        // Bounds check
        if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
            currentTile.y < 0 || currentTile.y >= currentGridSize) {
          alive = false;
          break;
        }
        
        ped.tileX = currentTile.x;
        ped.tileY = currentTile.y;
        
        // Check if reached end of path
        if (ped.pathIndex >= ped.path.length - 1) {
          if (!ped.returningHome) {
            // Arrived at destination - start returning home
            ped.returningHome = true;
            const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
            if (returnPath && returnPath.length > 0) {
              ped.path = returnPath;
              ped.pathIndex = 0;
              ped.progress = 0;
              // Update direction for return trip
              if (returnPath.length > 1) {
                const nextTile = returnPath[1];
                const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
                if (dir) ped.direction = dir;
              }
            } else {
              alive = false;
            }
          } else {
            // Arrived back home - remove pedestrian
            alive = false;
          }
          break;
        }
        
        // Update direction for next segment
        if (ped.pathIndex + 1 < ped.path.length) {
          const nextTile = ped.path[ped.pathIndex + 1];
          const dir = getDirectionToTile(ped.tileX, ped.tileY, nextTile.x, nextTile.y);
          if (dir) ped.direction = dir;
        }
      }
      
      // Handle case where pedestrian is already at the last tile with progress >= 1
      // (can happen when spawned at end of path, or if progress accumulates)
      if (alive && ped.progress >= 1 && ped.pathIndex >= ped.path.length - 1) {
        if (!ped.returningHome) {
          // Arrived at destination - start returning home
          ped.returningHome = true;
          const returnPath = findPathOnRoads(currentGrid, currentGridSize, ped.destX, ped.destY, ped.homeX, ped.homeY);
          if (returnPath && returnPath.length > 0) {
            ped.path = returnPath;
            ped.pathIndex = 0;
            ped.progress = 0;
            ped.tileX = returnPath[0].x;
            ped.tileY = returnPath[0].y;
            // Update direction for return trip
            if (returnPath.length > 1) {
              const nextTile = returnPath[1];
              const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, nextTile.x, nextTile.y);
              if (dir) ped.direction = dir;
            }
          } else {
            alive = false;
          }
        } else {
          // Arrived back home - remove pedestrian
          alive = false;
        }
      }
      
      if (alive) {
        updatedPedestrians.push(ped);
      }
    }
    
    pedestriansRef.current = updatedPedestrians;
  }, [worldStateRef, gridVersionRef, spawnPedestrian, isMobile]);

  return {
    pedestrians: pedestriansRef.current,
    pedestriansRef,
    updatePedestrians,
  };
}
