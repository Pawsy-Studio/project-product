import { useState } from 'react';
import type  { DrawingState, TransformState } from '../types';

export const useDrawingState = () => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentShape: null
  });
  
  const [transformState, setTransformState] = useState<TransformState>({
    isTransforming: false,
    shapeId: null,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0,
    startMouseX: 0,
    startMouseY: 0,
    anchor: null,
    originalPoints: [],
    originalBbox: { x: 0, y: 0, width: 0, height: 0 }
  });

  const resetDrawingState = () => {
    setDrawingState({
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentShape: null
    });
  };

  const resetTransformState = () => {
    setTransformState({
      isTransforming: false,
      shapeId: null,
      startWidth: 0,
      startHeight: 0,
      startX: 0,
      startY: 0,
      startMouseX: 0,
      startMouseY: 0,
      anchor: null,
      originalPoints: [],
      originalBbox: { x: 0, y: 0, width: 0, height: 0 }
    });
  };

  return {
    drawingState,
    setDrawingState,
    transformState,
    setTransformState,
    resetDrawingState,
    resetTransformState
  };
};