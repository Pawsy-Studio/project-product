import os
import json
import tempfile
from io import BytesIO
from unittest.mock import patch, Mock
from PIL import Image, ImageDraw, ImageFont

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from ..ocr_space_service import OCRSpaceService, get_ocr_space_service


class OCRSpaceServiceTests(TestCase):
    def setUp(self):
        self.api_key = 'test_api_key_12345'
        self.service = OCRSpaceService(api_key=self.api_key)

    def test_service_initialization(self):
        self.assertEqual(self.service.api_key, self.api_key)
        self.assertEqual(self.service.api_url, 'https://api.ocr.space/parse/image')

    @override_settings(OCR_SPACE_API_KEY='')
    def test_service_initialization_without_api_key(self):
        with patch('freedraw_widget_backend.ocr_space_service.settings') as mock_settings:
            mock_settings.OCR_SPACE_API_KEY = ''

            with self.assertRaises(ValueError) as context:
                OCRSpaceService()

            error_msg = str(context.exception).lower()
            self.assertTrue(
                'api_key' in error_msg or 'ocr_space_api_key' in error_msg,
                f"Error should mention API key: {context.exception}"
            )

    def test_singleton_pattern(self):
        with override_settings(OCR_SPACE_API_KEY='test_key'):
            import freedraw_widget_backend.ocr_space_service as ocr_module
            ocr_module._ocr_space_service = None

            service1 = get_ocr_space_service()
            service2 = get_ocr_space_service()
            self.assertIs(service1, service2)

    def test_convert_to_latex_simple_equation(self):
        text = "x + 2 = 5"
        latex = self.service.convert_to_latex(text)
        self.assertIn('$', latex)
        self.assertIn('x', latex)
        self.assertIn('+', latex)

    def test_convert_to_latex_fraction(self):
        text = "a/b"
        latex = self.service.convert_to_latex(text)
        self.assertIn('\\frac', latex)
        self.assertIn('{a}', latex)
        self.assertIn('{b}', latex)

    def test_convert_to_latex_greek_letters(self):
        text = "α + β = γ"
        latex = self.service.convert_to_latex(text)
        self.assertIn('\\alpha', latex)
        self.assertIn('\\beta', latex)
        self.assertIn('\\gamma', latex)

    def test_convert_to_latex_power(self):
        text = "x^2"
        latex = self.service.convert_to_latex(text)
        self.assertIn('x^{2}', latex)

    def test_convert_to_latex_subscript(self):
        text = "x_1"
        latex = self.service.convert_to_latex(text)
        self.assertIn('x_{1}', latex)

    def test_convert_to_latex_square_root(self):
        text = "sqrt(x)"
        latex = self.service.convert_to_latex(text)
        self.assertIn('\\sqrt{x}', latex)

    def test_convert_to_latex_math_symbols(self):
        test_cases = [
            ('×', '\\times'),
            ('÷', '\\div'),
            ('≤', '\\leq'),
            ('≥', '\\geq'),
            ('≠', '\\neq'),
            ('∞', '\\infty'),
            ('∑', '\\sum'),
            ('∫', '\\int'),
        ]

        for symbol, expected_latex in test_cases:
            latex = self.service.convert_to_latex(symbol)
            self.assertIn(expected_latex, latex,
                          f"Symbol {symbol} should convert to {expected_latex}")

    def test_convert_to_latex_empty_string(self):
        latex = self.service.convert_to_latex("")
        self.assertEqual(latex, "")

    def test_convert_to_latex_adds_math_mode(self):
        text = "x = 5"
        latex = self.service.convert_to_latex(text)
        self.assertTrue(latex.startswith('$'))
        self.assertTrue(latex.endswith('$'))

    def test_calculate_confidence_no_results(self):
        response_data = {'ParsedResults': []}
        confidence = self.service._calculate_confidence(response_data, "")
        self.assertEqual(confidence, 0.0)

    def test_calculate_confidence_successful_parsing(self):
        response_data = {
            'ParsedResults': [{'FileParseExitCode': 1}],
            'IsErroredOnProcessing': False
        }
        confidence = self.service._calculate_confidence(response_data, "x + 2 = 5")
        self.assertGreater(confidence, 0.5)
        self.assertLessEqual(confidence, 1.0)

    def test_calculate_confidence_with_error(self):
        response_data = {
            'ParsedResults': [{'FileParseExitCode': 0}],
            'IsErroredOnProcessing': True
        }
        confidence = self.service._calculate_confidence(response_data, "test")
        self.assertLess(confidence, 0.5)

    @patch('requests.post')
    def test_process_image_file_success(self, mock_post):
        image = self._create_test_image("x + 2")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'x + 2',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        result = self.service.process_image_file(image)

        self.assertTrue(result['success'])
        self.assertIn('latex', result)
        self.assertIn('original_text', result)
        self.assertIn('x', result['original_text'])
        self.assertGreater(result['confidence'], 0)

    @patch('requests.post')
    def test_process_image_file_api_error(self, mock_post):
        image = self._create_test_image("test")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [],
            'IsErroredOnProcessing': True,
            'ErrorMessage': ['API Error']
        }
        mock_post.return_value = mock_response

        result = self.service.process_image_file(image)

        self.assertFalse(result['success'])
        self.assertIn('error', result)
        self.assertEqual(result['confidence'], 0.0)

    @patch('requests.post')
    def test_process_image_file_timeout(self, mock_post):
        import requests

        image = self._create_test_image("test")
        mock_post.side_effect = requests.exceptions.Timeout()

        result = self.service.process_image_file(image)

        self.assertFalse(result['success'])
        self.assertIn('timeout', result['error'].lower())

    @patch('requests.post')
    def test_process_image_file_no_text_recognized(self, mock_post):
        image = self._create_test_image("")

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        result = self.service.process_image_file(image)

        self.assertFalse(result['success'])
        self.assertIn('No text recognized', result['error'])

    def _create_test_image(self, text="Test"):
        img = Image.new('RGB', (200, 100), color='white')
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
        except:
            font = ImageFont.load_default()

        draw.text((10, 30), text, fill='black', font=font)
        img_io = BytesIO()
        img.save(img_io, format='PNG')
        img_io.seek(0)

        return InMemoryUploadedFile(
            img_io,
            None,
            'test.png',
            'image/png',
            img_io.getbuffer().nbytes,
            None
        )


class OCRAPITests(APITestCase):

    def setUp(self):
        self.client = APIClient()
        self.ocr_url = '/api/ocr/recognize/'
        self.validate_url = '/api/ocr/validate/'
        self.examples_url = '/api/ocr/examples/'
        self.health_url = '/api/ocr/health/'

        self._reset_singletons()

    def tearDown(self):
        self._reset_singletons()

    def _reset_singletons(self):
        try:
            import freedraw_widget_backend.parallel_ocr_service as parallel_module
            parallel_module._parallel_ocr_service = None
        except (ImportError, AttributeError):
            pass

        try:
            import freedraw_widget_backend.ocr_space_service as ocr_space_module
            ocr_space_module._ocr_space_service = None
        except (ImportError, AttributeError):
            pass

    def _create_test_image(self, text="x + 2 = 5"):
        img = Image.new('RGB', (300, 100), color='white')
        draw = ImageDraw.Draw(img)

        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
        except:
            font = ImageFont.load_default()

        draw.text((20, 20), text, fill='black', font=font)

        img_io = BytesIO()
        img.save(img_io, format='PNG')
        img_io.seek(0)
        img_io.name = 'test.png'

        return img_io

    @override_settings(OCR_SPACE_API_KEY='test_key_12345')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_ocr_recognize_with_file(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'x + 2 = 5',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        image = self._create_test_image()

        response = self.client.post(
            self.ocr_url,
            {'image': image},
            format='multipart'
        )

        if response.status_code != status.HTTP_200_OK:
            print(f"Response status: {response.status_code}")
            print(f"Response content: {response.content}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('latex', response.data)
        self.assertIn('confidence', response.data)
        self.assertIn('original_text', response.data)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_ocr_recognize_with_api_key(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'x + 2 = 5',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        image = self._create_test_image()
        response = self.client.post(
            self.ocr_url,
            {'image': image},
            format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('latex', response.data)

    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    def test_ocr_recognize_only_tesseract(self, mock_tesseract_class, mock_ocr_space):
        mock_ocr_space.side_effect = ValueError("No API key")

        mock_tesseract = Mock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$x + 2$',
            'confidence': 0.7,
            'original_text': 'x + 2'
        }
        mock_tesseract_class.return_value = mock_tesseract

        image = self._create_test_image()
        response = self.client.post(
            self.ocr_url,
            {'image': image},
            format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['provider'], 'Tesseract')

    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    def test_ocr_recognize_no_services_available(self, mock_tesseract_class, mock_ocr_space):
        mock_ocr_space.side_effect = ValueError("No API key")
        mock_tesseract_class.side_effect = Exception("Tesseract not installed")

        image = self._create_test_image()
        response = self.client.post(
            self.ocr_url,
            {'image': image},
            format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertFalse(response.data['success'])
        self.assertIn('error', response.data)

    def test_ocr_recognize_no_image(self):
        response = self.client.post(self.ocr_url, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('No image provided', response.data['error'])

    @override_settings(
        OCR_SPACE_API_KEY='test_key',
        MAX_UPLOAD_SIZE=100 
    )
    def test_ocr_recognize_file_too_large(self):
        large_img = Image.new('RGB', (500, 500), color='white')
        img_io = BytesIO()
        large_img.save(img_io, format='PNG')
        img_io.seek(0)
        img_io.name = 'large.png'

        file_size = len(img_io.getvalue())
        self.assertGreater(file_size, 100)

        response = self.client.post(
            self.ocr_url,
            {'image': img_io},
            format='multipart'
        )

        self.assertIn(response.status_code, [
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            status.HTTP_400_BAD_REQUEST
        ])
        if hasattr(response, 'data'):
            self.assertFalse(response.data['success'])

    @override_settings(
        OCR_SPACE_API_KEY='test_key',
        ALLOWED_IMAGE_TYPES=['image/png', 'image/jpeg']
    )
    def test_ocr_recognize_invalid_file_type(self):
        text_file = BytesIO(b'This is not an image')
        text_file.name = 'test.txt'
        text_file.content_type = 'text/plain'

        from django.core.files.uploadedfile import SimpleUploadedFile
        uploaded_file = SimpleUploadedFile(
            "test.txt",
            b"This is not an image",
            content_type="text/plain"
        )

        response = self.client.post(
            self.ocr_url,
            {'image': uploaded_file},
            format='multipart'
        )

        self.assertIn(response.status_code, [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        ])

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_ocr_recognize_with_base64(self, mock_post):
        import base64

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'a + b',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        image = self._create_test_image("a + b")
        image_base64 = base64.b64encode(image.read()).decode('utf-8')

        response = self.client.post(
            self.ocr_url,
            {'image_data': f'data:image/png;base64,{image_base64}'},
            format='json'
        )

        if response.status_code != status.HTTP_200_OK:
            print(f"Base64 response status: {response.status_code}")
            print(f"Base64 response content: {response.content}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_validate_latex_valid_formula(self):
        response = self.client.post(
            self.validate_url,
            {'latex': '$x^2 + 2x + 1 = 0$'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertTrue(response.data['is_valid'])

    def test_validate_latex_unbalanced_brackets(self):
        response = self.client.post(
            self.validate_url,
            {'latex': '$\\frac{a + b}{c$'}, 
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_valid'])
        self.assertTrue(len(response.data['errors']) > 0)

    def test_validate_latex_no_formula(self):
        response = self.client.post(
            self.validate_url,
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_validate_latex_katex_incompatible(self):
        response = self.client.post(
            self.validate_url,
            {'latex': '\\usepackage{amsmath}'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['katex_compatible'])

    def test_get_examples(self):
        response = self.client.get(self.examples_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('examples', response.data)
        self.assertGreater(len(response.data['examples']), 0)

        example = response.data['examples'][0]
        self.assertIn('name', example)
        self.assertIn('latex', example)
        self.assertIn('description', example)

    @override_settings(OCR_SPACE_API_KEY='test_key_12345')
    def test_health_check_with_api_key(self):
        response = self.client.get(self.health_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['mode'], 'parallel')
        self.assertIn('services', response.data)

    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_health_check_ocr_space_unavailable(self, mock_get_service):
        mock_get_service.side_effect = ValueError("API key not configured")

        response = self.client.get(self.health_url)

        self.assertIn(response.status_code, [
            status.HTTP_200_OK,
            status.HTTP_500_INTERNAL_SERVER_ERROR
        ])

        if response.status_code == status.HTTP_200_OK:
            self.assertTrue(response.data['success'])
            services = response.data['services']
            self.assertFalse(services['ocr_space']['available'])

    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    def test_health_check_all_services_unavailable(self, mock_tesseract, mock_ocr_space):
        mock_ocr_space.side_effect = ValueError("No API key")
        mock_tesseract.side_effect = Exception("Tesseract not installed")

        response = self.client.get(self.health_url)

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)


class OCRIntegrationTests(APITestCase):
    def setUp(self):
        self._reset_singletons()

    def tearDown(self):
        self._reset_singletons()

    def _reset_singletons(self):
        try:
            import freedraw_widget_backend.parallel_ocr_service as parallel_module
            parallel_module._parallel_ocr_service = None
        except (ImportError, AttributeError):
            pass

        try:
            import freedraw_widget_backend.ocr_space_service as ocr_space_module
            ocr_space_module._ocr_space_service = None
        except (ImportError, AttributeError):
            pass

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_full_ocr_workflow(self, mock_post):
        health_response = self.client.get('/api/ocr/health/')

        if health_response.status_code != 200:
            print(f"Health check failed with status: {health_response.status_code}")
            print(f"Content: {health_response.content}")

        self.assertEqual(health_response.status_code, status.HTTP_200_OK)
        self.assertTrue(health_response.data['success'])

        examples_response = self.client.get('/api/ocr/examples/')
        self.assertEqual(examples_response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(examples_response.data['examples']), 0)

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'x^2 + 2x + 1',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        img = Image.new('RGB', (200, 100), color='white')
        img_io = BytesIO()
        img.save(img_io, format='PNG')
        img_io.seek(0)
        img_io.name = 'test.png'

        ocr_response = self.client.post(
            '/api/ocr/recognize/',
            {'image': img_io},
            format='multipart'
        )

        if ocr_response.status_code != status.HTTP_200_OK:
            print(f"OCR failed with status: {ocr_response.status_code}")
            print(f"Content: {ocr_response.content}")

        self.assertEqual(ocr_response.status_code, status.HTTP_200_OK)
        self.assertTrue(ocr_response.data['success'])
        latex_formula = ocr_response.data['latex']

        validate_response = self.client.post(
            '/api/ocr/validate/',
            {'latex': latex_formula},
            format='json'
        )

        self.assertEqual(validate_response.status_code, status.HTTP_200_OK)
        self.assertTrue(validate_response.data['success'])


class OCRServiceConfigurationTests(TestCase):
    """
    Тесты конфигурации OCR сервисов
    """

    @override_settings(OCR_SPACE_API_KEY='')
    def test_missing_api_key_raises_error(self):
        with patch('freedraw_widget_backend.ocr_space_service.settings') as mock_settings:
            mock_settings.OCR_SPACE_API_KEY = ''

            with self.assertRaises(ValueError) as context:
                OCRSpaceService()

            error_msg = str(context.exception).lower()
            self.assertTrue(
                'api_key' in error_msg or 'required' in error_msg,
                "Error should mention API key requirement"
            )

    @override_settings(
        OCR_SPACE_API_KEY='test_key',
        MAX_UPLOAD_SIZE=5 * 1024 * 1024
    )
    def test_upload_size_configuration(self):
        from django.conf import settings
        self.assertEqual(settings.MAX_UPLOAD_SIZE, 5 * 1024 * 1024)

    @override_settings(
        OCR_SPACE_API_KEY='test_key',
        ALLOWED_IMAGE_TYPES=['image/png', 'image/jpeg']
    )
    def test_allowed_types_configuration(self):
        from django.conf import settings
        self.assertIn('image/png', settings.ALLOWED_IMAGE_TYPES)
        self.assertIn('image/jpeg', settings.ALLOWED_IMAGE_TYPES)


class OCREdgeCasesTests(TestCase):

    @override_settings(OCR_SPACE_API_KEY='test_key')
    def test_convert_empty_text(self):
        service = OCRSpaceService(api_key='test_key')
        result = service.convert_to_latex('')
        self.assertEqual(result, '')

    @override_settings(OCR_SPACE_API_KEY='test_key')
    def test_convert_whitespace_only(self):
        service = OCRSpaceService(api_key='test_key')
        result = service.convert_to_latex('   ')
        self.assertIn(result, ['', '$  $', '$ $'])

    @override_settings(OCR_SPACE_API_KEY='test_key')
    def test_convert_special_characters(self):
        service = OCRSpaceService(api_key='test_key')

        test_cases = {
            '∑': '\\sum',
            '∫': '\\int',
            '∞': '\\infty',
            '≠': '\\neq',
            '≤': '\\leq',
            '≥': '\\geq',
            'α': '\\alpha',
            'β': '\\beta',
            'π': '\\pi',
        }

        for char, expected in test_cases.items():
            result = service.convert_to_latex(char)
            self.assertIn(expected, result, f"Failed for {char}")

    @override_settings(OCR_SPACE_API_KEY='test_key')
    def test_convert_nested_fractions(self):
        service = OCRSpaceService(api_key='test_key')
        text = "a/(b/c)"
        result = service.convert_to_latex(text)
        self.assertIn('\\frac', result)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    def test_convert_complex_formula(self):
        service = OCRSpaceService(api_key='test_key')
        text = "∫(x^2 + 2x + 1)dx"
        result = service.convert_to_latex(text)

        self.assertIn('\\int', result)
        self.assertIn('^', result)
        self.assertIn('+', result)


class OCRPerformanceTests(APITestCase):
    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_concurrent_requests(self, mock_post):
        import concurrent.futures

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'x + 1',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response

        def make_request():
            img = Image.new('RGB', (100, 50), color='white')
            img_io = BytesIO()
            img.save(img_io, format='PNG')
            img_io.seek(0)
            img_io.name = 'test.png'

            return self.client.post(
                '/api/ocr/recognize/',
                {'image': img_io},
                format='multipart'
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        for response in results:
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_space_service.requests.post')
    def test_large_image_processing(self, mock_post):
        """Тест обработки большого изображения"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'ParsedResults': [{
                'ParsedText': 'test',
                'FileParseExitCode': 1
            }],
            'IsErroredOnProcessing': False
        }
        mock_post.return_value = mock_response
        large_img = Image.new('RGB', (2000, 2000), color='white')
        img_io = BytesIO()
        large_img.save(img_io, format='PNG')
        img_io.seek(0)
        img_io.name = 'large.png'

        with override_settings(MAX_UPLOAD_SIZE=50 * 1024 * 1024):
            response = self.client.post(
                '/api/ocr/recognize/',
                {'image': img_io},
                format='multipart'
            )

        self.assertIn(response.status_code, [
            status.HTTP_200_OK,
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        ])
