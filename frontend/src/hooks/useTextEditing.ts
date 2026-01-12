// @ts-nocheck
import { useState, useCallback, useEffect } from 'react';
import type  { Shape } from '../types';
import { renderLatexToHtml, measureLatexSize } from '../utils/latexUtils';

export const useTextEditing = (
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  saveToHistory: (shapes: Shape[]) => void,
  fontSize: number,
  strokeColor: string
) => {
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempText, setTempText] = useState('');
  const [isTextChanged, setIsTextChanged] = useState(false);
  const [latexPreview, setLatexPreview] = useState<string>('E = mc^2');

  const startTextEditing = useCallback((shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (shape && (shape.type === 'text' || shape.type === 'latex')) {
      setShapes(shapes.map(s => ({
        ...s,
        isEditing: s.id === shapeId,
        isSelected: s.id === shapeId
      })));
      setEditingTextId(shapeId);
      setTempText(shape.text || shape.latex || '');
      setIsTextChanged(false);
      setLatexPreview(shape.latex || 'E = mc^2');
    }
  }, [shapes, setShapes]);

  const finishTextEditing = useCallback((saveToHistoryFlag: boolean = true) => {
    if (editingTextId) {
      const updatedShapes = shapes.map(s => {
        if (s.id === editingTextId) {
          const finalText = tempText || 'E = mc^2';
          
          if (s.type === 'latex') {
            const currentFontSize = s.fontSize || fontSize;
            const renderedLatex = renderLatexToHtml(finalText, currentFontSize);
            const size = measureLatexSize(finalText, currentFontSize);
            
            return {
              ...s,
              latex: finalText,
              latexRendered: renderedLatex,
              isEditing: false,
              text: ''
            };
          } else {
            const currentFontSize = s.fontSize || fontSize;
            const lineHeight = currentFontSize;
            const lines = finalText.split('\n').length || 1;
            const newHeight = Math.max(lines * lineHeight * 1.2, 50);
            
            return {
              ...s,
              text: finalText,
              isEditing: false,
              height: newHeight
            };
          }
        }
        return { ...s, isEditing: false, isSelected: false };
      });
      
      setShapes(updatedShapes);
      
      if (isTextChanged && saveToHistoryFlag) {
        saveToHistory(updatedShapes);
      }
      
      setEditingTextId(null);
      setTempText('');
      setIsTextChanged(false);
      return true;
    }
    return false;
  }, [editingTextId, shapes, tempText, isTextChanged, fontSize, setShapes, saveToHistory]);

  const updateTextInRealTime = useCallback((newText: string) => {
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
  }, [editingTextId, shapes, fontSize, setShapes]);

  return {
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
  };
};