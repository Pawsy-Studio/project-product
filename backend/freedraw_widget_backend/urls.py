from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CanvasDataViewSet, CanvasCommandView

router = DefaultRouter()
router.register(r'canvas', CanvasDataViewSet, basename='canvas')

urlpatterns = [
    # REST API для CanvasData
    path('api/', include(router.urls)),
    
    # Команды от фронтенда (как в коде фронтенда)
    path('api/canvas/<str:board_id>/clear/', CanvasCommandView.as_view(), name='canvas-clear'),
    path('api/canvas/<str:board_id>/undo/', CanvasCommandView.as_view(), name='canvas-undo'),
    path('api/canvas/<str:board_id>/update/', CanvasCommandView.as_view(), name='canvas-update'),
    
    # Альтернативный путь
    path('api/canvas/<str:board_id>/<str:action>/', CanvasCommandView.as_view(), name='canvas-command'),
]