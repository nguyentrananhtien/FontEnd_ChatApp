import React, { useContext, useEffect, useState } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
    // Lấy thêm isAuthenticated
    const { sendMessage, messages, setMessages, userList, isAuthenticated } = useContext(WebSocketContext);

    const [currentChat, setCurrentChat] = useState(null);
    const [inputMes, setInputMes] = useState("");
    const [searchName, setSearchName] = useState("");

    const myUser = localStorage.getItem("chat_username");
    const navigate = useNavigate();

    // 🔥 LOGIC QUAN TRỌNG ĐÃ SỬA 🔥
    useEffect(() => {
        // 1. Chưa có user trong local -> Đá về Login
        if (!myUser) {
            navigate("/");
            return;
        }

        // 2. Chỉ khi nào đã Authenticated (Re-login xong) thì mới được lấy danh sách user
        if (isAuthenticated) {
            console.log("✅ Đã xác thực, đang tải danh sách user...");
            sendMessage("GET_USER_LIST");
        } else {
            console.log("⏳ Đang chờ xác thực từ server...");
        }

    }, [isAuthenticated, navigate, myUser]); // Theo dõi biến isAuthenticated

    const send = () => {
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
        setCurrentChat({ name: searchName });
        setSearchName("");
    };

    const displayMessages = messages.filter(msg => {
        if (msg.event !== "SEND_CHAT" || !msg.data) return false;
        const fromUser = msg.data.from || msg.data.user;
        const toUser = msg.data.to;
        const isIncoming = (fromUser === currentChat?.name && toUser === myUser);
        const isOutgoing = (fromUser === myUser && toUser === currentChat?.name);
        return isIncoming || isOutgoing;
    });

    // ... Phần giao diện giữ nguyên như cũ ...
    // ... (Copy phần return ở tin nhắn trước vào đây) ...
    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
            <div style={{ width: '280px', borderRight: '1px solid #ddd', background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #ddd', background: '#fff' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#444' }}>Chat App</h3>
                    <p style={{fontSize: '12px', color: 'green'}}>🟢 Bạn là: <strong>{myUser}</strong></p>

                    <div style={{ display: 'flex', gap: '5px' }}>
                        <input
                            placeholder="Nhập tên người cần chat..."
                            value={searchName}
                            onChange={e => setSearchName(e.target.value)}
                            style={{ flex: 1, padding: '5px' }}
                        />
                        <button onClick={handleManualChat} style={{ cursor: 'pointer' }}>Chat</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ padding: '10px', fontWeight: 'bold', color: '#666' }}>Danh sách Online:</div>
                    <button onClick={() => sendMessage("GET_USER_LIST")} style={{margin: '0 10px'}}>🔄 Refresh</button>

                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {userList && userList.map((u, idx) => {
                            const displayName = u.name || u.user || u.username;
                            return (
                                <li
                                    key={idx}
                                    onClick={() => setCurrentChat({ name: displayName })}
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
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                    Đang chat với: <strong style={{color: '#007bff', fontSize: '18px'}}>{currentChat ? currentChat.name : "---"}</strong>
                </div>

                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f0f2f5' }}>
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
                </div>

                <div style={{ padding: '20px', background: '#fff', display: 'flex', borderTop: '1px solid #ddd' }}>
                    <input
                        style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                        value={inputMes}
                        onChange={e => setInputMes(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        placeholder="Nhập tin nhắn..."
                        disabled={!currentChat}
                    />
                    <button
                        onClick={send}
                        disabled={!currentChat}
                        style={{ marginLeft: '10px', padding: '10px 20px', borderRadius: '20px', border: 'none', background: '#007bff', color: 'white', cursor: 'pointer', opacity: !currentChat ? 0.6 : 1 }}
                    >
                        Gửi ➤
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;