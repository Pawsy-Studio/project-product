from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CanvasDataViewSet, CanvasCommandView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from .ocr_views import LaTeXOCRView, LaTeXValidateView, LaTeXExamplesView, OCRHealthCheckView

router = DefaultRouter()
router.register(r'canvas', CanvasDataViewSet, basename='canvas')

urlpatterns = [
    # REST API для CanvasData
    path('api/', include(router.urls)),

    # Команды от фронтенда
    path('api/canvas/<str:board_id>/clear/', CanvasCommandView.as_view(), name='canvas-clear'),
    path('api/canvas/<str:board_id>/undo/', CanvasCommandView.as_view(), name='canvas-undo'),
    path('api/canvas/<str:board_id>/update/', CanvasCommandView.as_view(), name='canvas-update'),

    # API Schema и документация
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Альтернативный путь для команд
    path('api/canvas/<str:board_id>/<str:action>/', CanvasCommandView.as_view(), name='canvas-command'),

    # OCR endpoints для LaTeX распознавания
    path('api/ocr/recognize/', LaTeXOCRView.as_view(), name='ocr-recognize'),  # Изменено с latex/ на recognize/
    path('api/ocr/latex/', LaTeXOCRView.as_view(), name='latex-ocr'),  # Оставлено для обратной совместимости
    path('api/ocr/validate/', LaTeXValidateView.as_view(), name='latex-validate'),
    path('api/ocr/examples/', LaTeXExamplesView.as_view(), name='latex-examples'),
    path('api/ocr/health/', OCRHealthCheckView.as_view(), name='ocr-health'),  # Добавлено
]
