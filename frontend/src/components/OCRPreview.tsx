import React, { useState, useRef, useEffect } from 'react';
import '../App.css';
import { renderLatexToHtml } from '../utils/latexUtils';
import { latexSymbols } from '../constants/latexSymbols';
import { latexCategories } from '../constants/latexCategories';
import { useLatexSymbols } from '../hooks/useLatexSymbols';

interface OCRPreviewProps {
  latex: string;
  position: { x: number; y: number };
  fontSize: number;
  strokeColor: string;
  onSave: (finalLatex: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  isEditing?: boolean;
  onFinishEdit?: (editedLatex: string) => void;
}

const OCRPreview: React.FC<OCRPreviewProps> = ({
  latex,
  position,
  fontSize,
  strokeColor,
  onSave,
  onEdit,
  onCancel,
  isEditing = false,
  onFinishEdit
}) => {
  const [editText, setEditText] = useState(latex);
  const [showSymbolsMenu, setShowSymbolsMenu] = useState(false);
  const [selectedLatexCategory, setSelectedLatexCategory] = useState('fraction');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const { insertLatexSymbol } = useLatexSymbols(textAreaRef, isEditing ? 'ocr-preview' : null, setEditText);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    setShowSymbolsMenu(false);
    if (onFinishEdit) {
      onFinishEdit(editText);
    }
  };

  const handleCancelEdit = () => {
    setShowSymbolsMenu(false);
    setEditText(latex);
    if (onFinishEdit) {
      onFinishEdit(latex);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const filteredSymbols = selectedLatexCategory === 'all'
    ? latexSymbols
    : latexSymbols.filter(sym => sym.category === selectedLatexCategory);

  if (isEditing) {
    return (
      <div
        className="ocr-preview-container ocr-preview-editing"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 1001,
        }}
      >
        <div className="ocr-preview-content">
          <textarea
            ref={textAreaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="ocr-latex-editor"
            placeholder="Введите LaTeX формулу"
            style={{
              fontSize: '14px',
              color: strokeColor,
              border: '1px solid #696969',
              borderRadius: '3px',
              padding: '8px',
              minHeight: '60px',
              width: '100%',
              resize: 'vertical',
              backgroundColor: '#f5f5f5',
            }}
          />

          {showSymbolsMenu && (
            <div className="latex-symbols-menu" style={{ marginTop: '8px' }}>
              <div className="latex-categories-container">
                {latexCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`drawing-tool-btn drawing-tool-btn-small ${
                      selectedLatexCategory === cat.id
                        ? 'drawing-tool-btn-primary'
                        : 'drawing-tool-btn-outline-secondary'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLatexCategory(cat.id);
                    }}
                  >
                    <span>{cat.icon}</span>
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
                      insertLatexSymbol(symbol.latex);
                    }}
                    title={symbol.description}
                  >
                    <div className="latex-symbol-name">
                      <span dangerouslySetInnerHTML={{
                        __html: renderLatexToHtml(symbol.latex, 24)
                      }} />
                    </div>
                    <div className="latex-symbol-code">
                      {symbol.placeholder || symbol.latex}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ocr-preview-buttons">
            <button
              type="button"
              className="drawing-tool-btn tool-icon tool-done drawing-tool-btn-outline-success drawing-tool-btn-small"
              onClick={handleSaveEdit}
              title="Сохранить изменения (Ctrl+Enter)"
            />

            <button
              type="button"
              className={`drawing-tool-btn drawing-tool-btn-outline-primary drawing-tool-btn-small latex-symbols-btn ${showSymbolsMenu ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowSymbolsMenu(!showSymbolsMenu);
              }}
              title="Символы LaTeX"
            >
              <span className='latex-symbols-button'>Σ</span>
            </button>

            <button
              type="button"
              className="drawing-tool-btn tool-icon tool-close drawing-tool-btn-outline-danger drawing-tool-btn-small"
              onClick={handleCancelEdit}
              title="Отменить изменения (Escape)"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ocr-preview-container"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1001,
      }}
    >
      <div className="ocr-preview-content">
        <div
          className="ocr-latex-preview"
          dangerouslySetInnerHTML={{
            __html: renderLatexToHtml(latex, fontSize)
          }}
          style={{
            color: strokeColor,
          }}
        />

        <div className="ocr-preview-buttons">
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-done drawing-tool-btn-outline-success drawing-tool-btn-small"
            onClick={() => onSave(latex)}
            title="Сохранить"
          />

          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-edit-text drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={onEdit}
            title="Изменить"
          />

          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-close drawing-tool-btn-outline-danger drawing-tool-btn-small"
            onClick={onCancel}
            title="Отменить"
          />
        </div>
      </div>
    </div>
  );
};

export default OCRPreview;
