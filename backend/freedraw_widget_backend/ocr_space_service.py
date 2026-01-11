"""
Сервис для распознавания текста через OCR.space API
Заменяет Tesseract OCR для более качественного распознавания
"""
import logging

import requests
import tempfile
import os
import re
from collections import Counter
from django.conf import settings


class OCRSpaceService:
    """
    Сервис для работы с OCR.space API
    Документация: https://ocr.space/OCRAPI
    """

    def __init__(self, api_key: str = None):
        """
        Инициализация OCR.space сервиса
        """
        # Если ключ не передан, берем из settings
        if api_key is None:
            api_key = getattr(settings, 'OCR_SPACE_API_KEY', '')

        # ВАЖНО: Проверяем что ключ не пустой
        if not api_key or not api_key.strip():
            raise ValueError(
                "OCR_SPACE_API_KEY is required. "
                "Set OCR_SPACE_API_KEY in settings.py or pass api_key parameter"
            )

        self.api_key = api_key.strip()
        self.api_url = 'https://api.ocr.space/parse/image'
        self.logger = logging.getLogger(__name__)

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

                    # Рассчитываем уверенность (УЛУЧШЕННАЯ ВЕРСИЯ)
                    confidence = self._calculate_confidence(response_data, parsed_text, latex_formula)

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

    def _calculate_confidence(self, response_data, parsed_text, latex_formula):
        """
        УЛУЧШЕННЫЙ расчет уверенности на основе реальных данных API и качества результата

        Args:
            response_data: Ответ от OCR.space API
            parsed_text: Распознанный текст
            latex_formula: Сконвертированная LaTeX формула

        Returns:
            float: Оценка уверенности от 0 до 1
        """
        try:
            parsed_results = response_data.get('ParsedResults', [])
            if not parsed_results:
                return 0.0

            result = parsed_results[0]

            # 1. КРИТИЧНО: Проверка кода выхода парсера (1 = успех)
            exit_code = result.get('FileParseExitCode', 0)
            if exit_code != 1:
                self.logger.warning(f"OCR.space exit code: {exit_code} (not success)")
                return 0.2  # Низкая уверенность для неуспешных результатов

            # 2. Проверка на ошибки обработки
            if response_data.get('IsErroredOnProcessing', False):
                self.logger.warning("OCR.space processing error")
                return 0.15

            # 3. Базовая уверенность для успешного распознавания
            # СНИЖЕНО с 0.75 до 0.55
            base_confidence = 0.55

            # 4. Оценка качества текста (до +0.20)
            text_quality_bonus = 0.0

            text_stripped = parsed_text.strip()
            text_len = len(text_stripped)

            if text_len == 0:
                return 0.0
            elif text_len < 2:
                text_quality_bonus += 0.02  # Очень короткий текст
            elif text_len < 5:
                text_quality_bonus += 0.08
            elif text_len < 15:
                text_quality_bonus += 0.15
            else:
                text_quality_bonus += 0.20  # Длинный текст более надежен

            # 5. Оценка математической структуры (до +0.20)
            math_structure_bonus = 0.0

            # LaTeX команды (более ценные индикаторы)
            latex_commands = [
                '\\frac', '\\sqrt', '\\sum', '\\int', '\\lim',
                '\\alpha', '\\beta', '\\gamma', '\\delta', '\\pi', '\\theta',
                '\\Sigma', '\\Delta', '\\Omega',
                '\\times', '\\div', '\\cdot', '\\pm',
                '\\leq', '\\geq', '\\neq', '\\approx',
                '\\rightarrow', '\\leftarrow', '\\infty'
            ]
            latex_count = sum(1 for cmd in latex_commands if cmd in latex_formula)
            math_structure_bonus += min(latex_count * 0.04, 0.15)

            # Базовые математические символы
            math_symbols = ['=', '+', '-', '×', '÷', '^', '_', '(', ')']
            symbol_count = sum(1 for sym in math_symbols if sym in parsed_text)
            math_structure_bonus += min(symbol_count * 0.01, 0.05)

            # 6. ШТРАФЫ за подозрительные паттерны (до -0.30)
            penalty = 0.0

            # Штраф за повторяющиеся символы (признак ошибки распознавания)
            if text_len > 0:
                char_counts = Counter(text_stripped.replace(' ', ''))
                if char_counts:
                    max_char_freq = max(char_counts.values()) / max(len(text_stripped.replace(' ', '')), 1)
                    if max_char_freq > 0.6:  # Более 60% один символ
                        penalty += 0.25
                        self.logger.warning(f"High character repetition: {max_char_freq:.2f}")
                    elif max_char_freq > 0.4:  # Более 40% один символ
                        penalty += 0.15

            # Штраф за много нераспознанных/шумовых символов
            noise_chars = ['?', '#', '@', '&', '~', '`', '|']
            noise_count = sum(parsed_text.count(c) for c in noise_chars)
            if noise_count > 3:
                penalty += 0.20
                self.logger.warning(f"High noise character count: {noise_count}")
            elif noise_count > 1:
                penalty += 0.10

            # Штраф за слишком много пробелов (может быть признаком плохого распознавания)
            space_ratio = parsed_text.count(' ') / max(text_len, 1)
            if space_ratio > 0.5:  # Более 50% - пробелы
                penalty += 0.10

            # 7. ИТОГОВАЯ УВЕРЕННОСТЬ
            confidence = base_confidence + text_quality_bonus + math_structure_bonus - penalty

            # Ограничиваем диапазон [0.0, 0.95]
            # Максимум 0.95, а не 1.0, чтобы оставить место для идеальных результатов
            final_confidence = min(max(confidence, 0.0), 0.95)

            self.logger.info(
                f"OCR.space confidence: {final_confidence:.3f} "
                f"(base={base_confidence:.2f}, text_quality=+{text_quality_bonus:.2f}, "
                f"math=+{math_structure_bonus:.2f}, penalty=-{penalty:.2f})"
            )

            return final_confidence

        except Exception as e:
            self.logger.error(f"Error calculating confidence: {e}")
            return 0.3  # Уверенность по умолчанию при ошибке


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
