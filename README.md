# PRODUCT TECHNICAL SPEC

# AI LESSON PLAN DOCUMENT ENGINE

## 1. Mục tiêu hệ thống

Xây dựng hệ thống web cho phép giáo viên:

1. Đăng nhập vào hệ thống.
2. Chọn mẫu giáo án có sẵn hoặc upload một giáo án đầy đủ `.docx`.
3. Hệ thống tự trích xuất cấu trúc tài liệu.
4. Hệ thống nhận diện đâu là khung cố định, đâu là nội dung mẫu cần thay thế.
5. Người dùng kiểm tra lại các vùng AI sẽ sinh nội dung.
6. Người dùng nhập yêu cầu tạo giáo án mới.
7. AI sinh nội dung mới theo đúng layout của mẫu.
8. Nội dung được streaming trực tiếp vào editor bên phải.
9. Người dùng chỉnh sửa trực tiếp trên web.
10. Export lại thành `.docx` hoặc `.pdf`.

Hệ thống phải xử lý được nhiều loại mẫu giáo án khác nhau, bao gồm:

* Mẫu chỉ có heading và paragraph.
* Mẫu có bullet list.
* Mẫu có numbered list.
* Mẫu có bảng 2 cột.
* Mẫu có bảng nhiều cột.
* Mẫu có bảng merge cell.
* Mẫu có ảnh trong bảng.
* Mẫu có header/footer.
* Mẫu có page break hoặc section break.

---

# 2. Nguyên tắc kiến trúc

Không được thiết kế theo kiểu:

```text
DOCX → text → AI → DOCX
```

Vì cách này sẽ mất layout và sai khi gặp nhiều form khác nhau.

Phải thiết kế theo kiểu:

```text
DOCX
→ OOXML Parser
→ Document AST
→ Template Extraction
→ Template Definition
→ AI Content Generation
→ Rendered Document AST
→ Web Editor
→ DOCX Export
```

---

# 3. Các khái niệm cốt lõi

## 3.1 Document AST

Document AST là cấu trúc trung gian biểu diễn tài liệu dưới dạng cây.

Ví dụ:

```json
{
  "type": "document",
  "children": [
    {
      "id": "block_1",
      "type": "heading",
      "text": "I. YÊU CẦU CẦN ĐẠT",
      "level": 1
    },
    {
      "id": "block_2",
      "type": "paragraph",
      "text": "Trình bày được vai trò của công nghệ..."
    },
    {
      "id": "block_3",
      "type": "table",
      "rows": []
    }
  ]
}
```

Document AST không phải nội dung cuối cùng. Nó là bản đồ cấu trúc của tài liệu.

---

## 3.2 Template Definition

Template Definition là kết quả sau khi hệ thống phân tích một giáo án đầy đủ và biến nó thành mẫu.

Nó gồm:

```text
layout_ast
fields
static_blocks
asset_map
style_map
```

Ví dụ:

```json
{
  "template_id": "tpl_001",
  "layout_ast": {},
  "fields": [
    {
      "field_id": "lesson_title",
      "label": "Tên bài học",
      "type": "plain_text",
      "location": "block_3"
    },
    {
      "field_id": "requirements",
      "label": "Yêu cầu cần đạt",
      "type": "bullet_list",
      "location": "block_7"
    }
  ]
}
```

---

## 3.3 Content AST

Content AST là nội dung AI sinh ra theo field.

Ví dụ:

```json
{
  "lesson_title": "BÀI 2: NHÀ SÁNG CHẾ",
  "requirements": [
    "Nêu được vai trò của nhà sáng chế trong đời sống.",
    "Kể tên được một số nhà sáng chế tiêu biểu.",
    "Có ý thức trân trọng các sản phẩm sáng tạo."
  ]
}
```

---

## 3.4 Rendered Document AST

Rendered Document AST là kết quả sau khi ghép:

```text
Template Definition + Content AST
```

Ví dụ field:

```json
{
  "type": "field",
  "field_id": "requirements"
}
```

được thay bằng:

```json
{
  "type": "bullet_list",
  "items": [
    "Nêu được vai trò của nhà sáng chế trong đời sống.",
    "Kể tên được một số nhà sáng chế tiêu biểu."
  ]
}
```

---

# 4. Công nghệ sử dụng

## 4.1 Frontend

Sử dụng:

```text
Next.js
TypeScript
TailwindCSS
Zustand
TipTap hoặc custom block editor
```

Frontend có nhiệm vụ:

* Hiển thị danh sách template.
* Preview template.
* Hiển thị Document Editor.
* Nhận streaming từ backend.
* Cho phép sửa trực tiếp block, table cell, field.
* Gửi content đã sửa về backend.
* Gọi export DOCX/PDF.

---

## 4.2 Backend

Sử dụng:

```text
FastAPI
Pydantic
SQLAlchemy
PostgreSQL
Redis
Celery
MinIO hoặc S3
```

Backend có nhiệm vụ:

* Auth.
* Quản lý template.
* Upload DOCX.
* Parse DOCX.
* Extract template.
* Gọi AI.
* Streaming generation.
* Export DOCX/PDF.
* Versioning.

---

## 4.3 Document Engine

Không dùng `python-docx` làm parser chính.

Parser chính phải dùng:

```text
zipfile
lxml
OOXML
```

Có thể dùng `python-docx` làm helper cho một số tác vụ đơn giản, nhưng không được phụ thuộc hoàn toàn vào nó.

Document Engine gồm:

```text
OOXML Parser
AST Builder
Template Extractor
Field Classifier
Document Renderer
DOCX Exporter
PDF Exporter
```

---

# 5. Cấu trúc thư mục đề xuất

## 5.1 Backend

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── auth.py
│   │   ├── templates.py
│   │   ├── lesson_plans.py
│   │   ├── files.py
│   │   └── exports.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── storage.py
│   ├── models/
│   │   ├── user.py
│   │   ├── template.py
│   │   ├── lesson_plan.py
│   │   ├── document_asset.py
│   │   └── version.py
│   ├── schemas/
│   │   ├── template.py
│   │   ├── lesson_plan.py
│   │   └── document_ast.py
│   ├── services/
│   │   ├── document_engine/
│   │   │   ├── ooxml_parser.py
│   │   │   ├── ast_builder.py
│   │   │   ├── template_extractor.py
│   │   │   ├── field_classifier.py
│   │   │   ├── renderer.py
│   │   │   ├── docx_exporter.py
│   │   │   └── pdf_exporter.py
│   │   ├── ai/
│   │   │   ├── prompt_builder.py
│   │   │   ├── content_generator.py
│   │   │   └── streaming.py
│   │   ├── rag/
│   │   │   ├── retriever.py
│   │   │   ├── chunker.py
│   │   │   └── embeddings.py
│   │   └── files/
│   │       ├── upload_service.py
│   │       └── asset_service.py
│   └── workers/
│       ├── template_jobs.py
│       └── export_jobs.py
```

---

## 5.2 Frontend

```text
frontend/
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── templates/
│   └── lesson-plans/[id]/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── templates/
│   │   ├── TemplateLibrary.tsx
│   │   ├── TemplateCard.tsx
│   │   ├── TemplatePreview.tsx
│   │   └── TemplateReviewPanel.tsx
│   ├── editor/
│   │   ├── DocumentEditor.tsx
│   │   ├── BlockRenderer.tsx
│   │   ├── ParagraphBlock.tsx
│   │   ├── HeadingBlock.tsx
│   │   ├── TableBlock.tsx
│   │   ├── TableCell.tsx
│   │   ├── ImageBlock.tsx
│   │   └── FieldBlock.tsx
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   └── StreamingStatus.tsx
│   └── export/
│       └── ExportToolbar.tsx
├── lib/
│   ├── api.ts
│   ├── sse.ts
│   └── types.ts
└── store/
    ├── templateStore.ts
    └── lessonPlanStore.ts
```

---

# 6. Database schema

## 6.1 users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    hashed_password TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'teacher',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6.2 lesson_templates

```sql
CREATE TABLE lesson_templates (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(50) NOT NULL,
    original_file_url TEXT,
    status VARCHAR(50) DEFAULT 'processing',
    layout_ast JSONB,
    template_definition JSONB,
    preview_ast JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

`source_type`:

```text
system
uploaded
```

`status`:

```text
processing
needs_review
ready
failed
```

---

## 6.3 template_fields

```sql
CREATE TABLE template_fields (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES lesson_templates(id),
    field_id VARCHAR(255) NOT NULL,
    label TEXT,
    field_type VARCHAR(100),
    location_block_id VARCHAR(255),
    confidence FLOAT,
    instruction TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6.4 lesson_plans

```sql
CREATE TABLE lesson_plans (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES lesson_templates(id),
    title VARCHAR(255),
    subject VARCHAR(100),
    grade VARCHAR(50),
    duration VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft',
    content_ast JSONB,
    rendered_ast JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6.5 lesson_plan_files

```sql
CREATE TABLE lesson_plan_files (
    id UUID PRIMARY KEY,
    lesson_plan_id UUID REFERENCES lesson_plans(id),
    file_name VARCHAR(255),
    file_url TEXT,
    file_type VARCHAR(100),
    extracted_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6.6 document_assets

```sql
CREATE TABLE document_assets (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES users(id),
    template_id UUID REFERENCES lesson_templates(id),
    lesson_plan_id UUID REFERENCES lesson_plans(id),
    asset_type VARCHAR(50),
    file_url TEXT,
    original_path TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 6.7 lesson_plan_versions

```sql
CREATE TABLE lesson_plan_versions (
    id UUID PRIMARY KEY,
    lesson_plan_id UUID REFERENCES lesson_plans(id),
    version_number INT,
    content_ast JSONB,
    rendered_ast JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# 7. Document AST schema

## 7.1 Root document

```json
{
  "id": "doc_001",
  "type": "document",
  "metadata": {
    "page_size": "A4",
    "orientation": "portrait"
  },
  "styles": {},
  "children": []
}
```

---

## 7.2 Paragraph block

```json
{
  "id": "block_001",
  "type": "paragraph",
  "text": "Nội dung đoạn văn",
  "style": {
    "font_family": "Times New Roman",
    "font_size": 14,
    "bold": false,
    "italic": false,
    "underline": false,
    "align": "justify",
    "line_spacing": 1.15
  },
  "role": "content"
}
```

---

## 7.3 Heading block

```json
{
  "id": "block_002",
  "type": "heading",
  "level": 1,
  "text": "I. YÊU CẦU CẦN ĐẠT",
  "style": {
    "bold": true,
    "align": "left"
  },
  "role": "structural_label"
}
```

---

## 7.4 Bullet list

```json
{
  "id": "block_003",
  "type": "bullet_list",
  "items": [
    {
      "text": "Trình bày được vai trò của công nghệ.",
      "style": {}
    }
  ],
  "role": "example_content"
}
```

---

## 7.5 Table

```json
{
  "id": "block_004",
  "type": "table",
  "style": {
    "border": true,
    "width": "100%"
  },
  "rows": [
    {
      "id": "row_001",
      "cells": [
        {
          "id": "cell_001",
          "rowspan": 1,
          "colspan": 1,
          "width": "50%",
          "role": "table_header",
          "blocks": []
        }
      ]
    }
  ]
}
```

---

## 7.6 Image

```json
{
  "id": "block_005",
  "type": "image",
  "asset_id": "asset_001",
  "width": 400,
  "height": 240,
  "alt": "",
  "role": "image_placeholder"
}
```

---

## 7.7 Field

```json
{
  "id": "block_006",
  "type": "field",
  "field_id": "requirements",
  "field_type": "bullet_list",
  "label": "Yêu cầu cần đạt",
  "placeholder": "AI sẽ sinh nội dung tại đây",
  "style": {},
  "source_block_ids": ["block_003"]
}
```

---

# 8. Role classification

Mỗi block cần được phân loại role.

Các role bắt buộc:

```text
structural_label
example_content
table_header
reusable_static_text
image_placeholder
field
unknown
```

Ý nghĩa:

## structural_label

Tiêu đề mục hoặc nhãn cố định.

Ví dụ:

```text
I. YÊU CẦU CẦN ĐẠT
II. ĐỒ DÙNG DẠY HỌC
III. HOẠT ĐỘNG DẠY HỌC
```

Giữ nguyên trong template.

## example_content

Nội dung của bài mẫu cũ.

Ví dụ:

```text
Trình bày được vai trò của sản phẩm công nghệ trong đời sống.
```

Chuyển thành field để AI sinh bài mới.

## table_header

Tiêu đề cột hoặc tiêu đề hàng trong bảng.

Ví dụ:

```text
Hoạt động của giáo viên
Hoạt động của học sinh
```

Giữ nguyên.

## reusable_static_text

Text có thể giữ nguyên cho nhiều bài.

Ví dụ:

```text
IV. ĐIỀU CHỈNH SAU BÀI DẠY:
........................................................................
```

Có thể giữ nguyên hoặc chuyển thành field tùy user.

## image_placeholder

Ảnh minh họa trong giáo án.

Có thể giữ nguyên hoặc cho user thay.

## field

Vùng AI cần sinh nội dung.

## unknown

Không chắc chắn. Cần user review.

---

# 9. OOXML Parser chi tiết

## 9.1 Không dùng parser dựa trên text

Không chỉ đọc `paragraph.text`.

Phải đọc cấu trúc OOXML:

```text
w:p
w:r
w:t
w:tbl
w:tr
w:tc
w:drawing
w:numPr
w:pStyle
w:gridSpan
w:vMerge
```

---

## 9.2 Parse DOCX

DOCX là zip.

Pseudo code:

```python
def parse_docx(file_path: str) -> DocumentAST:
    package = unzip_docx(file_path)

    document_xml = read_xml(package, "word/document.xml")
    styles_xml = read_xml(package, "word/styles.xml")
    numbering_xml = read_xml(package, "word/numbering.xml")
    relationships = read_relationships(package)

    style_map = parse_styles(styles_xml)
    numbering_map = parse_numbering(numbering_xml)
    asset_map = extract_media(package, relationships)

    body = document_xml.find("w:body")

    children = []

    for child in body:
        if child.tag == "w:p":
            children.append(parse_paragraph(child, style_map, numbering_map, asset_map))
        elif child.tag == "w:tbl":
            children.append(parse_table(child, style_map, numbering_map, asset_map))

    return DocumentAST(children=children)
```

---

## 9.3 Parse paragraph

```python
def parse_paragraph(p, style_map, numbering_map, asset_map):
    text_runs = []
    images = []

    for r in p.findall("w:r"):
        text = extract_text_from_run(r)
        run_style = extract_run_style(r)

        drawing = find_drawing(r)
        if drawing:
            image = extract_image_from_drawing(drawing, asset_map)
            images.append(image)

        text_runs.append({
            "text": text,
            "style": run_style
        })

    paragraph_style = extract_paragraph_style(p, style_map)

    if has_numbering(p):
        block_type = detect_list_type(p, numbering_map)
    elif is_heading_style(paragraph_style):
        block_type = "heading"
    else:
        block_type = "paragraph"

    if images and not text_runs:
        return image block

    return {
        "id": generate_id(),
        "type": block_type,
        "text": concat_runs(text_runs),
        "runs": text_runs,
        "style": paragraph_style
    }
```

---

## 9.4 Parse table

```python
def parse_table(tbl, style_map, numbering_map, asset_map):
    rows = []

    for tr in tbl.findall("w:tr"):
        cells = []

        for tc in tr.findall("w:tc"):
            cell_blocks = []

            for child in tc:
                if child.tag == "w:p":
                    cell_blocks.append(parse_paragraph(child, style_map, numbering_map, asset_map))
                elif child.tag == "w:tbl":
                    cell_blocks.append(parse_table(child, style_map, numbering_map, asset_map))

            cells.append({
                "id": generate_id(),
                "rowspan": extract_rowspan(tc),
                "colspan": extract_colspan(tc),
                "width": extract_cell_width(tc),
                "style": extract_cell_style(tc),
                "blocks": cell_blocks
            })

        rows.append({
            "id": generate_id(),
            "cells": cells
        })

    return {
        "id": generate_id(),
        "type": "table",
        "style": extract_table_style(tbl),
        "rows": rows
    }
```

---

# 10. Template Extraction chi tiết

## 10.1 Input

```json
DocumentAST
```

Đây là giáo án đầy đủ, không phải mẫu rỗng.

## 10.2 Output

```json
TemplateDefinition
```

Gồm:

```text
layout_ast có field placeholder
fields metadata
confidence score
review required blocks
```

---

## 10.3 Pipeline

```text
DocumentAST
↓
Rule-based role classification
↓
LLM-based role classification
↓
Field grouping
↓
Placeholder replacement
↓
Template Review
↓
Approved Template Definition
```

---

## 10.4 Rule-based classification

Dùng regex và style.

### Heading detection

```text
^I\.
^II\.
^III\.
^IV\.
^[A-Z]\.
^\d+\.
```

Nếu block có style bold/uppercase và đứng đầu dòng thì tăng score heading.

### Table header detection

Nếu là dòng đầu bảng và text ngắn, bold, center:

```text
Hoạt động của giáo viên
Hoạt động của học sinh
Nội dung
Cách tiến hành
Sản phẩm
```

thì role = table_header.

### Example content detection

Nếu block nằm sau heading và không phải heading thì role = example_content.

### Static text detection

Nếu text dạng:

```text
................................................................
Ngày ... tháng ... năm ...
Kí duyệt
Điều chỉnh sau bài dạy
```

thì role = reusable_static_text.

---

## 10.5 LLM classification

Sau rule-based, gọi LLM để xác nhận.

Input cho LLM là AST rút gọn:

```json
[
  {
    "block_id": "b1",
    "type": "heading",
    "text": "I. YÊU CẦU CẦN ĐẠT",
    "style": {
      "bold": true
    },
    "parent": "document"
  },
  {
    "block_id": "b2",
    "type": "paragraph",
    "text": "Trình bày được vai trò của sản phẩm công nghệ...",
    "parent_heading": "I. YÊU CẦU CẦN ĐẠT"
  }
]
```

Prompt:

```text
Bạn đang phân tích một giáo án đã soạn đầy đủ để biến nó thành template.

Nhiệm vụ:
Phân loại từng block thành một trong các role:
- structural_label
- example_content
- table_header
- reusable_static_text
- image_placeholder
- unknown

Quy tắc:
- Tiêu đề mục như I, II, III thường là structural_label.
- Nội dung cụ thể của bài học cũ thường là example_content.
- Header bảng giữ nguyên.
- Dòng chấm để giáo viên điền có thể là reusable_static_text hoặc field tùy ngữ cảnh.
- Không được coi toàn bộ văn bản là layout cố định.

Trả về JSON:
{
  "blocks": [
    {
      "block_id": "...",
      "role": "...",
      "confidence": 0.0,
      "reason": "..."
    }
  ]
}
```

---

# 11. Field grouping

Không tạo field cho từng dòng nhỏ nếu cùng một mục.

Ví dụ:

```text
I. YÊU CẦU CẦN ĐẠT
- dòng 1
- dòng 2
- dòng 3
```

Phải nhóm thành một field:

```json
{
  "field_id": "requirements",
  "type": "bullet_list",
  "source_block_ids": ["b2", "b3", "b4"]
}
```

---

Với bảng:

```text
Hoạt động của giáo viên | Hoạt động của học sinh
```

Có thể nhóm theo cell hoặc theo activity row.

Nếu bảng rõ activity row:

```json
{
  "field_id": "activity_1_teacher",
  "type": "markdown",
  "source_cell_id": "cell_1"
}
```

```json
{
  "field_id": "activity_1_student",
  "type": "markdown",
  "source_cell_id": "cell_2"
}
```

---

# 12. Template Review UI

Sau khi upload và extract, bắt buộc hiển thị màn review.

## 12.1 UI yêu cầu

Bên phải hiển thị tài liệu.

Mỗi block có highlight:

```text
Xanh: sẽ giữ nguyên
Vàng: AI sẽ viết lại
Đỏ: không chắc chắn
Xám: ảnh / placeholder
```

User có thể chọn:

```text
Giữ nguyên
Cho AI viết lại
Đổi tên field
Gộp field
Tách field
Xóa khỏi mẫu
```

---

## 12.2 Khi user xác nhận

Backend lưu:

```text
template_definition.status = ready
```

Chỉ template ready mới được dùng để generate giáo án mới.

---

# 13. AI Content Generation

## 13.1 Input

```json
{
  "lesson_info": {
    "subject": "Công nghệ",
    "grade": "3",
    "lesson_title": "Nhà sáng chế",
    "duration": "2 tiết"
  },
  "template_fields": [
    {
      "field_id": "requirements",
      "type": "bullet_list",
      "label": "Yêu cầu cần đạt",
      "instruction": "Sinh yêu cầu cần đạt phù hợp bài học"
    }
  ],
  "knowledge_context": "..."
}
```

---

## 13.2 Output

```json
{
  "requirements": [
    "Nêu được vai trò của nhà sáng chế trong đời sống.",
    "Kể được một số sản phẩm sáng chế quen thuộc.",
    "Có ý thức tôn trọng lao động sáng tạo."
  ]
}
```

---

## 13.3 Prompt

```text
Bạn là trợ lý soạn giáo án cho giáo viên phổ thông Việt Nam.

Nhiệm vụ:
- Chỉ sinh nội dung cho các field được cung cấp.
- Không thay đổi field_id.
- Không thêm field ngoài danh sách.
- Không sinh layout.
- Không sinh HTML.
- Không sinh DOCX.
- Nếu field nằm trong bảng, sinh nội dung phù hợp với tiêu đề cột, hàng và ngữ cảnh.
- Nội dung phải phù hợp môn học, lớp học, thời lượng và chương trình.
- Ưu tiên tài liệu người dùng upload.
- Nếu thiếu tài liệu, dùng knowledge_context từ RAG.

lesson_info:
{lesson_info}

template_fields:
{template_fields}

knowledge_context:
{knowledge_context}

Return strict JSON only.
```

---

# 14. Streaming protocol

Sử dụng Server-Sent Events.

Endpoint:

```text
POST /api/lesson-plans/{id}/generate-stream
```

Events:

```text
field_start
field_delta
field_done
generation_done
generation_error
```

Ví dụ:

```text
event: field_start
data: {"field_id": "requirements"}

event: field_delta
data: {"field_id": "requirements", "delta": "Nêu được vai trò"}

event: field_delta
data: {"field_id": "requirements", "delta": " của nhà sáng chế..."}

event: field_done
data: {"field_id": "requirements"}

event: generation_done
data: {"lesson_plan_id": "lp_001"}
```

Frontend append delta vào field tương ứng.

---

# 15. Web Editor chi tiết

Editor không được chỉ là một textarea lớn.

Phải là block editor.

## 15.1 Render logic

```tsx
function BlockRenderer({ block, contentAst }) {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} />;

    case "paragraph":
      return <ParagraphBlock block={block} />;

    case "field":
      return <FieldBlock block={block} value={contentAst[block.field_id]} />;

    case "table":
      return <TableBlock block={block} contentAst={contentAst} />;

    case "image":
      return <ImageBlock block={block} />;

    default:
      return <UnknownBlock block={block} />;
  }
}
```

---

## 15.2 FieldBlock

```tsx
function FieldBlock({ block, value }) {
  return (
    <div className="field-block">
      <textarea
        value={value || ""}
        onChange={(e) => updateField(block.field_id, e.target.value)}
      />
    </div>
  );
}
```

---

## 15.3 TableBlock

```tsx
function TableBlock({ block, contentAst }) {
  return (
    <table>
      <tbody>
        {block.rows.map(row => (
          <tr key={row.id}>
            {row.cells.map(cell => (
              <td
                key={cell.id}
                rowSpan={cell.rowspan}
                colSpan={cell.colspan}
              >
                {cell.blocks.map(child => (
                  <BlockRenderer
                    key={child.id}
                    block={child}
                    contentAst={contentAst}
                  />
                ))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

# 16. Rendering Template + Content

Function:

```ts
renderDocument(templateDefinition, contentAst)
```

Logic:

```text
Traverse layout_ast.
Nếu gặp field:
  lấy contentAst[field_id]
  render theo field_type
Nếu gặp block thường:
  render nguyên block
Nếu gặp table:
  traverse từng cell
```

---

# 17. DOCX Exporter

Không export từ markdown.

Phải export từ Rendered Document AST.

## 17.1 Input

```json
{
  "rendered_ast": {}
}
```

## 17.2 Output

```text
lesson_plan.docx
```

## 17.3 Yêu cầu

Exporter phải hỗ trợ:

```text
heading
paragraph
bullet_list
numbered_list
table
merged cell
image
page break
header/footer
```

---

## 17.4 DOCX generation

Sử dụng OOXML generation.

Có thể dùng thư viện helper để tạo package DOCX, nhưng phải giữ mô hình:

```text
Rendered AST → OOXML → DOCX
```

Không dùng:

```text
Rendered AST → Markdown → DOCX
```

---

# 18. API specification

## 18.1 Template APIs

### Upload template

```text
POST /api/templates/upload
```

Input:

```text
file: DOCX
```

Process:

```text
save file
parse OOXML
build Document AST
extract template
save status = needs_review
```

Response:

```json
{
  "template_id": "tpl_001",
  "status": "needs_review"
}
```

---

### Get template

```text
GET /api/templates/{template_id}
```

Response:

```json
{
  "id": "tpl_001",
  "name": "Mẫu Công nghệ",
  "status": "needs_review",
  "layout_ast": {},
  "template_definition": {},
  "fields": []
}
```

---

### Update template field roles

```text
PATCH /api/templates/{template_id}/review
```

Body:

```json
{
  "field_updates": [
    {
      "block_id": "b12",
      "action": "convert_to_field",
      "field_id": "requirements",
      "field_type": "bullet_list"
    },
    {
      "block_id": "b13",
      "action": "keep_static"
    }
  ]
}
```

---

### Approve template

```text
POST /api/templates/{template_id}/approve
```

Response:

```json
{
  "template_id": "tpl_001",
  "status": "ready"
}
```

---

## 18.2 Lesson plan APIs

### Create lesson plan

```text
POST /api/lesson-plans
```

Body:

```json
{
  "template_id": "tpl_001",
  "subject": "Công nghệ",
  "grade": "3",
  "lesson_title": "Nhà sáng chế",
  "duration": "2 tiết"
}
```

---

### Get lesson plan

```text
GET /api/lesson-plans/{id}
```

---

### Generate stream

```text
POST /api/lesson-plans/{id}/generate-stream
```

Body:

```json
{
  "message": "Tạo giáo án phù hợp học sinh lớp 3"
}
```

---

### Update content

```text
PATCH /api/lesson-plans/{id}/content
```

Body:

```json
{
  "content_ast": {}
}
```

---

### Export DOCX

```text
POST /api/lesson-plans/{id}/export-docx
```

Response:

```json
{
  "download_url": "..."
}
```

---

# 19. RAG integration

RAG không nằm trong parser.

RAG chỉ cung cấp knowledge_context cho AI.

Pipeline:

```text
lesson_info + user_message
↓
query vector DB
↓
retrieve top_k chunks
↓
rerank
↓
knowledge_context
↓
AI generator
```

Nguồn RAG:

```text
SGK
Chương trình GDPT 2018
Tài liệu upload
Ngân hàng bài tập
```

---

# 20. Error handling

## Upload lỗi

Nếu parser không đọc được:

```json
{
  "error": "cannot_parse_docx",
  "message": "Không thể phân tích file DOCX này."
}
```

## Field confidence thấp

Nếu field classification confidence < 0.65:

```text
status = needs_review
```

UI phải yêu cầu user xác nhận.

## Generate lỗi

Nếu AI không trả JSON đúng:

```text
retry with repair prompt
```

Nếu vẫn lỗi:

```text
show error and allow retry
```

---

# 21. Quy trình user đầy đủ

```text
User upload giáo án đầy đủ
↓
Backend parse OOXML
↓
Tạo Document AST
↓
AI + rule phân loại block
↓
Tạo Template Definition
↓
UI review vùng field/static
↓
User chỉnh và approve
↓
User nhập bài mới
↓
RAG lấy context
↓
AI sinh content
↓
Streaming vào editor
↓
User sửa trực tiếp
↓
Lưu version
↓
Export DOCX/PDF
```

---

# 22. Development phases

## Phase 1 — Core Document Engine

Làm:

```text
OOXML parser
Document AST
Table model
Image asset extraction
Style extraction cơ bản
```

## Phase 2 — Template Extraction

Làm:

```text
Role classifier
Field grouping
Template definition
Review UI
```

## Phase 3 — Editor

Làm:

```text
Render AST
Edit field
Edit table cell
Streaming update
Version save
```

## Phase 4 — AI generation

Làm:

```text
Prompt builder
Structured JSON output
SSE streaming
Repair JSON
```

## Phase 5 — Export

Làm:

```text
Rendered AST to DOCX
Rendered AST to PDF
Image reinsert
Table reinsert
```

## Phase 6 — Production hardening

Làm:

```text
Auth
Permission
Storage
Queue
Retry
Logging
Observability
```

---

# 23. Definition of Done

Hệ thống đạt yêu cầu khi:

1. Upload được giáo án đầy đủ `.docx`.
2. Parse được heading, paragraph, table, image.
3. Tách được structural label và example content.
4. User review được vùng AI sẽ viết lại.
5. Tạo được template ready.
6. AI sinh nội dung theo đúng field.
7. Streaming vào đúng vị trí trong editor.
8. Sửa được trực tiếp trong bảng.
9. Export lại DOCX.
10. Không hard-code riêng cho một mẫu giáo án.
11. Với mẫu có bảng khác nhau, hệ thống vẫn render/edit được.
12. Nếu hệ thống không chắc chắn, phải đưa về trạng thái `needs_review`, không được tự đoán hoàn toàn.

---

# 24. Điều tuyệt đối không làm

Không làm:

```text
DOCX → plain text → AI → markdown → DOCX
```

Không hard-code:

```text
Mục tiêu
Thiết bị
Tiến trình
Hoạt động giáo viên
Hoạt động học sinh
```

Không giả định:

```text
Bảng luôn có 2 cột
Mẫu luôn theo 5512
Giáo án upload là mẫu rỗng
```

Không để AI quyết định layout.

AI chỉ sinh nội dung.

Layout do Document Engine quản lý.
