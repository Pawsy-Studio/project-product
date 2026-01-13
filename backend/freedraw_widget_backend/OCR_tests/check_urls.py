from django.test import Client


def check_urls():
    client = Client()

    urls_to_check = [
        '/api/ocr/recognize/',
        '/api/ocr/validate/',
        '/api/ocr/examples/',
        '/api/ocr/health/',
    ]

    print("Проверка OCR URLs:")
    print("-" * 50)

    for url in urls_to_check:
        try:
            response = client.get(url)
            status = "✓" if response.status_code != 404 else "✗"
            print(f"{status} {url} - Status: {response.status_code}")
        except Exception as e:
            print(f"✗ {url} - Error: {str(e)}")

    print("-" * 50)


if __name__ == '__main__':
    import django
    import os

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'freedraw_widget_backend.settings')
    django.setup()
    check_urls()
