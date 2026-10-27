from django.urls import path
from clinic import views
from clinic.search import search_pets
from clinic.registration import register_pet
from clinic.doctors import doctor_action
from clinic.medical import medical_action
from clinic.visit_status import visit_status_action
from clinic.checkout import checkout_action
from clinic.gateway import gateway, gateway_script
from clinic.prescription import prescription_calculate
from clinic.frontend_assets import frontend_asset
from clinic.records import create_record
from clinic.period_reconciliation import reconcile

from clinic.line_booking import review_page,review_action

urlpatterns = [
    path("booking-review.html", review_page),
    path("api/booking-review/<str:action>/", review_action),
    path('', views.home),
    path('index.html', views.home),
    path('booking.html', views.booking),
    path('imaging-share.html', views.imaging),
    path('assets/integrated-gateway.js', gateway_script),
    path('assets/frontend/<path:asset_path>', frontend_asset),
    path('api/records/<str:entity>/', create_record),
    path('api/period-reconciliation/', reconcile),
    path('api/prescription/calculate/', prescription_calculate),
    path('api/checkout/<str:action>/', checkout_action),
    path('api/medical-visit/<str:action>/', visit_status_action),
    path('api/medical/<str:action>/', medical_action),
    path('api/clinic/<str:action>/', doctor_action),
    path('api/registration/', register_pet),
    path('api/search/pets/', search_pets),
    path('api/health/', views.health),
    path('api/session/', views.session),
    path('api/supabase/<path:upstream_path>', gateway),
]
