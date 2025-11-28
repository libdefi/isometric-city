# CanvasIsometricGrid Refactoring Guide

This document describes the refactoring performed on `CanvasIsometricGrid.tsx` to improve maintainability and performance.

## Summary

The original `CanvasIsometricGrid.tsx` was ~5681 lines. It has been refactored by extracting major systems into:
- **Custom Hooks** (in `/src/components/game/hooks/`)
- **Rendering Utilities** (in `/src/components/game/rendering/`)

## Extracted Custom Hooks

All hooks are located in `/src/components/game/hooks/`:

### 1. `useCars(worldStateRef, isMobile)`
Manages car spawning, movement, and lifecycle.

**Returns:**
- `cars`: Current array of cars
- `carsRef`: Ref to cars array  
- `updateCars(delta)`: Update function

### 2. `usePedestrians(worldStateRef, gridVersionRef, isMobile)`
Manages pedestrian spawning, pathfinding, and movement.

**Returns:**
- `pedestrians`: Current array of pedestrians
- `pedestriansRef`: Ref to pedestrians array
- `updatePedestrians(delta)`: Update function

### 3. `useEmergencyVehicles(worldStateRef, state)`
Manages fire trucks and police cars, including dispatching and incident tracking.

**Returns:**
- `emergencyVehicles`: Current array of emergency vehicles
- `emergencyVehiclesRef`: Ref to emergency vehicles
- `activeCrimeIncidentsRef`: Ref to active crime incidents map
- `updateEmergencyVehicles(delta)`: Update function
- `spawnCrimeIncidents(delta)`: Spawn new crimes
- `updateCrimeIncidents(delta)`: Update crime timers

### 4. `useAircraft(worldStateRef, gridVersionRef, cachedPopulationRef, isMobile)`
Manages airplanes and helicopters.

**Returns:**
- `airplanes`, `airplanesRef`, `updateAirplanes(delta)`
- `helicopters`, `helicoptersRef`, `updateHelicopters(delta)`

### 5. `useBoats(worldStateRef, isMobile)`
Manages boats on water.

**Returns:**
- `boats`: Current array of boats
- `boatsRef`: Ref to boats array
- `updateBoats(delta)`: Update function

### 6. `useFireworks(worldStateRef, isMobile)`
Manages firework shows at night.

**Returns:**
- `fireworks`, `fireworksRef`, `updateFireworks(delta, hour)`

### 7. `useSmog(worldStateRef, gridVersionRef, isMobile)`
Manages smog particles from factories.

**Returns:**
- `factorySmog`, `factorySmogRef`, `updateSmog(delta)`

## Extracted Rendering Utilities

All rendering functions are in `/src/components/game/rendering/`:

### Drawing Functions

All functions accept `(ctx, data, worldState)`:

- `drawCars(ctx, cars, worldState)` - Renders cars with occlusion
- `drawEmergencyVehicles(ctx, vehicles, worldState)` - Renders fire trucks and police cars
- `drawBoats(ctx, boats, worldState)` - Renders boats and wakes
- `drawFireworks(ctx, fireworks, worldState)` - Renders firework particles
- `drawSmog(ctx, factorySmog, worldState)` - Renders smog particles
- `drawIncidentIndicators(ctx, worldState, activeCrimeIncidents, incidentAnimTime, delta)` - Renders fire/crime indicators

## How to Use in CanvasIsometricGrid

### Step 1: Import the hooks and utilities

```typescript
// Import hooks
import {
  useCars,
  usePedestrians,
  useEmergencyVehicles,
  useAircraft,
  useBoats,
  useFireworks,
  useSmog,
} from '@/components/game/hooks';

// Import rendering utilities
import {
  drawCars as drawCarsUtil,
  drawEmergencyVehicles as drawEmergencyVehiclesUtil,
  drawBoats as drawBoatsUtil,
  drawFireworks as drawFireworksUtil,
  drawSmog as drawSmogUtil,
  drawIncidentIndicators,
} from '@/components/game/rendering';
```

### Step 2: Set up worldStateRef and other shared refs

```typescript
const worldStateRef = useRef<WorldRenderState>({
  grid,
  gridSize,
  offset,
  zoom,
  speed,
  canvasSize,
});

const gridVersionRef = useRef(0);
const cachedPopulationRef = useRef<{ count: number; gridVersion: number }>({ 
  count: 0, 
  gridVersion: -1 
});

// Update worldStateRef when dependencies change
useEffect(() => {
  worldStateRef.current.grid = grid;
  worldStateRef.current.gridSize = gridSize;
  gridVersionRef.current++;
}, [grid, gridSize]);

useEffect(() => {
  worldStateRef.current.offset = offset;
}, [offset]);

useEffect(() => {
  worldStateRef.current.zoom = zoom;
}, [zoom]);

useEffect(() => {
  worldStateRef.current.speed = speed;
}, [speed]);

useEffect(() => {
  worldStateRef.current.canvasSize = canvasSize;
}, [canvasSize]);
```

### Step 3: Initialize all hooks

```typescript
// Cars
const { carsRef, updateCars } = useCars(worldStateRef, isMobile);

// Pedestrians
const { pedestriansRef, updatePedestrians } = usePedestrians(
  worldStateRef,
  gridVersionRef,
  isMobile
);

// Emergency vehicles
const {
  emergencyVehiclesRef,
  activeCrimeIncidentsRef,
  updateEmergencyVehicles,
  spawnCrimeIncidents,
  updateCrimeIncidents,
} = useEmergencyVehicles(worldStateRef, state);

// Aircraft
const {
  airplanesRef,
  updateAirplanes,
  helicoptersRef,
  updateHelicopters,
} = useAircraft(worldStateRef, gridVersionRef, cachedPopulationRef, isMobile);

// Boats
const { boatsRef, updateBoats } = useBoats(worldStateRef, isMobile);

// Fireworks
const { fireworksRef, updateFireworks } = useFireworks(worldStateRef, isMobile);

// Smog
const { factorySmogRef, updateSmog } = useSmog(
  worldStateRef,
  gridVersionRef,
  isMobile
);
```

### Step 4: Update the animation loop useEffect

```typescript
useEffect(() => {
  const canvas = carsCanvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.imageSmoothingEnabled = false;
  
  let animationFrameId: number;
  let lastTime = performance.now();
  let lastRenderTime = 0;
  let incidentAnimTime = 0;
  
  const targetFrameTime = isMobile ? 33 : 16;
  
  const render = (time: number) => {
    animationFrameId = requestAnimationFrame(render);
    
    const timeSinceLastRender = time - lastRenderTime;
    if (isMobile && timeSinceLastRender < targetFrameTime) {
      return;
    }
    
    const delta = Math.min((time - lastTime) / 1000, 0.3);
    lastTime = time;
    lastRenderTime = time;
    
    if (delta > 0) {
      // Update all systems
      updateCars(delta);
      spawnCrimeIncidents(delta);
      updateCrimeIncidents(delta);
      updateEmergencyVehicles(delta);
      updatePedestrians(delta);
      updateAirplanes(delta);
      updateHelicopters(delta);
      updateBoats(delta);
      updateFireworks(delta, hour);
      updateSmog(delta);
      
      incidentAnimTime += delta;
    }
    
    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all systems using utilities
    drawCarsUtil(ctx, carsRef.current, worldStateRef.current);
    drawPedestriansUtil(ctx, pedestriansRef.current, worldStateRef.current);
    drawBoatsUtil(ctx, boatsRef.current, worldStateRef.current);
    drawSmogUtil(ctx, factorySmogRef.current, worldStateRef.current);
    drawEmergencyVehiclesUtil(ctx, emergencyVehiclesRef.current, worldStateRef.current);
    drawIncidentIndicators(
      ctx,
      worldStateRef.current,
      activeCrimeIncidentsRef.current,
      incidentAnimTime,
      delta
    );
    drawHelicoptersUtil(ctx, helicoptersRef.current, worldStateRef.current);
    drawAirplanesUtil(ctx, airplanesRef.current, worldStateRef.current);
    drawFireworksUtil(ctx, fireworksRef.current, worldStateRef.current);
  };
  
  animationFrameId = requestAnimationFrame(render);
  return () => cancelAnimationFrame(animationFrameId);
}, [
  canvasSize.width, canvasSize.height, hour, isMobile,
  updateCars, spawnCrimeIncidents, updateCrimeIncidents,
  updateEmergencyVehicles, updatePedestrians, updateAirplanes,
  updateHelicopters, updateBoats, updateFireworks, updateSmog,
]);
```

## Performance Improvements

### Memoization Opportunities

1. **Memoize grid calculations:**
```typescript
const parkBuildingsSet = useMemo(() => new Set<BuildingType>([
  'park', 'park_large', 'tennis', /* ... */
]), []);
```

2. **Memoize callback functions with useCallback:**
```typescript
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  // ... handler logic
}, [/* dependencies */]);
```

3. **Memoize expensive computations:**
```typescript
const viewportBounds = useMemo(() => 
  calculateViewportBounds(offset, zoom, canvasSize, gridSize),
  [offset, zoom, canvasSize, gridSize]
);
```

## Benefits of This Refactoring

1. **Reduced File Size**: Main component is more manageable
2. **Better Separation of Concerns**: Each system is isolated
3. **Easier Testing**: Hooks can be tested independently
4. **Better Performance**: Proper memoization and optimization opportunities
5. **Improved Maintainability**: Easier to find and fix bugs
6. **Reusability**: Hooks can be reused in other components if needed

## Migration Checklist

- [x] Extract car system to `useCars` hook
- [x] Extract pedestrian system to `usePedestrians` hook
- [x] Extract emergency vehicle system to `useEmergencyVehicles` hook
- [x] Extract aircraft systems to `useAircraft` hook
- [x] Extract boat system to `useBoats` hook
- [x] Extract firework system to `useFireworks` hook
- [x] Extract smog system to `useSmog` hook
- [x] Create rendering utilities for all systems
- [ ] Update main component to use all hooks
- [ ] Add comprehensive memoization
- [ ] Remove old code from main component
- [ ] Test all functionality

## Notes

- The original file remains intact for reference
- Event handlers remain in the main component (they're tightly coupled to UI state)
- The main tile/building rendering loop stays in the component
- All dynamic entity systems have been extracted
