# Game Hooks

This directory contains custom React hooks for managing various game systems in the isometric city builder.

## Available Hooks

### `useCars(worldStateRef, isMobile)`
Manages the car traffic system including spawning, movement, and lifecycle.

### `usePedestrians(worldStateRef, gridVersionRef, isMobile)`
Manages pedestrian spawning, pathfinding between buildings, and movement animations.

### `useEmergencyVehicles(worldStateRef, state)`
Manages emergency response system:
- Fire trucks responding to fires
- Police cars responding to crimes  
- Crime incident spawning and tracking

### `useAircraft(worldStateRef, gridVersionRef, cachedPopulationRef, isMobile)`
Manages aerial traffic:
- Airplanes taking off, flying, and landing at airports
- Helicopters touring between heliports
- Contrails and rotor wash effects

### `useBoats(worldStateRef, isMobile)`
Manages water traffic:
- Boats touring waterways from marinas/piers
- Wake particle effects

### `useFireworks(worldStateRef, isMobile)`
Manages firework shows:
- Nighttime firework displays from stadiums and large buildings
- Particle explosion effects

### `useSmog(worldStateRef, gridVersionRef, isMobile)`
Manages pollution effects:
- Smog particle generation from factories
- Particle drift and fade animations

## Common Patterns

All hooks follow a similar pattern:

```typescript
const { 
  dataRef,           // Ref to current data
  updateFunction,    // Function to call each frame
} = useHook(worldStateRef, ...otherParams);
```

The `worldStateRef` parameter is a shared ref object containing:
```typescript
{
  grid: Tile[][];
  gridSize: number;
  offset: { x: number; y: number };
  zoom: number;
  speed: number;
  canvasSize: { width: number; height: number };
}
```

## Performance Considerations

- All hooks use refs to avoid triggering re-renders
- Update functions are memoized with `useCallback`
- Mobile optimizations reduce particle counts and update frequencies
- Zoom-based culling skips updates when entities won't be visible
