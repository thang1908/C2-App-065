from __future__ import annotations

import copy
import re
from collections.abc import Iterable
from io import BytesIO
from typing import Any
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from lxml import etree

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "v": "urn:schemas-microsoft-com:vml",
}

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
EDITABLE_ROLES = {"generated", "field"}
FIXED_ROLES = {"fixed", "ignored"}
WORD_XML_PREFIX = "word/"


class OoxmlDocumentError(RuntimeError):
    pass


def parse_docx_template(docx_bytes: bytes) -> tuple[dict[str, Any], dict[str, Any]]:
    parts = _read_docx_xml_parts(docx_bytes)
    if "word/document.xml" not in parts:
        raise OoxmlDocumentError("DOCX file does not contain word/document.xml")

    node_map: dict[str, Any] = {}
    elements: list[dict[str, Any]] = []
    summary = {
        "paragraph_count": 0,
        "table_count": 0,
        "node_count": 0,
        "editable_node_count": 0,
        "ignored_node_count": 0,
    }

    for part_name in _ordered_content_parts(parts):
        root = etree.fromstring(parts[part_name])
        part_prefix = _part_prefix(part_name)
        paragraph_indexes = {
            _element_path(paragraph): index
            for index, paragraph in enumerate(root.xpath(".//w:p", namespaces=NS), start=1)
        }
        part_elements, current_summary = _parse_part(
            root=root,
            part_name=part_name,
            part_prefix=part_prefix,
            paragraph_indexes=paragraph_indexes,
            node_map=node_map,
        )
        elements.extend(part_elements)
        for key, value in current_summary.items():
            summary[key] += value

    layout = {"summary": summary, "elements": elements}
    return layout, node_map


def patch_layout_nodes(layout: dict[str, Any], patches: Iterable[dict[str, Any]]) -> dict[str, Any]:
    next_layout = copy.deepcopy(layout)
    nodes = _layout_node_index(next_layout)

    for patch in patches:
        node = nodes.get(str(patch.get("node_id", "")))
        if not node:
            continue
        role = patch.get("role")
        if role in {"fixed", "generated", "field", "ignored"}:
            node["role"] = role
            node["editable"] = role in EDITABLE_ROLES
            if role == "generated":
                node["display_text"] = ""
            elif not node.get("display_text"):
                node["display_text"] = node.get("text", "")
        if "text" in patch and patch["text"] is not None:
            node["display_text"] = str(patch["text"])
        if "instruction" in patch and patch["instruction"] is not None:
            node["instruction"] = str(patch["instruction"])

    _refresh_layout_summary(next_layout)
    return next_layout


def editable_nodes_for_ai(layout: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = []
    for node in _iter_layout_nodes(layout):
        if node.get("role") not in EDITABLE_ROLES:
            continue
        text = node.get("text") or node.get("display_text") or node.get("instruction") or ""
        nodes.append(
            {
                "node_id": node["node_id"],
                "text": text,
                "role": node.get("role", "generated"),
                "instruction": node.get("instruction", ""),
                "section_context": node.get("section_context", ""),
                "table_context": node.get("table_context", {}),
            }
        )
    return nodes


def apply_template_replacements(docx_bytes: bytes, node_map: dict[str, Any], layout: dict[str, Any], replacements: dict[str, str]) -> bytes:
    final_replacements: dict[str, str] = {}
    for node in _iter_layout_nodes(layout):
        node_id = node["node_id"]
        role = node.get("role")
        if role == "ignored":
            continue
        if role == "generated":
            final_replacements[node_id] = replacements.get(node_id, "")
        elif role == "field":
            final_replacements[node_id] = replacements.get(node_id, node.get("display_text") or node.get("text") or "")
        elif role == "fixed":
            display_text = node.get("display_text", node.get("text", ""))
            if display_text != node.get("text", ""):
                final_replacements[node_id] = display_text

    return apply_node_replacements_to_docx(docx_bytes, node_map, final_replacements)


def apply_node_replacements_to_docx(docx_bytes: bytes, node_map: dict[str, Any], replacements: dict[str, str]) -> bytes:
    replacements_by_part: dict[str, dict[int, str]] = {}
    for node_id, replacement in replacements.items():
        node_ref = node_map.get(node_id)
        if not node_ref:
            continue
        part_name = node_ref.get("part")
        paragraph_index = node_ref.get("paragraph_index")
        if not isinstance(part_name, str) or not isinstance(paragraph_index, int):
            continue
        replacements_by_part.setdefault(part_name, {})[paragraph_index] = str(replacement)

    output = BytesIO()
    with ZipFile(BytesIO(docx_bytes), "r") as source_zip, ZipFile(output, "w", ZIP_DEFLATED) as target_zip:
        for item in source_zip.infolist():
            data = source_zip.read(item.filename)
            part_replacements = replacements_by_part.get(item.filename)
            if part_replacements:
                root = etree.fromstring(data)
                paragraphs = root.xpath(".//w:p", namespaces=NS)
                for paragraph_index, replacement in part_replacements.items():
                    if 1 <= paragraph_index <= len(paragraphs):
                        _replace_paragraph_text(paragraphs[paragraph_index - 1], replacement)
                data = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
            target_zip.writestr(item, data)
    return output.getvalue()


def _read_docx_xml_parts(docx_bytes: bytes) -> dict[str, bytes]:
    try:
        with ZipFile(BytesIO(docx_bytes), "r") as docx_zip:
            return {
                name: docx_zip.read(name)
                for name in docx_zip.namelist()
                if name == "word/document.xml" or re.fullmatch(r"word/(header|footer)\d+\.xml", name)
            }
    except BadZipFile as exc:
        raise OoxmlDocumentError("File is not a valid DOCX archive") from exc


def _ordered_content_parts(parts: dict[str, bytes]) -> list[str]:
    return ["word/document.xml", *sorted(name for name in parts if name != "word/document.xml")]


def _parse_part(
    *,
    root: etree._Element,
    part_name: str,
    part_prefix: str,
    paragraph_indexes: dict[str, int],
    node_map: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    summary = {"paragraph_count": 0, "table_count": 0, "node_count": 0, "editable_node_count": 0, "ignored_node_count": 0}
    elements: list[dict[str, Any]] = []
    current_section = ""

    for child in _top_level_blocks(root):
        if _is_tag(child, "p"):
            node = _paragraph_node(
                paragraph=child,
                part_name=part_name,
                part_prefix=part_prefix,
                paragraph_index=paragraph_indexes[_element_path(child)],
                node_map=node_map,
                section_context=current_section,
            )
            if node is None:
                continue
            elements.append(node)
            _count_node(summary, node)
            if node["role"] == "fixed" and _looks_like_heading(node.get("text", "")):
                current_section = node.get("text", "")
        elif _is_tag(child, "tbl"):
            table_index = summary["table_count"] + 1
            table = _table_element(
                table=child,
                part_name=part_name,
                part_prefix=part_prefix,
                paragraph_indexes=paragraph_indexes,
                node_map=node_map,
                table_index=table_index,
                section_context=current_section,
            )
            elements.append(table)
            summary["table_count"] += 1
            for node in _iter_table_nodes(table):
                _count_node(summary, node)

    return elements, summary


def _top_level_blocks(root: etree._Element) -> list[etree._Element]:
    body = root.find("w:body", namespaces=NS)
    container = body if body is not None else root
    return [child for child in container if _is_tag(child, "p") or _is_tag(child, "tbl")]


def _table_element(
    *,
    table: etree._Element,
    part_name: str,
    part_prefix: str,
    paragraph_indexes: dict[str, int],
    node_map: dict[str, Any],
    table_index: int,
    section_context: str,
) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    column_headers: list[str] = []
    current_phase = ""

    for row_index, row in enumerate(table.findall("w:tr", namespaces=NS), start=1):
        is_phase_row = _is_table_phase_row(row)
        is_header_row = row_index == 1 and _is_table_header_row(row)
        cells = []
        row_nodes: list[dict[str, Any]] = []
        for col_index, cell in enumerate(row.findall("w:tc", namespaces=NS), start=1):
            paragraphs = []
            for paragraph in cell.xpath("./w:p", namespaces=NS):
                node = _paragraph_node(
                    paragraph=paragraph,
                    part_name=part_name,
                    part_prefix=part_prefix,
                    paragraph_index=paragraph_indexes[_element_path(paragraph)],
                    node_map=node_map,
                    section_context=section_context,
                    table_context={
                        "table_index": table_index,
                        "row_index": row_index,
                        "col_index": col_index,
                        "column_header": column_headers[col_index - 1] if col_index <= len(column_headers) else "",
                        "phase": current_phase,
                    },
                    force_fixed=is_header_row,
                    in_table_body=not is_header_row and not is_phase_row,
                    force_phase=is_phase_row,
                )
                if node is None:
                    continue
                paragraphs.append(node)
                row_nodes.append(node)

            role = _dominant_role(paragraphs)
            cells.append(
                {
                    "col_index": col_index,
                    "grid_span": _cell_grid_span(cell),
                    "role": role,
                    "editable": any(paragraph.get("editable") for paragraph in paragraphs),
                    "text": "\n".join(paragraph.get("display_text", "") for paragraph in paragraphs).strip(),
                    "original_text": "\n".join(paragraph.get("text", "") for paragraph in paragraphs).strip(),
                    "paragraphs": paragraphs,
                }
            )

        if is_header_row:
            column_headers = [cell["original_text"] for cell in cells]
        phase_candidate = _row_phase_candidate(row_nodes, len(cells))
        if phase_candidate:
            current_phase = phase_candidate
            for node in row_nodes:
                if node.get("role") == "fixed":
                    node["table_context"]["phase"] = current_phase
        rows.append({"row_index": row_index, "cells": cells})

    return {"type": "table", "table_index": table_index, "rows": rows}


def _paragraph_node(
    *,
    paragraph: etree._Element,
    part_name: str,
    part_prefix: str,
    paragraph_index: int,
    node_map: dict[str, Any],
    section_context: str,
    table_context: dict[str, Any] | None = None,
    force_fixed: bool = False,
    in_table_body: bool = False,
    force_phase: bool = False,
) -> dict[str, Any] | None:
    text = _paragraph_text(paragraph).strip()
    has_object = _has_drawing_or_object(paragraph)
    if not text and not has_object:
        return None

    node_id = f"{part_prefix}_p_{paragraph_index:04d}"
    role, confidence, reason = _classify_paragraph(
        paragraph,
        text,
        has_object=has_object,
        force_fixed=force_fixed,
        in_table_body=in_table_body,
        force_phase=force_phase,
    )
    editable = role in EDITABLE_ROLES
    node_map[node_id] = {
        "part": part_name,
        "paragraph_index": paragraph_index,
        "kind": "paragraph",
    }
    return {
        "type": "object" if has_object and not text else "paragraph",
        "node_id": node_id,
        "text": text,
        "original_text": text,
        "display_text": "" if role == "generated" else text,
        "role": role,
        "editable": editable,
        "container_path": f"{part_name}#p[{paragraph_index}]",
        "section_context": section_context,
        "table_context": table_context or {},
        "confidence": confidence,
        "reason": reason,
        "instruction": "",
    }


def _classify_paragraph(
    paragraph: etree._Element,
    text: str,
    *,
    has_object: bool,
    force_fixed: bool,
    in_table_body: bool,
    force_phase: bool,
) -> tuple[str, float, str]:
    compact = " ".join(text.split())
    if has_object:
        return "ignored", 1.0, "paragraph contains drawing/object"
    if "{{" in compact and "}}" in compact:
        return "field", 1.0, "placeholder"
    if _looks_like_administrative_field(compact):
        return "field", 0.9, "administrative field"
    if force_fixed:
        return "fixed", 0.95, "first table row"
    if force_phase:
        return "fixed", 0.9, "table phase row"
    if in_table_body:
        return "generated", 0.78, "table body content"
    if _looks_like_body_content(compact):
        return "generated", 0.8, "lesson body content"
    if _has_heading_style(paragraph):
        return "fixed", 0.95, "heading style"
    if len(compact) <= 120 and _looks_like_heading(compact):
        return "fixed", 0.84, "heading shape"
    return "generated", 0.72, "body content"


def _paragraph_text(paragraph: etree._Element) -> str:
    return "".join(paragraph.xpath(".//w:t/text()", namespaces=NS))


def _has_drawing_or_object(paragraph: etree._Element) -> bool:
    return bool(paragraph.xpath(".//w:drawing | .//w:pict | .//w:object", namespaces=NS))


def _has_heading_style(paragraph: etree._Element) -> bool:
    style_values = paragraph.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS)
    if any("heading" in value.lower() or value.lower().startswith(("title", "subtitle")) for value in style_values):
        return True
    return bool(paragraph.xpath("./w:pPr/w:outlineLvl", namespaces=NS))


def _looks_like_administrative_field(text: str) -> bool:
    normalized = _normalize_spaces(text)
    lowered = normalized.casefold()
    return bool(
        re.match(
            r"^(?:[-–•]\s*)?(?:"
            r"trường|tổ(?:\s+chuyên\s+môn)?|giáo\s*viên|gv|lớp|môn(?:\s+học)?|"
            r"bài(?:\s+học|\s+dạy)?|bài\s*\d+|tiết|tuần|ngày\s+soạn|ngày\s+dạy|"
            r"thời\s*lượng|năm\s+học|họ\s+và\s+tên"
            r")\b\s*[:：.\-]",
            lowered,
        )
    )


def _looks_like_heading(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized:
        return False

    if _looks_formula_like(normalized) or _looks_like_body_content(normalized):
        return False
    if _looks_like_major_heading(normalized):
        return True
    if _looks_like_structural_label(normalized):
        return True

    letters = [char for char in normalized if char.isalpha()]
    return bool(letters) and len(normalized) <= 120 and _uppercase_ratio(letters) > 0.72


def _looks_like_major_heading(text: str) -> bool:
    normalized = _normalize_spaces(text)
    lowered = normalized.casefold()
    if re.match(r"^(?:chương|phần)\s+[ivxlcdm0-9]+(?:\s*[:.\-]|\b)", lowered):
        return True
    if re.match(r"^[ivxlcdm]+\.?\s*[a-zà-ỹ]", lowered):
        return any(
            keyword in lowered
            for keyword in (
                "mục tiêu",
                "yêu cầu cần đạt",
                "thiết bị",
                "đồ dùng",
                "tiến trình",
                "hoạt động dạy học",
                "kế hoạch đánh giá",
                "hồ sơ",
            )
        )
    if re.match(r"^[a-z]\.?\s*", normalized):
        return "hoạt động" in lowered and _uppercase_ratio([char for char in normalized if char.isalpha()]) > 0.65
    return False


def _looks_like_structural_label(text: str) -> bool:
    normalized = _normalize_spaces(text)
    lowered = normalized.casefold().rstrip(":：").strip()
    label = _strip_label_marker(lowered)

    exact_labels = {
        "mục tiêu",
        "yêu cầu cần đạt",
        "năng lực",
        "năng lực chung",
        "năng lực riêng",
        "phẩm chất",
        "thiết bị dạy học và học liệu",
        "đồ dùng dạy học",
        "tiến trình dạy học",
        "hoạt động dạy học",
        "kế hoạch đánh giá",
        "hồ sơ dạy học",
        "hướng dẫn về nhà",
        "hoạt động của giáo viên",
        "hoạt động của học sinh",
        "hoạt động của gv và hs",
        "sản phẩm dự kiến",
        "hình thức đánh giá",
        "phương pháp đánh giá",
        "công cụ đánh giá",
        "ghi chú",
        "gv",
        "hs",
    }
    if label in exact_labels:
        return True
    if label.startswith(("hoạt động khởi động", "hoạt động khám phá", "hoạt động luyện tập", "hoạt động vận dụng")):
        return True
    return bool(
        re.match(r"^\d+\s*-\s*(?:gv|hs)$", label)
        or (re.match(r"^\d+[\.)]\s+", normalized) and label in {"năng lực", "phẩm chất"})
    )


def _looks_like_body_content(text: str) -> bool:
    normalized = _normalize_spaces(text)
    lowered = normalized.casefold()
    if not normalized:
        return False
    if _looks_formula_like(normalized):
        return True
    if _looks_like_answer_option(normalized):
        return True
    if re.match(r"^[a-zà-ỹ][\.)]\s*", normalized) and normalized[0].islower():
        return True
    if re.match(r"^(?:[-+*]\s*)?bước\s*\d+\b", lowered):
        return True
    if re.match(r"^[+\-]?\s*\d+\s*[: ]\s*[A-ZIVXLCDMÀ-Ỹ]{1,8}\.?\s*$", normalized):
        return True
    if re.match(r"^(?:[-+*]\s*)?(?:gv|hs|giáo\s*viên|học\s*sinh)\b", lowered):
        return True
    if re.match(r"^(?:[-+*]\s*)?(?:vd|ví\s*dụ|tq|kh|luyện\s*tập|vận\s*dụng|thử\s*thách|cách\s+\d+|\?)\b", lowered):
        return True
    return False


def _looks_formula_like(text: str) -> bool:
    normalized = _normalize_spaces(text)
    return bool(
        re.search(r"[=∈∉≤≥{}\[\]|]|[A-ZÀ-Ỹa-zà-ỹ]\s*[;|]\s*[A-ZÀ-Ỹa-zà-ỹ0-9]", normalized)
        or re.search(r"\d+\s*;\s*\d+", normalized)
    )


def _looks_like_answer_option(text: str) -> bool:
    match = re.match(r"^[a-d]\.\s*(.+)", text, flags=re.IGNORECASE)
    if not match:
        return False
    tail = match.group(1).strip()
    if not tail:
        return False
    if "hoạt động" in tail.casefold() and _uppercase_ratio([char for char in tail if char.isalpha()]) > 0.65:
        return False
    return _looks_formula_like(tail) or _uppercase_ratio([char for char in tail if char.isalpha()]) < 0.7


def _strip_label_marker(text: str) -> str:
    label = re.sub(r"^(?:[-+*•]\s*)", "", text).strip()
    label = re.sub(r"^(?:[ivxlcdm]+|[a-z]|\d+)[\.)]\s*", "", label, flags=re.IGNORECASE).strip()
    label = re.sub(r"^\d+\s*-\s*", "", label).strip()
    return label


def _normalize_spaces(text: str) -> str:
    return " ".join(text.split())


def _uppercase_ratio(letters: list[str]) -> float:
    if not letters:
        return 0.0
    return sum(char.isupper() for char in letters) / len(letters)


def _cell_grid_span(cell: etree._Element) -> int:
    values = cell.xpath("./w:tcPr/w:gridSpan/@w:val", namespaces=NS)
    if not values:
        return 1
    try:
        return max(1, int(values[0]))
    except ValueError:
        return 1


def _is_table_phase_row(row: etree._Element) -> bool:
    cells = row.findall("w:tc", namespaces=NS)
    cell_texts = [_cell_text(cell) for cell in cells]
    nonempty_texts = [text for text in cell_texts if text]
    if len(nonempty_texts) != 1:
        return False
    return _looks_like_table_phase(nonempty_texts[0])


def _is_table_header_row(row: etree._Element) -> bool:
    cells = row.findall("w:tc", namespaces=NS)
    texts = [_cell_text(cell) for cell in cells]
    nonempty_texts = [text for text in texts if text]
    if len(nonempty_texts) < 2:
        return False

    joined = " ".join(nonempty_texts).casefold()
    header_keywords = (
        "hoạt động",
        "sản phẩm",
        "dự kiến",
        "giáo viên",
        "học sinh",
        "hình thức",
        "phương pháp",
        "công cụ",
        "ghi chú",
        "nội dung",
        "yêu cầu",
        "câu hỏi",
        "đáp án",
    )
    if any(keyword in joined for keyword in header_keywords):
        return True
    return all(_looks_like_header_cell_text(text) for text in nonempty_texts)


def _looks_like_header_cell_text(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized or len(normalized) > 80:
        return False
    if _looks_formula_like(normalized) or re.search(r"\d", normalized):
        return False
    words = normalized.split()
    letters = [char for char in normalized if char.isalpha()]
    return len(words) <= 5 and bool(letters) and _uppercase_ratio(letters) >= 0.35


def _cell_text(cell: etree._Element) -> str:
    paragraphs = [
        _paragraph_text(paragraph).strip()
        for paragraph in cell.xpath("./w:p", namespaces=NS)
        if _paragraph_text(paragraph).strip()
    ]
    return "\n".join(paragraphs).strip()


def _looks_like_table_phase(text: str) -> bool:
    normalized = " ".join(text.split())
    lowered = normalized.lower()
    if not normalized:
        return False
    if re.match(r"^([0-9]+|[ivxlcdm]+)[\.)]\s+", normalized, flags=re.IGNORECASE):
        return normalized.endswith(":") or any(
            keyword in lowered
            for keyword in (
                "khởi động",
                "khám phá",
                "luyện tập",
                "vận dụng",
                "hình thành",
                "hoạt động",
            )
        )
    return bool(re.match(r"^hoạt\s*động\s+\d+\s*[:\-.]", lowered, flags=re.IGNORECASE))


def _row_phase_candidate(row_nodes: list[dict[str, Any]], cell_count: int) -> str:
    visible_nodes = [node for node in row_nodes if node.get("text")]
    if len(visible_nodes) != 1:
        return ""
    node = visible_nodes[0]
    text = node.get("text", "")
    if node.get("role") == "fixed" and _looks_like_table_phase(text) and cell_count >= 1:
        return text
    return ""


def _dominant_role(nodes: list[dict[str, Any]]) -> str:
    if not nodes:
        return "ignored"
    if any(node["role"] == "generated" for node in nodes):
        return "generated"
    if any(node["role"] == "field" for node in nodes):
        return "field"
    if all(node["role"] == "ignored" for node in nodes):
        return "ignored"
    return "fixed"


def _count_node(summary: dict[str, int], node: dict[str, Any]) -> None:
    summary["node_count"] += 1
    summary["editable_node_count"] += int(bool(node.get("editable")))
    summary["ignored_node_count"] += int(node.get("role") == "ignored")
    if node.get("type") == "paragraph":
        summary["paragraph_count"] += 1


def _iter_table_nodes(table: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for row in table.get("rows", []):
        for cell in row.get("cells", []):
            yield from cell.get("paragraphs", [])


def _iter_layout_nodes(layout: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for element in layout.get("elements", []):
        if element.get("type") == "table":
            yield from _iter_table_nodes(element)
        elif "node_id" in element:
            yield element


def _layout_node_index(layout: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {node["node_id"]: node for node in _iter_layout_nodes(layout)}


def _refresh_layout_summary(layout: dict[str, Any]) -> None:
    summary = {
        "paragraph_count": 0,
        "table_count": 0,
        "node_count": 0,
        "editable_node_count": 0,
        "ignored_node_count": 0,
    }
    for element in layout.get("elements", []):
        if element.get("type") == "table":
            summary["table_count"] += 1
            for node in _iter_table_nodes(element):
                _count_node(summary, node)
        elif "node_id" in element:
            _count_node(summary, element)
    layout["summary"] = summary


def _part_prefix(part_name: str) -> str:
    if part_name == "word/document.xml":
        return "document"
    return part_name.removeprefix(WORD_XML_PREFIX).removesuffix(".xml").replace("/", "_")


def _is_tag(element: etree._Element, local_name: str) -> bool:
    return etree.QName(element).localname == local_name


def _element_path(element: etree._Element) -> str:
    return element.getroottree().getpath(element)


def _replace_paragraph_text(paragraph: etree._Element, text: str) -> None:
    first_run_properties = paragraph.find("w:r/w:rPr", namespaces=NS)
    first_run_properties = copy.deepcopy(first_run_properties) if first_run_properties is not None else None

    for child in list(paragraph):
        if _is_tag(child, "r") or _is_tag(child, "hyperlink"):
            paragraph.remove(child)

    if not text:
        return

    for index, line in enumerate(text.split("\n")):
        run = etree.Element(_qn("w:r"))
        if first_run_properties is not None:
            run.append(copy.deepcopy(first_run_properties))
        if index:
            run.append(etree.Element(_qn("w:br")))
        text_element = etree.Element(_qn("w:t"))
        if line != line.strip():
            text_element.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        text_element.text = line
        run.append(text_element)
        paragraph.append(run)


def _qn(name: str) -> str:
    prefix, local_name = name.split(":", 1)
    return f"{{{NS[prefix]}}}{local_name}"
