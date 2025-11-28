/**
 * Traffic system utilities for road network analysis and traffic light management
 */

import { Tile } from '@/types/game';
import { RoadSegment, RoadType, RoadOrientation, TrafficLight, TrafficLightState, TrafficLightDirection } from './types';
import { isRoadTile } from './utils';

// Traffic light timing constants (in game ticks)
const TRAFFIC_LIGHT_RED_DURATION = 300; // ~5 seconds at normal speed
const TRAFFIC_LIGHT_YELLOW_DURATION = 60; // ~1 second
const TRAFFIC_LIGHT_GREEN_DURATION = 300; // ~5 seconds

/**
 * Analyze road network to determine road types and configurations
 */
export function analyzeRoadNetwork(
  grid: Tile[][],
  gridSize: number
): Map<string, RoadSegment> {
  const roadSegments = new Map<string, RoadSegment>();

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!isRoadTile(grid, gridSize, x, y)) continue;

      const adjacentRoads = {
        north: isRoadTile(grid, gridSize, x - 1, y),
        east: isRoadTile(grid, gridSize, x, y - 1),
        south: isRoadTile(grid, gridSize, x + 1, y),
        west: isRoadTile(grid, gridSize, x, y + 1),
      };

      const connectionCount = Object.values(adjacentRoads).filter(Boolean).length;
      
      // Determine orientation
      let orientation: RoadOrientation = 'intersection';
      if (connectionCount === 2) {
        if ((adjacentRoads.north && adjacentRoads.south) || (adjacentRoads.east && adjacentRoads.west)) {
          orientation = adjacentRoads.north && adjacentRoads.south ? 'vertical' : 'horizontal';
        }
      }

      // Determine road type based on adjacent roads
      let type: RoadType = 'single';
      let lanes = 1;
      let hasTurnLanes = false;
      let hasDivider = false;

      // Check for parallel roads (roads next to each other in the same direction)
      // Horizontal roads: check if there's a road to the east or west AND parallel to it
      const hasEastRoad = adjacentRoads.east;
      const hasWestRoad = adjacentRoads.west;
      const hasNorthRoad = adjacentRoads.north;
      const hasSouthRoad = adjacentRoads.south;
      
      // Check for parallel horizontal roads (east-west direction)
      // A road is parallel if there's another road tile adjacent in the perpendicular direction
      const parallelHorizontal = (hasEastRoad || hasWestRoad) && 
        ((hasEastRoad && isRoadTile(grid, gridSize, x, y - 2)) || 
         (hasWestRoad && isRoadTile(grid, gridSize, x, y + 2)) ||
         // Or if there are roads on both sides
         (hasEastRoad && hasWestRoad && 
          (isRoadTile(grid, gridSize, x - 1, y - 1) || isRoadTile(grid, gridSize, x + 1, y - 1) ||
           isRoadTile(grid, gridSize, x - 1, y + 1) || isRoadTile(grid, gridSize, x + 1, y + 1))));
      
      // Check for parallel vertical roads (north-south direction)
      const parallelVertical = (hasNorthRoad || hasSouthRoad) &&
        ((hasNorthRoad && isRoadTile(grid, gridSize, x - 2, y)) ||
         (hasSouthRoad && isRoadTile(grid, gridSize, x + 2, y)) ||
         // Or if there are roads on both sides
         (hasNorthRoad && hasSouthRoad &&
          (isRoadTile(grid, gridSize, x - 1, y - 1) || isRoadTile(grid, gridSize, x - 1, y + 1) ||
           isRoadTile(grid, gridSize, x + 1, y - 1) || isRoadTile(grid, gridSize, x + 1, y + 1))));

      // Check for multi-lane roads (3+ parallel roads in a row)
      const multiLaneHorizontal = (hasEastRoad && isRoadTile(grid, gridSize, x, y - 2) && isRoadTile(grid, gridSize, x, y - 3)) ||
                                  (hasWestRoad && isRoadTile(grid, gridSize, x, y + 2) && isRoadTile(grid, gridSize, x, y + 3));
      const multiLaneVertical = (hasNorthRoad && isRoadTile(grid, gridSize, x - 2, y) && isRoadTile(grid, gridSize, x - 3, y)) ||
                                (hasSouthRoad && isRoadTile(grid, gridSize, x + 2, y) && isRoadTile(grid, gridSize, x + 3, y));

      if (multiLaneHorizontal || multiLaneVertical) {
        type = 'multi_lane';
        lanes = 3;
        hasDivider = true;
        hasTurnLanes = connectionCount >= 3;
      } else if (parallelHorizontal || parallelVertical) {
        type = 'dual';
        lanes = 2;
        hasDivider = true;
        // Check if we need turn lanes (at intersections)
        if (connectionCount >= 3) {
          hasTurnLanes = true;
        }
      } else if (connectionCount >= 3) {
        // Intersections with 3+ connections get turn lanes
        hasTurnLanes = true;
        if (connectionCount === 4) {
          lanes = 2; // 4-way intersections can have 2 lanes
        }
      }

      const key = `${x},${y}`;
      roadSegments.set(key, {
        x,
        y,
        type,
        orientation,
        lanes,
        hasTurnLanes,
        hasDivider,
        adjacentRoads,
      });
    }
  }

  return roadSegments;
}

/**
 * Initialize traffic lights at intersections
 */
export function initializeTrafficLights(
  grid: Tile[][],
  gridSize: number
): TrafficLight[] {
  const lights: TrafficLight[] = [];

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (!isRoadTile(grid, gridSize, x, y)) continue;

      const adjacentRoads = {
        north: isRoadTile(grid, gridSize, x - 1, y),
        east: isRoadTile(grid, gridSize, x, y - 1),
        south: isRoadTile(grid, gridSize, x + 1, y),
        west: isRoadTile(grid, gridSize, x, y + 1),
      };

      const connectionCount = Object.values(adjacentRoads).filter(Boolean).length;

      // Only place traffic lights at intersections (3+ connections)
      if (connectionCount >= 3) {
        // Create lights for each direction that has a road
        const directions: TrafficLightDirection[] = [];
        if (adjacentRoads.north) directions.push('north');
        if (adjacentRoads.east) directions.push('east');
        if (adjacentRoads.south) directions.push('south');
        if (adjacentRoads.west) directions.push('west');

        // Create a coordinated cycle for intersections
        // Group opposite directions together (north-south, east-west)
        const phaseGroups: TrafficLightDirection[][] = [];
        if (directions.includes('north') && directions.includes('south')) {
          phaseGroups.push(['north', 'south']);
        }
        if (directions.includes('east') && directions.includes('west')) {
          phaseGroups.push(['east', 'west']);
        }
        // If no opposite pairs, treat each direction separately
        if (phaseGroups.length === 0) {
          directions.forEach(dir => phaseGroups.push([dir]));
        }

        // Assign phases: each group gets a phase number
        phaseGroups.forEach((group, phaseIndex) => {
          group.forEach(direction => {
            lights.push({
              tileX: x,
              tileY: y,
              direction,
              state: phaseIndex === 0 ? 'green' : 'red', // First phase starts green
              timer: phaseIndex === 0 ? TRAFFIC_LIGHT_GREEN_DURATION : TRAFFIC_LIGHT_RED_DURATION,
              phase: phaseIndex,
            });
          });
        });
      }
    }
  }

  return lights;
}

/**
 * Update traffic light states
 */
export function updateTrafficLights(lights: TrafficLight[], deltaTime: number): TrafficLight[] {
  // Group lights by intersection
  const intersectionMap = new Map<string, TrafficLight[]>();
  for (const light of lights) {
    const key = `${light.tileX},${light.tileY}`;
    if (!intersectionMap.has(key)) {
      intersectionMap.set(key, []);
    }
    intersectionMap.get(key)!.push(light);
  }

  return lights.map(light => {
    let newState = light.state;
    let newTimer = light.timer - deltaTime;
    let newPhase = light.phase;

    if (newTimer <= 0) {
      // Get all lights at this intersection
      const intersectionKey = `${light.tileX},${light.tileY}`;
      const allLightsAtIntersection = intersectionMap.get(intersectionKey) || [];
      
      // Transition to next state
      if (light.state === 'green') {
        newState = 'yellow';
        newTimer = TRAFFIC_LIGHT_YELLOW_DURATION;
      } else if (light.state === 'yellow') {
        newState = 'red';
        newTimer = TRAFFIC_LIGHT_RED_DURATION;
      } else if (light.state === 'red') {
        // Check if all lights at intersection are red (transition phase)
        const allRed = allLightsAtIntersection.every(l => l.state === 'red' || l.timer <= 0);
        
        if (allRed) {
          // Find the next phase to activate (cycle through phases)
          const maxPhase = Math.max(...allLightsAtIntersection.map(l => l.phase));
          const nextPhase = (light.phase + 1) % (maxPhase + 1);
          
          // Activate lights for the next phase
          if (light.phase === nextPhase) {
            newState = 'green';
            newTimer = TRAFFIC_LIGHT_GREEN_DURATION;
          } else {
            // Keep red, but reset timer
            newTimer = TRAFFIC_LIGHT_RED_DURATION;
          }
        } else {
          // Keep red, wait for other lights
          newTimer = TRAFFIC_LIGHT_RED_DURATION;
        }
      }
    }

    return {
      ...light,
      state: newState,
      timer: newTimer,
      phase: newPhase,
    };
  });
}

/**
 * Get traffic light state for a specific direction at a tile
 */
export function getTrafficLightState(
  lights: TrafficLight[],
  tileX: number,
  tileY: number,
  direction: TrafficLightDirection
): TrafficLightState | null {
  const light = lights.find(
    l => l.tileX === tileX && l.tileY === tileY && l.direction === direction
  );
  return light?.state ?? null;
}

/**
 * Check if a car can proceed through an intersection
 */
export function canCarProceed(
  lights: TrafficLight[],
  tileX: number,
  tileY: number,
  direction: CarDirection
): boolean {
  const lightState = getTrafficLightState(lights, tileX, tileY, direction);
  if (lightState === null) return true; // No traffic light, can proceed
  return lightState === 'green' || lightState === 'yellow';
}
