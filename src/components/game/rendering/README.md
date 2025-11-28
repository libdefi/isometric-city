# Game Rendering Utilities

This directory contains rendering functions for various game systems. All functions are pure and don't modify state.

## Available Functions

### `drawCars(ctx, cars, worldState)`
Renders cars with:
- Proper rotation based on direction
- Lane offset for traffic realism
- Occlusion behind buildings (dimmed)
- Viewport culling for performance

### `drawEmergencyVehicles(ctx, vehicles, worldState)`
Renders fire trucks and police cars with:
- Distinctive colors (red/blue)
- Flashing light animations
- Stationary rendering when responding at scene
- Occlusion behind buildings

### `drawBoats(ctx, boats, worldState)`
Renders boats and water effects with:
- Wake particle trails
- Different sizes (small/medium variants)
- Smooth rotation based on heading

### `drawFireworks(ctx, fireworks, worldState)`
Renders firework displays with:
- Launch trails
- Explosion particle systems
- Trail effects on particles
- Color variations

### `drawSmog(ctx, factorySmog, worldState)`
Renders pollution effects with:
- Particle drift and rise animations
- Zoom-based fading (invisible when zoomed in)
- Opacity variations for depth

### `drawIncidentIndicators(ctx, worldState, activeCrimeIncidents, incidentAnimTime, delta)`
Renders emergency indicators with:
- Pulsing fire icons (red)
- Pulsing crime icons (blue)
- Positioned above buildings
- Viewport culling

## Function Signature Pattern

All rendering functions follow this pattern:

```typescript
function drawSystem(
  ctx: CanvasRenderingContext2D,
  data: SystemData[],
  worldState: WorldRenderState
): void
```

Where:
- `ctx` is the canvas 2D rendering context
- `data` is the array of entities to render
- `worldState` contains camera/world information

## Performance Features

- **Viewport Culling**: Entities outside the visible area are skipped
- **Occlusion Handling**: Entities behind buildings are dimmed
- **Mobile Optimizations**: Reduced particle effects on mobile devices
- **Batch Rendering**: All entities of a type rendered in one pass

## Usage Example

```typescript
// In component's render loop
const ctx = canvas.getContext('2d');
const worldState = worldStateRef.current;

// Clear canvas
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Draw systems in order (back to front)
drawBoats(ctx, boatsRef.current, worldState);
drawSmog(ctx, smogRef.current, worldState);
drawCars(ctx, carsRef.current, worldState);
drawEmergencyVehicles(ctx, vehiclesRef.current, worldState);
drawFireworks(ctx, fireworksRef.current, worldState);
```

## Coordinate Systems

- **World Coordinates**: Isometric grid positions
- **Screen Coordinates**: Canvas pixel positions after zoom/pan
- **Viewport**: Visible screen area in world coordinates

The `worldState.offset` and `worldState.zoom` are used to transform between coordinate systems.
