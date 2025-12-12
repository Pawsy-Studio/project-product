from django.db import models

class Board(models.Model):
    """Модель для досок/разделов"""
    name = models.CharField(
        max_length=255, 
        blank=True,
        null=True,
        verbose_name='Название доски'
    )
    parentId = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Родительская доска',
        related_name='children'
        
    )


class Widget(models.Model):

    ROLE_CHOICES = [
        ('viewer', 'Наблюдатель'),
        ('editor', 'Редактор'),
        ('owner', 'Владелец'),
    ]

    widget_id = models.IntegerField(
        verbose_name='ID виджета',
        unique=True,
        null=True,
    )
    
    user = models.ForeignKey(
        on_delete=models.CASCADE,
        verbose_name='Пользователь',
        related_name='widgets',
        null=True,
        blank=True,
    )
    
    role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        default='viewer',
        verbose_name='Роль'
    )
    
    config = models.JSONField(
        verbose_name='Конфигурация',
        default=dict,
        null=True,
        blank=True,
        help_text='JSON конфигурация виджета'
    )
    
    board = models.ForeignKey(
        on_delete=models.CASCADE,
        verbose_name='Доска',
        null=True,
        related_name='widgets'
    )
    
    canvas = models.JSONField(
        verbose_name='Холст',
        default=dict,
        null=True,
        blank=True,
        help_text='JSON данные холста'
    )
