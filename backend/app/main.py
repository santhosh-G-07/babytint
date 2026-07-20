from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.bootstrap import bootstrap_dev_database
from app.core.config import get_settings
from app.services.storage import get_local_storage_root

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_dev_database()
    yield


app = FastAPI(
    title="BabyTint API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

local_storage_dir = get_local_storage_root()
local_storage_dir.mkdir(parents=True, exist_ok=True)
app.mount("/local-storage", StaticFiles(directory=local_storage_dir), name="local_storage")

app.include_router(api_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "babytint-backend"}
