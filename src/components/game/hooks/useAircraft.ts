import { useRef, useCallback } from 'react';
import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from '@/components/game/types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
} from '@/components/game/constants';
import { gridToScreen } from '@/components/game/utils';
import { findAirports, findHeliports, generateTourWaypoints } from '@/components/game/gridFinders';

export function useAircraft(
  worldStateRef: React.MutableRefObject<WorldRenderState>,
  gridVersionRef: React.MutableRefObject<number>,
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>,
  isMobile: boolean = false
) {
  const airplanesRef = useRef<Airplane[]>([]);
  const airplaneIdRef = useRef(0);
  const airplaneSpawnTimerRef = useRef(0);

  const helicoptersRef = useRef<Helicopter[]>([]);
  const helicopterIdRef = useRef(0);
  const helicopterSpawnTimerRef = useRef(0);

  const findAirportsCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findAirports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const findHeliportsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findHeliports(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const generateTourWaypointsCallback = useCallback((startTileX: number, startTileY: number) => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return generateTourWaypoints(currentGrid, currentGridSize, startTileX, startTileY);
  }, [worldStateRef]);

  const updateAirplanes = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    // Find airports and check population
    const airports = findAirportsCallback();
    
    // Get cached population count (only recalculate when grid changes)
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      // Recalculate and cache
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    // No airplanes if no airport or insufficient population
    if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
      airplanesRef.current = [];
      return;
    }

    // Calculate max airplanes based on population
    const maxAirplanes = Math.min(54, Math.max(18, Math.floor(totalPopulation / 3500) * 3));
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    airplaneSpawnTimerRef.current -= delta;
    if (airplanesRef.current.length < maxAirplanes && airplaneSpawnTimerRef.current <= 0) {
      const airport = airports[Math.floor(Math.random() * airports.length)];
      const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(airport.x, airport.y, 0, 0);
      const airportCenterX = airportScreenX + TILE_WIDTH * 2;
      const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
      
      const isTakingOff = Math.random() < 0.5;
      
      if (isTakingOff) {
        const angle = Math.random() * Math.PI * 2;
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: airportCenterX,
          y: airportCenterY,
          angle: angle,
          state: 'taking_off',
          speed: 30 + Math.random() * 20,
          altitude: 0,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      } else {
        // Arriving from the edge of the map
        const edge = Math.floor(Math.random() * 4);
        let startX: number, startY: number;
        const mapCenterX = 0;
        const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
        const mapExtent = currentGridSize * TILE_WIDTH;
        
        switch (edge) {
          case 0:
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY - mapExtent / 2 - 200;
            break;
          case 1:
            startX = mapCenterX + mapExtent / 2 + 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
          case 2:
            startX = mapCenterX + (Math.random() - 0.5) * mapExtent;
            startY = mapCenterY + mapExtent / 2 + 200;
            break;
          default:
            startX = mapCenterX - mapExtent / 2 - 200;
            startY = mapCenterY + (Math.random() - 0.5) * mapExtent / 2;
            break;
        }
        
        const angleToAirport = Math.atan2(airportCenterY - startY, airportCenterX - startX);
        
        airplanesRef.current.push({
          id: airplaneIdRef.current++,
          x: startX,
          y: startY,
          angle: angleToAirport,
          state: 'flying',
          speed: 80 + Math.random() * 40,
          altitude: 1,
          targetAltitude: 1,
          airportX: airport.x,
          airportY: airport.y,
          stateProgress: 0,
          contrail: [],
          lifeTime: 30 + Math.random() * 20,
          color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
        });
      }
      
      airplaneSpawnTimerRef.current = 5 + Math.random() * 10;
    }

    // Update existing airplanes
    const updatedAirplanes: Airplane[] = [];
    
    for (const plane of airplanesRef.current) {
      const contrailMaxAge = isMobile ? 0.8 : CONTRAIL_MAX_AGE;
      const contrailSpawnInterval = isMobile ? 0.06 : CONTRAIL_SPAWN_INTERVAL;
      plane.contrail = plane.contrail
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / contrailMaxAge) }))
        .filter(p => p.age < contrailMaxAge);
      
      if (plane.altitude > 0.7) {
        plane.stateProgress += delta;
        if (plane.stateProgress >= contrailSpawnInterval) {
          plane.stateProgress -= contrailSpawnInterval;
          const perpAngle = plane.angle + Math.PI / 2;
          const engineOffset = 4 * (0.5 + plane.altitude * 0.5);
          if (isMobile) {
            plane.contrail.push({ x: plane.x, y: plane.y, age: 0, opacity: 1 });
          } else {
            plane.contrail.push(
              { x: plane.x + Math.cos(perpAngle) * engineOffset, y: plane.y + Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 },
              { x: plane.x - Math.cos(perpAngle) * engineOffset, y: plane.y - Math.sin(perpAngle) * engineOffset, age: 0, opacity: 1 }
            );
          }
        }
      }
      
      switch (plane.state) {
        case 'taking_off': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.min(1, plane.altitude + delta * 0.3);
          plane.speed = Math.min(120, plane.speed + delta * 20);
          
          if (plane.altitude >= 1) {
            plane.state = 'flying';
          }
          break;
        }
        
        case 'flying': {
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          
          plane.lifeTime -= delta;
          
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          
          if (distToAirport < 400 && plane.lifeTime < 10) {
            plane.state = 'landing';
            plane.targetAltitude = 0;
            plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          } else if (plane.lifeTime <= 0) {
            continue;
          }
          break;
        }
        
        case 'landing': {
          const { screenX: airportScreenX, screenY: airportScreenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = airportScreenX + TILE_WIDTH * 2;
          const airportCenterY = airportScreenY + TILE_HEIGHT * 2;
          
          const angleToAirport = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
          plane.angle = angleToAirport;
          
          plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
          plane.altitude = Math.max(0, plane.altitude - delta * 0.25);
          plane.speed = Math.max(30, plane.speed - delta * 15);
          
          const distToAirport = Math.hypot(plane.x - airportCenterX, plane.y - airportCenterY);
          if (distToAirport < 50 || plane.altitude <= 0) {
            continue;
          }
          break;
        }
        
        case 'taxiing':
          continue;
      }
      
      updatedAirplanes.push(plane);
    }
    
    airplanesRef.current = updatedAirplanes;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, findAirportsCallback, isMobile]);

  const updateHelicopters = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    const heliports = findHeliportsCallback();
    
    const currentGridVersion = gridVersionRef.current;
    let totalPopulation: number;
    if (cachedPopulationRef.current.gridVersion === currentGridVersion) {
      totalPopulation = cachedPopulationRef.current.count;
    } else {
      totalPopulation = 0;
      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          totalPopulation += currentGrid[y][x].building.population || 0;
        }
      }
      cachedPopulationRef.current = { count: totalPopulation, gridVersion: currentGridVersion };
    }

    if (heliports.length < 2 || totalPopulation < HELICOPTER_MIN_POPULATION) {
      helicoptersRef.current = [];
      return;
    }

    const maxHelicopters = Math.min(24, Math.max(8, heliports.length * 2));
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    helicopterSpawnTimerRef.current -= delta;
    if (helicoptersRef.current.length < maxHelicopters && helicopterSpawnTimerRef.current <= 0) {
      const startHeliport = heliports[Math.floor(Math.random() * heliports.length)];
      let destHeliport = heliports[Math.floor(Math.random() * heliports.length)];
      while (destHeliport === startHeliport && heliports.length > 1) {
        destHeliport = heliports[Math.floor(Math.random() * heliports.length)];
      }
      
      const waypoints = generateTourWaypointsCallback(startHeliport.x, startHeliport.y);
      const { screenX, screenY } = gridToScreen(startHeliport.x, startHeliport.y, 0, 0);
      
      helicoptersRef.current.push({
        id: helicopterIdRef.current++,
        x: screenX + TILE_WIDTH / 2,
        y: screenY + TILE_HEIGHT / 2,
        targetX: screenX + TILE_WIDTH / 2,
        targetY: screenY + TILE_HEIGHT / 2,
        state: 'taking_off',
        altitude: 0,
        targetAltitude: 0.6,
        speed: 40 + Math.random() * 20,
        rotorAngle: Math.random() * Math.PI * 2,
        rotorSpeed: 15 + Math.random() * 5,
        homeX: startHeliport.x,
        homeY: startHeliport.y,
        destX: destHeliport.x,
        destY: destHeliport.y,
        waypoints: waypoints,
        currentWaypointIndex: 0,
        rotorWash: [],
        lifeTime: 40 + Math.random() * 30,
        color: HELICOPTER_COLORS[Math.floor(Math.random() * HELICOPTER_COLORS.length)],
      });
      
      helicopterSpawnTimerRef.current = 8 + Math.random() * 12;
    }

    const updatedHelicopters: Helicopter[] = [];
    
    for (const heli of helicoptersRef.current) {
      const rotorWashMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
      const rotorWashSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
      
      heli.rotorWash = heli.rotorWash
        .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / rotorWashMaxAge) }))
        .filter(p => p.age < rotorWashMaxAge);
      
      if (heli.altitude > 0.2 && (heli.state === 'taking_off' || heli.state === 'landing')) {
        if (heli.rotorWash.length === 0 || heli.rotorWash[heli.rotorWash.length - 1].age > rotorWashSpawnInterval) {
          const jitter = 3;
          if (isMobile) {
            heli.rotorWash.push({
              x: heli.x + (Math.random() - 0.5) * jitter,
              y: heli.y + (Math.random() - 0.5) * jitter,
              age: 0,
              opacity: 1
            });
          } else {
            for (let i = 0; i < 3; i++) {
              heli.rotorWash.push({
                x: heli.x + (Math.random() - 0.5) * jitter,
                y: heli.y + (Math.random() - 0.5) * jitter,
                age: 0,
                opacity: 1
              });
            }
          }
        }
      }
      
      heli.rotorAngle += heli.rotorSpeed * delta;
      
      switch (heli.state) {
        case 'taking_off': {
          heli.altitude = Math.min(heli.targetAltitude, heli.altitude + delta * 0.4);
          if (heli.altitude >= heli.targetAltitude) {
            heli.state = 'flying';
            if (heli.waypoints.length > 0) {
              const nextWaypoint = heli.waypoints[0];
              const { screenX, screenY } = gridToScreen(nextWaypoint.x, nextWaypoint.y, 0, 0);
              heli.targetX = screenX + TILE_WIDTH / 2;
              heli.targetY = screenY + TILE_HEIGHT / 2;
            }
          }
          break;
        }
        
        case 'flying': {
          const dx = heli.targetX - heli.x;
          const dy = heli.targetY - heli.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist < 10) {
            if (heli.currentWaypointIndex < heli.waypoints.length - 1) {
              heli.currentWaypointIndex++;
              const nextWaypoint = heli.waypoints[heli.currentWaypointIndex];
              const { screenX, screenY } = gridToScreen(nextWaypoint.x, nextWaypoint.y, 0, 0);
              heli.targetX = screenX + TILE_WIDTH / 2;
              heli.targetY = screenY + TILE_HEIGHT / 2;
            } else {
              heli.state = 'landing';
              heli.targetAltitude = 0;
            }
          } else {
            heli.x += (dx / dist) * heli.speed * delta * speedMultiplier;
            heli.y += (dy / dist) * heli.speed * delta * speedMultiplier;
          }
          
          heli.lifeTime -= delta;
          if (heli.lifeTime <= 0) {
            continue;
          }
          break;
        }
        
        case 'landing': {
          heli.altitude = Math.max(0, heli.altitude - delta * 0.3);
          if (heli.altitude <= 0) {
            continue;
          }
          break;
        }
      }
      
      updatedHelicopters.push(heli);
    }
    
    helicoptersRef.current = updatedHelicopters;
  }, [worldStateRef, gridVersionRef, cachedPopulationRef, findHeliportsCallback, generateTourWaypointsCallback, isMobile]);

  return {
    airplanes: airplanesRef.current,
    airplanesRef,
    updateAirplanes,
    helicopters: helicoptersRef.current,
    helicoptersRef,
    updateHelicopters,
  };
}
