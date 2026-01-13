import os
from io import BytesIO
from unittest.mock import patch, Mock, MagicMock
from PIL import Image, ImageDraw, ImageFont

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status


class ParallelOCRServiceTests(TestCase):

    @override_settings(OCR_SPACE_API_KEY='test_key_12345')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_service_initialization_both_services(self, mock_ocr_space, mock_tesseract):
        """Тест инициализации с обоими сервисами"""
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space.return_value = MagicMock()
        mock_tesseract.return_value = MagicMock()

        service = ParallelOCRService()

        self.assertIsNotNone(service.ocr_space_service)
        self.assertIsNotNone(service.tesseract_service)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_service_initialization_only_ocr_space(self, mock_ocr_space, mock_tesseract):
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space.return_value = MagicMock()
        mock_tesseract.side_effect = Exception("Tesseract not available")

        service = ParallelOCRService()

        self.assertIsNotNone(service.ocr_space_service)
        self.assertIsNone(service.tesseract_service)

    @override_settings(OCR_SPACE_API_KEY='')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_service_initialization_only_tesseract(self, mock_ocr_space, mock_tesseract):
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space.side_effect = ValueError("API key not configured")
        mock_tesseract.return_value = MagicMock()

        service = ParallelOCRService()

        self.assertIsNone(service.ocr_space_service)
        self.assertIsNotNone(service.tesseract_service)

    @override_settings(OCR_SPACE_API_KEY='')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_service_initialization_no_services(self, mock_ocr_space, mock_tesseract):
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space.side_effect = ValueError("No API key")
        mock_tesseract.side_effect = Exception("Tesseract not installed")

        with self.assertRaises(ValueError) as context:
            ParallelOCRService()

        self.assertIn('No OCR services available', str(context.exception))

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_parallel_processing_both_succeed(self, mock_ocr_space_getter, mock_tesseract_class):
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.return_value = {
            'success': True,
            'latex': '$x^2 + 1$',
            'confidence': 0.85,
            'original_text': 'x^2 + 1'
        }
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$x^{2} + 1$',
            'confidence': 0.70,
            'original_text': 'x^ 2 + 1'
        }
        mock_tesseract_class.return_value = mock_tesseract

        service = ParallelOCRService()
        image = self._create_test_image()
        result = service.process_image_file(image)

        self.assertTrue(result['success'])
        self.assertEqual(result['provider'], 'OCR.space')
        self.assertEqual(result['providers_used'], 2)
        self.assertEqual(len(result['all_results']), 2)
        self.assertGreaterEqual(result['confidence'], 0.85)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_parallel_processing_ocr_space_fails(self, mock_ocr_space_getter, mock_tesseract_class):
        """Тест когда OCR.space падает, но Tesseract работает"""
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.return_value = {
            'success': False,
            'error': 'API quota exceeded',
            'latex': '',
            'confidence': 0.0
        }
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$a + b$',
            'confidence': 0.65,
            'original_text': 'a + b'
        }
        mock_tesseract_class.return_value = mock_tesseract

        service = ParallelOCRService()
        image = self._create_test_image()
        result = service.process_image_file(image)

        self.assertTrue(result['success'])
        self.assertEqual(result['provider'], 'Tesseract')
        self.assertEqual(result['providers_used'], 1)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_parallel_processing_both_fail(self, mock_ocr_space_getter, mock_tesseract_class):
        """Тест когда оба сервиса падают"""
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.return_value = {
            'success': False,
            'error': 'Network error',
            'latex': '',
            'confidence': 0.0
        }
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': False,
            'error': 'Image processing failed',
            'latex': '',
            'confidence': 0.0
        }
        mock_tesseract_class.return_value = mock_tesseract

        service = ParallelOCRService()
        image = self._create_test_image()
        result = service.process_image_file(image)

        self.assertFalse(result['success'])
        self.assertIn('All OCR providers failed', result['error'])
        self.assertEqual(result['confidence'], 0.0)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_parallel_processing_exception_handling(self, mock_ocr_space_getter, mock_tesseract_class):
        """Тест обработки исключений"""
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.side_effect = Exception("Unexpected error")
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$x = 5$',
            'confidence': 0.75,
            'original_text': 'x = 5'
        }
        mock_tesseract_class.return_value = mock_tesseract

        service = ParallelOCRService()
        image = self._create_test_image()
        result = service.process_image_file(image)

        self.assertTrue(result['success'])
        self.assertEqual(result['provider'], 'Tesseract')

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_get_status(self, mock_ocr_space_getter, mock_tesseract_class):
        """Тест получения статуса сервисов"""
        from ..parallel_ocr_service import ParallelOCRService

        mock_ocr_space_getter.return_value = MagicMock()
        mock_tesseract_class.return_value = MagicMock()

        service = ParallelOCRService()
        status = service.get_status()

        self.assertIn('ocr_space', status)
        self.assertIn('tesseract', status)
        self.assertTrue(status['ocr_space']['available'])
        self.assertTrue(status['tesseract']['available'])
        self.assertEqual(status['mode'], 'parallel')

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_singleton_pattern(self, mock_ocr_space_getter, mock_tesseract_class):
        """Тест singleton паттерна"""
        from ..parallel_ocr_service import get_parallel_ocr_service

        mock_ocr_space_getter.return_value = MagicMock()
        mock_tesseract_class.return_value = MagicMock()

        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

        service1 = get_parallel_ocr_service()
        service2 = get_parallel_ocr_service()

        self.assertIs(service1, service2)

    def _create_test_image(self, text="x + 2"):
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


class ParallelOCRAPITests(APITestCase):
    """
    API тесты для параллельного OCR
    """

    def setUp(self):
        """Настройка перед каждым тестом"""
        self.client = APIClient()
        self.ocr_url = '/api/ocr/recognize/'
        self.health_url = '/api/ocr/health/'

        self._reset_singletons()

    def tearDown(self):
        """Очистка после каждого теста"""
        self._reset_singletons()

    def _reset_singletons(self):
        """Сброс OCR singletons"""
        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_parallel_ocr_api_response_structure(self, mock_ocr_space_getter, mock_tesseract_class):
        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.return_value = {
            'success': True,
            'latex': '$x^2$',
            'confidence': 0.90,
            'original_text': 'x^2',
            'provider': 'OCR.space'
        }
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$x^{2}$',
            'confidence': 0.75,
            'original_text': 'x^ 2',
            'provider': 'Tesseract'
        }
        mock_tesseract_class.return_value = mock_tesseract

        img = Image.new('RGB', (200, 100), color='white')
        img_io = BytesIO()
        img.save(img_io, format='PNG')
        img_io.seek(0)
        img_io.name = 'test.png'

        response = self.client.post(
            self.ocr_url,
            {'image': img_io},
            format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('latex', response.data)
        self.assertIn('confidence', response.data)
        self.assertIn('provider', response.data)
        self.assertIn('providers_used', response.data)
        self.assertIn('all_results', response.data)

        self.assertEqual(response.data['providers_used'], 2)
        self.assertEqual(len(response.data['all_results']), 2)

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_health_check_parallel_mode(self, mock_ocr_space_getter, mock_tesseract_class):
        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

        mock_ocr_space_getter.return_value = MagicMock()
        mock_tesseract_class.return_value = MagicMock()

        response = self.client.get(self.health_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['mode'], 'parallel')
        self.assertIn('services', response.data)


class ParallelOCRIntegrationTests(APITestCase):
    def setUp(self):
        self._reset_singletons()

    def tearDown(self):
        self._reset_singletons()

    def _reset_singletons(self):
        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

    @override_settings(OCR_SPACE_API_KEY='test_key')
    @patch('freedraw_widget_backend.ocr_service.LaTeXOCRService')
    @patch('freedraw_widget_backend.ocr_space_service.get_ocr_space_service')
    def test_full_parallel_workflow(self, mock_ocr_space_getter, mock_tesseract_class):
        import freedraw_widget_backend.parallel_ocr_service as parallel_module
        parallel_module._parallel_ocr_service = None

        mock_ocr_space = MagicMock()
        mock_ocr_space.process_image_file.return_value = {
            'success': True,
            'latex': '$\\frac{a}{b}$',
            'confidence': 0.88,
            'original_text': 'a/b',
            'provider': 'OCR.space'
        }
        mock_ocr_space_getter.return_value = mock_ocr_space

        mock_tesseract = MagicMock()
        mock_tesseract.process_image_file.return_value = {
            'success': True,
            'latex': '$a/b$',
            'confidence': 0.60,
            'original_text': 'a / b',
            'provider': 'Tesseract'
        }
        mock_tesseract_class.return_value = mock_tesseract

        health = self.client.get('/api/ocr/health/')
        self.assertEqual(health.status_code, status.HTTP_200_OK)

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

        self.assertEqual(ocr_response.status_code, status.HTTP_200_OK)
        latex = ocr_response.data['latex']

        validate = self.client.post(
            '/api/ocr/validate/',
            {'latex': latex},
            format='json'
        )

        self.assertEqual(validate.status_code, status.HTTP_200_OK)
        self.assertTrue(validate.data['is_valid'])
