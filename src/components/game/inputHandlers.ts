// Input Handlers - Mouse, wheel, and touch event handlers
// Handles pan, zoom, and tile selection interactions

import { TILE_WIDTH, TILE_HEIGHT, WorldRenderState } from './types';

// ============================================================================
// Types
// ============================================================================

export type DragState = {
  isDragging: boolean;
  startX: number;
  startY: number;
  startOffset: { x: number; y: number };
};

export type PinchState = {
  isPinching: boolean;
  initialDistance: number;
  initialZoom: number;
  centerX: number;
  centerY: number;
};

export type InputRefs = {
  dragState: React.MutableRefObject<DragState>;
  pinchState: React.MutableRefObject<PinchState>;
  lastMouseMove: React.MutableRefObject<number>;
  worldState: WorldRenderState;
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isPanningAllowed: boolean;
};

// ============================================================================
// Coordinate Conversion
// ============================================================================

/**
 * Convert screen coordinates to grid coordinates
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  offset: { x: number; y: number },
  zoom: number
): { gridX: number; gridY: number } {
  // Convert to world coordinates
  const worldX = (screenX - offset.x) / zoom;
  const worldY = (screenY - offset.y) / zoom;
  
  // Convert from isometric
  const gridX = Math.floor(worldX / TILE_WIDTH + worldY / TILE_HEIGHT);
  const gridY = Math.floor(worldY / TILE_HEIGHT - worldX / TILE_WIDTH);
  
  return { gridX, gridY };
}

/**
 * Get grid coordinates from mouse event
 */
export function getGridCoordsFromEvent(
  event: React.MouseEvent | MouseEvent,
  canvas: HTMLCanvasElement | null,
  worldState: WorldRenderState
): { gridX: number; gridY: number } | null {
  if (!canvas) return null;
  
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  
  return screenToGrid(screenX, screenY, worldState.offset, worldState.zoom);
}

// ============================================================================
// Mouse Handlers
// ============================================================================

/**
 * Handle mouse down - start panning or select tile
 */
export function handleMouseDown(
  event: React.MouseEvent<HTMLCanvasElement>,
  refs: InputRefs,
  onTileSelect?: (gridX: number, gridY: number) => void
): void {
  const { dragState, worldState, isPanningAllowed } = refs;
  
  // Middle mouse button always pans
  if (event.button === 1) {
    event.preventDefault();
    dragState.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: { ...worldState.offset },
    };
    return;
  }
  
  // Left button
  if (event.button === 0) {
    if (isPanningAllowed) {
      dragState.current = {
        isDragging: true,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: { ...worldState.offset },
      };
    }
  }
}

/**
 * Handle mouse move - pan the view if dragging
 */
export function handleMouseMove(
  event: React.MouseEvent<HTMLCanvasElement>,
  refs: InputRefs
): void {
  const { dragState, setOffset, lastMouseMove } = refs;
  
  // Rate limit mouse move handling (important for performance)
  const now = Date.now();
  if (now - lastMouseMove.current < 16) return; // ~60fps
  lastMouseMove.current = now;
  
  if (!dragState.current.isDragging) return;
  
  const dx = event.clientX - dragState.current.startX;
  const dy = event.clientY - dragState.current.startY;
  
  setOffset({
    x: dragState.current.startOffset.x + dx,
    y: dragState.current.startOffset.y + dy,
  });
}

/**
 * Handle mouse up - end panning and potentially select tile
 */
export function handleMouseUp(
  event: React.MouseEvent<HTMLCanvasElement>,
  refs: InputRefs,
  canvas: HTMLCanvasElement | null,
  onTileSelect?: (gridX: number, gridY: number) => void
): void {
  const { dragState, worldState, isPanningAllowed } = refs;
  
  if (!dragState.current.isDragging) {
    // Click without drag - select tile
    if (onTileSelect && event.button === 0) {
      const coords = getGridCoordsFromEvent(event, canvas, worldState);
      if (coords && coords.gridX >= 0 && coords.gridX < worldState.gridSize &&
          coords.gridY >= 0 && coords.gridY < worldState.gridSize) {
        onTileSelect(coords.gridX, coords.gridY);
      }
    }
    return;
  }
  
  // Calculate drag distance to determine if this was a click or drag
  const dx = Math.abs(event.clientX - dragState.current.startX);
  const dy = Math.abs(event.clientY - dragState.current.startY);
  const wasDragging = dx > 5 || dy > 5;
  
  dragState.current.isDragging = false;
  
  // If it was a click (not a drag), select tile
  if (!wasDragging && onTileSelect && event.button === 0 && !isPanningAllowed) {
    const coords = getGridCoordsFromEvent(event, canvas, worldState);
    if (coords && coords.gridX >= 0 && coords.gridX < worldState.gridSize &&
        coords.gridY >= 0 && coords.gridY < worldState.gridSize) {
      onTileSelect(coords.gridX, coords.gridY);
    }
  }
}

/**
 * Handle mouse leave - cancel panning
 */
export function handleMouseLeave(refs: InputRefs): void {
  refs.dragState.current.isDragging = false;
}

// ============================================================================
// Wheel Handler (Zoom)
// ============================================================================

/**
 * Calculate zoom constraints based on grid size
 */
export function getZoomConstraints(gridSize: number): { min: number; max: number } {
  const minZoom = gridSize > 40 ? 0.15 : gridSize > 30 ? 0.2 : 0.3;
  const maxZoom = 2.5;
  return { min: minZoom, max: maxZoom };
}

/**
 * Handle wheel event for zooming
 * Zooms toward mouse position
 */
export function handleWheel(
  event: React.WheelEvent<HTMLCanvasElement>,
  refs: InputRefs,
  canvas: HTMLCanvasElement | null
): void {
  event.preventDefault();
  
  const { worldState, setZoom, setOffset } = refs;
  
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  
  const { min: minZoom, max: maxZoom } = getZoomConstraints(worldState.gridSize);
  
  // Calculate zoom delta (smoother zoom)
  const zoomSensitivity = 0.001;
  const delta = -event.deltaY * zoomSensitivity;
  const newZoom = Math.max(minZoom, Math.min(maxZoom, worldState.zoom * (1 + delta)));
  
  // Zoom toward mouse position
  const zoomRatio = newZoom / worldState.zoom;
  const newOffsetX = mouseX - (mouseX - worldState.offset.x) * zoomRatio;
  const newOffsetY = mouseY - (mouseY - worldState.offset.y) * zoomRatio;
  
  setZoom(newZoom);
  setOffset({ x: newOffsetX, y: newOffsetY });
}

// ============================================================================
// Touch Handlers (Mobile)
// ============================================================================

/**
 * Get distance between two touch points
 */
function getTouchDistance(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/**
 * Get center point between two touch points
 */
function getTouchCenter(touches: React.TouchList): { x: number; y: number } {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

/**
 * Handle touch start - start panning or pinch zoom
 */
export function handleTouchStart(
  event: React.TouchEvent<HTMLCanvasElement>,
  refs: InputRefs,
  canvas: HTMLCanvasElement | null
): void {
  const { dragState, pinchState, worldState } = refs;
  
  event.preventDefault();
  
  if (event.touches.length === 1) {
    // Single touch - start panning
    const touch = event.touches[0];
    dragState.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: { ...worldState.offset },
    };
    pinchState.current.isPinching = false;
  } else if (event.touches.length === 2) {
    // Two touches - start pinch zoom
    pinchState.current = {
      isPinching: true,
      initialDistance: getTouchDistance(event.touches),
      initialZoom: worldState.zoom,
      centerX: getTouchCenter(event.touches).x,
      centerY: getTouchCenter(event.touches).y,
    };
    dragState.current.isDragging = false;
  }
}

/**
 * Handle touch move - pan or pinch zoom
 */
export function handleTouchMove(
  event: React.TouchEvent<HTMLCanvasElement>,
  refs: InputRefs,
  canvas: HTMLCanvasElement | null
): void {
  const { dragState, pinchState, worldState, setOffset, setZoom } = refs;
  
  event.preventDefault();
  
  if (pinchState.current.isPinching && event.touches.length === 2) {
    // Pinch zoom
    const currentDistance = getTouchDistance(event.touches);
    const scale = currentDistance / pinchState.current.initialDistance;
    
    const { min: minZoom, max: maxZoom } = getZoomConstraints(worldState.gridSize);
    const newZoom = Math.max(minZoom, Math.min(maxZoom, pinchState.current.initialZoom * scale));
    
    // Zoom toward center of pinch
    const rect = canvas?.getBoundingClientRect();
    if (rect) {
      const center = getTouchCenter(event.touches);
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;
      
      const zoomRatio = newZoom / worldState.zoom;
      const newOffsetX = centerX - (centerX - worldState.offset.x) * zoomRatio;
      const newOffsetY = centerY - (centerY - worldState.offset.y) * zoomRatio;
      
      setZoom(newZoom);
      setOffset({ x: newOffsetX, y: newOffsetY });
    } else {
      setZoom(newZoom);
    }
  } else if (dragState.current.isDragging && event.touches.length === 1) {
    // Single touch panning
    const touch = event.touches[0];
    const dx = touch.clientX - dragState.current.startX;
    const dy = touch.clientY - dragState.current.startY;
    
    setOffset({
      x: dragState.current.startOffset.x + dx,
      y: dragState.current.startOffset.y + dy,
    });
  }
}

/**
 * Handle touch end - end panning/pinching, possibly select tile
 */
export function handleTouchEnd(
  event: React.TouchEvent<HTMLCanvasElement>,
  refs: InputRefs,
  canvas: HTMLCanvasElement | null,
  onTileSelect?: (gridX: number, gridY: number) => void
): void {
  const { dragState, pinchState, worldState } = refs;
  
  // Check if this was a tap (not a drag or pinch)
  if (!pinchState.current.isPinching && dragState.current.isDragging) {
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const dx = Math.abs(touch.clientX - dragState.current.startX);
      const dy = Math.abs(touch.clientY - dragState.current.startY);
      
      // If it was a tap (small movement), select tile
      if (dx < 10 && dy < 10 && onTileSelect && canvas) {
        const rect = canvas.getBoundingClientRect();
        const screenX = touch.clientX - rect.left;
        const screenY = touch.clientY - rect.top;
        
        const coords = screenToGrid(screenX, screenY, worldState.offset, worldState.zoom);
        if (coords.gridX >= 0 && coords.gridX < worldState.gridSize &&
            coords.gridY >= 0 && coords.gridY < worldState.gridSize) {
          onTileSelect(coords.gridX, coords.gridY);
        }
      }
    }
  }
  
  // Reset states
  if (event.touches.length === 0) {
    dragState.current.isDragging = false;
    pinchState.current.isPinching = false;
  } else if (event.touches.length === 1) {
    // Transitioned from 2 to 1 finger - start panning
    pinchState.current.isPinching = false;
    const touch = event.touches[0];
    dragState.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startOffset: { ...worldState.offset },
    };
  }
}

// ============================================================================
// Keyboard Handlers
// ============================================================================

/**
 * Handle keyboard navigation
 */
export function handleKeyDown(
  event: KeyboardEvent,
  refs: InputRefs,
  panSpeed: number = 20
): void {
  const { worldState, setOffset, setZoom } = refs;
  
  const key = event.key.toLowerCase();
  
  // Arrow keys / WASD for panning
  switch (key) {
    case 'arrowup':
    case 'w':
      setOffset(prev => ({ ...prev, y: prev.y + panSpeed }));
      event.preventDefault();
      break;
    case 'arrowdown':
    case 's':
      setOffset(prev => ({ ...prev, y: prev.y - panSpeed }));
      event.preventDefault();
      break;
    case 'arrowleft':
    case 'a':
      setOffset(prev => ({ ...prev, x: prev.x + panSpeed }));
      event.preventDefault();
      break;
    case 'arrowright':
    case 'd':
      setOffset(prev => ({ ...prev, x: prev.x - panSpeed }));
      event.preventDefault();
      break;
    case '+':
    case '=':
      // Zoom in
      {
        const { max: maxZoom } = getZoomConstraints(worldState.gridSize);
        setZoom(prev => Math.min(maxZoom, prev * 1.1));
        event.preventDefault();
      }
      break;
    case '-':
    case '_':
      // Zoom out
      {
        const { min: minZoom } = getZoomConstraints(worldState.gridSize);
        setZoom(prev => Math.max(minZoom, prev / 1.1));
        event.preventDefault();
      }
      break;
  }
}
