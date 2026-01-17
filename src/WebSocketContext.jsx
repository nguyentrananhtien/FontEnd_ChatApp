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
    // RoomList - sẽ được load sau khi có username
    const [roomList, setRoomList] = useState([]);
    // Danh sách người đã chat gần đây
    const [recentChats, setRecentChats] = useState([]);
    const socket = useRef(null);

    // === HELPER FUNCTIONS: Lưu/Load tin nhắn từ localStorage ===
    const getStorageKey = (type, targetName) => {
        const username = localStorage.getItem("chat_username");
        if (!username) return null;
        return `chat_messages_${username}_${type}_${targetName}`;
    };

    const saveMessagesToStorage = (type, targetName, msgs) => {
        const key = getStorageKey(type, targetName);
        if (!key) return;
        // Chỉ lưu tối đa 100 tin nhắn gần nhất
        const toSave = msgs.slice(-100);
        localStorage.setItem(key, JSON.stringify(toSave));
    };

    const loadMessagesFromStorage = (type, targetName) => {
        const key = getStorageKey(type, targetName);
        if (!key) return [];
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    };

    // Lưu danh sách người đã chat
    const saveRecentChats = (chats) => {
        const username = localStorage.getItem("chat_username");
        if (!username) return;
        localStorage.setItem(`chat_recent_${username}`, JSON.stringify(chats));
    };

    const loadRecentChats = () => {
        const username = localStorage.getItem("chat_username");
        if (!username) return [];
        const saved = localStorage.getItem(`chat_recent_${username}`);
        return saved ? JSON.parse(saved) : [];
    };

    // Thêm người vào danh sách chat gần đây
    const addToRecentChats = (name, type = 'people', lastMessage = '') => {
        setRecentChats(prev => {
            // Loại bỏ nếu đã tồn tại
            const filtered = prev.filter(c => !(c.name === name && c.type === type));
            // Thêm vào đầu danh sách
            const newChat = { name, type, lastMessage, timestamp: Date.now() };
            const updated = [newChat, ...filtered].slice(0, 50); // Giữ tối đa 50
            saveRecentChats(updated);
            return updated;
        });
    };
    const reconnectTimeoutRef = useRef(null);
    const shouldReconnect = useRef(true);
    const hasLoadedDataRef = useRef(false); // Track đã load data chưa

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
                // Log giảm - chỉ hiển thị event name
                // console.log("📩 Nhận:", response.event, response.status || "");

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
                    
                    // Load roomList từ localStorage theo username
                    const username = localStorage.getItem("chat_username");
                    if (username) {
                        const savedRooms = localStorage.getItem(`chat_room_list_${username}`);
                        if (savedRooms) {
                            const rooms = JSON.parse(savedRooms);
                            console.log("📂 Load roomList cho user:", username, rooms);
                            setRoomList(rooms);
                        }
                        // Load danh sách người đã chat
                        const savedRecentChats = loadRecentChats();
                        setRecentChats(savedRecentChats);
                        console.log("📂 Load recentChats:", savedRecentChats);
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

                // Xử lý tạo room
                if (response.event === "CREATE_ROOM") {
                    console.log("🏠 CREATE_ROOM response:", JSON.stringify(response, null, 2));
                }

                // Xử lý join room - lưu vào roomList và localStorage theo username
                if (response.event === "JOIN_ROOM") {
                    console.log("🚪 JOIN_ROOM response:", JSON.stringify(response, null, 2));
                    if (response.status === "success") {
                        // Lấy room name từ nhiều nguồn có thể
                        const roomName = response.data?.name || response.data?.roomName || response.name;
                        const username = localStorage.getItem("chat_username");
                        console.log("🚪 Room name tìm thấy:", roomName, "cho user:", username);
                        if (roomName && username) {
                            setRoomList(prev => {
                                const newList = prev.includes(roomName) ? prev : [...prev, roomName];
                                // Lưu theo username
                                localStorage.setItem(`chat_room_list_${username}`, JSON.stringify(newList));
                                console.log("💾 Đã lưu roomList:", newList);
                                return newList;
                            });
                        }
                    }
                }

                // Xử lý CREATE_ROOM thành công - lưu room name
                if (response.event === "CREATE_ROOM" && response.status === "success") {
                    const roomName = response.data?.name || response.data?.roomName || response.name;
                    const username = localStorage.getItem("chat_username");
                    console.log("🏠 CREATE_ROOM - Room name tìm thấy:", roomName, "cho user:", username);
                    if (roomName && username) {
                        setRoomList(prev => {
                            const newList = prev.includes(roomName) ? prev : [...prev, roomName];
                            localStorage.setItem(`chat_room_list_${username}`, JSON.stringify(newList));
                            return newList;
                        });
                    }
                }

                // Xử lý SEND_CHAT - tin nhắn đến từ người khác
                if (response.event === "SEND_CHAT") {
                    // Chuyển đổi type từ server: 0 = people, 1 = room
                    if (response.data && typeof response.data.type === 'number') {
                        response.data.type = response.data.type === 1 ? 'room' : 'people';
                    }
                    
                    // Thêm vào recent chats nếu là tin nhắn people
                    if (response.data?.type === 'people') {
                        const fromUser = response.data.from || response.data.name;
                        const myUsername = localStorage.getItem("chat_username");
                        if (fromUser && fromUser !== myUsername) {
                            addToRecentChats(fromUser, 'people', response.data.mes);
                        }
                    }
                }

                // Xử lý tin nhắn dạng khác (server có thể gửi với event khác)
                // if (response.event === "ROOM_CHAT" || response.event === "RECEIVE_CHAT") {
                //     console.log("📨 Tin nhắn dạng khác:", response.event);
                // }

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
            // console.log("⬆️ Gửi:", eventName);
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
        
        // Xóa thông tin đăng nhập (KHÔNG xóa room list - giữ lại theo username)
        localStorage.removeItem("chat_username");
        localStorage.removeItem("re_login_code");
        
        // Reset state
        setIsAuthenticated(false);
        setMessages([]);
        setUserList([]);
        setRoomList([]);
        hasLoadedDataRef.current = false; // Reset flag để load lại khi login
        
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
            connectionError,
            hasLoadedDataRef,
            // Thêm các hàm và state mới
            recentChats,
            setRecentChats,
            addToRecentChats,
            saveMessagesToStorage,
            loadMessagesFromStorage
        }}>
            {children}
        </WebSocketContext.Provider>
    );
};
