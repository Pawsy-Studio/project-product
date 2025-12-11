import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text } from 'react-konva';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './App.css';
import BrushToolbar from './brushToolbar.tsx';
import RangeToolbar from './RangeToolbar.tsx';

type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path' | 'text' | 'latex' | 'highlighter';
type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex' | 'highlighter';
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
  category: 'fraction' | 'root' | 'superscript' | 'subscript' | 'brackets' | 'operators' | 'symbols';
  placeholder?: string;
}

const DrawingApp: React.FC = () => {
  const [tool, setTool] = useState<ToolMode>('select');
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(5);
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
  const [eraserHistoryStart, setEraserHistoryStart] = useState<Shape[] | null>(null);

  const [history, setHistory] = useState<Shape[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');
  const [isTextChanged, setIsTextChanged] = useState(false);

  const [latexSymbols, setLatexSymbols] = useState<LatexSymbol[]>([
    { name: 'Простая дробь', latex: '\\frac{}{}', description: 'Дробь с числителем и знаменателем', category: 'fraction', placeholder: '\\frac{a}{b}' },
    { name: 'Квадратный корень', latex: '\\sqrt{}', description: 'Квадратный корень', category: 'root', placeholder: '\\sqrt{x}' },
    { name: 'Корень n-ой степени', latex: '\\sqrt[]{}', description: 'Корень с показателем степени', category: 'root', placeholder: '\\sqrt[n]{x}' },
    { name: 'Верхний индекс', latex: '^{}', description: 'Надстрочный индекс', category: 'superscript', placeholder: 'x^{2}' },
    { name: 'Нижний индекс', latex: '_{}', description: 'Подстрочный индекс', category: 'subscript', placeholder: 'x_{i}' },
    { name: 'Сумма', latex: '\\sum_{}^{}', description: 'Сумма', category: 'operators', placeholder: '\\sum_{i=1}^{n}' },
    { name: 'Интеграл', latex: '\\int_{}^{}', description: 'Интеграл', category: 'operators', placeholder: '\\int_{a}^{b}' },
    { name: 'Предел', latex: '\\lim_{}', description: 'Предел', category: 'operators', placeholder: '\\lim_{x \\to 0}' },
    { name: 'Производная', latex: '\\frac{d}{dx}', description: 'Производная', category: 'operators', placeholder: '\\frac{dy}{dx}' },
    { name: 'Бесконечность', latex: '\\infty', description: 'Символ бесконечности', category: 'symbols' },
    { name: 'Приблизительно', latex: '\\approx', description: 'Приблизительное равенство', category: 'symbols' },
    { name: 'Не равно', latex: '\\neq', description: 'Не равно', category: 'symbols' },
    { name: 'Меньше или равно', latex: '\\leq', description: 'Меньше или равно', category: 'symbols' },
    { name: 'Больше или равно', latex: '\\geq', description: 'Больше или равно', category: 'symbols' },
    { name: 'Принадлежит', latex: '\\in', description: 'Принадлежность множеству', category: 'symbols' },
    { name: 'Для всех', latex: '\\forall', description: 'Для всех', category: 'symbols' },
    { name: 'Существует', latex: '\\exists', description: 'Существует', category: 'symbols' },
    { name: 'Следовательно', latex: '\\therefore', description: 'Следовательно', category: 'symbols' },
    { name: 'Плюс', latex: '+', description: 'Плюс', category: 'symbols' },
    { name: 'Минус', latex: '-', description: 'Минус', category: 'symbols' },
    { name: 'Умножить', latex: '\\times', description: 'Умножение', category: 'symbols' },
    { name: 'Делить', latex: '\\div', description: 'Деление', category: 'symbols' },
    { name: 'Равно', latex: '=', description: 'Равно', category: 'symbols' },
    { name: 'Круглые скобки', latex: '\\left( \\right)', description: 'Круглые скобки', category: 'brackets', placeholder: '\\left( x + y \\right)' },
    { name: 'Квадратные скобки', latex: '\\left[ \\right]', description: 'Квадратные скобки', category: 'brackets', placeholder: '\\left[ a, b \\right]' },
    { name: 'Фигурные скобки', latex: '\\left\\{ \\right\\}', description: 'Фигурные скобки', category: 'brackets', placeholder: '\\left\\{ x, y \\right\\}' },
    { name: 'Модуль', latex: '\\left| \\right|', description: 'Модуль', category: 'brackets', placeholder: '\\left| x \\right|' },
    { name: 'Альфа', latex: '\\alpha', description: 'Греческая буква альфа', category: 'symbols' },
    { name: 'Бета', latex: '\\beta', description: 'Греческая буква бета', category: 'symbols' },
    { name: 'Гамма', latex: '\\gamma', description: 'Греческая буква гамма', category: 'symbols' },
    { name: 'Дельта', latex: '\\delta', description: 'Греческая буква дельта', category: 'symbols' },
    { name: 'Пи', latex: '\\pi', description: 'Число Пи', category: 'symbols' },
    { name: 'Сигма', latex: '\\sigma', description: 'Греческая буква сигма', category: 'symbols' },
    { name: 'Тета', latex: '\\theta', description: 'Греческая буква тета', category: 'symbols' },
  ]);
  
  const [showLatexMenu, setShowLatexMenu] = useState(false);
  const [latexCategories, setLatexCategories] = useState<Array<{id: string, name: string, icon: string}>>([
    { id: 'all', name: 'Все символы', icon: '📚' },
    { id: 'fraction', name: 'Дроби', icon: '½' },
    { id: 'root', name: 'Корни', icon: '√' },
    { id: 'superscript', name: 'Степени', icon: 'x²' },
    { id: 'subscript', name: 'Индексы', icon: 'x₁' },
    { id: 'brackets', name: 'Скобки', icon: '[]' },
    { id: 'operators', name: 'Операторы', icon: '∑' },
    { id: 'symbols', name: 'Символы', icon: 'α' },
  ]);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('all');
  
  const [showTextFormatDropdown, setShowTextFormatDropdown] = useState(false);
  const [showTextAlignDropdown, setShowTextAlignDropdown] = useState(false);
  const [latexPreview, setLatexPreview] = useState<string>('E = mc^2');
  const [showLatexPreview, setShowLatexPreview] = useState(true);

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
    if (shape.type === 'path' || shape.type === 'highlighter') {
      if (!shape.points || shape.points.length < 4) return false;
      
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
      setLatexPreview(shape.latex || 'E = mc^2');
      
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
          const finalText = tempText || 'E = mc^2';
          
          if (s.type === 'latex') {
            const currentFontSize = s.fontSize || fontSize;
            const renderedLatex = renderLatexToHtml(finalText, currentFontSize);
            const size = measureLatexSize(finalText, currentFontSize);
            
            const updatedShape = {
              ...s,
              latex: finalText,
              latexRendered: renderedLatex,
              isEditing: false,
              text: ''
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
      setShowLatexMenu(false);
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
          
          if (property === 'fontSize') {
            const newFontSize = parseInt(value) || 20;
            
            if (s.type === 'text') {
              const lineHeight = newFontSize;
              const lines = (s.text || '').split('\n').length || 1;
              const newHeight = Math.max(lines * lineHeight * 1.2, 50);
              updatedShape.height = newHeight;
            } else if (s.type === 'latex') {
              const size = measureLatexSize(s.latex || '', newFontSize);
              updatedShape.width = size.width;
              updatedShape.height = size.height;
              const renderedLatex = renderLatexToHtml(s.latex || '', newFontSize);
              updatedShape.latexRendered = renderedLatex;
            }
          }
          
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
      setLatexPreview(newText);
      
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
      
      if (latex.includes('\\frac{}{}')) {
        const firstBrace = latex.indexOf('{') + 1;
        insertPosition = start + firstBrace;
      } else if (latex.includes('\\sqrt[]{}')) {
        const braceIndex = latex.indexOf('{', latex.indexOf('[]') + 2) + 1;
        insertPosition = start + braceIndex;
      } else if (latex.includes('\\sqrt{}')) {
        const braceIndex = latex.indexOf('{') + 1;
        insertPosition = start + braceIndex;
      } else if (latex.includes('^{}')) {
        const braceIndex = latex.indexOf('^{}') + 2;
        insertPosition = start + braceIndex;
      } else if (latex.includes('_{}')) {
        const braceIndex = latex.indexOf('_{}') + 2;
        insertPosition = start + braceIndex;
      } else if (latex.includes('\\sum_{}^{}')) {
        const firstBrace = latex.indexOf('_{}') + 2;
        insertPosition = start + firstBrace;
      } else if (latex.includes('\\int_{}^{}')) {
        const firstBrace = latex.indexOf('_{}') + 2;
        insertPosition = start + firstBrace;
      } else if (latex.includes('\\lim_{}')) {
        const braceIndex = latex.indexOf('{') + 1;
        insertPosition = start + braceIndex;
      } else if (latex.includes('\\left( \\right)')) {
        const innerPos = latex.indexOf('\\left(') + 6;
        insertPosition = start + innerPos;
        newText = '\\left( \\right)';
      } else if (latex.includes('\\left[ \\right]')) {
        const innerPos = latex.indexOf('\\left[') + 6;
        insertPosition = start + innerPos;
        newText = '\\left[ \\right]';
      } else if (latex.includes('\\left\\{ \\right\\}')) {
        const innerPos = latex.indexOf('\\left\\{') + 7;
        insertPosition = start + innerPos;
        newText = '\\left\\{ \\right\\}';
      } else if (latex.includes('\\left| \\right|')) {
        const innerPos = latex.indexOf('\\left|') + 6;
        insertPosition = start + innerPos;
        newText = '\\left| \\right|';
      }
      
      const currentText = textarea.value;
      const textBefore = currentText.substring(0, start);
      const textAfter = currentText.substring(end);
      
      const updatedText = textBefore + newText + textAfter;
      updateTextInRealTime(updatedText);
      
      setTimeout(() => {
        if (textAreaRef.current) {
          const newCursorPos = start + insertPosition;
          textAreaRef.current.focus();
          textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const handleLatexSymbolClick = (symbol: LatexSymbol) => {
    insertLatexSymbol(symbol.latex);
    setShowLatexMenu(false);
  };

  const changeFontSizeWithStep = (direction: 'up' | 'down', shiftPressed: boolean) => {
    if (selectedId) {
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && (selectedShape.type === 'text' || selectedShape.type === 'latex')) {
        const currentSize = selectedShape.fontSize || fontSize;
        const step = shiftPressed ? 2 : 1;
        const newSize = direction === 'up' 
          ? currentSize + step 
          : Math.max(1, currentSize - step);
        
        updateSelectedTextProperty('fontSize', newSize);
      }
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
      
      if (!editingTextId && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && selectedId) {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? 'up' : 'down';
        changeFontSizeWithStep(direction, e.shiftKey);
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
  }, [selectedId, editingTextId, tempText, shapes, fontSize]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (editingTextId) {
        const isInsideTextarea = target === textAreaRef.current || textAreaRef.current?.contains(target);
        const isInsideLatexMenu = target.closest('.latex-symbols-menu') || target.closest('.latex-symbols-dropdown');
        const isInsideLatexEditor = target.closest('.latex-editor-container');
        
        if (!isInsideTextarea && !isInsideLatexMenu && !isInsideLatexEditor) {
          finishTextEditing();
        }
      }
      
      if (!target.closest('.text-format-dropdown')) {
        setShowTextFormatDropdown(false);
      }
      
      if (!target.closest('.text-align-dropdown')) {
        setShowTextAlignDropdown(false);
      }
      
      if (!target.closest('.latex-symbols-menu') && !target.closest('.latex-symbols-dropdown')) {
        setShowLatexMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingTextId]);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (pos.x < 0 || pos.x > 1000 || pos.y < 0 || pos.y > 387) {
      return;
    }
    
    if (editingTextId && e.target === stage) {
      finishTextEditing();
      return;
    }
    
    if (e.target.attrs.name && e.target.attrs.name.startsWith('anchor-')) {
      const shapeId = e.target.attrs.shapeId;
      const shape = shapes.find(s => s.id === shapeId);
      if (shape && tool === 'select') {
        const anchor = e.target.attrs.name.replace('anchor-', '') as AnchorType;
        
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
        
        if ((shape.type === 'path' || shape.type === 'highlighter') && shape.points) {
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
  };

  const handleMouseMove = (e: any) => {
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
          if ((s.type === 'path' || s.type === 'line' || s.type === 'highlighter') && originalPoints && originalBbox) {
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
  };

  const handleMouseUp = () => {
    if (drawingState.isDrawing && drawingState.currentShape) {
      let newShape = { ...drawingState.currentShape } as Shape;
      
      if (tool === 'eraser') {
        if (erasedShapes.size > 0 && eraserHistoryStart) {
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push([...eraserHistoryStart]);
          newHistory.push([...shapes]);
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
        }
        
        setErasedShapes(new Set());
        setEraserHistoryStart(null);
        
        setDrawingState({
          isDrawing: false,
          startX: 0,
          startY: 0,
          currentShape: null
        });
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
            className="latex-shape-overlay"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              width: `${width}px`,
              height: `${height}px`,
            }}
          >
            <div
              dangerouslySetInnerHTML={{ 
                __html: shape.latexRendered || renderLatexToHtml(shape.latex || '', shape.fontSize || fontSize)
              }}
              className="latex-rendered-content"
              style={{
                fontSize: `${shape.fontSize || fontSize}px`,
                color: shape.stroke,
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
    
    const selectionPadding = 5;
    const anchorSize = 10;
    const halfAnchor = anchorSize / 2;
    
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
      const filteredSymbols = selectedLatexCategory === 'all' 
        ? latexSymbols 
        : latexSymbols.filter(sym => sym.category === selectedLatexCategory);
      
      return (
        <div className="latex-editor-container" style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y - 120}px`,
          width: `${width + 200}px`,
          zIndex: 1001,
        }}>
          <div className="latex-editor-toolbar">
            {showLatexPreview && (
              <div 
                className="latex-preview"
                dangerouslySetInnerHTML={{ __html: renderLatexToHtml(latexPreview || tempText || 'E = mc^2', shape.fontSize || fontSize) }}
                style={{
                  fontSize: `${shape.fontSize || fontSize}px`,
                  color: shape.stroke,
                }}
              />
            )}
            
            <div className="latex-symbols-dropdown">
              <button
                type="button"
                className="drawing-tool-btn drawing-tool-btn-outline-success drawing-tool-btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLatexMenu(!showLatexMenu);
                }}
              >
                Символы
              </button>
              
              <button
                type="button"
                className="drawing-tool-btn drawing-tool-btn-outline-secondary drawing-tool-btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLatexPreview(!showLatexPreview);
                }}
              >
                {showLatexPreview ? 'Скрыть' : 'Показать'} предпросмотр
              </button>
              
              {showLatexMenu && (
                <div className="latex-symbols-menu">
                  <div className="latex-categories-container">
                    {latexCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`drawing-tool-btn drawing-tool-btn-small ${selectedLatexCategory === cat.id ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-secondary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLatexCategory(cat.id);
                        }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="latex-symbols-grid">
                    {filteredSymbols.map(symbol => (
                      <button
                        key={symbol.name}
                        type="button"
                        className="drawing-tool-btn drawing-tool-btn-outline-info drawing-tool-btn-small latex-symbol-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLatexSymbolClick(symbol);
                        }}
                        title={symbol.description}
                      >
                        <div className="latex-symbol-name">
                          <span>{symbol.name}</span>
                        </div>
                        <div className="latex-symbol-code">
                          {symbol.placeholder || symbol.latex}
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="latex-symbols-tip">
                    <strong>Совет:</strong> Нажмите на символ, чтобы вставить его в формулу. Курсор автоматически поместится в нужное место.
                  </div>
                </div>
              )}
            </div>
          </div>
          <textarea
            ref={textAreaRef}
            value={tempText}
            onChange={(e) => updateTextInRealTime(e.target.value)}
            onBlur={() => {
              setTimeout(() => {
                const activeElement = document.activeElement;
                if (!activeElement || (!activeElement.closest('.latex-editor-container') && !activeElement.closest('.latex-symbols-menu'))) {
                  finishTextEditing();
                }
              }, 100);
            }}
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
    
    const isBold = selectedShape.fontWeight === 'bold';
    const isItalic = selectedShape.fontStyle === 'italic';
    const isUnderline = selectedShape.textDecoration?.includes('underline') || false;
    const isStrikethrough = selectedShape.textDecoration?.includes('line-through') || false;
    const currentAlign = selectedShape.textAlign || textAlign;
    
    return (
      <div 
        className="text-toolbar"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${panelWidth}px`,
        }}
      >
        <div className="text-toolbar-content">
          {selectedShape.type === 'text' && (
            <>
              <select
                className="drawing-tool-select drawing-tool-select-small"
                value={selectedShape.fontFamily || fontFamily}
                onChange={(e) => updateSelectedTextProperty('fontFamily', e.target.value)}
                style={{ width: '160px' }}
              >
                {availableFonts.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </>
          )}

          <input
            type="number"
            className="drawing-tool-input drawing-tool-input-small"
            value={selectedShape.fontSize || fontSize}
            onChange={(e) => updateSelectedTextProperty('fontSize', parseInt(e.target.value) || 1)}
            min="1"
            max="200"
            step="1"
            style={{ width: '40px'}}
          />

          {selectedShape.type === 'text' && (
            <div className="text-format-dropdown">
              <button
                type="button"
                className={`drawing-tool-btn tool-icon tool-text-format drawing-tool-btn-small ${showTextFormatDropdown ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-secondary'} ${showTextFormatDropdown ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextFormatDropdown(!showTextFormatDropdown);
                }}
                title="Формат текста"
              >
              </button>
              {showTextFormatDropdown && (
                <div className="text-format-dropdown-menu" style={{ display: 'flex', flexDirection: 'row', gap: '5px' }}>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-bold drawing-tool-btn-small ${isBold ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBold();
                      setShowTextFormatDropdown(false);
                    }}
                    title="Жирный"
                  >
                  </button>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-italic drawing-tool-btn-small ${isItalic ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleItalic();
                      setShowTextFormatDropdown(false);
                    }}
                    title="Курсив"
                  >
                  </button>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-underline drawing-tool-btn-small ${isUnderline ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUnderline();
                      setShowTextFormatDropdown(false);
                    }}
                    title="Подчеркнутый"
                  >
                  </button>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-strikethrough drawing-tool-btn-small ${isStrikethrough ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStrikethrough();
                      setShowTextFormatDropdown(false);
                    }}
                    title="Зачеркнутый"
                  >
                  </button>
                </div>
              )}
            </div>
          )}
          
          {selectedShape.type === 'text' && (
            <div className="text-align-dropdown">
              <button
                type="button"
                className={`drawing-tool-btn tool-icon tool-text-align drawing-tool-btn-small ${showTextAlignDropdown ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-secondary'} ${showTextAlignDropdown ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextAlignDropdown(!showTextAlignDropdown);
                }}
                title="Выравнивание текста"
              >
              </button>
              {showTextAlignDropdown && (
                <div className="text-align-dropdown-menu" style={{ display: 'flex', flexDirection: 'row', gap: '5px' }}>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-align-left drawing-tool-btn-small ${currentAlign === 'left' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSelectedTextProperty('textAlign', 'left');
                      setShowTextAlignDropdown(false);
                    }}
                    title="По левому краю"
                  >
                  </button>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-align-center drawing-tool-btn-small ${currentAlign === 'center' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSelectedTextProperty('textAlign', 'center');
                      setShowTextAlignDropdown(false);
                    }}
                    title="По центру"
                  >
                  </button>
                  <button
                    type="button"
                    className={`drawing-tool-btn tool-icon tool-align-right drawing-tool-btn-small ${currentAlign === 'right' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSelectedTextProperty('textAlign', 'right');
                      setShowTextAlignDropdown(false);
                    }}
                    title="По правому краю"
                  >
                  </button>
                </div>
              )}
            </div>
          )}
          
          <input
            type="color"
            value={selectedShape.stroke || strokeColor}
            onChange={(e) => updateSelectedTextProperty('stroke', e.target.value)}
            className="text-color-picker"
          />

          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-edit-text drawing-tool-btn-outline-secondary drawing-tool-btn-small"
            onClick={() => startTextEditing(selectedId)}
            title={selectedShape.type === 'latex' ? 'Edit Formula' : 'Edit Text'}
          >
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="drawing-app-container">
    
      <h1 className="top-header">Paint</h1>
      <div className = "drawing-toolbar-container">
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
          tool = {tool}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
        /> 
        <div className="tools-container">
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-undo drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleUndo}
            title="Отменить"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-redo drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleRedo}
            title="Повторить"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-clear drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleClearCanvas}
            title="Очистить холст"
          >
          </button>
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-rectangle drawing-tool-btn-small ${tool === 'rectangle' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('rectangle');
            }}
            title="Прямоугольник"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-ellipse drawing-tool-btn-small ${tool === 'ellipse' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('ellipse');
            }}
            title="Эллипс"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-line drawing-tool-btn-small ${tool === 'line' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('line');
            }}
            title="Линия"
          >
          </button>
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-text drawing-tool-btn-small ${tool === 'text' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('text');
            }}
            title="Текст"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-latex drawing-tool-btn-small ${tool === 'latex' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-success'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('latex');
            }}
            title="Формула"
          >
          </button>
        </div>
        <div className="tools-container">
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-select drawing-tool-btn-small ${tool === 'select' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('select');
            }}
            title="Выделение"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-delete drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              if (selectedId) {
                handleDeleteShape(selectedId);
              }
            }}
            disabled={!selectedId || tool !== 'select'}
            title="Удалить выделенную фигуру"
          >
          </button>
        </div>
        <div className='tools-container'>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-ocr drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="OCR-выделение"
          >
          </button>          
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-change drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="Изменить"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-install drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="Установка"
          >
          </button>
        </div>
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