import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text } from 'react-konva';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './App.css';

import BrushToolbar from './components/BrushToolbar.tsx';
import RangeToolbar from './components/RangeToolbar.tsx';
import ToolsToolbar from './components/ToolsToolbar.tsx';
import SelDelToolbar from './components/SelDelToolbar.tsx';
import OCRToolbar from './components/OCRToolbar.tsx';
import TextToolbar from './components/TextToolbar.tsx';
import LatexToolbar from './components/LatexToolbar.tsx';
import LatexEditor from './components/LatexEditor.tsx';
import TextEditor from './components/TextEditor.tsx';

import type { 
  Shape, ToolMode, TextAlign, AnchorType,
  DrawingState, TransformState 
} from './types';
import { latexSymbols } from './constants/latexSymbols';
import { latexCategories } from './constants/latexCategories';
import { availableFonts } from './constants/fonts';

import { useHistory } from './hooks/useHistory';
import { useTextEditing } from './hooks/useTextEditing';
import { useTextFormatting } from './hooks/useTextFormatting';
import { useLatexSymbols } from './hooks/useLatexSymbols';
import { useDrawingHandlers } from './hooks/useDrawingHandlers';
import { useDrawingState } from './hooks/useDrawingState';
import { useKeyboard } from './hooks/useKeyboard';
import { useWebSocket } from './hooks/useWebSocket';
import type { CanvasData } from './hooks/useWebSocket';
import { updateCanvasData, clearCanvas, undoAction } from './services/api';

import { hexToRgba } from './utils/colorUtils';
import { calculateBoundingBox } from './utils/shapeUtils';
import { renderLatexToHtml, measureLatexSize } from './utils/latexUtils';

const DrawingApp: React.FC = () => {
  // Board ID for backend communication
  // Added for backend data sending logic
  const boardId = 'test-board'; // In production, get from URL or props

  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [canvasConfig, setCanvasConfig] = useState<any>({});
  const [canvasHistory, setCanvasHistory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [shiftPressed, setShiftPressed] = useState(false);
  const [scale, setScale] = useState(1);

  const {
    drawingState,
    setDrawingState,
    transformState,
    setTransformState,
    resetDrawingState,
    resetTransformState
  } = useDrawingState();

  // WebSocket for real-time synchronization
  // Added for backend data sending logic
  const onCanvasUpdate = useCallback((data: CanvasData) => {
    setShapes(data.shapes);
    setCanvasConfig(data.config || {});
    setCanvasHistory(data.history || []);
  }, []);

  const { sendShapesUpdate, sendClear, sendUndo } = useWebSocket(
    boardId,
    onCanvasUpdate,
    crypto.randomUUID()
  );

  // Function to send canvas data update to backend
  // Added for backend data sending logic
  const sendCanvasDataToBackend = useCallback(async (shapesToSend: Shape[]) => {
    try {
      await updateCanvasData(boardId, {
        shapes: shapesToSend,
        config: canvasConfig,
        history: canvasHistory
      });
      sendShapesUpdate(shapesToSend);
    } catch (error) {
      console.error('Failed to send canvas data to backend:', error);
    }
  }, [boardId, canvasConfig, canvasHistory, sendShapesUpdate]);

  const {
    saveToHistory,
    handleUndo,
    handleRedo
  } = useHistory(shapes, sendCanvasDataToBackend);

  const onUndo = async () => {
    const newShapes = handleUndo();
    if (newShapes) {
      setShapes(newShapes);
      // Send undo command to backend
      // Added for backend data sending logic
      await undoAction(boardId);
      sendUndo();
    }
  };

  const onRedo = () => {
    const newShapes = handleRedo();
    if (newShapes) {
      setShapes(newShapes);
      // Note: Redo might need backend support
    }
  };

  const {
    editingTextId,
    tempText,
    latexPreview,
    setTempText,
    setEditingTextId,
    setLatexPreview,
    startTextEditing,
    finishTextEditing,
    updateTextInRealTime,
    setIsTextChanged
  } = useTextEditing(shapes, setShapes, saveToHistory, fontSize, strokeColor);

  const {
    updateSelectedTextProperty,
    toggleTextStyle,
    changeFontSizeWithStep
  } = useTextFormatting(shapes, setShapes, saveToHistory, fontSize);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { insertLatexSymbol } = useLatexSymbols(
    textAreaRef,
    editingTextId,
    updateTextInRealTime
  );

  const drawingHandlers = useDrawingHandlers(
    shapes,
    setShapes,
    saveToHistory,
    tool,
    strokeColor,
    strokeWidth,
    fontSize,
    fontFamily,
    textAlign,
    selectedId,
    setSelectedId,
    setDrawingState,
    setTransformState,
    startTextEditing,
    scale
  );

  const [showLatexMenu, setShowLatexMenu] = useState(false);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('fraction');
  const [showTextFormatDropdown, setShowTextFormatDropdown] = useState(false);
  const [showTextAlignDropdown, setShowTextAlignDropdown] = useState(false);
  const [showLatexPreview, setShowLatexPreview] = useState(true);
  const [canvasScroll, setCanvasScroll] = useState({ left: 0, top: 0 });

  // Zoom functions
  const zoomIn = useCallback(() => {
    const maxScale = Math.pow(1.2, 2); // 2 steps in from base scale (1.2^2 = 1.44)
    setScale(prevScale => Math.min(prevScale * 1.2, maxScale));
  }, []);

  const zoomOut = useCallback(() => {
    const minScale = Math.pow(1.2, -10); // 10 steps out from base scale (1 / 1.2^10 ≈ 0.1615)
    setScale(prevScale => Math.max(prevScale / 1.2, minScale));
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    }
  }, [zoomIn, zoomOut]);

  // Update canvas scroll position when scrolling
  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    const handleScroll = () => {
      setCanvasScroll({
        left: container.scrollLeft,
        top: container.scrollTop
      });
    };

    container.addEventListener('scroll', handleScroll);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Apply scale to Stage and adjust scroll position
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const container = stage.container();
    const containerRect = container.getBoundingClientRect();

    // Calculate center of visible area
    const centerX = container.scrollLeft + containerRect.width / 2;
    const centerY = container.scrollTop + containerRect.height / 2;

    // Store old scale
    const oldScale = stage.scaleX();

    // Apply new scale
    stage.scale({ x: scale, y: scale });

    // Adjust scroll to keep center point in the same place
    if (oldScale !== 0) {
      const scaleRatio = scale / oldScale;
      const newScrollLeft = centerX * scaleRatio - containerRect.width / 2;
      const newScrollTop = centerY * scaleRatio - containerRect.height / 2;

      container.scrollLeft = Math.max(0, newScrollLeft);
      container.scrollTop = Math.max(0, newScrollTop);
    }

    // Update canvas scroll state
    setCanvasScroll({
      left: container.scrollLeft,
      top: container.scrollTop
    });

    // Force redraw
    stage.batchDraw();
  }, [scale]);
  
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

  useKeyboard(
    shiftPressed,
    setShiftPressed,
    selectedId,
    editingTextId,
    handleDeleteShape,
    handleUndo,
    finishTextEditing,
    changeFontSizeWithStep,
    toggleTextStyle,
    shapes,
    zoomIn,
    zoomOut
  );

  const handleClearCanvas = async () => {
    setShapes([]);
    setSelectedId(null);
    setEditingTextId(null);
    setTempText('');
    saveToHistory([]);
    // Send clear command to backend
    // Added for backend data sending logic
    await clearCanvas(boardId);
    sendClear();
  };

  const handleLatexSymbolClick = (symbol: any) => {
    insertLatexSymbol(symbol.latex);
    setShowLatexMenu(false);
  };

  const handleUpdateTextProperty = (property: keyof Shape, value: any) => {
    if (!selectedId) return;
    
    const updatedShapes = shapes.map(s => {
      if (s.id === selectedId && (s.type === 'text' || s.type === 'latex')) {
        const updatedShape = { ...s, [property]: value };
        
        if (property === 'stroke') {
          updatedShape.stroke = value;

          if (s.type === 'latex' && s.latex) {
            const currentFontSize = s.fontSize || fontSize;
            updatedShape.latexRendered = renderLatexToHtml(s.latex, currentFontSize);
          }
        }
        
        if (property === 'fontFamily' && s.type === 'text') {
          updatedShape.fontFamily = value;
        }
        
        if (property === 'textAlign') {
          updatedShape.textAlign = value;
        }
        
        if (property === 'fontSize') {
          const newFontSize = parseInt(value) || 20;
          updatedShape.fontSize = newFontSize;
          
          if (s.type === 'text') {
            const lineHeight = newFontSize;
            const lines = (s.text || '').split('\n').length || 1;
            const newHeight = Math.max(lines * lineHeight * 1.2, 50);
            updatedShape.height = newHeight;
          } else if (s.type === 'latex' && s.latex) {
            const size = measureLatexSize(s.latex, newFontSize);
            updatedShape.width = size.width;
            updatedShape.height = size.height;
            const color = s.stroke || strokeColor;
            updatedShape.latexRendered = renderLatexToHtml(s.latex, newFontSize);
          }
        }
        
        return updatedShape;
      }
      return s;
    });
    
    setShapes(updatedShapes);
    saveToHistory(updatedShapes);
  };

  const renderAllShapes = () => {
    const allShapes = [...shapes];

    if (drawingState.currentShape && tool !== 'eraser') {
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
      } else if ((shape.type === 'path' || shape.type === 'highlighter') && shape.points && shape.points.length > 0) {
        allShapes.push(shape as Shape);
      } else if (shape.type === 'line' && shape.points) {
        allShapes.push(shape as Shape);
      }
    }

    return allShapes.map((shape) => {
      const shapeOpacity = shape.opacity !== undefined ? shape.opacity : 1;
      const strokeColorWithOpacity = hexToRgba(shape.stroke, shapeOpacity);
      
      const commonProps = {
        key: shape.id,
        id: shape.id,
        stroke: shape.type === 'text' || shape.type === 'latex' ? undefined : strokeColorWithOpacity,
        strokeWidth: shape.type === 'text' || shape.type === 'latex' ? undefined : shape.strokeWidth,
        fill: shape.type === 'text' || shape.type === 'latex' ? shape.stroke : undefined,
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
            />
          );
        
        case 'highlighter':
          return (
            <Line
              {...commonProps}
              points={shape.points || []}
              tension={0}
              lineCap="round"
              lineJoin="round"
              opacity={0.5}
            />
          );
        
        case 'text':
          if (shape.isEditing) {
            return null;
          }
          
          const textX = shape.width >= 0 ? shape.x : shape.x + shape.width;
          const textY = shape.height >= 0 ? shape.y : shape.y + shape.height;
          const textWidth = Math.abs(shape.width);
          const textHeight = Math.abs(shape.height);
          
          const fontWeight = shape.fontWeight || 'normal';
          const fontStyle = shape.fontStyle || 'normal';
          const textDecoration = shape.textDecoration || 'none';
          
          const fontStyleString = `${fontWeight === 'bold' ? 'bold' : ''} ${fontStyle === 'italic' ? 'italic' : ''}`.trim();
          
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
              fontStyle={fontStyleString}
              textDecoration={textDecoration}
              onDblClick={() => startTextEditing(shape.id)}
            />
          );
        
        case 'latex':
          if (shape.isEditing) {
            return null;
          }
          
          const latexX = shape.width >= 0 ? shape.x : shape.x + shape.width;
          const latexY = shape.height >= 0 ? shape.y : shape.y + shape.height;
          const latexWidth = Math.abs(shape.width);
          const latexHeight = Math.abs(shape.height);
          
          return (
            <Rect
              key={shape.id}
              id={shape.id}
              x={latexX}
              y={latexY}
              width={latexWidth}
              height={latexHeight}
              fill="transparent"
              stroke="transparent"
              strokeWidth={0}
              onDblClick={() => startTextEditing(shape.id)}
            />
          );
        
        default:
          return null;
      }
    });
  };

  const renderLatexShapes = () => {
    const stage = stageRef.current;
    if (!stage) return null;

    const container = stage.container();
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    return shapes
      .filter(shape => shape.type === 'latex' && !shape.isEditing)
      .map((shape) => {
        const latexX = shape.width >= 0 ? shape.x : shape.x + shape.width;
        const latexY = shape.height >= 0 ? shape.y : shape.y + shape.height;
        const latexWidth = Math.abs(shape.width);
        const latexHeight = Math.abs(shape.height);

        const x = containerRect.left + (latexX * scale) - scrollLeft;
        const y = containerRect.top + (latexY * scale) - scrollTop;
        const width = Math.max(latexWidth * scale, 50);
        const height = Math.max(latexHeight * scale, 50);

        return (
          <div
            key={shape.id}
            className="latex-shape-overlay"
            style={{
              position: 'absolute',
              left: `${latexX * scale - scrollLeft}px`,
              top: `${latexY * scale - scrollTop}px`,
              width: `${width}px`,
              height: `${height}px`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: shape.latexRendered || renderLatexToHtml(
                  shape.latex || '',
                  shape.fontSize || fontSize
                )
              }}
              className="latex-rendered-content"
              style={{
                fontSize: `${shape.fontSize || fontSize}px`,
                color: shape.stroke || strokeColor,
              }}
            />
          </div>
        );
      });
  };

  const renderSelection = () => {
  if (!selectedId || tool !== 'select' || drawingState.isDrawing) return null;
  
  const shape = shapes.find(s => s.id === selectedId);
  if (!shape) return null;
  
  if ((shape.type === 'path' || shape.type === 'highlighter') && (!shape.points || shape.points.length === 0)) return null;
  
  let displayShape = { ...shape };
  
  if ((shape.type === 'path' || shape.type === 'line' || shape.type === 'highlighter') && shape.points && shape.points.length > 0) {
    const bbox = calculateBoundingBox(shape.points);
    displayShape = { ...shape, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }
  
  const realX = Math.min(displayShape.x, displayShape.x + displayShape.width);
  const realY = Math.min(displayShape.y, displayShape.y + displayShape.height);
  const realWidth = Math.abs(displayShape.width);
  const realHeight = Math.abs(displayShape.height);
  
  const selectionPadding = 5;
  const anchorSize = 10;
  const halfAnchor = anchorSize / 2;
  
  const x = realX - selectionPadding;
  const y = realY - selectionPadding;
  const width = realWidth + selectionPadding * 2;
  const height = realHeight + selectionPadding * 2;
  
  const anchors = [
    { 
      name: 'anchor-top-left', 
      x: realX, 
      y: realY 
    },
    { 
      name: 'anchor-top-right', 
      x: realX + realWidth, 
      y: realY 
    },
    { 
      name: 'anchor-bottom-left', 
      x: realX, 
      y: realY + realHeight 
    },
    { 
      name: 'anchor-bottom-right', 
      x: realX + realWidth, 
      y: realY + realHeight 
    }
  ];
  
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
    </>
  );
};


  const renderTextInput = () => {
    if (!editingTextId) return null;

    const shape = shapes.find(s => s.id === editingTextId);
    if (!shape || (shape.type !== 'text' && shape.type !== 'latex')) return null;

    const stage = stageRef.current;
    if (!stage) return null;

    const containerRect = stage.container().getBoundingClientRect();

    const textX = shape.width >= 0 ? shape.x : shape.x + shape.width;
    const textY = shape.height >= 0 ? shape.y : shape.y + shape.height;

    const x = textX * scale + containerRect.left;
    const y = textY * scale + containerRect.top;
    const width = Math.max(Math.abs(shape.width) * scale, 100);
    const height = Math.max(Math.abs(shape.height) * scale, 40);
    
    const fontWeight = shape.fontWeight || 'normal';
    const fontStyle = shape.fontStyle || 'normal';
    const textDecoration = shape.textDecoration || 'none';
    
    const textareaStyle: React.CSSProperties = {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      fontSize: `${shape.fontSize || fontSize}px`,
      fontFamily: shape.type === 'latex' ? 'KaTeX_Main, Times New Roman, serif' : (shape.fontFamily || fontFamily),
      textAlign: shape.textAlign || textAlign,
      color: shape.stroke || strokeColor,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: shape.type === 'latex' ? '2px solid #4CAF50' : '1px dashed #007bff',
      outline: 'none',
      resize: 'both',
      overflow: 'auto',
      padding: '4px',
      zIndex: 1000,
      lineHeight: '1.2',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
      fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
      textDecoration: textDecoration,
      backdropFilter: 'blur(2px)',
    };
    
    if (shape.type === 'latex') {
      return (
       <LatexEditor
        shape={shape}
        tempText={tempText}
        textAreaRef={textAreaRef}
        updateTextInRealTime={updateTextInRealTime}
        finishTextEditing={finishTextEditing}
        x={x}
        y={y}
        width={width}
        textareaStyle={textareaStyle}
        latexSymbols={latexSymbols}
        latexCategories={latexCategories}
        handleLatexSymbolClick={handleLatexSymbolClick}
        renderLatexToHtml={renderLatexToHtml}
        showLatexPreview={showLatexPreview}
        showLatexMenu={showLatexMenu}
        selectedLatexCategory={selectedLatexCategory}
        latexPreview={latexPreview}
        fontSize={fontSize}
        strokeColor={strokeColor}
        setShowLatexMenu={setShowLatexMenu}
        setShowLatexPreview={setShowLatexPreview}
        setSelectedLatexCategory={setSelectedLatexCategory}
      />
      );
    }
    
    return (
     <TextEditor 
        textAreaRef={textAreaRef}
        tempText={tempText}
        updateTextInRealTime={updateTextInRealTime}
        finishTextEditing={finishTextEditing}
        textareaStyle={textareaStyle}
     />
    );
  };

  const renderTextToolbar = () => {
    if (tool !== 'select' || !selectedId || editingTextId) return null;

    // At this point selectedId is guaranteed to be a string
    const currentSelectedId = selectedId;

    const selectedShape = shapes.find(s => s.id === currentSelectedId);
    if (!selectedShape || (selectedShape.type !== 'text' && selectedShape.type !== 'latex')) return null;
    
    const stage = stageRef.current;
    if (!stage) return null;
    
    const container = stage.container();
    const containerRect = container.getBoundingClientRect();

    const textX = selectedShape.width >= 0 ? selectedShape.x : selectedShape.x + selectedShape.width;
    const textY = selectedShape.height >= 0 ? selectedShape.y : selectedShape.y + selectedShape.height;

    const realHeight = Math.abs(selectedShape.height);
    const realWidth = Math.abs(selectedShape.width);

    const x = textX * scale + containerRect.left;
    const y = textY * scale + containerRect.top;

    const panelHeight = 40;

    const textPanelWidth = 416;
    const latexPanelWidth = 152;

    const panelWidth = selectedShape.type === 'latex' ? latexPanelWidth : textPanelWidth;

    const offset = 20;

    let top = y - panelHeight - offset;
    if (top < containerRect.top) {
      top = y + realHeight * scale + offset;
    }

    const textCenterX = x + (realWidth * scale) / 2;
    let left = textCenterX - panelWidth / 2;

    // Remove viewport constraints to allow toolbar to follow text containers anywhere
    
    if (selectedShape.type === 'latex') {
      return (
        <LatexToolbar
          selectedShape={selectedShape}
          selectedId={currentSelectedId}
          startTextEditing={startTextEditing}
          updateSelectedTextProperty={handleUpdateTextProperty}
          fontSize={selectedShape.fontSize || fontSize}
          strokeColor={selectedShape.stroke || strokeColor}
          left={left}
          top={top}
          panelWidth={panelWidth}
        />
      );
    }

    const safeSelectedId = currentSelectedId;

    return (
      <TextToolbar
        selectedShape={selectedShape}
        selectedId={safeSelectedId}
        isBold={selectedShape.fontWeight === 'bold'}
        isItalic={selectedShape.fontStyle === 'italic'}
        isUnderline={selectedShape.textDecoration?.includes('underline') || false}
        isStrikethrough={selectedShape.textDecoration?.includes('line-through') || false}
        currentAlign={selectedShape.textAlign || textAlign}
        showTextFormatDropdown={showTextFormatDropdown}
        showTextAlignDropdown={showTextAlignDropdown}
        setShowTextFormatDropdown={setShowTextFormatDropdown}
        setShowTextAlignDropdown={setShowTextAlignDropdown}
        updateSelectedTextProperty={handleUpdateTextProperty}
        startTextEditing={startTextEditing}
        toggleBold={() => toggleTextStyle(safeSelectedId, 'bold')}
        toggleItalic={() => toggleTextStyle(safeSelectedId, 'italic')}
        toggleUnderline={() => toggleTextStyle(safeSelectedId, 'underline')}
        toggleStrikethrough={() => toggleTextStyle(safeSelectedId, 'strikethrough')}
        fontFamily={selectedShape.fontFamily || fontFamily}
        fontSize={selectedShape.fontSize || fontSize}
        strokeColor={selectedShape.stroke || strokeColor}
        availableFonts={availableFonts}
        left={left}
        top={top}
        panelWidth={panelWidth}
      />
    );
  };

  const stageRef = useRef<any>(null);

  const handleMouseDown = (e: any) => {
    drawingHandlers.handleMouseDown(e);
  };

  const handleMouseMove = (e: any) => {
    drawingHandlers.handleMouseMove(e, drawingState, transformState, shiftPressed);
  };

  const handleMouseUp = () => {
    if (drawingState.isDrawing && drawingState.currentShape) {
      const newShape = { ...drawingState.currentShape } as Shape;
      
      if (tool === 'eraser') {
        if (drawingHandlers.erasedShapes.size > 0 && drawingHandlers.eraserHistoryStart) {
          saveToHistory(shapes);
        }
        
        drawingHandlers.setErasedShapes(new Set());
        drawingHandlers.setEraserHistoryStart(null);
        
        resetDrawingState();
        return;
      }
      
      if ((tool === 'pencil' || tool === 'highlighter') && newShape.points && newShape.points.length >= 4) {
        const bbox = calculateBoundingBox(newShape.points);
        newShape.x = bbox.x;
        newShape.y = bbox.y;
        newShape.width = bbox.width;
        newShape.height = bbox.height;
        
        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
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
      else if ((tool === 'rectangle' || tool === 'ellipse') &&
               drawingState.currentShape.width !== 0 &&
               drawingState.currentShape.height !== 0) {

        // Shape is already normalized in handleMouseMove, just constrain to canvas
        const constrained = drawingHandlers.constrainToCanvas(newShape.x, newShape.y, newShape.width, newShape.height);
        newShape.x = constrained.x;
        newShape.y = constrained.y;
        newShape.width = constrained.width;
        newShape.height = constrained.height;

        const newShapes = [...shapes, newShape];
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
      
      resetDrawingState();
    }
    
    if (transformState.isTransforming) {
      saveToHistory(shapes);
      resetTransformState();
    }
    
    if (drawingHandlers.isDragging) {
      drawingHandlers.setIsDragging(false);
      drawingHandlers.setOriginalPointsOnDragStart([]);
      saveToHistory(shapes);
    }
  };

  return (
    <div className="drawing-app-container">
      <h1 className="top-header">Paint</h1>
      <div className="drawing-toolbar-container">
        <div className="drawing-toolbar">
          <BrushToolbar
            finishTextEditing={() => finishTextEditing(true)}
            tool={tool}
            setTool={setTool}
            strokeColor={strokeColor}
            setStrokeColor={setStrokeColor}
            editingTextId={editingTextId}
          />
          <RangeToolbar 
            tool={tool}
            strokeWidth={strokeWidth}
            setStrokeWidth={setStrokeWidth}
          /> 
          <ToolsToolbar
            handleUndo={onUndo}
            handleRedo={onRedo}
            handleClearCanvas={handleClearCanvas}
            finishTextEditing={finishTextEditing}
            setTool={setTool}
            editingTextId={editingTextId || ''}
            tool={tool}
          />
          <SelDelToolbar
            finishTextEditing={finishTextEditing}
            setTool={setTool}
            tool={tool}
            editingTextId={editingTextId || ''}
            handleDeleteShape={handleDeleteShape}
            selectedId={selectedId || ''}
          />
          <OCRToolbar />
        </div>
      </div>
      <div className="canvas-container">
        <Stage
          ref={stageRef}
          width={6000 * scale}
          height={2500 * scale}
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
        {renderLatexShapes()}
      </div>
      {renderTextToolbar()}
    </div>
  );
};

export default DrawingApp;
