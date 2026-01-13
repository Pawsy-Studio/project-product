import React from 'react';
import '../App.css';

type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'path' | 'text' | 'latex' | 'highlighter';
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

interface LatexSymbol {
  name: string;
  latex: string;
  description: string;
  category: 'fraction' | 'root' | 'superscript' | 'subscript' | 'brackets' | 'operators' | 'symbols';
  placeholder?: string;
}

interface LatexCategory {
  id: string;
  name: string;
  icon: string;
}

interface LatexEditorProps {
  shape: Shape;
  tempText: string;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  updateTextInRealTime: (text: string) => void;
  finishTextEditing: (saveToHistoryFlag?: boolean) => void;
  
  x: number;
  y: number;
  width: number;
  textareaStyle: React.CSSProperties;
  
  latexSymbols: LatexSymbol[];
  latexCategories: LatexCategory[];
  handleLatexSymbolClick: (symbol: LatexSymbol) => void;
  renderLatexToHtml: (latex: string, fontSize?: number) => string;

  showLatexPreview?: boolean;
  showLatexMenu?: boolean;
  selectedLatexCategory?: string;
  latexPreview?: string;
  fontSize?: number;
  strokeColor?: string;

  setShowLatexMenu: (show: boolean) => void;
  setShowLatexPreview?: (show: boolean) => void;
  setSelectedLatexCategory: (category: string) => void;
}

const LatexEditor: React.FC<LatexEditorProps> = ({
  shape,
  tempText,
  textAreaRef,
  updateTextInRealTime,
  finishTextEditing,
  x,
  y,
  width,
  textareaStyle,
  latexSymbols = [],
  latexCategories = [],
  handleLatexSymbolClick,
  renderLatexToHtml,
  showLatexPreview = true,
  showLatexMenu = false,
  selectedLatexCategory = 'fraction',
  latexPreview = 'E = mc^2',
  setShowLatexMenu,
  setSelectedLatexCategory
}) => {

  const filteredSymbols = selectedLatexCategory === 'all' 
    ? latexSymbols 
    : latexSymbols.filter(sym => sym.category === selectedLatexCategory);

  return (
    <>
      {/* Тулубар с превью и символами */}
      <div 
        className="latex-editor-toolbar-container"
        style={{
          position: 'absolute',
          left: `${x - 100}px`,
          top: `${y - 150}px`,
          width: `${width + 200}px`,
          minHeight: '120px',
          zIndex: 1002,
          pointerEvents: 'auto',
        }}
      >
        <div className="latex-editor-toolbar">
          {showLatexPreview && (
            <div
              className="latex-preview"
              dangerouslySetInnerHTML={{
                __html: renderLatexToHtml(latexPreview || tempText || 'E = mc^2', 20)
              }}
              style={{
                fontSize: '20px',
                color: shape.stroke,
                minHeight: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          )}
          
          <div className="latex-symbols-dropdown" style={{ 
            display: 'flex', 
            justifyContent: 'center',
            position: 'relative',
            marginTop: '8px'
          }}>
            <button
              type="button"
              className={`drawing-tool-btn drawing-tool-btn-outline-success drawing-tool-btn-small latex-symbols-btn ${showLatexMenu ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowLatexMenu(!showLatexMenu);
              }}
            >
              <span className='latex-symbols-button'>Символы</span>
            </button>

            {showLatexMenu && (
              <div className="latex-symbols-menu" style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                marginTop: '10px',
                zIndex: 1003,
                pointerEvents: 'auto',
              }}>
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
                        handleLatexSymbolClick(symbol);
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
          </div>
        </div>
      </div>

      {/* Отдельный контейнер для textarea (поле ввода формулы) */}
      <div 
        className="latex-editor-container"
        style={{
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${textareaStyle.height}`,
          zIndex: 1001,
          pointerEvents: 'auto',
        }}
      >
        <textarea
          ref={textAreaRef}
          value={tempText}
          onChange={(e) => updateTextInRealTime(e.target.value)}
          onBlur={() => {
            setTimeout(() => {
              const activeElement = document.activeElement;
              if (!activeElement || 
                  (!activeElement.closest('.latex-editor-container') && 
                   !activeElement.closest('.latex-editor-toolbar-container') &&
                   !activeElement.closest('.latex-symbols-menu'))) {
                finishTextEditing(true);
              }
            }, 100);
          }}
          style={{
            ...textareaStyle,
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            margin: 0,
            padding: '4px',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              finishTextEditing(true);
            }
            if (e.key === 'Enter' && e.ctrlKey) {
              finishTextEditing(true);
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
          placeholder="Введите LaTeX формулу"
        />
      </div>
    </>
  );
};

export default LatexEditor;
