Set-Location -Path "c:/Users/jayas/Downloads/food management system/cfms/backend"
& "c:/Users/jayas/Downloads/food management system/.venv/Scripts/python.exe" "c:/Users/jayas/Downloads/food management system/.venv/Scripts/django-admin.py" startproject cfms_backend .
Set-Location -Path "c:/Users/jayas/Downloads/food management system/cfms/backend/cfms_backend"
& "c:/Users/jayas/Downloads/food management system/.venv/Scripts/python.exe" manage.py startapp core