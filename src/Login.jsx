import React, { useContext, useState, useEffect } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';
import './login.css';

const Login = () => {
  const { messages, connectionState, api } = useContext(WebSocketContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [lastLoginEvent, setLastLoginEvent] = useState(null);
  const navigate = useNavigate();

  // Nếu đã có username trong localStorage, cho vào thẳng /chat
  useEffect(() => {
    const saved = localStorage.getItem('chat_username');
    if (saved) navigate('/chat');
  }, [navigate]);

  // Lắng nghe kết quả LOGIN
  useEffect(() => {
    const loginResponse = messages.find((msg) => msg.event === 'LOGIN');
    if (loginResponse) {
      setLastLoginEvent(loginResponse); // hiển thị debug
      if (loginResponse.status === 'success') {
        localStorage.setItem('chat_username', username || loginResponse.data?.user || '');
        navigate('/chat');
      }
    }
  }, [messages, navigate, username]);

  const handleSubmit = () => {
    if (!username || !password) return alert('Vui lòng nhập đầy đủ thông tin!');
    if (isRegisterMode) {
      api.register(username, password);
      alert('Đã gửi yêu cầu đăng ký. Hãy thử đăng nhập ngay!');
      setIsRegisterMode(false);
    } else {
      api.login(username, password);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{isRegisterMode ? 'Đăng Ký Tài Khoản' : 'Đăng Nhập'}</h2>
        <div style={{ fontSize: 13, marginBottom: 10, color: connectionState === 'open' ? 'green' : '#d9534f' }}>
          Trạng thái: {connectionState === 'open' ? 'Đã kết nối' : 'Đang kết nối...'}
        </div>

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

        <button className="btn-submit" onClick={handleSubmit} disabled={connectionState !== 'open'}>
          {isRegisterMode ? 'Đăng Ký Ngay' : 'Đăng Nhập'}
        </button>

        <div className="toggle-text">
          {isRegisterMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <span onClick={() => setIsRegisterMode(!isRegisterMode)}>
            {isRegisterMode ? 'Đăng nhập' : 'Đăng ký ngay'}
          </span>
        </div>

        {/* Debug nhanh sự kiện LOGIN mới nhất */}
        {lastLoginEvent && (
          <div style={{ marginTop: 12, fontSize: 12, textAlign: 'left', wordBreak: 'break-word' }}>
            <strong>Login event:</strong> {JSON.stringify(lastLoginEvent)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;