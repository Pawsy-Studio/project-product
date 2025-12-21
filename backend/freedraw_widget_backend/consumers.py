# freedraw_widget_backend/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import CanvasData

class CanvasConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.board_id = self.scope['url_route']['kwargs']['board_id']
        self.room_group_name = f'canvas_{self.board_id}'
        
        print(f"WebSocket connecting to room: {self.room_group_name}")
        
        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"WebSocket connected for board: {self.board_id}")
        
        # Добавляем пользователя в активные
        await self.add_active_user()
        
        # Отправляем текущее состояние холста
        canvas_data = await self.get_canvas_data()
        await self.send(text_data=json.dumps({
            'type': 'init',
            'data': canvas_data
        }))
    
    async def disconnect(self, close_code):
        print(f"WebSocket disconnected for board: {self.board_id}, code: {close_code}")
        
        # Удаляем пользователя из активных
        await self.remove_active_user()
        
        # Покидаем группу
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        print(f"WebSocket received message for board: {self.board_id}")
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'update':
                # Сохраняем изменения в базе
                shapes = data.get('data', {}).get('shapes', [])
                await self.update_canvas_data(shapes)
                
                # Рассылаем всем участникам группы
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'canvas_message',
                        'message': {
                            'type': 'update',
                            'data': {'shapes': shapes},
                            'userId': data.get('userId')
                        }
                    }
                )
            
            elif message_type == 'clear':
                await self.clear_canvas()
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'canvas_message',
                        'message': {
                            'type': 'clear',
                            'userId': data.get('userId')
                        }
                    }
                )
            
            elif message_type == 'undo':
                shapes = await self.undo_last_action()
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'canvas_message',
                        'message': {
                            'type': 'update',
                            'data': {'shapes': shapes},
                            'userId': data.get('userId')
                        }
                    }
                )
        
        except Exception as e:
            print(f"Error processing WebSocket message: {e}")
    
    async def canvas_message(self, event):
        """Получение сообщения от группы"""
        message = event['message']
        
        # Не отправляем сообщение обратно отправителю
        if message.get('userId') != self.scope.get('user_id', 'unknown'):
            await self.send(text_data=json.dumps(message))
    
    @database_sync_to_async
    def get_canvas_data(self):
        try:
            canvas = CanvasData.objects.get(board_id=self.board_id)
            return {
                'shapes': canvas.elements,
                'config': canvas.canvas_config,
                'history': canvas.history[-10:] if canvas.history else []
            }
        except CanvasData.DoesNotExist:
            # Создаем новый холст если не существует
            canvas = CanvasData.objects.create(
                board_id=self.board_id,
                elements=[],
                canvas_config={},
                history=[],
                active_users=[]
            )
            return {
                'shapes': [],
                'config': {},
                'history': []
            }
    
    @database_sync_to_async
    def update_canvas_data(self, shapes):
        canvas, created = CanvasData.objects.get_or_create(
            board_id=self.board_id,
            defaults={
                'elements': [],
                'canvas_config': {},
                'history': [],
                'active_users': []
            }
        )
        canvas.elements = shapes
        # Сохраняем в историю
        canvas.history.append({'action': 'update', 'shapes': shapes[:10]})
        if len(canvas.history) > 50:
            canvas.history = canvas.history[-50:]
        canvas.save()
    
    @database_sync_to_async
    def clear_canvas(self):
        canvas, created = CanvasData.objects.get_or_create(
            board_id=self.board_id,
            defaults={
                'elements': [],
                'canvas_config': {},
                'history': [],
                'active_users': []
            }
        )
        # Сохраняем в историю перед очисткой
        if canvas.elements:
            canvas.history.append({'action': 'clear', 'previous_elements': canvas.elements})
        canvas.elements = []
        canvas.save()
    
    @database_sync_to_async
    def undo_last_action(self):
        canvas, created = CanvasData.objects.get_or_create(
            board_id=self.board_id,
            defaults={
                'elements': [],
                'canvas_config': {},
                'history': [],
                'active_users': []
            }
        )
        if canvas.history:
            last_action = canvas.history.pop()
            if last_action.get('action') == 'clear' and 'previous_elements' in last_action:
                canvas.elements = last_action['previous_elements']
            canvas.save()
        return canvas.elements
    
    @database_sync_to_async
    def add_active_user(self):
        canvas, created = CanvasData.objects.get_or_create(
            board_id=self.board_id,
            defaults={
                'elements': [],
                'canvas_config': {},
                'history': [],
                'active_users': []
            }
        )
        user_id = self.scope.get('user_id', 'anonymous')
        if user_id not in canvas.active_users:
            canvas.active_users.append(user_id)
            canvas.save()
    
    @database_sync_to_async
    def remove_active_user(self):
        try:
            canvas = CanvasData.objects.get(board_id=self.board_id)
            user_id = self.scope.get('user_id', 'anonymous')
            if user_id in canvas.active_users:
                canvas.active_users.remove(user_id)
                canvas.save()
        except CanvasData.DoesNotExist:
            pass