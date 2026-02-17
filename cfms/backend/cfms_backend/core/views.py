import json

from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Feedback, FoodItem


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


@csrf_exempt
def auth_login(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200))

    if request.method != 'POST':
        return _cors(JsonResponse({'error': 'Method not allowed.'}, status=405))

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _cors(JsonResponse({'error': 'Invalid JSON body.'}, status=400))

    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', ''))

    if not username or not password:
        return _cors(JsonResponse({'error': 'Username and password are required.'}, status=400))

    user = authenticate(request, username=username, password=password)
    if not user:
        return _cors(JsonResponse({'error': 'Invalid credentials.'}, status=401))

    if not user.is_active:
        return _cors(JsonResponse({'error': 'This account is inactive.'}, status=403))

    login(request, user)
    role = 'admin' if user.is_staff or user.is_superuser else 'student'
    return _cors(JsonResponse({'username': user.username, 'role': role}, status=200))


@csrf_exempt
def feedback_items(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200))

    if not request.user.is_authenticated:
        return _cors(JsonResponse({'error': 'Authentication required.'}, status=401))

    if request.method == 'GET':
        if not (request.user.is_staff or request.user.is_superuser):
            return _cors(JsonResponse({'error': 'Admin access required.'}, status=403))

        feedbacks = [
            {
                'id': feedback.id,
                'student_name': feedback.student_name,
                'message': feedback.message,
                'created_at': feedback.created_at.isoformat(),
            }
            for feedback in Feedback.objects.all()
        ]
        return _cors(JsonResponse({'feedbacks': feedbacks}))

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _cors(JsonResponse({'error': 'Invalid JSON body.'}, status=400))

        message = str(payload.get('message', '')).strip()
        if not message:
            return _cors(JsonResponse({'error': 'Feedback message is required.'}, status=400))

        feedback = Feedback.objects.create(
            student_name=request.user.username,
            message=message,
        )

        return _cors(
            JsonResponse(
                {
                    'id': feedback.id,
                    'student_name': feedback.student_name,
                    'message': feedback.message,
                    'created_at': feedback.created_at.isoformat(),
                },
                status=201,
            )
        )

    return _cors(JsonResponse({'error': 'Method not allowed.'}, status=405))
