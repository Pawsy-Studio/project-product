#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  OCR Tests Runner${NC}"
echo -e "${YELLOW}========================================${NC}"

# Устанавливаем переменные окружения для тестов
export OCR_SPACE_API_KEY="test_key_for_testing"
export DJANGO_SETTINGS_MODULE="freedraw_widget_backend.settings"

# Проверяем доступность Tesseract
if command -v tesseract &> /dev/null; then
    echo -e "${GREEN}✓ Tesseract is available${NC}"
    TESSERACT_AVAILABLE=true
else
    echo -e "${YELLOW}⚠ Tesseract is not available, some tests will be skipped${NC}"
    TESSERACT_AVAILABLE=false
fi

# Запуск тестов с coverage
echo -e "\n${YELLOW}Running tests with coverage...${NC}"

# Запускаем все тесты OCR
python manage.py test freedraw_widget_backend.OCR_tests \
    --verbosity=2 \
#    --failfast

TEST_EXIT_CODE=$?

# Если тесты прошли, показываем coverage
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"

    # Запускаем coverage если установлен
    if command -v coverage &> /dev/null; then
        echo -e "\n${YELLOW}Generating coverage report...${NC}"

        coverage run --source='.' manage.py test freedraw_widget_backend.OCR_tests --verbosity=0
        coverage report -m --include="*ocr*.py"
        coverage html --include="*ocr*.py"

        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
    fi
else
    echo -e "\n${RED}✗ Tests failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}Testing complete!${NC}"
echo -e "${YELLOW}========================================${NC}"
