from django.urls import path
from . import views

urlpatterns = [
    path('workout/', views.workout_page, name='workout'),
    path('workout/feedback/', views.feedback_page, name='feedback'),
    path('workout/clips/', views.clips_page, name='clips'),

    path('api/workout/start/', views.api_workout_start, name='api_workout_start'),
    path('api/workout/frame/', views.api_workout_frame, name='api_workout_frame'),
    path('api/workout/finish/', views.api_workout_finish, name='api_workout_finish'),
    path('api/workout/save_clip/', views.api_save_clip, name='api_save_clip'),
    path('api/workout/delete_clip/<int:clip_id>/', views.api_delete_clip, name='api_delete_clip'),
]
