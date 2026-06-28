from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

NodeRole = Literal["fixed", "generated", "field", "ignored"]
TemplateVisibility = Literal["personal", "public"]


class LessonTemplateRead(BaseModel):
    id: int
    name: str
    filename: str
    source: Literal["saved"] = "saved"
    visibility: TemplateVisibility = "personal"
    is_active: bool
    can_edit: bool = False
    can_delete: bool = False


class LessonTemplateList(BaseModel):
    templates: list[LessonTemplateRead]


class LessonTemplateDetailRead(LessonTemplateRead):
    layout: dict[str, Any]
    summary: dict[str, Any]


class LessonTemplateDraftRead(BaseModel):
    id: int
    filename: str
    status: str
    layout: dict[str, Any]
    summary: dict[str, Any]


class LessonTemplateNodePatch(BaseModel):
    node_id: str = Field(..., min_length=1)
    role: NodeRole | None = None
    text: str | None = None
    instruction: str | None = None


class LessonTemplateNodesPatchRequest(BaseModel):
    nodes: list[LessonTemplateNodePatch]


class LessonTemplatePublishRequest(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    visibility: TemplateVisibility = "personal"


class LessonTemplateUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    visibility: TemplateVisibility | None = None
    is_active: bool | None = None
    nodes: list[LessonTemplateNodePatch] | None = None


class LessonTemplatePublishResponse(BaseModel):
    template: LessonTemplateRead
