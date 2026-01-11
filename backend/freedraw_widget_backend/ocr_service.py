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
import logging

logger = logging.getLogger(__name__)


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

            # УЛУЧШЕННАЯ оценка уверенности (передаем processed_image)
            confidence = self.estimate_confidence(recognized_text, latex_formula, processed_image)

            # Очистка
            os.unlink(tmp_path)

            return {
                'success': True,
                'latex': latex_formula,
                'original_text': recognized_text,
                'confidence': confidence
            }

        except Exception as e:
            # Очистка в случае ошибки
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

            return {
                'success': False,
                'error': str(e),
                'latex': '',
                'original_text': '',
                'confidence': 0.0
            }

    def estimate_confidence(self, original_text, latex_formula, image_array=None):
        """
        УЛУЧШЕННАЯ оценка уверенности с использованием встроенной confidence Tesseract

        Args:
            original_text: Исходный распознанный текст
            latex_formula: Преобразованная LaTeX формула
            image_array: Обработанное изображение (numpy array)

        Returns:
            float: Оценка уверенности от 0 до 1
        """
        if not original_text:
            return 0.0

        # 1. ГЛАВНОЕ: Получаем реальную confidence от Tesseract (вес 70%)
        tesseract_confidence = 0.0

        if image_array is not None:
            try:
                # Получаем детальные данные от Tesseract включая confidence
                data = pytesseract.image_to_data(
                    image_array,
                    config='--oem 3 --psm 6',
                    output_type=pytesseract.Output.DICT
                )

                # Извлекаем confidence для всех распознанных слов
                # conf=-1 означает, что это не текст (например, разделитель страниц)
                confidences = []
                for i, conf in enumerate(data['conf']):
                    # Проверяем что это валидное число и не -1
                    try:
                        conf_float = float(conf)
                        if conf_float >= 0:  # Игнорируем -1
                            confidences.append(conf_float)
                    except (ValueError, TypeError):
                        continue

                if confidences:
                    # Средняя confidence (Tesseract возвращает 0-100)
                    avg_conf = sum(confidences) / len(confidences)
                    tesseract_confidence = avg_conf / 100.0  # Нормализуем к 0-1
                    logger.info(f"Tesseract avg confidence: {avg_conf:.1f}% ({len(confidences)} words)")
                else:
                    # Если нет распознанных слов с confidence
                    tesseract_confidence = 0.25
                    logger.warning("No valid confidence data from Tesseract")

            except Exception as e:
                logger.error(f"Error getting Tesseract confidence: {e}")
                tesseract_confidence = 0.35  # Средняя confidence при ошибке
        else:
            # Если изображение не передано, используем базовую оценку
            tesseract_confidence = 0.40
            logger.warning("No image provided for confidence calculation")

        # 2. Качество LaTeX структуры (вес 30%)
        latex_quality = 0.0

        # Наличие LaTeX команд (более важные команды)
        latex_commands = {
            '\\frac': 0.15,      # Дроби - очень важный индикатор
            '\\sqrt': 0.12,      # Корни
            '\\sum': 0.10,       # Суммы
            '\\int': 0.10,       # Интегралы
            '\\lim': 0.08,       # Пределы
            '\\alpha': 0.05,     # Греческие буквы
            '\\beta': 0.05,
            '\\pi': 0.05,
            '\\theta': 0.05,
        }

        for cmd, score in latex_commands.items():
            if cmd in latex_formula:
                latex_quality += score

        # Наличие базовых математических символов
        basic_math = ['^', '_', '=', '+', '-']
        math_count = sum(1 for sym in basic_math if sym in original_text)
        latex_quality += min(math_count * 0.02, 0.10)

        # Ограничиваем до 0.30 (30%)
        latex_quality = min(latex_quality, 0.30)

        # 3. Штрафы за проблемные паттерны
        penalty = 0.0

        # Слишком короткий текст (меньше 2 символов)
        if len(original_text.strip()) < 2:
            penalty += 0.15

        # Много пробелов (признак плохого распознавания)
        space_ratio = original_text.count(' ') / max(len(original_text), 1)
        if space_ratio > 0.6:
            penalty += 0.10

        # 4. ИТОГОВАЯ УВЕРЕННОСТЬ
        # 70% - реальная confidence от Tesseract
        # 30% - качество LaTeX
        # minus penalties
        confidence = (tesseract_confidence * 0.70) + latex_quality - penalty

        # Ограничиваем диапазон [0.0, 1.0]
        final_confidence = min(max(confidence, 0.0), 1.0)

        logger.info(
            f"Tesseract confidence: {final_confidence:.3f} "
            f"(tesseract={tesseract_confidence:.2f}*0.7, latex_quality={latex_quality:.2f}, penalty=-{penalty:.2f})"
        )

        return final_confidence


# Глобальный экземпляр сервиса для использования во всем приложении
latex_ocr_service = LaTeXOCRService()
