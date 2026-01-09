import '../App.css'

interface OCRToolbarProps {
  onOcrSelect: () => void;
  onOcrRecognize: () => void;
  tool: string;
  ocrSelection: any;
  editingTextId: string | null;
  finishTextEditing: () => void;
}

const OCRToolbar: React.FC<OCRToolbarProps> = ({
  onOcrSelect,
  onOcrRecognize,
  tool,
  ocrSelection,
  editingTextId,
  finishTextEditing
}) => {
    return(
        <div className='tools-container'>
          <button
            type="button"
            className={`drawing-tool-btn tool-icon tool-ocr ${tool === 'ocr-selection' ? 'drawing-tool-btn-primary' : 'drawing-tool-btn-outline-primary'} drawing-tool-btn-small`}
            onClick={() => {
              if (editingTextId) {
                finishTextEditing();
              }
              onOcrSelect();
            }}
            title="OCR-выделение"
          >
          </button>          
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-change drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={onOcrRecognize}
            disabled={!ocrSelection || tool !== 'ocr-selection'}
            title="Распознать выделенную область"
          >
          </button>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-install drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="Установка"
          >
          </button>
        </div>
    );
};

export default OCRToolbar