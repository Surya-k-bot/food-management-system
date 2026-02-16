import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import FoodItem


def _cors(response: JsonResponse) -> JsonResponse:
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = 'Content-Type'
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


@csrf_exempt
def food_items(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200))

    if request.method == 'GET':
        items = [
            {
                'id': item.id,
                'name': item.name,
                'category': item.category,
                'quantity': item.quantity,
                'created_at': item.created_at.isoformat(),
            }
            for item in FoodItem.objects.all()
        ]
        return _cors(JsonResponse({'items': items}))

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _cors(JsonResponse({'error': 'Invalid JSON body.'}, status=400))

        name = str(payload.get('name', '')).strip()
        category = str(payload.get('category', '')).strip()
        quantity = payload.get('quantity', 1)

        if not name:
            return _cors(JsonResponse({'error': 'Name is required.'}, status=400))
        if not category:
            return _cors(JsonResponse({'error': 'Category is required.'}, status=400))

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return _cors(JsonResponse({'error': 'Quantity must be a number.'}, status=400))

        if quantity < 1:
            return _cors(JsonResponse({'error': 'Quantity must be at least 1.'}, status=400))

        item = FoodItem.objects.create(name=name, category=category, quantity=quantity)
        return _cors(
            JsonResponse(
                {
                    'id': item.id,
                    'name': item.name,
                    'category': item.category,
                    'quantity': item.quantity,
                    'created_at': item.created_at.isoformat(),
                },
                status=201,
            )
        )

    return _cors(JsonResponse({'error': 'Method not allowed.'}, status=405))
