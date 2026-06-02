from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('register/', views.register_page, name='register'),
    path('login/', views.login_page, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # 관리자 페이지
    path('manage/', views.manage_page, name='manage'),
    path('manage/delete/<int:user_id>/', views.manage_delete, name='manage_delete'),

    # AJAX API
    path('api/register/start/', views.api_register_start, name='api_register_start'),
    path('api/register/frame/', views.api_register_frame, name='api_register_frame'),
    path('api/register/finish/', views.api_register_finish, name='api_register_finish'),
    path('api/login/frame/', views.api_login_frame, name='api_login_frame'),
]
