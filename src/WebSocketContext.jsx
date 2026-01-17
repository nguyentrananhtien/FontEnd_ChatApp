import React, { createContext, useRef, useState, useEffect, useCallback } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext(null);

const WS_URL = "wss://chat.longapp.site/chat/chat";
const RECONNECT_DELAY = 2000; // 2 giây

export const WebSocketProvider = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [connectionError, setConnectionError] = useState(false);

    const [messages, setMessages] = useState([]);
    const [userList, setUserList] = useState([]);
    const [roomList, setRoomList] = useState([]);
    const socket = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const shouldReconnect = useRef(true);

    const connectWebSocket = useCallback(() => {
        // Nếu đang có kết nối, đóng nó
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            return;
        }

        console.log("🔌 Đang kết nối tới:", WS_URL);
        
        try {
            socket.current = new WebSocket(WS_URL);
            console.log("📡 WebSocket đã tạo, đang chờ kết nối...");
        } catch (err) {
            console.error("❌ Lỗi tạo WebSocket:", err);
            // Thử kết nối lại
            if (shouldReconnect.current) {
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
            }
            return;
        }

        socket.current.onopen = () => {
            console.log("✅ Đã kết nối tới Server");
            setIsReady(true);
            setConnectionError(false);

            const savedUser = localStorage.getItem("chat_username");
            const savedCode = localStorage.getItem("re_login_code");

            if (savedUser && savedCode) {
                console.log("🔄 Đang gửi RE_LOGIN...");
                const payload = {
                    action: "onchat",
                    data: {
                        event: "RE_LOGIN",
                        data: { user: savedUser, code: savedCode }
                    }
                };
                socket.current.send(JSON.stringify(payload));
            } else {
                console.log("ℹ️ Không tìm thấy thông tin đăng nhập cũ.");
            }
        };

        socket.current.onclose = (event) => {
            console.log("❌ Mất kết nối", event.code, event.reason);
            setIsReady(false);
            
            // Code 1006 = Abnormal Closure - Server không phản hồi
            if (event.code === 1006) {
                setConnectionError(true);
            }
            
            // Auto reconnect
            if (shouldReconnect.current) {
                console.log(`🔄 Kết nối lại sau ${RECONNECT_DELAY/1000}s...`);
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, RECONNECT_DELAY);
            }
        };

        socket.current.onerror = (error) => {
            console.error("⚠️ WebSocket error:", error);
            setConnectionError(true);
        };

        socket.current.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                console.log("📩 Nhận tin:", JSON.stringify(response, null, 2));

                // Xử lý danh sách user
                if (response.event === "GET_USER_LIST" && response.data) {
                    setUserList(response.data);
                }

                // Xử lý Login/Re-login thành công
                if ((response.event === "RE_LOGIN" || response.event === "LOGIN") && response.status === "success") {
                    console.log("✅ Đăng nhập/Re-login thành công!");
                    setIsAuthenticated(true);

                    if (response.data?.RE_LOGIN_CODE) {
                        localStorage.setItem("re_login_code", response.data.RE_LOGIN_CODE);
                    }
                }

                // Xử lý RE_LOGIN thất bại - xóa credentials cũ
                if (response.event === "RE_LOGIN" && response.status === "error") {
                    console.error("⛔ RE_LOGIN thất bại:", response.mes);
                    localStorage.removeItem("chat_username");
                    localStorage.removeItem("re_login_code");
                    setIsAuthenticated(false);
                    window.location.href = "/";
                }

                // Xử lý tạo room - log để debug
                if (response.event === "CREATE_ROOM") {
                    console.log("🏠 CREATE_ROOM response:", response);
                }

                // Xử lý join room - log để debug
                if (response.event === "JOIN_ROOM") {
                    console.log("🚪 JOIN_ROOM response:", response);
                }

                // Xử lý SEND_CHAT - tin nhắn đến từ người khác
                if (response.event === "SEND_CHAT") {
                    console.log("💬 SEND_CHAT nhận được:", JSON.stringify(response.data, null, 2));
                    console.log("💬 Full response:", JSON.stringify(response, null, 2));
                }

                // Xử lý tin nhắn dạng khác (server có thể gửi với event khác)
                if (response.event === "ROOM_CHAT" || response.event === "RECEIVE_CHAT") {
                    console.log("📨 Tin nhắn dạng khác:", response.event, response.data);
                }

                // Lỗi User not Login
                if (response.status === "error" && response.mes === "User not Login") {
                    console.error("⛔ Lỗi xác thực. Cần đăng nhập lại.");
                    setIsAuthenticated(false);
                }

                setMessages(prev => [...prev, response]);
            } catch (e) {
                console.error("Lỗi đọc tin nhắn:", e);
            }
        };
    }, []);

    useEffect(() => {
        connectWebSocket();

        return () => {
            shouldReconnect.current = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socket.current) {
                socket.current.close();
            }
        };
    }, [connectWebSocket]);

    const sendMessage = (eventName, data = {}) => {
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            const payload = {
                action: "onchat",
                data: {
                    event: eventName,
                    data: data
                }
            };
            console.log("⬆️ Đang gửi payload:", JSON.stringify(payload, null, 2));
            socket.current.send(JSON.stringify(payload));
        } else {
            console.warn("⚠️ Chưa kết nối, không thể gửi:", eventName);
        }
    };

    // Hàm logout
    const logout = () => {
        // Tắt auto-reconnect
        shouldReconnect.current = false;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        
        // Gửi LOGOUT event đến server
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            const payload = {
                action: "onchat",
                data: {
                    event: "LOGOUT"
                }
            };
            socket.current.send(JSON.stringify(payload));
            console.log("👋 Đã gửi yêu cầu LOGOUT");
        }
        
        // Xóa thông tin đăng nhập
        localStorage.removeItem("chat_username");
        localStorage.removeItem("re_login_code");
        setIsAuthenticated(false);
        setMessages([]);
        setUserList([]);
        setRoomList([]);
        
        // Đóng socket
        if (socket.current) {
            socket.current.close();
        }
        
        // Chuyển về trang login
        window.location.href = "/";
    };

    return (
        <WebSocketContext.Provider value={{ 
            sendMessage, 
            messages, 
            setMessages, 
            isReady, 
            userList, 
            isAuthenticated,
            roomList,
            setRoomList,
            logout,
            connectionError
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};
