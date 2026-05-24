from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db
from app.models.frame import Frame
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.user import User

router = APIRouter(prefix="/admin")


@router.get("/dashboard")
def dashboard(
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    total_users = db.scalar(select(func.count()).select_from(User)) or 0
    total_frames = db.scalar(select(func.count()).select_from(Frame)) or 0
    total_orders = db.scalar(select(func.count()).select_from(Order)) or 0
    printing_orders = (
        db.scalar(select(func.count()).select_from(Order).where(Order.status == OrderStatus.printing))
        or 0
    )
    revenue = (
        db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .select_from(Order)
            .where(Order.payment_status == PaymentStatus.paid)
        )
        or 0
    )

    return {
        "total_users": int(total_users),
        "total_frames": int(total_frames),
        "total_orders": int(total_orders),
        "printing_orders": int(printing_orders),
        "revenue": str(revenue),
    }
