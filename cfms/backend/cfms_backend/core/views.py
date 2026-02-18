import csv
import io
import json
import os
import re
import uuid
from datetime import datetime

import requests
from django.contrib.auth import authenticate, login
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Avg, Count, Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .models import Feedback, FoodItem


LOW_STOCK_THRESHOLD = int(os.getenv('LOW_STOCK_THRESHOLD', '5'))


def _cors(response: HttpResponse, request=None) -> HttpResponse:
    origin = request.headers.get('Origin') if request else None
    response['Access-Control-Allow-Origin'] = origin or '*'
    response['Access-Control-Allow-Headers'] = 'Content-Type'
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response['Access-Control-Allow-Credentials'] = 'true'
    return response


def _json_error(message: str, status: int, request=None) -> JsonResponse:
    return _cors(JsonResponse({'error': message}, status=status), request)


def _is_admin(user) -> bool:
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def _parse_date(value: str):
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return None


def _serialize_food_item(item: FoodItem, request) -> dict:
    image_url = request.build_absolute_uri(item.image.url) if item.image else ''
    return {
        'id': item.id,
        'name': item.name,
        'category': item.category,
        'quantity': item.quantity,
        'image_url': image_url,
        'created_at': item.created_at.isoformat(),
    }


def _serialize_feedback(item: Feedback) -> dict:
    return {
        'id': item.id,
        'student_name': item.student_name,
        'food_item_id': item.food_item_id,
        'food_item_name': item.food_item.name if item.food_item else '',
        'rating': item.rating,
        'message': item.message,
        'created_at': item.created_at.isoformat(),
    }


def _apply_food_filters(request, queryset):
    search = request.GET.get('search', '').strip()
    category = request.GET.get('category', '').strip().lower()
    date_from = _parse_date(request.GET.get('date_from', '').strip())
    date_to = _parse_date(request.GET.get('date_to', '').strip())

    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(category__icontains=search))
    if category:
        queryset = queryset.filter(category__iexact=category)
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    return queryset


def _apply_feedback_filters(request, queryset):
    search = request.GET.get('search', '').strip()
    category = request.GET.get('category', '').strip().lower()
    date_from = _parse_date(request.GET.get('date_from', '').strip())
    date_to = _parse_date(request.GET.get('date_to', '').strip())

    if search:
        queryset = queryset.filter(
            Q(student_name__icontains=search)
            | Q(message__icontains=search)
            | Q(food_item__name__icontains=search)
        )
    if category:
        queryset = queryset.filter(food_item__category__iexact=category)
    if date_from:
        queryset = queryset.filter(created_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(created_at__date__lte=date_to)

    return queryset


def _notify(message: str) -> None:
    notify_email_to = os.getenv('NOTIFY_EMAIL_TO', '').strip()
    if notify_email_to:
        recipients = [item.strip() for item in notify_email_to.split(',') if item.strip()]
        if recipients:
            send_mail(
                subject='CFMS Alert',
                message=message,
                from_email=os.getenv('EMAIL_FROM', 'noreply@cfms.local'),
                recipient_list=recipients,
                fail_silently=True,
            )

    whatsapp_webhook = os.getenv('WHATSAPP_WEBHOOK_URL', '').strip()
    if whatsapp_webhook:
        try:
            requests.post(whatsapp_webhook, json={'message': message}, timeout=5)
        except requests.RequestException:
            pass


def _notify_students_menu_update(item: FoodItem) -> None:
    user_model = get_user_model()
    student_emails = list(
        user_model.objects.filter(
            is_active=True,
            is_staff=False,
            is_superuser=False,
            email__isnull=False,
        )
        .exclude(email='')
        .values_list('email', flat=True)
    )
    if not student_emails:
        return

    meal = item.category.capitalize()
    subject = f'{meal} Menu Update'
    message = (
        f'Hello Student,\n\n'
        f'Your {item.category} menu is ready.\n'
        f'Item: {item.name}\n'
        f'Quantity: {item.quantity}\n\n'
        f'- CFMS'
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=os.getenv('EMAIL_FROM', 'noreply@cfms.local'),
        recipient_list=student_emails,
        fail_silently=True,
    )


def _build_unique_username(email: str) -> str:
    user_model = get_user_model()
    local_part = email.split('@', 1)[0].strip().lower()
    base = re.sub(r'[^a-z0-9_]+', '_', local_part).strip('_') or 'student'
    candidate = base[:30]
    suffix = 1
    while user_model.objects.filter(username=candidate).exists():
        trailer = f"_{suffix}"
        candidate = f"{base[:max(1, 30 - len(trailer))]}{trailer}"
        suffix += 1
        if suffix > 999:
            candidate = f"user_{uuid.uuid4().hex[:8]}"
            if not user_model.objects.filter(username=candidate).exists():
                break
    return candidate


@csrf_exempt
def auth_login(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200), request)

    if request.method != 'POST':
        return _json_error('Method not allowed.', 405, request)

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return _json_error('Invalid JSON body.', 400, request)

    username = str(payload.get('username', '')).strip()
    email = str(payload.get('email', '')).strip()
    password = str(payload.get('password', ''))
    requested_role = str(payload.get('role', '')).strip().lower()

    if requested_role and requested_role not in ('student', 'admin'):
        return _json_error('Role must be student or admin.', 400, request)

    if not email and not username:
        return _json_error('Email is required.', 400, request)
    if not password:
        return _json_error('Password is required.', 400, request)

    user = None
    if email:
        user_model = get_user_model()
        matched_user = user_model.objects.filter(email__iexact=email).first()
        if matched_user:
            username = matched_user.username
        elif requested_role == 'student':
            username = _build_unique_username(email)
            created_user = user_model.objects.create_user(
                username=username,
                email=email,
                password=password,
            )
            login(request, created_user)
            return _cors(
                JsonResponse(
                    {'username': created_user.username, 'role': 'student', 'new_user': True},
                    status=200,
                ),
                request,
            )
        else:
            return _json_error('Admin account not found. Ask existing admin to create it.', 401, request)

    user = authenticate(request, username=username, password=password)
    if not user:
        return _json_error('Invalid credentials.', 401, request)

    if not user.is_active:
        return _json_error('This account is inactive.', 403, request)

    role = 'admin' if _is_admin(user) else 'student'
    if requested_role and role != requested_role:
        return _json_error(f'This account is not allowed for {requested_role} login.', 403, request)

    login(request, user)
    return _cors(JsonResponse({'username': user.username, 'role': role}, status=200), request)


@csrf_exempt
def food_items(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200), request)

    if request.method == 'GET':
        queryset = _apply_food_filters(request, FoodItem.objects.all())
        items = [_serialize_food_item(item, request) for item in queryset]
        return _cors(JsonResponse({'items': items}), request)

    if request.method == 'POST':
        if not _is_admin(request.user):
            return _json_error('Admin access required.', 403, request)

        content_type = request.headers.get('Content-Type', '')
        if content_type.startswith('multipart/form-data'):
            source = request.POST
            image = request.FILES.get('image')
        else:
            image = None
            try:
                source = json.loads(request.body.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return _json_error('Invalid request body.', 400, request)

        name = str(source.get('name', '')).strip()
        category = str(source.get('category', '')).strip().lower()
        quantity = source.get('quantity', 1)

        if not name:
            return _json_error('Name is required.', 400, request)
        if category not in ('morning', 'lunch', 'dinner'):
            return _json_error('Category must be morning, lunch, or dinner.', 400, request)

        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return _json_error('Quantity must be a number.', 400, request)

        if quantity < 1:
            return _json_error('Quantity must be at least 1.', 400, request)

        item = FoodItem.objects.create(
            name=name,
            category=category,
            quantity=quantity,
            image=image,
        )

        _notify(f'New menu item published: {item.name} ({item.category}) qty={item.quantity}.')
        _notify_students_menu_update(item)
        if item.quantity <= LOW_STOCK_THRESHOLD:
            _notify(f'Low stock alert: {item.name} has quantity {item.quantity}.')

        return _cors(JsonResponse(_serialize_food_item(item, request), status=201), request)

    return _json_error('Method not allowed.', 405, request)


@csrf_exempt
def feedback_items(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200), request)

    if not request.user.is_authenticated:
        return _json_error('Authentication required.', 401, request)

    if request.method == 'GET':
        if not _is_admin(request.user):
            return _json_error('Admin access required.', 403, request)

        queryset = _apply_feedback_filters(request, Feedback.objects.select_related('food_item').all())
        feedbacks = [_serialize_feedback(item) for item in queryset]
        return _cors(JsonResponse({'feedbacks': feedbacks}), request)

    if request.method == 'POST':
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _json_error('Invalid JSON body.', 400, request)

        message = str(payload.get('message', '')).strip()
        rating = payload.get('rating')
        food_item_id = payload.get('food_item_id')

        if not message:
            return _json_error('Feedback message is required.', 400, request)

        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return _json_error('Rating must be a number from 1 to 5.', 400, request)

        if rating < 1 or rating > 5:
            return _json_error('Rating must be between 1 and 5.', 400, request)

        food_item = None
        if food_item_id:
            try:
                food_item = FoodItem.objects.get(id=int(food_item_id))
            except (FoodItem.DoesNotExist, TypeError, ValueError):
                return _json_error('Selected food item is invalid.', 400, request)

        feedback = Feedback.objects.create(
            student_name=request.user.username,
            food_item=food_item,
            rating=rating,
            message=message,
        )

        return _cors(JsonResponse(_serialize_feedback(feedback), status=201), request)

    return _json_error('Method not allowed.', 405, request)


@csrf_exempt
def feedback_analytics(request):
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}, status=200), request)

    if not _is_admin(request.user):
        return _json_error('Admin access required.', 403, request)

    queryset = Feedback.objects.select_related('food_item').filter(food_item__isnull=False)
    queryset = _apply_feedback_filters(request, queryset)

    top_rated = list(
        queryset.values('food_item__name')
        .annotate(avg_rating=Avg('rating'), count=Count('id'))
        .order_by('-avg_rating', '-count')[:8]
    )

    distribution = {
        '1': queryset.filter(rating=1).count(),
        '2': queryset.filter(rating=2).count(),
        '3': queryset.filter(rating=3).count(),
        '4': queryset.filter(rating=4).count(),
        '5': queryset.filter(rating=5).count(),
    }

    payload = {
        'top_rated': [
            {
                'food_name': item['food_item__name'],
                'avg_rating': round(float(item['avg_rating']), 2),
                'count': item['count'],
            }
            for item in top_rated
        ],
        'rating_distribution': distribution,
    }
    return _cors(JsonResponse(payload), request)


def _csv_response(filename: str, rows, headers):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


def _pdf_response(title: str, filename: str, lines):
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40

    pdf.setFont('Helvetica-Bold', 14)
    pdf.drawString(40, y, title)
    y -= 24

    pdf.setFont('Helvetica', 9)
    for line in lines:
        if y <= 40:
            pdf.showPage()
            pdf.setFont('Helvetica', 9)
            y = height - 40
        pdf.drawString(40, y, line[:130])
        y -= 14

    pdf.save()
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@csrf_exempt
def export_food_csv(request):
    if not _is_admin(request.user):
        return _json_error('Admin access required.', 403, request)

    queryset = _apply_food_filters(request, FoodItem.objects.all())
    rows = [
        [item.name, item.category, item.quantity, timezone.localtime(item.created_at).strftime('%Y-%m-%d %H:%M')]
        for item in queryset
    ]
    return _cors(
        _csv_response('food_history.csv', rows, ['Food Name', 'Session', 'Quantity', 'Created At']),
        request,
    )


@csrf_exempt
def export_feedback_csv(request):
    if not _is_admin(request.user):
        return _json_error('Admin access required.', 403, request)

    queryset = _apply_feedback_filters(request, Feedback.objects.select_related('food_item').all())
    rows = [
        [
            item.student_name,
            item.food_item.name if item.food_item else '',
            item.rating,
            item.message,
            timezone.localtime(item.created_at).strftime('%Y-%m-%d %H:%M'),
        ]
        for item in queryset
    ]
    return _cors(
        _csv_response(
            'feedback_history.csv',
            rows,
            ['Student', 'Food Item', 'Rating', 'Feedback', 'Submitted At'],
        ),
        request,
    )


@csrf_exempt
def export_food_pdf(request):
    if not _is_admin(request.user):
        return _json_error('Admin access required.', 403, request)

    queryset = _apply_food_filters(request, FoodItem.objects.all())
    lines = [
        f"{item.name} | {item.category} | qty={item.quantity} | {timezone.localtime(item.created_at).strftime('%Y-%m-%d %H:%M')}"
        for item in queryset
    ] or ['No food history found.']
    return _cors(_pdf_response('Food History Report', 'food_history.pdf', lines), request)


@csrf_exempt
def export_feedback_pdf(request):
    if not _is_admin(request.user):
        return _json_error('Admin access required.', 403, request)

    queryset = _apply_feedback_filters(request, Feedback.objects.select_related('food_item').all())
    lines = [
        (
            f"{item.student_name} | {item.food_item.name if item.food_item else 'N/A'} "
            f"| rating={item.rating} | {item.message} | {timezone.localtime(item.created_at).strftime('%Y-%m-%d %H:%M')}"
        )
        for item in queryset
    ] or ['No feedback history found.']
    return _cors(_pdf_response('Feedback Report', 'feedback_history.pdf', lines), request)
