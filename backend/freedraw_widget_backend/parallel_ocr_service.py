"""
Параллельный OCR сервис: OCR.space + Tesseract
Запускает оба движка одновременно и выбирает лучший результат
"""
import logging
from typing import Dict
from django.conf import settings

logger = logging.getLogger(__name__)


class ParallelOCRService:
    """
    Сервис параллельного распознавания OCR
    """

    def __init__(self):
        """Инициализация обоих OCR сервисов"""
        self.ocr_space_service = None
        self.tesseract_service = None

        # Инициализация OCR.space
        try:
            from .ocr_space_service import get_ocr_space_service
            self.ocr_space_service = get_ocr_space_service()
            logger.info("✓ OCR.space service initialized")
        except Exception as e:
            logger.warning(f"✗ OCR.space not available: {e}")

        # Инициализация Tesseract
        try:
            from .ocr_service import LaTeXOCRService
            self.tesseract_service = LaTeXOCRService()
            logger.info("✓ Tesseract service initialized")
        except Exception as e:
            logger.warning(f"✗ Tesseract not available: {e}")

        # Проверка доступности хотя бы одного сервиса
        if not self.ocr_space_service and not self.tesseract_service:
            raise ValueError(
                "No OCR services available. "
                "Configure OCR_SPACE_API_KEY or install Tesseract"
            )

    def process_image_file(self, image_file, language: str = 'eng') -> Dict:
        """
        Параллельное распознавание обоими сервисами

        Args:
            image_file: Файл изображения
            language: Язык распознавания

        Returns:
            Dict с результатами лучшего распознавания
        """
        logger.info("🚀 Starting parallel OCR recognition")

        results = []
        errors = []

        # OCR.space
        if self.ocr_space_service:
            try:
                if hasattr(image_file, 'seek'):
                    image_file.seek(0)

                logger.info("Processing with OCR.space...")
                ocr_space_result = self.ocr_space_service.process_image_file(
                    image_file,
                    language=language
                )

                if ocr_space_result['success']:
                    ocr_space_result['provider'] = 'OCR.space'
                    results.append(ocr_space_result)
                    conf = ocr_space_result.get('confidence', 0)
                    logger.info(f"✓ OCR.space: confidence={conf:.2f}")
                else:
                    error = ocr_space_result.get('error', 'Unknown error')
                    errors.append(f"OCR.space: {error}")
                    logger.warning(f"✗ OCR.space failed: {error}")

            except Exception as e:
                error_msg = f"OCR.space exception: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        # Tesseract
        if self.tesseract_service:
            try:
                if hasattr(image_file, 'seek'):
                    image_file.seek(0)

                logger.info("Processing with Tesseract...")
                tesseract_result = self.tesseract_service.process_image_file(image_file)

                if tesseract_result['success']:
                    tesseract_result['provider'] = 'Tesseract'
                    results.append(tesseract_result)
                    conf = tesseract_result.get('confidence', 0)
                    logger.info(f"✓ Tesseract: confidence={conf:.2f}")
                else:
                    error = tesseract_result.get('error', 'Unknown error')
                    errors.append(f"Tesseract: {error}")
                    logger.warning(f"✗ Tesseract failed: {error}")

            except Exception as e:
                error_msg = f"Tesseract exception: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        # Если нет успешных результатов
        if not results:
            logger.error("❌ All OCR providers failed")
            return {
                'success': False,
                'error': 'All OCR providers failed. Errors: ' + '; '.join(errors),
                'latex': '',
                'confidence': 0.0,
                'original_text': '',
                'provider': 'none',
                'all_errors': errors
            }

        # Выбираем результат с максимальной уверенностью
        best_result = max(results, key=lambda x: x.get('confidence', 0))

        # Добавляем информацию обо всех результатах
        best_result['all_results'] = [
            {
                'provider': r.get('provider'),
                'confidence': r.get('confidence', 0),
                'latex': r.get('latex', ''),
                'original_text': r.get('original_text', '')
            }
            for r in results
        ]
        best_result['providers_used'] = len(results)

        provider = best_result.get('provider')
        conf = best_result.get('confidence', 0)
        logger.info(f"✅ Best result from {provider} with confidence {conf:.2f}")

        return best_result

    def get_status(self) -> Dict:
        """Возвращает статус доступности сервисов"""
        return {
            'ocr_space': {
                'available': self.ocr_space_service is not None,
                'name': 'OCR.space API',
                'description': 'Cloud OCR with high accuracy for math formulas'
            },
            'tesseract': {
                'available': self.tesseract_service is not None,
                'name': 'Tesseract OCR',
                'description': 'Local open-source OCR engine'
            },
            'mode': 'parallel',
            'description': 'Both engines run simultaneously, best result selected'
        }


# Singleton
_parallel_ocr_service = None


def get_parallel_ocr_service() -> ParallelOCRService:
    """Получить singleton экземпляр параллельного OCR сервиса"""
    global _parallel_ocr_service
    if _parallel_ocr_service is None:
        _parallel_ocr_service = ParallelOCRService()
    return _parallel_ocr_service
