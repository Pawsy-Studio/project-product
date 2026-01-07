"""
Сервис для распознавания LaTeX формул из изображений с помощью Tesseract OCR
"""
import os
import tempfile
import numpy as np
import cv2
import pytesseract
import re
from PIL import Image
from django.conf import settings

class LaTeXOCRService:
    """
    Сервис для обработки изображений и распознавания LaTeX формул
    """
    
    def __init__(self):
        """Инициализация сервиса OCR"""
        # Настройка пути к Tesseract
        if hasattr(settings, 'TESSERACT_CMD'):
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        
        # Путь к данным Tesseract для математических символов
        if hasattr(settings, 'TESSDATA_PREFIX'):
            os.environ['TESSDATA_PREFIX'] = settings.TESSDATA_PREFIX
    
    def preprocess_image(self, image_array):
        """
        Предобработка изображения для улучшения распознавания
        
        Args:
            image_array: numpy array изображения
            
        Returns:
            Обработанное изображение в виде numpy array
        """
        # Если изображение цветное, конвертируем в оттенки серого
        if len(image_array.shape) == 3:
            gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
        else:
            gray = image_array
        
        # Увеличение контраста
        gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
        
        # Бинаризация (черно-белое)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Удаление мелкого шума
        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        # Увеличение толщины линий для лучшего распознавания
        kernel = np.ones((1, 1), np.uint8)
        thickened = cv2.dilate(cleaned, kernel, iterations=1)
        
        return thickened
    
    def image_to_text(self, image_array):
        """
        Распознавание текста из изображения с помощью Tesseract
        
        Args:
            image_array: numpy array изображения
            
        Returns:
            Распознанный текст
        """
        try:
            # Пытаемся использовать математическую модель
            custom_config = r'--oem 3 --psm 6 -l eng+equ'
            text = pytesseract.image_to_string(
                image_array, 
                config=custom_config
            )
        except Exception:
            # Если не работает с математической конфигурацией, используем стандартную
            text = pytesseract.image_to_string(
                image_array, 
                config='--oem 3 --psm 6'
            )
        
        return text.strip()
    
    def convert_to_latex(self, text):
        """
        Конвертация распознанного текста в LaTeX формат для KaTeX
        
        Args:
            text: Распознанный текст
            
        Returns:
            LaTeX формула, совместимая с KaTeX
        """
        if not text:
            return ""
        
        # Удаляем лишние пробелы и переносы строк
        text = ' '.join(text.split())
        
        # Словарь замен для математических символов
        symbol_replacements = {
            # Греческие буквы
            'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
            'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
            'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
            'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
            'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
            'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
            
            # Математические операторы
            '×': '\\times', '÷': '\\div', '±': '\\pm', '∓': '\\mp',
            '⋅': '\\cdot', '∗': '\\ast', '∘': '\\circ', '∙': '\\bullet',
            
            # Отношения
            '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
            '≡': '\\equiv', '≅': '\\cong', '∼': '\\sim', '∝': '\\propto',
            '≪': '\\ll', '≫': '\\gg',
            
            # Стрелки
            '→': '\\rightarrow', '←': '\\leftarrow', '↔': '\\leftrightarrow',
            '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow',
            
            # Другие символы
            '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
            '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
            '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod',
            '√': '\\sqrt', '∠': '\\angle', '⊥': '\\perp', '∥': '\\parallel',
        }
        
        # Заменяем символы
        for symbol, latex in symbol_replacements.items():
            text = text.replace(symbol, f' {latex} ')
        
        # Обработка дробей вида a/b
        def replace_fraction(match):
            numerator = match.group(1)
            denominator = match.group(2)
            return f'\\frac{{{numerator}}}{{{denominator}}}'
        
        text = re.sub(r'(\d+|[a-zA-Z])\s*/\s*(\d+|[a-zA-Z])', replace_fraction, text)
        
        # Обработка верхних индексов (степени)
        text = re.sub(r'(\w+)\^(\d+)', r'\1^{\2}', text)
        text = re.sub(r'(\w+)\^\(([^)]+)\)', r'\1^{\2}', text)
        
        # Обработка нижних индексов
        text = re.sub(r'(\w+)_(\d+)', r'\1_{\2}', text)
        text = re.sub(r'(\w+)_\(([^)]+)\)', r'\1_{\2}', text)
        
        # Обработка квадратного корня
        text = re.sub(r'sqrt\s*\(([^)]+)\)', r'\\sqrt{\1}', text, flags=re.IGNORECASE)
        
        # Обработка сумм и интегралов с пределами
        text = re.sub(r'sum_(\w+)\^(\w+)', r'\\sum_{\1}^{\2}', text, flags=re.IGNORECASE)
        text = re.sub(r'int_(\w+)\^(\w+)', r'\\int_{\1}^{\2}', text, flags=re.IGNORECASE)
        
        # Удаляем лишние пробелы вокруг операторов
        operators = ['+', '-', '=', '\\pm', '\\mp', '\\times', '\\div']
        for op in operators:
            text = text.replace(f' {op} ', op)
        
        # Добавляем математический режим, если его нет
        if not (text.startswith('$') and text.endswith('$')):
            text = f'${text}$'
        
        # Очищаем от множественных пробелов
        text = re.sub(r'\s+', ' ', text)
        
        return text
    
    def process_image_file(self, image_file):
        """
        Обработка загруженного файла изображения
        
        Args:
            image_file: InMemoryUploadedFile из Django
            
        Returns:
            dict: Результат распознавания
        """
        # Сохраняем во временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
            for chunk in image_file.chunks():
                tmp_file.write(chunk)
            tmp_path = tmp_file.name
        
        try:
            # Читаем изображение
            image = cv2.imread(tmp_path)
            if image is None:
                # Пробуем через PIL если OpenCV не смог
                pil_image = Image.open(tmp_path)
                image = np.array(pil_image.convert('RGB'))
            
            # Предобработка
            processed_image = self.preprocess_image(image)
            
            # Распознавание
            recognized_text = self.image_to_text(processed_image)
            
            # Конвертация в LaTeX
            latex_formula = self.convert_to_latex(recognized_text)
            
            # Очистка
            os.unlink(tmp_path)
            
            return {
                'success': True,
                'latex': latex_formula,
                'original_text': recognized_text,
                'confidence': self.estimate_confidence(recognized_text, latex_formula)
            }
            
        except Exception as e:
            # Очистка в случае ошибки
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            
            return {
                'success': False,
                'error': str(e),
                'latex': '',
                'original_text': ''
            }
    
    def estimate_confidence(self, original_text, latex_formula):
        """
        Оценка уверенности в распознавании
        
        Args:
            original_text: Исходный распознанный текст
            latex_formula: Преобразованная LaTeX формула
            
        Returns:
            float: Оценка уверенности от 0 до 1
        """
        if not original_text:
            return 0.0
        
        # Базовые эвристики для оценки уверенности
        score = 0.5  # Базовый уровень
        
        # Длина текста
        if len(original_text) > 3:
            score += 0.1
        
        # Наличие математических символов
        math_symbols = ['=', '+', '-', '/', '^', '_']
        for symbol in math_symbols:
            if symbol in original_text:
                score += 0.05
        
        # Наличие греческих букв или математических операторов
        greek_letters = ['alpha', 'beta', 'gamma', 'delta', 'pi', 'theta', 'sum', 'int']
        for letter in greek_letters:
            if letter in latex_formula.lower():
                score += 0.1
        
        # Ограничиваем от 0 до 1
        return min(max(score, 0.0), 1.0)


# Глобальный экземпляр сервиса для использования во всем приложении
latex_ocr_service = LaTeXOCRService()