from __future__ import annotations

import json
import logging
import re

from openai import AsyncOpenAI

from src.config import get_settings

logger = logging.getLogger(__name__)

MAX_NODE_CHARS = 900
MAX_CHUNK_CHARS = 12000
MAX_OUTPUT_TOKENS = 3600


async def generate_lesson_plan_nodes(
    *,
    nodes: dict[str, str],
    prompt: str,
    metadata: dict[str, str],
) -> dict[str, str]:
    settings = get_settings()
    if not settings.openai_api_key:
        logger.warning("[ai_service] OPENAI_API_KEY is missing; using metadata-only fallback replacements.")
        return _fallback_replacements(nodes, metadata)

    metadata_json = json.dumps(metadata, ensure_ascii=False, indent=2)
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    compact_nodes = {node_id: _compact_node_text(text) for node_id, text in nodes.items() if text.strip()}
    chunks = _chunk_nodes_for_ai(compact_nodes)
    replacements: dict[str, str] = {}

    for index, chunk in enumerate(chunks, start=1):
        chunk_replacements = await _generate_chunk_replacements(
            client=client,
            model=settings.openai_model,
            chunk_nodes=chunk,
            source_nodes={node_id: nodes[node_id] for node_id in chunk},
            metadata=metadata,
            metadata_json=metadata_json,
            prompt=prompt,
            chunk_index=index,
            chunk_count=len(chunks),
        )
        replacements.update(chunk_replacements)

    return {key: value for key, value in replacements.items() if key in nodes}


async def generate_lesson_template_replacements(
    *,
    editable_nodes: list[dict[str, object]],
    prompt: str,
    metadata: dict[str, str],
) -> dict[str, str]:
    nodes = {
        str(node["node_id"]): _template_node_prompt_text(node)
        for node in editable_nodes
        if node.get("node_id") and str(node.get("role", "")) in {"generated", "field"}
    }
    if not nodes:
        return {}

    settings = get_settings()
    if not settings.openai_api_key:
        logger.warning("[ai_service] OPENAI_API_KEY is missing; using metadata-only fallback replacements.")
        return _fallback_replacements(nodes, metadata)

    metadata_json = json.dumps(metadata, ensure_ascii=False, indent=2)
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    compact_nodes = {node_id: _compact_node_text(text) for node_id, text in nodes.items() if text.strip()}
    chunks = _chunk_nodes_for_ai(compact_nodes)
    replacements: dict[str, str] = {}

    for index, chunk in enumerate(chunks, start=1):
        chunk_replacements = await _generate_chunk_replacements(
            client=client,
            model=settings.openai_model,
            chunk_nodes=chunk,
            source_nodes={node_id: nodes[node_id] for node_id in chunk},
            metadata=metadata,
            metadata_json=metadata_json,
            prompt=prompt,
            chunk_index=index,
            chunk_count=len(chunks),
            editable_only=True,
        )
        replacements.update(chunk_replacements)

    return {key: value for key, value in replacements.items() if key in nodes}


async def _generate_chunk_replacements(
    *,
    client: AsyncOpenAI,
    model: str,
    chunk_nodes: dict[str, str],
    source_nodes: dict[str, str],
    metadata: dict[str, str],
    metadata_json: str,
    prompt: str,
    chunk_index: int,
    chunk_count: int,
    editable_only: bool = False,
) -> dict[str, str]:
    elements_json = json.dumps(chunk_nodes, ensure_ascii=False, separators=(",", ":"))
    if editable_only:
        system_prompt = f"""
Bạn là một CHUYÊN GIA GIÁO DỤC CẤP CAO chuyên thiết kế Kế hoạch bài dạy chuẩn theo công văn 5512 của Bộ Giáo dục Việt Nam.
Bạn đang xử lý chunk {chunk_index}/{chunk_count} của một template Word đã được người dùng xác nhận node sinh nội dung.

NGUYÊN TẮC:
1. TẤT CẢ node dưới đây đều là node được phép sinh/thay nội dung.
2. Không tạo node ID mới. Không đổi cấu trúc bảng. Không trả markdown. Không giải thích.
3. Dựa vào prompt, metadata, vai trò node, section/table context và instruction để viết nội dung phù hợp.
4. Với node role=field, điền thông tin hành chính/ngắn gọn từ metadata nếu khớp.
5. Với node role=generated, viết nội dung giáo án mới; không giữ lại nội dung mẫu cũ nếu nó xuất hiện trong node.
6. Chỉ trả JSON object dạng: {{"replacements": {{"node_id": "text mới"}}}}.

METADATA:
{metadata_json}

DANH SÁCH NODE EDITABLE TRONG CHUNK NÀY:
{elements_json}
"""
    else:
        system_prompt = f"""
Bạn là một CHUYÊN GIA GIÁO DỤC CẤP CAO chuyên thiết kế Kế hoạch bài dạy chuẩn theo công văn 5512 của Bộ Giáo dục Việt Nam.
Bạn đang xử lý chunk {chunk_index}/{chunk_count} của một file Word mẫu đã được bóc thành node.

NGUYÊN TẮC SẢN PHẨM:
1. Chỉ giữ layout Word: thứ tự node, bảng, ô, tiêu đề mục, header cột, nhãn cố định.
2. Không giữ lại nội dung bài học cũ trong mẫu nếu đó là phần thân giáo án.
3. Viết lại toàn bộ phần thân giáo án theo bài mới, dựa trên prompt và metadata.
4. Nếu node là tiêu đề mục/header bảng/nhãn cố định như "Hoạt động của giáo viên", "Hoạt động của học sinh", "Nội dung", "Sản phẩm", hãy bỏ qua node đó để giữ nguyên.
5. Nếu node là thông tin hành chính, placeholder hoặc nội dung mẫu cũ trong thân giáo án, hãy trả về nội dung mới cho node đó.
6. Không tạo node ID mới. Không đổi cấu trúc bảng. Không trả markdown. Không giải thích.
7. Chỉ trả JSON object, dạng: {{"replacements": {{"node_id": "text mới"}}}}.

METADATA:
{metadata_json}

DANH SÁCH TẤT CẢ NODE TRONG CHUNK NÀY:
{elements_json}
"""
    response = await client.chat.completions.create(
        model=model,
        temperature=0.65,
        max_tokens=MAX_OUTPUT_TOKENS,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": system_prompt,
            },
            {"role": "user", "content": prompt},
        ],
    )
    raw_content = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError:
        logger.warning("[ai_service] Model returned invalid JSON for chunk %s; using fallback.", chunk_index)
        return _fallback_replacements(source_nodes, metadata)

    replacements = parsed.get("replacements", parsed)
    if not isinstance(replacements, dict):
        return _fallback_replacements(source_nodes, metadata)
    return {key: str(value) for key, value in replacements.items() if key in source_nodes}


def _chunk_nodes_for_ai(nodes: dict[str, str]) -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []
    current: dict[str, str] = {}
    current_size = 0

    for node_id, text in nodes.items():
        item_size = len(node_id) + len(text) + 8
        if current and current_size + item_size > MAX_CHUNK_CHARS:
            chunks.append(current)
            current = {}
            current_size = 0
        current[node_id] = text
        current_size += item_size

    if current:
        chunks.append(current)
    return chunks


def _compact_node_text(text: str) -> str:
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= MAX_NODE_CHARS:
        return compact
    return compact[:MAX_NODE_CHARS].rstrip() + "..."


def _template_node_prompt_text(node: dict[str, object]) -> str:
    payload = {
        "role": node.get("role", "generated"),
        "text": node.get("text", ""),
        "instruction": node.get("instruction", ""),
        "section_context": node.get("section_context", ""),
        "table_context": node.get("table_context", {}),
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _fallback_replacements(nodes: dict[str, str], metadata: dict[str, str]) -> dict[str, str]:
    replacements: dict[str, str] = {}
    placeholder_map = {
        "ten_truong": metadata.get("truong", ""),
        "truong": metadata.get("truong", ""),
        "to_chuyen_mon": metadata.get("to_chuyen_mon", ""),
        "giao_vien": metadata.get("giao_vien", ""),
        "lop": metadata.get("lop", ""),
        "mon_hoc": metadata.get("mon_hoc", ""),
        "ten_bai_day": metadata.get("ten_bai_day", ""),
        "ten_bai": metadata.get("ten_bai_day", ""),
        "so_tiet": metadata.get("so_tiet", ""),
    }

    for node_id, text in nodes.items():
        new_text = text
        for key, value in placeholder_map.items():
            new_text = re.sub(r"{{\s*" + re.escape(key) + r"\s*}}", value, new_text, flags=re.IGNORECASE)

        lowered = text.lower()
        if metadata.get("ten_bai_day") and ("tên bài" in lowered or "bài dạy" in lowered):
            new_text = _replace_after_colon(text, metadata["ten_bai_day"])
        elif metadata.get("mon_hoc") and "môn" in lowered:
            new_text = _replace_after_colon(text, metadata["mon_hoc"])
        elif metadata.get("lop") and "lớp" in lowered:
            new_text = _replace_after_colon(text, metadata["lop"])
        elif metadata.get("giao_vien") and ("giáo viên" in lowered or "gv" in lowered):
            new_text = _replace_after_colon(text, metadata["giao_vien"])
        elif metadata.get("truong") and ("trường" in lowered or "truong" in lowered):
            new_text = _replace_after_colon(text, metadata["truong"])

        if new_text != text:
            replacements[node_id] = new_text

    return replacements


def _replace_after_colon(original: str, value: str) -> str:
    if ":" in original:
        prefix = original.split(":", 1)[0]
        return f"{prefix}: {value}"
    return value
