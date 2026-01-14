// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Stage, Layer, Rect, Ellipse, Line, Text } from 'react-konva';
import 'katex/dist/katex.min.css';
import './App.css';

import BrushToolbar from './components/BrushToolbar.tsx';
import RangeToolbar from './components/RangeToolbar.tsx';
import ToolsToolbar from './components/ToolsToolbar.tsx';
import SelDelToolbar from './components/SelDelToolbar.tsx';
import OCRToolbar from './components/OCRToolbar.tsx';
import OCRPreview from './components/OCRPreview.tsx';
import TextToolbar from './components/TextToolbar.tsx';
import LatexToolbar from './components/LatexToolbar.tsx';
import LatexEditor from './components/LatexEditor.tsx';
import TextEditor from './components/TextEditor.tsx';

import type { 
  Shape, ToolMode, TextAlign, 
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
import { calculateBoundingBox, isRectInside } from './utils/shapeUtils';
import { renderLatexToHtml, measureLatexSize } from './utils/latexUtils';
import { onWidgetInitialized, type WidgetInitPayload } from './services/widgetBridge';
import { statsService, type MetricsData, type WidgetConfig } from './services/statsService';

const DrawingAppContent: React.FC = () => {
  const [widget, setWidget] = useState<WidgetInitPayload | null>(null);
  const [boardId, setBoardId] = useState<string>('');
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [ocrSelection, setOcrSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [ocrPreviewLatex, setOcrPreviewLatex] = useState('');
  const [isOcrEditing, setIsOcrEditing] = useState(false);

  const [statsModuleCreated, setStatsModuleCreated] = useState(false);
  const [toolsUsage, setToolsUsage] = useState<Record<string, number>>({});
  const [sessionStartTime] = useState(Date.now());
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // const initWithFallback = () => {
    //   const devPayload: WidgetInitPayload = {
    //     widgetId: -1,
    //     userId: 0,
    //     role: 'user',
    //     config: {},
    //     board: {
    //       id: 0,
    //       name: 'Offline Board',
    //       parentId: 0
    //     }
    //   };
      
    //   console.log('Initializing in offline mode');
    //   setWidget(devPayload);
    //   setBoardId('offline-' + Date.now());
    //   setWidgetId(-1);
    //   setIsInitialized(true);
    // };

    const unsubscribe = onWidgetInitialized((payload: WidgetInitPayload) => {
      console.log('Widget initialized via getInfo:', payload);
      
      setWidget(payload);
      setBoardId(String(payload.board.id));
      setWidgetId(payload.widgetId);

      if (payload.config) {
        setCanvasConfig(payload.config);
      }
      
      setIsInitialized(true);

      if (payload.widgetId > 0) {
        initializeStatsModule(payload);
      }
    });

    // timeoutId = setTimeout(() => {
    //   if (!isInitialized) {
    //      initWithFallback();
    //   }
    // }, 1000);

    if (process.env.NODE_ENV === 'development') {
      const devPayload: WidgetInitPayload = {
        widgetId: -1,
        userId: 0,
        role: 'user',
        config: {},
        board: {
          id: 0,
          name: 'Dev Board',
          parentId: 0
        }
      };
      
      console.warn('Running in standalone development mode');
      setWidget(devPayload);
      setBoardId('temp-' + Date.now());
      setWidgetId(-1);
      setIsInitialized(true);
    }

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const initializeStatsModule = useCallback(async (widgetInfo: WidgetInitPayload) => {
    try {
      const moduleName = `DrawingWidget-${widgetInfo.widgetId}-${widgetInfo.board.id}`;
      const moduleData = await statsService.createModule(moduleName);
      console.log('Stats module created:', moduleData);
      setStatsModuleCreated(true);
    } catch (error) {
      console.error('Failed to create stats module:', error);
    }
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const baseWidth = 1920;
      const baseHeight = 1080;
      const marginTop = 0;
      const marginBottom = 30;
      const marginLeft = 30;
      const marginRight = 30;
      const currentWidth = window.innerWidth - marginLeft - marginRight;
      const currentHeight = window.innerHeight - marginTop - marginBottom;
      const scale = Math.min(currentWidth / baseWidth, currentHeight / baseHeight) * 0.95 * 2;
      document.documentElement.style.setProperty('--scale', scale.toString());
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [canvasConfig, setCanvasConfig] = useState<any>({});
  const [canvasHistory, setCanvasHistory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [fontSize] = useState(20);
  const [fontFamily] = useState('Arial');
  const [textAlign] = useState<TextAlign>('left');
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

  const collectMetrics = useCallback((): MetricsData => {
    const now = Date.now();
    const sessionDuration = Math.floor((now - sessionStartTime) / 1000);

    return {
      shapesCount: shapes.length,
      toolsUsage: { ...toolsUsage },
      lastUpdated: new Date().toISOString(),
      sessionDuration,
      boardId,
      widgetId
    };
  }, [shapes.length, toolsUsage, sessionStartTime, boardId, widgetId]);   

  const createWidgetConfig = useCallback((): WidgetConfig => {
    return {
      shapes: shapes.map(shape => ({
        id: shape.id,
        type: shape.type,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        stroke: shape.stroke,
        strokeWidth: shape.strokeWidth,
        ...(shape.type === 'text' && { text: shape.text }),
        ...(shape.type === 'latex' && { latex: shape.latex }),
      })),
      config: {
        ...canvasConfig,
        strokeColor,
        strokeWidth,
        fontSize,
        fontFamily,
        textAlign,
        scale,
        lastModifiedBy: 'drawing-app'
      },
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };
  }, [shapes, canvasConfig, strokeColor, strokeWidth, fontSize, fontFamily, textAlign, scale]);

  const sendWidgetConfigImmediately = useCallback(async () => {
    if (!widget || !widget.widgetId || widget.widgetId <= 0) {
      return;
    }

    try {
      const config = createWidgetConfig();
      
      const response = await fetch(`http://85.234.22.160:1111/api/widget/${widget.widgetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        // Silently fail
      }
    } catch (error) {
      // Silently fail
    }
  }, [widget, createWidgetConfig]);

  const getAuthToken = (): string => {
    return localStorage.getItem('authToken') || '';
  };

  useEffect(() => {
    if (!statsModuleCreated || !widget || widget.widgetId <= 0) return;

    const intervalId = setInterval(async () => {
      try {
        const metrics = collectMetrics();
        await statsService.sendMetrics(metrics);
      } catch (error) {
        // Silently fail
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [statsModuleCreated, widget, collectMetrics]);

  const sendCanvasDataToBackend = useCallback(async (shapesToSend: Shape[]) => {
    if (widget && widget.widgetId > 0) {
      try {
        await updateCanvasData(boardId, {
          shapes: shapesToSend,
          config: canvasConfig,
          history: canvasHistory
        });
        
        if (sendShapesUpdate) {
          sendShapesUpdate(shapesToSend);
        }

        sendWidgetConfigImmediately();
      } catch (error) {
        // Silently fail
      }
    }
  }, [boardId, canvasConfig, canvasHistory, sendShapesUpdate, widget, sendWidgetConfigImmediately]);

  const {
    saveToHistory,
    handleUndo,
    handleRedo
  } = useHistory(shapes, sendCanvasDataToBackend);

  const updateToolsUsage = useCallback((toolName: string) => {
    setToolsUsage(prev => ({
      ...prev,
      [toolName]: (prev[toolName] || 0) + 1
    }));
  }, []);

  useEffect(() => {
    if (tool && tool !== 'select') {
      updateToolsUsage(tool);
    }
  }, [tool, updateToolsUsage]);

  useEffect(() => {
    if (tool !== 'ocr-selection') {
      setOcrSelection(null);
      const newShapes = shapes.filter(shape => !shape.id.startsWith('ocr_border_'));
      if (newShapes.length !== shapes.length) {
        setShapes(newShapes);
        saveToHistory(newShapes);
      }
    }
  }, [tool, shapes, saveToHistory]);

  const onUndo = async () => {
    const newShapes = handleUndo();
    if (newShapes) {
      setShapes(newShapes);
      if (widget && widget.widgetId > 0) {
        try {
          await undoAction(boardId);
          if (sendUndo) {
            sendUndo();
          }
          sendWidgetConfigImmediately();
        } catch (error) {
          // Silently fail
        }
      }
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
    startTextEditing,
    finishTextEditing,
    updateTextInRealTime,
  } = useTextEditing(shapes, setShapes, saveToHistory, fontSize, strokeColor);

  const {
    toggleTextStyle,
    changeFontSizeWithStep
  } = useTextFormatting(shapes, setShapes, saveToHistory, fontSize);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { insertLatexSymbol } = useLatexSymbols(
    textAreaRef,
    editingTextId,
    updateTextInRealTime
  );

  const clearOcrBorders = useCallback(() => {
    const newShapes = shapes.filter(shape => !shape.id.startsWith('ocr_border_'));
    if (newShapes.length !== shapes.length) {
      setShapes(newShapes);
      saveToHistory(newShapes);
    }
  }, [shapes, setShapes, saveToHistory]);

  const drawingHandlers = useDrawingHandlers(
    setIsDrawingActive,
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
    scale,
    ocrSelection,
    setOcrSelection,
    clearOcrBorders
  );

  const [showLatexMenu, setShowLatexMenu] = useState(false);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('fraction');
  const [showTextFormatDropdown, setShowTextFormatDropdown] = useState(false);
  const [showTextAlignDropdown, setShowTextAlignDropdown] = useState(false);
  const [showLatexPreview, setShowLatexPreview] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleOcrRecognize = useCallback(async () => {
    if (!ocrSelection || !stageRef.current) {
      return;
    }

    try {
      const stage = stageRef.current;

      const shapesWithoutOcrBorder = shapes.filter(shape => !shape.id.startsWith('ocr_border_'));
      const hadOcrBorder = shapesWithoutOcrBorder.length !== shapes.length;

      if (hadOcrBorder) {
        setShapes(shapesWithoutOcrBorder);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        if (hadOcrBorder) {
          setShapes(shapes);
        }
        return;
      }

      tempCanvas.width = ocrSelection.width * scale;
      tempCanvas.height = ocrSelection.height * scale;

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      const dataURL = stage.toDataURL({
        x: ocrSelection.x * scale,
        y: ocrSelection.y * scale,
        width: ocrSelection.width * scale,
        height: ocrSelection.height * scale
      });

      const img = new Image();
      img.src = dataURL;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      tempCtx.drawImage(img, 0, 0);

      const finalDataURL = tempCanvas.toDataURL('image/png', 1.0);

      const response = await fetch('http://localhost:8000/api/ocr/latex/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_data: finalDataURL }),
      });

      const result = await response.json();

      if (result.success && result.latex) {
        let latexFormula = result.latex.trim();
        if (latexFormula.startsWith('$') && latexFormula.endsWith('$')) {
          latexFormula = latexFormula.slice(1, -1);
        }
        if (latexFormula.startsWith('$$') && latexFormula.endsWith('$$')) {
          latexFormula = latexFormula.slice(2, -2);
        }
        latexFormula = latexFormula.trim();

        setOcrPreviewLatex(latexFormula);
        setShowOcrPreview(true);
        setIsOcrEditing(false);
      } else {
        if (hadOcrBorder) {
          setShapes(shapes);
        }
      }
    } catch (error) {
      const shapesWithOcrBorder = shapes.filter(shape => shape.id.startsWith('ocr_border_'));
      if (shapesWithOcrBorder.length > 0) {
        setShapes(shapes);
      }
    }
  }, [ocrSelection, shapes, scale]);

  const handleOcrSelect = useCallback(() => {
    if (editingTextId) {
      finishTextEditing();
    }
    setOcrSelection(null);
    setTool('ocr-selection');
  }, [editingTextId, finishTextEditing]);

  const handleOcrPreviewSave = useCallback((finalLatex: string) => {
    if (!ocrSelection) return;

    const shapesWithoutOcrBorder = shapes.filter(shape => !shape.id.startsWith('ocr_border_'));
    const newShapes = shapesWithoutOcrBorder.filter(shape => {
      const shapeRect = {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
      };
      return !isRectInside(ocrSelection, shapeRect);
    });

    const latexSize = measureLatexSize(finalLatex, fontSize);

    const newLatexShape: Shape = {
      id: `latex_${Date.now()}`,
      type: 'latex',
      x: ocrSelection.x,
      y: ocrSelection.y,
      width: latexSize.width,
      height: latexSize.height,
      stroke: strokeColor,
      strokeWidth: 1,
      latex: finalLatex,
      latexRendered: renderLatexToHtml(finalLatex, fontSize),
      fontSize: fontSize,
      fontFamily: 'KaTeX_Main',
      textAlign: 'left',
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      isSelected: false,
      isEditing: false,
      isLatex: true,
      scaleX: 1,
      scaleY: 1,
      rotation: 0
    };

    const updatedShapes = [...newShapes, newLatexShape];
    setShapes(updatedShapes);
    saveToHistory(updatedShapes);

    setOcrSelection(null);
    setTool('select');
    setShowOcrPreview(false);

    sendCanvasDataToBackend(updatedShapes);
  }, [ocrSelection, shapes, fontSize, strokeColor, saveToHistory, sendCanvasDataToBackend]);

  const handleOcrPreviewEdit = useCallback(() => {
    setIsOcrEditing(true);
  }, []);

  const handleOcrPreviewCancel = useCallback(() => {
    setShowOcrPreview(false);
    setOcrSelection(null);
    setTool('select');
  }, []);

  const handleOcrFinishEdit = useCallback((editedLatex: string) => {
    setOcrPreviewLatex(editedLatex);
    setIsOcrEditing(false);
  }, []);

  useEffect(() => {
    if (!isPanning) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      const container = canvasContainerRef.current;
      if (container) {
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, panStart]);

  const zoomIn = useCallback(() => {
    const maxScale = 1.2;
    setScale(prevScale => Math.min(prevScale * 1.2, maxScale));
  }, []);

  const zoomOut = useCallback(() => {
    const minScale = Math.pow(1.2, -10);
    setScale(prevScale => Math.max(prevScale / 1.2, minScale));
  }, []);

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.scale({ x: scale, y: scale });
    stage.batchDraw();
  }, [scale]);

  useEffect(() => {
    const container = stageRef.current?.container();
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);
  
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
    onUndo,
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
    setOcrSelection(null);
    saveToHistory([]);
    
    if (widget && widget.widgetId > 0) {
      try {
        await clearCanvas(boardId);
        if (sendClear) {
          sendClear();
        }
        sendWidgetConfigImmediately();
      } catch (error) {
        // Silently fail
      }
    }
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

    if (ocrSelection) {
      allShapes.push({
        id: 'ocr-selection',
        type: 'rectangle',
        x: ocrSelection.x,
        y: ocrSelection.y,
        width: ocrSelection.width,
        height: ocrSelection.height,
        stroke: '#007bff',
        strokeWidth: 2,
        dash: [5, 5],
        fill: 'transparent',
        opacity: 1
      } as Shape);
    }

    return allShapes.map((shape) => {
      const shapeOpacity = shape.opacity !== undefined ? shape.opacity : 1;
      const strokeColorWithOpacity = hexToRgba(shape.stroke, shapeOpacity);
      
      const commonProps = {
        key: shape.id,
        id: shape.id,
        stroke: shape.type === 'text' || shape.type === 'latex' ? undefined : strokeColorWithOpacity,
        strokeWidth: shape.type === 'text' || shape.type === 'latex' ? undefined : shape.strokeWidth,
        fill: shape.type === 'text' || shape.type === 'latex' ? shape.stroke : shape.fill,
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
              dash={shape.dash}
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

    return shapes
      .filter(shape => shape.type === 'latex' && !shape.isEditing)
      .map((shape) => {
        const latexX = shape.width >= 0 ? shape.x : shape.x + shape.width;
        const latexY = shape.height >= 0 ? shape.y : shape.y + shape.height;
        const latexWidth = Math.abs(shape.width);
        const latexHeight = Math.abs(shape.height);

        const width = Math.max(latexWidth * scale, 50);
        const height = Math.max(latexHeight * scale, 50);

        return (
          <div
            key={shape.id}
            className="latex-shape-overlay"
            style={{
              position: 'absolute',
              left: `${latexX * scale - container.scrollLeft}px`,
              top: `${latexY * scale - container.scrollTop}px`,
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
                  (shape.fontSize || fontSize) * scale
                )
              }}
              className="latex-rendered-content"
              style={{
                fontSize: `${(shape.fontSize || fontSize) * scale}px`,
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

    const container = canvasContainerRef.current;
    if (!container) return null;

    const textX = shape.width >= 0 ? shape.x : shape.x + shape.width;
    const textY = shape.height >= 0 ? shape.y : shape.y + shape.height;

    const canvasX = textX * scale;
    const canvasY = textY * scale;

    const width = Math.max(Math.abs(shape.width) * scale, 100);
    const height = Math.max(Math.abs(shape.height) * scale, 40);

    const fontWeight = shape.fontWeight || 'normal';
    const fontStyle = shape.fontStyle || 'normal';
    const textDecoration = shape.textDecoration || 'none';

    const baseTextareaStyle: React.CSSProperties = {
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
      lineHeight: '1.2',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
      fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
      textDecoration: textDecoration,
      backdropFilter: 'blur(2px)',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      display: 'block',
    };

    if (shape.type === 'latex') {
      return (
        <LatexEditor
          shape={shape}
          tempText={tempText}
          textAreaRef={textAreaRef}
          updateTextInRealTime={updateTextInRealTime}
          finishTextEditing={finishTextEditing}
          x={canvasX}
          y={canvasY}
          width={width}
          height={height}
          textareaStyle={baseTextareaStyle}
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

    const textareaStyle: React.CSSProperties = {
      ...baseTextareaStyle,
      position: 'absolute',
      left: `${canvasX}px`,
      top: `${canvasY}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: 1000,
    };

    return (
      <TextEditor
        textAreaRef={textAreaRef}
        tempText={tempText}
        updateTextInRealTime={updateTextInRealTime}
        finishTextEditing={() => finishTextEditing(true)}
        textareaStyle={textareaStyle}
      />
    );
  };

  const renderTextToolbar = () => {
    if (tool !== 'select' || !selectedId || editingTextId) return null;

    const currentSelectedId = selectedId;

    const selectedShape = shapes.find(s => s.id === currentSelectedId);
    if (!selectedShape || (selectedShape.type !== 'text' && selectedShape.type !== 'latex')) return null;

    const container = canvasContainerRef.current;
    if (!container) return null;

    const textX = selectedShape.width >= 0 ? selectedShape.x : selectedShape.x + selectedShape.width;
    const textY = selectedShape.height >= 0 ? selectedShape.y : selectedShape.y + selectedShape.height;

    const realHeight = Math.abs(selectedShape.height);
    const realWidth = Math.abs(selectedShape.width);

    const canvasX = textX * scale;
    const canvasY = textY * scale;

    const textPanelWidth = 416;
    const latexPanelWidth = 152;

    const panelWidth = selectedShape.type === 'latex' ? latexPanelWidth : textPanelWidth;

    const offset = 20;

    const top = canvasY + realHeight * scale + offset;

    const textCenterX = canvasX + (realWidth * scale) / 2;
    let left = textCenterX - panelWidth / 2;

    const maxLeft = 6000 * scale - panelWidth;
    if (left > maxLeft) left = maxLeft;
    if (left < 0) left = 0;

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
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollPosition({
        left: container.scrollLeft,
        top: container.scrollTop,
      });
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleMouseDown = (e: any) => {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.evt.clientX, y: e.evt.clientY });
      return;
    }

    if (tool !== 'select') {
      setIsDrawingActive(true);
    }

    drawingHandlers.handleMouseDown(e);
  };

  const handleMouseMove = (e: any) => {
    if (isPanning) {
      return;
    }

    drawingHandlers.handleMouseMove(e, drawingState, transformState, shiftPressed);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

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
      
      if (tool === 'ocr-selection') {
        const { x = 0, y = 0, width = 0, height = 0 } = drawingState.currentShape;

        const normalizedX = width >= 0 ? x : x + width;
        const normalizedY = height >= 0 ? y : y + height;
        const normalizedWidth = Math.abs(width);
        const normalizedHeight = Math.abs(height);

        setOcrSelection({
          x: normalizedX,
          y: normalizedY,
          width: normalizedWidth,
          height: normalizedHeight
        });

        const selectionBorder: Shape = {
          id: `ocr_border_${Date.now()}`,
          type: 'rectangle',
          x: normalizedX,
          y: normalizedY,
          width: normalizedWidth,
          height: normalizedHeight,
          stroke: '#007bff',
          strokeWidth: 2,
          dash: [5, 5],
          fill: 'transparent',
          opacity: 1
        };

        const newShapes = [...shapes, selectionBorder];
        setShapes(newShapes);
        saveToHistory(newShapes);

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
      
      if (widget && widget.widgetId > 0) {
        sendWidgetConfigImmediately();
      }
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
    
    setIsDrawingActive(false);
  };

  if (!isInitialized) {
    return <div className="drawing-app-container">Loading...</div>;
  }

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
          <OCRToolbar 
            onOcrSelect={handleOcrSelect}
            onOcrRecognize={handleOcrRecognize}
            tool={tool}
            ocrSelection={ocrSelection}
            editingTextId={editingTextId}
            finishTextEditing={finishTextEditing}
          />
        </div>
      </div>
      <div className="canvas-container" ref={canvasContainerRef} style={{ cursor: isPanning ? 'grabbing' : 'default' }}>
        <div 
          className="canvas-overlay-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${6000 * scale}px`,
            height: `${2500 * scale}px`,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {renderLatexShapes()}
          {renderTextInput()}
          {renderTextToolbar()}
          {showOcrPreview && (
            <OCRPreview
              latex={ocrPreviewLatex}
              position={ocrSelection ? {
                x: (ocrSelection.x + ocrSelection.width / 2) * scale - 150,
                y: (ocrSelection.y + ocrSelection.height / 2) * scale - 100
              } : { x: 100, y: 100 }}
              fontSize={fontSize}
              strokeColor={strokeColor}
              onSave={handleOcrPreviewSave}
              onEdit={handleOcrPreviewEdit}
              onCancel={handleOcrPreviewCancel}
              isEditing={isOcrEditing}
              onFinishEdit={handleOcrFinishEdit}
            />
          )}
        </div>
        <Stage
          ref={stageRef}
          width={6000 * scale}
          height={2500 * scale}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsPanning(false)}
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
      <div className="zoom-buttons">
        <button className="zoom-button zoom-plus" onClick={zoomIn}></button>
        <button className="zoom-button zoom-minus" onClick={zoomOut}></button>
      </div>
    </div>
  );
};

const DrawingApp: React.FC = () => {
  return (
    <ReactFlowProvider>
      <DrawingAppContent />
    </ReactFlowProvider>
  );
};

export default DrawingApp;