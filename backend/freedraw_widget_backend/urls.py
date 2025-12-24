from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CanvasDataViewSet, CanvasCommandView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView


router = DefaultRouter()
router.register(r'canvas', CanvasDataViewSet, basename='canvas')



urlpatterns = [
    # REST API для CanvasData
    path('api/', include(router.urls)),
    
    # Команды от фронтенда (как в коде фронтенда)
    path('api/canvas/<str:board_id>/clear/', CanvasCommandView.as_view(), name='canvas-clear'),
    path('api/canvas/<str:board_id>/undo/', CanvasCommandView.as_view(), name='canvas-undo'),
    path('api/canvas/<str:board_id>/update/', CanvasCommandView.as_view(), name='canvas-update'),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    
    # Альтернативный путь
    path('api/canvas/<str:board_id>/<str:action>/', CanvasCommandView.as_view(), name='canvas-command'),

    
]