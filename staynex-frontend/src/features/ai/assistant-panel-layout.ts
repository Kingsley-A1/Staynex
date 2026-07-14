export type FloatingPosition = { x: number; y: number };
export type FloatingSize = { width: number; height: number };

export function floatingPanelSize(
  isExpanded: boolean,
  viewportWidth: number,
  viewportHeight: number,
): FloatingSize {
  return {
    width: Math.min(isExpanded ? 760 : 440, viewportWidth - 32),
    height: Math.min(isExpanded ? 800 : 600, viewportHeight - 32),
  };
}

export function clampFloatingPosition(
  position: FloatingPosition,
  size: FloatingSize,
  viewportWidth: number,
  viewportHeight: number,
): FloatingPosition {
  return {
    x: Math.min(
      Math.max(16, position.x),
      Math.max(16, viewportWidth - size.width - 16),
    ),
    y: Math.min(
      Math.max(16, position.y),
      Math.max(16, viewportHeight - size.height - 16),
    ),
  };
}
