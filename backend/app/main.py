"""Buddy API entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import (
    analyze,
    auth,
    crisis,
    entries,
    export,
    health,
    insights,
    reflector,
)
from .routers import settings as settings_router


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(entries.router)
app.include_router(insights.router)
app.include_router(export.router)
app.include_router(analyze.router)
app.include_router(reflector.router)
app.include_router(crisis.router)


@app.get("/")
def root() -> dict:
    return {"name": settings.PROJECT_NAME, "version": settings.VERSION, "docs": "/docs"}
