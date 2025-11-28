import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { BuildingType } from '@/types/game';

import {
  TILE_HEIGHT,
  TILE_WIDTH,
  CarDirection,
  EmergencyVehicle,
  EmergencyVehicleType,
  WorldRenderState,
} from '../../types';
import {
  DIRECTION_META,
  ROTOR_WASH_MAX_AGE,
  ROTOR_WASH_SPAWN_INTERVAL,
} from '../../constants';
import {
  findPathOnRoads,
  getDirectionToTile,
  gridToScreen,
  isRoadTile,
} from '../../utils';
import { findFires, findStations } from '../../gridFinders';

type WorldStateRef = MutableRefObject<WorldRenderState>;

type CrimeIncident = {
  x: number;
  y: number;
  type: 'robbery' | 'burglary' | 'disturbance' | 'traffic';
  timeRemaining: number;
};

export interface EmergencySystemOptions {
  worldStateRef: WorldStateRef;
  policeCoverage: number[][];
  population: number;
}

export interface EmergencySystem {
  spawnCrimeIncidents: (delta: number) => void;
  updateCrimeIncidents: (delta: number) => void;
  updateEmergencyVehicles: (delta: number) => void;
  drawEmergencyVehicles: (ctx: CanvasRenderingContext2D) => void;
  drawIncidentIndicators: (ctx: CanvasRenderingContext2D, delta: number) => void;
  getCrimeIncidentAt: (x: number, y: number) => CrimeIncident | null;
}

export function useEmergencySystem({
  worldStateRef,
  policeCoverage,
  population,
}: EmergencySystemOptions): EmergencySystem {
  const activeFiresRef = useRef<Set<string>>(new Set());
  const activeCrimesRef = useRef<Set<string>>(new Set());
  const activeCrimeIncidentsRef = useRef<Map<string, CrimeIncident>>(new Map());

  const emergencyVehiclesRef = useRef<EmergencyVehicle[]>([]);
  const emergencyVehicleIdRef = useRef(0);
  const emergencyDispatchTimerRef = useRef(0);
  const crimeSpawnTimerRef = useRef(0);
  const incidentAnimTimeRef = useRef(0);

  const findStationsCallback = useCallback(
    (type: 'fire_station' | 'police_station'): { x: number; y: number }[] => {
      const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
      return findStations(currentGrid, currentGridSize, type);
    },
    [worldStateRef]
  );

  const findFiresCallback = useCallback((): { x: number; y: number }[] => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findFires(currentGrid, currentGridSize);
  }, [worldStateRef]);

  const spawnCrimeIncidents = useCallback(
    (delta: number) => {
      const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
      if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

      const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
      crimeSpawnTimerRef.current -= delta * speedMultiplier;

      if (crimeSpawnTimerRef.current > 0) return;
      crimeSpawnTimerRef.current = 3 + Math.random() * 2;

      const eligibleTiles: { x: number; y: number; coverage: number }[] = [];

      for (let y = 0; y < currentGridSize; y++) {
        for (let x = 0; x < currentGridSize; x++) {
          const tile = currentGrid[y][x];
          const isBuilding =
            tile.building.type !== 'grass' &&
            tile.building.type !== 'water' &&
            tile.building.type !== 'road' &&
            tile.building.type !== 'tree' &&
            tile.building.type !== 'empty';
          const hasActivity = tile.building.population > 0 || tile.building.jobs > 0;

          if (isBuilding && hasActivity) {
            const coverage = policeCoverage[y]?.[x] || 0;
            eligibleTiles.push({ x, y, coverage });
          }
        }
      }

      if (eligibleTiles.length === 0) return;

      const avgCoverage = eligibleTiles.reduce((sum, t) => sum + t.coverage, 0) / eligibleTiles.length;
      const baseChance = avgCoverage < 20 ? 0.4 : avgCoverage < 40 ? 0.25 : avgCoverage < 60 ? 0.15 : 0.08;

      const maxActiveCrimes = Math.max(2, Math.floor(population / 500));

      if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) return;

      const crimesToSpawn = Math.random() < 0.3 ? 2 : 1;

      for (let i = 0; i < crimesToSpawn; i++) {
        if (activeCrimeIncidentsRef.current.size >= maxActiveCrimes) break;
        if (Math.random() > baseChance) continue;

        const weightedTiles = eligibleTiles.filter(t => {
          const key = `${t.x},${t.y}`;
          if (activeCrimeIncidentsRef.current.has(key)) return false;
          const weight = Math.max(0.1, 1 - t.coverage / 100);
          return Math.random() < weight;
        });

        if (weightedTiles.length === 0) continue;

        const target = weightedTiles[Math.floor(Math.random() * weightedTiles.length)];
        const key = `${target.x},${target.y}`;

        const crimeTypes: CrimeIncident['type'][] = ['robbery', 'burglary', 'disturbance', 'traffic'];
        const crimeType = crimeTypes[Math.floor(Math.random() * crimeTypes.length)];
        const duration = crimeType === 'traffic' ? 15 : crimeType === 'disturbance' ? 20 : 30;

        activeCrimeIncidentsRef.current.set(key, {
          x: target.x,
          y: target.y,
          type: crimeType,
          timeRemaining: duration,
        });
      }
    },
    [policeCoverage, population, worldStateRef]
  );

  const updateCrimeIncidents = useCallback(
    (delta: number) => {
      const { speed: currentSpeed } = worldStateRef.current;
      if (currentSpeed === 0) return;

      const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2 : 3;
      const keysToDelete: string[] = [];

      activeCrimeIncidentsRef.current.forEach((crime, key) => {
        if (activeCrimesRef.current.has(key)) return;

        const newTimeRemaining = crime.timeRemaining - delta * speedMultiplier;
        if (newTimeRemaining <= 0) {
          keysToDelete.push(key);
        } else {
          activeCrimeIncidentsRef.current.set(key, { ...crime, timeRemaining: newTimeRemaining });
        }
      });

      keysToDelete.forEach(key => activeCrimeIncidentsRef.current.delete(key));
    },
    [worldStateRef]
  );

  const findCrimeIncidents = useCallback((): { x: number; y: number }[] => {
    return Array.from(activeCrimeIncidentsRef.current.values()).map(c => ({ x: c.x, y: c.y }));
  }, []);

  const dispatchEmergencyVehicle = useCallback(
    (type: EmergencyVehicleType, stationX: number, stationY: number, targetX: number, targetY: number): boolean => {
      const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
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
    },
    [worldStateRef]
  );

  const updateEmergencyDispatch = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) return;

    const fires = findFiresCallback();
    const fireStations = findStationsCallback('fire_station');

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
        if (dispatchEmergencyVehicle('fire_truck', nearestStation.x, nearestStation.y, fire.x, fire.y)) {
          activeFiresRef.current.add(fireKey);
        }
      }
    }

    const crimes = findCrimeIncidents();
    const policeStations = findStationsCallback('police_station');

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
        if (dispatchEmergencyVehicle('police_car', nearestStation.x, nearestStation.y, crime.x, crime.y)) {
          activeCrimesRef.current.add(crimeKey);
          dispatched++;
        }
      }
    }
  }, [dispatchEmergencyVehicle, findCrimeIncidents, findFiresCallback, findStationsCallback]);

  const updateEmergencyVehicles = useCallback(
    (delta: number) => {
      const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
      if (!currentGrid || currentGridSize <= 0) {
        emergencyVehiclesRef.current = [];
        return;
      }

      const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;

      emergencyDispatchTimerRef.current -= delta;
      if (emergencyDispatchTimerRef.current <= 0) {
        updateEmergencyDispatch();
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

            const returnPath = findPathOnRoads(currentGrid, currentGridSize, vehicle.tileX, vehicle.tileY, vehicle.stationX, vehicle.stationY);

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

        if (vehicle.tileX < 0 || vehicle.tileX >= currentGridSize || vehicle.tileY < 0 || vehicle.tileY >= currentGridSize) {
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

          if (currentTile.x < 0 || currentTile.x >= currentGridSize || currentTile.y < 0 || currentTile.y >= currentGridSize) {
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
    },
    [updateEmergencyDispatch, worldStateRef]
  );

  const drawEmergencyVehicles = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
      const canvas = ctx.canvas;
      const dpr = window.devicePixelRatio || 1;

      if (!currentGrid || currentGridSize <= 0 || emergencyVehiclesRef.current.length === 0) return;

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
        const vehicleX = centerX + meta.vec.dx * vehicle.progress;
        const vehicleY = centerY + meta.vec.dy * vehicle.progress;

        if (vehicleX < viewLeft - 60 || vehicleX > viewRight + 60 || vehicleY < viewTop - 80 || vehicleY > viewBottom + 80) {
          return;
        }

        const isBehindBuilding = (tileX: number, tileY: number): boolean => {
          const depth = tileX + tileY;
          for (let dy = 0; dy <= 1; dy++) {
            for (let dx = 0; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const checkX = tileX + dx;
              const checkY = tileY + dy;
              if (checkX < 0 || checkY < 0 || checkX >= currentGridSize || checkY >= currentGridSize) continue;
              const tile = currentGrid[checkY]?.[checkX];
              if (!tile) continue;
              const type = tile.building.type as BuildingType;
              const skip: BuildingType[] = ['road', 'grass', 'empty', 'water', 'tree'];
              if (skip.includes(type)) continue;
              const tileDepth = checkX + checkY;
              if (tileDepth > depth) {
                return true;
              }
            }
          }
          return false;
        };

        if (isBehindBuilding(vehicle.tileX, vehicle.tileY)) {
          return;
        }

        ctx.save();
        ctx.translate(vehicleX, vehicleY);
        ctx.rotate(meta.angle);

        const scale = 0.85;
        const length = 16 * scale;
        const width = 8 * scale;

        ctx.fillStyle = vehicle.type === 'fire_truck' ? '#dc2626' : '#1d4ed8';
        ctx.beginPath();
        ctx.moveTo(-length, -width);
        ctx.lineTo(length, -width);
        ctx.lineTo(length + 4 * scale, 0);
        ctx.lineTo(length, width);
        ctx.lineTo(-length, width);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(-length + 2 * scale, -width + 1.5 * scale, length * 0.8, width * 1.5);

        ctx.fillStyle = '#111827';
        ctx.fillRect(-length + 1.5 * scale, -width, 3 * scale, width * 2);
        ctx.fillRect(length - 3.5 * scale, -width, 3 * scale, width * 2);

        const flashOn = Math.sin(vehicle.flashTimer) > 0;
        const flashOn2 = Math.cos(vehicle.flashTimer * 0.8) > 0;

        if (vehicle.type === 'fire_truck') {
          ctx.fillStyle = flashOn ? '#f97316' : '#7c2d12';
          ctx.fillRect(-6 * scale, -7 * scale, 4 * scale, 4 * scale);
          ctx.fillRect(2 * scale, -7 * scale, 4 * scale, 4 * scale);
          if (flashOn || flashOn2) {
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 6;
            ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
            ctx.fillRect(-8 * scale, -8 * scale, 16 * scale, 4 * scale);
            ctx.shadowBlur = 0;
          }
        } else {
          ctx.fillStyle = flashOn ? '#ef4444' : '#7f1d1d';
          ctx.fillRect(-5 * scale, -7 * scale, 3 * scale, 3 * scale);
          ctx.fillStyle = flashOn2 ? '#3b82f6' : '#1e3a8a';
          ctx.fillRect(2 * scale, -7 * scale, 3 * scale, 3 * scale);
          if (flashOn || flashOn2) {
            ctx.shadowColor = flashOn ? '#ef4444' : '#3b82f6';
            ctx.shadowBlur = 6;
            ctx.fillStyle = flashOn ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)';
            ctx.fillRect(-7 * scale, -8 * scale, 14 * scale, 4 * scale);
            ctx.shadowBlur = 0;
          }
        }

        ctx.fillStyle = '#111827';
        ctx.fillRect(-length * scale, -4 * scale, 2 * scale, 8 * scale);

        ctx.restore();
      });

      ctx.restore();
    },
    [worldStateRef]
  );

  const drawIncidentIndicators = useCallback(
    (ctx: CanvasRenderingContext2D, delta: number) => {
      const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
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
    },
    [worldStateRef]
  );

  const getCrimeIncidentAt = useCallback((x: number, y: number): CrimeIncident | null => {
    const key = `${x},${y}`;
    return activeCrimeIncidentsRef.current.get(key) ?? null;
  }, []);

  return {
    spawnCrimeIncidents,
    updateCrimeIncidents,
    updateEmergencyVehicles,
    drawEmergencyVehicles,
    drawIncidentIndicators,
    getCrimeIncidentAt,
  };
}
