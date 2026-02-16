import os
import sys
from django.core.management import execute_from_command_line

def create_django_project_and_app():
    # Create Django project
    project_path = os.path.join(os.getcwd())
    sys.argv = ['django-admin', 'startproject', 'cfms_backend', project_path]
    execute_from_command_line(sys.argv)
    
    # Create Django app
    os.chdir(os.path.join(project_path, 'cfms_backend'))
    sys.argv = ['manage.py', 'startapp', 'core']
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    create_django_project_and_app()