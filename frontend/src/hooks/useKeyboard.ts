import { useEffect, useCallback } from 'react';

export const useKeyboard = (
  shiftPressed: boolean,
  setShiftPressed: React.Dispatch<React.SetStateAction<boolean>>,
  selectedId: string | null,
  editingTextId: string | null,
  handleDeleteShape: (id: string) => void,
  handleUndo: () => void,
  finishTextEditing: (saveToHistory?: boolean) => void,
  changeFontSizeWithStep: (selectedId: string | null, direction: 'up' | 'down', shiftPressed: boolean) => void,
  toggleTextStyle: (selectedId: string | null, styleType: 'bold' | 'italic' | 'underline' | 'strikethrough') => void,
  shapes: any[],
  zoomIn?: () => void,
  zoomOut?: () => void
) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Shift') setShiftPressed(true);
    
    if (e.key === 'Delete' && selectedId) {
      handleDeleteShape(selectedId);
    }
    
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
      changeFontSizeWithStep(selectedId, direction, e.shiftKey);
    }
    
    if ((e.ctrlKey || e.metaKey)) {
      switch (e.key) {
        case '=':
        case '+':
          e.preventDefault();
          if (zoomIn) zoomIn();
          break;
        case '-':
          e.preventDefault();
          if (zoomOut) zoomOut();
          break;
      }

      if (selectedId) {
        const selectedShape = shapes.find(s => s.id === selectedId);
        if (selectedShape && selectedShape.type === 'text') {
          switch (e.key) {
            case 'b':
              e.preventDefault();
              toggleTextStyle(selectedId, 'bold');
              break;
            case 'i':
              e.preventDefault();
              toggleTextStyle(selectedId, 'italic');
              break;
            case 'u':
              e.preventDefault();
              toggleTextStyle(selectedId, 'underline');
              break;
          }
        }
      }
    }
  }, [
    shiftPressed, selectedId, editingTextId, shapes,
    setShiftPressed, handleDeleteShape, handleUndo,
    finishTextEditing, changeFontSizeWithStep, toggleTextStyle,
    zoomIn, zoomOut
  ]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Shift') setShiftPressed(false);
  }, [setShiftPressed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
};
