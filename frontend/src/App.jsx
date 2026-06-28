import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PlayCircle,
  Presentation,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as docx from 'docx-preview';
import './index.css';
import './document-preview.css';
import LandingPage from './LandingPage.jsx';
import curriculumData from './data/curriculumData.json';

const AUTH_TOKEN_KEY = 'edumate-auth-token';
const AUTH_USER_KEY = 'edumate-auth-user';
const LESSON_TEMPLATE_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'official', label: 'Mẫu chung' },
  { id: 'active', label: 'Hoạt động' },
  { id: 'project', label: 'Dự án' },
  { id: 'quick', label: 'Nhanh' },
  { id: 'mine', label: 'Của tôi' },
];
const LESSON_TEMPLATES = [
  {
    id: 'official-standard',
    name: 'Mẫu chuẩn Bộ GD&ĐT',
    description: 'Bố cục kế hoạch bài dạy theo Công văn 5512, phù hợp đa số môn học.',
    tags: ['Chuẩn Bộ', '5512', 'Phổ thông'],
    filters: ['official'],
    accent: '#ce7a58',
    mockup: 'official',
    source: 'standard',
  },
  {
    id: 'group-activity',
    name: 'Mẫu dạy học hoạt động nhóm',
    description: 'Nhấn mạnh hoạt động giáo viên, học sinh, sản phẩm nhóm và đánh giá.',
    tags: ['Hoạt động nhóm', 'Tương tác', 'Đánh giá'],
    filters: ['active'],
    accent: '#0f9f7a',
    mockup: 'group',
    source: 'standard',
  },
  {
    id: 'steam-project',
    name: 'Mẫu STEAM / Dạy học dự án',
    description: 'Khung bài học theo tiến trình dự án, có vấn đề, sản phẩm và rubric.',
    tags: ['STEAM', 'Dự án', 'Rubric'],
    filters: ['project'],
    accent: '#2563eb',
    mockup: 'steam',
    source: 'standard',
  },
  {
    id: 'five-e',
    name: 'Mẫu mô hình 5E',
    description: 'Thiết kế tiến trình Engage, Explore, Explain, Elaborate, Evaluate.',
    tags: ['5E', 'Khám phá', 'Khoa học'],
    filters: ['active'],
    accent: '#d97706',
    mockup: 'five-e',
    source: 'standard',
  },
  {
    id: 'minimal-fast',
    name: 'Mẫu tối giản nhanh',
    description: 'Gọn, dễ đọc, ưu tiên mục tiêu, hoạt động chính và đánh giá cuối tiết.',
    tags: ['Tối giản', 'Nhanh', 'Dễ chỉnh'],
    filters: ['quick'],
    accent: '#64748b',
    mockup: 'minimal',
    source: 'standard',
  },
  {
    id: 'my-upload',
    name: 'Mẫu của tôi / Upload DOCX',
    description: 'Tải lên giáo án mẫu DOCX của trường để giữ layout và bảng biểu riêng.',
    tags: ['DOCX', 'Cá nhân', 'Giữ layout'],
    filters: ['mine'],
    accent: '#8b5cf6',
    mockup: 'upload',
    source: 'upload',
  },
];
const UPLOAD_TEMPLATE = LESSON_TEMPLATES.find((template) => template.source === 'upload');

async function extractRequestErrorMessage(error, fallbackMessage) {
  const responseData = error.response?.data;
  if (responseData instanceof Blob) {
    const text = await responseData.text();
    if (!text) {
      return fallbackMessage;
    }
    try {
      const parsed = JSON.parse(text);
      return parsed.detail || parsed.message || fallbackMessage;
    } catch {
      return text;
    }
  }

  return responseData?.detail || responseData?.message || fallbackMessage;
}

function readStoredSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
  const rawUser = localStorage.getItem(AUTH_USER_KEY);
  if (!token || !rawUser) {
    return { token: '', user: null };
  }

  try {
    return { token, user: JSON.parse(rawUser) };
  } catch {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    return { token: '', user: null };
  }
}

function persistSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearStoredSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function CustomSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${!value ? 'placeholder' : ''}`}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={18} className="custom-select-icon" />
      </button>

      {isOpen ? (
        <div className="custom-select-dropdown">
          {options.map((option) => (
            <button
              key={option.value}
              className={`custom-select-option ${value === option.value ? 'selected' : ''}`}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {value === option.value ? <Check size={16} className="check-icon" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TemplateMockup({ template }) {
  const rows = {
    official: [70, 92, 82, 96],
    group: [84, 58, 96, 64],
    steam: [66, 86, 54, 94],
    'five-e': [88, 48, 74, 62],
    minimal: [72, 88, 52],
    upload: [74, 46, 90, 58],
  }[template.mockup] || [72, 86, 58];

  return (
    <div className="template-paper" style={{ '--template-accent': template.accent }}>
      <div className="paper-topline" />
      <div className="paper-title" />
      <div className="paper-subtitle" />
      <div className="paper-grid">
        <span />
        <span />
      </div>
      <div className="paper-section-title" />
      {rows.map((width, index) => (
        <div className="paper-row" key={`${template.id}-row-${index}`} style={{ width: `${width}%` }} />
      ))}
      <div className="paper-table">
        <span />
        <span />
        <span />
        <span />
      </div>
      {template.source === 'upload' ? (
        <div className="paper-upload-mark">
          <Upload size={12} />
        </div>
      ) : null}
    </div>
  );
}

function TemplateGallery({
  templates,
  filters,
  activeFilter,
  selectedTemplate,
  searchValue,
  onSearchChange,
  onFilterChange,
  onPreview,
  onUse,
  onRename,
  onDelete,
  onCreateTemplate,
  isAdmin,
}) {
  return (
    <div className="template-gallery-shell">
      <div className="template-gallery-heading">
        <div>
          <span className="template-gallery-kicker">Thư viện</span>
          <h3>Mẫu giáo án</h3>
        </div>
        {isAdmin ? (
          <button className="template-admin-add-btn" type="button" onClick={onCreateTemplate}>
            <Upload size={15} /> Thêm mẫu chung
          </button>
        ) : null}
      </div>

      <label className="template-search-box">
        <Search size={16} />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm mẫu..."
        />
      </label>

      <div className="template-filter-bar" aria-label="Lọc mẫu giáo án">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter.id ? 'active' : ''}
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="template-gallery-grid">
        {templates.length ? templates.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          return (
            <article
              className={`template-card ${isSelected ? 'selected' : ''}`}
              key={template.id}
              onClick={() => onPreview(template)}
            >
              <div className="template-preview-wrap">
                <TemplateMockup template={template} />
                {isSelected ? (
                  <span className="template-selected-badge">
                    <Check size={14} /> Đã chọn
                  </span>
                ) : null}
              </div>
              <div className="template-card-body">
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <div className="template-tags">
                  {template.tags.slice(0, 2).map((tag) => (
                    <span key={`${template.id}-${tag}`}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="template-card-actions">
                <button
                  className="template-ghost-btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPreview(template);
                  }}
                >
                  <Eye size={16} /> Xem trước
                </button>
                <button
                  className="template-select-btn"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onUse) {
                      onUse(template);
                    } else {
                      onPreview(template);
                    }
                  }}
                >
                  {isSelected ? 'Đang dùng' : <><Sparkles size={14} /> Dùng mẫu</>}  
                </button>
                {template.canEdit ? (
                  <button
                    className="template-icon-action"
                    type="button"
                    title="Đổi tên mẫu"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRename(template);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                ) : null}
                {template.canDelete ? (
                  <button
                    className="template-icon-action danger"
                    type="button"
                    title="Xóa mẫu"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(template);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            </article>
          );
        }) : (
          <div className="template-empty-result">Không tìm thấy mẫu phù hợp.</div>
        )}
      </div>
    </div>
  );
}

function TemplatePreviewModal({ template, draft, isLoading, error, onClose, onUse }) {
  if (!template) {
    return null;
  }

  const summary = draft?.summary || draft?.layout?.summary || {};
  const isUpload = template.source === 'upload';

  return (
    <div
      className="template-preview-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="template-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
        <button className="template-preview-close" type="button" onClick={onClose} aria-label="Đóng xem trước">
          <X size={20} />
        </button>

        <div className="template-preview-canvas">
          {isUpload ? (
            <div className="template-preview-upload">
              <TemplateMockup template={template} />
              <strong>Upload DOCX của trường</strong>
              <p>Sau khi chọn file, hệ thống sẽ bóc layout OOXML để bạn chỉnh vùng giữ nguyên, vùng AI sinh và thông tin thay thế.</p>
            </div>
          ) : (
            <TemplateFramePreview
              draft={draft}
              isLoading={isLoading}
              error={error}
              selectedNodeId={null}
              onSelectNode={() => {}}
              onNodeChange={() => {}}
              onNodeDraftTextChange={() => {}}
              onSaveTemplate={() => {}}
              isSaving={false}
              readOnly
              title={template.name}
              sourceLabel="Xem trước mẫu"
              showHeader={false}
              showSummary={false}
              showInspector={false}
            />
          )}
          <button
            className="template-preview-floating-use-btn"
            type="button"
            onClick={onUse}
            disabled={isLoading || Boolean(error && !isUpload)}
          >
            <Sparkles size={18} />
            Dùng giáo án
          </button>
        </div>

        <aside className="template-preview-info">
          <div className="template-preview-info-scroll">
            <span className="template-gallery-kicker">Xem trước mẫu</span>
            <h2 id="template-preview-title">{template.name}</h2>
            <p>{template.description}</p>
            <div className="template-preview-tags">
              {template.tags.map((tag) => <span key={`${template.id}-${tag}`}>{tag}</span>)}
            </div>
            {!isUpload && !isLoading && !error ? (
              <div className="template-preview-stats">
                <span>{summary.node_count || 0} vùng chữ</span>
                <span>{summary.table_count || 0} bảng</span>
                <span>{summary.editable_node_count || 0} vùng AI</span>
              </div>
            ) : null}
            {error ? <div className="form-error">{error}</div> : null}
          </div>
          <div className="template-preview-cta">
            <button
              className="toolbar-primary-btn template-preview-cta-btn"
              type="button"
              onClick={onUse}
              disabled={isLoading || Boolean(error && !isUpload)}
            >
              {isUpload ? <Upload size={20} /> : <Sparkles size={20} />}
              {isUpload ? 'Chọn file DOCX' : 'Dùng mẫu này → Tạo giáo án'}
            </button>
            <button className="toolbar-secondary-btn" type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function getTemplateRoleLabel(role) {
  const labels = {
    fixed: 'Giữ nguyên',
    generated: 'AI sinh',
    field: 'Thông tin thay thế',
    ignored: 'Không chỉnh',
  };
  return labels[role] || 'Thành phần mẫu';
}

const ROLE_OPTIONS = [
  { value: 'fixed', label: 'Giữ nguyên' },
  { value: 'generated', label: 'AI sinh' },
  { value: 'field', label: 'Thông tin thay thế' },
  { value: 'ignored', label: 'Bỏ qua' },
];

function TemplateFramePreview({
  draft,
  isLoading,
  error,
  selectedNodeId,
  onSelectNode,
  onNodeChange,
  onNodeDraftTextChange,
  onSaveTemplate,
  isSaving,
  readOnly = false,
  title = 'Bản nháp mẫu giáo án',
  sourceLabel = 'Mẫu đang chỉnh',
  showHeader = true,
  showSummary = true,
  showInspector = true,
}) {
  if (isLoading) {
    return (
      <div className="template-frame-panel">
        <div className="template-frame-empty">
          <Loader2 className="loader" size={18} /> Đang tạo bản nháp mẫu giáo án...
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="template-frame-panel template-frame-error">{error}</div>;
  }

  if (!draft) {
    return (
      <div className="template-frame-panel">
        <div className="template-frame-empty">
          {readOnly ? 'Chọn một mẫu giáo án đã lưu để xem nội dung mẫu.' : 'Upload file DOCX để tạo bản nháp mẫu giáo án có thể chỉnh sửa.'}
        </div>
      </div>
    );
  }

  const layout = draft.layout || {};
  const summary = draft.summary || layout.summary || {};
  const elements = layout.elements || [];
  const selectedNode = selectedNodeId ? findLayoutNode(layout, selectedNodeId) : null;

  return (
    <div className="template-frame-panel">
      {showHeader ? (
        <div className="template-frame-header">
          <div>
            <span className="template-frame-kicker">{sourceLabel}</span>
            <h3>{draft.filename || 'template.docx'}</h3>
          </div>
          {readOnly ? null : (
            <button className="template-select-btn" type="button" onClick={onSaveTemplate} disabled={isSaving}>
              {isSaving ? 'Đang lưu...' : 'Lưu mẫu giáo án'}
            </button>
          )}
        </div>
      ) : null}

      {showSummary ? (
        <div className="template-summary-grid">
          <div>
            <strong>{summary.node_count || 0}</strong>
            <span>vùng chữ</span>
          </div>
          <div>
            <strong>{summary.table_count || 0}</strong>
            <span>bảng</span>
          </div>
          <div>
            <strong>{summary.editable_node_count || 0}</strong>
            <span>vùng AI/thay thế</span>
          </div>
        </div>
      ) : null}

      <div className={`template-editor-shell ${readOnly || !showInspector ? 'read-only' : ''}`}>
        <div className="template-docx-workspace">
          <div className="template-docx-toolbar">
            <span>{title}</span>
            <span>{readOnly ? 'Xem mẫu' : 'Click vào vùng cần chỉnh'}</span>
          </div>
          <div className="template-frame-scroll template-page-editor">
            <div className="template-docx-page">
              {elements.map((element, elementIndex) => renderTemplateElement({
                element,
                elementIndex,
                selectedNodeId,
                onSelectNode,
                onNodeChange,
                onNodeDraftTextChange,
                readOnly,
              }))}
            </div>
          </div>
        </div>

        {readOnly || !showInspector ? null : <aside className="template-node-inspector">
          {selectedNode ? (
            <>
              <span className="template-frame-kicker">Vùng đang chọn</span>
              <strong>{getTemplateRoleLabel(selectedNode.role)}</strong>
              <select
                value={selectedNode.role}
                onChange={(event) => onNodeChange(selectedNode.node_id, { role: event.target.value })}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label>Chữ hiển thị</label>
              <textarea
                disabled={selectedNode.role === 'generated' || selectedNode.role === 'ignored'}
                rows="5"
                value={selectedNode.display_text || ''}
                onChange={(event) => onNodeChange(selectedNode.node_id, { text: event.target.value })}
                placeholder={selectedNode.role === 'generated' ? 'Để trống, AI sẽ sinh khi tạo giáo án' : ''}
              />
              <label>Gợi ý cho AI</label>
              <textarea
                rows="4"
                value={selectedNode.instruction || ''}
                onChange={(event) => onNodeChange(selectedNode.node_id, { instruction: event.target.value })}
                placeholder="Ví dụ: hoạt động nhóm 5 phút, câu hỏi gợi mở..."
              />
            </>
          ) : (
            <div className="template-frame-empty">Click một dòng hoặc ô trong mẫu để chỉnh cách xử lý và nội dung.</div>
          )}
        </aside>}
      </div>
    </div>
  );
}

function TemplateNodeInspector({ node, onNodeChange }) {
  if (!node) {
    return (
      <div className="node-empty-state">
        <SlidersHorizontal size={18} />
        <div>
          <strong>Chưa chọn vùng</strong>
          <p>Click vào một dòng hoặc ô trên trang để chỉnh cách AI xử lý nội dung.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="node-property-card">
      <div className="property-card-title">
        <span>Vùng đang chọn</span>
        <strong>{getTemplateRoleLabel(node.role)}</strong>
      </div>
      <label>Vai trò</label>
      <select
        value={node.role}
        onChange={(event) => onNodeChange(node.node_id, { role: event.target.value })}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <label>Chữ cố định</label>
      <textarea
        disabled={node.role === 'generated' || node.role === 'ignored'}
        rows="4"
        value={node.display_text || ''}
        onChange={(event) => onNodeChange(node.node_id, { text: event.target.value })}
        placeholder={node.role === 'generated' ? 'Để trống, AI sẽ sinh khi tạo giáo án' : ''}
      />
      <label>Gợi ý cho AI</label>
      <textarea
        rows="4"
        value={node.instruction || ''}
        onChange={(event) => onNodeChange(node.node_id, { instruction: event.target.value })}
        placeholder="Ví dụ: hoạt động nhóm 5 phút, câu hỏi gợi mở..."
      />
    </div>
  );
}

function renderTemplateElement({ element, elementIndex, selectedNodeId, onSelectNode, onNodeChange, onNodeDraftTextChange, readOnly }) {
  if (element.type === 'table') {
    return (
      <div className="frame-table-card docx-table-wrap" key={`table-${element.table_index}`}>
        <div className="frame-table-scroll">
          <table className="frame-table">
            <tbody>
              {element.rows.map((row) => (
                <tr key={`row-${row.row_index}`}>
                  {row.cells.map((cell) => (
                    <td className={cell.editable ? 'editable-cell' : ''} colSpan={cell.grid_span || 1} key={`cell-${row.row_index}-${cell.col_index}`}>
                      {cell.paragraphs.length ? cell.paragraphs.map((paragraph) => (
                        <TemplateNodeEditor
                          key={paragraph.node_id}
                          node={paragraph}
                          selected={selectedNodeId === paragraph.node_id}
                          onSelectNode={onSelectNode}
                          onNodeChange={onNodeChange}
                          onNodeDraftTextChange={onNodeDraftTextChange}
                          readOnly={readOnly}
                        />
                      )) : <span className="template-empty-cell">Ô trống</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <TemplateNodeEditor
      key={element.node_id || `paragraph-${elementIndex}`}
      node={element}
      selected={selectedNodeId === element.node_id}
      onSelectNode={onSelectNode}
      onNodeChange={onNodeChange}
      onNodeDraftTextChange={onNodeDraftTextChange}
      readOnly={readOnly}
    />
  );
}

function TemplateNodeEditor({ node, selected, onSelectNode, onNodeChange, onNodeDraftTextChange, readOnly = false }) {
  const isGenerated = node.role === 'generated';
  const isIgnored = node.role === 'ignored';
  const className = [
    'template-node',
    node.role,
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      onClick={() => !readOnly && onSelectNode(node.node_id)}
      role={readOnly ? undefined : 'button'}
      tabIndex={readOnly ? undefined : 0}
    >
      <span className="template-node-role-chip">{getTemplateRoleLabel(node.role)}</span>
      {isGenerated ? (
        <div className="template-generated-placeholder" aria-label="Vùng nội dung AI sẽ sinh" />
      ) : isIgnored ? (
        <div className="template-generated-placeholder ignored">Đối tượng Word được giữ nguyên</div>
      ) : readOnly ? (
        <p>{node.display_text || node.text || ''}</p>
      ) : (
        <div
          className="template-editable-text"
          contentEditable
          suppressContentEditableWarning
          onClick={(event) => event.stopPropagation()}
          onFocus={() => onSelectNode(node.node_id)}
          onInput={(event) => onNodeDraftTextChange?.(node.node_id, event.currentTarget.innerText)}
          onBlur={(event) => onNodeChange(node.node_id, { text: event.currentTarget.innerText })}
        >
          {node.display_text || ''}
        </div>
      )}
    </div>
  );
}

function findLayoutNode(layout, nodeId) {
  return flattenLayoutNodes(layout).find((node) => node.node_id === nodeId) || null;
}

function flattenLayoutNodes(layout) {
  const nodes = [];
  (layout?.elements || []).forEach((element) => {
    if (element.type === 'table') {
      element.rows.forEach((row) => {
        row.cells.forEach((cell) => {
          nodes.push(...cell.paragraphs);
        });
      });
      return;
    }
    if (element.node_id) {
      nodes.push(element);
    }
  });
  return nodes;
}

function updateLayoutNode(layout, nodeId, patch) {
  const applyPatch = (node) => {
    if (node.node_id !== nodeId) {
      return node;
    }
    const role = patch.role || node.role;
    return {
      ...node,
      role,
      editable: role === 'generated' || role === 'field',
      display_text: role === 'generated' ? '' : patch.text ?? node.display_text ?? node.text ?? '',
      instruction: patch.instruction ?? node.instruction ?? '',
    };
  };

  const nextLayout = {
    ...layout,
    elements: (layout?.elements || []).map((element) => {
      if (element.type !== 'table') {
        return applyPatch(element);
      }
      return {
        ...element,
        rows: element.rows.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => {
            const paragraphs = cell.paragraphs.map(applyPatch);
            return {
              ...cell,
              paragraphs,
              editable: paragraphs.some((paragraph) => paragraph.editable),
              text: paragraphs.map((paragraph) => paragraph.display_text || '').join('\n').trim(),
              role: paragraphs.some((paragraph) => paragraph.role === 'generated') ? 'generated' : cell.role,
            };
          }),
        })),
      };
    }),
  };
  nextLayout.summary = summarizeLayout(nextLayout);
  return nextLayout;
}

function summarizeLayout(layout) {
  const nodes = flattenLayoutNodes(layout);
  return {
    ...(layout.summary || {}),
    node_count: nodes.length,
    editable_node_count: nodes.filter((node) => node.role === 'generated' || node.role === 'field').length,
    ignored_node_count: nodes.filter((node) => node.role === 'ignored').length,
  };
}

function mapApiTemplateToCard(template) {
  const visibility = template.visibility || 'personal';
  const isPublic = visibility === 'public';
  return {
    id: `saved-${template.id}`,
    templateId: template.id,
    name: template.name,
    description: isPublic ? `Mẫu chung từ ${template.filename}` : `Mẫu cá nhân từ ${template.filename}`,
    tags: isPublic ? ['Mẫu chung', 'DOCX'] : ['Cá nhân', 'DOCX'],
    filters: isPublic ? ['official'] : ['mine'],
    accent: isPublic ? '#ce7a58' : '#0f9f7a',
    mockup: 'official',
    source: 'saved',
    visibility,
    canEdit: Boolean(template.can_edit),
    canDelete: Boolean(template.can_delete),
  };
}

function LessonPlanTool({ token, user, onUnauthorized }) {
  const [workspaceMode, setWorkspaceMode] = useState('gallery');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(UPLOAD_TEMPLATE);
  const [activeFilter, setActiveFilter] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewDraft, setPreviewDraft] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [templateDraft, setTemplateDraft] = useState(null);
  const [selectedTemplateLayout, setSelectedTemplateLayout] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [publishedTemplateId, setPublishedTemplateId] = useState(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isSavedTemplateLoading, setIsSavedTemplateLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [truong, setTruong] = useState('');
  const [to, setTo] = useState('');
  const [giaoVien, setGiaoVien] = useState('');
  const [lop, setLop] = useState('');
  const [monHoc, setMonHoc] = useState('');
  const [tenBaiDay, setTenBaiDay] = useState('');
  const [soTiet, setSoTiet] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultBlobUrl, setResultBlobUrl] = useState(null);
  const [resultBlob, setResultBlob] = useState(null);
  const [isTemplateFrameLoading, setIsTemplateFrameLoading] = useState(false);
  const [templateFrameError, setTemplateFrameError] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const previewRef = useRef(null);
  const pendingNodeTextRef = useRef({});
  const isEditorMode = workspaceMode === 'editor';
  const isUploadTemplate = isEditorMode && selectedTemplate.source === 'upload';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!resultBlob || !previewRef.current) {
      return;
    }
    previewRef.current.innerHTML = '';
    docx.renderAsync(resultBlob, previewRef.current, null, {
      className: 'docx-preview-rendered',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      trimXmlDeclaration: true,
    }).catch((previewError) => {
      console.error('docx-preview error:', previewError);
      setError('Đã tạo được file nhưng không thể xem trước trong trình duyệt.');
    });
  }, [resultBlob]);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        const response = await axios.get('/api/v1/lesson/templates', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) {
          return;
        }
        const templates = (response.data.templates || []).map(mapApiTemplateToCard);
        setSavedTemplates(templates);
      } catch (requestError) {
        if (requestError.response?.status === 401 || requestError.response?.status === 403) {
          onUnauthorized();
        }
      }
    }
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [token, onUnauthorized]);

  const lopOptions = [...Array(12)].map((_, index) => ({ value: `Lớp ${index + 1}`, label: `Lớp ${index + 1}` }));
  const genericMonHocOptions = [
    'Toán học',
    'Ngữ văn',
    'Tiếng Anh',
    'Vật lý',
    'Hóa học',
    'Sinh học',
    'Khoa học tự nhiên',
    'Lịch sử',
    'Địa lý',
    'Tin học',
    'Công nghệ',
    'Hoạt động trải nghiệm',
  ].map((subject) => ({ value: subject, label: subject }));
  const availableSubjects = curriculumData[lop] ? Object.keys(curriculumData[lop]) : [];
  const currentMonHocOptions = availableSubjects.length
    ? availableSubjects.map((subject) => ({ value: subject, label: subject }))
    : genericMonHocOptions;
  const soTietOptions = [
    { value: '35 phút', label: '35 phút' },
    { value: '40 phút', label: '40 phút' },
    { value: '45 phút', label: '45 phút' },
    { value: '90 phút', label: '90 phút (2 tiết)' },
    { value: '135 phút', label: '135 phút (3 tiết)' },
  ];
  const lessonTemplates = [...savedTemplates, UPLOAD_TEMPLATE].filter(Boolean);
  const normalizedTemplateSearch = templateSearch.trim().toLowerCase();
  const filteredTemplates = lessonTemplates.filter((template) => {
    const matchesFilter = activeFilter === 'all' || template.filters.includes(activeFilter);
    const searchableText = `${template.name} ${template.description} ${template.tags.join(' ')}`.toLowerCase();
    return matchesFilter && (!normalizedTemplateSearch || searchableText.includes(normalizedTemplateSearch));
  });
  const activePreviewDraft = isUploadTemplate ? templateDraft : selectedTemplateLayout;
  const activePreviewSummary = activePreviewDraft?.summary || activePreviewDraft?.layout?.summary || {};
  const selectedDraftNode = isUploadTemplate && templateDraft && selectedNodeId
    ? findLayoutNode(templateDraft.layout, selectedNodeId)
    : null;
  const missingRequirements = [
    isUploadTemplate && !uploadedFile ? 'file mẫu' : '',
    isUploadTemplate && uploadedFile && !templateDraft ? 'bản nháp mẫu' : '',
    !publishedTemplateId ? 'mẫu giáo án đã lưu' : '',
    !prompt.trim() ? 'yêu cầu bài học' : '',
    !truong.trim() ? 'tên trường' : '',
    !to.trim() ? 'tổ chuyên môn' : '',
    !giaoVien.trim() ? 'giáo viên' : '',
    !lop ? 'lớp' : '',
    !monHoc ? 'môn học' : '',
    !tenBaiDay.trim() ? 'tên bài dạy' : '',
    !soTiet ? 'thời lượng' : '',
  ].filter(Boolean);
  const isSubmitDisabled = isGenerating || isTemplateFrameLoading || missingRequirements.length > 0;

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template);
    setWorkspaceMode('editor');
    setError('');
    setResultBlobUrl(null);
    setResultBlob(null);
    if (template.source === 'saved') {
      setUploadedFile(null);
      setTemplateDraft(null);
      setSelectedTemplateLayout(null);
      pendingNodeTextRef.current = {};
      setTemplateFrameError('');
      setSelectedNodeId(null);
      setPublishedTemplateId(template.templateId);
      setIsSavedTemplateLoading(true);
      try {
        const response = await axios.get(`/api/v1/lesson/templates/${template.templateId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSelectedTemplateLayout({
          id: response.data.id,
          filename: response.data.filename,
          status: 'published',
          layout: response.data.layout,
          summary: response.data.summary,
        });
      } catch (requestError) {
        if (requestError.response?.status === 401 || requestError.response?.status === 403) {
          onUnauthorized();
          return;
        }
        console.error(requestError);
        setError(await extractRequestErrorMessage(requestError, 'Không tải được mẫu giáo án đã lưu.'));
      } finally {
        setIsSavedTemplateLoading(false);
      }
    } else {
      setPublishedTemplateId(null);
      setSelectedTemplateLayout(null);
      pendingNodeTextRef.current = {};
    }
  };

  const handleTemplatePreview = async (template) => {
    setPreviewTemplate(template);
    setPreviewDraft(null);
    setPreviewError('');

    if (template.source !== 'saved') {
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    try {
      const response = await axios.get(`/api/v1/lesson/templates/${template.templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreviewDraft({
        id: response.data.id,
        filename: response.data.filename,
        status: 'published',
        layout: response.data.layout,
        summary: response.data.summary,
      });
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      setPreviewError(await extractRequestErrorMessage(requestError, 'Không tải được bản xem trước mẫu giáo án.'));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleUsePreviewTemplate = async () => {
    if (!previewTemplate) {
      return;
    }
    const template = previewTemplate;
    setPreviewTemplate(null);
    setPreviewDraft(null);
    setPreviewError('');
    await handleTemplateSelect(template);
    if (template.source === 'upload') {
      window.setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fileInputRef.current?.click();
      }, 80);
    }
  };

  const handleCloseTemplatePreview = () => {
    setPreviewTemplate(null);
    setPreviewDraft(null);
    setPreviewError('');
    setIsPreviewLoading(false);
  };

  const handleBackToGallery = () => {
    setWorkspaceMode('gallery');
    setPreviewTemplate(null);
  };

  const handleCreatePublicTemplate = async () => {
    await handleTemplateSelect(UPLOAD_TEMPLATE);
    window.setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fileInputRef.current?.click();
    }, 80);
  };

  const createTemplateDraft = async (selectedFile) => {
    setTemplateDraft(null);
    setSelectedTemplateLayout(null);
    pendingNodeTextRef.current = {};
    setTemplateFrameError('');
    setPublishedTemplateId(null);
    setSelectedNodeId(null);
    setIsTemplateFrameLoading(true);

    const formData = new FormData();
    formData.append('template_file', selectedFile);

    try {
      const response = await axios.post('/api/v1/lesson/template-drafts', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setTemplateDraft(response.data);
      const firstNode = flattenLayoutNodes(response.data.layout)[0];
      setSelectedNodeId(firstNode?.node_id || null);
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      const message = await extractRequestErrorMessage(
        requestError,
        'Không bóc được khung mẫu. Vui lòng kiểm tra lại file .docx.',
      );
      setTemplateFrameError(message);
    } finally {
      setIsTemplateFrameLoading(false);
    }
  };

  const handleFileChange = async (event) => {
    const selected = event.target.files?.[0];
    const filename = selected?.name.toLowerCase() || '';
    if (selected && filename.endsWith('.docx')) {
      setWorkspaceMode('editor');
      setSelectedTemplate(UPLOAD_TEMPLATE);
      setUploadedFile(selected);
      setError('');
      await createTemplateDraft(selected);
      return;
    }
    if (selected && filename.endsWith('.doc')) {
      setError('File .doc đời cũ chưa xử lý được trong Docker. Hãy mở Word, Save As thành .docx rồi tải lại.');
    } else {
      setError('Vui lòng chọn file định dạng .docx');
    }
    setUploadedFile(null);
    setTemplateDraft(null);
    setSelectedTemplateLayout(null);
    pendingNodeTextRef.current = {};
    setTemplateFrameError('');
    setPublishedTemplateId(null);
  };

  const handleDraftNodeChange = (nodeId, patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, 'text')) {
      pendingNodeTextRef.current[nodeId] = patch.text;
    }
    setTemplateDraft((draft) => {
      if (!draft) {
        return draft;
      }
      const layout = updateLayoutNode(draft.layout, nodeId, patch);
      return { ...draft, layout, summary: layout.summary };
    });
  };

  const handleDraftNodeTextInput = (nodeId, text) => {
    pendingNodeTextRef.current[nodeId] = text;
  };

  const handleSaveTemplate = async () => {
    if (!templateDraft) {
      return;
    }
    setIsDraftSaving(true);
    setError('');
    try {
      const nodes = flattenLayoutNodes(templateDraft.layout).map((node) => ({
        node_id: node.node_id,
        role: node.role,
        text: node.role === 'generated' ? '' : pendingNodeTextRef.current[node.node_id] ?? node.display_text ?? '',
        instruction: node.instruction || '',
      }));
      const patchResponse = await axios.patch(
        `/api/v1/lesson/template-drafts/${templateDraft.id}/nodes`,
        { nodes },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const publishResponse = await axios.post(
        `/api/v1/lesson/template-drafts/${templateDraft.id}/publish`,
        {
          name: uploadedFile?.name?.replace(/\.docx$/i, '') || templateDraft.filename,
          visibility: isAdmin ? 'public' : 'personal',
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const template = publishResponse.data.template;
      const savedTemplate = mapApiTemplateToCard(template);
      setTemplateDraft(patchResponse.data);
      setSavedTemplates((templates) => [savedTemplate, ...templates.filter((item) => item.templateId !== template.id)]);
      setSelectedTemplate(savedTemplate);
      setWorkspaceMode('editor');
      setPublishedTemplateId(template.id);
      pendingNodeTextRef.current = {};
      setSelectedTemplateLayout({
        id: template.id,
        filename: template.filename,
        status: 'published',
        layout: patchResponse.data.layout,
        summary: patchResponse.data.summary,
      });
      setError('');
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      setError(await extractRequestErrorMessage(requestError, 'Không lưu được mẫu giáo án. Vui lòng thử lại.'));
    } finally {
      setIsDraftSaving(false);
    }
  };

  const handleRenameTemplate = async (template) => {
    if (!template?.canEdit) {
      return;
    }
    const nextName = window.prompt('Tên mẫu giáo án', template.name);
    if (!nextName || nextName.trim() === template.name) {
      return;
    }
    setError('');
    try {
      const response = await axios.patch(
        `/api/v1/lesson/templates/${template.templateId}`,
        { name: nextName.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const updatedTemplate = mapApiTemplateToCard(response.data);
      setSavedTemplates((templates) => templates.map((item) => (item.templateId === template.templateId ? updatedTemplate : item)));
      setSelectedTemplate((selected) => (selected.templateId === template.templateId ? updatedTemplate : selected));
      if (selectedTemplateLayout?.id === template.templateId) {
        setSelectedTemplateLayout((draft) => ({ ...draft, filename: response.data.filename }));
      }
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      setError(await extractRequestErrorMessage(requestError, 'Không đổi tên được mẫu giáo án.'));
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (!template?.canDelete) {
      return;
    }
    const confirmed = window.confirm(`Xóa mẫu "${template.name}"?`);
    if (!confirmed) {
      return;
    }
    setError('');
    try {
      await axios.delete(`/api/v1/lesson/templates/${template.templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedTemplates((templates) => templates.filter((item) => item.templateId !== template.templateId));
      if (selectedTemplate.templateId === template.templateId) {
        setSelectedTemplate(UPLOAD_TEMPLATE);
        setWorkspaceMode('gallery');
        setPublishedTemplateId(null);
        setSelectedTemplateLayout(null);
      }
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      setError(await extractRequestErrorMessage(requestError, 'Không xóa được mẫu giáo án.'));
    }
  };

  const handleLopChange = (value) => {
    setLop(value);
    setMonHoc('');
    setTenBaiDay('');
  };

  const handleMonHocChange = (value) => {
    setMonHoc(value);
    setTenBaiDay('');
  };

  const handleGenerate = async () => {
    if (missingRequirements.length > 0) {
      setError(`Vui lòng bổ sung: ${missingRequirements.join(', ')}.`);
      return;
    }

    setIsGenerating(true);
    setError('');
    setResultBlobUrl(null);
    setResultBlob(null);

    const formData = new FormData();
    formData.append('template_id', String(publishedTemplateId));
    formData.append('prompt', prompt);
    formData.append('truong', truong);
    formData.append('to_chuyen_mon', to);
    formData.append('giao_vien', giaoVien);
    formData.append('lop', lop);
    formData.append('mon_hoc', monHoc);
    formData.append('ten_bai_day', tenBaiDay);
    formData.append('so_tiet', soTiet);

    try {
      const response = await axios.post('/api/v1/lesson/generate', formData, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultBlobUrl(url);
    } catch (requestError) {
      if (requestError.response?.status === 401 || requestError.response?.status === 403) {
        onUnauthorized();
        return;
      }
      console.error(requestError);
      const message = await extractRequestErrorMessage(
        requestError,
        'Đã xảy ra lỗi trong quá trình xử lý. Vui lòng thử lại.',
      );
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (workspaceMode === 'gallery') {
    return (
      <div className="lesson-gallery-workbench">
        <header className="lesson-gallery-topbar">
          <div>
            <span>EduMate Studio</span>
            <h1>Chọn mẫu giáo án</h1>
            <p>Chọn một mẫu để xem trước, sau đó vào workspace tạo giáo án.</p>
          </div>
          <div className="lesson-gallery-badges">
            {isAdmin ? <span>Quản trị viên</span> : <span>Giáo viên</span>}
            <span>{savedTemplates.length} mẫu đã lưu</span>
          </div>
        </header>

        <main className="lesson-gallery-main">
          <TemplateGallery
            templates={filteredTemplates}
            filters={LESSON_TEMPLATE_FILTERS}
            activeFilter={activeFilter}
            selectedTemplate={null}
            searchValue={templateSearch}
            onSearchChange={setTemplateSearch}
            onFilterChange={setActiveFilter}
            onPreview={handleTemplatePreview}
            onUse={handleTemplateSelect}
            onRename={handleRenameTemplate}
            onDelete={handleDeleteTemplate}
            onCreateTemplate={handleCreatePublicTemplate}
            isAdmin={isAdmin}
          />
          {error ? <div className="form-error lesson-gallery-error">{error}</div> : null}
        </main>

        <TemplatePreviewModal
          template={previewTemplate}
          draft={previewDraft}
          isLoading={isPreviewLoading}
          error={previewError}
          onClose={handleCloseTemplatePreview}
          onUse={handleUsePreviewTemplate}
        />
      </div>
    );
  }

  return (
    <div className="lesson-editor-workbench">
      <header className="lesson-editor-topbar">
        <div className="lesson-topbar-title lesson-topbar-title-row">
          <button className="lesson-editor-back-btn" type="button" onClick={handleBackToGallery}>
            <ArrowLeft size={17} /> Đổi mẫu
          </button>
          <div>
            <span>EduMate Studio</span>
            <h1>Soạn kế hoạch bài dạy</h1>
            <p>{selectedTemplate.name}</p>
          </div>
        </div>
        <div className="lesson-topbar-status">
          <span>{activePreviewSummary.node_count || 0} vùng chữ</span>
          <span>{activePreviewSummary.table_count || 0} bảng</span>
          <span>{activePreviewSummary.editable_node_count || 0} vùng AI</span>
        </div>
        <div className="lesson-topbar-actions">
          {isUploadTemplate ? (
            <button
              className="toolbar-secondary-btn"
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateDraft || isDraftSaving}
            >
              {isDraftSaving ? <Loader2 className="loader" size={17} /> : <Save size={17} />}
              {isDraftSaving ? 'Đang lưu' : 'Lưu mẫu'}
            </button>
          ) : null}
          {resultBlobUrl ? (
            <a href={resultBlobUrl} download="GiaoAn_HoanThien.docx" className="toolbar-secondary-btn">
              <Download size={17} /> Tải DOCX
            </a>
          ) : null}
          <button className="toolbar-primary-btn" type="button" onClick={handleGenerate} disabled={isSubmitDisabled}>
            {isGenerating ? <Loader2 className="loader" size={18} /> : <Sparkles size={18} />}
            {isGenerating ? 'Đang tạo' : resultBlobUrl ? 'Tạo lại' : 'Tạo giáo án'}
          </button>
        </div>
      </header>

      <div className="lesson-editor-grid">
        <aside className="lesson-template-rail">
          <TemplateGallery
            templates={filteredTemplates}
            filters={LESSON_TEMPLATE_FILTERS}
            activeFilter={activeFilter}
            selectedTemplate={selectedTemplate}
            searchValue={templateSearch}
            onSearchChange={setTemplateSearch}
            onFilterChange={setActiveFilter}
            onPreview={handleTemplatePreview}
            onUse={handleTemplateSelect}
            onRename={handleRenameTemplate}
            onDelete={handleDeleteTemplate}
            onCreateTemplate={handleCreatePublicTemplate}
            isAdmin={isAdmin}
          />

          {isUploadTemplate ? (
            <div className="upload-template-panel">
              <div className="upload-template-copy">
                <h4>Tải mẫu DOCX</h4>
                <p>Giữ layout và bảng biểu gốc của trường.</p>
              </div>
              <button
                className={`upload-area ${uploadedFile ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={24} className="upload-icon" />
                {uploadedFile ? (
                  <div className="file-info">
                    <FileText size={18} />
                    <span>{uploadedFile.name}</span>
                  </div>
                ) : (
                  <p>Chọn file .docx</p>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".docx"
                  style={{ display: 'none' }}
                />
              </button>
            </div>
          ) : null}
        </aside>

        <main className="lesson-canvas-stage">
          <div className="canvas-top-strip">
            <div>
              <span>{isUploadTemplate ? 'Tạo mẫu giáo án' : 'Xem mẫu giáo án'}</span>
              <strong>{activePreviewDraft?.filename || selectedTemplate.name}</strong>
            </div>
            <div className="canvas-top-actions">
              <span>{isUploadTemplate ? (isAdmin ? 'Lưu thành mẫu chung' : 'Lưu thành mẫu cá nhân') : selectedTemplate.visibility === 'public' ? 'Mẫu chung' : 'Mẫu cá nhân'}</span>
            </div>
          </div>

          {isUploadTemplate ? (
            <TemplateFramePreview
              draft={templateDraft}
              isLoading={isTemplateFrameLoading}
              error={templateFrameError}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onNodeChange={handleDraftNodeChange}
              onNodeDraftTextChange={handleDraftNodeTextInput}
              onSaveTemplate={handleSaveTemplate}
              isSaving={isDraftSaving}
              showHeader={false}
              showSummary={false}
              showInspector={false}
            />
          ) : (
            <TemplateFramePreview
              draft={selectedTemplateLayout}
              isLoading={isSavedTemplateLoading}
              error=""
              selectedNodeId={null}
              onSelectNode={() => {}}
              onNodeChange={() => {}}
              onNodeDraftTextChange={() => {}}
              onSaveTemplate={() => {}}
              isSaving={false}
              readOnly
              title={selectedTemplate.name}
              sourceLabel="Mẫu giáo án đã lưu"
              showHeader={false}
              showSummary={false}
            />
          )}

          {resultBlobUrl && !isGenerating ? (
            <div className="generated-doc-panel">
              <div className="document-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                  <FileText size={20} color="var(--primary-color)" />
                  <span>Kế hoạch bài dạy: {tenBaiDay || 'Bài học'}.docx</span>
                </div>
                <a href={resultBlobUrl} download="GiaoAn_HoanThien.docx" className="toolbar-secondary-btn">
                  <Download size={17} /> Tải xuống
                </a>
              </div>

              <div
                className="document-page"
                ref={previewRef}
                style={{ padding: '1rem', overflowX: 'auto' }}
              />
            </div>
          ) : null}
        </main>

        <aside className="lesson-properties-panel">
          <section className="property-panel-section status-section">
            <div>
              <span>Trạng thái</span>
              <strong>{missingRequirements.length > 0 ? 'Cần bổ sung thông tin' : 'Sẵn sàng tạo giáo án'}</strong>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            {missingRequirements.length > 0 ? (
              <div className="submit-hint">Còn thiếu: {missingRequirements.join(', ')}.</div>
            ) : (
              <div className="submit-ready">Đã đủ thông tin. Có thể tạo giáo án ngay.</div>
            )}
          </section>

          <section className="property-panel-section">
            <div className="panel-section-heading">
              <span>Thiết lập bài học</span>
              <strong>Thông tin cơ bản</strong>
            </div>
            <div className="lesson-meta-stack">
              <input type="text" placeholder="Tên trường (*)" value={truong} onChange={(event) => setTruong(event.target.value)} />
              <input type="text" placeholder="Tổ chuyên môn (*)" value={to} onChange={(event) => setTo(event.target.value)} />
              <input type="text" placeholder="Tên giáo viên (*)" value={giaoVien} onChange={(event) => setGiaoVien(event.target.value)} />
              <CustomSelect value={soTiet} onChange={setSoTiet} options={soTietOptions} placeholder="Thời lượng (*)" />
              <CustomSelect value={lop} onChange={handleLopChange} options={lopOptions} placeholder="Chọn Lớp (*)" />
              {lop ? <CustomSelect value={monHoc} onChange={handleMonHocChange} options={currentMonHocOptions} placeholder="Chọn Môn học (*)" /> : null}
              {monHoc ? (
                <input
                  type="text"
                  placeholder="Tên bài dạy (*)"
                  value={tenBaiDay}
                  onChange={(event) => setTenBaiDay(event.target.value)}
                />
              ) : null}
            </div>
          </section>

          <section className="property-panel-section">
            <div className="panel-section-heading">
              <span>Nội dung</span>
              <strong>Yêu cầu cho AI</strong>
            </div>
            <textarea
              rows="5"
              placeholder="Ví dụ: Tạo giáo án có hoạt động nhóm, câu hỏi gợi mở và đánh giá cuối tiết."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </section>

          {isUploadTemplate ? (
            <section className="property-panel-section">
              <TemplateNodeInspector node={selectedDraftNode} onNodeChange={handleDraftNodeChange} />
            </section>
          ) : (
            <section className="property-panel-section template-readonly-note">
              <span>Mẫu đang dùng</span>
              <strong>{selectedTemplate.name}</strong>
              <p>Mẫu đã lưu chỉ dùng để sinh giáo án. Muốn chỉnh vùng AI, hãy upload lại DOCX và lưu thành mẫu mới.</p>
            </section>
          )}

          <section className="property-panel-section" style={{
            background: 'linear-gradient(135deg, rgba(206, 122, 88, 0.06), rgba(16, 185, 129, 0.04))',
            border: '2px solid rgba(206, 122, 88, 0.2)',
            marginTop: 'auto',
          }}>
            <div className="panel-section-heading">
              <span>Bước cuối</span>
              <strong style={{ fontSize: '1.1rem' }}>🚀 Tạo giáo án với AI</strong>
            </div>
            {missingRequirements.length > 0 ? (
              <div className="submit-hint" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
                Còn thiếu: {missingRequirements.join(', ')}.
              </div>
            ) : (
              <div className="submit-ready" style={{ color: '#047857', fontWeight: 600 }}>
                ✅ Đã đủ thông tin — Bấm nút bên dưới để sinh giáo án!
              </div>
            )}
            <button
              className="toolbar-primary-btn"
              type="button"
              onClick={handleGenerate}
              disabled={isSubmitDisabled}
              style={{ width: '100%', minHeight: 48, fontSize: '1rem', borderRadius: 10, gap: '0.6rem' }}
            >
              {isGenerating ? <Loader2 className="loader" size={20} /> : <Sparkles size={20} />}
              {isGenerating ? 'Đang tạo giáo án...' : resultBlobUrl ? 'Tạo lại giáo án' : 'Tạo giáo án với AI'}
            </button>
            {resultBlobUrl ? (
              <a
                href={resultBlobUrl}
                download="GiaoAn_HoanThien.docx"
                className="toolbar-secondary-btn"
                style={{ width: '100%', justifyContent: 'center', minHeight: 42 }}
              >
                <Download size={17} /> Tải giáo án (.docx)
              </a>
            ) : null}
          </section>
        </aside>
      </div>

      <TemplatePreviewModal
        template={previewTemplate}
        draft={previewDraft}
        isLoading={isPreviewLoading}
        error={previewError}
        onClose={handleCloseTemplatePreview}
        onUse={handleUsePreviewTemplate}
      />
    </div>
  );
}

function ComingSoon({ title, icon: Icon }) {
  return (
    <>
      <div className="page-header">
        <h1>{title}</h1>
        <p>Tính năng đang trong giai đoạn phát triển.</p>
      </div>
      <div className="coming-soon">
        <Icon className="coming-soon-icon" />
        <h2>Đang phát triển</h2>
        <p>Vui lòng quay lại sau</p>
      </div>
    </>
  );
}

function AppLayout({ isDark, setIsDark, user, onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="EduMate" style={{ maxHeight: '60px', width: 'auto' }} />
          <button className="toggle-sidebar-btn" type="button" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <nav className="nav-menu">
          <NavLink to="/lesson-plan" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={20} /> <span>Soạn giáo án</span>
          </NavLink>
          <NavLink to="/exam" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={20} /> <span>Tạo đề thi</span>
          </NavLink>
          <NavLink to="/slide" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Presentation size={20} /> <span>Tạo slide bài giảng</span>
          </NavLink>
          <NavLink to="/worksheet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ClipboardList size={20} /> <span>Tạo phiếu bài tập</span>
          </NavLink>
          <NavLink to="/simulation" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <PlayCircle size={20} /> <span>Tạo mô phỏng bài học</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-btn" style={{ display: isSidebarCollapsed ? 'none' : 'flex' }}>
            <div className="user-avatar">{(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user?.full_name || 'Giáo viên'}</span>
              <span className="user-plan">{user?.role === 'admin' ? 'Quản trị viên' : 'Đã xác thực email'}</span>
            </div>
          </div>
          <button className="theme-toggle-icon" type="button" onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="theme-toggle-icon" type="button" onClick={onLogout} title="Đăng xuất">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute({ session, children }) {
  const location = useLocation();
  if (!session.token || !session.user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function App() {
  const [session, setSession] = useState(readStoredSession);
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(readStoredSession().token));
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.body.classList.add('disable-transitions');
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }

    window.getComputedStyle(document.body).getPropertyValue('opacity');
    const timeout = setTimeout(() => {
      document.body.classList.remove('disable-transitions');
    }, 50);
    return () => clearTimeout(timeout);
  }, [isDark]);

  useEffect(() => {
    let isCancelled = false;
    async function validateSession() {
      if (!session.token) {
        setIsSessionLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || 'Session expired');
        }
        if (!isCancelled) {
          persistSession(session.token, data);
          setSession({ token: session.token, user: data });
        }
      } catch {
        if (!isCancelled) {
          clearStoredSession();
          setSession({ token: '', user: null });
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    }
    validateSession();
    return () => {
      isCancelled = true;
    };
  }, [session.token]);

  function handleAuthenticated(token, user) {
    persistSession(token, user);
    setSession({ token, user });
  }

  function handleLogout() {
    clearStoredSession();
    setSession({ token: '', user: null });
  }

  if (isSessionLoading) {
    return (
      <div className="global-loading-overlay">
        <Sparkles size={48} className="loading-star" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            isDark={isDark}
            setIsDark={setIsDark}
            session={session}
            onAuthenticated={handleAuthenticated}
          />
        }
      />
      <Route
        element={
          <ProtectedRoute session={session}>
            <AppLayout isDark={isDark} setIsDark={setIsDark} user={session.user} onLogout={handleLogout} />
          </ProtectedRoute>
        }
      >
        <Route path="/lesson-plan" element={<LessonPlanTool token={session.token} user={session.user} onUnauthorized={handleLogout} />} />
        <Route path="/exam" element={<ComingSoon title="Tạo đề thi" icon={FileText} />} />
        <Route path="/slide" element={<ComingSoon title="Tạo slide bài giảng" icon={Presentation} />} />
        <Route path="/worksheet" element={<ComingSoon title="Tạo phiếu bài tập" icon={ClipboardList} />} />
        <Route path="/simulation" element={<ComingSoon title="Tạo mô phỏng bài học" icon={PlayCircle} />} />
      </Route>
      <Route path="*" element={<Navigate to={session.token ? '/lesson-plan' : '/'} replace />} />
    </Routes>
  );
}

export default App;
