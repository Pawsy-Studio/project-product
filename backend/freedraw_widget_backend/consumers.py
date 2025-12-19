import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import CanvasData

logger = logging.getLogger(__name__)

class CanvasConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer для работы с канвасом"""
    
    async def connect(self):
        """Подключение к WebSocket"""
        self.board_id = self.scope['url_route']['kwargs']['board_id']
        self.user_id = self.scope['query_string'].decode().split('=')[1] if 'user_id=' in self.scope['query_string'].decode() else 'anonymous'
        
        # Группа для комнаты (доски)
        self.room_group_name = f'canvas_{self.board_id}'
        
        # Присоединяемся к группе
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Добавляем пользователя в активные
        await self.add_user_to_canvas(self.board_id, self.user_id)
        
        await self.accept()
        
        # Отправляем текущее состояние канваса новому пользователю
        canvas_data = await self.get_canvas_data(self.board_id)
        if canvas_data:
            await self.send(text_data=json.dumps({
                'type': 'canvas_state',
                'data': {
                    'elements': canvas_data.elements,
                    'config': canvas_data.canvas_config,
                    'active_users': canvas_data.active_users
                }
            }))
        
        # Уведомляем всех о новом пользователе
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_id': self.user_id,
                'active_users': await self.get_active_users(self.board_id)
            }
        )
    
    async def disconnect(self, close_code):
        """Отключение от WebSocket"""
        # Удаляем пользователя из активных
        await self.remove_user_from_canvas(self.board_id, self.user_id)
        
        # Уведомляем всех об уходе пользователя
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_left',
                'user_id': self.user_id,
                'active_users': await self.get_active_users(self.board_id)
            }
        )
        
        # Покидаем группу
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Получение сообщения от клиента"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'draw':
                # Обработка рисования
                await self.handle_drawing(data)
            
            elif message_type == 'clear':
                # Очистка канваса
                await self.handle_clear(data)
            
            elif message_type == 'undo':
                # Отмена последнего действия
                await self.handle_undo(data)
            
            elif message_type == 'redo':
                # Повтор последнего действия
                await self.handle_redo(data)
            
            elif message_type == 'select_tool':
                # Выбор инструмента
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'tool_selected',
                        'user_id': self.user_id,
                        'tool': data.get('tool')
                    }
                )
            
            elif message_type == 'cursor_move':
                # Движение курсора
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'cursor_moved',
                        'user_id': self.user_id,
                        'position': data.get('position')
                    }
                )
        
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def handle_drawing(self, data):
        """Обработка рисования"""
        element = data.get('element')
        
        if not element:
            return
        
        # Сохраняем в базу
        await self.add_element_to_canvas(self.board_id, element)
        
        # Отправляем всем в группе
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'drawing_update',
                'user_id': self.user_id,
                'element': element
            }
        )
    
    async def handle_clear(self, data):
        """Обработка очистки канваса"""
        await self.clear_canvas(self.board_id)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'canvas_cleared',
                'user_id': self.user_id
            }
        )
    
    async def handle_undo(self, data):
        """Обработка отмены действия"""
        element = await self.undo_last_element(self.board_id)
        
        if element:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'undo_update',
                    'user_id': self.user_id,
                    'element': element
                }
            )
    
    async def handle_redo(self, data):
        """Обработка повтора действия"""
        element = await self.redo_last_element(self.board_id)
        
        if element:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'redo_update',
                    'user_id': self.user_id,
                    'element': element
                }
            )
    
    # Обработчики групповых сообщений
    
    async def drawing_update(self, event):
        """Отправка обновления рисования всем клиентам"""
        await self.send(text_data=json.dumps({
            'type': 'draw',
            'user_id': event['user_id'],
            'element': event['element']
        }))
    
    async def canvas_cleared(self, event):
        """Уведомление об очистке канваса"""
        await self.send(text_data=json.dumps({
            'type': 'clear',
            'user_id': event['user_id']
        }))
    
    async def undo_update(self, event):
        """Уведомление об отмене действия"""
        await self.send(text_data=json.dumps({
            'type': 'undo',
            'user_id': event['user_id'],
            'element': event['element']
        }))
    
    async def redo_update(self, event):
        """Уведомление о повторе действия"""
        await self.send(text_data=json.dumps({
            'type': 'redo',
            'user_id': event['user_id'],
            'element': event['element']
        }))
    
    async def user_joined(self, event):
        """Уведомление о подключении пользователя"""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user_id': event['user_id'],
            'active_users': event['active_users']
        }))
    
    async def user_left(self, event):
        """Уведомление об отключении пользователя"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user_id': event['user_id'],
            'active_users': event['active_users']
        }))
    
    async def tool_selected(self, event):
        """Уведомление о выборе инструмента"""
        await self.send(text_data=json.dumps({
            'type': 'tool_selected',
            'user_id': event['user_id'],
            'tool': event['tool']
        }))
    
    async def cursor_moved(self, event):
        """Уведомление о движении курсора"""
        await self.send(text_data=json.dumps({
            'type': 'cursor_moved',
            'user_id': event['user_id'],
            'position': event['position']
        }))
    
    # Database методы
    
    @database_sync_to_async
    def get_canvas_data(self, board_id):
        """Получение данных канваса из БД"""
        try:
            return CanvasData.objects.get(board_id=board_id)
        except ObjectDoesNotExist:
            return None
    
    @database_sync_to_async
    def add_element_to_canvas(self, board_id, element):
        """Добавление элемента в канвас"""
        canvas, created = CanvasData.objects.get_or_create(
            board_id=board_id,
            defaults={
                'elements': [element],
                'history': [element]
            }
        )
        
        if not created:
            # Добавляем элемент
            elements = list(canvas.elements)
            elements.append(element)
            canvas.elements = elements
            
            # Добавляем в историю
            history = list(canvas.history)
            history.append(element)
            canvas.history = history
            
            canvas.save()
    
    @database_sync_to_async
    def clear_canvas(self, board_id):
        """Очистка канваса"""
        try:
            canvas = CanvasData.objects.get(board_id=board_id)
            canvas.elements = []
            canvas.history = []
            canvas.save()
        except ObjectDoesNotExist:
            pass
    
    @database_sync_to_async
    def undo_last_element(self, board_id):
        """Отмена последнего элемента"""
        try:
            canvas = CanvasData.objects.get(board_id=board_id)
            if canvas.elements:
                last_element = canvas.elements.pop()
                canvas.save()
                return last_element
        except ObjectDoesNotExist:
            pass
        return None
    
    @database_sync_to_async
    def redo_last_element(self, board_id):
        """Повтор последнего элемента"""
        # Здесь должна быть логика redo из истории
        # Упрощенная версия
        return None
    
    @database_sync_to_async
    def add_user_to_canvas(self, board_id, user_id):
        """Добавление пользователя в активные"""
        canvas, created = CanvasData.objects.get_or_create(
            board_id=board_id,
            defaults={'active_users': [user_id]}
        )
        
        if not created and user_id not in canvas.active_users:
            active_users = list(canvas.active_users)
            active_users.append(user_id)
            canvas.active_users = active_users
            canvas.save()
    
    @database_sync_to_async
    def remove_user_from_canvas(self, board_id, user_id):
        """Удаление пользователя из активных"""
        try:
            canvas = CanvasData.objects.get(board_id=board_id)
            if user_id in canvas.active_users:
                active_users = list(canvas.active_users)
                active_users.remove(user_id)
                canvas.active_users = active_users
                canvas.save()
        except ObjectDoesNotExist:
            pass
    
    @database_sync_to_async
    def get_active_users(self, board_id):
        """Получение списка активных пользователей"""
        try:
            canvas = CanvasData.objects.get(board_id=board_id)
            return canvas.active_users
        except ObjectDoesNotExist:
            return []