import { useState, useCallback } from 'react';
import type { Shape } from '../types';

export const useHistory = (initialShapes: Shape[]) => {
  const [history, setHistory] = useState<Shape[][]>([initialShapes]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = useCallback((newShapes: Shape[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newShapes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return [...history[newIndex]];
    }
    return null;
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return [...history[newIndex]];
    }
    return null;
  }, [history, historyIndex]);

  const resetHistory = useCallback((shapes: Shape[]) => {
    setHistory([shapes]);
    setHistoryIndex(0);
  }, []);

  return {
    history,
    historyIndex,
    saveToHistory,
    handleUndo,
    handleRedo,
    resetHistory
  };
};