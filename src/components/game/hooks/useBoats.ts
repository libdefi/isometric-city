import { useRef, useCallback } from 'react';
import { Boat, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import { BOAT_COLORS, BOAT_MIN_ZOOM, WAKE_MAX_AGE, WAKE_SPAWN_INTERVAL } from '@/components/game/constants';
import { gridToScreen } from '@/components/game/utils';
import { findMarinasAndPiers, findAdjacentWaterTile, isOverWater, generateTourWaypoints } from '@/components/game/gridFinders';

export function useBoats(
  worldStateRef: React.MutableRefObject<WorldRenderState>,
  isMobile: boolean = false
) {
  const boatsRef = useRef<Boat[]>([]);
  const boatIdRef = useRef(0);
  const boatSpawnTimerRef = useRef(0);

  const findMarinasAndPiersCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findMarinasAndPiers(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findAdjacentWaterTileCallback = useCallback((dockX: number, dockY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAdjacentWaterTile(currentGrid, currentGridSize, dockX, dockY);
  }, [worldStateRef]);

  const isOverWaterCallback = useCallback((screenX: number, screenY: number): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return isOverWater(currentGrid, currentGridSize, screenX, screenY);
  }, [worldStateRef]);

  const generateTourWaypointsCallback = useCallback((startTileX: number, startTileY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return generateTourWaypoints(currentGrid, currentGridSize, startTileX, startTileY);
  }, [worldStateRef]);

  const updateBoats = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Clear boats if zoomed out too far
    if (currentZoom < BOAT_MIN_ZOOM) {
      boatsRef.current = [];
      return;
    }

    // Find marinas and piers
    const docks = findMarinasAndPiersCallback();
    
    // No boats if no docks
    if (docks.length === 0) {
      boatsRef.current = [];
      return;
    }

    // Calculate max boats based on number of docks
    const maxBoats = Math.min(25, docks.length * 3);
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    boatSpawnTimerRef.current -= delta;
    if (boatsRef.current.length < maxBoats && boatSpawnTimerRef.current <= 0) {
      const homeDock = docks[Math.floor(Math.random() * docks.length)];
      const waterTile = findAdjacentWaterTileCallback(homeDock.x, homeDock.y);
      
      if (waterTile) {
        const tourWaypoints = generateTourWaypointsCallback(waterTile.x, waterTile.y);
        const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(waterTile.x, waterTile.y, 0, 0);
        const homeScreenX = originScreenX + TILE_WIDTH / 2;
        const homeScreenY = originScreenY + TILE_HEIGHT / 2;
        
        let firstDestScreenX = homeScreenX;
        let firstDestScreenY = homeScreenY;
        if (tourWaypoints.length > 0) {
          firstDestScreenX = tourWaypoints[0].screenX;
          firstDestScreenY = tourWaypoints[0].screenY;
        }
        
        const angle = Math.atan2(firstDestScreenY - originScreenY, firstDestScreenX - originScreenX);
        
        boatsRef.current.push({
          id: boatIdRef.current++,
          x: homeScreenX,
          y: homeScreenY,
          angle: angle,
          targetAngle: angle,
          state: 'departing',
          speed: 15 + Math.random() * 10,
          originX: homeDock.x,
          originY: homeDock.y,
          destX: homeDock.x,
          destY: homeDock.y,
          destScreenX: firstDestScreenX,
          destScreenY: firstDestScreenY,
          age: 0,
          color: BOAT_COLORS[Math.floor(Math.random() * BOAT_COLORS.length)],
          wake: [],
          wakeSpawnProgress: 0,
          sizeVariant: Math.random() < 0.7 ? 0 : 1,
          tourWaypoints: tourWaypoints,
          tourWaypointIndex: 0,
          homeScreenX: homeScreenX,
          homeScreenY: homeScreenY,
        });
      }
      
      boatSpawnTimerRef.current = 1 + Math.random() * 2;
    }

    // Update existing boats
    const updatedBoats: Boat[] = [];
    
    for (const boat of boatsRef.current) {
      boat.age += delta;
      
      const wakeMaxAge = isMobile ? 0.6 : WAKE_MAX_AGE;
      boat.wake = boat.wake
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / wakeMaxAge) }))
        .filter(p => p.age < wakeMaxAge);
      
      const distToDest = Math.hypot(boat.x - boat.destScreenX, boat.y - boat.destScreenY);
      let nextX = boat.x;
      let nextY = boat.y;
      
      switch (boat.state) {
        case 'departing': {
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (boat.age > 2) {
            if (boat.tourWaypoints.length > 0) {
              boat.state = 'touring';
              boat.tourWaypointIndex = 0;
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
            }
          }
          break;
        }
        
        case 'touring': {
          const angleToWaypoint = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToWaypoint;
          
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 1.8);
          
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (distToDest < 40) {
            boat.tourWaypointIndex++;
            
            if (boat.tourWaypointIndex < boat.tourWaypoints.length) {
              const nextWaypoint = boat.tourWaypoints[boat.tourWaypointIndex];
              boat.destScreenX = nextWaypoint.screenX;
              boat.destScreenY = nextWaypoint.screenY;
            } else {
              boat.state = 'sailing';
              boat.destScreenX = boat.homeScreenX;
              boat.destScreenY = boat.homeScreenY;
              boat.age = 0;
            }
          }
          
          if (boat.age > 120) {
            continue;
          }
          break;
        }
        
        case 'sailing': {
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 2);
          
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (distToDest < 60) {
            boat.state = 'arriving';
          }
          
          if (boat.age > 60) {
            continue;
          }
          break;
        }
        
        case 'arriving': {
          boat.speed = Math.max(5, boat.speed - delta * 8);
          
          const angleToDestination = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
          boat.targetAngle = angleToDestination;
          
          let angleDiff = boat.targetAngle - boat.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          boat.angle += angleDiff * Math.min(1, delta * 3);
          
          nextX = boat.x + Math.cos(boat.angle) * boat.speed * delta * speedMultiplier;
          nextY = boat.y + Math.sin(boat.angle) * boat.speed * delta * speedMultiplier;
          
          if (distToDest < 15) {
            boat.state = 'docked';
            boat.age = 0;
            boat.wake = [];
          }
          break;
        }
        
        case 'docked': {
          if (boat.age > 3 + Math.random() * 3) {
            const waterTile = findAdjacentWaterTileCallback(boat.originX, boat.originY);
            if (waterTile) {
              boat.tourWaypoints = generateTourWaypointsCallback(waterTile.x, waterTile.y);
              boat.tourWaypointIndex = 0;
            }
            
            boat.state = 'departing';
            boat.speed = 15 + Math.random() * 10;
            boat.age = 0;
            
            if (boat.tourWaypoints.length > 0) {
              boat.destScreenX = boat.tourWaypoints[0].screenX;
              boat.destScreenY = boat.tourWaypoints[0].screenY;
            } else {
              boat.destScreenX = boat.homeScreenX + (Math.random() - 0.5) * 200;
              boat.destScreenY = boat.homeScreenY + (Math.random() - 0.5) * 200;
            }
            
            const angle = Math.atan2(boat.destScreenY - boat.y, boat.destScreenX - boat.x);
            boat.angle = angle;
            boat.targetAngle = angle;
          }
          break;
        }
      }
      
      // Check if next position is over water (skip for docked boats)
      if (boat.state !== 'docked') {
        if (!isOverWaterCallback(nextX, nextY)) {
          continue;
        }
        
        boat.x = nextX;
        boat.y = nextY;
        
        const wakeSpawnInterval = isMobile ? 0.08 : WAKE_SPAWN_INTERVAL;
        boat.wakeSpawnProgress += delta;
        if (boat.wakeSpawnProgress >= wakeSpawnInterval) {
          boat.wakeSpawnProgress -= wakeSpawnInterval;

          const behindBoat = -6;
          boat.wake.push({
            x: boat.x + Math.cos(boat.angle) * behindBoat,
            y: boat.y + Math.sin(boat.angle) * behindBoat,
            age: 0,
            opacity: 1
          });
        }
      }
      
      updatedBoats.push(boat);
    }
    
    boatsRef.current = updatedBoats;
  }, [worldStateRef, findMarinasAndPiersCallback, findAdjacentWaterTileCallback, isOverWaterCallback, generateTourWaypointsCallback, isMobile]);

  return {
    boats: boatsRef.current,
    boatsRef,
    updateBoats,
  };
}
