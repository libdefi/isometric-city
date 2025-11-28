// Vehicle System - Cars and Emergency Vehicles
// Handles spawning, updating, and drawing of regular cars and emergency vehicles

import { Tile, BuildingType } from '@/types/game';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  Car,
  CarDirection,
  EmergencyVehicle,
  EmergencyVehicleType,
  WorldRenderState,
} from './types';
import {
  CAR_COLORS,
  DIRECTION_META,
} from './constants';
import {
  isRoadTile,
  getDirectionOptions,
  pickNextDirection,
  findPathOnRoads,
  getDirectionToTile,
  gridToScreen,
} from './utils';

// ============================================================================
// Car Spawning
// ============================================================================

/**
 * Spawn a random car on the road network
 * Returns true if a car was spawned, false otherwise
 */
export function spawnRandomCar(
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>,
  carIdRef: React.MutableRefObject<number>
): boolean {
  const { grid: currentGrid, gridSize: currentGridSize } = worldState;
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

// ============================================================================
// Car Updates
// ============================================================================

/**
 * Update all cars - movement, aging, cleanup
 */
export function updateCars(
  delta: number,
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>,
  carIdRef: React.MutableRefObject<number>,
  carSpawnTimerRef: React.MutableRefObject<number>,
  isMobile: boolean
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  if (!currentGrid || currentGridSize <= 0) {
    carsRef.current = [];
    return;
  }
  
  // Speed multiplier: 0 = paused, 1 = normal, 2 = fast (2x), 3 = very fast (4x)
  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
  
  // Reduce max cars on mobile for better performance
  const baseMaxCars = 160;
  const maxCars = Math.min(baseMaxCars, Math.max(16, Math.floor(currentGridSize * 2)));
  carSpawnTimerRef.current -= delta;
  if (carsRef.current.length < maxCars && carSpawnTimerRef.current <= 0) {
    if (spawnRandomCar(worldState, carsRef, carIdRef)) {
      carSpawnTimerRef.current = 0.9 + Math.random() * 1.3;
    } else {
      carSpawnTimerRef.current = 0.5;
    }
  }
  
  const updatedCars: Car[] = [];
  for (const car of [...carsRef.current]) {
    let alive = true;
    
    car.age += delta;
    if (car.age > car.maxAge) {
      continue;
    }
    
    if (!isRoadTile(currentGrid, currentGridSize, car.tileX, car.tileY)) {
      continue;
    }
    
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
    
    if (alive) {
      updatedCars.push(car);
    }
  }
  
  carsRef.current = updatedCars;
}

// ============================================================================
// Car Drawing
// ============================================================================

/**
 * Check if a car is behind a building (should not be drawn)
 */
function isCarBehindBuilding(
  carTileX: number,
  carTileY: number,
  grid: Tile[][],
  gridSize: number
): boolean {
  const carDepth = carTileX + carTileY;
  
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      
      const checkX = carTileX + dx;
      const checkY = carTileY + dy;
      
      if (checkX < 0 || checkY < 0 || checkX >= gridSize || checkY >= gridSize) {
        continue;
      }
      
      const tile = grid[checkY]?.[checkX];
      if (!tile) continue;
      
      const buildingType = tile.building.type;
      const skipTypes: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
      if (skipTypes.includes(buildingType)) {
        continue;
      }
      
      const buildingDepth = checkX + checkY;
      if (buildingDepth > carDepth) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Draw all cars on the canvas
 */
export function drawCars(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  carsRef: React.MutableRefObject<Car[]>
): void {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!currentGrid || currentGridSize <= 0 || carsRef.current.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
  const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
  
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
    
    if (isCarBehindBuilding(car.tileX, car.tileY, currentGrid, currentGridSize)) {
      return;
    }
    
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
    
    // Windshield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-4 * scale, -2.8 * scale, 7 * scale, 5.6 * scale);
    
    // Rear
    ctx.fillStyle = '#111827';
    ctx.fillRect(-10 * scale, -4 * scale, 2.4 * scale, 8 * scale);
    
    ctx.restore();
  });
  
  ctx.restore();
}

// ============================================================================
// Emergency Vehicle Dispatch
// ============================================================================

/**
 * Dispatch an emergency vehicle from station to target
 */
export function dispatchEmergencyVehicle(
  type: EmergencyVehicleType,
  stationX: number,
  stationY: number,
  targetX: number,
  targetY: number,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyVehicleIdRef: React.MutableRefObject<number>
): boolean {
  const { grid: currentGrid, gridSize: currentGridSize } = worldState;
  if (!currentGrid || currentGridSize <= 0) return false;

  const path = findPathOnRoads(currentGrid, currentGridSize, stationX, stationY, targetX, targetY);
  if (!path || path.length === 0) return false;

  const startTile = path[0];
  let direction: CarDirection = 'south';
  
  if (path.length >= 2) {
    const nextTile = path[1];
    const dir = getDirectionToTile(startTile.x, startTile.y, nextTile.x, nextTile.y);
    if (dir) direction = dir;
  }

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

  return true;
}

// ============================================================================
// Emergency Vehicle Updates
// ============================================================================

/**
 * Update emergency vehicle dispatch logic - find fires/crimes and dispatch vehicles
 */
export function updateEmergencyDispatch(
  worldState: WorldRenderState,
  findFires: () => { x: number; y: number }[],
  findCrimeIncidents: () => { x: number; y: number }[],
  findStations: (type: 'fire_station' | 'police_station') => { x: number; y: number }[],
  activeFiresRef: React.MutableRefObject<Set<string>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyVehicleIdRef: React.MutableRefObject<number>
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;
  
  const fires = findFires();
  const fireStations = findStations('fire_station');
  
  for (const fire of fires) {
    const fireKey = `${fire.x},${fire.y}`;
    if (activeFiresRef.current.has(fireKey)) continue;
    
    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;
    
    for (const station of fireStations) {
      const dist = Math.abs(station.x - fire.x) + Math.abs(station.y - fire.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }
    
    if (nearestStation) {
      if (dispatchEmergencyVehicle('fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y, worldState, emergencyVehiclesRef, emergencyVehicleIdRef)) {
        activeFiresRef.current.add(fireKey);
      }
    }
  }

  const crimes = findCrimeIncidents();
  const policeStations = findStations('police_station');
  
  let dispatched = 0;
  const maxDispatchPerCheck = Math.max(3, Math.min(6, policeStations.length * 2));
  for (const crime of crimes) {
    if (dispatched >= maxDispatchPerCheck) break;
    
    const crimeKey = `${crime.x},${crime.y}`;
    if (activeCrimesRef.current.has(crimeKey)) continue;
    
    let nearestStation: { x: number; y: number } | null = null;
    let nearestDist = Infinity;
    
    for (const station of policeStations) {
      const dist = Math.abs(station.x - crime.x) + Math.abs(station.y - crime.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStation = station;
      }
    }
    
    if (nearestStation) {
      if (dispatchEmergencyVehicle('police_car', nearestStation.x, nearestStation.y, crime.x, crime.y, worldState, emergencyVehiclesRef, emergencyVehicleIdRef)) {
        activeCrimesRef.current.add(crimeKey);
        dispatched++;
      }
    }
  }
}

/**
 * Update emergency vehicles movement and state
 */
export function updateEmergencyVehicles(
  delta: number,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>,
  emergencyDispatchTimerRef: React.MutableRefObject<number>,
  activeFiresRef: React.MutableRefObject<Set<string>>,
  activeCrimesRef: React.MutableRefObject<Set<string>>,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, { x: number; y: number; type: string; timeRemaining: number }>>,
  updateDispatchFn: () => void
): void {
  const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldState;
  if (!currentGrid || currentGridSize <= 0) {
    emergencyVehiclesRef.current = [];
    return;
  }

  const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
  
  emergencyDispatchTimerRef.current -= delta;
  if (emergencyDispatchTimerRef.current <= 0) {
    updateDispatchFn();
    emergencyDispatchTimerRef.current = 1.5;
  }

  const updatedVehicles: EmergencyVehicle[] = [];
  
  for (const vehicle of [...emergencyVehiclesRef.current]) {
    vehicle.flashTimer += delta * 8;
    
    if (vehicle.state === 'responding') {
      if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
        const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
        if (vehicle.type === 'fire_truck') {
          activeFiresRef.current.delete(targetKey);
        } else {
          activeCrimesRef.current.delete(targetKey);
          activeCrimeIncidentsRef.current.delete(targetKey);
        }
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
          currentGrid, currentGridSize,
          vehicle.tileX, vehicle.tileY,
          vehicle.stationX, vehicle.stationY
        );
        
        if (returnPath && returnPath.length >= 2) {
          vehicle.path = returnPath;
          vehicle.pathIndex = 0;
          vehicle.state = 'returning';
          vehicle.progress = 0;
          
          const nextTile = returnPath[1];
          const dir = getDirectionToTile(vehicle.tileX, vehicle.tileY, nextTile.x, nextTile.y);
          if (dir) vehicle.direction = dir;
        } else if (returnPath && returnPath.length === 1) {
          if (vehicle.type === 'fire_truck') {
            activeFiresRef.current.delete(targetKey);
          } else {
            activeCrimesRef.current.delete(targetKey);
          }
          continue;
        } else {
          if (vehicle.type === 'fire_truck') {
            activeFiresRef.current.delete(targetKey);
          } else {
            activeCrimesRef.current.delete(targetKey);
          }
          continue;
        }
      }
      
      updatedVehicles.push(vehicle);
      continue;
    }
    
    if (!isRoadTile(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY)) {
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        activeFiresRef.current.delete(targetKey);
      } else {
        activeCrimesRef.current.delete(targetKey);
        activeCrimeIncidentsRef.current.delete(targetKey);
      }
      continue;
    }
    
    if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize || 
        vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        activeFiresRef.current.delete(targetKey);
      } else {
        activeCrimesRef.current.delete(targetKey);
        activeCrimeIncidentsRef.current.delete(targetKey);
      }
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
      
      if (currentTile.x < 0 || currentTile.x >= currentGridSize || 
          currentTile.y < 0 || currentTile.y >= currentGridSize) {
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
      const targetKey = `${vehicle.targetX},${vehicle.targetY}`;
      if (vehicle.type === 'fire_truck') {
        activeFiresRef.current.delete(targetKey);
      } else {
        activeCrimesRef.current.delete(targetKey);
        activeCrimeIncidentsRef.current.delete(targetKey);
      }
      continue;
    }
    
    updatedVehicles.push(vehicle);
  }
  
  emergencyVehiclesRef.current = updatedVehicles;
}

// ============================================================================
// Emergency Vehicle Drawing
// ============================================================================

/**
 * Draw emergency vehicles (fire trucks and police cars)
 */
export function drawEmergencyVehicles(
  ctx: CanvasRenderingContext2D,
  worldState: WorldRenderState,
  emergencyVehiclesRef: React.MutableRefObject<EmergencyVehicle[]>
): void {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0 || emergencyVehiclesRef.current.length === 0) {
    return;
  }
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
  const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
  const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
  
  emergencyVehiclesRef.current.forEach(vehicle => {
    const { screenX, screenY } = gridToScreen(vehicle.tileX, vehicle.tileY, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[vehicle.direction];
    const vehicleX = centerX + meta.vec.dx * vehicle.progress + meta.normal.nx * vehicle.laneOffset;
    const vehicleY = centerY + meta.vec.dy * vehicle.progress + meta.normal.ny * vehicle.laneOffset;
    
    if (vehicleX < viewLeft - 40 || vehicleX > viewRight + 40 || vehicleY < viewTop - 60 || vehicleY > viewBottom + 60) {
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

// ============================================================================
// Incident Indicators
// ============================================================================

/**
 * Draw incident indicators (fires and crimes) with pulsing effect
 */
export function drawIncidentIndicators(
  ctx: CanvasRenderingContext2D,
  delta: number,
  worldState: WorldRenderState,
  activeCrimeIncidentsRef: React.MutableRefObject<Map<string, { x: number; y: number; type: string; timeRemaining: number }>>,
  incidentAnimTimeRef: React.MutableRefObject<number>
): void {
  const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldState;
  const canvas = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;
  
  if (!currentGrid || currentGridSize <= 0) return;
  
  incidentAnimTimeRef.current += delta;
  const animTime = incidentAnimTimeRef.current;
  
  ctx.save();
  ctx.scale(dpr * currentZoom, dpr * currentZoom);
  ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);
  
  const viewWidth = canvas.width / (dpr * currentZoom);
  const viewHeight = canvas.height / (dpr * currentZoom);
  const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH * 2;
  const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 4;
  const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH * 2;
  const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 4;
  
  // Draw crime incident indicators
  activeCrimeIncidentsRef.current.forEach((crime) => {
    const { screenX, screenY } = gridToScreen(crime.x, crime.y, 0, 0);
    const centerX = screenX + TILE_WIDTH / 2;
    const centerY = screenY + TILE_HEIGHT / 2;
    
    if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
      return;
    }
    
    const pulse = Math.sin(animTime * 4) * 0.3 + 0.7;
    const outerPulse = Math.sin(animTime * 3) * 0.5 + 0.5;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY - 8, 18 + outerPulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.25 * (1 - outerPulse)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const gradient = ctx.createRadialGradient(centerX, centerY - 8, 0, centerX, centerY - 8, 14 * pulse);
    gradient.addColorStop(0, `rgba(59, 130, 246, ${0.5 * pulse})`);
    gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.2 * pulse})`);
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.beginPath();
    ctx.arc(centerX, centerY - 8, 14 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.save();
    ctx.translate(centerX, centerY - 12);
    
    ctx.fillStyle = `rgba(30, 64, 175, ${0.9 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(6, -4);
    ctx.lineTo(6, 2);
    ctx.quadraticCurveTo(0, 8, 0, 8);
    ctx.quadraticCurveTo(0, 8, -6, 2);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = `rgba(147, 197, 253, ${pulse})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1, -4, 2, 5);
    ctx.beginPath();
    ctx.arc(0, 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });
  
  // Draw fire indicators
  for (let y = 0; y < currentGridSize; y++) {
    for (let x = 0; x < currentGridSize; x++) {
      const tile = currentGrid[y][x];
      if (!tile.building.onFire) continue;
      
      const { screenX, screenY } = gridToScreen(x, y, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      
      if (centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom) {
        continue;
      }
      
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
