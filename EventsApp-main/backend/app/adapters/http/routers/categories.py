from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.adapters.persistence.repositories import CategoryRepository
from app.bootstrap.db import get_session

router = APIRouter(tags=["categories"])


@router.get("/categories")
def list_categories(session: Session = Depends(get_session)):
    """List all available event categories."""
    repo = CategoryRepository(session)
    return [
        {"id": cat.id, "name": cat.name, "description": cat.description}
        for cat in repo.list_all()
    ]
