import './App.css';

type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex' | 'highlighter';

interface ToolsToolbarInterface{
    handleUndo: () => void;
    handleRedo: () => void;
    handleClearCanvas: () => void;
    finishTextEditing: () => void;
    setTool: (tool: ToolMode) => void;
    editingTextId: string
    tool: ToolMode
}

const ToolsToolbar: React.FC<ToolsToolbarInterface> = ({
    handleUndo,
    handleRedo,
    handleClearCanvas,
    finishTextEditing,
    setTool,
    editingTextId,
    tool
}) => {
    return(
        <div className="tools-container">
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-undo drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleUndo}
            title="Отменить"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-redo drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleRedo}
            title="Повторить"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-clear drawing-tool-btn-outline-primary drawing-tool-btn-small"
            onClick={handleClearCanvas}
            title="Очистить холст"
          >
          </button>
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-rectangle drawing-tool-btn-small ${tool === 'rectangle' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('rectangle');
            }}
            title="Прямоугольник"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-ellipse drawing-tool-btn-small ${tool === 'ellipse' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('ellipse');
            }}
            title="Эллипс"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-line drawing-tool-btn-small ${tool === 'line' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('line');
            }}
            title="Линия"
          >
          </button>
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-text drawing-tool-btn-small ${tool === 'text' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('text');
            }}
            title="Текст"
          >
          </button>
        
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-latex drawing-tool-btn-small ${tool === 'latex' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-success'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('latex');
            }}
            title="Формула"
          >
          </button>
        </div>
    );
}

export default ToolsToolbar