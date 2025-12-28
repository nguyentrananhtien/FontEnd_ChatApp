import React, { useContext, useEffect, useState } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
    const { sendMessage, messages, userList } = useContext(WebSocketContext);
    const [currentChat, setCurrentChat] = useState(null); // Người đang chat cùng
    const [inputMes, setInputMes] = useState("");
    const myUser = localStorage.getItem("chat_username");
    const navigate = useNavigate();

    useEffect(() => {
        if (!myUser) navigate("/"); // Chưa đăng nhập thì đá về Login

        // Lấy danh sách user online
        sendMessage("GET_USER_LIST");

        // Lấy lại tin nhắn cũ nếu server hỗ trợ Re-login (tuỳ chọn)
        const code = localStorage.getItem("re_login_code");
        if(code) sendMessage("RE_LOGIN", { user: myUser, code });

    }, []);

    const send = () => {
        if (!currentChat) return alert("Chọn người để chat!");

        // Gửi tin nhắn
        sendMessage("SEND_CHAT", {
            type: "people",
            to: currentChat.name,
            mes: inputMes
        });
        setInputMes("");
    };

    // Lọc tin nhắn hiển thị: Chỉ lấy tin nhắn LIÊN QUAN đến người đang chat
    const displayMessages = messages.filter(msg =>
        msg.event === "SEND_CHAT" &&
        msg.data &&
        (
            (msg.data.to === myUser && msg.data.from === currentChat?.name) || // Người ta gửi mình
            (msg.data.from === myUser && msg.data.to === currentChat?.name)    // Mình gửi người ta (nếu server có trả lại)
        )
    );
    // Lưu ý: API này hơi đặc biệt, thường khi mình gửi đi server sẽ không echo lại ngay,
    // ta có thể phải tự push tin nhắn của mình vào list hiển thị để UX mượt hơn.
    // Nhưng tạm thời ta cứ hiển thị những gì server trả về.

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Cột trái: Danh sách User */}
            <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px' }}>
                <h3>Online Users</h3>
                <button onClick={() => sendMessage("GET_USER_LIST")}>Refresh</button>
                <ul>
                    {userList && userList.map((u, idx) => (
                        <li
                            key={idx}
                            onClick={() => setCurrentChat(u)}
                            style={{
                                padding: '10px',
                                cursor: 'pointer',
                                background: currentChat?.name === u.name ? '#ddd' : 'transparent'
                            }}
                        >
                            {u.name || u.user || u.username || "Không tên"}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Cột phải: Khung Chat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f5f5f5' }}>
                    Chat với: <strong>{currentChat ? currentChat.name : "Chưa chọn ai"}</strong>
                </div>

                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                    {displayMessages.map((msg, idx) => (
                        <div key={idx} style={{
                            textAlign: msg.data.from === myUser ? 'right' : 'left',
                            margin: '5px 0'
                        }}>
                            <span style={{
                                background: msg.data.from === myUser ? '#007bff' : '#eee',
                                color: msg.data.from === myUser ? '#fff' : '#000',
                                padding: '8px 12px',
                                borderRadius: '15px',
                                display: 'inline-block'
                            }}>
                                {msg.data.mes}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #ccc', display: 'flex' }}>
                    <input
                        style={{ flex: 1, padding: '10px' }}
                        value={inputMes}
                        onChange={e => setInputMes(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        placeholder="Nhập tin nhắn..."
                    />
                    <button onClick={send} style={{ marginLeft: '10px', padding: '10px 20px' }}>Gửi</button>
                </div>
            </div>
        </div>
    );
};

export default Chat;