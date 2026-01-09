import React, { createContext, useRef, useState, useEffect } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    // 🔥 MỚI: Biến này để chặn không cho Chat.jsx gửi lệnh linh tinh khi chưa login xong
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const [messages, setMessages] = useState([]);
    const [userList, setUserList] = useState([]);
    const socket = useRef(null);

    const sendMessageRaw = (ws, eventName, dataPayload = {}) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const payload = {
                action: "onchat",
                data: {
                    event: eventName,
                    data: dataPayload
                }
            };
            ws.send(JSON.stringify(payload));
            console.log("⬆️ Đã gửi:", eventName, dataPayload);
        } else {
            console.warn("⚠️ Chưa kết nối, không thể gửi:", eventName);
        }
    };

    useEffect(() => {
        socket.current = new WebSocket("wss://chat.longapp.site/chat/chat");

        socket.current.onopen = () => {
            console.log("✅ Đã kết nối tới Server");
            setIsReady(true);

            // 1. Vừa kết nối xong -> Chỉ gửi RE_LOGIN thôi, cấm gửi cái khác
            const savedUser = localStorage.getItem("chat_username");
            const savedCode = localStorage.getItem("re_login_code");

            if (savedUser && savedCode) {
                console.log("🔄 Đang gửi RE_LOGIN...");
                sendMessageRaw(socket.current, "RE_LOGIN", {
                    user: savedUser,
                    code: savedCode
                });
            } else {
                console.log("ℹ️ Không tìm thấy thông tin đăng nhập cũ.");
            }
        };

        socket.current.onclose = () => {
            console.log("❌ Mất kết nối");
            setIsReady(false);
            setIsAuthenticated(false); // Mất mạng là mất quyền
        };

        socket.current.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                console.log("📩 Nhận tin:", JSON.stringify(response, null, 2));

                if(response.event === "GET_USER_LIST" && response.data) {
                    setUserList(response.data);
                }

                // 2. Khi Server bảo Login/Re-login thành công -> Mới bật đèn xanh (isAuthenticated = true)
                if ((response.event === "RE_LOGIN" || response.event === "LOGIN") && response.status === "success") {
                    console.log("✅ Đăng nhập/Re-login thành công! Giờ mới được phép gửi lệnh khác.");
                    setIsAuthenticated(true);

                    if(response.data?.RE_LOGIN_CODE) {
                        localStorage.setItem("re_login_code", response.data.RE_LOGIN_CODE);
                    }
                }

                // Nếu lỗi User not Login -> Buộc user đăng nhập lại
                if (response.status === "error" && response.mes === "User not Login") {
                    console.error("⛔ Lỗi xác thực. Cần đăng nhập lại.");
                    setIsAuthenticated(false);
                }

                setMessages(prev => [...prev, response]);
            } catch (e) {
                console.error("Lỗi đọc tin nhắn:", e);
            }
        };

        return () => socket.current.close();
    }, []);

    const sendMessage = (eventName, data) => {
        sendMessageRaw(socket.current, eventName, data);
    };

    return (
        // Truyền thêm isAuthenticated ra ngoài
        <WebSocketContext.Provider value={{ sendMessage, messages, setMessages, isReady, userList, isAuthenticated }}>
            {children}
        </WebSocketContext.Provider>
    );
};