// Building Helpers - utility functions for multi-tile building detection
// These helpers are memoized in the main component for performance

import { Tile, BuildingType } from '@/types/game';
import { getBuildingSize } from '@/lib/simulation';

// Static Set for O(1) park building lookups (used for memoization)
export const PARK_BUILDINGS_SET = new Set<BuildingType>([
  'park_large', 'baseball_field_small', 'football_field',
  'mini_golf_course', 'go_kart_track', 'amphitheater', 'greenhouse_garden',
  'marina_docks_small', 'roller_coaster_small', 'mountain_lodge', 'playground_large', 'mountain_trailhead'
]);

// All park types for tile rendering (includes buildings with green bases)
export const ALL_PARK_TYPES = [
  'park', 'park_large', 'tennis', 'basketball_courts', 'playground_small',
  'playground_large', 'baseball_field_small', 'soccer_field_small', 'football_field',
  'skate_park', 'mini_golf_course', 'bleachers_field', 'go_kart_track', 'amphitheater', 
  'greenhouse_garden', 'animal_pens_farm', 'cabin_house', 'campground', 'marina_docks_small', 
  'pier_large', 'roller_coaster_small', 'community_garden', 'pond_park', 'park_gate', 
  'mountain_lodge', 'mountain_trailhead'
];

/**
 * Check if a tile is part of a multi-tile building footprint
 */
export function isPartOfMultiTileBuilding(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number
): boolean {
  const maxSize = 4; // Maximum building size
  
  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;
      
      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];
        const buildingSize = getBuildingSize(originTile.building.type);
        
        if (buildingSize.width > 1 || buildingSize.height > 1) {
          if (gridX >= originX && gridX < originX + buildingSize.width &&
              gridY >= originY && gridY < originY + buildingSize.height) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Find the origin of a multi-tile building that contains a given tile
 * Returns the origin coordinates and building type, or null if not part of a multi-tile building
 */
export function findBuildingOrigin(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number
): { originX: number; originY: number; buildingType: BuildingType } | null {
  const maxSize = 4;
  
  const tile = grid[gridY]?.[gridX];
  if (!tile) return null;
  
  // If this tile has a real building (not empty), check if it's multi-tile
  if (tile.building.type !== 'empty' && 
      tile.building.type !== 'grass' && 
      tile.building.type !== 'water' && 
      tile.building.type !== 'road' && 
      tile.building.type !== 'tree') {
    const size = getBuildingSize(tile.building.type);
    if (size.width > 1 || size.height > 1) {
      return { originX: gridX, originY: gridY, buildingType: tile.building.type };
    }
    return null; // Single-tile building
  }
  
  // If this is an 'empty' tile, search for the origin building
  if (tile.building.type === 'empty') {
    for (let dy = 0; dy < maxSize; dy++) {
      for (let dx = 0; dx < maxSize; dx++) {
        const originX = gridX - dx;
        const originY = gridY - dy;
        
        if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
          const originTile = grid[originY][originX];
          
          if (originTile.building.type !== 'empty' && 
              originTile.building.type !== 'grass' &&
              originTile.building.type !== 'water' &&
              originTile.building.type !== 'road' &&
              originTile.building.type !== 'tree') {
            const size = getBuildingSize(originTile.building.type);
            
            if (size.width > 1 || size.height > 1) {
              if (gridX >= originX && gridX < originX + size.width &&
                  gridY >= originY && gridY < originY + size.height) {
                return { originX, originY, buildingType: originTile.building.type };
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if a tile is part of a park building footprint (uses O(1) lookup)
 */
export function isPartOfParkBuilding(
  grid: Tile[][],
  gridSize: number,
  gridX: number,
  gridY: number
): boolean {
  const maxSize = 4;

  for (let dy = 0; dy < maxSize; dy++) {
    for (let dx = 0; dx < maxSize; dx++) {
      const originX = gridX - dx;
      const originY = gridY - dy;

      if (originX >= 0 && originX < gridSize && originY >= 0 && originY < gridSize) {
        const originTile = grid[originY][originX];

        if (PARK_BUILDINGS_SET.has(originTile.building.type)) {
          const buildingSize = getBuildingSize(originTile.building.type);
          if (gridX >= originX && gridX < originX + buildingSize.width &&
              gridY >= originY && gridY < originY + buildingSize.height) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Create memoized versions of building helpers
 * Returns callback functions that can be used in React components
 */
export function createMemoizedBuildingHelpers(grid: Tile[][], gridSize: number) {
  return {
    isPartOfMultiTileBuilding: (gridX: number, gridY: number) => 
      isPartOfMultiTileBuilding(grid, gridSize, gridX, gridY),
    
    findBuildingOrigin: (gridX: number, gridY: number) => 
      findBuildingOrigin(grid, gridSize, gridX, gridY),
    
    isPartOfParkBuilding: (gridX: number, gridY: number) => 
      isPartOfParkBuilding(grid, gridSize, gridX, gridY),
  };
}
