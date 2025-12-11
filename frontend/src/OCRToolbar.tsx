import './App.css'

const OCRToolbar: React.FC = ({}) => {
    return(
        <div className='tools-container'>
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-ocr drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="OCR-выделение"
          >
          </button>          
          <button
            type="button"
            className="drawing-tool-btn tool-icon tool-change drawing-tool-btn-danger drawing-tool-btn-small"
            onClick={() => {
              console.log("ЭТО ЗАГЛУШКА ДЛЯ OCR")
            }}
            title="Изменить"
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