import './App.css';

type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex' | 'highlighter';

interface BrushToolbarProps {
  finishTextEditing: () => void;
  tool: ToolMode;
  setTool: (tool: ToolMode) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  editingTextId: string | null;
}

const BrushToolbar: React.FC<BrushToolbarProps> = ({
  finishTextEditing,
  tool,
  setTool,
  strokeColor,
  setStrokeColor,
  editingTextId
}) => {
  return (
    <div className="tools-container">
      <button
        type="button"
        className={`drawing-tool-btn tool-icon tool-pencil ${tool === 'pencil' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
        onClick={() => {
          if (editingTextId) {
            finishTextEditing();
          }
          setTool('pencil');
        }}
        title="Карандаш"
      ></button>
      
      <button
        type="button"
        className={`drawing-tool-btn tool-icon tool-highlighter ${tool === 'highlighter' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
        onClick={() => {
          if (editingTextId) {
            finishTextEditing();
          }
          setTool('highlighter');
        }}
        title="Маркер"
      ></button>

      <button
        type="button"
        className={`drawing-tool-btn tool-icon tool-eraser ${tool === 'eraser' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
        onClick={() => {
          if (editingTextId) {
            finishTextEditing();
          }
          setTool('eraser');
        }}
        title="Ластик"
      ></button>
      
      <input
        type="color"
        id="color"
        value={strokeColor}
        onChange={(e) => setStrokeColor(e.target.value)}
        disabled={tool === 'eraser'}
        className="drawing-tool-btn color-picker"
      />
    </div>
  );
};

export default BrushToolbar;