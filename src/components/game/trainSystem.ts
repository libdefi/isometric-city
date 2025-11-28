// Train system for rail transportation
import React, { useCallback } from 'react';
import { Train, CarDirection, WorldRenderState, TILE_WIDTH, TILE_HEIGHT } from './types';
import { TRAIN_COLORS, TRAIN_MIN_POPULATION, DIRECTION_META } from './constants';
import { isRailTile, pickNextRailDirection, findPathOnRails, getDirectionToTile, gridToScreen } from './utils';
import { findRailStations } from './gridFinders';
import { Tile } from '@/types/game';

export interface TrainSystemRefs {
  trainsRef: React.MutableRefObject<Train[]>;
  trainIdRef: React.MutableRefObject<number>;
  trainSpawnTimerRef: React.MutableRefObject<number>;
}

export interface TrainSystemState {
  worldStateRef: React.MutableRefObject<WorldRenderState>;
  state: {
    stats: {
      population: number;
    };
  };
}

export function useTrainSystem(
  refs: TrainSystemRefs,
  systemState: TrainSystemState
) {
  const { trainsRef, trainIdRef, trainSpawnTimerRef } = refs;
  const { worldStateRef, state } = systemState;

  const spawnTrain = useCallback(() => {
    const { grid: currentGrid, gridSize: currentGridSize } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) return false;
    
    // Check if we have enough population for trains
    if (state.stats.population < TRAIN_MIN_POPULATION) return false;
    
    // Find all rail stations
    const stations = findRailStations(currentGrid, currentGridSize);
    if (stations.length < 2) return false; // Need at least 2 stations
    
    // Pick a random origin station
    const originStation = stations[Math.floor(Math.random() * stations.length)];
    
    // Pick a random destination station (different from origin)
    const otherStations = stations.filter(s => s.x !== originStation.x || s.y !== originStation.y);
    if (otherStations.length === 0) return false;
    const destStation = otherStations[Math.floor(Math.random() * otherStations.length)];
    
    // Find a path between the two stations
    const path = findPathOnRails(
      currentGrid,
      currentGridSize,
      originStation.x,
      originStation.y,
      destStation.x,
      destStation.y
    );
    
    if (!path || path.length === 0) return false;
    
    // Get initial direction
    let direction: CarDirection = 'south';
    if (path.length >= 2) {
      const dir = getDirectionToTile(path[0].x, path[0].y, path[1].x, path[1].y);
      if (dir) direction = dir;
    }
    
    // Create the train
    trainsRef.current.push({
      id: trainIdRef.current++,
      tileX: path[0].x,
      tileY: path[0].y,
      direction,
      progress: 0,
      speed: 0.4 + Math.random() * 0.2, // Trains are a bit faster than cars
      age: 0,
      maxAge: 3600 + Math.random() * 1800, // Trains live longer
      color: TRAIN_COLORS[Math.floor(Math.random() * TRAIN_COLORS.length)],
      path,
      pathIndex: 0,
      originStationX: originStation.x,
      originStationY: originStation.y,
      destStationX: destStation.x,
      destStationY: destStation.y,
      returning: false,
      numCars: 2 + Math.floor(Math.random() * 3), // 2-4 cars
    });
    
    return true;
  }, [worldStateRef, state.stats.population, trainsRef, trainIdRef]);

  const updateTrains = useCallback((delta: number) => {
    const { grid: currentGrid, gridSize: currentGridSize, speed: currentSpeed } = worldStateRef.current;
    if (!currentGrid || currentGridSize <= 0) {
      trainsRef.current = [];
      return;
    }
    
    const speedMultiplier = currentSpeed === 0 ? 0 : currentSpeed === 1 ? 1 : currentSpeed === 2 ? 2.5 : 4;
    
    // Spawn new trains
    const maxTrains = Math.min(20, Math.max(2, Math.floor(state.stats.population / 500)));
    trainSpawnTimerRef.current -= delta;
    if (trainsRef.current.length < maxTrains && trainSpawnTimerRef.current <= 0) {
      if (spawnTrain()) {
        trainSpawnTimerRef.current = 5 + Math.random() * 10; // Spawn less frequently than cars
      } else {
        trainSpawnTimerRef.current = 2;
      }
    }
    
    const updatedTrains: Train[] = [];
    
    for (const train of [...trainsRef.current]) {
      let alive = true;
      
      train.age += delta;
      if (train.age > train.maxAge) {
        continue;
      }
      
      // Check if still on rail
      if (!isRailTile(currentGrid, currentGridSize, train.tileX, train.tileY)) {
        continue;
      }
      
      // Move train
      train.progress += train.speed * delta * speedMultiplier;
      
      let guard = 0;
      while (train.progress >= 1 && guard < 4) {
        guard++;
        
        // Check if at end of path
        if (train.pathIndex >= train.path.length - 1) {
          // Reached destination
          if (!train.returning) {
            // Start return journey
            train.returning = true;
            const returnPath = findPathOnRails(
              currentGrid,
              currentGridSize,
              train.destStationX,
              train.destStationY,
              train.originStationX,
              train.originStationY
            );
            
            if (returnPath && returnPath.length > 0) {
              train.path = returnPath;
              train.pathIndex = 0;
              train.progress = 0;
              train.tileX = returnPath[0].x;
              train.tileY = returnPath[0].y;
              
              if (returnPath.length >= 2) {
                const dir = getDirectionToTile(returnPath[0].x, returnPath[0].y, returnPath[1].x, returnPath[1].y);
                if (dir) train.direction = dir;
              }
            } else {
              alive = false;
              break;
            }
          } else {
            // Completed round trip
            alive = false;
            break;
          }
        } else {
          // Move to next tile in path
          train.pathIndex++;
          const currentTile = train.path[train.pathIndex];
          
          if (currentTile.x < 0 || currentTile.x >= currentGridSize ||
              currentTile.y < 0 || currentTile.y >= currentGridSize) {
            alive = false;
            break;
          }
          
          train.tileX = currentTile.x;
          train.tileY = currentTile.y;
          train.progress -= 1;
          
          // Update direction if there's a next tile
          if (train.pathIndex + 1 < train.path.length) {
            const nextTile = train.path[train.pathIndex + 1];
            const dir = getDirectionToTile(train.tileX, train.tileY, nextTile.x, nextTile.y);
            if (dir) train.direction = dir;
          }
        }
      }
      
      if (alive) {
        updatedTrains.push(train);
      }
    }
    
    trainsRef.current = updatedTrains;
  }, [worldStateRef, state.stats.population, trainsRef, trainSpawnTimerRef, spawnTrain]);

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
    const viewLeft = -currentOffset.x / currentZoom - TILE_WIDTH;
    const viewTop = -currentOffset.y / currentZoom - TILE_HEIGHT * 2;
    const viewRight = viewWidth - currentOffset.x / currentZoom + TILE_WIDTH;
    const viewBottom = viewHeight - currentOffset.y / currentZoom + TILE_HEIGHT * 2;
    
    trainsRef.current.forEach(train => {
      const { screenX, screenY } = gridToScreen(train.tileX, train.tileY, 0, 0);
      const centerX = screenX + TILE_WIDTH / 2;
      const centerY = screenY + TILE_HEIGHT / 2;
      const meta = DIRECTION_META[train.direction];
      
      // Train engine position
      const engineX = centerX + meta.vec.dx * train.progress;
      const engineY = centerY + meta.vec.dy * train.progress;
      
      if (engineX < viewLeft - 100 || engineX > viewRight + 100 || engineY < viewTop - 100 || engineY > viewBottom + 100) {
        return;
      }
      
      // Draw each car (starting from back)
      for (let car = train.numCars - 1; car >= 0; car--) {
        const carOffset = car * 18; // Space between cars
        const carProgress = train.progress - (carOffset / 64); // Adjust based on tile width
        
        // Calculate car position
        let carX = centerX;
        let carY = centerY;
        let carTileX = train.tileX;
        let carTileY = train.tileY;
        let carPathIndex = train.pathIndex;
        
        // Find the position of this car along the path
        let remainingOffset = carOffset;
        while (remainingOffset > 0 && carPathIndex > 0) {
          if (remainingOffset >= 64) {
            carPathIndex--;
            remainingOffset -= 64;
            if (carPathIndex >= 0 && carPathIndex < train.path.length) {
              carTileX = train.path[carPathIndex].x;
              carTileY = train.path[carPathIndex].y;
            }
          } else {
            break;
          }
        }
        
        const { screenX: carScreenX, screenY: carScreenY } = gridToScreen(carTileX, carTileY, 0, 0);
        const carCenterX = carScreenX + TILE_WIDTH / 2;
        const carCenterY = carScreenY + TILE_HEIGHT / 2;
        
        // Get direction for this car
        let carDirection = train.direction;
        if (carPathIndex + 1 < train.path.length) {
          const nextTile = train.path[carPathIndex + 1];
          const dir = getDirectionToTile(carTileX, carTileY, nextTile.x, nextTile.y);
          if (dir) carDirection = dir;
        }
        
        const carMeta = DIRECTION_META[carDirection];
        const localProgress = car === 0 ? train.progress : (train.progress - carOffset / 64 + 1) % 1;
        carX = carCenterX + carMeta.vec.dx * localProgress;
        carY = carCenterY + carMeta.vec.dy * localProgress;
        
        ctx.save();
        ctx.translate(carX, carY);
        ctx.rotate(carMeta.angle);
        
        const scale = 0.7;
        
        // Draw train car
        if (car === 0) {
          // Engine (front car)
          ctx.fillStyle = train.color;
          ctx.beginPath();
          ctx.moveTo(-12 * scale, -6 * scale);
          ctx.lineTo(12 * scale, -6 * scale);
          ctx.lineTo(14 * scale, 0);
          ctx.lineTo(12 * scale, 6 * scale);
          ctx.lineTo(-12 * scale, 6 * scale);
          ctx.closePath();
          ctx.fill();
          
          // Windows
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(-6 * scale, -3.5 * scale, 10 * scale, 7 * scale);
          
          // Stripe
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(-12 * scale, -5 * scale, 24 * scale, 2 * scale);
        } else {
          // Passenger car
          ctx.fillStyle = train.color;
          ctx.fillRect(-10 * scale, -5 * scale, 20 * scale, 10 * scale);
          
          // Windows
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillRect(-7 * scale, -3 * scale, 4 * scale, 6 * scale);
          ctx.fillRect(-1 * scale, -3 * scale, 4 * scale, 6 * scale);
          ctx.fillRect(5 * scale, -3 * scale, 4 * scale, 6 * scale);
          
          // Stripe
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(-10 * scale, -4 * scale, 20 * scale, 1.5 * scale);
        }
        
        ctx.restore();
      }
    });
    
    ctx.restore();
  }, [worldStateRef, trainsRef]);

  return {
    spawnTrain,
    updateTrains,
    drawTrains,
  };
}
