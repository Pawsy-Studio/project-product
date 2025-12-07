import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Circle, Text } from 'react-konva';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path' | 'text' | 'latex';
type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex';
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
  latex?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: TextAlign;
  isEditing?: boolean;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  isLatex?: boolean;
  latexRendered?: string;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
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
  startFontSize?: number;
}

interface LatexSymbol {
  name: string;
  latex: string;
  description: string;
  category: 'fraction' | 'root' | 'superscript' | 'subscript' | 'brackets' | 'operators';
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
  const [erasedShapes, setErasedShapes] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');
  const [isTextChanged, setIsTextChanged] = useState(false);

  const [latexSymbols, setLatexSymbols] = useState<LatexSymbol[]>([
    { name: 'Простая дробь', latex: '\\frac{}{}', description: 'Дробь с числителем и знаменателем', category: 'fraction' },
    { name: 'Смешанная дробь', latex: '\\frac{числитель}{знаменатель}', description: 'Дробь с заполнителями', category: 'fraction' },
    { name: 'Квадратный корень', latex: '\\sqrt{}', description: 'Квадратный корень', category: 'root' },
    { name: 'Корень n-ой степени', latex: '\\sqrt[]{}', description: 'Корень с показателем степени', category: 'root' },
    { name: 'Верхний индекс', latex: '^{}', description: 'Надстрочный индекс', category: 'superscript' },
    { name: 'Нижний индекс', latex: '_{}', description: 'Подстрочный индекс', category: 'subscript' },
    { name: 'Комбинированный', latex: '_{}^{}', description: 'И верхний и нижний индекс', category: 'superscript' },
    { name: 'Модуль', latex: '\\left| \\right|', description: 'Скобки модуля', category: 'brackets' },
    { name: 'Круглые скобки', latex: '\\left( \\right)', description: 'Круглые скобки', category: 'brackets' },
    { name: 'Квадратные скобки', latex: '\\left[ \\right]', description: 'Квадратные скобки', category: 'brackets' },
    { name: 'Фигурные скобки', latex: '\\left\\{ \\right\\}', description: 'Фигурные скобки', category: 'brackets' },
    { name: 'Сумма', latex: '\\sum_{}^{}', description: 'Сумма', category: 'operators' },
    { name: 'Интеграл', latex: '\\int_{}^{}', description: 'Интеграл', category: 'operators' },
    { name: 'Предел', latex: '\\lim_{}', description: 'Предел', category: 'operators' },
    { name: 'Производная', latex: '\\frac{d}{dx}', description: 'Производная', category: 'operators' },
    { name: 'Бесконечность', latex: '\\infty', description: 'Символ бесконечности', category: 'operators' },
    { name: 'Приблизительно', latex: '\\approx', description: 'Приблизительное равенство', category: 'operators' },
    { name: 'Не равно', latex: '\\neq', description: 'Не равно', category: 'operators' },
    { name: 'Меньше или равно', latex: '\\leq', description: 'Меньше или равно', category: 'operators' },
    { name: 'Больше или равно', latex: '\\geq', description: 'Больше или равно', category: 'operators' },
    { name: 'Принадлежит', latex: '\\in', description: 'Принадлежность множеству', category: 'operators' },
    { name: 'Для всех', latex: '\\forall', description: 'Для всех', category: 'operators' },
    { name: 'Существует', latex: '\\exists', description: 'Существует', category: 'operators' },
    { name: 'Следовательно', latex: '\\therefore', description: 'Следовательно', category: 'operators' },
  ]);
  
  const [showLatexMenu, setShowLatexMenu] = useState(false);
  const [latexCategories, setLatexCategories] = useState<Array<{id: string, name: string}>>([
    { id: 'all', name: 'Все символы' },
    { id: 'fraction', name: 'Дроби' },
    { id: 'root', name: 'Корни' },
    { id: 'superscript', name: 'Верхние/нижние индексы' },
    { id: 'brackets', name: 'Скобки' },
    { id: 'operators', name: 'Операторы' },
  ]);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('all');

  // Добавляем список доступных шрифтов
  const availableFonts = [
    'Arial',
    'Verdana',
    'Helvetica',
    'Tahoma',
    'Trebuchet MS',
    'Times New Roman',
    'Georgia',
    'Garamond',
    'Courier New',
    'Brush Script MT',
    'Comic Sans MS',
    'Impact'
  ];

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

  const isPointInShape = (shape: Shape, point: { x: number, y: number }): boolean => {
    if (shape.type === 'path') {
      if (!shape.points || shape.points.length < 4) return false;
      
      // Проверка для path (линии): проверяем близость к любому сегменту линии
      for (let i = 0; i < shape.points.length - 2; i += 2) {
        const x1 = shape.points[i];
        const y1 = shape.points[i + 1];
        const x2 = shape.points[i + 2];
        const y2 = shape.points[i + 3];
        
        if (distanceToLineSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 }) < 10) {
          return true;
        }
      }
      return false;
    }
    
    if (shape.type === 'rectangle' || shape.type === 'text' || shape.type === 'latex') {
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
      const [x1, y1, x2, y2] = shape.points;
      const distance = distanceToLineSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 });
      return distance < 10;
    }
    
    return false;
  };

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

  const renderLatexToHtml = (latex: string, fontSize: number = 20): string => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        strict: false,
        fontSize: `${fontSize}px`
      });
    } catch (error) {
      console.error('LaTeX rendering error:', error);
      return `<span style="color: red;">LaTeX error: ${latex}</span>`;
    }
  };

  const measureLatexSize = (latex: string, fontSize: number): { width: number, height: number } => {
    // Создаем временный элемент для измерения размера формулы
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.visibility = 'hidden';
    container.style.display = 'inline-block';
    container.style.fontSize = `${fontSize}px`;
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.lineHeight = '1';
    document.body.appendChild(container);
    
    try {
      katex.render(latex, container, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        strict: false
      });
      
      // Добавляем отступы для лучшего отображения
      const width = container.offsetWidth + 20;
      const height = container.offsetHeight + 10;
      
      return { width, height };
    } catch (error) {
      console.error('LaTeX measurement error:', error);
      return { width: 200, height: 50 };
    } finally {
      document.body.removeChild(container);
    }
  };

  const startTextEditing = (shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (shape && (shape.type === 'text' || shape.type === 'latex')) {
      setShapes(shapes.map(s => ({
        ...s,
        isEditing: s.id === shapeId,
        isSelected: s.id === shapeId
      })));
      setSelectedId(shapeId);
      setTempText(shape.text || shape.latex || '');
      setEditingTextId(shapeId);
      setIsTextChanged(false);
      
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
          textAreaRef.current.select();
        }
      }, 10);
    }
  };

  const finishTextEditing = (saveToHistoryFlag: boolean = true) => {
    if (editingTextId) {
      const updatedShapes = shapes.map(s => {
        if (s.id === editingTextId) {
          const finalText = tempText || 'Text';
          
          if (s.type === 'latex') {
            const currentFontSize = s.fontSize || fontSize;
            const renderedLatex = renderLatexToHtml(finalText, currentFontSize);
            const size = measureLatexSize(finalText, currentFontSize);
            
            const updatedShape = {
              ...s,
              latex: finalText,
              latexRendered: renderedLatex,
              isEditing: false,
              text: '',
              width: size.width,
              height: size.height
            };
            return updatedShape;
          } else {
            const currentFontSize = s.fontSize || fontSize;
            const lineHeight = currentFontSize;
            const lines = finalText.split('\n').length || 1;
            const newHeight = Math.max(lines * lineHeight * 1.2, 50);
            
            const updatedShape = {
              ...s,
              text: finalText,
              isEditing: false,
              height: newHeight
            };
            return updatedShape;
          }
        }
        return { ...s, isEditing: false, isSelected: false };
      });
      
      setShapes(updatedShapes);
      
      if (isTextChanged && saveToHistoryFlag) {
        saveToHistory(updatedShapes);
      }
      
      setEditingTextId(null);
      setSelectedId(null);
      setTempText('');
      setIsTextChanged(false);
    }
  };

  const updateSelectedTextProperty = (property: keyof Shape, value: any) => {
    if (selectedId) {
      const updatedShapes = shapes.map(s => {
        if (s.id === selectedId && (s.type === 'text' || s.type === 'latex')) {
          const updatedShape = { ...s, [property]: value };
          
          if (property === 'fontWeight' || property === 'fontStyle') {
            const fontWeight = property === 'fontWeight' ? value : (s.fontWeight || 'normal');
            const fontStyle = property === 'fontStyle' ? value : (s.fontStyle || 'normal');
            updatedShape.fontWeight = fontWeight;
            updatedShape.fontStyle = fontStyle;
          }
          
          // Обработка изменения размера шрифта
          if (property === 'fontSize') {
            const newFontSize = parseInt(value) || 20;
            
            if (s.type === 'text') {
              // Для текста пересчитываем высоту
              const lineHeight = newFontSize;
              const lines = (s.text || '').split('\n').length || 1;
              const newHeight = Math.max(lines * lineHeight * 1.2, 50);
              updatedShape.height = newHeight;
            } else if (s.type === 'latex') {
              // Для формулы пересчитываем размер и перерендериваем
              const size = measureLatexSize(s.latex || '', newFontSize);
              updatedShape.width = size.width;
              updatedShape.height = size.height;
              const renderedLatex = renderLatexToHtml(s.latex || '', newFontSize);
              updatedShape.latexRendered = renderedLatex;
            }
          }
          
          // Обновление рендера LaTeX при изменении цвета
          if (s.type === 'latex' && property === 'stroke') {
            const renderedLatex = renderLatexToHtml(s.latex || '', s.fontSize || fontSize);
            updatedShape.latexRendered = renderedLatex;
          }
          
          return updatedShape;
        }
        return s;
      });
      setShapes(updatedShapes);
      saveToHistory(updatedShapes);
    }
  };

  const updateTextInRealTime = (newText: string) => {
    if (editingTextId) {
      setTempText(newText);
      setIsTextChanged(true);
      
      const updatedShapes = shapes.map(s => {
        if (s.id === editingTextId) {
          const updatedShape = { ...s, text: newText };
          
          if (s.type === 'latex') {
            updatedShape.latex = newText;
            const currentFontSize = s.fontSize || fontSize;
            const renderedLatex = renderLatexToHtml(newText, currentFontSize);
            updatedShape.latexRendered = renderedLatex;
            
            const size = measureLatexSize(newText, currentFontSize);
            updatedShape.width = size.width;
            updatedShape.height = size.height;
          } else {
            const currentFontSize = s.fontSize || fontSize;
            const lineHeight = currentFontSize;
            const lines = newText.split('\n').length || 1;
            const newHeight = Math.max(lines * lineHeight * 1.2, 50);
            
            return { 
              ...updatedShape, 
              height: newHeight 
            };
          }
        }
        return s;
      });
      setShapes(updatedShapes);
    }
  };

  const toggleBold = () => {
    if (selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && selectedShape.type === 'text') {
        const newFontWeight = selectedShape.fontWeight === 'bold' ? 'normal' : 'bold';
        updateSelectedTextProperty('fontWeight', newFontWeight);
      }
    }
  };

  const toggleItalic = () => {
    if (selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && selectedShape.type === 'text') {
        const newFontStyle = selectedShape.fontStyle === 'italic' ? 'normal' : 'italic';
        updateSelectedTextProperty('fontStyle', newFontStyle);
      }
    }
  };

  const toggleUnderline = () => {
    if (selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && selectedShape.type === 'text') {
        let newDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
        const currentDecoration = selectedShape.textDecoration || 'none';
        
        if (currentDecoration.includes('underline')) {
          if (currentDecoration === 'underline') {
            newDecoration = 'none';
          } else if (currentDecoration === 'underline line-through') {
            newDecoration = 'line-through';
          } else {
            newDecoration = currentDecoration.replace('underline', '').trim() as any;
            if (newDecoration === '') newDecoration = 'none';
          }
        } else {
          if (currentDecoration === 'none') {
            newDecoration = 'underline';
          } else if (currentDecoration === 'line-through') {
            newDecoration = 'underline line-through';
          } else {
            newDecoration = (currentDecoration + ' underline').trim() as any;
          }
        }
        
        updateSelectedTextProperty('textDecoration', newDecoration);
      }
    }
  };

  const toggleStrikethrough = () => {
    if (selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && selectedShape.type === 'text') {
        let newDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
        const currentDecoration = selectedShape.textDecoration || 'none';
        
        if (currentDecoration.includes('line-through')) {
          if (currentDecoration === 'line-through') {
            newDecoration = 'none';
          } else if (currentDecoration === 'underline line-through') {
            newDecoration = 'underline';
          } else {
            newDecoration = currentDecoration.replace('line-through', '').trim() as any;
            if (newDecoration === '') newDecoration = 'none';
          }
        } else {
          if (currentDecoration === 'none') {
            newDecoration = 'line-through';
          } else if (currentDecoration === 'underline') {
            newDecoration = 'underline line-through';
          } else {
            newDecoration = (currentDecoration + ' line-through').trim() as any;
          }
        }
        
        updateSelectedTextProperty('textDecoration', newDecoration);
      }
    }
  };

  const insertLatexSymbol = (latex: string) => {
    if (textAreaRef.current && editingTextId) {
      const textarea = textAreaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      let insertPosition = start;
      let newText = latex;
      
      if (latex.includes('\\left') && latex.includes('\\right')) {
        const leftIndex = latex.indexOf('\\right');
        if (leftIndex !== -1) {
          insertPosition = start + leftIndex - 1;
        }
      }
      else if (latex.includes('_{}^{}')) {
        const firstBrace = latex.indexOf('_{}');
        if (firstBrace !== -1) {
          insertPosition = start + firstBrace + 2;
        }
      }
      else if (latex.includes('^{}')) {
        const braceIndex = latex.indexOf('^{}');
        if (braceIndex !== -1) {
          insertPosition = start + braceIndex + 2;
        }
      }
      else if (latex.includes('_{}')) {
        const braceIndex = latex.indexOf('_{}');
        if (braceIndex !== -1) {
          insertPosition = start + braceIndex + 2;
        }
      }
      else if (latex.includes('\\frac{}{}')) {
        const firstBrace = latex.indexOf('\\frac{') + 6;
        if (firstBrace !== -1) {
          insertPosition = start + firstBrace;
        }
      }
      else if (latex.includes('\\sqrt[]{}')) {
        const braceIndex = latex.indexOf('\\sqrt[]{}') + 7;
        if (braceIndex !== -1) {
          insertPosition = start + braceIndex;
        }
      }
      else if (latex.includes('{}')) {
        const braceIndex = latex.indexOf('{}');
        if (braceIndex !== -1) {
          insertPosition = start + braceIndex + 1;
        }
      }
      
      const currentText = textarea.value;
      const textBefore = currentText.substring(0, start);
      const textAfter = currentText.substring(end);
      
      const updatedText = textBefore + newText + textAfter;
      updateTextInRealTime(updatedText);
      
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
          textAreaRef.current.setSelectionRange(
            start + insertPosition,
            start + insertPosition
          );
        }
      }, 0);
    }
    setShowLatexMenu(false);
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
      if ((e.ctrlKey || e.metaKey) && selectedId) {
        const selectedShape = shapes.find(s => s.id === selectedId);
        if (selectedShape && selectedShape.type === 'text') {
          switch (e.key) {
            case 'b':
              e.preventDefault();
              toggleBold();
              break;
            case 'i':
              e.preventDefault();
              toggleItalic();
              break;
            case 'u':
              e.preventDefault();
              toggleUnderline();
              break;
          }
        }
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
  }, [selectedId, editingTextId, tempText, shapes]);

  useEffect(() => {
    if (tool !== 'select' || !selectedId) {
    }
  }, [tool, selectedId]);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (editingTextId && e.target === stage) {
      finishTextEditing();
      return;
    }
    
    if (e.target.attrs.name && e.target.attrs.name === 'delete-button') {
      const shapeId = e.target.attrs.shapeId;
      if (shapeId) {
        handleDeleteShape(shapeId);
      }
      return;
    }
    
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
          originalBbox,
          startFontSize: shape.fontSize || fontSize
        });
      }
      return;
    }
    
    if (e.target === stage) {
      if (tool === 'select' && editingTextId) {
        finishTextEditing();
      }
      
      if (tool === 'select') {
        setSelectedId(null);
        setShapes(shapes.map(shape => ({ ...shape, isSelected: false, isEditing: false })));
      }
      
      if (tool === 'text' || tool === 'latex') {
        if (editingTextId) {
          finishTextEditing();
        }
        
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
        // Для ластика создаем временную фигуру для стирания
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
            stroke: '#000000', // Цвет не важен для ластика
            strokeWidth: strokeWidth,
            opacity: 1,
            points: [pos.x, pos.y]
          }
        });
        
        // Собираем ID фигур, которые будут стерты
        const newErasedShapes = new Set<string>();
        shapes.forEach(shape => {
          if (isPointInShape(shape, pos)) {
            newErasedShapes.add(shape.id);
          }
        });
        setErasedShapes(newErasedShapes);
      }
      else if (!['select', 'text', 'latex'].includes(tool)) {
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: tool === 'pencil' ? 'path' : tool as ShapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: isHighlighter ? 0.5 : 1,
            points: tool === 'pencil' ? [pos.x, pos.y] : undefined
          }
        });
      }
      return;
    }
    
    if (tool === 'select' && e.target.attrs.id) {
      const targetId = e.target.attrs.id;
      const shape = shapes.find(s => s.id === targetId);
      
      if (shape) {
        if (editingTextId && editingTextId !== targetId) {
          finishTextEditing();
        }
        
        setSelectedId(targetId);
        
        if ((shape.type === 'text' || shape.type === 'latex') && e.evt.detail === 2) {
          startTextEditing(targetId);
          return;
        }
        
        setIsDragging(true);
        setDragStart({ x: pos.x, y: pos.y });
        setSelectedShapeStart({ x: shape.x, y: shape.y });
        
        if ((shape.type === 'path' || shape.type === 'line') && shape.points) {
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
        
        const newErasedShapes = new Set<string>();
        shapes.forEach(shape => {
          if (isPointInShape(shape, pos)) {
            newErasedShapes.add(shape.id);
          }
        });
        setErasedShapes(newErasedShapes);
      } else {
        setDrawingState({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentShape: {
            id: `${tool}_${Date.now()}`,
            type: tool === 'pencil' ? 'path' : tool as ShapeType,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: isHighlighter ? 0.5 : 1,
            points: tool === 'pencil' ? [pos.x, pos.y] : undefined
          }
        });
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (drawingState.isDrawing && drawingState.currentShape) {
      const { startX, startY, currentShape } = drawingState;
      
      if (tool === 'pencil' || tool === 'eraser') {
        const updatedShape = {
          ...currentShape,
          points: [...(currentShape.points || []), pos.x, pos.y]
        };
        setDrawingState(prev => ({ ...prev, currentShape: updatedShape }));
        
        if (tool === 'eraser') {
          const newErasedShapes = new Set(erasedShapes);
          shapes.forEach(shape => {
            if (isPointInShape(shape, pos)) {
              newErasedShapes.add(shape.id);
            }
          });
          setErasedShapes(newErasedShapes);
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
    else if (transformState.isTransforming && transformState.shapeId) {
      const { startWidth, startHeight, startX, startY, startMouseX, startMouseY, anchor, originalPoints, originalBbox, startFontSize } = transformState;
      
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
          } else if (s.type === 'latex') {
            // Для формулы при трансформации через якоря НЕ меняем fontSize, только размеры контейнера
            return { ...s, width: newWidth, height: newHeight, x: newX, y: newY };
          } else {
            return { ...s, width: newWidth, height: newHeight, x: newX, y: newY };
          }
        }
        return s;
      });
      
      setShapes(updatedShapes);
    }
    else if (isDragging && selectedId) {
      const shape = shapes.find(s => s.id === selectedId);
      
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
    if (drawingState.isDrawing && drawingState.currentShape) {
      let newShape = { ...drawingState.currentShape } as Shape;
      
      if (tool === 'eraser') {
        // Удаляем фигуры, которые были затронуты ластиком
        if (erasedShapes.size > 0) {
          const newShapes = shapes.filter(shape => !erasedShapes.has(shape.id));
          setShapes(newShapes);
          saveToHistory(newShapes);
          setErasedShapes(new Set());
        }
        
        setDrawingState({
          isDrawing: false,
          startX: 0,
          startY: 0,
          currentShape: null
        });
        return;
      }
      
      if (tool === 'pencil' && newShape.points && newShape.points.length >= 4) {
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
      } else if (shape.type === 'path' && shape.points && shape.points.length > 0) {
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
    return shapes
      .filter(shape => shape.type === 'latex' && !shape.isEditing)
      .map((shape) => {
        const stage = stageRef.current;
        if (!stage) return null;
        
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
            style={{
              position: 'fixed',
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
              pointerEvents: 'none',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              dangerouslySetInnerHTML={{ 
                __html: shape.latexRendered || renderLatexToHtml(shape.latex || '', shape.fontSize || fontSize)
              }}
              style={{
                fontSize: `${shape.fontSize || fontSize}px`,
                color: shape.stroke,
                transform: 'scale(1)',
                pointerEvents: 'none',
                cursor: 'default',
                textAlign: 'center',
                lineHeight: 'normal',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
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
    
    // Для path показываем выделение только если есть точки
    if (shape.type === 'path' && (!shape.points || shape.points.length === 0)) return null;
    
    let displayShape = { ...shape };
    
    // Для path вычисляем bounding box на основе точек
    if ((shape.type === 'path' || shape.type === 'line') && shape.points && shape.points.length > 0) {
      const bbox = calculateBoundingBox(shape.points);
      displayShape = { ...shape, x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
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
      color: shape.stroke,
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
        <div style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y - 100}px`,
          width: `${width}px`,
          zIndex: 1001,
        }}>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            marginBottom: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
              Ввод LaTeX формулы (поддерживается большинство команд LaTeX)
            </div>
            <div 
              dangerouslySetInnerHTML={{ __html: renderLatexToHtml(tempText || '', shape.fontSize || fontSize) }}
              style={{
                fontSize: `${shape.fontSize || fontSize}px`,
                color: shape.stroke,
                textAlign: 'center',
                padding: '5px',
                backgroundColor: '#f5f5f5',
                borderRadius: '3px',
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </div>
          <textarea
            ref={textAreaRef}
            value={tempText}
            onChange={(e) => updateTextInRealTime(e.target.value)}
            onBlur={() => finishTextEditing()}
            style={textareaStyle}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                finishTextEditing();
              }
              if (e.key === 'Enter' && e.ctrlKey) {
                finishTextEditing();
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.target as HTMLTextAreaElement;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                
                const pairs: { [key: string]: string } = {
                  '(': ')',
                  '[': ']',
                  '{': '}',
                  '|': '|',
                  '\\': '\\',
                };
                
                const charBefore = text.substring(start - 1, start);
                if (pairs[charBefore]) {
                  const newText = text.substring(0, start) + pairs[charBefore] + text.substring(end);
                  updateTextInRealTime(newText);
                  setTimeout(() => {
                    textarea.setSelectionRange(start, start);
                  }, 0);
                }
              }
            }}
            autoFocus
            placeholder="Введите LaTeX формулу (например: \frac{a}{b} или \sqrt{x^2 + y^2})"
          />
        </div>
      );
    }
    
    return (
      <textarea
        ref={textAreaRef}
        value={tempText}
        onChange={(e) => updateTextInRealTime(e.target.value)}
        onBlur={() => finishTextEditing()}
        style={textareaStyle}
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
    
    const x = textX * scaleX + containerRect.left;
    const y = realY * scaleY + containerRect.top;
    
    const panelHeight = 40;
    const panelWidth = 1000;
    
    const offset = 20;
    
    let top = y - panelHeight - offset;
    if (top < containerRect.top) {
      top = y + realHeight * scaleY + offset;
    }
    
    let left = x;
    if (left + panelWidth > containerRect.right) {
      left = containerRect.right - panelWidth;
    }
    if (left < containerRect.left) {
      left = containerRect.left;
    }
    
    const isBold = selectedShape.fontWeight === 'bold';
    const isItalic = selectedShape.fontStyle === 'italic';
    const isUnderline = selectedShape.textDecoration?.includes('underline') || false;
    const isStrikethrough = selectedShape.textDecoration?.includes('line-through') || false;
    
    const filteredSymbols = selectedLatexCategory === 'all' 
      ? latexSymbols 
      : latexSymbols.filter(sym => sym.category === selectedLatexCategory);
    
    return (
      <div 
        style={{
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${panelWidth}px`,
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '5px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1001,
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Для обычного текста: выбор шрифта */}
          {selectedShape.type === 'text' && (
            <>
              <label style={{
                fontSize: '14px',
                fontWeight: 'bold',
                marginRight: '3px',
                whiteSpace: 'nowrap'
              }}>
                Font:
              </label>
              <select
                className="form-select form-select-sm"
                value={selectedShape.fontFamily || fontFamily}
                onChange={(e) => updateSelectedTextProperty('fontFamily', e.target.value)}
                style={{ width: '150px', height: '30px' }}
              >
                {availableFonts.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </>
          )}

          {/* Кнопки форматирования текста (только для обычного текста) */}
          {selectedShape.type === 'text' && (
            <>
              <button
                type="button"
                className={`btn btn-sm ${isBold ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={toggleBold}
                style={{ 
                  height: '30px',
                  width: '30px',
                  padding: '0',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  backgroundColor: isBold ? '#007bff' : 'transparent',
                  color: isBold ? 'white' : '#6c757d',
                  border: `1px solid ${isBold ? '#007bff' : '#6c757d'}`
                }}
                title="Жирный (Ctrl+B)"
              >
                B
              </button>
              
              <button
                type="button"
                className={`btn btn-sm ${isItalic ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={toggleItalic}
                style={{ 
                  height: '30px',
                  width: '30px',
                  padding: '0',
                  fontStyle: 'italic',
                  fontSize: '14px',
                  backgroundColor: isItalic ? '#007bff' : 'transparent',
                  color: isItalic ? 'white' : '#6c757d',
                  border: `1px solid ${isItalic ? '#007bff' : '#6c757d'}`
                }}
                title="Курсив (Ctrl+I)"
              >
                I
              </button>
              
              <button
                type="button"
                className={`btn btn-sm ${isUnderline ? 'btn-primary' : 'btn-outside-secondary'}`}
                onClick={toggleUnderline}
                style={{ 
                  height: '30px',
                  width: '30px',
                  padding: '0',
                  textDecoration: 'underline',
                  fontSize: '14px',
                  backgroundColor: isUnderline ? '#007bff' : 'transparent',
                  color: isUnderline ? 'white' : '#6c757d',
                  border: `1px solid ${isUnderline ? '#007bff' : '#6c757d'}`
                }}
                title="Подчеркнутый (Ctrl+U)"
              >
                U
              </button>
              
              <button
                type="button"
                className={`btn btn-sm ${isStrikethrough ? 'btn-primary' : 'btn-outside-secondary'}`}
                onClick={toggleStrikethrough}
                style={{ 
                  height: '30px',
                  width: '30px',
                  padding: '0',
                  textDecoration: 'line-through',
                  fontSize: '14px',
                  backgroundColor: isStrikethrough ? '#007bff' : 'transparent',
                  color: isStrikethrough ? 'white' : '#6c757d',
                  border: `1px solid ${isStrikethrough ? '#007bff' : '#6c757d'}`
                }}
                title="Зачеркнутый"
              >
                S
              </button>
            </>
          )}
          
          {/* Размер шрифта (для текста и формул) */}
          <label style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            marginLeft: selectedShape.type === 'text' ? '5px' : '0',
            whiteSpace: 'nowrap' 
          }}>
            Size:
          </label>
          <input
            type="number"
            className="form-control form-control-sm"
            value={selectedShape.fontSize || fontSize}
            onChange={(e) => updateSelectedTextProperty('fontSize', parseInt(e.target.value) || 1)}
            min="1"
            max="200"
            style={{ width: '70px', height: '30px', marginRight: '3px' }}
          />
          <span style={{ fontSize: '12px', color: '#666', marginRight: '5px' }}>px</span>
          
          {/* Выбор цвета (для текста и формул) */}
          <label style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            marginLeft: '5px',
            whiteSpace: 'nowrap' 
          }}>
            Color:
          </label>
          <input
            type="color"
            value={selectedShape.stroke || strokeColor}
            onChange={(e) => updateSelectedTextProperty('stroke', e.target.value)}
            style={{ 
              width: '30px', 
              height: '30px', 
              cursor: 'pointer',
              marginRight: '3px'
            }}
          />
          
          {/* Выравнивание текста (только для обычного текста) */}
          {selectedShape.type === 'text' && (
            <>
              <label style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                marginLeft: '5px',
                whiteSpace: 'nowrap' 
              }}>
                Align:
              </label>
              <select
                className="form-select form-select-sm"
                value={selectedShape.textAlign || textAlign}
                onChange={(e) => updateSelectedTextProperty('textAlign', e.target.value)}
                style={{ width: '80px', height: '30px', marginRight: '5px' }}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </>
          )}
          
          {/* Кнопка редактирования */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => startTextEditing(selectedId)}
            style={{ 
              height: '30px',
              whiteSpace: 'nowrap',
              padding: '0 12px',
              fontSize: '14px',
              marginLeft: '5px'
            }}
          >
            {selectedShape.type === 'latex' ? 'Edit Formula' : 'Edit Text'}
          </button>
          
          {/* LaTeX символы (только для формул) */}
          {selectedShape.type === 'latex' && !editingTextId && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => setShowLatexMenu(!showLatexMenu)}
                style={{ 
                  height: '30px',
                  whiteSpace: 'nowrap',
                  padding: '0 12px',
                  fontSize: '14px',
                  marginLeft: '5px'
                }}
              >
                LaTeX Symbols
              </button>
              
              {showLatexMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  padding: '10px',
                  zIndex: 1002,
                  width: '400px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '5px', 
                    marginBottom: '10px',
                    flexWrap: 'wrap' 
                  }}>
                    {latexCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`btn btn-sm ${selectedLatexCategory === cat.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setSelectedLatexCategory(cat.id)}
                        style={{ 
                          padding: '2px 8px',
                          fontSize: '12px',
                        }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  
                  <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '8px',
                  }}>
                    {filteredSymbols.map(symbol => (
                      <button
                        key={symbol.name}
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        onClick={() => insertLatexSymbol(symbol.latex)}
                        style={{ 
                          padding: '6px 8px',
                          fontSize: '12px',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          height: 'auto',
                          minHeight: '60px',
                        }}
                        title={symbol.description}
                      >
                        <div style={{ 
                          fontWeight: 'bold',
                          marginBottom: '2px',
                          fontSize: '11px',
                        }}>
                          {symbol.name}
                        </div>
                        <div style={{ 
                          fontSize: '10px',
                          color: '#666',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}>
                          {symbol.latex}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <div style={{ 
                    marginTop: '10px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#666',
                    borderTop: '1px solid #eee',
                  }}>
                    <strong>Совет:</strong> Нажмите на символ, чтобы вставить его в формулу. Курсор автоматически поместится в нужное место.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
        
        <button
          type="button"
          className={`btn btn-sm ${tool === 'latex' ? 'btn-primary' : 'btn-outline-success'}`}
          onClick={() => {
            if (editingTextId) {
              finishTextEditing();
            }
            setTool('latex');
          }}
        >
          Formula
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
          disabled={tool === 'text' || tool === 'latex'}
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
        {renderLatexShapes()}
      </div>
      {renderTextToolbar()}
    </div>
  );
};

export default App;