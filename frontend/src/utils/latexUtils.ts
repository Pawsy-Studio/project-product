// @ts-nocheck
import katex from 'katex';

export const renderLatexToHtml = (latex: string, fontSize: number = 20): string => {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
      strict: false,
      fontSize: `${fontSize}px`
    });
  } catch (error) {
    console.error('LaTeX rendering error:', error);
    return `<span style="color: red;">LaTeX error: ${latex}</span>`;
  }
};

export const measureLatexSize = (latex: string, fontSize: number): { width: number, height: number } => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.display = 'inline-block';
  container.style.fontSize = `${fontSize}px`;
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.lineHeight = '1';
  document.body.appendChild(container);
  
  try {
    katex.render(latex, container, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
      strict: false
    });
    
    const width = container.offsetWidth + 20;
    const height = container.offsetHeight + 10;
    
    return { width, height };
  } catch (error) {
    console.error('LaTeX measurement error:', error);
    return { width: 200, height: 50 };
  } finally {
    document.body.removeChild(container);
  }
};