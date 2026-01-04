import React, { useContext, useState, useEffect } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';
import './Login.css'; // Import file CSS vừa tạo

const Login = () => {
    const { sendMessage, messages } = useContext(WebSocketContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isRegisterMode, setIsRegisterMode] = useState(false); // State để chuyển đổi giao diện
    const navigate = useNavigate();

    useEffect(() => {
        const loginResponse = messages.find(msg => msg.event === "LOGIN" && msg.status === "success");
        if (loginResponse) {
            localStorage.setItem("chat_username", username);
            // Không alert nữa cho chuyên nghiệp
            navigate("/chat");
        }
    }, [messages, navigate, username]);

    const handleSubmit = () => {
        if(!username || !password) return alert("Vui lòng nhập đầy đủ thông tin!");

        if (isRegisterMode) {
            // Chế độ Đăng ký
            sendMessage("REGISTER", { user: username, pass: password });
            alert("Đã gửi yêu cầu đăng ký. Hãy thử đăng nhập ngay!");
            setIsRegisterMode(false); // Chuyển về login để người dùng đăng nhập
        } else {
            // Chế độ Đăng nhập
            sendMessage("LOGIN", { user: username, pass: password });
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>{isRegisterMode ? "Đăng Ký Tài Khoản" : "Đăng Nhập"}</h2>

                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Tên đăng nhập"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Mật khẩu"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                </div>

                <button className="btn-submit" onClick={handleSubmit}>
                    {isRegisterMode ? "Đăng Ký Ngay" : "Đăng Nhập"}
                </button>

                <div className="toggle-text">
                    {isRegisterMode ? "Đã có tài khoản?" : "Chưa có tài khoản?"}
                    <span onClick={() => setIsRegisterMode(!isRegisterMode)}>
                        {isRegisterMode ? "Đăng nhập" : "Đăng ký ngay"}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default Login;