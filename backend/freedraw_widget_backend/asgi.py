# freedraw_widget_backend/asgi.py
import os
import django
from django.core.asgi import get_asgi_application

# Устанавливаем переменную окружения ДО импорта чего-либо
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'freedraw_widget_backend.settings')

# Инициализируем Django ДО импорта приложения
django.setup()

# Только ПОСЛЕ django.setup() импортируем остальные модули
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from freedraw_widget_backend import routing  # Импортируем наш routing.py

application = ProtocolTypeRouter({
    "http": get_asgi_application(),  # Обработка HTTP-запросов
    "websocket": AuthMiddlewareStack(  # Обработка WebSocket-соединений
        URLRouter(
            routing.websocket_urlpatterns  # Используем наши WebSocket маршруты
        )
    ),
})