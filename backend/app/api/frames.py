import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import AuthUser, require_admin
from app.core.database import get_db
from app.models.frame import Frame
from app.models.order import CartItem, OrderItem
from app.schemas.frame import FrameCreate, FrameRead, FrameUpdate

router = APIRouter(prefix="/frames")


@router.get("", response_model=list[FrameRead])
def list_frames(
    db: Session = Depends(get_db),
    size: str | None = Query(default=None),
    category: str | None = Query(default=None),
    name_exact: str | None = Query(default=None),
    min_price: Decimal | None = Query(default=None),
    max_price: Decimal | None = Query(default=None),
    search: str | None = Query(default=None),
    active_only: bool = Query(default=True),
) -> list[Frame]:
    filters = []
    if active_only:
        filters.append(Frame.is_active.is_(True))
    if size:
        filters.append(Frame.size == size)
    if category:
        filters.append(Frame.category == category)
    if name_exact:
        filters.append(func.lower(Frame.name) == name_exact.strip().lower())
    if min_price is not None:
        filters.append(Frame.price >= min_price)
    if max_price is not None:
        filters.append(Frame.price <= max_price)
    if search:
        term = f"%{search.lower()}%"
        filters.append(or_(func.lower(Frame.name).like(term), func.lower(Frame.slug).like(term)))

    stmt = select(Frame).order_by(Frame.created_at.desc())
    if filters:
        stmt = stmt.where(and_(*filters))
    return list(db.scalars(stmt))


@router.get("/{frame_ref}", response_model=FrameRead)
def get_frame(frame_ref: str, db: Session = Depends(get_db)) -> Frame:
    stmt = select(Frame).where(Frame.slug == frame_ref)
    frame = db.scalar(stmt)

    if frame is None:
        try:
            frame_uuid = uuid.UUID(frame_ref)
        except ValueError:
            frame_uuid = None
        if frame_uuid:
            frame = db.scalar(select(Frame).where(Frame.id == frame_uuid))

    if frame is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frame not found.")
    return frame


@router.post("", response_model=FrameRead, status_code=status.HTTP_201_CREATED)
def create_frame(
    payload: FrameCreate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_admin),
) -> Frame:
    exists = db.scalar(select(Frame).where(Frame.slug == payload.slug))
    if exists:
        raise HTTPException(status_code=409, detail="Frame slug already exists.")

    frame = Frame(**payload.model_dump())
    db.add(frame)
    db.commit()
    db.refresh(frame)
    return frame


@router.put("/{frame_id}", response_model=FrameRead)
def update_frame(
    frame_id: uuid.UUID,
    payload: FrameUpdate,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_admin),
) -> Frame:
    frame = db.scalar(select(Frame).where(Frame.id == frame_id))
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found.")

    if payload.slug and payload.slug != frame.slug:
        exists = db.scalar(select(Frame).where(Frame.slug == payload.slug))
        if exists:
            raise HTTPException(status_code=409, detail="Frame slug already exists.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(frame, key, value)
    db.commit()
    db.refresh(frame)
    return frame


@router.delete("/{frame_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_frame(
    frame_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: AuthUser = Depends(require_admin),
) -> None:
    frame = db.scalar(select(Frame).where(Frame.id == frame_id))
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame not found.")

    order_item_count = (
        db.scalar(
            select(func.count())
            .select_from(OrderItem)
            .where(OrderItem.frame_id == frame_id)
        )
        or 0
    )
    if int(order_item_count) > 0:
        raise HTTPException(
            status_code=409,
            detail="Frame is used in orders. Deactivate it instead of deleting.",
        )

    db.execute(delete(CartItem).where(CartItem.frame_id == frame_id))
    db.delete(frame)
    db.commit()
