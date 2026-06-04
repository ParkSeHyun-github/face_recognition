from django.urls import path
from . import views

urlpatterns = [
    path('api/workout/feedback/', views.api_feedback),
    path('api/workout/clips/', views.api_clips),
    path('api/workout/start/', views.api_workout_start),
    path('api/workout/frame/', views.api_workout_frame),
    path('api/workout/finish/', views.api_workout_finish),
    path('api/workout/save_clip/', views.api_save_clip),
    path('api/workout/delete_clip/<int:clip_id>/', views.api_delete_clip),
]
