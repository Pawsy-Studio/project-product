import './App.css'

type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex' | 'highlighter';

interface SelDelToolbarInterface{
    finishTextEditing: () => void;
    setTool: (tool: ToolMode) => void;
    tool: ToolMode
    editingTextId: string
    selectedId: string
    handleDeleteShape: (selectedId: string) => void;
}

const SelDelToolbar: React.FC<SelDelToolbarInterface> = ({
    finishTextEditing,
    editingTextId,
    setTool,
    selectedId,
    tool,
    handleDeleteShape
}) =>{
    return (
        <div className="tools-container">
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-select drawing-tool-btn-small ${tool === 'select' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'}`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              setTool('select');
            }}
            title="Выделение"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-delete drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              if (selectedId) {
                handleDeleteShape(selectedId);
              }
            }}
            disabled={!selectedId || tool !== 'select'}
            title="Удалить выделенную фигуру"
          >
          </button>
        </div>
    );
};

export default SelDelToolbar