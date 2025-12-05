import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Circle } from 'react-konva';

type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path';
type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser';
type AnchorType = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;

interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  points?: number[];
  opacity?: number;
  isSelected?: boolean;
}

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentShape: Partial<Shape> | null;
}

interface TransformState {
  isTransforming: boolean;
  shapeId: string | null;
  startWidth: number;
  startHeight: number;
  startX: number;
  startY: number;
  startMouseX: number;
  startMouseY: number;
  anchor: AnchorType;
  originalPoints?: number[]; // Для трансформации path и line
  originalBbox?: { x: number, y: number, width: number, height: number }; // Для трансформации path и line
}

const App: React.FC = () => {
  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isHighlighter, setIsHighlighter] = useState(false);
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
  
  const stageRef = useRef<any>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedShapeStart, setSelectedShapeStart] = useState({ x: 0, y: 0 });
  const [originalPointsOnDragStart, setOriginalPointsOnDragStart] = useState<number[]>([]);

  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Вычисление bounding box для path и line
  const calculateBoundingBox = (points: number[]): { x: number, y: number, width: number, height: number } => {
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

  // Трансформация точек path и line при изменении bounding box
  const transformPoints = (points: number[], oldBbox: any, newBbox: any): number[] => {
    const newPoints: number[] = [];
    
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      
      // Преобразуем относительные координаты
      const relX = oldBbox.width !== 0 ? (x - oldBbox.x) / oldBbox.width : 0;
      const relY = oldBbox.height !== 0 ? (y - oldBbox.y) / oldBbox.height : 0;
      
      // Применяем к новому bounding box
      newPoints.push(newBbox.x + relX * newBbox.width);
      newPoints.push(newBbox.y + relY * newBbox.height);
    }
    
    return newPoints;
  };

  const saveToHistory = (newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newShapes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setShapes([...history[historyIndex - 1]]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setShapes([...history[historyIndex + 1]]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
      if (e.key === 'Delete' && selectedId) handleDeleteShape(selectedId);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedId]);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    // Если кликнули на кнопку удаления
    if (e.target.attrs.name && e.target.attrs.name === 'delete-button') {
      const shapeId = e.target.attrs.shapeId;
      if (shapeId) {
        handleDeleteShape(shapeId);
      }
      return;
    }
    
    // Если кликнули на якорь трансформации
    if (e.target.attrs.name && e.target.attrs.name.startsWith('anchor-')) {
      const shapeId = e.target.attrs.shapeId;
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && tool === 'select') {
        const anchor = e.target.attrs.name.replace('anchor-', '') as AnchorType;
        
        // Для path и line фигур сохраняем исходные точки и bbox
        let originalPoints = shape.points;
        let originalBbox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        
        if ((shape.type === 'path' || shape.type === 'line') && shape.points) {
          originalPoints = [...shape.points];
          // Пересчитываем bounding box для точности
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
          originalBbox
        });
      }
      return;
    }
    
    // Если кликнули на пустое место холста
    if (e.target === stage) {
      if (tool === 'select') {
        setSelectedId(null);
        // Снимаем выделение со всех фигур
        setShapes(shapes.map(shape => ({ ...shape, isSelected: false })));
      }
      
      // Начинаем рисование если не в режиме select
      if (!['select'].includes(tool)) {
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: tool === 'pencil' || tool === 'eraser' ? 'path' : tool as ShapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: tool === 'eraser' ? '#ffffff' : strokeColor,
            strokeWidth: strokeWidth,
            opacity: isHighlighter ? 0.5 : 1,
            points: tool === 'pencil' || tool === 'eraser' ? [pos.x, pos.y] : undefined
          }
        });
      }
      return;
    }
    
    // Если кликнули на фигуру в режиме select - начинаем перемещение
    if (tool === 'select' && e.target.attrs.id) {
      const targetId = e.target.attrs.id;
      const shape = shapes.find(s => s.id === targetId);
      
      if (shape) {
        setSelectedId(targetId);
        setIsDragging(true);
        setDragStart({ x: pos.x, y: pos.y });
        setSelectedShapeStart({ x: shape.x, y: shape.y });
        
        // Сохраняем исходные точки для path и line фигур
        if ((shape.type === 'path' || shape.type === 'line') && shape.points) {
          setOriginalPointsOnDragStart([...shape.points]);
        }
        
        // Обновляем выделение
        setShapes(shapes.map(s => ({
          ...s,
          isSelected: s.id === targetId
        })));
      }
      return;
    }
    
    // Если не в режиме select и кликнули на существующую фигуру - начинаем рисование поверх
    if (!['select'].includes(tool)) {
      setDrawingState({
        isDrawing: true,
        startX: pos.x,
        startY: pos.y,
        currentShape: {
          id: `${tool}_${Date.now()}`,
          type: tool === 'pencil' || tool === 'eraser' ? 'path' : tool as ShapeType,
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: tool === 'eraser' ? '#ffffff' : strokeColor,
          strokeWidth: strokeWidth,
          opacity: isHighlighter ? 0.5 : 1,
          points: tool === 'pencil' || tool === 'eraser' ? [pos.x, pos.y] : undefined
        }
      });
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    // Если рисуем новую фигуру
    if (drawingState.isDrawing && drawingState.currentShape) {
      const { startX, startY, currentShape } = drawingState;
      
      if (tool === 'pencil' || tool === 'eraser') {
        const updatedShape = {
          ...currentShape,
          points: [...(currentShape.points || []), pos.x, pos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
      } 
      else if (tool === 'line') {
        const updatedShape = {
          ...currentShape,
          points: [startX, startY, pos.x, pos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
      }
      else if (tool === 'rectangle' || tool === 'ellipse') {
        let width = pos.x - startX;
        let height = pos.y - startY;
        
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
    // Если трансформируем существующую фигуру
    else if (transformState.isTransforming && transformState.shapeId) {
      const { startWidth, startHeight, startX, startY, startMouseX, startMouseY, anchor, originalPoints, originalBbox } = transformState;
      
      if (!anchor) return;
      
      const deltaX = pos.x - startMouseX;
      const deltaY = pos.y - startMouseY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;
      
      // Позволяем отрицательные размеры для переворачивания фигуры
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
      
      // Сохраняем пропорции при зажатом Shift
      if (shiftPressed) {
        const ratio = Math.abs(startWidth) / Math.abs(startHeight);
        
        switch (anchor) {
          case 'top-left':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = Math.abs(newWidth) / ratio * Math.sign(startHeight);
              newY = startY + (startHeight - newHeight);
            } else {
              newWidth = Math.abs(newHeight) * ratio * Math.sign(startWidth);
              newX = startX + (startWidth - newWidth);
            }
            break;
          case 'top-right':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = Math.abs(newWidth) / ratio * Math.sign(startHeight);
              newY = startY + (startHeight - newHeight);
            } else {
              newWidth = Math.abs(newHeight) * ratio * Math.sign(startWidth);
            }
            break;
          case 'bottom-left':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = Math.abs(newWidth) / ratio * Math.sign(startHeight);
            } else {
              newWidth = Math.abs(newHeight) * ratio * Math.sign(startWidth);
              newX = startX + (startWidth - newWidth);
            }
            break;
          case 'bottom-right':
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = Math.abs(newWidth) / ratio * Math.sign(startHeight);
            } else {
              newWidth = Math.abs(newHeight) * ratio * Math.sign(startWidth);
            }
            break;
        }
      }
      
      // Минимальный размер по абсолютному значению
      if (Math.abs(newWidth) < 5) {
        newWidth = newWidth >= 0 ? 5 : -5;
      }
      if (Math.abs(newHeight) < 5) {
        newHeight = newHeight >= 0 ? 5 : -5;
      }
      
      // Обновляем фигуру в состоянии
      const updatedShapes = shapes.map(s => {
        if (s.id === transformState.shapeId) {
          if ((s.type === 'path' || s.type === 'line') && originalPoints && originalBbox) {
            // Для path и line фигур трансформируем точки
            const newBbox = { x: newX, y: newY, width: newWidth, height: newHeight };
            const transformedPoints = transformPoints(originalPoints, originalBbox, newBbox);
            
            return { 
              ...s, 
              width: newWidth, 
              height: newHeight, 
              x: newX, 
              y: newY,
              points: transformedPoints
            };
          } else {
            // Для обычных фигур (rectangle, ellipse)
            return { ...s, width: newWidth, height: newHeight, x: newX, y: newY };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
    // Если перетаскиваем фигуру
    else if (isDragging && selectedId) {
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId) {
          // Обновляем позицию фигуры
          const newX = selectedShapeStart.x + deltaX;
          const newY = selectedShapeStart.y + deltaY;
          
          if ((s.type === 'path' || s.type === 'line') && s.points && originalPointsOnDragStart.length > 0) {
            // Для path и line фигур перемещаем все точки на дельту от начальной позиции
            // Вычисляем дельту от начальной позиции bounding box
            const deltaFromOriginal = {
              x: newX - selectedShapeStart.x,
              y: newY - selectedShapeStart.y
            };
            
            // Создаем новые точки, сдвигая исходные на дельту
            const newPoints = originalPointsOnDragStart.map((point, index) => 
              index % 2 === 0 ? point + deltaFromOriginal.x : point + deltaFromOriginal.y
            );
            
            return { 
              ...s, 
              x: newX, 
              y: newY,
              points: newPoints
            };
          } else {
            // Для обычных фигур
            return { 
              ...s, 
              x: newX, 
              y: newY 
            };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
  };

  const handleMouseUp = () => {
    // Завершаем рисование
    if (drawingState.isDrawing && drawingState.currentShape) {
      let newShape = { ...drawingState.currentShape } as Shape;
      
      // Для карандаша и ластика
      if ((tool === 'pencil' || tool === 'eraser') && newShape.points && newShape.points.length >= 4) {
        // Вычисляем bounding box для path фигуры
        const bbox = calculateBoundingBox(newShape.points);
        newShape.x = bbox.x;
        newShape.y = bbox.y;
        newShape.width = bbox.width;
        newShape.height = bbox.height;
        
        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
      // Для линии
      else if (tool === 'line' && newShape.points && newShape.points.length === 4) {
        const startX = newShape.points[0];
        const startY = newShape.points[1];
        const endX = newShape.points[2];
        const endY = newShape.points[3];
        
        // Вычисляем bounding box для линии
        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const maxX = Math.max(startX, endX);
        const maxY = Math.max(startY, endY);
        
        newShape.x = minX;
        newShape.y = minY;
        newShape.width = maxX - minX;
        newShape.height = maxY - minY;
        
        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
      // Для прямоугольника и эллипса
      else if ((tool === 'rectangle' || tool === 'ellipse') && 
               drawingState.currentShape.width !== 0 && 
               drawingState.currentShape.height !== 0) {
        
        const startX = drawingState.startX;
        const startY = drawingState.startY;
        const width = newShape.width || 0;
        const height = newShape.height || 0;
        
        newShape.x = startX;
        newShape.y = startY;
        newShape.width = width;
        newShape.height = height;
        
        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
      
      setDrawingState({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentShape: null
      });
    }
    
    // Завершаем трансформацию
    if (transformState.isTransforming) {
      saveToHistory(shapes);
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
    }
    
    // Завершаем перетаскивание
    if (isDragging) {
      setIsDragging(false);
      setOriginalPointsOnDragStart([]);
      saveToHistory(shapes);
    }
  };

  const handleDeleteShape = (id: string) => {
    const newShapes = shapes.filter(shape => shape.id !== id);
    setShapes(newShapes);
    saveToHistory(newShapes);
    if (selectedId === id) setSelectedId(null);
  };

  const handleClearCanvas = () => {
    setShapes([]);
    setSelectedId(null);
    saveToHistory([]);
  };

  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Функция для рендеринга всех фигур
  const renderAllShapes = () => {
    const allShapes = [...shapes];
    
    // Добавляем текущую рисуемую фигуру
    if (drawingState.currentShape) {
      const shape = drawingState.currentShape;
      
      // Для превью фигур нормализуем координаты для отрисовки
      if (shape.type === 'rectangle' || shape.type === 'ellipse') {
        const startX = shape.x || 0;
        const startY = shape.y || 0;
        const width = shape.width || 0;
        const height = shape.height || 0;
        
        const normalizedShape = {
          ...shape,
          x: Math.min(startX, startX + width),
          y: Math.min(startY, startY + height),
          width: Math.abs(width),
          height: Math.abs(height)
        };
        
        allShapes.push(normalizedShape as Shape);
      } else {
        allShapes.push(shape as Shape);
      }
    }
    
    return allShapes.map((shape) => {
      const shapeOpacity = shape.opacity !== undefined ? shape.opacity : 1;
      const strokeColorWithOpacity = shape.stroke === '#ffffff' 
        ? '#ffffff'
        : hexToRgba(shape.stroke, shapeOpacity);
      
      const commonProps = {
        key: shape.id,
        id: shape.id,
        stroke: strokeColorWithOpacity,
        strokeWidth: shape.strokeWidth,
      };
      
      switch (shape.type) {
        case 'rectangle':
          const rectX = shape.width >= 0 ? shape.x : shape.x + shape.width;
          const rectY = shape.height >= 0 ? shape.y : shape.y + shape.height;
          
          return (
            <Rect
              {...commonProps}
              x={rectX}
              y={rectY}
              width={Math.abs(shape.width)}
              height={Math.abs(shape.height)}
            />
          );
        
        case 'ellipse':
          const centerX = shape.x + shape.width / 2;
          const centerY = shape.y + shape.height / 2;
          const radiusX = Math.abs(shape.width) / 2;
          const radiusY = Math.abs(shape.height) / 2;
          
          return (
            <Ellipse
              {...commonProps}
              x={centerX}
              y={centerY}
              radiusX={radiusX}
              radiusY={radiusY}
            />
          );
        
        case 'line':
          return (
            <Line
              {...commonProps}
              points={shape.points || []}
            />
          );
        
        case 'path':
          return (
            <Line
              {...commonProps}
              points={shape.points || []}
              tension={0}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                shape.stroke === '#ffffff' ? 'destination-out' : 'source-over'
              }
            />
          );
        
        default:
          return null;
      }
    });
  };

  // Функция для рендеринга рамки и якорей выделенной фигуры
  const renderSelection = () => {
    if (!selectedId || tool !== 'select' || drawingState.isDrawing) return null;
    
    const shape = shapes.find(s => s.id === selectedId);
    if (!shape) return null;
    
    // Для path и line фигур, если нет width/height или они некорректны, вычисляем bounding box
    let displayShape = { ...shape };
    if ((shape.type === 'path' || shape.type === 'line') && shape.points && shape.points.length > 0) {
      if ((!shape.width || !shape.height || shape.width === 0 || shape.height === 0)) {
        const bbox = calculateBoundingBox(shape.points);
        displayShape = { ...shape, ...bbox };
      }
    }
    
    const selectionPadding = 5;
    const anchorSize = 10;
    const halfAnchor = anchorSize / 2;
    const deleteButtonSize = 12;
    const deleteButtonOffset = 4; // Отступ от рамки
    
    // Вычисляем реальные координаты с учетом отрицательных размеров
    const realX = Math.min(displayShape.x, displayShape.x + displayShape.width);
    const realY = Math.min(displayShape.y, displayShape.y + displayShape.height);
    const realWidth = Math.abs(displayShape.width);
    const realHeight = Math.abs(displayShape.height);
    
    // Координаты рамки
    const x = realX - selectionPadding;
    const y = realY - selectionPadding;
    const width = realWidth + selectionPadding * 2;
    const height = realHeight + selectionPadding * 2;
    
    // Координаты якорей (учитываем отрицательные размеры)
    const anchors = [
      { name: 'anchor-top-left', x: displayShape.x, y: displayShape.y },
      { name: 'anchor-top-right', x: displayShape.x + displayShape.width, y: displayShape.y },
      { name: 'anchor-bottom-left', x: displayShape.x, y: displayShape.y + displayShape.height },
      { name: 'anchor-bottom-right', x: displayShape.x + displayShape.width, y: displayShape.y + displayShape.height }
    ];
    
    // Координаты кнопки удаления (в правом верхнем углу рамки)
    const deleteButtonX = x + width - deleteButtonOffset;
    const deleteButtonY = y - deleteButtonOffset;
    
    return (
      <>
        {/* Рамка выделения */}
        <Rect
          name="selection-rect"
          x={x}
          y={y}
          width={width}
          height={height}
          stroke="#007bff"
          strokeWidth={1}
          dash={[5, 5]}
          listening={false}
        />
        
        {/* Якоря */}
        {anchors.map(anchor => (
          <Rect
            key={anchor.name}
            name={anchor.name}
            shapeId={displayShape.id}
            x={anchor.x - halfAnchor}
            y={anchor.y - halfAnchor}
            width={anchorSize}
            height={anchorSize}
            fill="#ffffff"
            stroke="#007bff"
            strokeWidth={2}
          />
        ))}
        
        {/* Кнопка удаления - красный кружок с крестиком */}
        <Circle
          name="delete-button"
          shapeId={displayShape.id}
          x={deleteButtonX}
          y={deleteButtonY}
          radius={deleteButtonSize / 2}
          fill="#ff4444"
          stroke="#ffffff"
          strokeWidth={1}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'pointer';
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
          }}
        />
        
        {/* Крестик внутри кнопки удаления */}
        <Line
          points={[
            deleteButtonX - deleteButtonSize/3, deleteButtonY - deleteButtonSize/3,
            deleteButtonX + deleteButtonSize/3, deleteButtonY + deleteButtonSize/3
          ]}
          stroke="#ffffff"
          strokeWidth={1.5}
          lineCap="round"
          listening={false}
        />
        <Line
          points={[
            deleteButtonX + deleteButtonSize/3, deleteButtonY - deleteButtonSize/3,
            deleteButtonX - deleteButtonSize/3, deleteButtonY + deleteButtonSize/3
          ]}
          stroke="#ffffff"
          strokeWidth={1.5}
          lineCap="round"
          listening={false}
        />
      </>
    );
  };

  return (
    <div className="d-flex flex-column gap-2 p-2">
      <h1>Tools</h1>
      
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <div className="vr" />
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={handleUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={handleRedo}
        >
          Redo
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={handleClearCanvas}
        >
          Clear
        </button>
        <label htmlFor="color">Stroke color</label>
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          disabled={tool === 'eraser'}
        />
        
        <input
          className="form-check-input"
          type="checkbox"
          id="highlighter"
          disabled={tool === 'eraser'}
          checked={isHighlighter}
          onChange={(e) => setIsHighlighter(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="highlighter">
          Highlighter
        </label>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'select' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('select')}
        >
          Select
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'rectangle' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('rectangle')}
        >
          Rectangle
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'ellipse' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('ellipse')}
        >
          Circle
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'line' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('line')}
        >
          Line
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'pencil' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('pencil')}
        >
          Pen
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'eraser' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setTool('eraser')}
        >
          Eraser
        </button>
        
        <label htmlFor="width" className="form-label">
          Width
        </label>
        <input
          type="range"
          className="form-range"
          min="1"
          max="20"
          step="1"
          id="width"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(+e.target.value)}
        />
      </div>
      <h1>Canvas</h1>
      <div style={{ border: '2px solid #000', width: '100%', height: '387px', backgroundColor: 'white' }}>
        <Stage
          ref={stageRef}
          width={window.innerWidth - 40}
          height={387}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {renderAllShapes()}
            {renderSelection()}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default App;