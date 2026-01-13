from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .parallel_ocr_service import get_parallel_ocr_service
from django.conf import settings
import base64
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile


class LaTeXOCRView(APIView):
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request, *args, **kwargs):
        try:
            ocr_service = get_parallel_ocr_service()
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e),
                'latex': '',
                'confidence': 0.0
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        language = request.data.get('language', 'eng')

        if 'image' in request.FILES:
            image_file = request.FILES['image']

            max_size = getattr(settings, 'MAX_UPLOAD_SIZE', 10 * 1024 * 1024)
            if image_file.size > max_size:
                return Response({
                    'success': False,
                    'error': f'File too large. Max {max_size/(1024*1024):.1f}MB',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

            allowed = getattr(settings, 'ALLOWED_IMAGE_TYPES',
                            ['image/png', 'image/jpeg', 'image/jpg'])
            if image_file.content_type not in allowed:
                return Response({
                    'success': False,
                    'error': f'Invalid type. Allowed: {", ".join(allowed)}',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_400_BAD_REQUEST)

            result = ocr_service.process_image_file(image_file, language)

            if result['success']:
                return Response({
                    'success': True,
                    'latex': result['latex'],
                    'confidence': result['confidence'],
                    'original_text': result.get('original_text', ''),
                    'provider': result.get('provider', 'unknown'),
                    'providers_used': result.get('providers_used', 0),
                    'all_results': result.get('all_results', [])
                })
            else:
                return Response({
                    'success': False,
                    'error': result['error'],
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        elif 'image_data' in request.data:
            try:
                image_data = request.data['image_data']
                if 'base64,' in image_data:
                    image_data = image_data.split('base64,')[1]

                image_bytes = base64.b64decode(image_data)
                image_file = InMemoryUploadedFile(
                    BytesIO(image_bytes),
                    None,
                    'upload.png',
                    'image/png',
                    len(image_bytes),
                    None
                )

                result = ocr_service.process_image_file(image_file, language)

                if result['success']:
                    return Response({
                        'success': True,
                        'latex': result['latex'],
                        'confidence': result['confidence'],
                        'original_text': result.get('original_text', ''),
                        'provider': result.get('provider', 'unknown'),
                        'providers_used': result.get('providers_used', 0),
                        'all_results': result.get('all_results', [])
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
                    'error': f'Error decoding base64: {str(e)}',
                    'latex': '',
                    'confidence': 0.0
                }, status=status.HTTP_400_BAD_REQUEST)

        else:
            return Response({
                'success': False,
                'error': 'No image provided',
                'latex': '',
                'confidence': 0.0
            }, status=status.HTTP_400_BAD_REQUEST)


class LaTeXValidateView(APIView):
    parser_classes = (JSONParser,)

    def post(self, request, *args, **kwargs):
        import re

        latex = request.data.get('latex', '')
        if not latex:
            return Response({
                'success': False,
                'error': 'No LaTeX formula provided',
                'is_valid': False
            }, status=status.HTTP_400_BAD_REQUEST)

        errors = []
        warnings = []

        pairs = [('{', '}'), ('(', ')'), ('[', ']')]
        for o, c in pairs:
            if latex.count(o) != latex.count(c):
                errors.append(f'Unbalanced: {o}{c}')

        if re.findall(r'\\(?![a-zA-Z@]|\s|$)', latex):
            warnings.append('Possibly incomplete commands')

        unsupported = ['\\usepackage', '\\newcommand', '\\def']
        katex_ok = not any(u in latex for u in unsupported)

        return Response({
            'success': True,
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'latex': latex,
            'katex_compatible': katex_ok
        })


class LaTeXExamplesView(APIView):
    def get(self, request, *args, **kwargs):
        examples = [
            {
                'name': 'Quadratic Equation',
                'latex': '$ax^2 + bx + c = 0$',
                'description': 'Standard form of a quadratic equation'
            },
            {
                'name': "Euler's Identity",
                'latex': '$e^{i\\pi} + 1 = 0$',
                'description': "Euler's famous mathematical identity"
            },
            {
                'name': 'Definite Integral',
                'latex': '$\\int_{a}^{b} f(x)dx = F(b) - F(a)$',
                'description': 'Fundamental theorem of calculus'
            },
            {
                'name': 'Infinite Series',
                'latex': '$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$',
                'description': 'Basel problem solution'
            },
            {
                'name': 'Fraction',
                'latex': '$\\frac{a+b}{c-d}$',
                'description': 'Simple algebraic fraction'
            },
            {
                'name': 'Square Root',
                'latex': '$\\sqrt{x^2+y^2}$',
                'description': 'Pythagorean distance formula'
            },
            {
                'name': 'Greek Letters',
                'latex': '$\\alpha, \\beta, \\gamma, \\delta$',
                'description': 'Common Greek letters in mathematics'
            },
            {
                'name': 'Limit',
                'latex': '$\\lim_{x \\to \\infty} \\frac{1}{x} = 0$',
                'description': 'Limit at infinity'
            },
        ]

        return Response({
            'success': True,
            'examples': examples,
            'count': len(examples)
        })


class OCRHealthCheckView(APIView):
    def get(self, request, *args, **kwargs):
        try:
            ocr = get_parallel_ocr_service()
            status_info = ocr.get_status()

            return Response({
                'success': True,
                'mode': 'parallel',
                'services': status_info,
                'settings': {
                    'max_size_mb': getattr(settings, 'MAX_UPLOAD_SIZE', 10485760) / (1024*1024),
                    'allowed_types': getattr(settings, 'ALLOWED_IMAGE_TYPES', [])
                }
            })
        except ValueError as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
