import type { MutableRefObject } from 'react';

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  Airplane,
  Helicopter,
  WorldRenderState,
} from '@/components/game/types';
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
import { findAirports, findHeliports } from '@/components/game/gridFinders';
import { drawAirplanes as drawAirplanesUtil, drawHelicopters as drawHelicoptersUtil } from '@/components/game/drawAircraft';

export interface AerialSystemContext {
  worldStateRef: MutableRefObject<WorldRenderState>;
  airplanesRef: MutableRefObject<Airplane[]>;
  airplaneIdRef: MutableRefObject<number>;
  airplaneSpawnTimerRef: MutableRefObject<number>;
  helicoptersRef: MutableRefObject<Helicopter[]>;
  helicopterIdRef: MutableRefObject<number>;
  helicopterSpawnTimerRef: MutableRefObject<number>;
  gridVersionRef: MutableRefObject<number>;
  cachedPopulationRef: MutableRefObject<{ count: number; gridVersion: number }>;
  navLightFlashTimerRef: MutableRefObject<number>;
  isMobile: boolean;
  hour: number;
}

export function updateAirplanes(context: AerialSystemContext, delta: number): void {
  const {
    worldStateRef,
    airplanesRef,
    airplaneIdRef,
    airplaneSpawnTimerRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
    return;
  }

  const airports = findAirports(currentGrid, currentGridSize);
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

    const takeoffAngle = Math.random() * Math.PI * 2;
    const altitude = 0.15 + Math.random() * 0.1;
    const speed = 80 + Math.random() * 60;

    airplanesRef.current.push({
      id: airplaneIdRef.current++,
      x: airportCenterX,
      y: airportCenterY,
      altitude,
      targetAltitude: 1,
      angle: takeoffAngle,
      speed,
      color: AIRPLANE_COLORS[Math.floor(Math.random() * AIRPLANE_COLORS.length)],
      contrailTimer: CONTRAIL_SPAWN_INTERVAL + Math.random() * 0.5,
      contrails: [],
      navLightTimer: Math.random() * Math.PI * 2,
      lifetime: 60 + Math.random() * 30,
      state: 'taking_off',
      airportX: airport.x,
      airportY: airport.y,
      isVisible: true,
    });

    airplaneSpawnTimerRef.current = isMobile ? 1.4 + Math.random() * 1.8 : 0.4 + Math.random() * 1.2;
  }

  const updatedAirplanes: Airplane[] = [];
  airplanesRef.current.forEach(plane => {
    plane.navLightTimer += delta * 5;
    plane.contrailTimer -= delta;
    plane.lifetime -= delta;
    if (plane.lifetime <= 0) {
      return;
    }

    plane.contrails = plane.contrails
      .map(c => ({ ...c, age: c.age + delta }))
      .filter(c => c.age < CONTRAIL_MAX_AGE);

    if (plane.contrailTimer <= 0 && plane.altitude > 0.4) {
      plane.contrailTimer = CONTRAIL_SPAWN_INTERVAL + Math.random() * 0.3;
      plane.contrails.push({
        x: plane.x - Math.cos(plane.angle) * 10,
        y: plane.y - Math.sin(plane.angle) * 10,
        age: 0,
      });
    }

    switch (plane.state) {
      case 'taking_off': {
        plane.altitude = Math.min(1, plane.altitude + delta * 0.25);
        plane.speed = Math.min(160, plane.speed + delta * 30);
        plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
        if (plane.altitude >= 0.5) {
          plane.state = 'flying';
        }
        break;
      }
      case 'flying': {
        plane.x += Math.cos(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.y += Math.sin(plane.angle) * plane.speed * delta * speedMultiplier;
        plane.altitude = Math.min(1, plane.altitude + delta * 0.05);
        plane.angle += (Math.random() - 0.5) * delta * 0.2;

        const bounds = 1800;
        if (plane.x < -bounds || plane.x > bounds || plane.y < -bounds || plane.y > bounds || plane.lifetime < 10) {
          plane.state = 'landing';
          plane.targetAltitude = 0;
          const { screenX, screenY } = gridToScreen(plane.airportX, plane.airportY, 0, 0);
          const airportCenterX = screenX + TILE_WIDTH * 2;
          const airportCenterY = screenY + TILE_HEIGHT * 2;
          plane.angle = Math.atan2(airportCenterY - plane.y, airportCenterX - plane.x);
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
          return;
        }
        break;
      }
      default:
        break;
    }

    updatedAirplanes.push(plane);
  });

  airplanesRef.current = updatedAirplanes;
}

export function updateHelicopters(context: AerialSystemContext, delta: number): void {
  const {
    worldStateRef,
    helicoptersRef,
    helicopterIdRef,
    helicopterSpawnTimerRef,
    gridVersionRef,
    cachedPopulationRef,
    isMobile,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
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
  helicoptersRef.current.forEach(heli => {
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
          opacity: 1,
        });
      }
    }

    switch (heli.state) {
      case 'taking_off':
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
          return;
        }
        break;
      }
      default:
        break;
    }

    updatedHelicopters.push(heli);
  });

  helicoptersRef.current = updatedHelicopters;
}

export function drawAirplanes(context: AerialSystemContext, ctx: CanvasRenderingContext2D): void {
  const { worldStateRef, airplanesRef, hour, navLightFlashTimerRef } = context;
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  if (!currentGrid || currentGridSize <= 0 || airplanesRef.current.length === 0) return;

  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewBounds = {
    viewLeft: -currentOffset.x / currentZoom - 200,
    viewTop: -currentOffset.y / currentZoom - 200,
    viewRight: viewWidth - currentOffset.x / currentZoom + 200,
    viewBottom: viewHeight - currentOffset.y / currentZoom + 200,
  };

  drawAirplanesUtil(ctx, airplanesRef.current, viewBounds, hour, navLightFlashTimerRef.current);
  ctx.restore();
}

export function drawHelicopters(context: AerialSystemContext, ctx: CanvasRenderingContext2D): void {
  const { worldStateRef, helicoptersRef, hour, navLightFlashTimerRef } = context;
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  if (!currentGrid || currentGridSize <= 0 || helicoptersRef.current.length === 0) return;

  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewBounds = {
    viewLeft: -currentOffset.x / currentZoom - 100,
    viewTop: -currentOffset.y / currentZoom - 100,
    viewRight: viewWidth - currentOffset.x / currentZoom + 100,
    viewBottom: viewHeight - currentOffset.y / currentZoom + 100,
  };

  drawHelicoptersUtil(ctx, helicoptersRef.current, viewBounds, hour, navLightFlashTimerRef.current);
  ctx.restore();
}
