/**
 * Aircraft system - airplanes and helicopters
 * Handles updating and drawing of aircraft
 */

import { Airplane, Helicopter, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  AIRPLANE_MIN_POPULATION,
  AIRPLANE_COLORS,
  CONTRAIL_MAX_AGE,
  CONTRAIL_SPAWN_INTERVAL,
  HELICOPTER_MIN_POPULATION,
  HELICOPTER_COLORS,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
} from './constants';
import { gridToScreen } from './utils';
import { findAirports, findHeliports } from './gridFinders';

// ============================================================================
// Airplane Updates
// ============================================================================

/**
 * Update airplanes - spawn, move, and manage lifecycle
 */
export function updateAirplanes(
  delta: number,
  worldState: WorldRenderState,
  airplanesRef: React.MutableRefObject<Airplane[]>,
  airplaneIdRef: React.MutableRefObject<number>,
  airplaneSpawnTimerRef: React.MutableRefObject<number>,
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  const airports = findAirports(currentGrid, currentGridSize);
  
  // Get cached population count
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

  if (airports.length === 0 || totalPopulation < AIRPLANE_MIN_POPULATION) {
    airplanesRef.current = [];
    return;
  }

  const maxAirplanes = Math.min(54, Math.max(18, Math.floor(totalPopulation / 3500) * 3));
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

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
      const edge = Math.floor(Math.random() * 4);
      const mapCenterX = 0;
      const mapCenterY = currentGridSize * TILE_HEIGHT / 2;
      const mapExtent = currentGridSize * TILE_WIDTH;
      
      let startX: number, startY: number;
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
        
        plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
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
}

// ============================================================================
// Helicopter Updates
// ============================================================================

/**
 * Update helicopters - spawn, move between hospitals/airports, and manage lifecycle
 */
export function updateHelicopters(
  delta: number,
  worldState: WorldRenderState,
  helicoptersRef: React.MutableRefObject<Helicopter[]>,
  helicopterIdRef: React.MutableRefObject<number>,
  helicopterSpawnTimerRef: React.MutableRefObject<number>,
  cachedPopulationRef: React.MutableRefObject<{ count: number; gridVersion: number }>,
  gridVersionRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  const heliports = findHeliports(currentGrid, currentGridSize);
  
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

  const populationBased = Math.floor(totalPopulation / 1000);
  const heliportBased = Math.floor(heliports.length * 2.5);
  const maxHelicopters = Math.min(60, Math.max(6, Math.min(populationBased, heliportBased)));
  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

  helicopterSpawnTimerRef.current -= delta;
  if (helicoptersRef.current.length < maxHelicopters && helicopterSpawnTimerRef.current <= 0) {
    const originIndex = Math.floor(Math.random() * heliports.length);
    const origin = heliports[originIndex];
    
    const otherHeliports = heliports.filter((_, i) => i !== originIndex);
    if (otherHeliports.length > 0) {
      const dest = otherHeliports[Math.floor(Math.random() * otherHeliports.length)];
      
      const { screenX: originScreenX, screenY: originScreenY } = gridToScreen(origin.x, origin.y, 0, 0);
      const originCenterX = originScreenX + TILE_WIDTH * origin.size / 2;
      const originCenterY = originScreenY + TILE_HEIGHT * origin.size / 2;
      
      const { screenX: destScreenX, screenY: destScreenY } = gridToScreen(dest.x, dest.y, 0, 0);
      const destCenterX = destScreenX + TILE_WIDTH * dest.size / 2;
      const destCenterY = destScreenY + TILE_HEIGHT * dest.size / 2;
      
      const angleToDestination = Math.atan2(destCenterY - originCenterY, destCenterX - originCenterX);
      
      helicoptersRef.current.push({
        id: helicopterIdRef.current++,
        x: originCenterX,
        y: originCenterY,
        angle: angleToDestination,
        state: 'taking_off',
        speed: 15 + Math.random() * 10,
        altitude: 0,
        targetAltitude: 0.5,
        originX: origin.x,
        originY: origin.y,
        originType: origin.type,
        destX: dest.x,
        destY: dest.y,
        destType: dest.type,
        destScreenX: destCenterX,
        destScreenY: destCenterY,
        stateProgress: 0,
        rotorWash: [],
        rotorAngle: 0,
        color: HELICOPTER_COLORS[Math.floor(Math.random() * HELICOPTER_COLORS.length)],
      });
    }
    
    helicopterSpawnTimerRef.current = 0.8 + Math.random() * 2.2;
  }

  const updatedHelicopters: Helicopter[] = [];
  
  for (const heli of helicoptersRef.current) {
    heli.rotorAngle += delta * 25;
    
    const washMaxAge = isMobile ? 0.4 : ROTOR_WASH_MAX_AGE;
    const washSpawnInterval = isMobile ? 0.08 : ROTOR_WASH_SPAWN_INTERVAL;
    heli.rotorWash = heli.rotorWash
      .map(p => ({ ...p, age: p.age + delta, opacity: Math.max(0, 1 - p.age / washMaxAge) }))
      .filter(p => p.age < washMaxAge);
    
    if (heli.altitude > 0.2 && heli.state === 'flying') {
      heli.stateProgress += delta;
      if (heli.stateProgress >= washSpawnInterval) {
        heli.stateProgress -= washSpawnInterval;
        const behindAngle = heli.angle + Math.PI;
        const offsetDist = 6;
        heli.rotorWash.push({
          x: heli.x + Math.cos(behindAngle) * offsetDist,
          y: heli.y + Math.sin(behindAngle) * offsetDist,
          age: 0,
          opacity: 1
        });
      }
    }
    
    switch (heli.state) {
      case 'taking_off': {
        heli.altitude = Math.min(0.5, heli.altitude + delta * 0.4);
        heli.speed = Math.min(50, heli.speed + delta * 15);
        
        if (heli.altitude >= 0.3) {
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier * 0.5;
        }
        
        if (heli.altitude >= 0.5) {
          heli.state = 'flying';
        }
        break;
      }
      
      case 'flying': {
        heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
        heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
        
        const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
        
        if (distToDest < 80) {
          heli.state = 'landing';
          heli.targetAltitude = 0;
        }
        break;
      }
      
      case 'landing': {
        const distToDest = Math.hypot(heli.x - heli.destScreenX, heli.y - heli.destScreenY);
        heli.speed = Math.max(10, heli.speed - delta * 20);
        
        if (distToDest > 15) {
          const angleToDestination = Math.atan2(heli.destScreenY - heli.y, heli.destScreenX - heli.x);
          heli.angle = angleToDestination;
          heli.x += Math.cos(heli.angle) * heli.speed * delta * speedMultiplier;
          heli.y += Math.sin(heli.angle) * heli.speed * delta * speedMultiplier;
        }
        
        heli.altitude = Math.max(0, heli.altitude - delta * 0.3);
        
        if (heli.altitude <= 0 && distToDest < 20) {
          continue;
        }
        break;
      }
      
      case 'hovering':
        break;
    }
    
    updatedHelicopters.push(heli);
  }
  
  helicoptersRef.current = updatedHelicopters;
}

// ============================================================================
// Drawing Functions
// ============================================================================

/**
 * Draw airplanes with contrails
 */
export function drawAirplanes(
  ctx: CanvasRenderingContext2D,
  airplanes: Airplane[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  hour: number,
  navLightFlashTimer: number
): void {
  if (airplanes.length === 0) return;

  for (const plane of airplanes) {
    // Draw contrails first (behind plane)
    if (plane.contrail.length > 0) {
      ctx.save();
      for (const particle of plane.contrail) {
        // Skip if outside viewport
        if (
          particle.x < viewBounds.viewLeft ||
          particle.x > viewBounds.viewRight ||
          particle.y < viewBounds.viewTop ||
          particle.y > viewBounds.viewBottom
        ) {
          continue;
        }

        const size = 3 + particle.age * 8; // Contrails expand over time
        const opacity = particle.opacity * 0.4 * plane.altitude; // Fade with altitude

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Skip plane rendering if outside viewport
    if (
      plane.x < viewBounds.viewLeft - 50 ||
      plane.x > viewBounds.viewRight + 50 ||
      plane.y < viewBounds.viewTop - 50 ||
      plane.y > viewBounds.viewBottom + 50
    ) {
      continue;
    }

    // Draw shadow (when low altitude)
    if (plane.altitude < 0.8) {
      const shadowOffset = (1 - plane.altitude) * 15;
      const shadowScale = 0.6 + plane.altitude * 0.4;
      const shadowOpacity = 0.3 * (1 - plane.altitude);

      ctx.save();
      ctx.translate(plane.x + shadowOffset, plane.y + shadowOffset * 0.5);
      ctx.rotate(plane.angle);
      ctx.scale(shadowScale, shadowScale * 0.5);
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw airplane
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(plane.angle);

    // Scale based on altitude (appears larger when higher/closer)
    const altitudeScale = 0.7 + plane.altitude * 0.5;
    ctx.scale(altitudeScale, altitudeScale);

    // Fuselage - cylindrical body (rounded rectangle shape)
    ctx.fillStyle = plane.color;
    ctx.beginPath();
    // Draw a more cylindrical fuselage using a rounded rect approach
    const fuselageLength = 18;
    const fuselageWidth = 2.5; // Thinner for more cylindrical look
    ctx.moveTo(-fuselageLength, -fuselageWidth);
    ctx.lineTo(fuselageLength - 2, -fuselageWidth);
    ctx.quadraticCurveTo(fuselageLength, -fuselageWidth * 0.5, fuselageLength, 0);
    ctx.quadraticCurveTo(fuselageLength, fuselageWidth * 0.5, fuselageLength - 2, fuselageWidth);
    ctx.lineTo(-fuselageLength, fuselageWidth);
    ctx.quadraticCurveTo(-fuselageLength - 2, fuselageWidth, -fuselageLength - 2, 0);
    ctx.quadraticCurveTo(-fuselageLength - 2, -fuselageWidth, -fuselageLength, -fuselageWidth);
    ctx.closePath();
    ctx.fill();

    // Wings - connected to fuselage body
    ctx.fillStyle = plane.color;
    ctx.beginPath();
    ctx.moveTo(0, -fuselageWidth);
    ctx.lineTo(-8, -18);
    ctx.lineTo(-12, -18);
    ctx.lineTo(-4, -fuselageWidth);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, fuselageWidth);
    ctx.lineTo(-8, 18);
    ctx.lineTo(-12, 18);
    ctx.lineTo(-4, fuselageWidth);
    ctx.closePath();
    ctx.fill();

    // Tail fin
    ctx.fillStyle = plane.color;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-18, -8);
    ctx.lineTo(-20, -8);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    // Horizontal stabilizers
    ctx.beginPath();
    ctx.moveTo(-16, -2);
    ctx.lineTo(-18, -6);
    ctx.lineTo(-20, -6);
    ctx.lineTo(-18, -2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-16, 2);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-20, 6);
    ctx.lineTo(-18, 2);
    ctx.closePath();
    ctx.fill();

    // Engine nacelles
    ctx.fillStyle = '#475569'; // Dark gray
    ctx.beginPath();
    ctx.ellipse(-2, -8, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-2, 8, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Navigation lights at night (hour >= 20 || hour < 6)
    const isNight = hour >= 20 || hour < 6;
    if (isNight) {
      const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.85; // Sharp, brief flash

      // Red nav light on port (left) wingtip
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(-10, -17, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Green nav light on starboard (right) wingtip
      ctx.fillStyle = '#33ff33';
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(-10, 17, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // White strobe/anti-collision light on tail (flashing) - BRIGHT
      if (strobeOn) {
        // Draw multiple layers for intense brightness
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.arc(-18, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Inner bright core
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(-18, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

/**
 * Draw helicopters with rotor wash
 */
export function drawHelicopters(
  ctx: CanvasRenderingContext2D,
  helicopters: Helicopter[],
  viewBounds: { viewLeft: number; viewTop: number; viewRight: number; viewBottom: number },
  hour: number,
  navLightFlashTimer: number
): void {
  if (helicopters.length === 0) return;

  for (const heli of helicopters) {
    // Draw rotor wash/exhaust particles first (behind helicopter)
    if (heli.rotorWash.length > 0) {
      ctx.save();
      for (const particle of heli.rotorWash) {
        // Skip if outside viewport
        if (
          particle.x < viewBounds.viewLeft ||
          particle.x > viewBounds.viewRight ||
          particle.y < viewBounds.viewTop ||
          particle.y > viewBounds.viewBottom
        ) {
          continue;
        }

        const size = 1.5 + particle.age * 4; // Smaller than plane contrails
        const opacity = particle.opacity * 0.25 * heli.altitude;

        ctx.fillStyle = `rgba(200, 200, 200, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Skip helicopter rendering if outside viewport
    if (
      heli.x < viewBounds.viewLeft - 30 ||
      heli.x > viewBounds.viewRight + 30 ||
      heli.y < viewBounds.viewTop - 30 ||
      heli.y > viewBounds.viewBottom + 30
    ) {
      continue;
    }

    // Draw shadow (always visible since helicopters fly lower)
    const shadowOffset = (0.5 - heli.altitude) * 10 + 3;
    const shadowScale = 0.5 + heli.altitude * 0.3;
    const shadowOpacity = 0.25 * (0.6 - heli.altitude * 0.3);

    ctx.save();
    ctx.translate(heli.x + shadowOffset, heli.y + shadowOffset * 0.5);
    ctx.rotate(heli.angle);
    ctx.scale(shadowScale, shadowScale * 0.5);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw helicopter body
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle);

    // Scale based on altitude (smaller than planes)
    const altitudeScale = 0.5 + heli.altitude * 0.3;
    ctx.scale(altitudeScale, altitudeScale);

    // Main body - oval/teardrop shape
    ctx.fillStyle = heli.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cockpit bubble (front)
    ctx.fillStyle = '#87ceeb'; // Light blue glass
    ctx.beginPath();
    ctx.ellipse(5, 0, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail boom
    ctx.fillStyle = heli.color;
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(-16, -0.5);
    ctx.lineTo(-16, 0.5);
    ctx.lineTo(-6, 1);
    ctx.closePath();
    ctx.fill();

    // Tail rotor (vertical)
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.ellipse(-15, 0, 1, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Landing skids
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    // Left skid
    ctx.moveTo(-4, 3.5);
    ctx.lineTo(4, 3.5);
    ctx.moveTo(-2, 4);
    ctx.lineTo(-2, 6);
    ctx.lineTo(2, 6);
    ctx.lineTo(2, 4);
    // Right skid
    ctx.moveTo(-4, -3.5);
    ctx.lineTo(4, -3.5);
    ctx.moveTo(-2, -4);
    ctx.lineTo(-2, -6);
    ctx.lineTo(2, -6);
    ctx.lineTo(2, -4);
    ctx.stroke();

    // Navigation lights at night (hour >= 20 || hour < 6)
    const isNight = hour >= 20 || hour < 6;
    if (isNight) {
      const strobeOn = Math.sin(navLightFlashTimer * 8) > 0.82; // Sharp, brief flash

      // Red nav light on port (left) side
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Green nav light on starboard (right) side
      ctx.fillStyle = '#33ff33';
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Red anti-collision beacon on tail (flashing) - BRIGHT
      if (strobeOn) {
        // Draw multiple layers for intense brightness
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(-14, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        // Inner bright core
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(-14, 0, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Draw main rotor (drawn separately so it's always on top)
    ctx.save();
    ctx.translate(heli.x, heli.y);

    // Rotor hub
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, 2 * altitudeScale, 0, Math.PI * 2);
    ctx.fill();

    // Rotor blades (spinning effect - draw as blurred disc)
    const rotorRadius = 12 * altitudeScale;
    ctx.strokeStyle = `rgba(100, 100, 100, ${0.4 + Math.sin(heli.rotorAngle * 4) * 0.1})`;
    ctx.lineWidth = 1.5 * altitudeScale;
    ctx.beginPath();
    ctx.arc(0, 0, rotorRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw rotor blade lines (2 blades, rotating)
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.6)';
    ctx.lineWidth = 1.5 * altitudeScale;
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(heli.rotorAngle) * rotorRadius,
      Math.sin(heli.rotorAngle) * rotorRadius
    );
    ctx.lineTo(
      Math.cos(heli.rotorAngle + Math.PI) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI) * rotorRadius
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      Math.cos(heli.rotorAngle + Math.PI / 2) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI / 2) * rotorRadius
    );
    ctx.lineTo(
      Math.cos(heli.rotorAngle + Math.PI * 1.5) * rotorRadius,
      Math.sin(heli.rotorAngle + Math.PI * 1.5) * rotorRadius
    );
    ctx.stroke();

    ctx.restore();
  }
}
