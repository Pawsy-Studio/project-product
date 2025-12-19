from django.db import models

class Widget(models.Model):
    ROLE_CHOICES = [
        ('viewer', 'Наблюдатель'),
        ('editor', 'Редактор'),
        ('owner', 'Владелец'),
    ]

    # Связь с внешней доской (храним только ID)
    board_id = models.IntegerField(
        verbose_name='ID доски',
        null=False,
        blank=False,
        help_text='ID доски из внешней системы'
    )
    
    # Связь с пользователем (если нужна)
    user_id = models.IntegerField(
        verbose_name='ID пользователя',
        null=True,
        blank=True,
        help_text='ID пользователя из внешней системы'
    )
    
    role = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        null=True,
        blank=True,
        default='viewer',
        verbose_name='Роль пользователя'
    )
    
    # Конфигурация виджета (позиция, размер и т.д.)
    config = models.JSONField(
        verbose_name='Конфигурация виджета',
        default=dict,
        null=True,
        blank=True,
        help_text='JSON конфигурация: позиция, размер, настройки виджета'
    )
    
    # Основные данные холста (рисунок)
    canvas = models.JSONField(
        verbose_name='Данные холста',
        default=dict,
        null=True,
        blank=True,
        help_text='JSON с данными рисунка: линии, фигуры, объекты'
    )
    
    # Метаданные виджета
    created_at = models.DateTimeField(
        verbose_name='Дата создания',
        auto_now_add=True
    )
    
    updated_at = models.DateTimeField(
        verbose_name='Дата обновления',
        auto_now=True
    )
    
    # Уникальность: один виджет на доску для пользователя
    class Meta:
        unique_together = ['board_id', 'user_id']
        verbose_name = 'Виджет рисовалки'
        verbose_name_plural = 'Виджеты рисовалки'
    
    def __str__(self):
        return f'Виджет для доски {self.board_id} (пользователь: {self.user_id})'


# Если нужна поддержка нескольких пользователей на одну доску
class WidgetUserPermission(models.Model):
    ROLE_CHOICES = [
        ('viewer', 'Наблюдатель'),
        ('editor', 'Редактор'),
        ('owner', 'Владелец'),
    ]
    
    widget = models.ForeignKey(
        Widget,
        on_delete=models.CASCADE,
        verbose_name='Виджет',
        related_name='permissions'
    )
    
    user_id = models.IntegerField(
        verbose_name='ID пользователя',
        null=False,
        blank=False
    )
    
    role = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        default='viewer',
        verbose_name='Роль'
    )
    
    granted_at = models.DateTimeField(
        verbose_name='Время выдачи прав',
        auto_now_add=True
    )
    
    class Meta:
        unique_together = ['widget', 'user_id']
        verbose_name = 'Права пользователя на виджет'
        verbose_name_plural = 'Права пользователей на виджеты'
    
    def __str__(self):
        return f'{self.user_id} - {self.role} для виджета {self.widget.id}'