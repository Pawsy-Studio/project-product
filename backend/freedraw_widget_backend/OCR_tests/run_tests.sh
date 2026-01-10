#!/bin/bash

echo "========================================="
echo "Running OCR Tests"
echo "========================================="

# Устанавливаем тестовые переменные окружения
export OCR_SPACE_API_KEY="test_key_for_testing"
export DJANGO_SETTINGS_MODULE="freedraw_widget_backend.settings"

# Проверяем аргументы
if [ "$1" = "coverage" ]; then
    echo ""
    echo "========================================="
    echo "Running tests with coverage"
    echo "========================================="
    coverage run --source='.' manage.py test freedraw_widget_backend.OCR_test.tests_ocr
    coverage report
    coverage html
    echo "HTML coverage report generated in htmlcov/"
elif [ "$1" = "verbose" ]; then
    echo "========================================="
    echo "Running OCR Tests with verbose output"
    echo "========================================="
    python manage.py test freedraw_widget_backend.tests_ocr --verbosity=3
else
    echo "========================================="
    echo "Running OCR Tests"
    echo "========================================="
    python manage.py test freedraw_widget_backend.tests_ocr --verbosity=2
fi

