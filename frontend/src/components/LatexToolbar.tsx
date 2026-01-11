import React from 'react';
import '../App.css';
import type { Shape } from '../types';

interface LatexToolbarProps {
  selectedShape: Shape;
  selectedId: string;
  left: number;
  top: number;
  panelWidth: number;
  startTextEditing: (id: string) => void;
  updateSelectedTextProperty: (property: keyof Shape, value: any) => void;
  fontSize: number;
  strokeColor: string;
}

const LatexToolbar: React.FC<LatexToolbarProps> = ({
  selectedShape,
  selectedId,
  left,
  top,
  panelWidth,
  startTextEditing,
  updateSelectedTextProperty,
  fontSize,
  strokeColor,
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
          title="Edit Formula"
        >
        </button>
      </div>
    </div>
  );
};

export default LatexToolbar;
