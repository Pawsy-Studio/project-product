from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CanvasDataViewSet

router = DefaultRouter()
router.register(r'canvas', CanvasDataViewSet, basename='canvas')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    
    # REST endpoints
    path('api/canvas/<str:board_id>/clear/', CanvasDataViewSet.as_view({'post': 'clear'})),
    path('api/canvas/<str:board_id>/history/', CanvasDataViewSet.as_view({'get': 'history'})),
    path('api/canvas/<str:board_id>/undo/', CanvasDataViewSet.as_view({'post': 'undo'})),
    path('api/canvas/<str:board_id>/active-users/', CanvasDataViewSet.as_view({'get': 'active_users'})),
]