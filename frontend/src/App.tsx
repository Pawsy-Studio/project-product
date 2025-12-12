import { useState, useRef, useEffect } from 'react';
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

import { hexToRgba } from './utils/colorUtils';
import { calculateBoundingBox } from './utils/shapeUtils';
import { renderLatexToHtml, measureLatexSize } from './utils/latexUtils';

const DrawingApp: React.FC = () => {
  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textAlign, setTextAlign] = useState<TextAlign>('left');
  const [shiftPressed, setShiftPressed] = useState(false);
  
  const {
    drawingState,
    setDrawingState,
    transformState,
    setTransformState,
    resetDrawingState,
    resetTransformState
  } = useDrawingState();
  
  const {
    saveToHistory,
    handleUndo,
    handleRedo
  } = useHistory(shapes);

  const onUndo = () => {
    const newShapes = handleUndo();
    if (newShapes) {
      setShapes(newShapes);
    }
  };

  const onRedo = () => {
    const newShapes = handleRedo();
    if (newShapes) {
      setShapes(newShapes);
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
    startTextEditing
  );
  
  const [showLatexMenu, setShowLatexMenu] = useState(false);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('all');
  const [showTextFormatDropdown, setShowTextFormatDropdown] = useState(false);
  const [showTextAlignDropdown, setShowTextAlignDropdown] = useState(false);
  const [showLatexPreview, setShowLatexPreview] = useState(true);
  
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
    shapes
  );

  const handleClearCanvas = () => {
    setShapes([]);
    setSelectedId(null);
    setEditingTextId(null);
    setTempText('');
    saveToHistory([]);
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
            updatedShape.latexRendered = renderLatexToHtml(s.latex, currentFontSize, value);
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
            updatedShape.latexRendered = renderLatexToHtml(s.latex, newFontSize, color);
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
    
    return shapes
      .filter(shape => shape.type === 'latex' && !shape.isEditing)
      .map((shape) => {
        const containerRect = stage.container().getBoundingClientRect();
        const scaleX = stage.width() / stage.width();
        const scaleY = stage.height() / stage.height();
        
        const latexX = shape.width >= 0 ? shape.x : shape.x + shape.width;
        const latexY = shape.height >= 0 ? shape.y : shape.y + shape.height;
        const latexWidth = Math.abs(shape.width);
        const latexHeight = Math.abs(shape.height);
        
        const x = latexX * scaleX + containerRect.left;
        const y = latexY * scaleY + containerRect.top;
        const width = Math.max(latexWidth * scaleX, 50);
        const height = Math.max(latexHeight * scaleY, 50);
        
        return (
          <div
            key={shape.id}
            className="latex-shape-overlay"
            style={{
              position: 'fixed',
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
              pointerEvents: 'none',
            }}
          >
            <div
              dangerouslySetInnerHTML={{ 
                __html: shape.latexRendered || renderLatexToHtml(
                  shape.latex || '', 
                  shape.fontSize || fontSize,
                  shape.stroke || strokeColor
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
  
  // Для фигур с точками рассчитываем реальные границы
  if ((shape.type === 'path' || shape.type === 'line' || shape.type === 'highlighter') && shape.points && shape.points.length > 0) {
    const bbox = calculateBoundingBox(shape.points);
    displayShape = { ...shape, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }
  
  // Рассчитываем реальные координаты якорей с учетом знака размеров
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
  
  // Правильно рассчитываем позиции якорей
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
    const scaleX = stage.width() / stage.width();
    const scaleY = stage.height() / stage.height();
    
    const textX = shape.width >= 0 ? shape.x : shape.x + shape.width;
    const textY = shape.height >= 0 ? shape.y : shape.y + shape.height;
    
    const x = textX * scaleX + containerRect.left;
    const y = textY * scaleY + containerRect.top;
    const width = Math.max(Math.abs(shape.width) * scaleX, 100);
    const height = Math.max(Math.abs(shape.height) * scaleY, 40);
    
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
    if (tool !== 'select' || !selectedId) return null;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (!selectedShape || (selectedShape.type !== 'text' && selectedShape.type !== 'latex')) return null;
    
    if (editingTextId) return null;
    
    const stage = stageRef.current;
    if (!stage) return null;
    
    const container = stage.container();
    const containerRect = container.getBoundingClientRect();
    
    const textX = selectedShape.x;
    const textY = selectedShape.y;
    
    const scaleX = stage.scaleX();
    const scaleY = stage.scaleY();
    
    const realY = Math.min(selectedShape.y, selectedShape.y + selectedShape.height);
    const realHeight = Math.abs(selectedShape.height);
    const realWidth = Math.abs(selectedShape.width);
    
    const x = textX * scaleX + containerRect.left;
    const y = realY * scaleY + containerRect.top;
    
    const panelHeight = 40;
    const panelWidth = 416;
    
    const offset = 20;
    
    let top = y - panelHeight - offset;
    if (top < containerRect.top) {
      top = y + realHeight * scaleY + offset;
    }
    
    const textCenterX = x + (realWidth * scaleX) / 2;
    let left = textCenterX - panelWidth / 2;

    if (left < containerRect.left) {
      left = containerRect.left;
    }
    if (left + panelWidth > containerRect.right) {
      left = containerRect.right - panelWidth;
    }
    
    return (
      <TextToolbar
        selectedShape={selectedShape}
        selectedId={selectedId}
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
        toggleBold={() => toggleTextStyle(selectedId, 'bold')}
        toggleItalic={() => toggleTextStyle(selectedId, 'italic')}
        toggleUnderline={() => toggleTextStyle(selectedId, 'underline')}
        toggleStrikethrough={() => toggleTextStyle(selectedId, 'strikethrough')}
        fontFamily={selectedShape.fontFamily || fontFamily}
        fontSize={selectedShape.fontSize || fontSize}
        textAlign={selectedShape.textAlign || textAlign}
        strokeColor={selectedShape.stroke || strokeColor}
        availableFonts={availableFonts}
        left={left}
        top={top}
        panelWidth={panelWidth}
        tool={tool}
        editingTextId={editingTextId}
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
        
        const startX = drawingState.startX;
        const startY = drawingState.startY;
        const width = newShape.width || 0;
        const height = newShape.height || 0;
        
        const finalX = Math.max(0, Math.min(startX, 1000 - Math.abs(width)));
        const finalY = Math.max(0, Math.min(startY, 387 - Math.abs(height)));
        
        newShape.x = finalX;
        newShape.y = finalY;
        newShape.width = width;
        newShape.height = height;
        
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
            editingTextId={editingTextId}
            tool={tool}
          />
          <SelDelToolbar 
            finishTextEditing={finishTextEditing}
            setTool={setTool}
            tool={tool}
            editingTextId={editingTextId}
            handleDeleteShape={handleDeleteShape}
            selectedId={selectedId}
          />
          <OCRToolbar />
        </div>
      </div>
      <div className="canvas-container">
        <Stage
          ref={stageRef}
          width={1000}
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
        {renderLatexShapes()}
      </div>
      {renderTextToolbar()}
    </div>
  );
};

export default DrawingApp;