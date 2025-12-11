import './App.css'

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

interface TextToolbarInterface {
  selectedShape: Shape;
  selectedId: string;
  showTextFormatDropdown: boolean;
  showTextAlignDropdown: boolean;
  setShowTextFormatDropdown: (value: boolean) => void;
  setShowTextAlignDropdown: (value: boolean) => void;
  updateSelectedTextProperty: (property: keyof Shape, value: any) => void;
  startTextEditing: (shapeId: string) => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrikethrough: () => void;
  fontFamily: string;
  fontSize: number;
  strokeColor: string;
  availableFonts: string[];
  left: number;
  top: number;
  panelWidth: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  currentAlign: string;
}

const TextToolbar: React.FC<TextToolbarInterface> = ({
  selectedShape,
  selectedId,
  isBold,
  isItalic,
  isUnderline,
  isStrikethrough,
  currentAlign,
  showTextFormatDropdown,
  showTextAlignDropdown,
  setShowTextFormatDropdown,
  setShowTextAlignDropdown,
  updateSelectedTextProperty,
  startTextEditing,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  fontFamily,
  fontSize,
  strokeColor,
  availableFonts,
  left,
  top,
  panelWidth,
}) => {
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

export default TextToolbar;