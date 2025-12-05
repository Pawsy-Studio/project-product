import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Transformer } from 'react-konva';

type ShapeType = 'rectangle' | 'circle' | 'line' | 'path';
type ToolMode = 'select' | 'rectangle' | 'circle' | 'line' | 'pencil' | 'eraser';

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
  radius?: number;
}

interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentShape: Partial<Shape> | null;
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
  
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [shiftPressed, setShiftPressed] = useState(false);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') handleUndo();
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

  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer().batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId]);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (e.target === stage && tool === 'select') {
      setSelectedId(null);
      return;
    }
    
    if (tool === 'select' && e.target.attrs.id) {
      handleSelectShape(e.target.attrs.id);
      return;
    }
    
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
          points: [pos.x, pos.y]
        }
      });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!drawingState.isDrawing || !drawingState.currentShape) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const { startX, startY, currentShape } = drawingState;
    
    if (tool === 'pencil' || tool === 'eraser') {
      const updatedShape = {
        ...currentShape,
        points: [...(currentShape.points || []), pos.x, pos.y]
      };
      setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
    } 
    else {
      let width = pos.x - startX;
      let height = pos.y - startY;
      
      if (shiftPressed) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }
      
      let updatedShape = { ...currentShape, width, height };
      
      if (tool === 'circle') {
        updatedShape.radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
        updatedShape.x = startX + (width / 2);
        updatedShape.y = startY + (height / 2);
      }
      
      if (tool === 'line') {
        updatedShape.points = [startX, startY, pos.x, pos.y];
      }
      
      setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
    }
  };

  const handleMouseUp = () => {
    if (!drawingState.isDrawing || !drawingState.currentShape) return;
    
    if ((tool === 'pencil' || tool === 'eraser') && drawingState.currentShape.points && drawingState.currentShape.points.length >= 4) {
      const newShape = { ...drawingState.currentShape } as Shape;
      const newShapes = [...shapes, newShape];
      setShapes(newShapes);
      saveToHistory(newShapes);
    }
    else if (tool !== 'pencil' && tool !== 'eraser' && drawingState.currentShape.width !== 0 && drawingState.currentShape.height !== 0) {
      const newShape = { ...drawingState.currentShape } as Shape;
      
      if (tool === 'rectangle') {
        newShape.width = Math.abs(newShape.width);
        newShape.height = Math.abs(newShape.height);
        if (newShape.width < 0) newShape.x += newShape.width;
        if (newShape.height < 0) newShape.y += newShape.height;
      }
      
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
  };

  const handleSelectShape = (id: string) => {
    setSelectedId(id);
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

  const handleUpdateShape = (id: string, updates: Partial<Shape>) => {
    const newShapes = shapes.map(shape => 
      shape.id === id ? { ...shape, ...updates } : shape
    );
    setShapes(newShapes);
    saveToHistory(newShapes);
  };

  const renderShapes = () => {
    const allShapes = [...shapes];
    
    if (drawingState.currentShape) {
      allShapes.push(drawingState.currentShape as Shape);
    }
    
    return allShapes.map((shape) => {
      const commonProps = {
        key: shape.id,
        id: shape.id,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        opacity: (isHighlighter && shape.stroke !== '#ffffff') ? 0.5 : 1,
        draggable: tool === 'select',
        onClick: () => {
          if (tool === 'select') {
            handleSelectShape(shape.id);
          }
        },
        onDragEnd: (e: any) => {
          handleUpdateShape(shape.id, {
            x: e.target.x(),
            y: e.target.y()
          });
        },
        onTransformEnd: (e: any) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          if (shape.type === 'circle') {
            handleUpdateShape(shape.id, {
              x: node.x(),
              y: node.y(),
              radius: Math.max(5, node.radius() * scaleX),
            });
          } else {
            handleUpdateShape(shape.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(5, node.width() * scaleX),
              height: Math.max(5, node.height() * scaleY),
            });
          }
          
          node.scaleX(1);
          node.scaleY(1);
        }
      };
      
      switch (shape.type) {
        case 'rectangle':
          return (
            <Rect
              {...commonProps}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
            />
          );
        
        case 'circle':
          return (
            <Circle
              {...commonProps}
              x={shape.x}
              y={shape.y}
              radius={shape.radius || Math.max(shape.width, shape.height) / 2}
            />
          );
        
        case 'line':
          return (
            <Line
              {...commonProps}
              points={shape.points || [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height]}
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

  return (
    <div>
      <h1>Paint</h1>
      
      <div>
        <button onClick={() => setTool('select')}>
          Select
        </button>
        <button onClick={() => setTool('rectangle')}>
          Rectangle
        </button>
        <button onClick={() => setTool('circle')}>
          Circle
        </button>
        <button onClick={() => setTool('line')}>
          Line
        </button>
        <button onClick={() => setTool('pencil')}>
          Pen
        </button>
        <button onClick={() => setTool('eraser')}>
          Eraser
        </button>
        
        <div>
          <label>Color: </label>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            disabled={tool === 'eraser'}
          />
        </div>
        
        <div>
          <input
            type="checkbox"
            id="highlighter"
            checked={isHighlighter}
            onChange={(e) => setIsHighlighter(e.target.checked)}
            disabled={tool === 'eraser'}
          />
          <label htmlFor="highlighter">Highlighter</label>
        </div>
        
        <div>
          <label>Width: </label>
          <input
            type="range"
            min="1"
            max="30"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(+e.target.value)}
          />
          <span>{strokeWidth}px</span>
        </div>
        
        <button onClick={handleUndo}>
          Undo
        </button>
        <button onClick={handleRedo}>
          Redo
        </button>
        <button onClick={handleClearCanvas}>
          Clear
        </button>
      </div>
      
      <div style={{ border: '2px solid #ccc', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'white' }}>
        <Stage
          ref={stageRef}
          width={window.innerWidth - 100}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {renderShapes()}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                if (shiftPressed) {
                  const ratio = oldBox.width / oldBox.height;
                  if (newBox.width / newBox.height > ratio) {
                    newBox.width = newBox.height * ratio;
                  } else {
                    newBox.height = newBox.width / ratio;
                  }
                }
                return newBox;
              }}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default App;