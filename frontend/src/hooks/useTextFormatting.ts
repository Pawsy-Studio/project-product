import { useCallback } from 'react';
import type  { Shape } from '../types';
import { measureLatexSize, renderLatexToHtml } from '../utils/latexUtils';

export const useTextFormatting = (
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  saveToHistory: (shapes: Shape[]) => void,
  fontSize: number
) => {
  const updateSelectedTextProperty = useCallback((
    selectedId: string | null,
    property: keyof Shape,
    value: any
  ) => {
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
  }, [shapes, setShapes, saveToHistory, fontSize]);

  const toggleTextStyle = useCallback((
    selectedId: string | null,
    styleType: 'bold' | 'italic' | 'underline' | 'strikethrough'
  ) => {
    if (!selectedId) return;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (!selectedShape || selectedShape.type !== 'text') return;

    let newDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through';
    const currentDecoration = selectedShape.textDecoration || 'none';

    switch (styleType) {
      case 'bold':
        const newFontWeight = selectedShape.fontWeight === 'bold' ? 'normal' : 'bold';
        updateSelectedTextProperty(selectedId, 'fontWeight', newFontWeight);
        break;

      case 'italic':
        const newFontStyle = selectedShape.fontStyle === 'italic' ? 'normal' : 'italic';
        updateSelectedTextProperty(selectedId, 'fontStyle', newFontStyle);
        break;

      case 'underline':
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
        updateSelectedTextProperty(selectedId, 'textDecoration', newDecoration);
        break;

      case 'strikethrough':
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
        updateSelectedTextProperty(selectedId, 'textDecoration', newDecoration);
        break;
    }
  }, [shapes, updateSelectedTextProperty]);

  const changeFontSizeWithStep = useCallback((
    selectedId: string | null,
    direction: 'up' | 'down',
    shiftPressed: boolean
  ) => {
    if (!selectedId) return;
    
    const selectedShape = shapes.find(s => s.id === selectedId);
    if (selectedShape && (selectedShape.type === 'text' || selectedShape.type === 'latex')) {
      const currentSize = selectedShape.fontSize || fontSize;
      const step = shiftPressed ? 2 : 1;
      const newSize = direction === 'up' 
        ? currentSize + step 
        : Math.max(1, currentSize - step);
      
      updateSelectedTextProperty(selectedId, 'fontSize', newSize);
    }
  }, [shapes, fontSize, updateSelectedTextProperty]);

  return {
    updateSelectedTextProperty,
    toggleTextStyle,
    changeFontSizeWithStep
  };
};