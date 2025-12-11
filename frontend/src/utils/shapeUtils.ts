import type { Shape } from '../types';

export const calculateBoundingBox = (points: number[]): { x: number, y: number, width: number, height: number } => {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = points[0];
  let maxX = points[0];
  let minY = points[1];
  let maxY = points[1];
  
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export const transformPoints = (points: number[], oldBbox: any, newBbox: any): number[] => {
  const newPoints: number[] = [];
  
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    
    const relX = oldBbox.width !== 0 ? (x - oldBbox.x) / oldBbox.width : 0;
    const relY = oldBbox.height !== 0 ? (y - oldBbox.y) / oldBbox.height : 0;
    
    newPoints.push(newBbox.x + relX * newBbox.width);
    newPoints.push(newBbox.y + relY * newBbox.height);
  }
  
  return newPoints;
};

export const distanceToLineSegment = (
  p: { x: number, y: number }, 
  a: { x: number, y: number }, 
  b: { x: number, y: number }
): number => {
  const A = p.x - a.x;
  const B = p.y - a.y;
  const C = b.x - a.x;
  const D = b.y - a.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = a.x;
    yy = a.y;
  } else if (param > 1) {
    xx = b.x;
    yy = b.y;
  } else {
    xx = a.x + param * C;
    yy = a.y + param * D;
  }

  const dx = p.x - xx;
  const dy = p.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
};

export const isPointInShape = (shape: Shape, point: { x: number, y: number }): boolean => {
  if (shape.type === 'path' || shape.type === 'highlighter') {
    if (!shape.points || shape.points.length < 4) return false;
    
    for (let i = 0; i < shape.points.length - 2; i += 2) {
      const x1 = shape.points[i];
      const y1 = shape.points[i + 1];
      const x2 = shape.points[i + 2];
      const y2 = shape.points[i + 3];
      
      if (distanceToLineSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 }) < 10) {
        return true;
      }
    }
    return false;
  }
  
  if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'latex') {
    const realX = Math.min(shape.x, shape.x + shape.width);
    const realY = Math.min(shape.y, shape.y + shape.height);
    const realWidth = Math.abs(shape.width);
    const realHeight = Math.abs(shape.height);
    
    return point.x >= realX && 
           point.x <= realX + realWidth && 
           point.y >= realY && 
           point.y <= realY + realHeight;
  }
  
  if (shape.type === 'ellipse') {
    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    const radiusX = Math.abs(shape.width) / 2;
    const radiusY = Math.abs(shape.height) / 2;
    
    const normalizedX = point.x - centerX;
    const normalizedY = point.y - centerY;
    
    return (normalizedX * normalizedX) / (radiusX * radiusX) + 
           (normalizedY * normalizedY) / (radiusY * radiusY) <= 1;
  }
  
  if (shape.type === 'line' && shape.points) {
    const [x1, y1, x2, y2] = shape.points;
    const distance = distanceToLineSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 });
    return distance < 10;
  }
  
  return false;
};