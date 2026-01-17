import React, { useContext, useState, useEffect } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';
import './login.css';

const Login = () => {
  const { messages, sendMessage, isReady, connectionError } = useContext(WebSocketContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Nếu đã có username trong localStorage, cho vào thẳng /chat
  useEffect(() => {
    const saved = localStorage.getItem('chat_username');
    if (saved) navigate('/chat'); 
  }, [navigate]);

  // Lắng nghe kết quả LOGIN
  useEffect(() => {
    const loginResponse = [...messages].reverse().find((msg) => msg.event === 'LOGIN' && !msg._processed);
    if (loginResponse) {
      setLastEvent(loginResponse);
      setIsLoading(false);
      if (loginResponse.status === 'success') {
        // Lưu RE_LOGIN_CODE nếu có
        if (loginResponse.data?.RE_LOGIN_CODE) {
          localStorage.setItem('re_login_code', loginResponse.data.RE_LOGIN_CODE);
        }
        localStorage.setItem('chat_username', username || loginResponse.data?.user || '');
        navigate('/chat');
      } else {
        alert('Đăng nhập thất bại: ' + (loginResponse.mes || 'Sai tài khoản hoặc mật khẩu'));
      }
    }
  }, [messages, navigate, username]);

  // Lắng nghe kết quả REGISTER
  useEffect(() => {
    const registerResponse = [...messages].reverse().find((msg) => msg.event === 'REGISTER' && !msg._processed);
    if (registerResponse) {
      setLastEvent(registerResponse);
      setIsLoading(false);
      if (registerResponse.status === 'success') {
        alert('✅ Đăng ký thành công! Bây giờ hãy đăng nhập.');
        setIsRegisterMode(false);
      } else {
        alert('❌ Đăng ký thất bại: ' + (registerResponse.mes || 'Tên đăng nhập đã tồn tại'));
      }
    }
  }, [messages]);

  const handleSubmit = () => {
    if (!username || !password) return alert('Vui lòng nhập đầy đủ thông tin!');
    if (isLoading) return;
    
    setIsLoading(true);
    setLastEvent(null);
    
    if (isRegisterMode) {
      sendMessage("REGISTER", { user: username, pass: password });
    } else {
      sendMessage("LOGIN", { user: username, pass: password });
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}</h2>
        
        {connectionError ? (
          <div style={{ fontSize: 13, marginBottom: 10, padding: '10px', background: '#ffe6e6', borderRadius: '5px', color: '#d9534f' }}>
            ⚠️ <strong>Không thể kết nối server!</strong><br/>
            <small>Server có thể đang bảo trì. Vui lòng thử lại sau.</small>
            <br/>
            <button 
              onClick={() => window.location.reload()} 
              style={{ marginTop: '8px', padding: '5px 10px', cursor: 'pointer' }}
            >
              🔄 Thử lại
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, marginBottom: 10, color: isReady ? 'green' : '#f0ad4e' }}>
            Trạng thái: {isReady ? '🟢 Đã kết nối' : '🟡 Đang kết nối...'}
          </div>
        )}

        <div className="input-group">
          <input
            type="text"
            placeholder="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <button className="btn-submit" onClick={handleSubmit} disabled={!isReady || isLoading}>
          {isLoading ? '⏳ Đang xử lý...' : (isRegisterMode ? 'Đăng Ký Ngay' : 'Đăng Nhập')}
        </button>

        <div className="toggle-text">
          {isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <span onClick={() => !isLoading && setIsRegisterMode(!isRegisterMode)}>
            {isRegisterMode ? 'Đăng nhập' : 'Đăng ký ngay'}
          </span>
        </div>

        {/* Debug sự kiện mới nhất */}
        {lastEvent && (
          <div style={{ marginTop: 12, fontSize: 12, textAlign: 'left', wordBreak: 'break-word', 
            background: lastEvent.status === 'success' ? '#d4edda' : '#f8d7da', 
            padding: '8px', borderRadius: '5px' }}>
            <strong>{lastEvent.event}:</strong> {lastEvent.status} - {lastEvent.mes || 'OK'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;