from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import CanvasData
from .serializer import CanvasDataSerializer, CanvasUpdateSerializer

class CanvasDataViewSet(viewsets.ModelViewSet):
    queryset = CanvasData.objects.all()
    serializer_class = CanvasDataSerializer
    permission_classes = [AllowAny]
    lookup_field = 'board_id'
    
    def get_object(self):
        board_id = self.kwargs.get('board_id')
        if not board_id:
            board_id = 'default-board'
        
        obj, created = CanvasData.objects.get_or_create(
            board_id=board_id,
            defaults={
                'elements': [], 
                'canvas_config': {}, 
                'history': [], 
                'active_users': []
            }
        )
        return obj
    
    @action(detail=True, methods=['post'], url_path='update')
    def update_shapes(self, request, board_id=None):
        canvas = self.get_object()
        serializer = CanvasUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            shapes = serializer.validated_data['shapes']
            
            with transaction.atomic():
                canvas.elements = shapes
                if 'history' not in canvas.canvas_config:
                    canvas.canvas_config['history'] = []
                canvas.canvas_config['history'].append({
                    'action': 'update',
                    'shapes': shapes[:50],
                    'timestamp': str(self.get_object().updated_at)
                })
                canvas.save()
            
            return Response({
                'success': True,
                'message': 'Shapes updated successfully',
                'data': CanvasDataSerializer(canvas).data
            })
        
        return Response({
            'success': False,
            'message': 'Invalid data',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def clear(self, request, board_id=None):
        canvas = self.get_object()
        
        with transaction.atomic():
            if canvas.elements:
                canvas.history.append({
                    'action': 'clear',
                    'previous_elements': canvas.elements,
                    'timestamp': str(canvas.updated_at)
                })
            canvas.elements = []
            canvas.save()
        
        return Response({
            'success': True,
            'message': 'Canvas cleared',
            'data': {'elements': canvas.elements}
        })
    
    @action(detail=True, methods=['post'])
    def undo(self, request, board_id=None):
        canvas = self.get_object()
        
        with transaction.atomic():
            if canvas.history:
                last_state = canvas.history.pop()
                if last_state.get('action') == 'clear' and 'previous_elements' in last_state:
                    canvas.elements = last_state['previous_elements']
                canvas.save()
        
        return Response({
            'success': True,
            'message': 'Undo successful',
            'data': {'elements': canvas.elements}
        })
    
    @action(detail=True, methods=['get'])
    def active_users(self, request, board_id=None):
        canvas = self.get_object()
        return Response({
            'success': True,
            'data': {'active_users': canvas.active_users}
        })
    
    def create(self, request, *args, **kwargs):
        board_id = request.data.get('board_id', 'default-board')
        
        if CanvasData.objects.filter(board_id=board_id).exists():
            return Response({
                'success': False,
                'message': f'Canvas with board_id {board_id} already exists'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response({
            'success': True,
            'message': 'Canvas created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

from rest_framework.views import APIView
from rest_framework.response import Response

class CanvasCommandView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, board_id, action):
        try:
            canvas, created = CanvasData.objects.get_or_create(
                board_id=board_id,
                defaults={
                    'elements': [],
                    'canvas_config': {},
                    'history': [],
                    'active_users': []
                }
            )
            
            if action == 'clear':
                canvas.elements = []
                canvas.save()
                return Response({'success': True, 'message': 'Canvas cleared'})
            
            elif action == 'undo':
                if canvas.elements:
                    canvas.elements.pop()
                    canvas.save()
                return Response({'success': True, 'message': 'Undo successful', 'elements': canvas.elements})
            
            elif action == 'update':
                shapes = request.data.get('shapes', [])
                canvas.elements = shapes
                canvas.save()
                return Response({'success': True, 'message': 'Shapes updated'})
            
            else:
                return Response({'success': False, 'message': f'Unknown action: {action}'}, 
                              status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({'success': False, 'message': str(e)}, 
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)