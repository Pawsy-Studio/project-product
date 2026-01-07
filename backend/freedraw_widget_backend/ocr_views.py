"""
Views для обработки OCR запросов
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .ocr_service import latex_ocr_service

class LaTeXOCRView(APIView):
    """
    API endpoint для распознавания LaTeX формул из изображений
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def post(self, request, *args, **kwargs):
        """
        Принимает изображение и возвращает распознанную LaTeX формулу
        
        Expected request format:
        - multipart/form-data с полем 'image'
        или
        - JSON с полем 'image_data' (base64 encoded)
        """
        # Проверяем, загружен ли файл
        if 'image' in request.FILES:
            image_file = request.FILES['image']
            
            # Обработка файла изображения
            result = latex_ocr_service.process_image_file(image_file)
            
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
            
            try:
                # Декодируем base64
                image_data = request.data['image_data']
                if 'base64,' in image_data:
                    image_data = image_data.split('base64,')[1]
                
                image_bytes = base64.b64decode(image_data)
                
                # Создаем временный файл
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_file:
                    tmp_file.write(image_bytes)
                    tmp_path = tmp_file.name
                
                # Используем PIL для открытия изображения
                from PIL import Image
                import numpy as np
                
                pil_image = Image.open(BytesIO(image_bytes))
                image_array = np.array(pil_image.convert('RGB'))
                
                # Предобработка
                processed_image = latex_ocr_service.preprocess_image(image_array)
                
                # Распознавание
                recognized_text = latex_ocr_service.image_to_text(processed_image)
                
                # Конвертация в LaTeX
                latex_formula = latex_ocr_service.convert_to_latex(recognized_text)
                
                # Очистка
                import os
                os.unlink(tmp_path)
                
                return Response({
                    'success': True,
                    'latex': latex_formula,
                    'confidence': latex_ocr_service.estimate_confidence(recognized_text, latex_formula),
                    'original_text': recognized_text
                })
                
            except Exception as e:
                return Response({
                    'success': False,
                    'error': str(e),
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
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
        import re
        # Ищем обратный слеш, за которым нет буквы или другой команды
        invalid_commands = re.findall(r'\\(?![a-zA-Z@]|\s|$)', latex_formula)
        if invalid_commands:
            warnings.append('Возможно незавершенные LaTeX команды')
        
        # Проверка на неэкранированные специальные символы
        special_chars = ['&', '%', '$', '#', '_', '{', '}']
        for char in special_chars:
            # Ищем символы, которые не экранированы обратным слешом
            pattern = r'(?<!\\)' + re.escape(char)
            matches = re.findall(pattern, latex_formula)
            if matches and char not in ['{', '}', '$']:  # Скобки и $ могут быть парными
                warnings.append(f'Неэкранированный специальный символ: {char}')
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def check_katex_compatibility(self, latex_formula):
        """
        Проверка совместимости с KaTeX
        
        Note: Это базовая проверка, так как полная проверка требует запуска KaTeX
        """
        # KaTeX не поддерживает некоторые пакеты LaTeX
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
        
        # KaTeX имеет ограниченную поддержку некоторых команд
        # Здесь можно добавить более детальную проверку
        
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
        ]
        
        return Response({
            'success': True,
            'examples': examples,
            'count': len(examples)
        })