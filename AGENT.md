# EduMate Agent Instructions

## Lesson Plan Template Gallery Skill

Khi chỉnh sửa trang `/lesson-plan`, luôn áp dụng các nguyên tắc sau:

### Mục tiêu
Trang soạn giáo án phải có giao diện chọn mẫu trực quan giống Canva. Giáo viên cần nhìn thấy preview mẫu trước khi chọn, không dùng radio đơn giản kiểu “Dùng Mẫu Chuẩn / Tải lên mẫu của tôi”.

### UI bắt buộc
Mỗi mẫu giáo án phải có:
- Preview dạng giấy A4 mini hoặc mockup layout.
- Tên mẫu.
- Mô tả ngắn.
- Tags.
- Nút “Xem trước”.
- Nút “Chọn mẫu”.
- Trạng thái selected rõ ràng.

### Mẫu demo bắt buộc
- Mẫu chuẩn Bộ GD&ĐT.
- Mẫu dạy học hoạt động nhóm.
- Mẫu STEAM / Dạy học dự án.
- Mẫu mô hình 5E.
- Mẫu tối giản nhanh.
- Mẫu của tôi / Upload DOCX.

### State cần có
- selectedTemplate
- activeFilter
- previewTemplate
- uploadedFile

### Behavior
- Click card hoặc “Chọn mẫu” thì cập nhật selectedTemplate.
- Click “Xem trước” thì mở modal preview.
- Click filter thì lọc template.
- Chọn “Mẫu của tôi” thì hiển thị upload file .docx.
- Submit payload phải có templateId và templateName.

### Coding rules
- Không phá layout sidebar/header/form hiện tại.
- Không xoá validation cũ.
- Không xoá submit handler cũ.
- Không thêm thư viện ngoài nếu không cần.
- Code theo convention hiện tại của project.
- Mobile gallery phải về 1 cột.
