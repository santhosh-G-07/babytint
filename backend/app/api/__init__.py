from fastapi import APIRouter

from app.api import admin, auth, frames, orders, payment, settings, upload

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(frames.router, tags=["frames"])
api_router.include_router(orders.router, tags=["orders"])
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(payment.router, tags=["payment"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(settings.router, tags=["settings"])
