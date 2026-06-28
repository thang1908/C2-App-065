import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  FileText,
  Loader2,
  MessageCircle,
  Moon,
  PlayCircle,
  Presentation,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import './landing-page.css';

const INITIAL_AUTH_FORM = {
  full_name: '',
  email: '',
  password: '',
};

function LandingPage({ isDark, setIsDark, session, onAuthenticated }) {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => {
    const verifyToken = new URLSearchParams(window.location.search).get('verify_token');
    return Boolean(verifyToken);
  });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(INITIAL_AUTH_FORM);
  const [authMessage, setAuthMessage] = useState(() => {
    const verifyToken = new URLSearchParams(window.location.search).get('verify_token');
    return verifyToken ? 'Đang xác thực email...' : '';
  });
  const [authError, setAuthError] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(() => {
    const verifyToken = new URLSearchParams(window.location.search).get('verify_token');
    return Boolean(verifyToken);
  });
  const authEmailRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    if (!verifyToken) {
      return undefined;
    }

    let isCancelled = false;

    async function verifyEmailToken() {
      try {
        const response = await fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(verifyToken)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.detail || 'Không thể xác thực email.');
        }
        if (!isCancelled) {
          setVerificationUrl('');
          setAuthMessage(data.message || 'Email đã được xác thực. Bạn có thể đăng nhập ngay.');
        }
      } catch (error) {
        if (!isCancelled) {
          setAuthError(error.message || 'Link xác thực không hợp lệ hoặc đã hết hạn.');
        }
      } finally {
        if (!isCancelled) {
          setIsVerifyingEmail(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          setAuthMode('login');
          setIsAuthModalOpen(true);
        }
      }
    }

    verifyEmailToken();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthModalOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      authEmailRef.current?.focus();
    }, 80);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isAuthSubmitting && !isVerifyingEmail) {
        setIsAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAuthModalOpen, isAuthSubmitting, isVerifyingEmail]);

  function openAuthModal(mode = 'login') {
    setAuthMode(mode);
    setAuthError('');
    if (!isVerifyingEmail) {
      setAuthMessage('');
      setVerificationUrl('');
    }
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    if (isAuthSubmitting || isVerifyingEmail) {
      return;
    }
    setIsAuthModalOpen(false);
  }

  function updateAuthField(name, value) {
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setVerificationUrl('');

    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthError('Hãy nhập email và mật khẩu.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const endpoint = authMode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
      const payload =
        authMode === 'register'
          ? {
              email: authForm.email.trim(),
              password: authForm.password,
              full_name: authForm.full_name.trim() || null,
            }
          : {
              email: authForm.email.trim(),
              password: authForm.password,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Không thể xử lý yêu cầu xác thực.');
      }

      if (authMode === 'register') {
        setAuthMode('login');
        setAuthForm((current) => ({ ...current, password: '' }));
        setAuthMessage(data.message || 'Đăng ký thành công. Hãy xác thực email trước khi đăng nhập.');
        setVerificationUrl(data.verification_url || '');
        return;
      }

      onAuthenticated(data.access_token, data.user);
      setIsAuthModalOpen(false);
      navigate('/lesson-plan');
    } catch (error) {
      setAuthError(error.message || 'Đã xảy ra lỗi xác thực.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setAuthError('');
    setAuthMessage('');
    setVerificationUrl('');

    if (!authForm.email.trim()) {
      setAuthError('Nhập email trước khi gửi lại link xác thực.');
      return;
    }

    setIsAuthSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Không thể gửi lại email xác thực.');
      }
      setAuthMessage(data.message || 'Nếu email tồn tại, hệ thống đã gửi lại link xác thực.');
      setVerificationUrl(data.verification_url || '');
    } catch (error) {
      setAuthError(error.message || 'Không thể gửi lại email xác thực.');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  const isAuthenticated = Boolean(session?.token && session?.user);

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="landing-brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="EduMate" />
        </div>

        <nav className="landing-nav">
          <div className="nav-item-container">
            <a href="#features" className="landing-nav-link">
              Tính năng <ChevronDown size={14} style={{ marginLeft: '2px', verticalAlign: 'middle', display: 'inline-block' }} />
            </a>
            <div className="nav-dropdown glass-dropdown">
              <NavLink to={isAuthenticated ? '/lesson-plan' : '/'} className="dropdown-item">
                <BookOpen size={18} /> Soạn giáo án AI
              </NavLink>
              <a href="#features" className="dropdown-item">
                <FileText size={18} /> Tạo đề thi tự động
              </a>
              <a href="#features" className="dropdown-item">
                <Presentation size={18} /> Thiết kế Slide bài giảng
              </a>
              <a href="#features" className="dropdown-item">
                <PlayCircle size={18} /> Mô phỏng bài học
              </a>
            </div>
          </div>

          <a href="#pricing" className="landing-nav-link">Bảng giá</a>
          <button className="landing-nav-link" type="button" onClick={() => openAuthModal('login')}>Đăng nhập</button>
          <a href="#contact" className="landing-nav-link">Liên hệ</a>
        </nav>

        <div className="landing-actions">
          {isAuthenticated ? (
            <NavLink to="/lesson-plan" className="btn-trial">Vào workspace</NavLink>
          ) : (
            <>
              <button className="btn-login" type="button" onClick={() => openAuthModal('login')}>Đăng nhập</button>
              <button className="btn-trial" type="button" onClick={() => openAuthModal('register')}>Trải nghiệm miễn phí</button>
            </>
          )}
        </div>
      </header>

      <main className="landing-hero">
        <div className="hero-badge">
          <Sparkles size={16} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '6px' }} />
          Trợ lý AI dành cho Giáo viên
        </div>

        <h1>
          Thiết kế bài giảng thông minh cùng <span style={{ display: 'inline-block' }}><span className="brand-edu">Edu</span><span className="brand-mate">Mate</span></span>
        </h1>

        <p>
          <span className="brand-edu" style={{ fontWeight: 600 }}>Edu</span><span className="brand-mate" style={{ fontWeight: 600 }}>Mate</span> tự động hóa quy trình soạn giáo án chuẩn công văn 5512, giữ định dạng Word gốc và giúp giáo viên có bản DOCX hoàn chỉnh chỉ sau vài bước.
        </p>

        <div className="hero-actions">
          {isAuthenticated ? (
            <NavLink to="/lesson-plan" className="btn-hero-primary">Vào nơi sử dụng dịch vụ</NavLink>
          ) : (
            <button className="btn-hero-primary" type="button" onClick={() => openAuthModal('login')}>
              Đăng nhập để bắt đầu
            </button>
          )}
          <a href="#features" className="btn-hero-secondary">Tìm hiểu thêm</a>
        </div>

        <div className={`scroll-indicator ${isScrolled ? 'fade-out' : ''}`}>
          <a href="#features" aria-label="Cuộn xuống để xem tính năng">
            <ChevronDown size={32} />
          </a>
        </div>
      </main>

      <section id="features" className="features-section">
        <div className="features-header">
          <div className="hero-badge">Tính năng cốt lõi</div>
          <h2 className="section-title">Không gian làm việc của <span className="brand-edu">Edu</span><span className="brand-mate">Mate</span></h2>
          <p className="section-subtitle">Một workspace riêng cho giáo viên sau đăng nhập, bắt đầu bằng luồng soạn giáo án AI.</p>
        </div>

        <div className="timeline-container">
          <FeatureItem
            title="Soạn giáo án AI"
            text="Sinh giáo án chi tiết theo đúng cấu trúc template Word, giữ bảng biểu và định dạng gốc."
            image={`${import.meta.env.BASE_URL}images/feature_lesson_plan.png`}
          />
          <FeatureItem
            title="Tạo đề thi tự động"
            text="Chuẩn bị ma trận, câu hỏi và đáp án từ nội dung bài học trong các bước phát triển tiếp theo."
            image={`${import.meta.env.BASE_URL}images/feature_exam.png`}
          />
          <FeatureItem
            title="Thiết kế Slide bài giảng"
            text="Chuyển giáo án thành slide trực quan để phục vụ hoạt động trên lớp."
            image={`${import.meta.env.BASE_URL}images/feature_slide.png`}
          />
          <FeatureItem
            title="Mô phỏng bài học"
            text="Tạo trải nghiệm tương tác cho các bài học cần trực quan hóa."
            image={`${import.meta.env.BASE_URL}images/feature_simulation.png`}
          />
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <div className="features-header">
          <div className="hero-badge">Bảng giá</div>
          <h2 className="section-title">Gói dịch vụ phù hợp cho bạn</h2>
          <p className="section-subtitle">Bắt đầu miễn phí, nâng cấp khi cần thêm tính năng.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Miễn phí</h3>
              <div className="pricing-price"><span className="pricing-amount">0đ</span><span className="pricing-period">/tháng</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> 5 giáo án AI / tháng</li>
              <li><FileText size={16} /> Mẫu chuẩn Bộ GD&ĐT</li>
              <li><BookOpen size={16} /> Xuất file DOCX</li>
            </ul>
            <button className="btn-hero-secondary pricing-btn" type="button" onClick={() => openAuthModal('register')}>Bắt đầu miễn phí</button>
          </div>
          <div className="pricing-card featured">
            <div className="pricing-badge">Phổ biến nhất</div>
            <div className="pricing-card-header">
              <h3>Chuyên nghiệp</h3>
              <div className="pricing-price"><span className="pricing-amount">99.000đ</span><span className="pricing-period">/tháng</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> Không giới hạn giáo án AI</li>
              <li><FileText size={16} /> Tất cả mẫu giáo án</li>
              <li><BookOpen size={16} /> Upload mẫu DOCX riêng</li>
              <li><Presentation size={16} /> Tạo slide bài giảng</li>
              <li><PlayCircle size={16} /> Mô phỏng bài học</li>
            </ul>
            <button className="btn-hero-primary pricing-btn" type="button" onClick={() => openAuthModal('register')}>Dùng thử 14 ngày</button>
          </div>
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Trường học</h3>
              <div className="pricing-price"><span className="pricing-amount">Liên hệ</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> Tài khoản cho toàn trường</li>
              <li><FileText size={16} /> Mẫu giáo án riêng trường</li>
              <li><BookOpen size={16} /> Quản lý tập trung</li>
              <li><Presentation size={16} /> Hỗ trợ triển khai</li>
            </ul>
            <a href="#contact" className="btn-hero-secondary pricing-btn">Liên hệ tư vấn</a>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <div className="features-header">
          <div className="hero-badge">Bảng giá</div>
          <h2 className="section-title">Gói dịch vụ phù hợp cho bạn</h2>
          <p className="section-subtitle">Bắt đầu miễn phí, nâng cấp khi cần thêm tính năng.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Miễn phí</h3>
              <div className="pricing-price"><span className="pricing-amount">0đ</span><span className="pricing-period">/tháng</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> 5 giáo án AI / tháng</li>
              <li><FileText size={16} /> Mẫu chuẩn Bộ GD&ĐT</li>
              <li><BookOpen size={16} /> Xuất file DOCX</li>
            </ul>
            <button className="btn-hero-secondary pricing-btn" type="button" onClick={() => openAuthModal('register')}>Bắt đầu miễn phí</button>
          </div>
          <div className="pricing-card featured">
            <div className="pricing-badge">Phổ biến nhất</div>
            <div className="pricing-card-header">
              <h3>Chuyên nghiệp</h3>
              <div className="pricing-price"><span className="pricing-amount">99.000đ</span><span className="pricing-period">/tháng</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> Không giới hạn giáo án AI</li>
              <li><FileText size={16} /> Tất cả mẫu giáo án</li>
              <li><BookOpen size={16} /> Upload mẫu DOCX riêng</li>
              <li><Presentation size={16} /> Tạo slide bài giảng</li>
              <li><PlayCircle size={16} /> Mô phỏng bài học</li>
            </ul>
            <button className="btn-hero-primary pricing-btn" type="button" onClick={() => openAuthModal('register')}>Dùng thử 14 ngày</button>
          </div>
          <div className="pricing-card">
            <div className="pricing-card-header">
              <h3>Trường học</h3>
              <div className="pricing-price"><span className="pricing-amount">Liên hệ</span></div>
            </div>
            <ul className="pricing-features">
              <li><Sparkles size={16} /> Tài khoản cho toàn trường</li>
              <li><FileText size={16} /> Mẫu giáo án riêng trường</li>
              <li><BookOpen size={16} /> Quản lý tập trung</li>
              <li><Presentation size={16} /> Hỗ trợ triển khai</li>
            </ul>
            <a href="#contact" className="btn-hero-secondary pricing-btn">Liên hệ tư vấn</a>
          </div>
        </div>
      </section>

      <button
        className="floating-theme-toggle"
        type="button"
        onClick={() => setIsDark(!isDark)}
        title={isDark ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <a href="https://zalo.me/0123456789" target="_blank" rel="noopener noreferrer" className="floating-chat-btn">
        <MessageCircle size={28} />
      </a>

      <AuthModal
        isOpen={isAuthModalOpen}
        authMode={authMode}
        authForm={authForm}
        authMessage={authMessage}
        authError={authError}
        verificationUrl={verificationUrl}
        isAuthSubmitting={isAuthSubmitting}
        isVerifyingEmail={isVerifyingEmail}
        emailRef={authEmailRef}
        onClose={closeAuthModal}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError('');
        }}
        onUpdateField={updateAuthField}
        onSubmit={handleAuthSubmit}
        onResendVerification={handleResendVerification}
      />

      <footer id="contact" className="landing-footer">
        <p>&copy; {new Date().getFullYear()} <span className="brand-edu">Edu</span><span className="brand-mate">Mate</span>. Sẵn sàng cho giáo viên bắt đầu nhanh hơn.</p>
      </footer>
    </div>
  );
}

function AuthModal({
  isOpen,
  authMode,
  authForm,
  authMessage,
  authError,
  verificationUrl,
  isAuthSubmitting,
  isVerifyingEmail,
  emailRef,
  onClose,
  onModeChange,
  onUpdateField,
  onSubmit,
  onResendVerification,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="auth-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <button className="auth-modal-close" type="button" onClick={onClose} aria-label="Đóng đăng nhập">
          <X size={20} />
        </button>

        <div className="auth-modal-header">
          <span className="template-gallery-kicker">Tài khoản EduMate</span>
          <h2 id="auth-modal-title">{authMode === 'register' ? 'Tạo tài khoản mới' : 'Đăng nhập'}</h2>
          <p>Đăng nhập để vào workspace soạn giáo án, quản lý mẫu và xuất DOCX.</p>
        </div>

        <div className="auth-panel auth-modal-panel">
          <div className="auth-tabs">
            <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => onModeChange('login')}>Đăng nhập</button>
            <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => onModeChange('register')}>Tạo tài khoản</button>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            {authMode === 'register' ? (
              <input
                placeholder="Họ và tên"
                value={authForm.full_name}
                onChange={(event) => onUpdateField('full_name', event.target.value)}
              />
            ) : null}
            <input
              ref={emailRef}
              placeholder="Email"
              type="email"
              value={authForm.email}
              onChange={(event) => onUpdateField('email', event.target.value)}
            />
            <input
              placeholder="Mật khẩu"
              type="password"
              value={authForm.password}
              onChange={(event) => onUpdateField('password', event.target.value)}
            />

            {authMessage ? <div className="auth-message info">{authMessage}</div> : null}
            {authError ? <div className="auth-message error">{authError}</div> : null}
            {isVerifyingEmail ? <div className="auth-message info">Đang kiểm tra token xác thực...</div> : null}
            {verificationUrl ? (
              <div className="auth-message info">
                Môi trường dev chưa gửi SMTP thật. Mở link này để xác thực:
                <a href={verificationUrl}>Xác thực email</a>
              </div>
            ) : null}

            <button className="btn-hero-primary auth-submit" disabled={isAuthSubmitting} type="submit">
              {isAuthSubmitting ? (
                <>
                  <Loader2 className="loader" size={18} /> Đang xử lý...
                </>
              ) : authMode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
            <button className="btn-login auth-resend" disabled={isAuthSubmitting} type="button" onClick={onResendVerification}>
              Gửi lại email xác thực
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function FeatureItem({ title, text, image }) {
  const itemRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    if (itemRef.current) {
      observer.observe(itemRef.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`timeline-item ${isVisible ? 'animate-in' : ''}`} ref={itemRef}>
      <div className="timeline-dot" />
      <div className="timeline-content">
        <div className="timeline-text">
          <h3>{title}</h3>
          <p>{text}</p>
          <ul className="feature-list">
            <li><Sparkles size={16} /> Tự động hóa thao tác lặp lại</li>
            <li><BookOpen size={16} /> Bám sát nghiệp vụ giáo dục</li>
            <li><FileText size={16} /> Xuất tài liệu sẵn sàng sử dụng</li>
          </ul>
        </div>
        <div className="timeline-image">
          <img src={image} alt={title} />
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
