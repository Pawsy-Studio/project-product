# freedraw_widget_backend/asgi.py
import os
import django
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'freedraw_widget_backend.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from freedraw_widget_backend import routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(
        routing.websocket_urlpatterns
    ),
})