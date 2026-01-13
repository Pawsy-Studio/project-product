import logging

import requests
import tempfile
import os
import re
from django.conf import settings


class OCRSpaceService:
    def __init__(self, api_key: str = None):
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
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
                for chunk in image_file.chunks():
                    tmp_file.write(chunk)
                tmp_path = tmp_file.name
            with open(tmp_path, 'rb') as f:
                result = requests.post(
                    self.api_url,
                    files={'file': f},
                    data={
                        'apikey': self.api_key,
                        'language': language,
                        'OCREngine': 2, 
                        'detectOrientation': str(detect_orientation).lower(),
                        'scale': True,
                        'isTable': False,
                        'filetype': 'PNG',
                    },
                    timeout=30
                )

            os.unlink(tmp_path)

            if result.status_code == 200:
                response_data = result.json()

                if response_data.get('IsErroredOnProcessing', False):
                    error_messages = response_data.get('ErrorMessage', ['Unknown error'])
                    return {
                        'success': False,
                        'error': error_messages[0] if error_messages else 'Unknown error',
                        'latex': '',
                        'original_text': '',
                        'confidence': 0.0
                    }

                parsed_results = response_data.get('ParsedResults', [])
                if parsed_results:
                    parsed_text = parsed_results[0].get('ParsedText', '')

                    latex_formula = self.convert_to_latex(parsed_text)

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
        if not text:
            return ""

        text = ' '.join(text.split())

        symbol_replacements = {
            'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
            'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
            'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
            'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
            'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi',
            'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',

            'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
            'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi',
            'Ψ': '\\Psi', 'Ω': '\\Omega',

            '×': '\\times', '÷': '\\div', '±': '\\pm', '∓': '\\mp',
            '⋅': '\\cdot', '∗': '\\ast', '∘': '\\circ', '∙': '\\bullet',

            '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
            '≡': '\\equiv', '≅': '\\cong', '∼': '\\sim', '∝': '\\propto',
            '≪': '\\ll', '≫': '\\gg', '∈': '\\in', '∉': '\\notin',
            '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq', '⊇': '\\supseteq',

            '→': '\\rightarrow', '←': '\\leftarrow', '↔': '\\leftrightarrow',
            '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow',
            '↑': '\\uparrow', '↓': '\\downarrow',

            '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
            '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint',
            '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod',
            '√': '\\sqrt', '∠': '\\angle', '⊥': '\\perp', '∥': '\\parallel',
            '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset',
        }

        for symbol, latex in symbol_replacements.items():
            text = text.replace(symbol, f' {latex} ')

        def replace_fraction(match):
            numerator = match.group(1)
            denominator = match.group(2)
            return f'\\frac{{{numerator}}}{{{denominator}}}'

        text = re.sub(r'(\d+|[a-zA-Z])\s*/\s*(\d+|[a-zA-Z])', replace_fraction, text)

        text = re.sub(r'(\w+)\^(\d+)', r'\1^{\2}', text)
        text = re.sub(r'(\w+)\^\(([^)]+)\)', r'\1^{\2}', text)

        text = re.sub(r'(\w+)_(\d+)', r'\1_{\2}', text)
        text = re.sub(r'(\w+)_\(([^)]+)\)', r'\1_{\2}', text)

        text = re.sub(r'sqrt\s*\(([^)]+)\)', r'\\sqrt{\1}', text, flags=re.IGNORECASE)

        text = re.sub(r'sum_(\w+)\^(\w+)', r'\\sum_{\1}^{\2}', text, flags=re.IGNORECASE)
        text = re.sub(r'int_(\w+)\^(\w+)', r'\\int_{\1}^{\2}', text, flags=re.IGNORECASE)

        text = re.sub(r'lim\s*_\s*(\w+)\s*->\s*(\w+)', r'\\lim_{\1 \\to \2}', text, flags=re.IGNORECASE)

        text = re.sub(r'\s+', ' ', text).strip()

        if text and not (text.startswith('$') and text.endswith('$')):
            text = f'${text}$'

        return text

    def _calculate_confidence(self, response_data, parsed_text):
        try:
            parsed_results = response_data.get('ParsedResults', [])
            if not parsed_results:
                return 0.0

            exit_code = parsed_results[0].get('FileParseExitCode', 0)
            if exit_code != 1:
                return 0.3

            confidence = 0.75

            if len(parsed_text) > 5:
                confidence += 0.05
            if len(parsed_text) > 15:
                confidence += 0.05

            math_indicators = ['=', '+', '-', '/', '^', 'x', 'y', 'z']
            for indicator in math_indicators:
                if indicator in parsed_text.lower():
                    confidence += 0.01

            if response_data.get('IsErroredOnProcessing', False):
                confidence -= 0.3

            return min(max(confidence, 0.0), 1.0)

        except Exception:
            return 0.5


_ocr_space_service_instance = None


def get_ocr_space_service():
    global _ocr_space_service_instance
    if _ocr_space_service_instance is None:
        _ocr_space_service_instance = OCRSpaceService()
    return _ocr_space_service_instance
