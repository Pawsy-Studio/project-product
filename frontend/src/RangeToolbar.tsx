import './App.css';

type ToolMode = 'select' | 'rectangle' | 'ellipse' | 'line' | 'pencil' | 'eraser' | 'text' | 'latex' | 'highlighter';

interface RangeToolbarInterface {
    tool: ToolMode
    strokeWidth: number
    setStrokeWidth: (width: number) => void
}

const RangeToolbar: React.FC<RangeToolbarInterface> = ({
    strokeWidth,
    setStrokeWidth,
    tool
}) => {
    return (
        <div className='toolbar-range-container'>
          <input
            type="range"
            className="drawing-tool-range"
            min="1"
            max="20"
            step="1"
            id="width"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(+e.target.value)}
            disabled={tool === 'text' || tool === 'latex'}
          />
        </div>
    );
};

export default RangeToolbar