import React, { createContext, useRef, useState, useEffect } from 'react';

// Dòng dưới này dùng để tắt cảnh báo vàng bạn đang gặp phải
// eslint-disable-next-line react-refresh/only-export-components
export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    const [messages, setMessages] = useState([]);
    const [userList, setUserList] = useState([]);
    const socket = useRef(null);

    useEffect(() => {
        socket.current = new WebSocket("wss://chat.longapp.site/chat/chat");

        socket.current.onopen = () => {
            console.log("✅ Đã kết nối tới Server");
            setIsReady(true);
        };

        socket.current.onclose = () => {
            console.log("❌ Mất kết nối");
            setIsReady(false);
        };

        socket.current.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                console.log("📩 Nhận tin:", response);

                if(response.event === "GET_USER_LIST" && response.data) {
                    setUserList(response.data);
                }

                setMessages(prev => [...prev, response]);
            } catch (e) {
                console.error("Lỗi đọc tin nhắn:", e);
            }
        };

        return () => socket.current.close();
    }, []);

    const sendMessage = (eventName, dataPayload = {}) => {
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            const payload = {
                action: "onchat",
                data: {
                    event: eventName,
                    data: dataPayload
                }
            };
            socket.current.send(JSON.stringify(payload));
        } else {
            console.warn("Chưa kết nối tới server, không thể gửi:", eventName);
        }
    };

    return (
        <WebSocketContext.Provider value={{ sendMessage, messages, isReady, userList }}>
            {children}
        </WebSocketContext.Provider>
    );
};