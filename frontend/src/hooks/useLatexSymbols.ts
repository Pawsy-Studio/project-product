import { useCallback } from 'react';

export const useLatexSymbols = (
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>,
  editingTextId: string | null,
  updateTextInRealTime: (text: string) => void
) => {
  const insertLatexSymbol = useCallback((latex: string) => {
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
  }, [textAreaRef, editingTextId, updateTextInRealTime]);

  return {
    insertLatexSymbol
  };
};
