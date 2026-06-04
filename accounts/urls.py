from django.urls import path
from . import views

urlpatterns = [
    path('api/csrf/', views.api_csrf),
    path('api/me/', views.api_me),
    path('api/logout/', views.api_logout),
    path('api/dashboard/', views.api_dashboard),
    path('api/manage/', views.api_manage),
    path('api/manage/delete/<int:user_id>/', views.api_manage_delete),
    path('api/register/start/', views.api_register_start),
    path('api/register/frame/', views.api_register_frame),
    path('api/register/finish/', views.api_register_finish),
    path('api/login/frame/', views.api_login_frame),
]
