import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line } from 'react-konva';

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
    anchor: null
  });
  
  const stageRef = useRef<any>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedShapeStart, setSelectedShapeStart] = useState({ x: 0, y: 0 });

  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

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
    
    // Если кликнули на якорь трансформации
    if (e.target.attrs.name && e.target.attrs.name.startsWith('anchor-')) {
      const shapeId = e.target.attrs.shapeId;
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && tool === 'select') {
        const anchor = e.target.attrs.name.replace('anchor-', '') as AnchorType;
        setTransformState({
          isTransforming: true,
          shapeId,
          startWidth: shape.width,
          startHeight: shape.height,
          startX: shape.x,
          startY: shape.y,
          startMouseX: pos.x,
          startMouseY: pos.y,
          anchor
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
      const { startWidth, startHeight, startX, startY, startMouseX, startMouseY, anchor } = transformState;
      
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
      const updatedShapes = shapes.map(s => 
        s.id === transformState.shapeId 
          ? { ...s, width: newWidth, height: newHeight, x: newX, y: newY }
          : s
      );
      
      setShapes(updatedShapes);
    }
    // Если перетаскиваем фигуру
    else if (isDragging && selectedId) {
      const deltaX = pos.x - dragStart.x;
      const deltaY = pos.y - dragStart.y;
      
      const updatedShapes = shapes.map(s => 
        s.id === selectedId 
          ? { ...s, x: selectedShapeStart.x + deltaX, y: selectedShapeStart.y + deltaY }
          : s
      );
      
      setShapes(updatedShapes);
    }
  };

  const handleMouseUp = () => {
    // Завершаем рисование
    if (drawingState.isDrawing && drawingState.currentShape) {
      let newShape = { ...drawingState.currentShape } as Shape;
      
      // Для карандаша и ластика
      if ((tool === 'pencil' || tool === 'eraser') && newShape.points && newShape.points.length >= 4) {
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
        
        newShape.x = Math.min(startX, endX);
        newShape.y = Math.min(startY, endY);
        newShape.width = Math.abs(endX - startX);
        newShape.height = Math.abs(endY - startY);
        
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
        anchor: null
      });
    }
    
    // Завершаем перетаскивание
    if (isDragging) {
      setIsDragging(false);
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
          const linePoints = shape.points || [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height];
          return (
            <Line
              {...commonProps}
              points={linePoints}
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
    
    const selectionPadding = 5;
    const anchorSize = 10;
    const halfAnchor = anchorSize / 2;
    
    // Вычисляем реальные координаты с учетом отрицательных размеров
    const realX = Math.min(shape.x, shape.x + shape.width);
    const realY = Math.min(shape.y, shape.y + shape.height);
    const realWidth = Math.abs(shape.width);
    const realHeight = Math.abs(shape.height);
    
    // Координаты рамки
    const x = realX - selectionPadding;
    const y = realY - selectionPadding;
    const width = realWidth + selectionPadding * 2;
    const height = realHeight + selectionPadding * 2;
    
    // Координаты якорей (учитываем отрицательные размеры)
    const anchors = [
      { name: 'anchor-top-left', x: shape.x, y: shape.y },
      { name: 'anchor-top-right', x: shape.x + shape.width, y: shape.y },
      { name: 'anchor-bottom-left', x: shape.x, y: shape.y + shape.height },
      { name: 'anchor-bottom-right', x: shape.x + shape.width, y: shape.y + shape.height }
    ];
    
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
          listening={false} // Добавляем эту строку
        />
        
        {/* Якоря */}
        {anchors.map(anchor => (
          <Rect
            key={anchor.name}
            name={anchor.name}
            shapeId={shape.id}
            x={anchor.x - halfAnchor}
            y={anchor.y - halfAnchor}
            width={anchorSize}
            height={anchorSize}
            fill="#ffffff"
            stroke="#007bff"
            strokeWidth={2}
          />
        ))}
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