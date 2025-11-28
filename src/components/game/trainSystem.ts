import { useCallback } from 'react';
import { Train, TrainCar, CarDirection, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import {
  TRAIN_COLORS,
  TRAIN_MIN_SPEED,
  TRAIN_MAX_SPEED,
  TRAIN_STATION_WAIT_TIME,
  TRAIN_CAR_SPACING,
  TRAIN_MIN_STATIONS,
  DIRECTION_META,
} from './constants';
import { gridToScreen, getDirectionToTile } from './utils';
import { findRailStations, isRailTile, findPathOnRails, findAdjacentRailToStation, getAdjacentRailTiles } from './gridFinders';

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  isMobile: boolean;
}

// Get direction options for trains on rails
function getRailDirectionOptions(
  gridData: import('@/types/game').Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection[] {
  const options: CarDirection[] = [];
  if (isRailTile(gridData, gridSize, x - 1, y)) options.push('north');
  if (isRailTile(gridData, gridSize, x, y - 1)) options.push('east');
  if (isRailTile(gridData, gridSize, x + 1, y)) options.push('south');
  if (isRailTile(gridData, gridSize, x, y + 1)) options.push('west');
  return options;
}

// Get opposite direction
function getOppositeDirection(dir: CarDirection): CarDirection {
  const opposites: Record<CarDirection, CarDirection> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };
  return opposites[dir];
}

// Pick next direction for train on rails
function pickNextRailDirection(
  previousDirection: CarDirection,
  gridData: import('@/types/game').Tile[][],
  gridSize: number,
  x: number,
  y: number
): CarDirection | null {
  const options = getRailDirectionOptions(gridData, gridSize, x, y);
  if (options.length === 0) return null;
  const incoming = getOppositeDirection(previousDirection);
  const filtered = options.filter(dir => dir !== incoming);
  const pool = filtered.length > 0 ? filtered : options;
  // Prefer to continue straight if possible
  if (pool.includes(previousDirection)) {
    return previousDirection;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function useTrainSystem(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const { trainsRef, trainIdRef, trainSpawnTimerRef } = refs;
  const { worldStateRef, isMobile } = systemState;

  // Find rail stations callback
  const findRailStationsCallback = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    return findRailStations(currentGrid, currentGridSize);
  }, [worldStateRef]);

  // Spawn a new train at a station
  const spawnTrain = useCallback((): boolean => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;

    const stations = findRailStationsCallback();
    if (stations.length < TRAIN_MIN_STATIONS) return false;

    // Pick a random home station
    const homeStation = stations[Math.floor(Math.random() * stations.length)];
    
    // Find a connected rail tile to start on
    const startRail = findAdjacentRailToStation(currentGrid, currentGridSize, homeStation.x, homeStation.y);
    if (!startRail) return false;

    // Pick a random destination station (different from home)
    const otherStations = stations.filter(s => s.x !== homeStation.x || s.y !== homeStation.y);
    if (otherStations.length === 0) return false;
    const destStation = otherStations[Math.floor(Math.random() * otherStations.length)];

    // Find path to destination
    const destRail = findAdjacentRailToStation(currentGrid, currentGridSize, destStation.x, destStation.y);
    if (!destRail) return false;

    const path = findPathOnRails(currentGrid, currentGridSize, startRail.x, startRail.y, destRail.x, destRail.y);
    if (!path || path.length < 2) return false;

    // Determine initial direction
    let direction: CarDirection = 'south';
    if (path.length >= 2) {
      const nextTile = path[1];
      const dir = getDirectionToTile(startRail.x, startRail.y, nextTile.x, nextTile.y);
      if (dir) direction = dir;
    }

    const numCars = 2 + Math.floor(Math.random() * 3); // 2-4 cars
    const speed = TRAIN_MIN_SPEED + Math.random() * (TRAIN_MAX_SPEED - TRAIN_MIN_SPEED);

    // Initialize train cars at the starting position
    const { screenX, screenY } = gridToScreen(startRail.x, startRail.y, 0, 0);
    const startScreenX = screenX + TILE_WIDTH / 2;
    const startScreenY = screenY + TILE_HEIGHT / 2;
    const meta = DIRECTION_META[direction];
    const angle = meta.angle;

    const cars: TrainCar[] = [];
    for (let i = 0; i < numCars; i++) {
      cars.push({
        x: startScreenX - Math.cos(angle) * i * TRAIN_CAR_SPACING,
        y: startScreenY - Math.sin(angle) * i * TRAIN_CAR_SPACING,
        angle: angle,
      });
    }

    trainsRef.current.push({
      id: trainIdRef.current++,
      tileX: startRail.x,
      tileY: startRail.y,
      direction,
      progress: 0,
      speed,
      maxSpeed: speed,
      state: 'departing',
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      cars,
      numCars,
      path,
      pathIndex: 0,
      stationTimer: 0,
      homeStationX: homeStation.x,
      homeStationY: homeStation.y,
      destStationX: destStation.x,
      destStationY: destStation.y,
      age: 0,
    });

    return true;
  }, [worldStateRef, findRailStationsCallback, trainsRef, trainIdRef]);

  // Update trains - movement, station stops, lifecycle
  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;

    if (!currentGrid || currentGridSize <= 0 || currentSpeed === 0) {
      return;
    }

    const stations = findRailStationsCallback();
    
    // No trains if fewer than 2 stations
    if (stations.length < TRAIN_MIN_STATIONS) {
      trainsRef.current = [];
      return;
    }

    // Calculate max trains (1 per station pair, max 10)
    const maxTrains = isMobile ? Math.min(5, stations.length) : Math.min(10, stations.length * 2);
    
    // Speed multiplier based on game speed
    const speedMultiplier = currentSpeed === 1 ? 1 : currentSpeed === 2 ? 1.5 : 2;

    // Spawn timer
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      if (spawnTrain()) {
        trainSpawnTimerRef.current = 4 + Math.random() * 6; // 4-10 seconds between spawns
      } else {
        trainSpawnTimerRef.current = 2; // Retry sooner if spawn failed
      }
    }

    // Update existing trains
    const updatedTrains: Train[] = [];

    for (const train of trainsRef.current) {
      train.age += delta;

      // Handle different states
      switch (train.state) {
        case 'stopped_at_station': {
          train.stationTimer += delta * speedMultiplier;
          if (train.stationTimer >= TRAIN_STATION_WAIT_TIME) {
            // Pick new destination
            const otherStations = stations.filter(s => 
              (s.x !== train.destStationX || s.y !== train.destStationY)
            );
            
            if (otherStations.length > 0) {
              const newDest = otherStations[Math.floor(Math.random() * otherStations.length)];
              const newDestRail = findAdjacentRailToStation(currentGrid, currentGridSize, newDest.x, newDest.y);
              
              if (newDestRail) {
                const newPath = findPathOnRails(
                  currentGrid, currentGridSize, 
                  train.tileX, train.tileY, 
                  newDestRail.x, newDestRail.y
                );
                
                if (newPath && newPath.length >= 2) {
                  train.path = newPath;
                  train.pathIndex = 0;
                  train.destStationX = newDest.x;
                  train.destStationY = newDest.y;
                  train.state = 'departing';
                  train.stationTimer = 0;
                }
              }
            }
          }
          updatedTrains.push(train);
          continue;
        }

        case 'departing': {
          // Accelerate from station
          train.speed = Math.min(train.maxSpeed, train.speed + delta * 0.2);
          train.state = 'running';
          break;
        }

        case 'arriving': {
          // Decelerate approaching station
          train.speed = Math.max(0.1, train.speed - delta * 0.3);
          break;
        }

        case 'running':
        default:
          break;
      }

      // Move train along path
      if (!isRailTile(currentGrid, currentGridSize, train.tileX, train.tileY)) {
        // Rail removed under train - remove train
        continue;
      }

      train.progress += train.speed * delta * speedMultiplier;

      // Check if approaching destination station
      if (train.pathIndex >= train.path.length - 3 && train.state === 'running') {
        train.state = 'arriving';
      }

      // Handle tile transitions
      let shouldRemove = false;
      while (train.progress >= 1 && train.pathIndex < train.path.length - 1) {
        train.pathIndex++;
        train.progress -= 1;

        const currentTile = train.path[train.pathIndex];
        train.tileX = currentTile.x;
        train.tileY = currentTile.y;

        // Check if reached destination
        if (train.pathIndex >= train.path.length - 1) {
          train.state = 'stopped_at_station';
          train.stationTimer = 0;
          train.speed = 0;
          train.progress = 0;
          break;
        }

        // Update direction
        if (train.pathIndex + 1 < train.path.length) {
          const nextTile = train.path[train.pathIndex + 1];
          const dir = getDirectionToTile(train.tileX, train.tileY, nextTile.x, nextTile.y);
          if (dir) train.direction = dir;
        }
      }

      // Update train car positions
      const meta = DIRECTION_META[train.direction];
      const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
      const leadX = screenX + TILE_WIDTH / 2 + meta.vec.dx * train.progress;
      const leadY = screenY + TILE_HEIGHT / 2 + meta.vec.dy * train.progress;

      // Update locomotive position
      if (train.cars.length > 0) {
        train.cars[0].x = leadX;
        train.cars[0].y = leadY;
        train.cars[0].angle = meta.angle;

        // Update following cars with smooth following
        for (let i = 1; i < train.cars.length; i++) {
          const leader = train.cars[i - 1];
          const follower = train.cars[i];
          
          // Calculate desired position behind leader
          const targetX = leader.x - Math.cos(leader.angle) * TRAIN_CAR_SPACING;
          const targetY = leader.y - Math.sin(leader.angle) * TRAIN_CAR_SPACING;
          
          // Smooth interpolation
          const followSpeed = 8 * delta;
          follower.x += (targetX - follower.x) * followSpeed;
          follower.y += (targetY - follower.y) * followSpeed;
          
          // Update angle to face leader
          const dx = leader.x - follower.x;
          const dy = leader.y - follower.y;
          follower.angle = Math.atan2(dy, dx);
        }
      }

      if (!shouldRemove) {
        updatedTrains.push(train);
      }
    }

    trainsRef.current = updatedTrains;
  }, [worldStateRef, trainsRef, trainSpawnTimerRef, findRailStationsCallback, spawnTrain, isMobile]);

  // Draw trains
  const drawTrains = useCallback((ctx: CanvasRenderingContext2D) => {
    const { offset: currentOffset, zoom: currentZoom, grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;

    if (!currentGrid || currentGridSize <= 0 || trainsRef.current.length === 0) {
      return;
    }

    ctx.save();
    ctx.scale(dpr * currentZoom, dpr * currentZoom);
    ctx.translate(currentOffset.x / currentZoom, currentOffset.y / currentZoom);

    const viewWidth = canvas.width / (dpr * currentZoom);
    const viewHeight = canvas.height / (dpr * currentZoom);
    const viewLeft = -currentOffset.x / currentZoom - 100;
    const viewTop = -currentOffset.y / currentZoom - 100;
    const viewRight = viewWidth - currentOffset.x / currentZoom + 100;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + 100;

    for (const train of trainsRef.current) {
      // Draw each car
      for (let i = train.cars.length - 1; i >= 0; i--) {
        const car = train.cars[i];
        
        // Skip if outside viewport
        if (car.x < viewLeft || car.x > viewRight || car.y < viewTop || car.y > viewBottom) {
          continue;
        }

        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        const isLocomotive = i === 0;
        const scale = 0.65;

        if (isLocomotive) {
          // Draw locomotive
          // Main body
          ctx.fillStyle = train.color;
          ctx.beginPath();
          ctx.roundRect(-12 * scale, -6 * scale, 24 * scale, 12 * scale, 2 * scale);
          ctx.fill();

          // Cab
          ctx.fillStyle = '#2d3748';
          ctx.fillRect(-8 * scale, -5 * scale, 10 * scale, 10 * scale);

          // Front (nose)
          ctx.fillStyle = train.color;
          ctx.beginPath();
          ctx.moveTo(12 * scale, -4 * scale);
          ctx.lineTo(16 * scale, -2 * scale);
          ctx.lineTo(16 * scale, 2 * scale);
          ctx.lineTo(12 * scale, 4 * scale);
          ctx.closePath();
          ctx.fill();

          // Headlight
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(14 * scale, 0, 1.5 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Windows
          ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
          ctx.fillRect(-6 * scale, -4 * scale, 6 * scale, 3 * scale);
          ctx.fillRect(-6 * scale, 1 * scale, 6 * scale, 3 * scale);

          // Wheels (simplified)
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(-8 * scale, 6 * scale, 2 * scale, 0, Math.PI * 2);
          ctx.arc(0, 6 * scale, 2 * scale, 0, Math.PI * 2);
          ctx.arc(8 * scale, 6 * scale, 2 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Detail stripe
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(-10 * scale, -1 * scale, 20 * scale, 2 * scale);
        } else {
          // Draw carriage/passenger car
          // Main body
          ctx.fillStyle = '#e5e7eb';
          ctx.beginPath();
          ctx.roundRect(-10 * scale, -5 * scale, 20 * scale, 10 * scale, 2 * scale);
          ctx.fill();

          // Stripe with train color
          ctx.fillStyle = train.color;
          ctx.fillRect(-10 * scale, -2 * scale, 20 * scale, 4 * scale);

          // Windows
          ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
          for (let w = -8; w <= 6; w += 4) {
            ctx.fillRect(w * scale, -4 * scale, 2.5 * scale, 2 * scale);
            ctx.fillRect(w * scale, 2 * scale, 2.5 * scale, 2 * scale);
          }

          // Wheels
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(-6 * scale, 5 * scale, 1.5 * scale, 0, Math.PI * 2);
          ctx.arc(6 * scale, 5 * scale, 1.5 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Coupling (connector)
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(9 * scale, -1 * scale, 3 * scale, 2 * scale);
          ctx.fillRect(-12 * scale, -1 * scale, 3 * scale, 2 * scale);
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }, [worldStateRef, trainsRef]);

  return {
    updateTrains,
    drawTrains,
    spawnTrain,
    findRailStationsCallback,
  };
}
