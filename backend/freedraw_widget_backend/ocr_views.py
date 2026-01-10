"""
Views для обработки OCR запросов
Обновлено для использования OCR.space API вместо Tesseract
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .ocr_space_service import get_ocr_space_service
from django.conf import settings


class LaTeXOCRView(APIView):
    """
    API endpoint для распознавания LaTeX формул из изображений
    Использует OCR.space API для более точного распознавания
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request, *args, **kwargs):
        """
        Принимает изображение и возвращает распознанную LaTeX формулу

        Expected request format:
        - multipart/form-data с полем 'image'
        или
        - JSON с полем 'image_data' (base64 encoded)

        Optional parameters:
        - language: код языка для распознавания (по умолчанию 'eng')
        """
        try:
            # Получаем сервис OCR
            ocr_service = get_ocr_space_service()
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
                'latex': '',
                'confidence': 0.0
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Получаем язык из параметров (по умолчанию английский)
        language = request.data.get('language', 'eng')

        # Проверяем, загружен ли файл
        if 'image' in request.FILES:
            image_file = request.FILES['image']

            # Проверка размера файла
            max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 10 * 1024 * 1024)  # 10MB
            if image_file.size > max_size:
                return Response({
                    'success': False,
                    'error': f'File too large. Maximum size is {max_size / (1024*1024)}MB',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

            # Проверка типа файла
            allowed_types = getattr(settings, 'ALLOWED_IMAGE_TYPES',
                                   ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/webp'])
            if image_file.content_type not in allowed_types:
                return Response({
                    'success': False,
                    'error': f'Invalid file type. Allowed types: {", ".join(allowed_types)}',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_400_BAD_REQUEST)

            # Обработка файла изображения через OCR.space
            result = ocr_service.process_image_file(image_file, language=language)

            if result['success']:
                return Response({
                    'success': True,
                    'latex': result['latex'],
                    'confidence': result['confidence'],
                    'original_text': result['original_text']
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error'],
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Проверяем base64 данные
        elif 'image_data' in request.data:
            import base64
            from io import BytesIO
            from django.core.files.uploadedfile import InMemoryUploadedFile

            try:
                # Декодируем base64
                image_data = request.data['image_data']
                if 'base64,' in image_data:
                    image_data = image_data.split('base64,')[1]

                image_bytes = base64.b64decode(image_data)

                # Создаем InMemoryUploadedFile для совместимости
                image_file = InMemoryUploadedFile(
                    BytesIO(image_bytes),
                    None,
                    'upload.png',
                    'image/png',
                    len(image_bytes),
                    None
                )

                # Обработка через OCR.space
                result = ocr_service.process_image_file(image_file, language=language)

                if result['success']:
                    return Response({
                        'success': True,
                        'latex': result['latex'],
                        'confidence': result['confidence'],
                        'original_text': result['original_text']
                    })
                else:
                    return Response({
                        'success': False,
                        'error': result['error'],
                        'latex': '',
                        'confidence': 0.0
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            except Exception as e:
                return Response({
                    'success': False,
                    'error': f'Error decoding base64 image: {str(e)}',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_400_BAD_REQUEST)

        else:
            return Response({
                'success': False,
                'error': 'No image provided. Send either "image" file or "image_data" (base64)',
                'latex': '',
                'confidence': 0.0
            }, status=status.HTTP_400_BAD_REQUEST)


class LaTeXValidateView(APIView):
    """
    API endpoint для валидации LaTeX формул
    """
    parser_classes = (JSONParser,)

    def post(self, request, *args, **kwargs):
        """
        Валидирует LaTeX формулу и проверяет ее совместимость с KaTeX
        """
        latex_formula = request.data.get('latex', '')

        if not latex_formula:
            return Response({
                'success': False,
                'error': 'No LaTeX formula provided',
                'is_valid': False
            }, status=status.HTTP_400_BAD_REQUEST)

        # Базовая валидация LaTeX синтаксиса
        validation_result = self.validate_latex(latex_formula)

        return Response({
            'success': True,
            'is_valid': validation_result['is_valid'],
            'errors': validation_result['errors'],
            'warnings': validation_result['warnings'],
            'latex': latex_formula,
            'katex_compatible': self.check_katex_compatibility(latex_formula)
        })

    def validate_latex(self, latex_formula):
        """
        Базовая валидация синтаксиса LaTeX
        """
        import re

        errors = []
        warnings = []

        # Проверка на незакрытые скобки
        bracket_pairs = [
            ('{', '}'),
            ('(', ')'),
            ('[', ']'),
        ]

        for open_bracket, close_bracket in bracket_pairs:
            if latex_formula.count(open_bracket) != latex_formula.count(close_bracket):
                errors.append(f'Непарные скобки: {open_bracket}{close_bracket}')

        # Проверка на незавершенные команды
        invalid_commands = re.findall(r'\\(?![a-zA-Z@]|\s|$)', latex_formula)
        if invalid_commands:
            warnings.append('Возможно незавершенные LaTeX команды')

        # Проверка на неэкранированные специальные символы
        special_chars = ['&', '%', '$', '#', '_', '{', '}']
        for char in special_chars:
            pattern = r'(?<!\\)' + re.escape(char)
            matches = re.findall(pattern, latex_formula)
            if matches and char not in ['{', '}', '$']:
                warnings.append(f'Неэкранированный специальный символ: {char}')

        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }

    def check_katex_compatibility(self, latex_formula):
        """
        Проверка совместимости с KaTeX
        """
        unsupported_packages = [
            '\\usepackage',
            '\\newcommand',
            '\\renewcommand',
            '\\def',
            '\\newenvironment',
        ]

        for package in unsupported_packages:
            if package in latex_formula:
                return False

        return True


class LaTeXExamplesView(APIView):
    """
    API endpoint для получения примеров LaTeX формул
    """

    def get(self, request, *args, **kwargs):
        """
        Возвращает примеры LaTeX формул для тестирования
        """
        examples = [
            {
                'name': 'Квадратное уравнение',
                'latex': '$ax^2 + bx + c = 0$',
                'description': 'Общий вид квадратного уравнения'
            },
            {
                'name': 'Формула Эйлера',
                'latex': '$e^{i\\pi} + 1 = 0$',
                'description': 'Тождество Эйлера'
            },
            {
                'name': 'Интеграл',
                'latex': '$\\int_{a}^{b} f(x) dx = F(b) - F(a)$',
                'description': 'Определенный интеграл'
            },
            {
                'name': 'Сумма ряда',
                'latex': '$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$',
                'description': 'Сумма обратных квадратов'
            },
            {
                'name': 'Дробь',
                'latex': '$\\frac{a + b}{c - d}$',
                'description': 'Простая дробь'
            },
            {
                'name': 'Корень',
                'latex': '$\\sqrt{x^2 + y^2}$',
                'description': 'Квадратный корень'
            },
            {
                'name': 'Греческие буквы',
                'latex': '$\\alpha, \\beta, \\gamma, \\delta$',
                'description': 'Греческие буквы в математике'
            },
            {
                'name': 'Предел',
                'latex': '$\\lim_{x \\to \\infty} \\frac{1}{x} = 0$',
                'description': 'Предел функции'
            },
        ]

        return Response({
            'success': True,
            'examples': examples,
            'count': len(examples)
        })


class OCRHealthCheckView(APIView):
    """
    API endpoint для проверки работоспособности OCR.space API
    """

    def get(self, request, *args, **kwargs):
        """
        Проверка конфигурации и доступности OCR.space
        """
        try:
            ocr_service = get_ocr_space_service()

            return Response({
                'success': True,
                'service': 'OCR.space API',
                'api_url': ocr_service.api_url,
                'api_key_configured': bool(ocr_service.api_key),
                'api_key_prefix': ocr_service.api_key[:8] + '...' if ocr_service.api_key else 'Not set',
                'max_upload_size_mb': getattr(settings, 'MAX_UPLOAD_SIZE', 10485760) / (1024*1024),
                'allowed_image_types': getattr(settings, 'ALLOWED_IMAGE_TYPES', [])
            })
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
                'service': 'OCR.space API',
                'api_key_configured': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
