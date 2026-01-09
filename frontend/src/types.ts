export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path' | 'text' | 'latex' | 'highlighter';
export type ToolMode = 
  | 'select' 
  | 'rectangle' 
  | 'ellipse' 
  | 'line' 
  | 'pencil' 
  | 'eraser' 
  | 'text' 
  | 'latex' 
  | 'highlighter' 
  | 'ocr-selection';
export type AnchorType = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null;
export type TextAlign = 'left' | 'center' | 'right';

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  dash?: number[];
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

export interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentShape: Partial<Shape> | null;
}

export interface TransformState {
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

export interface LatexSymbol {
  name: string;
  latex: string;
  description: string;
  category: 'fraction' | 'root' | 'superscript' | 'subscript' | 'brackets' | 'operators' | 'symbols';
  placeholder?: string;
}

export interface LatexCategory {
  id: string;
  name: string;
  icon: string;
}