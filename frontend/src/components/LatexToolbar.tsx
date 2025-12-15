import React from 'react';
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
      className="latex-toolbar"
      style={{
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${panelWidth}px`,
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '5px',
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => startTextEditing(selectedId)}
      >
        ✏️ Редактировать
      </button>
      
      <select
        value={selectedShape.fontSize || fontSize}
        onChange={(e) => updateSelectedTextProperty('fontSize', parseInt(e.target.value))}
      >
        {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
          <option key={size} value={size}>{size}px</option>
        ))}
      </select>
      
      <input
        type="color"
        value={selectedShape.stroke || strokeColor}
        onChange={(e) => updateSelectedTextProperty('stroke', e.target.value)}
        title="Цвет формулы"
      />
    </div>
  );
};

export default LatexToolbar;