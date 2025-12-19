from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from .models import CanvasData
from .serializers import CanvasDataSerializer

class CanvasDataViewSet(viewsets.ModelViewSet):
    """ViewSet для работы с данными канваса"""
    queryset = CanvasData.objects.all()
    serializer_class = CanvasDataSerializer
    permission_classes = [AllowAny]
    lookup_field = 'board_id'
    
    def get_object(self):
        """Получение объекта по board_id"""
        board_id = self.kwargs.get('board_id')
        obj, created = CanvasData.objects.get_or_create(
            board_id=board_id,
            defaults={'elements': [], 'canvas_config': {}, 'history': [], 'active_users': []}
        )
        return obj
    
    def retrieve(self, request, *args, **kwargs):
        """Получение данных канваса"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Обновление данных канваса"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def clear(self, request, board_id=None):
        """Очистка канваса"""
        canvas = self.get_object()
        canvas.elements = []
        canvas.history = []
        canvas.save()
        return Response({'status': 'cleared'})
    
    @action(detail=True, methods=['get'])
    def history(self, request, board_id=None):
        """Получение истории изменений"""
        canvas = self.get_object()
        return Response({'history': canvas.history})
    
    @action(detail=True, methods=['post'])
    def undo(self, request, board_id=None):
        """Отмена последнего действия"""
        canvas = self.get_object()
        if canvas.elements:
            canvas.elements.pop()
            canvas.save()
        return Response({'status': 'undone', 'elements': canvas.elements})
    
    @action(detail=True, methods=['get'])
    def active_users(self, request, board_id=None):
        """Получение активных пользователей"""
        canvas = self.get_object()
        return Response({'active_users': canvas.active_users})