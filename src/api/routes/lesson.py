from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from openai import APIConnectionError, APIStatusError, RateLimitError
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies.auth import get_verified_user
from src.core.security import utc_now
from src.db.session import get_db
from src.models.lesson import LessonTemplate, LessonTemplateDraft
from src.models.user import User
from src.schemas.lesson import (
    LessonTemplateDetailRead,
    LessonTemplateDraftRead,
    LessonTemplateList,
    LessonTemplateNodesPatchRequest,
    LessonTemplatePublishRequest,
    LessonTemplatePublishResponse,
    LessonTemplateRead,
    LessonTemplateUpdateRequest,
)
from src.services.ai_service import generate_lesson_template_replacements
from src.services.ooxml_document_service import (
    DOCX_MEDIA_TYPE,
    OoxmlDocumentError,
    apply_template_replacements,
    editable_nodes_for_ai,
    parse_docx_template,
    patch_layout_nodes,
)
from src.services.storage import EXPORTS_DIR, ensure_storage_dirs, generate_id, safe_filename

router = APIRouter()


@router.get("/templates", response_model=LessonTemplateList)
def list_lesson_templates(
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateList:
    templates = db.scalars(
        select(LessonTemplate)
        .where(
            LessonTemplate.is_active.is_(True),
            (LessonTemplate.visibility == "public") | (LessonTemplate.owner_user_id == current_user.id),
        )
        .order_by(LessonTemplate.visibility.desc(), LessonTemplate.updated_at.desc())
    ).all()
    return LessonTemplateList(templates=[_template_read(template, current_user) for template in templates])


@router.patch("/templates/{template_id}", response_model=LessonTemplateDetailRead)
def update_lesson_template(
    template_id: int,
    payload: LessonTemplateUpdateRequest,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateDetailRead:
    template = _get_manageable_template(db, current_user, template_id)

    if payload.visibility == "public" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can publish public templates")
    if template.visibility == "public" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can edit public templates")

    if payload.name is not None:
        template.name = payload.name.strip()
    if payload.visibility is not None:
        template.visibility = payload.visibility
    if payload.is_active is not None:
        template.is_active = payload.is_active
    if payload.nodes is not None:
        template.layout_json = patch_layout_nodes(
            template.layout_json,
            [node.model_dump(exclude_unset=True) for node in payload.nodes],
        )
    template.updated_at = utc_now()
    db.add(template)
    db.commit()
    db.refresh(template)
    return _template_detail_read(template, current_user)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson_template(
    template_id: int,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> None:
    template = _get_manageable_template(db, current_user, template_id)
    if template.visibility == "public" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete public templates")
    template.is_active = False
    template.updated_at = utc_now()
    db.add(template)
    db.commit()
    return None


@router.get("/templates/{template_id}", response_model=LessonTemplateDetailRead)
def read_lesson_template(
    template_id: int,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateDetailRead:
    template = _get_accessible_template(db, current_user, template_id)
    return _template_detail_read(template, current_user)


@router.get("/admin/templates", response_model=LessonTemplateList)
def list_admin_lesson_templates(
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateList:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin permission is required")
    templates = db.scalars(
        select(LessonTemplate)
        .where(LessonTemplate.visibility == "public", LessonTemplate.is_active.is_(True))
        .order_by(LessonTemplate.updated_at.desc())
    ).all()
    return LessonTemplateList(templates=[_template_read(template, current_user) for template in templates])


@router.post("/template-drafts", response_model=LessonTemplateDraftRead, status_code=status.HTTP_201_CREATED)
async def create_template_draft(
    template_file: UploadFile = File(...),
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateDraftRead:
    filename = safe_filename(template_file.filename or "template.docx")
    if Path(filename).suffix.lower() != ".docx":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .docx templates are supported")

    docx_bytes = await template_file.read()
    try:
        layout, node_map = parse_docx_template(docx_bytes)
    except OoxmlDocumentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    now = utc_now()
    draft = LessonTemplateDraft(
        owner_user_id=current_user.id,
        filename=filename,
        original_docx_blob=docx_bytes,
        working_docx_blob=docx_bytes,
        layout_json=layout,
        node_map_json=node_map,
        status="draft",
        created_at=now,
        updated_at=now,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_read(draft)


@router.get("/template-drafts/{draft_id}", response_model=LessonTemplateDraftRead)
def read_template_draft(
    draft_id: int,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateDraftRead:
    draft = _get_user_draft(db, current_user, draft_id)
    return _draft_read(draft)


@router.patch("/template-drafts/{draft_id}/nodes", response_model=LessonTemplateDraftRead)
def patch_template_draft_nodes(
    draft_id: int,
    payload: LessonTemplateNodesPatchRequest,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplateDraftRead:
    draft = _get_user_draft(db, current_user, draft_id)
    if draft.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft templates can be edited")

    draft.layout_json = patch_layout_nodes(
        draft.layout_json,
        [node.model_dump(exclude_unset=True) for node in payload.nodes],
    )
    draft.updated_at = utc_now()
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_read(draft)


@router.post("/template-drafts/{draft_id}/publish", response_model=LessonTemplatePublishResponse)
def publish_template_draft(
    draft_id: int,
    payload: LessonTemplatePublishRequest,
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> LessonTemplatePublishResponse:
    draft = _get_user_draft(db, current_user, draft_id)
    if draft.status not in {"draft", "published"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template draft cannot be published")
    if payload.visibility == "public" and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can publish public templates")

    now = utc_now()
    template = LessonTemplate(
        owner_user_id=current_user.id,
        name=(payload.name or Path(draft.filename).stem or "Mẫu giáo án").strip(),
        filename=draft.filename,
        visibility=payload.visibility,
        docx_blob=draft.working_docx_blob,
        layout_json=draft.layout_json,
        node_map_json=draft.node_map_json,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    draft.status = "published"
    draft.updated_at = now
    db.add(template)
    db.add(draft)
    db.commit()
    db.refresh(template)
    return LessonTemplatePublishResponse(template=_template_read(template, current_user))


@router.post("/generate")
async def generate_lesson_document(
    template_id: int = Form(...),
    prompt: str = Form(...),
    truong: str = Form(""),
    to_chuyen_mon: str = Form(""),
    giao_vien: str = Form(""),
    lop: str = Form(""),
    mon_hoc: str = Form(""),
    ten_bai_day: str = Form(""),
    so_tiet: str = Form(""),
    current_user: User = Depends(get_verified_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    prompt = prompt.strip()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="prompt is required")

    template = _get_accessible_template(db, current_user, template_id)
    metadata = {
        "truong": truong.strip(),
        "to_chuyen_mon": to_chuyen_mon.strip(),
        "giao_vien": giao_vien.strip(),
        "lop": lop.strip(),
        "mon_hoc": mon_hoc.strip(),
        "ten_bai_day": ten_bai_day.strip(),
        "so_tiet": so_tiet.strip(),
    }
    editable_nodes = editable_nodes_for_ai(template.layout_json)

    try:
        replacements = await generate_lesson_template_replacements(
            editable_nodes=editable_nodes,
            prompt=prompt,
            metadata=metadata,
        )
    except RateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="OpenAI đang giới hạn token cho yêu cầu này. Hãy thử lại sau vài phút hoặc dùng template gọn hơn.",
        ) from exc
    except APIConnectionError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Không kết nối được OpenAI. Vui lòng thử lại sau.") from exc
    except APIStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI trả lỗi {exc.status_code}. Vui lòng thử lại hoặc đổi template.",
        ) from exc

    output_bytes = apply_template_replacements(
        template.docx_blob,
        template.node_map_json,
        template.layout_json,
        replacements,
    )
    ensure_storage_dirs()
    output_path = EXPORTS_DIR / f"{generate_id('giao_an')}.docx"
    output_path.write_bytes(output_bytes)
    filename = safe_filename(f"giao-an-{metadata['ten_bai_day'] or Path(template.filename).stem or 'tu-dong'}.docx")
    return FileResponse(output_path, media_type=DOCX_MEDIA_TYPE, filename=filename)


def _get_user_draft(db: Session, user: User, draft_id: int) -> LessonTemplateDraft:
    draft = db.get(LessonTemplateDraft, draft_id)
    if draft is None or draft.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template draft not found")
    return draft


def _get_user_template(db: Session, user: User, template_id: int) -> LessonTemplate:
    return _get_manageable_template(db, user, template_id)


def _get_accessible_template(db: Session, user: User, template_id: int) -> LessonTemplate:
    template = db.get(LessonTemplate, template_id)
    if template is None or not template.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if template.visibility != "public" and template.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


def _get_manageable_template(db: Session, user: User, template_id: int) -> LessonTemplate:
    template = db.get(LessonTemplate, template_id)
    if template is None or not template.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    if not _can_manage_template(template, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Template permission denied")
    return template


def _can_manage_template(template: LessonTemplate, user: User) -> bool:
    if template.visibility == "public":
        return user.role == "admin"
    return template.owner_user_id == user.id


def _draft_read(draft: LessonTemplateDraft) -> LessonTemplateDraftRead:
    return LessonTemplateDraftRead(
        id=draft.id,
        filename=draft.filename,
        status=draft.status,
        layout=draft.layout_json,
        summary=draft.layout_json.get("summary", {}),
    )


def _template_read(template: LessonTemplate, current_user: User) -> LessonTemplateRead:
    return LessonTemplateRead(
        id=template.id,
        name=template.name,
        filename=template.filename,
        visibility=template.visibility,
        is_active=template.is_active,
        can_edit=_can_manage_template(template, current_user),
        can_delete=_can_manage_template(template, current_user),
    )


def _template_detail_read(template: LessonTemplate, current_user: User) -> LessonTemplateDetailRead:
    return LessonTemplateDetailRead(
        id=template.id,
        name=template.name,
        filename=template.filename,
        visibility=template.visibility,
        is_active=template.is_active,
        can_edit=_can_manage_template(template, current_user),
        can_delete=_can_manage_template(template, current_user),
        layout=template.layout_json,
        summary=template.layout_json.get("summary", {}),
    )
