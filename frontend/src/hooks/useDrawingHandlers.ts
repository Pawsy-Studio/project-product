import { useCallback, useState } from 'react';
import type { Shape, DrawingState, TransformState, ToolMode, ShapeType } from '../types';
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

  // Функция для ограничения фигур в пределах канваса
  const constrainToCanvas = useCallback((x: number, y: number, width: number, height: number) => {
    const canvasWidth = 6000;
    const canvasHeight = 2500;

    // Если размеры отрицательные, нормализуем их
    const realX = width >= 0 ? x : x + width;
    const realY = height >= 0 ? y : y + height;
    const realWidth = Math.abs(width);
    const realHeight = Math.abs(height);

    // Ограничиваем координаты, чтобы фигура полностью помещалась в канвас
    const constrainedRealX = Math.max(0, Math.min(realX, canvasWidth - realWidth));
    const constrainedRealY = Math.max(0, Math.min(realY, canvasHeight - realHeight));

    // Восстанавливаем исходные координаты с учетом знаков ширины/высоты
    let finalX = constrainedRealX;
    let finalY = constrainedRealY;
    let finalWidth = width;
    let finalHeight = height;

    if (width < 0) {
      finalX = constrainedRealX - realWidth;
    }

    if (height < 0) {
      finalY = constrainedRealY - realHeight;
    }

    return { x: finalX, y: finalY, width: finalWidth, height: finalHeight };
  }, []);

  const handleMouseDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const container = stage.container();
    const adjustedX = pos.x + container.scrollLeft;
    const adjustedY = pos.y + container.scrollTop;
    const adjustedPos = { x: adjustedX, y: adjustedY };

    if (adjustedPos.x < 0 || adjustedPos.x > 6000 || adjustedPos.y < 0 || adjustedPos.y > 2500) {
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
          startMouseX: adjustedPos.x,
          startMouseY: adjustedPos.y,
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

        let newTextShape: Shape;

        if (isLatex) {
          const size = measureLatexSize(initialText, currentFontSize);
          newTextShape = {
            id: `${isLatex ? 'latex' : 'text'}_${Date.now()}`,
            type: isLatex ? 'latex' : 'text',
            x: adjustedX,
            y: adjustedY,
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

          newTextShape = {
            id: `${isLatex ? 'latex' : 'text'}_${Date.now()}`,
            type: isLatex ? 'latex' : 'text',
            x: adjustedX,
            y: adjustedY,
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

        // Constrain LaTeX shapes to canvas bounds
        if (isLatex) {
          const constrained = constrainToCanvas(newTextShape.x, newTextShape.y, newTextShape.width, newTextShape.height);
          newTextShape.x = constrained.x;
          newTextShape.y = constrained.y;
          newTextShape.width = constrained.width;
          newTextShape.height = constrained.height;
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
          startX: adjustedX,
          startY: adjustedY,
          currentShape: {
            id: `eraser_${Date.now()}`,
            type: 'path',
            x: adjustedX,
            y: adjustedY,
            width: 0,
            height: 0,
            stroke: '#000000',
            strokeWidth: strokeWidth,
            opacity: 1,
            points: [adjustedX, adjustedY]
          }
        });
      }
      else if (!['select', 'text', 'latex'].includes(tool)) {
        const shapeType = tool === 'pencil' ? 'path' : tool === 'highlighter' ? 'highlighter' : tool as ShapeType;
        
        setDrawingState({
          isDrawing: true,
          startX: adjustedX,
          startY: adjustedY,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: shapeType,
            x: adjustedX,
            y: adjustedY,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: tool === 'highlighter' ? 0.5 : 1,
            points: (tool === 'pencil' || tool === 'highlighter') ? [adjustedX, adjustedY] : undefined
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
        setDragStart({ x: adjustedPos.x, y: adjustedPos.y });
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
          if (isPointInShape(shape, adjustedPos)) {
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
          startX: adjustedX,
          startY: adjustedY,
          currentShape: {
            id: `eraser_${Date.now()}`,
            type: 'path',
            x: adjustedX,
            y: adjustedY,
            width: 0,
            height: 0,
            stroke: '#000000',
            strokeWidth: strokeWidth,
            opacity: 1,
            points: [adjustedX, adjustedY]
          }
        });
      } else {
        const shapeType = tool === 'pencil' ? 'path' : tool === 'highlighter' ? 'highlighter' : tool as ShapeType;

        setDrawingState({
          isDrawing: true,
          startX: adjustedX,
          startY: adjustedY,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: shapeType,
            x: adjustedX,
            y: adjustedY,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: tool === 'highlighter' ? 0.5 : 1,
            points: (tool === 'pencil' || tool === 'highlighter') ? [adjustedX, adjustedY] : undefined
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
    const container = stage.container();
    const adjustedX = pos.x + container.scrollLeft;
    const adjustedY = pos.y + container.scrollTop;
    const adjustedPos = { x: adjustedX, y: adjustedY };
    
    if (drawingState.isDrawing && drawingState.currentShape) {
      const { startX, startY, currentShape } = drawingState;
      
      if (tool === 'pencil' || tool === 'eraser' || tool === 'highlighter') {
        const updatedShape = {
          ...currentShape,
          points: [...(currentShape.points || []), adjustedPos.x, adjustedPos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));

        if (tool === 'eraser') {
          const shapesToErase = shapes.filter(shape => isPointInShape(shape, adjustedPos));

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
          points: [startX, startY, adjustedPos.x, adjustedPos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
      }
      else if (tool === 'rectangle' || tool === 'ellipse') {
        let width = adjustedPos.x - startX;
        let height = adjustedPos.y - startY;
        
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
      
      const deltaX = adjustedPos.x - startMouseX;
      const deltaY = adjustedPos.y - startMouseY;
      
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

      // Нормализация зеркальной трансформации
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

      // Сохраняем пропорции при зажатом Shift
      if (shiftPressed) {
        const size = Math.max(Math.abs(finalW), Math.abs(finalH));
        finalW = Math.sign(finalW) * size;
        finalH = Math.sign(finalH) * size;
        
        // Корректируем координаты для сохранения позиции якоря
        switch (anchor) {
          case 'top-left':
            finalX = newX + (newWidth - finalW);
            finalY = newY + (newHeight - finalH);
            break;
          case 'top-right':
            finalY = newY + (newHeight - finalH);
            break;
          case 'bottom-left':
            finalX = newX + (newWidth - finalW);
            break;
          // bottom-right не требует корректировки
        }
      }

      // Применяем ограничения канваса
      const constrained = constrainToCanvas(finalX, finalY, finalW, finalH);
      finalX = constrained.x;
      finalY = constrained.y;
      finalW = constrained.width;
      finalH = constrained.height;

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
      
      const deltaX = adjustedPos.x - dragStart.x;
      const deltaY = adjustedPos.y - dragStart.y;
      
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId) {
          const newX = selectedShapeStart.x + deltaX;
          const newY = selectedShapeStart.y + deltaY;
          
          // Используем constrainToCanvas для ограничения при перемещении
          const constrained = constrainToCanvas(newX, newY, s.width, s.height);
          
          if ((s.type === 'path' || s.type === 'line' || s.type === 'highlighter') && s.points && originalPointsOnDragStart.length > 0) {
            const deltaFromOriginal = {
              x: constrained.x - selectedShapeStart.x,
              y: constrained.y - selectedShapeStart.y
            };
            
            const newPoints = originalPointsOnDragStart.map((point, index) => 
              index % 2 === 0 ? point + deltaFromOriginal.x : point + deltaFromOriginal.y
            );
            
            return { 
              ...s, 
              x: constrained.x, 
              y: constrained.y,
              points: newPoints
            };
          } else {
            return { 
              ...s, 
              x: constrained.x, 
              y: constrained.y 
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
    erasedShapes, setErasedShapes, setDrawingState,
    , constrainToCanvas
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
