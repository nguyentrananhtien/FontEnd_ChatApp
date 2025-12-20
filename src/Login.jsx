import React, { useContext, useState, useEffect } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const { sendMessage, messages } = useContext(WebSocketContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    // Lắng nghe phản hồi từ server
    useEffect(() => {
        const loginResponse = messages.find(msg => msg.event === "LOGIN" && msg.status === "success");
        if (loginResponse) {
            // Lưu thông tin đăng nhập
            localStorage.setItem("chat_username", username);
            alert("Đăng nhập thành công!");
            navigate("/chat"); // Chuyển sang trang chat
        }
    }, [messages, navigate, username]);

    const handleLogin = () => {
        sendMessage("LOGIN", { user: username, pass: password });
    };

    const handleRegister = () => {
        sendMessage("REGISTER", { user: username, pass: password });
        alert("Đã gửi lệnh đăng ký, hãy thử đăng nhập ngay sau đó.");
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h2>Chat App Login</h2>
            <input
                placeholder="Tài khoản"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ display: 'block', margin: '10px auto', padding: '10px' }}
            />
            <input
                type="password"
                placeholder="Mật khẩu"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ display: 'block', margin: '10px auto', padding: '10px' }}
            />
            <button onClick={handleLogin} style={{ marginRight: '10px' }}>Đăng nhập</button>
            <button onClick={handleRegister}>Đăng ký</button>
        </div>
    );
};

export default Login;