from rest_framework import serializers
from .models import CanvasData

class CanvasDataSerializer(serializers.ModelSerializer):
    """Сериализатор для данных канваса"""
    
    class Meta:
        model = CanvasData
        fields = [
            'id',
            'board_id',
            'elements',
            'canvas_config',
            'history',
            'active_users',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate_board_id(self, value):
        """Валидация ID доски"""
        if not value or len(value.strip()) == 0:
            raise serializers.ValidationError("ID доски не может быть пустым")
        return value.strip()