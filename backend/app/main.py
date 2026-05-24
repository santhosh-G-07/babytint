from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.bootstrap import bootstrap_dev_database
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    bootstrap_dev_database()
    yield


app = FastAPI(
    title="BabyTint API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

local_storage_dir = Path("local_storage")
local_storage_dir.mkdir(parents=True, exist_ok=True)
app.mount("/local-storage", StaticFiles(directory=local_storage_dir), name="local_storage")

app.include_router(api_router)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "babytint-backend"}
