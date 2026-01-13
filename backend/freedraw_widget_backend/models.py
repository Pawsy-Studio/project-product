from django.db import models

class CanvasData(models.Model):
    board_id = models.CharField(
        max_length=255,
        verbose_name='ID доски',
        null=False,
        blank=False,
        unique=True,
        help_text='ID доски из внешней системы'
    )
    
    elements = models.JSONField(
        verbose_name='Элементы холста',
        default=list,
        blank=True,
        help_text='JSON массив с элементами рисования'
    )
    
    canvas_config = models.JSONField(
        verbose_name='Конфигурация холста',
        default=dict,
        blank=True,
        help_text='JSON конфигурация холста'
    )
    
    history = models.JSONField(
        verbose_name='История изменений',
        default=list,
        blank=True,
        help_text='JSON с историей изменений для undo/redo'
    )
    
    active_users = models.JSONField(
        verbose_name='Активные пользователи',
        default=list,
        blank=True,
        help_text='Список активных пользователей'
    )
    
    created_at = models.DateTimeField(
        verbose_name='Дата создания',
        auto_now_add=True
    )
    
    updated_at = models.DateTimeField(
        verbose_name='Дата обновления',
        auto_now=True
    )
    
    class Meta:
        verbose_name = 'Данные холста'
        verbose_name_plural = 'Данные холстов'
        indexes = [
            models.Index(fields=['board_id']),
        ]
    
    def __str__(self):
        return f'Холст для доски {self.board_id}'