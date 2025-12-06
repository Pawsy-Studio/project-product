import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Circle, Text } from 'react-konva';

type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path' | 'text';
type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text';
type AnchorType = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
type TextAlign = 'left' | 'center' | 'right';

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
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: TextAlign;
  isEditing?: boolean;
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
  originalPoints?: number[];
  originalBbox?: { x: number, y: number, width: number, height: number };
}

const App: React.FC = () => {
  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isHighlighter, setIsHighlighter] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
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
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedShapeStart, setSelectedShapeStart] = useState({ x: 0, y: 0 });
  const [originalPointsOnDragStart, setOriginalPointsOnDragStart] = useState<number[]>([]);
  const [shapesToDelete, setShapesToDelete] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');

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

  const transformPoints = (points: number[], oldBbox: any, newBbox: any): number[] => {
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

  // Функция для проверки пересечения точки с фигурой
  const isPointInShape = (shape: Shape, point: { x: number, y: number }): boolean => {
    if (shape.type === 'path') return false; // Для path фигур не проверяем пересечение
    
    if (shape.type === 'rectangle' || shape.type === 'text') {
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
      // Проверяем близость точки к линии
      const [x1, y1, x2, y2] = shape.points;
      const distance = distanceToLineSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 });
      return distance < 10; // Пороговое значение для толщины ластика
    }
    
    return false;
  };

  // Функция для вычисления расстояния от точки до отрезка
  const distanceToLineSegment = (p: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }): number => {
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

  // Функция для начала редактирования текста
  const startTextEditing = (shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (shape && shape.type === 'text') {
      setShapes(shapes.map(s => ({
        ...s,
        isEditing: s.id === shapeId,
        isSelected: s.id === shapeId
      })));
      setSelectedId(shapeId);
      setTempText(shape.text || '');
      setEditingTextId(shapeId);
      
      // Фокус на текстовом поле после небольшой задержки
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
          textAreaRef.current.select();
        }
      }, 10);
    }
  };

  // Функция для завершения редактирования текста
  const finishTextEditing = () => {
    if (editingTextId) {
      setShapes(shapes.map(s => {
        if (s.id === editingTextId) {
          const updatedShape = {
            ...s,
            text: tempText || 'Text', // Если текст пустой, оставляем "Text"
            isEditing: false,
            height: Math.max(s.height, fontSize * 1.5) // Минимальная высота
          };
          return updatedShape;
        }
        return { ...s, isEditing: false };
      }));
      
      saveToHistory(shapes);
      setEditingTextId(null);
      setTempText('');
    }
  };

  // Функция для обновления свойств выбранного текста
  const updateSelectedTextProperty = (property: keyof Shape, value: any) => {
    if (selectedId) {
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId && s.type === 'text') {
          return { ...s, [property]: value };
        }
        return s;
      });
      setShapes(updatedShapes);
      saveToHistory(updatedShapes);
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
      if (e.key === 'Escape' && editingTextId) {
        finishTextEditing();
      }
      if (e.key === 'Enter' && editingTextId && e.ctrlKey) {
        finishTextEditing();
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
  }, [selectedId, editingTextId, tempText]);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    // Завершаем редактирование текста при клике вне текстового поля
    if (editingTextId && e.target === stage) {
      finishTextEditing();
      setSelectedId(null);
      setShapes(shapes.map(shape => ({ ...shape, isSelected: false })));
      return;
    }
    
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
        
        let originalPoints = shape.points;
        let originalBbox = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
        
        if ((shape.type === 'path' || shape.type === 'line') && shape.points) {
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
          originalBbox
        });
      }
      return;
    }
    
    // Если кликнули на пустое место холста
    if (e.target === stage) {
      // Если мы в режиме select и есть редактируемый текст - завершаем редактирование
      if (tool === 'select' && editingTextId) {
        finishTextEditing();
      }
      
      if (tool === 'select') {
        setSelectedId(null);
        setShapes(shapes.map(shape => ({ ...shape, isSelected: false, isEditing: false })));
      }
      
      // Если выбран инструмент text - создаем новое текстовое поле и сразу начинаем редактирование
      if (tool === 'text') {
        // Завершаем предыдущее редактирование, если было
        if (editingTextId) {
          finishTextEditing();
        }
        
        const newTextShape: Shape = {
          id: `text_${Date.now()}`,
          type: 'text',
          x: pos.x,
          y: pos.y,
          width: 200, // Начальная ширина
          height: 50, // Начальная высота
          stroke: strokeColor,
          strokeWidth: 1,
          text: 'Text',
          fontSize: fontSize,
          fontFamily: fontFamily,
          textAlign: textAlign,
          isSelected: true,
          isEditing: false // Сначала создаем, потом сразу редактируем
        };
        
        const newShapes = [...shapes, newTextShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
        
        // СРАЗУ запускаем редактирование нового текста
        setTimeout(() => {
          startTextEditing(newTextShape.id);
        }, 10);
      }
      // Начинаем рисование если не в режиме select и text
      else if (!['select', 'text'].includes(tool)) {
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
        setShapesToDelete(new Set()); // Сбрасываем набор фигур для удаления
      }
      return;
    }
    
    // Если кликнули на фигуру в режиме select
    if (tool === 'select' && e.target.attrs.id) {
      const targetId = e.target.attrs.id;
      const shape = shapes.find(s => s.id === targetId);
      
      if (shape) {
        // Завершаем редактирование текста, если редактировали другой текст
        if (editingTextId && editingTextId !== targetId) {
          finishTextEditing();
        }
        
        setSelectedId(targetId);
        
        // Если кликнули на текст дважды - начинаем редактирование
        // ОДИНОЧНЫЙ клик - только выделение и возможность перемещения
        if (shape.type === 'text' && e.evt.detail === 2) {
          startTextEditing(targetId);
          return;
        }
        
        // Для текста без двойного клика - просто выделяем (без перехода в редактирование)
        if (shape.type === 'text') {
          setIsDragging(true);
          setDragStart({ x: pos.x, y: pos.y });
          setSelectedShapeStart({ x: shape.x, y: shape.y });
        } 
        // Для остальных фигур - начинаем перемещение (кроме path)
        else if (shape.type !== 'path') {
          setIsDragging(true);
          setDragStart({ x: pos.x, y: pos.y });
          setSelectedShapeStart({ x: shape.x, y: shape.y });
          
          if ((shape.type === 'path' || shape.type === 'line') && shape.points) {
            setOriginalPointsOnDragStart([...shape.points]);
          }
        }
        
        setShapes(shapes.map(s => ({
          ...s,
          isSelected: s.id === targetId,
          isEditing: false // НЕ переходим в режим редактирования при одиночном клике
        })));
      }
      return;
    }
    
    // Если не в режиме select и кликнули на существующую фигуру - начинаем рисование поверх
    if (!['select', 'text'].includes(tool)) {
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
      setShapesToDelete(new Set()); // Сбрасываем набор фигур для удаления
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
        
        // Если это ластик, проверяем пересечение с другими фигур
        if (tool === 'eraser') {
          const newShapesToDelete = new Set(shapesToDelete);
          shapes.forEach(shape => {
            if (shape.type !== 'path' && isPointInShape(shape, pos)) {
              newShapesToDelete.add(shape.id);
            }
          });
          setShapesToDelete(newShapesToDelete);
        }
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
      
      if (Math.abs(newWidth) < 5) {
        newWidth = newWidth >= 0 ? 5 : -5;
      }
      if (Math.abs(newHeight) < 5) {
        newHeight = newHeight >= 0 ? 5 : -5;
      }
      
      const updatedShapes = shapes.map(s => {
        if (s.id === transformState.shapeId) {
          if ((s.type === 'path' || s.type === 'line') && originalPoints && originalBbox) {
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
            return { ...s, width: newWidth, height: newHeight, x: newX, y: newY };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
    // Если перетаскиваем фигуру
    else if (isDragging && selectedId) {
      const shape = shapes.find(s => s.id === selectedId);
      if (shape && shape.type === 'path') return; // Не перемещаем path фигуры
      
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId) {
          const newX = selectedShapeStart.x + deltaX;
          const newY = selectedShapeStart.y + deltaY;
          
          if ((s.type === 'path' || s.type === 'line') && s.points && originalPointsOnDragStart.length > 0) {
            const deltaFromOriginal = {
              x: newX - selectedShapeStart.x,
              y: newY - selectedShapeStart.y
            };
            
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
      
      // Если это ластик, удаляем все помеченные фигуры
      if (tool === 'eraser' && shapesToDelete.size > 0) {
        const newShapes = shapes.filter(shape => !shapesToDelete.has(shape.id));
        setShapes(newShapes);
        saveToHistory(newShapes);
        setShapesToDelete(new Set());
        
        // Сбрасываем состояние рисования
        setDrawingState({
          isDrawing: false,
          startX: 0,
          startY: 0,
          currentShape: null
        });
        return;
      }
      
      // Для карандаша и ластика (без удаления фигур)
      if ((tool === 'pencil' || tool === 'eraser') && newShape.points && newShape.points.length >= 4) {
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
    if (editingTextId === id) {
      setEditingTextId(null);
      setTempText('');
    }
  };

  const handleClearCanvas = () => {
    setShapes([]);
    setSelectedId(null);
    setEditingTextId(null);
    setTempText('');
    saveToHistory([]);
  };

  const hexToRgba = (hex: string, opacity: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const renderAllShapes = () => {
    const allShapes = [...shapes];
    
    if (drawingState.currentShape) {
      const shape = drawingState.currentShape;
      
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
        stroke: shape.type === 'text' ? undefined : strokeColorWithOpacity,
        strokeWidth: shape.type === 'text' ? undefined : shape.strokeWidth,
        fill: shape.type === 'text' ? shape.stroke : undefined,
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
        
        case 'text':
          const textX = shape.width >= 0 ? shape.x : shape.x + shape.width;
          const textY = shape.height >= 0 ? shape.y : shape.y + shape.height;
          const textWidth = Math.abs(shape.width);
          const textHeight = Math.abs(shape.height);
          
          return (
            <Text
              {...commonProps}
              x={textX}
              y={textY}
              width={textWidth}
              height={textHeight}
              text={shape.text || ''}
              fontSize={shape.fontSize || fontSize}
              fontFamily={shape.fontFamily || fontFamily}
              align={shape.textAlign || textAlign}
              verticalAlign="top"
              wrap="word"
              onDblClick={() => startTextEditing(shape.id)}
            />
          );
        
        default:
          return null;
      }
    });
  };

  const renderSelection = () => {
    if (!selectedId || tool !== 'select' || drawingState.isDrawing) return null;
    
    const shape = shapes.find(s => s.id === selectedId);
    if (!shape || shape.type === 'path') return null; // Не показываем выделение для path фигур
    
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
    const deleteButtonOffset = 4;
    
    const realX = Math.min(displayShape.x, displayShape.x + displayShape.width);
    const realY = Math.min(displayShape.y, displayShape.y + displayShape.height);
    const realWidth = Math.abs(displayShape.width);
    const realHeight = Math.abs(displayShape.height);
    
    const x = realX - selectionPadding;
    const y = realY - selectionPadding;
    const width = realWidth + selectionPadding * 2;
    const height = realHeight + selectionPadding * 2;
    
    const anchors = [
      { name: 'anchor-top-left', x: displayShape.x, y: displayShape.y },
      { name: 'anchor-top-right', x: displayShape.x + displayShape.width, y: displayShape.y },
      { name: 'anchor-bottom-left', x: displayShape.x, y: displayShape.y + displayShape.height },
      { name: 'anchor-bottom-right', x: displayShape.x + displayShape.width, y: displayShape.y + displayShape.height }
    ];
    
    const deleteButtonX = x + width - deleteButtonOffset;
    const deleteButtonY = y - deleteButtonOffset;
    
    return (
      <>
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

  // Рендеринг текстового поля для редактирования
  const renderTextInput = () => {
    if (!editingTextId) return null;
    
    const shape = shapes.find(s => s.id === editingTextId);
    if (!shape || shape.type !== 'text') return null;
    
    const stage = stageRef.current;
    if (!stage) return null;
    
    // Конвертируем координаты сцены в координаты контейнера
    const containerRect = stage.container().getBoundingClientRect();
    const scaleX = stage.width() / stage.width();
    const scaleY = stage.height() / stage.height();
    
    const x = shape.x * scaleX + containerRect.left;
    const y = shape.y * scaleY + containerRect.top;
    const width = Math.max(Math.abs(shape.width) * scaleX, 100);
    const height = Math.max(Math.abs(shape.height) * scaleY, 40);
    
    return (
      <textarea
        ref={textAreaRef}
        value={tempText}
        onChange={(e) => setTempText(e.target.value)}
        onBlur={finishTextEditing}
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          fontSize: `${shape.fontSize || fontSize}px`,
          fontFamily: shape.fontFamily || fontFamily,
          textAlign: shape.textAlign || textAlign,
          color: shape.stroke,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          border: '1px dashed #007bff',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          padding: '2px',
          zIndex: 1000,
          lineHeight: '1.2',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            finishTextEditing();
          }
          if (e.key === 'Enter' && e.ctrlKey) {
            finishTextEditing();
          }
        }}
        autoFocus
      />
    );
  };

  // Рендеринг тулбара для редактирования текста
  const renderTextToolbar = () => {
    // Показываем тулбар только в режиме select и когда выделен текст
    if (tool !== 'select' || !selectedId) return null;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (!selectedShape || selectedShape.type !== 'text') return null;
    
    // Не показываем тулбар, если текст в режиме редактирования
    if (editingTextId) return null;
    
    const stage = stageRef.current;
    if (!stage) return null;
    
    // Получаем координаты выделенного текста
    const container = stage.container();
    const containerRect = container.getBoundingClientRect();
    
    // Координаты текста в сцене
    const textX = selectedShape.x;
    const textY = selectedShape.y;
    
    // Масштаб (по умолчанию 1)
    const scaleX = stage.scaleX();
    const scaleY = stage.scaleY();
    
    // Пересчитываем в координаты контейнера
    const x = textX * scaleX + containerRect.left;
    const y = textY * scaleY + containerRect.top;
    
    // Высота панели
    const panelHeight = 40;
    const panelWidth = 800; // ЕЩЁ УВЕЛИЧИЛИ ШИРИНУ С 700 ДО 850px
    
    // Позиционируем панель над текстом
    let top = y - panelHeight - 10;
    // Если панель выходит за верхний край окна, показываем ее под текстом
    if (top < containerRect.top) {
      top = y + Math.abs(selectedShape.height) * scaleY + 10;
    }
    
    let left = x;
    // Если панель выходит за правый край окна, сдвигаем влево
    if (left + panelWidth > containerRect.right) {
      left = containerRect.right - panelWidth;
    }
    // Если панель выходит за левый край окна, сдвигаем вправо
    if (left < containerRect.left) {
      left = containerRect.left;
    }
    
    return (
      <div 
        style={{
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${panelWidth}px`,
          height: `${panelHeight}px`,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '5px 10px', // УМЕНЬШИЛИ PADDING ПО БОКАМ
          display: 'flex',
          gap: '8px', // УМЕНЬШИЛИ GAP МЕЖДУ ЭЛЕМЕНТАМИ С 15px ДО 8px
          alignItems: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1001,
        }}
      >
        <label style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          marginRight: '3px', // УМЕНЬШИЛИ ОТСТУП
          whiteSpace: 'nowrap' 
        }}>
          Font:
        </label>
        <select
          className="form-select form-select-sm"
          value={selectedShape.fontFamily || fontFamily}
          onChange={(e) => updateSelectedTextProperty('fontFamily', e.target.value)}
          style={{ width: '150px', height: '30px' }} // УВЕЛИЧИЛИ ШИРИНУ
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
        </select>
        
        <label style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          marginLeft: '3px', // УМЕНЬШИЛИ ОТСТУП
          whiteSpace: 'nowrap' 
        }}>
          Size:
        </label>
        <input
          type="range"
          className="form-range"
          min="8"
          max="72"
          step="1"
          value={selectedShape.fontSize || fontSize}
          onChange={(e) => updateSelectedTextProperty('fontSize', +e.target.value)}
          style={{ width: '130px' }} // УВЕЛИЧИЛИ ШИРИНУ
        />
        <span style={{ 
          fontSize: '14px', 
          minWidth: '45px', 
          whiteSpace: 'nowrap',
          marginRight: '3px' // ДОБАВИЛИ ОТСТУП СПРАВА
        }}>
          {selectedShape.fontSize || fontSize}px
        </span>
        
        <label style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          marginLeft: '3px', // УМЕНЬШИЛИ ОТСТУП
          whiteSpace: 'nowrap' 
        }}>
          Align:
        </label>
        <select
          className="form-select form-select-sm"
          value={selectedShape.textAlign || textAlign}
          onChange={(e) => updateSelectedTextProperty('textAlign', e.target.value)}
          style={{ width: '100px', height: '30px' }} // УВЕЛИЧИЛИ ШИРИНУ
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
        
        <label style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          marginLeft: '3px', // УМЕНЬШИЛИ ОТСТУП
          whiteSpace: 'nowrap' 
        }}>
          Color:
        </label>
        <input
          type="color"
          value={selectedShape.stroke || strokeColor}
          onChange={(e) => updateSelectedTextProperty('stroke', e.target.value)}
          style={{ 
            width: '35px', 
            height: '35px', 
            cursor: 'pointer',
            marginRight: '3px' // ДОБАВИЛИ ОТСТУП СПРАВА
          }}
        />
        
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => startTextEditing(selectedId)}
          style={{ 
            height: '30px',
            whiteSpace: 'nowrap',
            padding: '0 12px',
            fontSize: '14px',
            marginLeft: '5px' // УМЕНЬШИЛИ ОТСТУП СЛЕВА
          }}
        >
          Edit Text
        </button>
      </div>
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
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('select');
          }}
        >
          Select
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'rectangle' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('rectangle');
          }}
        >
          Rectangle
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'ellipse' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('ellipse');
          }}
        >
          Circle
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'line' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('line');
          }}
        >
          Line
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'pencil' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('pencil');
          }}
        >
          Pen
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'eraser' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('eraser');
          }}
        >
          Eraser
        </button>
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'text' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('text');
          }}
        >
          Text
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
          disabled={tool === 'text'}
        />
      </div>
      <h1>Canvas</h1>
      <div style={{ border: '2px solid #000', width: '100%', height: '387px', backgroundColor: 'white', position: 'relative' }}>
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
        {renderTextInput()}
      </div>
      {renderTextToolbar()}
    </div>
  );
};

export default App;