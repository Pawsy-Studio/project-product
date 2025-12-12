import { useCallback, useState } from 'react';
import type  { Shape, DrawingState, TransformState, ToolMode } from '../types';
import { calculateBoundingBox, isPointInShape, transformPoints } from '../utils/shapeUtils';
import { measureLatexSize, renderLatexToHtml } from '../utils/latexUtils';

export const useDrawingHandlers = (
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  saveToHistory: (shapes: Shape[]) => void,
  tool: ToolMode,
  strokeColor: string,
  strokeWidth: number,
  fontSize: number,
  fontFamily: string,
  textAlign: 'left' | 'center' | 'right',
  selectedId: string | null,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
  setDrawingState: React.Dispatch<React.SetStateAction<DrawingState>>,
  setTransformState: React.Dispatch<React.SetStateAction<TransformState>>,
  startTextEditing: (id: string) => void
) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedShapeStart, setSelectedShapeStart] = useState({ x: 0, y: 0 });
  const [originalPointsOnDragStart, setOriginalPointsOnDragStart] = useState<number[]>([]);
  const [erasedShapes, setErasedShapes] = useState<Set<string>>(new Set());
  const [eraserHistoryStart, setEraserHistoryStart] = useState<Shape[] | null>(null);

  const handleMouseDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (pos.x < 0 || pos.x > 1000 || pos.y < 0 || pos.y > 387) {
      return;
    }
    
    if (e.target.attrs.name && e.target.attrs.name.startsWith('anchor-')) {
      const shapeId = e.target.attrs.shapeId;
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && tool === 'select') {
        const anchor = e.target.attrs.name.replace('anchor-', '') as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        
        let originalPoints = shape.points;
        let originalBbox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        
        if ((shape.type === 'path' || shape.type === 'line' || shape.type === 'highlighter') && shape.points) {
          originalPoints = [...shape.points];
          const bbox = calculateBoundingBox(shape.points);
          originalBbox = bbox;
        }
        
        setTransformState({
          isTransforming: true,
          shapeId,
          startWidth: shape.width,
          startHeight: shape.height,
          startX: shape.x,
          startY: shape.y,
          startMouseX: pos.x,
          startMouseY: pos.y,
          anchor,
          originalPoints,
          originalBbox,
          startFontSize: shape.fontSize || fontSize
        });
      }
      return;
    }
    
    if (e.target === stage) {
      if (tool === 'select') {
        setSelectedId(null);
        setShapes(shapes.map(shape => ({ ...shape, isSelected: false, isEditing: false })));
      }
      
      if (tool === 'text' || tool === 'latex') {
        const isLatex = tool === 'latex';
        let initialText = isLatex ? 'E = mc^2' : 'Text';
        const currentFontSize = fontSize;
        
        if (isLatex) {
          const size = measureLatexSize(initialText, currentFontSize);
          var newTextShape: Shape = {
            id: `${isLatex ? 'latex' : 'text'}_${Date.now()}`,
            type: isLatex ? 'latex' : 'text',
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            stroke: strokeColor,
            strokeWidth: 1,
            text: isLatex ? '' : 'Text',
            latex: isLatex ? initialText : undefined,
            latexRendered: isLatex ? renderLatexToHtml(initialText, currentFontSize) : undefined,
            fontSize: currentFontSize,
            fontFamily: fontFamily,
            textAlign: textAlign,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            isSelected: true,
            isEditing: false,
            isLatex: isLatex,
            scaleX: 1,
            scaleY: 1,
            rotation: 0
          };
        } else {
          const lineHeight = currentFontSize;
          const lines = initialText.split('\n').length || 1;
          const height = Math.max(lines * lineHeight * 1.2, 50);
          
          var newTextShape: Shape = {
            id: `${isLatex ? 'latex' : 'text'}_${Date.now()}`,
            type: isLatex ? 'latex' : 'text',
            x: pos.x,
            y: pos.y,
            width: 200,
            height: height,
            stroke: strokeColor,
            strokeWidth: 1,
            text: initialText,
            latex: undefined,
            latexRendered: undefined,
            fontSize: currentFontSize,
            fontFamily: fontFamily,
            textAlign: textAlign,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            isSelected: true,
            isEditing: false,
            isLatex: isLatex,
            scaleX: 1,
            scaleY: 1,
            rotation: 0
          };
        }
        
        const newShapes = [...shapes, newTextShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
        
        setTimeout(() => {
          startTextEditing(newTextShape.id);
        }, 10);
      }
      else if (tool === 'eraser') {
        setEraserHistoryStart([...shapes]);
        
        const newErasedShapes = new Set<string>();
        shapes.forEach(shape => {
          if (isPointInShape(shape, pos)) {
            newErasedShapes.add(shape.id);
          }
        });
        
        if (newErasedShapes.size > 0) {
          const newShapes = shapes.filter(shape => !newErasedShapes.has(shape.id));
          setShapes(newShapes);
        }
        
        setErasedShapes(newErasedShapes);
        
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `eraser_${Date.now()}`,
            type: 'path',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: '#000000',
            strokeWidth: strokeWidth,
            opacity: 1,
            points: [pos.x, pos.y]
          }
        });
      }
      else if (!['select', 'text', 'latex'].includes(tool)) {
        const shapeType = tool === 'pencil' ? 'path' : tool === 'highlighter' ? 'highlighter' : tool;
        
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: shapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: tool === 'highlighter' ? 0.5 : 1,
            points: (tool === 'pencil' || tool === 'highlighter') ? [pos.x, pos.y] : undefined
          }
        });
      }
      return;
    }
    
    if (tool === 'select' && e.target.attrs.id) {
      const targetId = e.target.attrs.id;
      const shape = shapes.find(s => s.id === targetId);
      
      if (shape) {
        setSelectedId(targetId);
        
        if ((shape.type === 'text' || shape.type === 'latex') && e.evt.detail === 2) {
          startTextEditing(targetId);
          return;
        }
        
        setIsDragging(true);
        setDragStart({ x: pos.x, y: pos.y });
        setSelectedShapeStart({ x: shape.x, y: shape.y });
        
        if ((shape.type === 'path' || shape.type === 'line' || shape.type === 'highlighter') && shape.points) {
          setOriginalPointsOnDragStart([...shape.points]);
        }
        
        setShapes(shapes.map(s => ({
          ...s,
          isSelected: s.id === targetId,
          isEditing: false
        })));
      }
      return;
    }
    
    if (!['select', 'text', 'latex'].includes(tool)) {
      if (tool === 'eraser') {
        setEraserHistoryStart([...shapes]);
        
        const newErasedShapes = new Set<string>();
        shapes.forEach(shape => {
          if (isPointInShape(shape, pos)) {
            newErasedShapes.add(shape.id);
          }
        });
        
        if (newErasedShapes.size > 0) {
          const newShapes = shapes.filter(shape => !newErasedShapes.has(shape.id));
          setShapes(newShapes);
        }
        
        setErasedShapes(newErasedShapes);
        
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `eraser_${Date.now()}`,
            type: 'path',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: '#000000',
            strokeWidth: strokeWidth,
            opacity: 1,
            points: [pos.x, pos.y]
          }
        });
      } else {
        const shapeType = tool === 'pencil' ? 'path' : tool === 'highlighter' ? 'highlighter' : tool;
        
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: shapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: tool === 'highlighter' ? 0.5 : 1,
            points: (tool === 'pencil' || tool === 'highlighter') ? [pos.x, pos.y] : undefined
          }
        });
      }
    }
  }, [
    shapes, setShapes, tool, strokeColor, strokeWidth, fontSize, fontFamily, textAlign,
    selectedId, setSelectedId, setDrawingState, setTransformState, startTextEditing
  ]);

  const handleMouseMove = useCallback((
    e: any,
    drawingState: DrawingState,
    transformState: TransformState,
    shiftPressed: boolean
  ) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    const clampedX = Math.max(0, Math.min(pos.x, 1000));
    const clampedY = Math.max(0, Math.min(pos.y, 387));
    const clampedPos = { x: clampedX, y: clampedY };
    
    if (drawingState.isDrawing && drawingState.currentShape) {
      const { startX, startY, currentShape } = drawingState;
      
      if (tool === 'pencil' || tool === 'eraser' || tool === 'highlighter') {
        const updatedShape = {
          ...currentShape,
          points: [...(currentShape.points || []), clampedPos.x, clampedPos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
        
        if (tool === 'eraser') {
          const shapesToErase = shapes.filter(shape => isPointInShape(shape, clampedPos));
          
          if (shapesToErase.length > 0) {
            const newErasedShapes = new Set(erasedShapes);
            shapesToErase.forEach(shape => {
              newErasedShapes.add(shape.id);
            });
            
            const newShapes = shapes.filter(shape => !newErasedShapes.has(shape.id));
            setShapes(newShapes);
            setErasedShapes(newErasedShapes);
          }
        }
      } 
      else if (tool === 'line') {
        const updatedShape = {
          ...currentShape,
          points: [startX, startY, clampedPos.x, clampedPos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
      }
      else if (tool === 'rectangle' || tool === 'ellipse') {
        let width = clampedPos.x - startX;
        let height = clampedPos.y - startY;
        
        if (shiftPressed) {
          const size = Math.max(Math.abs(width), Math.abs(height));
          width = Math.sign(width) * size;
          height = Math.sign(height) * size;
        }
        
        let updatedShape = { 
          ...currentShape, 
          x: startX,
          y: startY,
          width: width,
          height: height
        };
        
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
      }
    }
    else if (transformState.isTransforming && transformState.shapeId) {
      const { startWidth, startHeight, startX, startY, startMouseX, startMouseY, anchor, originalPoints, originalBbox, startFontSize } = transformState;
      
      if (!anchor) return;
      
      const deltaX = clampedPos.x - startMouseX;
      const deltaY = clampedPos.y - startMouseY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;

      switch (anchor) {
        case 'top-left':
          newWidth = startWidth - deltaX;
          newHeight = startHeight - deltaY;
          newX = startX + deltaX;
          newY = startY + deltaY;
          break;
        case 'top-right':
          newWidth = startWidth + deltaX;
          newHeight = startHeight - deltaY;
          newY = startY + deltaY;
          break;
        case 'bottom-left':
          newWidth = startWidth - deltaX;
          newHeight = startHeight + deltaY;
          newX = startX + deltaX;
          break;
        case 'bottom-right':
          newWidth = startWidth + deltaX;
          newHeight = startHeight + deltaY;
          break;
      }

      // ---- НОРМАЛИЗАЦИЯ ЗЕРКАЛЬНОЙ ТРАНСФОРМАЦИИ ----
      let finalX = newX;
      let finalY = newY;
      let finalW = newWidth;
      let finalH = newHeight;

      if (finalW < 0) {
        finalX = finalX + finalW;
        finalW = Math.abs(finalW);
      }

      if (finalH < 0) {
        finalY = finalY + finalH;
        finalH = Math.abs(finalH);
      }
      // ----------------------------------------------

      const updatedShapes = shapes.map(s => {
        if (s.id === transformState.shapeId) {

          if ((s.type === 'path' || s.type === 'line' || s.type === 'highlighter') &&
              originalPoints && originalBbox)
          {
            const newBbox = { 
              x: finalX, 
              y: finalY, 
              width: finalW, 
              height: finalH 
            };
            const transformedPoints = transformPoints(originalPoints, originalBbox, newBbox);
            
            return { 
              ...s, 
              width: finalW, 
              height: finalH, 
              x: finalX, 
              y: finalY,
              points: transformedPoints
            };
          } 
          else {
            return { 
              ...s, 
              width: finalW, 
              height: finalH, 
              x: finalX, 
              y: finalY 
            };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
    else if (isDragging && selectedId) {
      const shape = shapes.find(s => s.id === selectedId);
      
      const deltaX = clampedPos.x - dragStart.x;
      const deltaY = clampedPos.y - dragStart.y;
      
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId) {
          const newX = selectedShapeStart.x + deltaX;
          const newY = selectedShapeStart.y + deltaY;
          
          const constrainedX = Math.max(0, Math.min(newX, 1000 - (s.width > 0 ? s.width : -s.width)));
          const constrainedY = Math.max(0, Math.min(newY, 387 - (s.height > 0 ? s.height : -s.height)));
          
          if ((s.type === 'path' || s.type === 'line' || s.type === 'highlighter') && s.points && originalPointsOnDragStart.length > 0) {
            const deltaFromOriginal = {
              x: constrainedX - selectedShapeStart.x,
              y: constrainedY - selectedShapeStart.y
            };
            
            const newPoints = originalPointsOnDragStart.map((point, index) => 
              index % 2 === 0 ? point + deltaFromOriginal.x : point + deltaFromOriginal.y
            );
            
            return { 
              ...s, 
              x: constrainedX, 
              y: constrainedY,
              points: newPoints
            };
          } else {
            return { 
              ...s, 
              x: constrainedX, 
              y: constrainedY 
            };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
  }, [
    shapes, setShapes, tool, isDragging, selectedId,
    dragStart, selectedShapeStart, originalPointsOnDragStart,
    erasedShapes, setErasedShapes, setDrawingState
  ]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setOriginalPointsOnDragStart([]);
      saveToHistory(shapes);
    }
  }, [isDragging, shapes, saveToHistory]);

  return {
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    selectedShapeStart,
    setSelectedShapeStart,
    originalPointsOnDragStart,
    setOriginalPointsOnDragStart,
    erasedShapes,
    setErasedShapes,
    eraserHistoryStart,
    setEraserHistoryStart,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
};
