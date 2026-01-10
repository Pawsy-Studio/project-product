"""
Сервис для распознавания текста через OCR.space API
Заменяет Tesseract OCR для более качественного распознавания
"""
import requests
import tempfile
import os
import re
from django.conf import settings


class OCRSpaceService:
    """
    Сервис для работы с OCR.space API
    Документация: https://ocr.space/OCRAPI
    """

    def __init__(self, api_key=None):
        """
        Инициализация сервиса OCR.space

        Args:
            api_key: API ключ для OCR.space (если None, берется из settings)
        """
        self.api_key = api_key or getattr(settings, 'K83572423288957', 'K83572423288957')
        self.api_url = 'https://api.ocr.space/parse/image'

        if not self.api_key:
            raise ValueError(
                "OCR_SPACE_API_KEY не настроен. "
                "Добавьте его в settings.py или переменные окружения"
            )

    def process_image_file(self, image_file, language='eng', detect_orientation=True):
        """
        Обработка загруженного файла изображения через OCR.space API

        Args:
            image_file: InMemoryUploadedFile из Django
            language: Язык распознавания ('eng', 'rus', 'ara', 'chi_sim' и т.д.)
            detect_orientation: Автоматическое определение ориентации изображения

        Returns:
            dict: Результат распознавания с LaTeX формулой
        """
        try:
            # Сохраняем во временный файл
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
                for chunk in image_file.chunks():
                    tmp_file.write(chunk)
                tmp_path = tmp_file.name

            # Отправляем запрос к API
            with open(tmp_path, 'rb') as f:
                result = requests.post(
                    self.api_url,
                    files={'file': f},
                    data={
                        'apikey': self.api_key,
                        'language': language,
                        'OCREngine': 2,  # Engine 2 более точный
                        'detectOrientation': str(detect_orientation).lower(),
                        'scale': True,  # Улучшенное распознавание для мелкого текста
                        'isTable': False,
                        'filetype': 'PNG',
                    },
                    timeout=30
                )

            # Удаляем временный файл
            os.unlink(tmp_path)

            if result.status_code == 200:
                response_data = result.json()

                # Проверка на ошибки обработки
                if response_data.get('IsErroredOnProcessing', False):
                    error_messages = response_data.get('ErrorMessage', ['Unknown error'])
                    return {
                        'success': False,
                        'error': error_messages[0] if error_messages else 'Unknown error',
                        'latex': '',
                        'original_text': '',
                        'confidence': 0.0
                    }

                # Извлекаем текст из результата
                parsed_results = response_data.get('ParsedResults', [])
                if parsed_results:
                    parsed_text = parsed_results[0].get('ParsedText', '')

                    # Конвертируем в LaTeX
                    latex_formula = self.convert_to_latex(parsed_text)

                    # Рассчитываем уверенность
                    confidence = self._calculate_confidence(response_data, parsed_text)

                    return {
                        'success': True,
                        'latex': latex_formula,
                        'original_text': parsed_text.strip(),
                        'confidence': confidence,
                        'file_parse_exit_code': response_data.get('ParsedResults', [{}])[0].get('FileParseExitCode', 0)
                    }
                else:
                    return {
                        'success': False,
                        'error': 'No text recognized in image',
                        'latex': '',
                        'original_text': '',
                        'confidence': 0.0
                    }
            else:
                return {
                    'success': False,
                    'error': f'API request failed with status {result.status_code}: {result.text}',
                    'latex': '',
                    'original_text': '',
                    'confidence': 0.0
                }

        except requests.exceptions.Timeout:
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)
            return {
                'success': False,
                'error': 'OCR.space API timeout. Please try again.',
                'latex': '',
                'original_text': '',
                'confidence': 0.0
            }
        except Exception as e:
            # Удаляем временный файл в случае ошибки
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)

            return {
                'success': False,
                'error': f'Error processing image: {str(e)}',
                'latex': '',
                'original_text': '',
                'confidence': 0.0
            }

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

            # Заглавные греческие буквы
            'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
            'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi',
            'Ψ': '\\Psi', 'Ω': '\\Omega',

            # Математические операторы
            '×': '\\times', '÷': '\\div', '±': '\\pm', '∓': '\\mp',
            '⋅': '\\cdot', '∗': '\\ast', '∘': '\\circ', '∙': '\\bullet',

            # Отношения
            '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
            '≡': '\\equiv', '≅': '\\cong', '∼': '\\sim', '∝': '\\propto',
            '≪': '\\ll', '≫': '\\gg', '∈': '\\in', '∉': '\\notin',
            '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq', '⊇': '\\supseteq',

            # Стрелки
            '→': '\\rightarrow', '←': '\\leftarrow', '↔': '\\leftrightarrow',
            '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow',
            '↑': '\\uparrow', '↓': '\\downarrow',

            # Другие символы
            '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
            '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
            '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod',
            '√': '\\sqrt', '∠': '\\angle', '⊥': '\\perp', '∥': '\\parallel',
            '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset',
        }

        # Заменяем символы
        for symbol, latex in symbol_replacements.items():
            text = text.replace(symbol, f' {latex} ')

        # Обработка дробей вида a/b
        def replace_fraction(match):
            numerator = match.group(1)
            denominator = match.group(2)
            return f'\\frac{{{numerator}}}{{{denominator}}}'

        # Дроби с числами или переменными
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

        # Обработка lim
        text = re.sub(r'lim\s*_\s*(\w+)\s*->\s*(\w+)', r'\\lim_{\1 \\to \2}', text, flags=re.IGNORECASE)

        # Очищаем от множественных пробелов
        text = re.sub(r'\s+', ' ', text).strip()

        # Добавляем математический режим, если его нет
        if text and not (text.startswith('$') and text.endswith('$')):
            text = f'${text}$'

        return text

    def _calculate_confidence(self, response_data, parsed_text):
        """
        Расчет уверенности на основе ответа API

        Args:
            response_data: Ответ от OCR.space API
            parsed_text: Распознанный текст

        Returns:
            float: Оценка уверенности от 0 до 1
        """
        try:
            parsed_results = response_data.get('ParsedResults', [])
            if not parsed_results:
                return 0.0

            # Проверяем код выхода парсера (1 = успех)
            exit_code = parsed_results[0].get('FileParseExitCode', 0)
            if exit_code != 1:
                return 0.3

            # Базовая уверенность для успешного распознавания
            confidence = 0.75

            # Увеличиваем за длину текста
            if len(parsed_text) > 5:
                confidence += 0.05
            if len(parsed_text) > 15:
                confidence += 0.05

            # Проверяем наличие математических символов
            math_indicators = ['=', '+', '-', '/', '^', 'x', 'y', 'z']
            for indicator in math_indicators:
                if indicator in parsed_text.lower():
                    confidence += 0.01

            # Уменьшаем если есть ошибки
            if response_data.get('IsErroredOnProcessing', False):
                confidence -= 0.3

            return min(max(confidence, 0.0), 1.0)

        except Exception:
            return 0.5


# Глобальный экземпляр сервиса
_ocr_space_service_instance = None


def get_ocr_space_service():
    """
    Получить глобальный экземпляр OCRSpaceService (singleton)
    """
    global _ocr_space_service_instance
    if _ocr_space_service_instance is None:
        _ocr_space_service_instance = OCRSpaceService()
    return _ocr_space_service_instance
