import React, { useContext, useEffect, useState, useRef } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
    const { sendMessage, messages, setMessages, userList, isAuthenticated, roomList, setRoomList, logout, isReady } = useContext(WebSocketContext);

    // Tab: "people" hoặc "room"
    const [activeTab, setActiveTab] = useState("people");
    
    // Chat cá nhân
    const [currentChat, setCurrentChat] = useState(null);
    const [inputMes, setInputMes] = useState("");
    const [searchName, setSearchName] = useState("");

    // Room chat
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomInput, setRoomInput] = useState("");
    const [roomMessages, setRoomMessages] = useState([]);
    const [roomHistoryPage, setRoomHistoryPage] = useState(1);

    const messagesEndRef = useRef(null);
    const myUser = localStorage.getItem("chat_username");
    const navigate = useNavigate();

    // Scroll to bottom khi có tin nhắn mới
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, roomMessages]);

    // Auth check & load user list
    useEffect(() => {
        if (!myUser) {
            navigate("/");
            return;
        }

        if (isAuthenticated) {
            console.log("✅ Đã xác thực, đang tải danh sách user...");
            sendMessage("GET_USER_LIST");
        } else {
            console.log("⏳ Đang chờ xác thực từ server...");
        }
    }, [isAuthenticated, navigate, myUser]);

    // Debug: log tất cả messages khi có thay đổi
    useEffect(() => {
        console.log("📋 Tất cả tin nhắn SEND_CHAT:", messages.filter(m => m.event === "SEND_CHAT"));
    }, [messages]);

    // Lắng nghe tin nhắn room từ server (realtime)
    useEffect(() => {
        if (!currentRoom?.name) return;
        
        // Lọc tin nhắn trong room hiện tại từ messages global
        // Server trả về type: 1 cho room, type: 0 cho people
        // Hoặc type: "room" từ local message
        const roomMsgs = messages.filter(msg => {
            if (msg.event !== "SEND_CHAT" || !msg.data) return false;
            
            const isRoomType = msg.data.type === "room" || msg.data.type === 1;
            const isThisRoom = msg.data.to === currentRoom.name;
            
            return isRoomType && isThisRoom;
        });
        
        if (roomMsgs.length > 0) {
            console.log("🏠 Tin nhắn room hiện tại:", roomMsgs);
        }
        
        // Cập nhật roomMessages từ messages (bao gồm cả tin local và từ server)
        setRoomMessages(roomMsgs);
    }, [messages, currentRoom]);

    // Lắng nghe lịch sử chat room và thêm vào messages
    useEffect(() => {
        if (!currentRoom?.name) return;
        
        const historyResponse = [...messages].reverse().find(msg => 
            msg.event === "GET_ROOM_CHAT_MES" && msg.status === "success"
        );
        
        if (historyResponse && historyResponse.data && !historyResponse._processed) {
            const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : [];
            console.log("📜 Lịch sử room nhận được:", historyData);
            
            if (historyData.length > 0) {
                // Chuyển đổi format lịch sử thành format tin nhắn room
                const formattedHistory = historyData.map((item, idx) => ({
                    event: "SEND_CHAT",
                    data: {
                        type: "room",
                        from: item.name || item.user,
                        to: currentRoom.name,
                        mes: item.mes
                    },
                    _historyId: `hist-${currentRoom.name}-${idx}`
                })).reverse(); // Đảo ngược để tin cũ ở trên
                
                // Thêm lịch sử vào messages và đánh dấu đã xử lý
                setMessages(prev => {
                    // Đánh dấu historyResponse đã xử lý
                    const updated = prev.map(m => 
                        m === historyResponse ? { ...m, _processed: true } : m
                    );
                    // Lọc bỏ tin lịch sử cũ của room này
                    const withoutOldHistory = updated.filter(m => 
                        !m._historyId?.startsWith(`hist-${currentRoom.name}-`)
                    );
                    return [...formattedHistory, ...withoutOldHistory];
                });
            }
        }
    }, [messages, currentRoom, setMessages]);

    // === CHAT CÁ NHÂN ===
    const sendPeopleChat = () => {
        if (!currentChat) return alert("Chưa chọn người để chat!");
        if (!inputMes.trim()) return;

        sendMessage("SEND_CHAT", {
            type: "people",
            to: currentChat.name,
            mes: inputMes
        });

        const myMsg = {
            event: "SEND_CHAT",
            data: {
                type: "people",
                from: myUser,
                to: currentChat.name,
                mes: inputMes
            }
        };
        setMessages(prev => [...prev, myMsg]);
        setInputMes("");
    };

    const handleManualChat = () => {
        if(!searchName) return;
        const targetUser = searchName.trim();
        setCurrentChat({ name: targetUser });
        setSearchName("");
        // Load lịch sử chat với người này
        sendMessage("GET_PEOPLE_CHAT_MES", { name: targetUser, page: 1 });
    };

    // Khi click vào user trong danh sách
    const handleSelectUser = (userName) => {
        setCurrentChat({ name: userName });
        // Load lịch sử chat với người này
        sendMessage("GET_PEOPLE_CHAT_MES", { name: userName, page: 1 });
    };

    // Lắng nghe lịch sử chat cá nhân từ server
    useEffect(() => {
        const historyResponse = messages.find(msg => 
            msg.event === "GET_PEOPLE_CHAT_MES" && msg.status === "success" && !msg._processed
        );
        if (historyResponse && historyResponse.data && currentChat) {
            const historyData = Array.isArray(historyResponse.data) ? historyResponse.data : [];
            console.log("📜 Lịch sử chat cá nhân:", historyData);
            
            // Chuyển đổi format lịch sử thành format hiển thị
            const formattedHistory = historyData.map((item, idx) => ({
                event: "SEND_CHAT",
                data: {
                    type: "people",
                    from: item.name || item.user || item.from,
                    to: item.to || (item.name === myUser ? currentChat.name : myUser),
                    mes: item.mes
                },
                _historyId: `people-hist-${currentChat.name}-${idx}`
            }));
            
            // Đánh dấu đã xử lý và thêm lịch sử
            setMessages(prev => {
                // Đánh dấu historyResponse đã xử lý
                const updated = prev.map(m => 
                    m === historyResponse ? { ...m, _processed: true } : m
                );
                // Lọc bỏ lịch sử cũ của chat này
                const withoutOldHistory = updated.filter(m => 
                    !m._historyId?.startsWith(`people-hist-${currentChat.name}-`)
                );
                // Thêm lịch sử mới
                return [...formattedHistory.reverse(), ...withoutOldHistory];
            });
        }
    }, [messages, currentChat, myUser, setMessages]);

    // === ROOM CHAT ===
    // Lưu room đang chờ join (sau khi tạo hoặc join)
    const [pendingRoom, setPendingRoom] = useState(null);

    // Lắng nghe response CREATE_ROOM và JOIN_ROOM
    useEffect(() => {
        if (!pendingRoom) return;
        
        // Tìm response CREATE_ROOM thành công
        const createResponse = messages.find(msg => 
            msg.event === "CREATE_ROOM" && msg.status === "success" && !msg._roomProcessed
        );
        
        if (createResponse && pendingRoom.action === "create") {
            console.log("✅ Tạo room thành công, đang join...");
            // Đánh dấu đã xử lý
            setMessages(prev => prev.map(m => 
                m === createResponse ? { ...m, _roomProcessed: true } : m
            ));
            // Sau khi tạo room, cần JOIN vào room đó
            sendMessage("JOIN_ROOM", { name: pendingRoom.name });
            setPendingRoom({ ...pendingRoom, action: "join" });
            return;
        }
        
        // Tìm response JOIN_ROOM thành công
        const joinResponse = messages.find(msg => 
            msg.event === "JOIN_ROOM" && msg.status === "success" && !msg._roomProcessed
        );
        
        if (joinResponse && (pendingRoom.action === "join" || pendingRoom.action === "create")) {
            console.log("✅ Join room thành công:", pendingRoom.name);
            // Đánh dấu đã xử lý
            setMessages(prev => prev.map(m => 
                m === joinResponse ? { ...m, _roomProcessed: true } : m
            ));
            // Thêm room vào list
            setRoomList(prev => {
                if (prev.includes(pendingRoom.name)) return prev;
                return [...prev, pendingRoom.name];
            });
            // Set current room
            setCurrentRoom({ name: pendingRoom.name });
            setRoomMessages([]);
            // Load lịch sử
            sendMessage("GET_ROOM_CHAT_MES", { name: pendingRoom.name, page: 1 });
            setPendingRoom(null);
        }
        
        // Xử lý lỗi
        const errorResponse = messages.find(msg => 
            (msg.event === "CREATE_ROOM" || msg.event === "JOIN_ROOM") && 
            msg.status === "error" && !msg._roomProcessed
        );
        
        if (errorResponse) {
            console.error("❌ Lỗi room:", errorResponse.mes);
            alert(errorResponse.mes || "Lỗi khi tạo/join room");
            setMessages(prev => prev.map(m => 
                m === errorResponse ? { ...m, _roomProcessed: true } : m
            ));
            setPendingRoom(null);
        }
    }, [messages, pendingRoom, sendMessage, setMessages, setRoomList]);

    const handleCreateRoom = () => {
        if (!roomInput.trim()) return alert("Vui lòng nhập tên room!");
        const roomName = roomInput.trim();
        
        console.log("🏠 Đang tạo room:", roomName);
        setPendingRoom({ name: roomName, action: "create" });
        sendMessage("CREATE_ROOM", { name: roomName });
        setRoomInput("");
    };

    const handleJoinRoom = () => {
        if (!roomInput.trim()) return alert("Vui lòng nhập tên room!");
        const roomName = roomInput.trim();
        
        console.log("🚪 Đang join room:", roomName);
        setPendingRoom({ name: roomName, action: "join" });
        sendMessage("JOIN_ROOM", { name: roomName });
        setRoomInput("");
    };

    const handleSelectRoom = (roomName) => {
        setCurrentRoom({ name: roomName });
        setRoomMessages([]);
        setRoomHistoryPage(1);
        // Load lịch sử chat room
        sendMessage("GET_ROOM_CHAT_MES", { name: roomName, page: 1 });
    };

    const handleLoadMoreHistory = () => {
        if (!currentRoom) return;
        const nextPage = roomHistoryPage + 1;
        setRoomHistoryPage(nextPage);
        sendMessage("GET_ROOM_CHAT_MES", { name: currentRoom.name, page: nextPage });
    };

    const sendRoomChat = () => {
        if (!currentRoom) return alert("Chưa chọn room để chat!");
        if (!inputMes.trim()) return;

        const msgContent = inputMes.trim();
        console.log("📤 Đang gửi tin nhắn room:", currentRoom.name, msgContent);
        
        // Đúng format API: SEND_CHAT với type: "room"
        sendMessage("SEND_CHAT", {
            type: "room",
            to: currentRoom.name,
            mes: msgContent
        });

        // Thêm tin nhắn vào messages global để hiển thị ngay (optimistic update)
        const myMsg = {
            event: "SEND_CHAT",
            data: {
                type: "room",
                from: myUser,
                to: currentRoom.name,
                mes: msgContent
            },
            _local: true,
            _timestamp: Date.now()
        };
        setMessages(prev => [...prev, myMsg]);
        setInputMes("");
    };

    // Gửi tin nhắn dựa vào tab hiện tại
    const send = () => {
        if (activeTab === "people") {
            sendPeopleChat();
        } else {
            sendRoomChat();
        }
    };

    // Filter tin nhắn cá nhân
    const displayMessages = messages.filter(msg => {
        if (msg.event !== "SEND_CHAT" || !msg.data) return false;
        // Bỏ qua tin room (type: "room" từ local hoặc type: 1 từ server)
        if (msg.data.type === "room" || msg.data.type === 1) return false;
        
        // Server có thể gửi: from, user, name
        const fromUser = msg.data.from || msg.data.user || msg.data.name;
        const toUser = msg.data.to;
        
        if (!currentChat?.name) return false;
        
        // Tin nhắn đến từ người đang chat với mình
        const isIncoming = (fromUser === currentChat.name && toUser === myUser);
        // Tin nhắn mình gửi đến người đang chat
        const isOutgoing = (fromUser === myUser && toUser === currentChat.name);
        
        return isIncoming || isOutgoing;
    });
    
    // Debug: Log tất cả SEND_CHAT messages
    useEffect(() => {
        const chatMsgs = messages.filter(m => m.event === "SEND_CHAT");
        if (chatMsgs.length > 0) {
            console.log("💬 Tất cả tin nhắn SEND_CHAT:", chatMsgs);
        }
    }, [messages]);

    // Debug: Log roomList và userList
    useEffect(() => {
        console.log("🏠 Room List:", roomList);
        console.log("👥 User List:", userList);
    }, [roomList, userList]);

    // Render giao diện
    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
            {/* SIDEBAR */}
            <div style={{ width: '300px', borderRight: '1px solid #ddd', background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid #ddd', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#444' }}>💬 Chat App</h3>
                        <button 
                            onClick={logout}
                            style={{ 
                                padding: '6px 12px', 
                                cursor: 'pointer', 
                                border: 'none', 
                                borderRadius: '5px',
                                background: '#dc3545',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            🚪 Đăng xuất
                        </button>
                    </div>
                    <p style={{fontSize: '12px', color: 'green', margin: '0 0 10px 0'}}>
                        {isReady ? '🟢' : '🔴'} Bạn là: <strong>{myUser}</strong>
                        {!isReady && <span style={{color: 'orange', marginLeft: '5px'}}>(Đang kết nối lại...)</span>}
                    </p>
                    
                    {/* Tab chuyển đổi */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                        <button 
                            onClick={() => setActiveTab("people")}
                            style={{ 
                                flex: 1, padding: '8px', cursor: 'pointer', border: 'none', borderRadius: '5px',
                                background: activeTab === "people" ? '#007bff' : '#e9ecef',
                                color: activeTab === "people" ? '#fff' : '#333',
                                fontWeight: 'bold'
                            }}
                        >
                            👤 Cá nhân
                        </button>
                        <button 
                            onClick={() => setActiveTab("room")}
                            style={{ 
                                flex: 1, padding: '8px', cursor: 'pointer', border: 'none', borderRadius: '5px',
                                background: activeTab === "room" ? '#28a745' : '#e9ecef',
                                color: activeTab === "room" ? '#fff' : '#333',
                                fontWeight: 'bold'
                            }}
                        >
                            🏠 Room
                        </button>
                    </div>
                </div>

                {/* Content dựa vào Tab */}
                {activeTab === "people" ? (
                    // Tab Chat cá nhân
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '10px' }}>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <input
                                    placeholder="Nhập tên người cần chat..."
                                    value={searchName}
                                    onChange={e => setSearchName(e.target.value)}
                                    style={{ flex: 1, padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
                                />
                                <button onClick={handleManualChat} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '5px', border: 'none', background: '#007bff', color: '#fff' }}>Chat</button>
                            </div>
                        </div>
                        
                        <div style={{ padding: '10px 15px', fontWeight: 'bold', color: '#666', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Danh sách Online:</span>
                            <button onClick={() => sendMessage("GET_USER_LIST")} style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ddd', background: '#fff', fontSize: '12px' }}>🔄</button>
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, overflowY: 'auto' }}>
                            {userList && userList.map((u, idx) => {
                                const displayName = u.name || u.user || u.username;
                                return (
                                    <li
                                        key={idx}
                                        onClick={() => handleSelectUser(displayName)}
                                        style={{
                                            padding: '12px 15px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #eee',
                                            background: currentChat?.name === displayName ? '#e3f2fd' : 'transparent',
                                            fontWeight: currentChat?.name === displayName ? 'bold' : 'normal'
                                        }}
                                    >
                                        👤 {displayName}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ) : (
                    // Tab Room Chat
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '10px' }}>
                            <input
                                placeholder="Nhập tên room..."
                                value={roomInput}
                                onChange={e => setRoomInput(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ddd', marginBottom: '8px', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button 
                                    onClick={handleCreateRoom} 
                                    style={{ flex: 1, padding: '8px', cursor: 'pointer', borderRadius: '5px', border: 'none', background: '#28a745', color: '#fff', fontWeight: 'bold' }}
                                >
                                    ➕ Tạo Room
                                </button>
                                <button 
                                    onClick={handleJoinRoom} 
                                    style={{ flex: 1, padding: '8px', cursor: 'pointer', borderRadius: '5px', border: 'none', background: '#17a2b8', color: '#fff', fontWeight: 'bold' }}
                                >
                                    🚪 Tham gia
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '10px 15px', fontWeight: 'bold', color: '#666', borderBottom: '1px solid #eee' }}>
                            Room đã tham gia:
                        </div>

                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, overflowY: 'auto' }}>
                            {roomList && roomList.map((room, idx) => {
                                const roomName = typeof room === 'string' ? room : room.name;
                                return (
                                    <li
                                        key={idx}
                                        onClick={() => handleSelectRoom(roomName)}
                                        style={{
                                            padding: '12px 15px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #eee',
                                            background: currentRoom?.name === roomName ? '#d4edda' : 'transparent',
                                            fontWeight: currentRoom?.name === roomName ? 'bold' : 'normal'
                                        }}
                                    >
                                        🏠 {roomName}
                                    </li>
                                )
                            })}
                            {(!roomList || roomList.length === 0) && (
                                <li style={{ padding: '15px', color: '#999', textAlign: 'center', fontSize: '13px' }}>
                                    Chưa có room nào.<br/>Hãy tạo hoặc tham gia room!
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* CHAT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    {activeTab === "people" ? (
                        <span>Đang chat với: <strong style={{color: '#007bff', fontSize: '18px'}}>{currentChat ? `👤 ${currentChat.name}` : "---"}</strong></span>
                    ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Room: <strong style={{color: '#28a745', fontSize: '18px'}}>{currentRoom ? `🏠 ${currentRoom.name}` : "---"}</strong></span>
                            {currentRoom && (
                                <button 
                                    onClick={handleLoadMoreHistory}
                                    style={{ padding: '5px 10px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ddd', background: '#f8f9fa', fontSize: '12px' }}
                                >
                                    📜 Tải thêm lịch sử
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f0f2f5' }}>
                    {activeTab === "people" ? (
                        // Tin nhắn cá nhân
                        <>
                            {displayMessages.length === 0 && <div style={{textAlign: 'center', color: '#999', marginTop: '50px'}}>Chưa có tin nhắn nào</div>}
                            {displayMessages.map((msg, idx) => {
                                const fromUser = msg.data.from || msg.data.user;
                                const isMe = fromUser === myUser;
                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{
                                            background: isMe ? '#007bff' : '#fff',
                                            color: isMe ? '#fff' : '#333',
                                            padding: '10px 15px',
                                            borderRadius: '18px',
                                            maxWidth: '60%',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                            borderTopRightRadius: isMe ? '4px' : '18px',
                                            borderTopLeftRadius: isMe ? '18px' : '4px'
                                        }}>
                                            {msg.data.mes}
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                        // Tin nhắn room
                        <>
                            {roomMessages.length === 0 && <div style={{textAlign: 'center', color: '#999', marginTop: '50px'}}>Chưa có tin nhắn trong room</div>}
                            {roomMessages.map((msg, idx) => {
                                const fromUser = msg.data.from || msg.data.user || msg.data.name;
                                const isMe = fromUser === myUser;
                                return (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{
                                            background: isMe ? '#28a745' : '#fff',
                                            color: isMe ? '#fff' : '#333',
                                            padding: '10px 15px',
                                            borderRadius: '18px',
                                            maxWidth: '60%',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                            borderTopRightRadius: isMe ? '4px' : '18px',
                                            borderTopLeftRadius: isMe ? '18px' : '4px'
                                        }}>
                                            {!isMe && <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>👤 {fromUser}</div>}
                                            {msg.data.mes}
                                        </div>
                                    </div>
                                )
                            })}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '20px', background: '#fff', display: 'flex', borderTop: '1px solid #ddd' }}>
                    <input
                        style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                        value={inputMes}
                        onChange={e => setInputMes(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        placeholder={activeTab === "people" ? "Nhập tin nhắn..." : "Nhập tin nhắn vào room..."}
                        disabled={activeTab === "people" ? !currentChat : !currentRoom}
                    />
                    <button
                        onClick={send}
                        disabled={activeTab === "people" ? !currentChat : !currentRoom}
                        style={{ 
                            marginLeft: '10px', padding: '10px 20px', borderRadius: '20px', border: 'none', 
                            background: activeTab === "people" ? '#007bff' : '#28a745', 
                            color: 'white', cursor: 'pointer', 
                            opacity: (activeTab === "people" ? !currentChat : !currentRoom) ? 0.6 : 1 
                        }}
                    >
                        Gửi ➤
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;