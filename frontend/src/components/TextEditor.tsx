import '../App.css'

interface TextEditorInterface{
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
    tempText: string;
    updateTextInRealTime: (text: string) => void;
    finishTextEditing: () => void;
    textareaStyle: React.CSSProperties;
}

const TextEditor: React.FC<TextEditorInterface> = ({
    textAreaRef,
    tempText,
    updateTextInRealTime,
    finishTextEditing,
    textareaStyle,
}) => {
    return (
        <textarea
        ref={textAreaRef}
        value={tempText}
        onChange={(e) => updateTextInRealTime(e.target.value)}
        onBlur={() => finishTextEditing()}
        style={textareaStyle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            finishTextEditing();
          }
          if (e.key === 'Enter' && e.ctrlKey) {
            finishTextEditing();
          }
        }}
        autoFocus
      />
    );
};

export default TextEditor
