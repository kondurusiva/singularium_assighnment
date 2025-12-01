"""
URL routing for tasks API.
"""
from django.urls import path
from . import views

urlpatterns = [
    path('tasks/analyze/', views.analyze_tasks, name='analyze_tasks'),
    path('tasks/suggest/', views.suggest_tasks, name='suggest_tasks'),
    path('health/', views.health, name='health'),
]
