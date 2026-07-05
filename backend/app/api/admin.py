from fastapi import APIRouter, Depends
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db
from app.models.frame import Frame
from app.models.order import CartItem, Order, OrderItem, OrderStatus, PaymentStatus
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


@router.post("/frames/reset-catalog")
def reset_frame_catalog(
    _: AuthUser = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    total_frames = int(db.scalar(select(func.count()).select_from(Frame)) or 0)
    used_frame_ids = set(db.scalars(select(OrderItem.frame_id).distinct()))

    cleared_cart_items = int(db.scalar(select(func.count()).select_from(CartItem)) or 0)
    db.execute(delete(CartItem))

    deactivated_frames = 0
    if used_frame_ids:
        used_frames = list(db.scalars(select(Frame).where(Frame.id.in_(used_frame_ids))))
        for frame in used_frames:
            frame.is_active = False
            frame.slug = f"archived-{frame.id}"
            deactivated_frames += 1

        delete_result = db.execute(delete(Frame).where(Frame.id.not_in(used_frame_ids)))
        deleted_frames = int(delete_result.rowcount or 0)
    else:
        delete_result = db.execute(delete(Frame))
        deleted_frames = int(delete_result.rowcount or 0)

    db.commit()

    return {
        "ok": True,
        "total_frames": total_frames,
        "deleted_frames": deleted_frames,
        "deactivated_frames": deactivated_frames,
        "cleared_cart_items": cleared_cart_items,
    }
