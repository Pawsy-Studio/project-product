from io import BytesIO
from unittest.mock import patch, Mock
from PIL import Image, ImageDraw

from django.test import TestCase
from django.core.files.uploadedfile import InMemoryUploadedFile

from ..ocr_service import LaTeXOCRService


class TesseractOCRTests(TestCase):
    def setUp(self):
        try:
            self.service = LaTeXOCRService()
            self.tesseract_available = True
        except Exception:
            self.tesseract_available = False

    def test_service_initialization(self):
        if not self.tesseract_available:
            self.skipTest("Tesseract not available")

        self.assertIsNotNone(self.service)

    @patch('pytesseract.image_to_string')
    @patch('pytesseract.image_to_data')
    def test_process_image_success(self, mock_image_to_data, mock_image_to_string):
        if not self.tesseract_available:
            self.skipTest("Tesseract not available")

        mock_image_to_string.return_value = "x + 2 = 5"
        mock_image_to_data.return_value = {
            'conf': [80, 85, 90]
        }

        image = self._create_test_image()
        result = self.service.process_image_file(image)

        self.assertTrue(result['success'])
        self.assertIn('latex', result)
        self.assertGreater(result['confidence'], 0)

    def test_preprocess_image(self):
        if not self.tesseract_available:
            self.skipTest("Tesseract not available")

        import numpy as np
        img = Image.new('RGB', (100, 100), color='white')
        img_array = np.array(img)

        processed = self.service.preprocess_image(img_array)

        self.assertIsInstance(processed, np.ndarray)

    def _create_test_image(self, text="x + 2"):
        """Создание тестового изображения"""
        img = Image.new('RGB', (200, 100), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((10, 30), text, fill='black')

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
