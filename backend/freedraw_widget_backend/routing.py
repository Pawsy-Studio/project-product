from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/canvas/(?P<board_id>[^/]+)/$', consumers.CanvasConsumer.as_asgi()),
]
