FROM python:3.11-slim

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements отдельно для кэширования
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код (исключаем ненужные файлы)
COPY . .

# Создаем папку для статики (чтобы не было проблем с правами)
RUN mkdir -p staticfiles && chmod 755 staticfiles

# Создаем папку для миграций если её нет
RUN mkdir -p freedraw_widget_backend/migrations && \
    touch freedraw_widget_backend/migrations/__init__.py

# Открываем порт
EXPOSE 8000

# Стандартная команда запуска (будет переопределена в docker-compose)
CMD ["sh", "-c", "daphne -b 0.0.0.0 -p 8000 freedraw_widget_backend.asgi:application"]