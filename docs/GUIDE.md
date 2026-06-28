# TÀI LIỆU THIẾT KẾ DEMO HỆ THỐNG AI SOẠN GIÁO ÁN THEO MẪU TRƯỜNG

## 1. Mục tiêu demo

Xây dựng demo hệ thống AI hỗ trợ giáo viên tạo giáo án theo mẫu có sẵn.

Trong bản demo này, hệ thống chưa cần sinh giáo án chính xác tuyệt đối theo chuẩn giáo dục. Mục tiêu chính là chứng minh được luồng sản phẩm:

1. Giáo viên hoặc admin upload mẫu giáo án Word.
2. Hệ thống đọc mẫu và tạo form tương ứng.
3. Giáo viên nhập thông tin bài học.
4. Hệ thống dùng RAG từ sách giáo khoa để lấy nội dung liên quan.
5. AI sinh dữ liệu giáo án theo form.
6. Giáo viên xem và chỉnh sửa nội dung trên web.
7. Hệ thống xuất lại file Word theo đúng mẫu ban đầu.

Phạm vi demo:

* Chỉ làm môn Toán.
* Chỉ làm một khối, ví dụ Toán lớp 10.
* Chỉ hỗ trợ file mẫu `.docx`.
* Mẫu giáo án nên có placeholder.
* Dữ liệu kiến thức lấy từ RAG sách giáo khoa.
* AI sinh nội dung theo system prompt.
* Chưa cần kiểm tra đúng/sai sâu về nghiệp vụ giáo dục.
* Chưa cần PostgreSQL phức tạp cho curriculum.
* Chưa cần nhiều mẫu SGK.
* Chưa cần phân quyền phức tạp.

---

# 2. Ý tưởng cốt lõi

Hệ thống không để AI sinh trực tiếp file Word.

AI chỉ sinh dữ liệu JSON.

File Word mẫu có các placeholder như:

```text
{{TEN_BAI}}
{{MUC_TIEU}}
{{THIET_BI}}
{{KHOI_DONG}}
{{HOAT_DONG_KIEN_THUC}}
{{LUYEN_TAP}}
{{VAN_DUNG}}
```

AI sẽ sinh JSON tương ứng:

```json
{
  "TEN_BAI": "Bất phương trình bậc nhất hai ẩn",
  "MUC_TIEU": "...",
  "THIET_BI": "...",
  "KHOI_DONG": "...",
  "HOAT_DONG_KIEN_THUC": "...",
  "LUYEN_TAP": "...",
  "VAN_DUNG": "..."
}
```

Sau đó backend lấy JSON này đổ lại vào file Word mẫu.

Luồng đúng:

```text
DOCX Template + RAG Context + System Prompt
↓
LLM sinh JSON
↓
React hiển thị form
↓
Giáo viên chỉnh sửa
↓
Export DOCX
```

---

# 3. Kiến trúc tổng thể

```text
Frontend React
│
├── Upload Template UI
├── Upload SGK UI
├── Lesson Generate Form
├── Dynamic Lesson Editor
└── Export Button

Backend FastAPI
│
├── template-service
│   ├── upload template
│   ├── parse placeholder
│   └── create dynamic form
│
├── rag-service
│   ├── upload textbook
│   ├── extract text
│   ├── chunk text
│   ├── create embeddings
│   └── retrieve relevant chunks
│
├── ai-service
│   ├── build prompt
│   ├── call LLM
│   ├── validate JSON
│   └── repair JSON if needed
│
├── lesson-service
│   ├── generate lesson
│   ├── save generated JSON
│   └── regenerate field/block
│
└── export-service
    ├── render DOCX
    └── return download file
```

---

# 4. Công nghệ đề xuất cho demo

## Backend

* FastAPI
* Python
* Uvicorn
* Pydantic
* python-docx hoặc docxtpl
* pypdf hoặc pdfplumber để đọc PDF
* Chroma hoặc Qdrant local để làm vector store
* OpenAI/Gemini/Qwen tùy API bạn có

## Frontend

* React
* Vite
* Axios
* React Hook Form
* Tailwind CSS nếu muốn làm nhanh giao diện
* TipTap hoặc textarea đơn giản cho editor

## Storage demo

Bản demo chưa cần hệ thống file phức tạp.

Có thể lưu local:

```text
storage/
├── templates/
│   └── template_001.docx
├── textbooks/
│   └── toan10.pdf
├── exports/
│   └── lesson_001.docx
└── vector_db/
```

## Database demo

Có thể dùng SQLite hoặc PostgreSQL.

Nếu muốn nhanh:

* SQLite cho metadata.
* Chroma local cho vector DB.

Nếu muốn gần production hơn:

* PostgreSQL cho metadata.
* pgvector hoặc Qdrant cho vector DB.

---

# 5. Luồng người dùng demo

## Luồng 1: Admin upload sách giáo khoa

Admin upload file:

```text
sgk_toan_10.pdf
```

Backend xử lý:

```text
PDF
↓
Extract text
↓
Clean text
↓
Split thành chunks
↓
Embedding
↓
Lưu vào vector DB
```

Mỗi chunk có metadata:

```json
{
  "document_id": "sgk_toan_10",
  "subject": "Toán",
  "grade": 10,
  "source": "SGK Toán 10",
  "page": 12,
  "chunk_index": 5
}
```

---

## Luồng 2: Admin upload mẫu giáo án

Admin upload file:

```text
mau_giao_an_truong_A.docx
```

Trong file Word có placeholder:

```text
Tên bài: {{TEN_BAI}}

I. Mục tiêu
{{MUC_TIEU}}

II. Thiết bị dạy học và học liệu
{{THIET_BI}}

III. Tiến trình dạy học

1. Khởi động
{{KHOI_DONG}}

2. Hình thành kiến thức
{{HOAT_DONG_KIEN_THUC}}

3. Luyện tập
{{LUYEN_TAP}}

4. Vận dụng
{{VAN_DUNG}}
```

Backend parse ra danh sách placeholder:

```json
{
  "template_id": "template_001",
  "placeholders": [
    "TEN_BAI",
    "MUC_TIEU",
    "THIET_BI",
    "KHOI_DONG",
    "HOAT_DONG_KIEN_THUC",
    "LUYEN_TAP",
    "VAN_DUNG"
  ]
}
```

Sau đó hệ thống tạo dynamic form tương ứng.

---

## Luồng 3: Giáo viên sinh giáo án

Giáo viên chọn:

```json
{
  "template_id": "template_001",
  "subject": "Toán",
  "grade": 10,
  "lesson_title": "Bất phương trình bậc nhất hai ẩn",
  "periods": 2,
  "student_level": "trung bình"
}
```

Backend xử lý:

```text
1. Lấy template schema
2. Tạo query RAG từ lesson_title
3. Retrieve nội dung liên quan trong SGK
4. Build prompt
5. Gọi LLM sinh JSON
6. Validate JSON có đủ placeholder không
7. Trả JSON về frontend
```

---

## Luồng 4: Giáo viên chỉnh sửa

Frontend hiển thị form:

```text
Tên bài
[ Bất phương trình bậc nhất hai ẩn ]

Mục tiêu
[ Nội dung AI sinh... ]

Thiết bị
[ Nội dung AI sinh... ]

Khởi động
[ Nội dung AI sinh... ]

Hoạt động kiến thức
[ Nội dung AI sinh... ]

Luyện tập
[ Nội dung AI sinh... ]

Vận dụng
[ Nội dung AI sinh... ]
```

Giáo viên sửa trực tiếp.

Sau đó bấm:

```text
Lưu
Xuất Word
```

---

## Luồng 5: Export Word

Backend nhận JSON đã chỉnh sửa:

```json
{
  "TEN_BAI": "...",
  "MUC_TIEU": "...",
  "THIET_BI": "...",
  "KHOI_DONG": "...",
  "HOAT_DONG_KIEN_THUC": "...",
  "LUYEN_TAP": "...",
  "VAN_DUNG": "..."
}
```

Backend dùng template Word gốc và thay placeholder.

Output:

```text
giao_an_toan_10_bat_phuong_trinh.docx
```

---

# 6. Thiết kế dữ liệu tối thiểu

Bản demo có thể dùng SQLite với các bảng đơn giản.

## Bảng templates

```sql
CREATE TABLE templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    placeholders_json TEXT NOT NULL,
    created_at TEXT
);
```

Ví dụ `placeholders_json`:

```json
[
  "TEN_BAI",
  "MUC_TIEU",
  "THIET_BI",
  "KHOI_DONG",
  "HOAT_DONG_KIEN_THUC",
  "LUYEN_TAP",
  "VAN_DUNG"
]
```

---

## Bảng textbooks

```sql
CREATE TABLE textbooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT,
    grade INTEGER,
    file_path TEXT,
    created_at TEXT
);
```

---

## Bảng generated_lessons

```sql
CREATE TABLE generated_lessons (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    subject TEXT,
    grade INTEGER,
    lesson_title TEXT,
    generated_json TEXT,
    edited_json TEXT,
    created_at TEXT,
    updated_at TEXT
);
```

---

# 7. RAG pipeline cho sách giáo khoa

## 7.1. Upload textbook

API:

```http
POST /rag/textbooks/upload
```

Input:

```text
file: sgk_toan_10.pdf
subject: Toán
grade: 10
```

Output:

```json
{
  "textbook_id": "textbook_001",
  "message": "Uploaded successfully"
}
```

---

## 7.2. Extract text

Với PDF, backend đọc từng trang:

```python
def extract_text_from_pdf(file_path: str) -> list[dict]:
    pages = []
    # return dạng:
    # [
    #   {"page": 1, "text": "..."},
    #   {"page": 2, "text": "..."}
    # ]
    return pages
```

---

## 7.3. Clean text

Mục tiêu clean:

* Xóa khoảng trắng thừa.
* Xóa header/footer lặp lại nếu có.
* Giữ lại công thức đơn giản dưới dạng text.
* Không cần OCR trong demo nếu PDF có text thật.

```python
def clean_text(text: str) -> str:
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text
```

---

## 7.4. Chunking

Chunk nên vừa đủ dài.

Đề xuất demo:

```text
chunk_size: 800 - 1200 ký tự
overlap: 150 - 250 ký tự
```

Ví dụ chunk:

```json
{
  "chunk_id": "chunk_001",
  "text": "Bất phương trình bậc nhất hai ẩn là...",
  "metadata": {
    "textbook_id": "textbook_001",
    "subject": "Toán",
    "grade": 10,
    "page": 45
  }
}
```

---

## 7.5. Embedding và lưu vector

Có thể dùng:

* Chroma local cho demo nhanh.
* Qdrant local nếu muốn giống production hơn.
* pgvector nếu muốn gộp vào PostgreSQL.

Bản demo nên dùng Chroma local để dễ chạy.

Metadata cần lưu:

```json
{
  "source": "SGK Toán 10",
  "subject": "Toán",
  "grade": 10,
  "page": 45,
  "textbook_id": "textbook_001"
}
```

---

## 7.6. Retrieve khi sinh giáo án

Khi giáo viên nhập:

```text
Bất phương trình bậc nhất hai ẩn
```

Tạo query:

```text
Bài học Toán lớp 10: Bất phương trình bậc nhất hai ẩn. Khái niệm, ví dụ, bài tập, hoạt động dạy học.
```

Retrieve top 5 chunks:

```json
{
  "query": "Bất phương trình bậc nhất hai ẩn Toán 10",
  "top_k": 5
}
```

Kết quả đưa vào prompt:

```text
[Context 1]
...

[Context 2]
...

[Context 3]
...
```

---

# 8. Template parsing

## 8.1. Quy ước MVP

Trong demo, yêu cầu template Word phải có placeholder dạng:

```text
{{TEN_BAI}}
{{MUC_TIEU}}
{{THIET_BI}}
{{KHOI_DONG}}
```

Không xử lý template không có placeholder trong MVP.

---

## 8.2. Parse placeholder

Cần đọc cả:

* Paragraph
* Table cell
* Header nếu cần
* Footer nếu cần

Regex:

```regex
\{\{([A-Z0-9_]+)\}\}
```

Kết quả:

```json
[
  "TEN_BAI",
  "MUC_TIEU",
  "THIET_BI",
  "KHOI_DONG"
]
```

---

## 8.3. Tạo dynamic form từ placeholder

Mapping mặc định:

```json
{
  "TEN_BAI": {
    "label": "Tên bài",
    "type": "text"
  },
  "MUC_TIEU": {
    "label": "Mục tiêu",
    "type": "textarea"
  },
  "THIET_BI": {
    "label": "Thiết bị dạy học",
    "type": "textarea"
  },
  "KHOI_DONG": {
    "label": "Hoạt động khởi động",
    "type": "textarea"
  },
  "HOAT_DONG_KIEN_THUC": {
    "label": "Hoạt động hình thành kiến thức",
    "type": "textarea"
  },
  "LUYEN_TAP": {
    "label": "Luyện tập",
    "type": "textarea"
  },
  "VAN_DUNG": {
    "label": "Vận dụng",
    "type": "textarea"
  }
}
```

Nếu placeholder lạ, ví dụ:

```text
{{YEU_CAU_CAN_DAT}}
```

Thì tự tạo label:

```text
Yêu cầu cần đạt
```

---

# 9. System prompt cho AI sinh giáo án

## 9.1. System prompt chính

```text
Bạn là trợ lý AI hỗ trợ giáo viên soạn giáo án môn Toán lớp 10.

Nhiệm vụ của bạn là sinh nội dung giáo án nháp dựa trên:
1. Thông tin bài học do giáo viên cung cấp.
2. Nội dung tham khảo lấy từ sách giáo khoa qua RAG.
3. Danh sách field/placeholder của mẫu giáo án.

Quy tắc bắt buộc:
- Chỉ trả về JSON hợp lệ.
- Không trả về Markdown.
- Không giải thích thêm ngoài JSON.
- JSON phải có đầy đủ các key đúng như danh sách field được cung cấp.
- Không tự ý thêm key mới nếu không được yêu cầu.
- Nội dung viết bằng tiếng Việt.
- Nội dung phù hợp với giáo viên phổ thông.
- Ưu tiên viết rõ ràng, có thể chỉnh sửa được.
- Nếu context RAG thiếu thông tin, vẫn tạo nội dung nháp hợp lý nhưng không khẳng định quá chắc chắn.
- Không bịa nguồn tài liệu.
- Không ghi rằng "theo sách giáo khoa trang X" nếu context không cung cấp chắc chắn.
- Không sinh nội dung nguy hiểm, xúc phạm hoặc không phù hợp môi trường giáo dục.

Phong cách giáo án:
- Ngắn gọn nhưng đủ ý.
- Có hoạt động của giáo viên và học sinh nếu field liên quan đến hoạt động.
- Có câu hỏi gợi mở nếu phù hợp.
- Có bài tập ví dụ nếu field là luyện tập.
- Có tình huống thực tiễn nếu field là vận dụng.
```

---

## 9.2. User prompt template

```text
Hãy sinh nội dung giáo án nháp theo template sau.

THÔNG TIN BÀI HỌC:
- Môn học: {subject}
- Lớp: {grade}
- Tên bài: {lesson_title}
- Số tiết: {periods}
- Trình độ học sinh: {student_level}

DANH SÁCH FIELD CẦN SINH:
{fields}

NỘI DUNG THAM KHẢO TỪ RAG:
{rag_context}

YÊU CẦU OUTPUT:
Trả về JSON hợp lệ.
JSON phải có đúng các key sau:
{field_keys}

Ví dụ format:
{
  "TEN_BAI": "...",
  "MUC_TIEU": "...",
  "THIET_BI": "...",
  "KHOI_DONG": "..."
}
```

---

## 9.3. Ví dụ prompt hoàn chỉnh

```text
Hãy sinh nội dung giáo án nháp theo template sau.

THÔNG TIN BÀI HỌC:
- Môn học: Toán
- Lớp: 10
- Tên bài: Bất phương trình bậc nhất hai ẩn
- Số tiết: 2
- Trình độ học sinh: trung bình

DANH SÁCH FIELD CẦN SINH:
- TEN_BAI: Tên bài học
- MUC_TIEU: Mục tiêu bài học
- THIET_BI: Thiết bị dạy học
- KHOI_DONG: Hoạt động khởi động
- HOAT_DONG_KIEN_THUC: Hoạt động hình thành kiến thức
- LUYEN_TAP: Hoạt động luyện tập
- VAN_DUNG: Hoạt động vận dụng

NỘI DUNG THAM KHẢO TỪ RAG:
[Context 1]
Bất phương trình bậc nhất hai ẩn có dạng ax + by <= c ...

[Context 2]
Miền nghiệm của bất phương trình bậc nhất hai ẩn được biểu diễn trên mặt phẳng tọa độ ...

YÊU CẦU OUTPUT:
Trả về JSON hợp lệ.
JSON phải có đúng các key sau:
TEN_BAI, MUC_TIEU, THIET_BI, KHOI_DONG, HOAT_DONG_KIEN_THUC, LUYEN_TAP, VAN_DUNG.
```

---

# 10. Output JSON mong muốn

Ví dụ:

```json
{
  "TEN_BAI": "Bất phương trình bậc nhất hai ẩn",
  "MUC_TIEU": "Sau bài học, học sinh có thể nhận biết được dạng của bất phương trình bậc nhất hai ẩn; mô tả được miền nghiệm trên mặt phẳng tọa độ; vận dụng kiến thức để giải quyết một số tình huống thực tiễn đơn giản.",
  "THIET_BI": "Giáo viên chuẩn bị bảng phụ, phiếu học tập, máy chiếu và một số ví dụ minh họa. Học sinh chuẩn bị vở ghi, thước kẻ, máy tính cầm tay và ôn lại kiến thức về hệ trục tọa độ.",
  "KHOI_DONG": "Giáo viên đưa ra tình huống: Một nhóm học sinh dự định mua hai loại vé tham quan với tổng chi phí không vượt quá một số tiền cho trước. Học sinh thảo luận để lập điều kiện biểu diễn mối quan hệ giữa số vé hai loại. Giáo viên dẫn dắt vào khái niệm bất phương trình bậc nhất hai ẩn.",
  "HOAT_DONG_KIEN_THUC": "Giáo viên giới thiệu dạng tổng quát của bất phương trình bậc nhất hai ẩn. Học sinh quan sát ví dụ, xác định các hệ số và thử kiểm tra một số cặp số có phải là nghiệm hay không. Sau đó giáo viên hướng dẫn cách biểu diễn miền nghiệm trên mặt phẳng tọa độ.",
  "LUYEN_TAP": "Bài 1: Xác định bất phương trình nào sau đây là bất phương trình bậc nhất hai ẩn. Bài 2: Kiểm tra cặp số cho trước có là nghiệm của bất phương trình hay không. Bài 3: Biểu diễn miền nghiệm của một bất phương trình đơn giản trên mặt phẳng tọa độ.",
  "VAN_DUNG": "Học sinh làm việc nhóm để xây dựng một bài toán thực tế có thể mô tả bằng bất phương trình bậc nhất hai ẩn, ví dụ bài toán chi phí, thời gian hoặc số lượng sản phẩm. Mỗi nhóm trình bày cách lập bất phương trình và giải thích ý nghĩa miền nghiệm."
}
```

---

# 11. Validate JSON

Sau khi LLM trả về, backend cần kiểm tra:

1. Có phải JSON hợp lệ không.
2. Có đủ tất cả key trong template không.
3. Không có key lạ.
4. Value phải là string hoặc object hợp lệ.
5. Không được rỗng quá nhiều.

Pseudo code:

```python
def validate_generated_json(data: dict, required_keys: list[str]) -> tuple[bool, list[str]]:
    errors = []

    for key in required_keys:
        if key not in data:
            errors.append(f"Missing key: {key}")
        elif not data[key]:
            errors.append(f"Empty value: {key}")

    for key in data.keys():
        if key not in required_keys:
            errors.append(f"Unexpected key: {key}")

    return len(errors) == 0, errors
```

Nếu lỗi, gọi prompt repair.

---

# 12. Prompt sửa JSON

```text
JSON sau không đúng schema yêu cầu.

DANH SÁCH KEY BẮT BUỘC:
{required_keys}

LỖI:
{errors}

JSON HIỆN TẠI:
{invalid_json}

Hãy sửa lại JSON.
Quy tắc:
- Chỉ trả về JSON hợp lệ.
- Có đủ key bắt buộc.
- Không thêm key mới.
- Không giải thích.
```

---

# 13. Regenerate từng field

Sau khi AI sinh xong, giáo viên có thể bấm:

```text
Tạo lại phần khởi động
```

Frontend gửi:

```json
{
  "lesson_id": "lesson_001",
  "field_key": "KHOI_DONG",
  "instruction": "Tạo hoạt động khởi động thú vị hơn, có tình huống thực tế gần gũi với học sinh."
}
```

Backend lấy:

* Thông tin bài học.
* Field cần sửa.
* Nội dung các field khác.
* RAG context.
* Instruction của giáo viên.

Prompt:

```text
Bạn đang chỉnh sửa một phần của giáo án.

Thông tin bài học:
- Môn: {subject}
- Lớp: {grade}
- Tên bài: {lesson_title}

Field cần tạo lại:
{field_key}

Yêu cầu của giáo viên:
{instruction}

Nội dung hiện tại của các phần khác:
{current_lesson_json}

Context từ RAG:
{rag_context}

Hãy chỉ sinh lại nội dung cho field {field_key}.
Trả về JSON:
{
  "{field_key}": "..."
}
```

---

# 14. API backend đề xuất

## 14.1. Upload textbook

```http
POST /api/rag/textbooks/upload
```

Input:

```text
multipart/form-data
- file
- subject
- grade
```

Output:

```json
{
  "textbook_id": "textbook_001",
  "chunks": 320,
  "message": "Textbook indexed successfully"
}
```

---

## 14.2. Upload template

```http
POST /api/templates/upload
```

Input:

```text
multipart/form-data
- file
- template_name
```

Output:

```json
{
  "template_id": "template_001",
  "template_name": "Mẫu giáo án trường A",
  "placeholders": [
    "TEN_BAI",
    "MUC_TIEU",
    "THIET_BI",
    "KHOI_DONG",
    "HOAT_DONG_KIEN_THUC",
    "LUYEN_TAP",
    "VAN_DUNG"
  ]
}
```

---

## 14.3. Get template form

```http
GET /api/templates/{template_id}/form
```

Output:

```json
{
  "template_id": "template_001",
  "fields": [
    {
      "key": "TEN_BAI",
      "label": "Tên bài",
      "type": "text",
      "required": true
    },
    {
      "key": "MUC_TIEU",
      "label": "Mục tiêu",
      "type": "textarea",
      "required": true
    }
  ]
}
```

---

## 14.4. Generate lesson

```http
POST /api/lessons/generate
```

Input:

```json
{
  "template_id": "template_001",
  "subject": "Toán",
  "grade": 10,
  "lesson_title": "Bất phương trình bậc nhất hai ẩn",
  "periods": 2,
  "student_level": "trung bình"
}
```

Output:

```json
{
  "lesson_id": "lesson_001",
  "generated_json": {
    "TEN_BAI": "...",
    "MUC_TIEU": "...",
    "THIET_BI": "...",
    "KHOI_DONG": "...",
    "HOAT_DONG_KIEN_THUC": "...",
    "LUYEN_TAP": "...",
    "VAN_DUNG": "..."
  }
}
```

---

## 14.5. Update lesson

```http
PUT /api/lessons/{lesson_id}
```

Input:

```json
{
  "edited_json": {
    "TEN_BAI": "...",
    "MUC_TIEU": "..."
  }
}
```

---

## 14.6. Regenerate field

```http
POST /api/lessons/{lesson_id}/regenerate-field
```

Input:

```json
{
  "field_key": "KHOI_DONG",
  "instruction": "Làm phần khởi động hấp dẫn hơn."
}
```

Output:

```json
{
  "field_key": "KHOI_DONG",
  "content": "..."
}
```

---

## 14.7. Export DOCX

```http
POST /api/lessons/{lesson_id}/export/docx
```

Output:

```json
{
  "download_url": "/exports/lesson_001.docx"
}
```

---

# 15. Frontend pages

## 15.1. Trang upload sách giáo khoa

Route:

```text
/admin/textbooks
```

Chức năng:

* Upload PDF sách giáo khoa.
* Chọn môn.
* Chọn lớp.
* Bấm index.
* Hiển thị số chunks đã index.

UI tối thiểu:

```text
[Upload SGK PDF]
[Môn học: Toán]
[Lớp: 10]
[Index tài liệu]
```

---

## 15.2. Trang upload template

Route:

```text
/admin/templates
```

Chức năng:

* Upload file `.docx`.
* Backend parse placeholder.
* Hiển thị danh sách field phát hiện.
* Cho admin sửa label nếu muốn.

UI:

```text
Upload mẫu giáo án
[ Chọn file .docx ]

Các placeholder phát hiện:
- TEN_BAI → Tên bài
- MUC_TIEU → Mục tiêu
- THIET_BI → Thiết bị
- KHOI_DONG → Khởi động
```

---

## 15.3. Trang sinh giáo án

Route:

```text
/lessons/new
```

Form:

```text
Chọn mẫu giáo án
Môn học
Lớp
Tên bài học
Số tiết
Trình độ học sinh
[Nút Sinh giáo án]
```

---

## 15.4. Trang editor

Route:

```text
/lessons/{lesson_id}/edit
```

Hiển thị dynamic form theo field của template.

Ví dụ:

```text
Tên bài
[textarea/input]

Mục tiêu
[textarea]

Thiết bị
[textarea]

Khởi động
[textarea] [Tạo lại]

Hoạt động kiến thức
[textarea] [Tạo lại]

Luyện tập
[textarea] [Tạo lại]

Vận dụng
[textarea] [Tạo lại]

[Lưu] [Xuất Word]
```

---

# 16. Backend folder structure

# 17. Frontend folder structure

# 18. Chi tiết service

## 18.1. template_service

Nhiệm vụ:

* Lưu template.
* Parse placeholder.
* Tạo schema form.
* Trả form cho frontend.

Pseudo code:

```python
class TemplateService:
    def upload_template(self, file, template_name):
        file_path = save_file(file, "storage/templates")
        placeholders = parse_docx_placeholders(file_path)

        template_id = generate_id("template")
        save_template_to_db(
            id=template_id,
            name=template_name,
            file_path=file_path,
            placeholders=placeholders
        )

        return {
            "template_id": template_id,
            "template_name": template_name,
            "placeholders": placeholders
        }

    def get_template_form(self, template_id):
        template = get_template_from_db(template_id)
        fields = []

        for placeholder in template.placeholders:
            fields.append({
                "key": placeholder,
                "label": humanize_placeholder(placeholder),
                "type": infer_field_type(placeholder),
                "required": True
            })

        return fields
```

---

## 18.2. rag_service

Nhiệm vụ:

* Nhận file SGK.
* Extract text.
* Chunking.
* Embedding.
* Retrieve context.

Pseudo code:

```python
class RagService:
    def index_textbook(self, file_path, subject, grade):
        pages = extract_text_from_pdf(file_path)
        chunks = []

        for page in pages:
            clean = clean_text(page["text"])
            page_chunks = split_text(clean)

            for chunk in page_chunks:
                chunks.append({
                    "text": chunk,
                    "metadata": {
                        "subject": subject,
                        "grade": grade,
                        "page": page["page"]
                    }
                })

        vector_store.add(chunks)
        return len(chunks)

    def retrieve_context(self, query, subject, grade, top_k=5):
        results = vector_store.search(
            query=query,
            filter={
                "subject": subject,
                "grade": grade
            },
            top_k=top_k
        )

        return "\n\n".join([
            f"[Context {i+1}]\n{item.text}"
            for i, item in enumerate(results)
        ])
```

---

## 18.3. ai_service

Nhiệm vụ:

* Build prompt.
* Gọi model.
* Parse JSON.
* Validate JSON.
* Repair JSON nếu cần.

Pseudo code:

```python
class AIService:
    def generate_lesson_json(self, input_data, fields, rag_context):
        system_prompt = build_system_prompt()

        user_prompt = build_user_prompt(
            input_data=input_data,
            fields=fields,
            rag_context=rag_context
        )

        raw_output = call_llm(system_prompt, user_prompt)
        data = parse_json(raw_output)

        is_valid, errors = validate_generated_json(
            data=data,
            required_keys=[field["key"] for field in fields]
        )

        if not is_valid:
            data = self.repair_json(
                invalid_json=raw_output,
                required_keys=[field["key"] for field in fields],
                errors=errors
            )

        return data
```

---

## 18.4. export_service

Nhiệm vụ:

* Lấy template Word gốc.
* Lấy JSON giáo án.
* Render placeholder.
* Lưu file export.

Dùng `docxtpl` thì đơn giản:

```python
from docxtpl import DocxTemplate

def export_docx(template_path: str, data: dict, output_path: str):
    doc = DocxTemplate(template_path)
    doc.render(data)
    doc.save(output_path)
    return output_path
```

Lưu ý: key trong JSON phải trùng placeholder trong Word.

Ví dụ Word:

```text
{{ TEN_BAI }}
```

JSON:

```json
{
  "TEN_BAI": "Bất phương trình bậc nhất hai ẩn"
}
```

---

# 19. Demo flow end-to-end

## Bước 1

Admin upload SGK Toán 10 PDF.

Kết quả:

```text
Đã index 320 chunks.
```

## Bước 2

Admin upload mẫu giáo án Word.

Kết quả:

```text
Phát hiện 7 placeholder:
TEN_BAI
MUC_TIEU
THIET_BI
KHOI_DONG
HOAT_DONG_KIEN_THUC
LUYEN_TAP
VAN_DUNG
```

## Bước 3

Giáo viên tạo giáo án mới.

Input:

```text
Mẫu: Mẫu giáo án trường A
Môn: Toán
Lớp: 10
Bài: Bất phương trình bậc nhất hai ẩn
Số tiết: 2
Trình độ: Trung bình
```

## Bước 4

Backend retrieve RAG.

Query:

```text
Bất phương trình bậc nhất hai ẩn Toán lớp 10 khái niệm ví dụ bài tập
```

Kết quả:

```text
Context 1: ...
Context 2: ...
Context 3: ...
```

## Bước 5

AI sinh JSON.

Kết quả hiển thị trên editor.

## Bước 6

Giáo viên sửa phần “Khởi động”.

## Bước 7

Giáo viên bấm export Word.

Kết quả:

```text
Tải về file giao_an_bat_phuong_trinh.docx
```

---

# 20. Những gì chưa làm trong demo

Bản demo chưa cần:

* Curriculum database đầy đủ.
* Mapping chuẩn chương trình GDPT.
* Kiểm định chính xác nội dung.
* Phân phối chương trình.
* Nhiều môn.
* Nhiều khối.
* Phân quyền giáo viên/admin phức tạp.
* Template không có placeholder.
* AI tự nhận diện bảng phức tạp trong Word.
* Export PDF đẹp.
* Sinh slide.
* Sinh đề kiểm tra phân hóa.

---

# 21. Những rủi ro cần biết

## Rủi ro 1: RAG lấy sai đoạn

Vì chỉ dùng SGK PDF, nếu query không tốt thì context có thể không liên quan.

Cách giảm rủi ro:

* Query nên gồm tên bài + môn + lớp + từ khóa “khái niệm, ví dụ, bài tập”.
* Retrieve top 5-8 chunks.
* Cho phép giáo viên chỉnh sửa sau khi sinh.

## Rủi ro 2: AI sinh JSON sai

Cách xử lý:

* Ép system prompt chỉ trả JSON.
* Validate JSON.
* Có prompt repair.
* Nếu vẫn lỗi, trả lỗi cho frontend.

## Rủi ro 3: Placeholder trong Word không render đúng

Cách xử lý:

* Quy định placeholder đơn giản.
* Không đặt placeholder bị chia nhỏ bởi nhiều style khác nhau.
* Dùng format thống nhất: `{{ TEN_BAI }}` hoặc `{{TEN_BAI}}`.
* Test với template mẫu trước.

## Rủi ro 4: Nội dung chưa chính xác

Vì demo chưa cần chính xác tuyệt đối, cần ghi rõ:

```text
Nội dung do AI sinh chỉ là bản nháp. Giáo viên cần kiểm tra và chỉnh sửa trước khi sử dụng.
```

---

# 22. Thứ tự triển khai trong 7 ngày

## Ngày 1: Backend foundation

* Tạo FastAPI project.
* Tạo cấu trúc folder.
* Tạo API health check.
* Tạo storage local.
* Tạo SQLite database.

Kết quả:

```text
Backend chạy được.
```

---

## Ngày 2: Upload template + parse placeholder

* Upload `.docx`.
* Lưu file.
* Parse placeholder.
* Lưu metadata.
* API get form.

Kết quả:

```text
Upload mẫu Word → sinh dynamic form.
```

---

## Ngày 3: Upload SGK + RAG indexing

* Upload PDF.
* Extract text.
* Chunking.
* Embedding.
* Lưu vector.

Kết quả:

```text
Upload SGK → retrieve được đoạn liên quan.
```

---

## Ngày 4: AI generator

* Build system prompt.
* Build user prompt.
* Gọi LLM.
* Validate JSON.
* Repair nếu lỗi.

Kết quả:

```text
Nhập tên bài → AI sinh JSON theo placeholder.
```

---

## Ngày 5: Frontend form + editor

* Upload template UI.
* Upload textbook UI.
* New lesson form.
* Dynamic editor.

Kết quả:

```text
Người dùng sinh và sửa giáo án trên web.
```

---

## Ngày 6: Export Word

* Render JSON vào DOCX.
* Tải file về.
* Test với template mẫu.

Kết quả:

```text
Xuất được giáo án Word.
```

---

## Ngày 7: Polish demo

* Loading states.
* Error handling.
* Demo data.
* Template mẫu đẹp.
* Script chạy docker compose nếu cần.
* Chuẩn bị flow thuyết trình.

Kết quả:

```text
Demo end-to-end hoàn chỉnh.
```

---

# 23. Kịch bản thuyết trình demo

## Mở đầu

“Hiện nay mỗi trường có thể có mẫu giáo án khác nhau. Vì vậy hệ thống không ép giáo viên dùng một form cố định, mà cho phép upload mẫu Word của trường.”

## Demo bước 1

Upload mẫu giáo án Word.

“Hệ thống tự đọc các placeholder trong mẫu và tạo thành form động.”

## Demo bước 2

Upload SGK Toán 10.

“Hệ thống index sách giáo khoa thành vector database để AI có thể lấy nội dung tham khảo khi soạn.”

## Demo bước 3

Nhập bài học.

Ví dụ:

```text
Bất phương trình bậc nhất hai ẩn
```

“Hệ thống truy xuất các đoạn liên quan trong SGK, sau đó dùng AI sinh nội dung giáo án.”

## Demo bước 4

Xem editor.

“Giáo viên không bị mất quyền kiểm soát. Mọi phần AI sinh đều có thể chỉnh sửa hoặc tạo lại riêng.”

## Demo bước 5

Export Word.

“Cuối cùng hệ thống đổ dữ liệu vào đúng mẫu Word ban đầu của trường.”

---

# 24. Kết luận thiết kế

Bản demo nên tập trung chứng minh 3 năng lực chính:

1. Hệ thống hiểu được mẫu giáo án thông qua placeholder.
2. Hệ thống lấy nội dung tham khảo từ RAG sách giáo khoa.
3. Hệ thống dùng AI sinh JSON và export lại đúng mẫu Word.

Kiến trúc demo tối giản:

```text
FastAPI
+ React
+ DOCX placeholder parser
+ RAG sách giáo khoa
+ LLM sinh JSON
+ Dynamic form editor
+ DOCX export
```

Triết lý thiết kế:

```text
AI sinh nội dung.
Backend quản lý schema và template.
Frontend cho giáo viên kiểm soát.
Export service đảm bảo đúng mẫu.
```

Đây là hướng phù hợp nhất để làm demo nhanh nhưng vẫn có khả năng mở rộng về sau.
