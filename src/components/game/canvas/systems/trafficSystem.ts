import type { MutableRefObject } from 'react';

import {
  TILE_WIDTH,
  TILE_HEIGHT,
  CAR_COLORS,
  PEDESTRIAN_SKIN_COLORS,
  PEDESTRIAN_SHIRT_COLORS,
  PEDESTRIAN_MIN_ZOOM,
  DIRECTION_META,
} from '@/components/game/constants';
import {
  isRoadTile,
  getDirectionOptions,
  pickNextDirection,
  findPathOnRoads,
  getDirectionToTile,
  gridToScreen,
} from '@/components/game/utils';
import {
  findResidentialBuildings,
  findPedestrianDestinations,
  findStations,
  findFires,
} from '@/components/game/gridFinders';
import { drawPedestrians as drawPedestriansUtil } from '@/components/game/drawPedestrians';
import type {
  Car,
  EmergencyVehicle,
  EmergencyVehicleType,
  Pedestrian,
  PedestrianDestType,
  WorldRenderState,
} from '@/components/game/types';
import type { BuildingType } from '@/types/game';

export type CrimeType = 'robbery' | 'burglary' | 'disturbance' | 'traffic';

export interface CrimeIncident {
  x: number;
  y: number;
  type: CrimeType;
  timeRemaining: number;
}

export interface TrafficSystemContext {
  worldStateRef: MutableRefObject<WorldRenderState>;
  carsRef: MutableRefObject<Car[]>;
  carIdRef: MutableRefObject<number>;
  carSpawnTimerRef: MutableRefObject<number>;
  pedestriansRef: MutableRefObject<Pedestrian[]>;
  pedestrianIdRef: MutableRefObject<number>;
  pedestrianSpawnTimerRef: MutableRefObject<number>;
  emergencyVehiclesRef: MutableRefObject<EmergencyVehicle[]>;
  emergencyVehicleIdRef: MutableRefObject<number>;
  emergencyDispatchTimerRef: MutableRefObject<number>;
  activeFiresRef: MutableRefObject<Set<string>>;
  activeCrimesRef: MutableRefObject<Set<string>>;
  activeCrimeIncidentsRef: MutableRefObject<Map<string, CrimeIncident>>;
  crimeSpawnTimerRef: MutableRefObject<number>;
  cachedRoadTileCountRef: MutableRefObject<{ count: number; gridVersion: number }>;
  gridVersionRef: MutableRefObject<number>;
  incidentAnimTimeRef: MutableRefObject<number>;
  policeCoverage: number[][];
  population: number;
  isMobile: boolean;
}

const CRIME_TYPES: CrimeType[] = ['robbery', 'burglary', 'disturbance', 'traffic'];

function spawnRandomCar(context: TrafficSystemContext): boolean {
  const { worldStateRef, carsRef, carIdRef } = context;
  const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  for (let attempt = 0; attempt < 20; attempt++) {
    const tileX = Math.floor(Math.random() * currentGridSize);
    const tileY = Math.floor(Math.random() * currentGridSize);
    if (!isRoadTile(currentGrid, currentGridSize, tileX, tileY)) continue;

    const options = getDirectionOptions(currentGrid, currentGridSize, tileX, tileY);
    if (options.length === 0) continue;

    const direction = options[Math.floor(Math.random() * options.length)];
    carsRef.current.push({
      id: carIdRef.current++,
      tileX,
      tileY,
      direction,
      progress: Math.random() * 0.8,
      speed: (0.35 + Math.random() * 0.35) * 0.7,
      age: 0,
      maxAge: 1800 + Math.random() * 2700,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      laneOffset: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3),
    });
    return true;
  }

  return false;
}

function spawnPedestrian(context: TrafficSystemContext): boolean {
  const { worldStateRef, pedestriansRef, pedestrianIdRef } = context;
  const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  const residentials = findResidentialBuildings(currentGrid, currentGridSize);
  if (residentials.length === 0) return false;

  const destinations = findPedestrianDestinations(currentGrid, currentGridSize);
  if (destinations.length === 0) return false;

  const home = residentials[Math.floor(Math.random() * residentials.length)];
  const dest = destinations[Math.floor(Math.random() * destinations.length)];

  const path = findPathOnRoads(currentGrid, currentGridSize, home.x, home.y, dest.x, dest.y, true);
  if (!path || path.length < 2) return false;

  const startIndex = Math.floor(Math.random() * (path.length - 1));
  const start = path[startIndex];
  const next = path[startIndex + 1];
  const dir = getDirectionToTile(start.x, start.y, next.x, next.y);
  if (!dir) return false;

  pedestriansRef.current.push({
    id: pedestrianIdRef.current++,
    tileX: start.x,
    tileY: start.y,
    direction: dir,
    progress: Math.random(),
    speed: 0.12 + Math.random() * 0.08,
    pathIndex: startIndex,
    age: 0,
    maxAge: 60 + Math.random() * 90,
    skinColor: PEDESTRIAN_SKIN_COLORS[Math.floor(Math.random() * PEDESTRIAN_SKIN_COLORS.length)],
    shirtColor: PEDESTRIAN_SHIRT_COLORS[Math.floor(Math.random() * PEDESTRIAN_SHIRT_COLORS.length)],
    walkOffset: Math.random() * Math.PI * 2,
    sidewalkSide: Math.random() < 0.5 ? 'left' : 'right',
    destType: dest.type as PedestrianDestType,
    homeX: home.x,
    homeY: home.y,
    destX: dest.x,
    destY: dest.y,
    returningHome: startIndex >= path.length - 1,
    path,
  });

  return true;
}

function getCrimeIncidents(context: TrafficSystemContext): { x: number; y: number }[] {
  return Array.from(context.activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
}

function dispatchEmergencyVehicle(
  context: TrafficSystemContext,
  type: EmergencyVehicleType,
  stationX: number,
  stationY: number,
  targetX: number,
  targetY: number,
): boolean {
  const {
    worldStateRef,
    emergencyVehiclesRef,
    emergencyVehicleIdRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) return false;

  const path = findPathOnRoads(currentGrid, currentGridSize, stationX, stationY, targetX, targetY);
  if (!path || path.length < 1) return false;

  const startTile = path[0];
  const nextTile = path[1] || path[0];
  const direction = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
  if (!direction) return false;

  emergencyVehiclesRef.current.push({
    id: emergencyVehicleIdRef.current++,
    type,
    tileX: startTile.x,
    tileY: startTile.y,
    direction,
    progress: 0,
    speed: type === 'fire_truck' ? 0.8 : 0.9,
    state: 'dispatching',
    stationX,
    stationY,
    targetX,
    targetY,
    path,
    pathIndex: 0,
    respondTime: 0,
    laneOffset: 0,
    flashTimer: 0,
  });

  const targetKey = `${targetX},${targetY}`;
  if (type === 'fire_truck') {
    activeFiresRef.current.add(targetKey);
  } else {
    activeCrimesRef.current.add(targetKey);
    activeCrimeIncidentsRef.current.get(targetKey);
  }

  return true;
}

function updateEmergencyDispatch(context: TrafficSystemContext): void {
  const {
    worldStateRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    emergencyVehiclesRef,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

  const fires = findFires(currentGrid, currentGridSize);
  const fireStations = findStations(currentGrid, currentGridSize, 'fire_station');

  fires.forEach(fire => {
    const key = `${fire.x},${fire.y}`;
    if (activeFiresRef.current.has(key)) return;

    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;
    fireStations.forEach(station => {
      const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    });

    if (nearestStation) {
      dispatchEmergencyVehicle(context, 'fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y);
    }
  });

  const crimes = getCrimeIncidents(context);
  const policeStations = findStations(currentGrid, currentGridSize, 'police_station');
  let dispatched = 0;
  const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));

  crimes.forEach(crime => {
    if (dispatched >= maxDispatchPerCheck) return;
    const key = `${crime.x},${crime.y}`;
    if (activeCrimesRef.current.has(key)) return;

    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;
    policeStations.forEach(station => {
      const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    });

    if (nearestStation) {
      const success = dispatchEmergencyVehicle(
        context,
        'police_car',
        nearestStation.x,
        nearestStation.y,
        crime.x,
        crime.y,
      );
      if (success) dispatched++;
    }
  });
}

export function spawnCrimeIncidents(context: TrafficSystemContext, delta: number): void {
  const {
    worldStateRef,
    crimeSpawnTimerRef,
    activeCrimeIncidentsRef,
    policeCoverage,
    population,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
  crimeSpawnTimerRef.current -= delta * speedMultiplier;
  if (crimeSpawnTimerRef.current > 0) return;
  crimeSpawnTimerRef.current = 3 + Math.random() * 2;

  const eligibleTiles: { x: number; y: number; policeCoverage: number }[] = [];
  for (let y = 0; y < currentGridSize; y++) {
    for (let x = 0; x < currentGridSize; x++) {
      const tile = currentGrid[y][x];
      const isBuilding =
        tile.building.type !== 'grass' &&
        tile.building.type !== 'water' &&
        tile.building.type !== 'road' &&
        tile.building.type !== 'tree' &&
        tile.building.type !== 'empty';
      const hasActivity = (tile.building.population || 0) > 0 || (tile.building.jobs || 0) > 0;
      if (!isBuilding || !hasActivity) continue;

      const coverageRow = policeCoverage?.[y];
      const coverage = coverageRow ? coverageRow[x] ?? 0 : 0;
      eligibleTiles.push({ x, y, policeCoverage: coverage });
    }
  }

  if (eligibleTiles.length === 0) return;

  const avgCoverage =
    eligibleTiles.reduce((sum, tile) => sum + tile.policeCoverage, 0) / eligibleTiles.length;
  const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;
  const maxActiveCrimes = Math.max(2, Math.floor(population / 500));
  if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;

  const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;
  for (let i = 0; i < crimesToSpawn; i++) {
    if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
    if (Math.random() > baseChance) continue;

    const weightedTiles = eligibleTiles.filter(tile => {
      const key = `${tile.x},${tile.y}`;
      if (activeCrimeIncidentsRef.current.has(key)) return false;
      const weight = Math.max(0.1, 1 - tile.policeCoverage / 100);
      return Math.random() < weight;
    });
    if (weightedTiles.length === 0) continue;

    const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
    const key = `${target.x},${target.y}`;
    const crimeType = CRIME_TYPES[Math.floor(Math.random() * CRIME_TYPES.length)];
    const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;

    activeCrimeIncidentsRef.current.set(key, {
      x: target.x,
      y: target.y,
      type: crimeType,
      timeRemaining: duration,
    });
  }
}

export function updateCrimeIncidents(context: TrafficSystemContext, delta: number): void {
  const { worldStateRef, activeCrimeIncidentsRef, activeCrimesRef } = context;
  const { speed: currentSpeed } = worldStateRef.current;
  if (currentSpeed === 0) return;

  const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
  const keysToDelete: string[] = [];

  activeCrimeIncidentsRef.current.forEach((crime, key) => {
    if (activeCrimesRef.current.has(key)) return;
    const newTime = crime.timeRemaining - delta * speedMultiplier;
    if (newTime <= 0) {
      keysToDelete.push(key);
    } else {
      activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTime });
    }
  });

  keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
}

export function updateEmergencyVehicles(context: TrafficSystemContext, delta: number): void {
  const {
    worldStateRef,
    emergencyVehiclesRef,
    activeFiresRef,
    activeCrimesRef,
    activeCrimeIncidentsRef,
    emergencyDispatchTimerRef,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) {
    emergencyVehiclesRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
  emergencyDispatchTimerRef.current -= delta;
  if (emergencyDispatchTimerRef.current <= 0) {
    updateEmergencyDispatch(context);
    emergencyDispatchTimerRef.current = 1.5;
  }

  const updatedVehicles: EmergencyVehicle[] = [];
  for (const vehicle of [...emergencyVehiclesRef.current]) {
    vehicle.flashTimer += delta * 8;

    const removeVehicle = () => {
      const key = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        activeFiresRef.current.delete(key);
      } else {
        activeCrimesRef.current.delete(key);
        activeCrimeIncidentsRef.current.delete(key);
      }
    };

    if (vehicle.state === 'responding') {
      if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
        removeVehicle();
        continue;
      }

      vehicle.respondTime += delta * speedMultiplier;
      const respondDuration = vehicle.type === 'fire_truck' ? 8 : 5;
      if (vehicle.respondTime >= respondDuration) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'police_car') {
          activeCrimeIncidentsRef.current.delete(targetKey);
        }

        const returnPath = findPathOnRoads(
          currentGrid,
          currentGridSize,
          vehicle.tileX,
          vehicle.tileY,
          vehicle.stationX,
          vehicle.stationY,
        );

        if (returnPath && returnPath.length >= 2) {
          vehicle.path = returnPath;
          vehicle.pathIndex = 0;
          vehicle.state = 'returning';
          vehicle.progress = 0;

          const nextTile = returnPath[1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        } else {
          removeVehicle();
          continue;
        }
      }

      updatedVehicles.push(vehicle);
      continue;
    }

    if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
      removeVehicle();
      continue;
    }

    if (
      vehicle.tileX < 0 ||
      vehicle.tileX >= currentGridSize ||
      vehicle.tileY < 0 ||
      vehicle.tileY >= currentGridSize
    ) {
      removeVehicle();
      continue;
    }

    vehicle.progress += vehicle.speed * delta * speedMultiplier;
    let shouldRemove = false;
    if (vehicle.path.length === 1 && vehicle.state === 'dispatching') {
      vehicle.state = 'responding';
      vehicle.respondTime = 0;
      vehicle.progress = 0;
      updatedVehicles.push(vehicle);
      continue;
    }

    while (vehicle.progress >= 1 && vehicle.pathIndex < vehicle.path.length - 1) {
      vehicle.pathIndex++;
      vehicle.progress -= 1;

      const currentTile = vehicle.path[vehicle.pathIndex];
      if (
        currentTile.x < 0 ||
        currentTile.x >= currentGridSize ||
        currentTile.y < 0 ||
        currentTile.y >= currentGridSize
      ) {
        shouldRemove = true;
        break;
      }

      vehicle.tileX = currentTile.x;
      vehicle.tileY = currentTile.y;

      if (vehicle.pathIndex >= vehicle.path.length - 1) {
        if (vehicle.state === 'dispatching') {
          vehicle.state = 'responding';
          vehicle.respondTime = 0;
          vehicle.progress = 0;
        } else if (vehicle.state === 'returning') {
          shouldRemove = true;
        }
        break;
      }

      if (vehicle.pathIndex + 1 < vehicle.path.length) {
        const nextTile = vehicle.path[vehicle.pathIndex + 1];
        const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
        if (dir) vehicle.direction = dir;
      }
    }

    if (shouldRemove) {
      removeVehicle();
      continue;
    }

    updatedVehicles.push(vehicle);
  }

  emergencyVehiclesRef.current = updatedVehicles;
}

export function updateCars(context: TrafficSystemContext, delta: number): void {
  const { worldStateRef, carsRef, carSpawnTimerRef } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
  if (!currentGrid || currentGridSize <= 0) {
    carsRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
  const baseMaxCars = 160;
  const maxCars = Math.min(baseMaxCars, Math.max(16, Math.floor(currentGridSize * 2)));
  carSpawnTimerRef.current -= delta;

  if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
    if (spawnRandomCar(context)) {
      carSpawnTimerRef.current = 0.9 + Math.random() * 1.3;
    } else {
      carSpawnTimerRef.current = 0.5;
    }
  }

  const updatedCars: Car[] = [];
  for (const car of [...carsRef.current]) {
    let alive = true;
    car.age += delta;
    if (car.age > car.maxAge) continue;
    if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) continue;

    car.progress += car.speed * delta * speedMultiplier;
    let guard = 0;
    while (car.progress >= 1 && guard < 4) {
      guard++;
      const meta = DIRECTION_META[car.direction];
      car.tileX += meta.step.x;
      car.tileY += meta.step.y;

      if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
        alive = false;
        break;
      }

      car.progress -= 1;
      const nextDirection = pickNextDirection(car.direction, currentGrid, currentGridSize, car.tileX, car.tileY);
      if (!nextDirection) {
        alive = false;
        break;
      }
      car.direction = nextDirection;
    }

    if (alive) updatedCars.push(car);
  }

  carsRef.current = updatedCars;
}

export function updatePedestrians(context: TrafficSystemContext, delta: number): void {
  const {
    worldStateRef,
    pedestriansRef,
    gridVersionRef,
    cachedRoadTileCountRef,
    isMobile,
  } = context;
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed, zoom: currentZoom } =
    worldStateRef.current;

  const minZoom = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
  if (currentZoom < minZoom || !currentGrid || currentGridSize <= 0) {
    pedestriansRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
  const currentGridVersion = gridVersionRef.current;
  let roadTileCount: number;
  if (cachedRoadTileCountRef.current.gridVersion === currentGridVersion) {
    roadTileCount = cachedRoadTileCountRef.current.count;
  } else {
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

  const maxPedestrians = isMobile
    ? Math.min(50, Math.max(20, Math.floor(roadTileCount * 0.8)))
    : Math.max(200, roadTileCount * 3);

  context.pedestrianSpawnTimerRef.current -= delta;
  if (pedestriansRef.current.length < maxPedestrians && context.pedestrianSpawnTimerRef.current <= 0) {
    let spawnedCount = 0;
    const spawnBatch = isMobile
      ? Math.min(8, Math.max(3, Math.floor(roadTileCount / 25)))
      : Math.min(50, Math.max(20, Math.floor(roadTileCount / 10)));
    for (let i = 0; i < spawnBatch; i++) {
      if (spawnPedestrian(context)) {
        spawnedCount++;
      }
    }
    context.pedestrianSpawnTimerRef.current =
      spawnedCount > 0 ? (isMobile ? 0.15 : 0.02) : (isMobile ? 0.08 : 0.01);
  }

  const updatedPedestrians: Pedestrian[] = [];
  for (const ped of [...pedestriansRef.current]) {
    let alive = true;
    ped.age += delta;
    if (ped.age > ped.maxAge) continue;

    ped.progress += ped.speed * delta * speedMultiplier;
    while (ped.progress >= 1 && ped.pathIndex < ped.path.length - 1) {
      ped.pathIndex++;
      ped.progress -= 1;

      const currentTile = ped.path[ped.pathIndex];
      const nextTile = ped.path[ped.pathIndex + 1];
      ped.tileX = currentTile.x;
      ped.tileY = currentTile.y;

      if (nextTile) {
        const dir = getDirectionToTile(currentTile.x, currentTile.y, nextTile.x, nextTile.y);
        if (dir) ped.direction = dir;
      } else if (ped.returningHome) {
        alive = false;
        break;
      } else {
        const returnPath = findPathOnRoads(
          currentGrid,
          currentGridSize,
          ped.tileX,
          ped.tileY,
          ped.homeX,
          ped.homeY,
          true,
        );
        if (returnPath && returnPath.length >= 2) {
          ped.returningHome = true;
          ped.path = returnPath;
          ped.pathIndex = 0;
          ped.progress = 0;
          ped.tileX = returnPath[0].x;
          ped.tileY = returnPath[0].y;
          if (returnPath.length > 1) {
            const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, returnPath[1].x, returnPath[1].y);
            if (dir) ped.direction = dir;
          }
        } else {
          alive = false;
        }
      }
    }

    if (alive) updatedPedestrians.push(ped);
  }

  pedestriansRef.current = updatedPedestrians;
}

export function drawCars(context: TrafficSystemContext, ctx: CanvasRenderingContext2D): void {
  const { worldStateRef, carsRef } = context;
  const { offset, zoom, grid, gridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!grid || gridSize <= 0 || carsRef.current.length === 0) return;

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

  const isCarBehindBuilding = (carTileX: number, carTileY: number): boolean => {
    const carDepth = carTileX + carTileY;
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const checkX = carTileX + dx;
        const checkY = carTileY + dy;
        if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) continue;
        const tile = grid[checkY]?.[checkX];
        if (!tile) continue;
        const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
        if (skipTypes.includes(tile.building.type)) continue;
        if (checkX + checkY > carDepth) return true;
      }
    }
    return false;
  };

  carsRef.current.forEach(car => {
    const { screenX, screenY } = gridToScreen(car.tileX, car.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[car.direction];
    const carX = centerX + meta.vec.dx * car.progress + meta.normal.nx * car.laneOffset;
    const carY = centerY + meta.vec.dy * car.progress + meta.normal.ny * car.laneOffset;

    if (carX < viewLeft - 40 || carX > viewRight + 40 || carY < viewTop - 60 || carY > viewBottom + 60) {
      return;
    }
    if (isCarBehindBuilding(car.tileX, car.tileY)) return;

    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(meta.angle);
    const scale = 0.7;

    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -5 * scale);
    ctx.lineTo(10 * scale, -5 * scale);
    ctx.lineTo(12 * scale, 0);
    ctx.lineTo(10 * scale, 5 * scale);
    ctx.lineTo(-10 * scale, 5 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);

    ctx.fillStyle = '#111827';
    ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);
    ctx.restore();
  });

  ctx.restore();
}

export function drawPedestrians(context: TrafficSystemContext, ctx: CanvasRenderingContext2D): void {
  const { worldStateRef, pedestriansRef, isMobile } = context;
  const { offset, zoom, grid, gridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  const minZoomForPedestrians = isMobile ? 0.8 : PEDESTRIAN_MIN_ZOOM;
  if (zoom < minZoomForPedestrians) return;
  if (!grid || gridSize <= 0 || pedestriansRef.current.length === 0) return;

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewBounds = {
    viewLeft: -offset.x / zoom - TILE_WIDTH,
    viewTop: -offset.y / zoom - TILE_HEIGHT * 2,
    viewRight: viewWidth - offset.x / zoom + TILE_WIDTH,
    viewBottom: viewHeight - offset.y / zoom + TILE_HEIGHT * 2,
  };

  drawPedestriansUtil(ctx, pedestriansRef.current, grid, gridSize, viewBounds);
  ctx.restore();
}

export function drawEmergencyVehicles(context: TrafficSystemContext, ctx: CanvasRenderingContext2D): void {
  const { worldStateRef, emergencyVehiclesRef } = context;
  const { offset, zoom, grid, gridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  if (!grid || gridSize <= 0 || emergencyVehiclesRef.current.length === 0) return;

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 2;

  emergencyVehiclesRef.current.forEach(vehicle => {
    const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[vehicle.direction];
    const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
    const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;

    if (
      vehicleX < viewLeft - 40 ||
      vehicleX > viewRight + 40 ||
      vehicleY < viewTop - 60 ||
      vehicleY > viewBottom + 60
    ) {
      return;
    }

    ctx.save();
    ctx.translate(vehicleX, vehicleY);
    ctx.rotate(meta.angle);

    const scale = 0.6;
    const bodyColor = vehicle.type === 'fire_truck' ? '#dc2626' : '#1e40af';
    const length = vehicle.type === 'fire_truck' ? 14 : 11;

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(-length * scale, -5 * scale);
    ctx.lineTo(length * scale, -5 * scale);
    ctx.lineTo((length + 2) * scale, 0);
    ctx.lineTo(length * scale, 5 * scale);
    ctx.lineTo(-length * scale, 5 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = vehicle.type === 'fire_truck' ? '#fbbf24' : '#ffffff';
    ctx.fillRect(-length * scale * 0.5, -3 * scale, length * scale, 6 * scale * 0.3);

    ctx.fillStyle = 'rgba(200, 220, 255, 0.7)';
    ctx.fillRect(-2 * scale, -3 * scale, 5 * scale, 6 * scale);

    const flashOn = Math.sin(vehicle.flashTimer) > 0;
    const flashOn2 = Math.sin(vehicle.flashTimer + Math.PI) > 0;

    if (vehicle.type === 'fire_truck') {
      ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
      ctx.fillRect(-6 * scale, -7 * scale, 3 * scale, 3 * scale);
      ctx.fillStyle = flashOn2 ? '#ff0000' : '#880000';
      ctx.fillRect(3 * scale, -7 * scale, 3 * scale, 3 * scale);
      if (flashOn || flashOn2) {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
        ctx.shadowBlur = 0;
      }
    } else {
      ctx.fillStyle = flashOn ? '#ff0000' : '#880000';
      ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
      ctx.fillStyle = flashOn2 ? '#0066ff' : '#003388';
      ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);
      if (flashOn || flashOn2) {
        ctx.shadowColor = flashOn ? '#ff0000' : '#0066ff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = flashOn ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 100, 255, 0.4)';
        ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
        ctx.shadowBlur = 0;
      }
    }

    ctx.fillStyle = '#111827';
    ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);
    ctx.restore();
  });

  ctx.restore();
}

export function drawIncidentIndicators(
  context: TrafficSystemContext,
  ctx: CanvasRenderingContext2D,
  delta: number,
): void {
  const { worldStateRef, activeCrimeIncidentsRef, incidentAnimTimeRef } = context;
  const { offset, zoom, grid, gridSize } = worldStateRef.current;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  if (!grid || gridSize <= 0) return;

  incidentAnimTimeRef.current += delta;
  const animTime = incidentAnimTimeRef.current;

  ctx.save();
  ctx.scale(dpr * zoom, dpr * zoom);
  ctx.translate(offset.x / zoom, offset.y / zoom);

  const viewWidth = canvas.width / (dpr * zoom);
  const viewHeight = canvas.height / (dpr * zoom);
  const viewLeft = -offset.x / zoom - TILE_WIDTH * 2;
  const viewTop = -offset.y / zoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - offset.x / zoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - offset.y / zoom + TILE_HEIGHT * 4;

  activeCrimeIncidentsRef.current.forEach(crime => {
    const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
      return;
    }

    const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
    const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;

    ctx.beginPath();
    ctx.arc(centerX, centerY - 12, 16 + outerPulse * 10, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY - 15);
    ctx.fillStyle = `rgba(37, 99, 235, ${0.85 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(9, 5);
    ctx.lineTo(-9, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(191, 219, 254, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(-1.5, -3, 3, 7);
    ctx.fillRect(-1.5, 5, 3, 2);
    ctx.restore();
  });

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = grid[y][x];
      if (!tile.building.onFire) continue;
      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) continue;

      const pulse = Math.sin(animTime * 6) * 0.3 + 0.7;
      const outerPulse = Math.sin(animTime * 4) * 0.5 + 0.5;

      ctx.beginPath();
      ctx.arc(centerX, centerY - 12, 22 + outerPulse * 8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 * (1 - outerPulse)})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY - 15);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.9 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, 5);
      ctx.lineTo(-8, 5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(252, 165, 165, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(2.5, 0, 2, 2.5);
      ctx.quadraticCurveTo(0.5, 1.5, 0, 2.5);
      ctx.quadraticCurveTo(-0.5, 1.5, -2, 2.5);
      ctx.quadraticCurveTo(-2.5, 0, 0, -3);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}
