#!/bin/bash

# Устанавливаем тестовые переменные окружения
export OCR_SPACE_API_KEY="test_key_for_testing"
export DJANGO_SETTINGS_MODULE="freedraw_widget_backend.settings"

# В Docker контейнере код всегда находится в /app
cd /app || exit 1

echo "Current directory: $(pwd)"

# Проверяем аргументы
if [ "$1" = "coverage" ]; then
    echo ""
    echo "========================================="
    echo "Running tests with coverage"
    echo "========================================="
    coverage run --source='freedraw_widget_backend' manage.py test freedraw_widget_backend.OCR_tests
    coverage report
    coverage html
    echo "HTML coverage report generated in htmlcov/"
elif [ "$1" = "verbose" ]; then
    echo "========================================="
    echo "Running tests with verbose"
    echo "========================================="
    python manage.py test freedraw_widget_backend.OCR_tests --verbosity=3
else
    echo "========================================="
    echo "Running tests"
    echo "========================================="
    python manage.py test freedraw_widget_backend.OCR_tests --verbosity=2
fi

echo ""
echo "========================================="
echo "Tests completed!"
echo "========================================="
