import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { WebSocketContext } from './WebSocketContext';
import { useNavigate } from 'react-router-dom';

const Chat = () => {
  const { messages, userList, connectionState, api, appendLocalMessage } = useContext(WebSocketContext);
  const [mode, setMode] = useState('people'); // people | room
  const [currentChat, setCurrentChat] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState([]);
  const [inputMes, setInputMes] = useState('');
  const [checkUser, setCheckUser] = useState('');
  const [lastCheckOnline, setLastCheckOnline] = useState(null);
  const [lastCheckExist, setLastCheckExist] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessages, setHistoryMessages] = useState([]);
  const myUser = localStorage.getItem('chat_username');
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  // Re-login + load user list on mount
  useEffect(() => {
    if (!myUser) navigate('/');
    api.getUserList();
    const code = localStorage.getItem('re_login_code');
    if (code && myUser) api.reLogin(myUser, code);
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentChat, roomName, mode, historyMessages]);

  // Lắng nghe kết quả check online / exist và lịch sử
  useEffect(() => {
    const lastOnline = [...messages].reverse().find((m) => m.event === 'CHECK_USER_ONLINE');
    if (lastOnline) setLastCheckOnline(lastOnline);

    const lastExist = [...messages].reverse().find((m) => m.event === 'CHECK_USER_EXIST');
    if (lastExist) setLastCheckExist(lastExist);

    const lastHistory =
      [...messages].reverse().find((m) => m.event === 'GET_ROOM_CHAT_MES' || m.event === 'GET_PEOPLE_CHAT_MES');
    if (lastHistory) {
      // Server có thể trả data dạng mảng hoặc trong m.data.messages
      const dataArr = Array.isArray(lastHistory.data)
        ? lastHistory.data
        : Array.isArray(lastHistory.data?.messages)
        ? lastHistory.data.messages
        : [];
      setHistoryMessages(dataArr);
      setHistoryLoading(false);
    }

    // Cập nhật danh sách room đã tạo/join
    const lastRoomEvent = [...messages]
      .reverse()
      .find((m) => m.event === 'CREATE_ROOM' || m.event === 'JOIN_ROOM');
    const name = lastRoomEvent?.data?.name || lastRoomEvent?.data?.room || lastRoomEvent?.data;
    if (name && !rooms.includes(name)) {
      setRooms((prev) => [...prev, name]);
    }
  }, [messages, rooms]);

  const displayMessages = useMemo(() => {
    if (mode === 'people' && currentChat?.name) {
      return messages
        .filter(
          (msg) =>
            msg.event === 'SEND_CHAT' &&
            msg.data &&
            msg.data.type === 'people' &&
            ((msg.data.to === myUser && msg.data.from === currentChat.name) ||
              (msg.data.from === myUser && msg.data.to === currentChat.name))
        )
        .map((msg, idx) => ({ ...msg, _id: `p-${idx}` }));
    }

    if (mode === 'room' && roomName) {
      return messages
        .filter(
          (msg) =>
            msg.event === 'SEND_CHAT' &&
            msg.data &&
            msg.data.type === 'room' &&
            msg.data.to === roomName
        )
        .map((msg, idx) => ({ ...msg, _id: `r-${idx}` }));
    }

    return [];
  }, [messages, mode, currentChat, roomName, myUser]);

  const send = () => {
    if (!inputMes.trim()) return;
    if (connectionState !== 'open') {
      return alert('Chưa kết nối máy chủ, thử lại sau.');
    }

    if (mode === 'people') {
      if (!currentChat?.name) return alert('Chọn người để chat!');
      api.sendPeopleChat(currentChat.name, inputMes);
      appendLocalMessage({
        event: 'SEND_CHAT',
        data: { type: 'people', from: myUser, to: currentChat.name, mes: inputMes },
        status: 'local',
      });
    } else {
      if (!roomName.trim()) return alert('Nhập tên room và Join/Create trước khi gửi!');
      api.sendRoomChat(roomName.trim(), inputMes);
      appendLocalMessage({
        event: 'SEND_CHAT',
        data: { type: 'room', from: myUser, to: roomName.trim(), mes: inputMes },
        status: 'local',
      });
    }
    setInputMes('');
  };

  const handleGetHistory = () => {
    if (mode === 'people') {
      if (!currentChat?.name) return alert('Chọn người để lấy lịch sử!');
      setHistoryLoading(true);
      api.getPeopleMessages(currentChat.name, 1);
    } else {
      if (!roomName.trim()) return alert('Nhập tên room để lấy lịch sử!');
      setHistoryLoading(true);
      api.getRoomMessages(roomName.trim(), 1);
    }
  };

  const handleCreateRoom = () => {
    if (!roomName.trim()) return alert('Nhập tên room!');
    api.createRoom(roomName.trim());
    if (!rooms.includes(roomName.trim())) setRooms((prev) => [...prev, roomName.trim()]);
  };

  const handleJoinRoom = () => {
    if (!roomName.trim()) return alert('Nhập tên room!');
    api.joinRoom(roomName.trim());
    if (!rooms.includes(roomName.trim())) setRooms((prev) => [...prev, roomName.trim()]);
  };

  const handleCheckOnline = () => {
    if (!checkUser.trim()) return;
    api.checkUserOnline(checkUser.trim());
  };

  const handleCheckExist = () => {
    if (!checkUser.trim()) return;
    api.checkUserExist(checkUser.trim());
  };

  const renderCheckResult = (res, label) => {
    if (!res) return 'Chưa kiểm tra';
    const text = typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data);
    const successColor = res.status === 'success' ? 'green' : '#d9534f';
    return (
      <span style={{ color: successColor }}>
        {label}: {text}
      </span>
    );
  };

  const renderHistory = () => {
    if (historyLoading) return <div style={{ padding: '6px 0' }}>Đang tải lịch sử...</div>;
    if (!historyMessages.length) return <div style={{ padding: '6px 0', color: '#666' }}>Chưa có lịch sử.</div>;
    return (
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {historyMessages.map((item, idx) => {
          const from = item.from || item.user || item.sender || 'unknown';
          const to = item.to || item.target || '';
          const mes = item.mes || item.message || item.content || '';
          return (
            <div
              key={`h-${idx}`}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: '#f4f6fb',
                border: '1px solid #e5e5e5',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600 }}>{from + (to ? ` → ${to}` : '')}</div>
              <div>{mes}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* Sidebar users */}
      <div style={{ width: 260, borderRight: '1px solid #e5e5e5', padding: 12, background: '#fafafa' }}>
        <h3 style={{ margin: '4px 0 12px' }}>Online Users</h3>
        <div style={{ fontSize: 13, marginBottom: 8, color: connectionState === 'open' ? 'green' : '#d9534f' }}>
          Trạng thái: {connectionState === 'open' ? 'Đã kết nối' : 'Đang kết nối...'}
        </div>
        <button
          onClick={api.getUserList}
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: 10,
            border: '1px solid #ccc',
            borderRadius: 8,
            cursor: 'pointer',
            background: '#fff',
          }}
        >
          Refresh
        </button>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {userList &&
            userList.map((u, idx) => (
              <li
                key={idx}
                onClick={() => {
                  setMode('people');
                  setCurrentChat(u);
                }}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  background: currentChat?.name === u.name && mode === 'people' ? '#e6f0ff' : 'transparent',
                  borderRadius: 8,
                  marginBottom: 6,
                  border: '1px solid #f0f0f0',
                }}
              >
                {u.name || u.user || u.username || 'Không tên'}
              </li>
            ))}
        </ul>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e5e5',
            background: '#f5f7fb',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setMode('people')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d7de',
                background: mode === 'people' ? '#4c8dff' : '#fff',
                color: mode === 'people' ? '#fff' : '#000',
                cursor: 'pointer',
              }}
            >
              Chat cá nhân
            </button>
            <button
              onClick={() => setMode('room')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #d0d7de',
                background: mode === 'room' ? '#4c8dff' : '#fff',
                color: mode === 'room' ? '#fff' : '#000',
                cursor: 'pointer',
              }}
            >
              Chat room
            </button>
          </div>

          {mode === 'people' ? (
            <div>
              Chat với: <strong>{currentChat ? currentChat.name : 'Chưa chọn ai'}</strong>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Tên room"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
              />
              <button onClick={handleCreateRoom} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7de', cursor: 'pointer' }}>
                Create
              </button>
              <button onClick={handleJoinRoom} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7de', cursor: 'pointer' }}>
                Join
              </button>
              <div style={{ fontSize: 13, color: '#555' }}>
                Room hiện tại: <strong>{roomName || 'Chưa chọn'}</strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
            <input
              value={checkUser}
              onChange={(e) => setCheckUser(e.target.value)}
              placeholder="User cần kiểm tra"
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
            />
            <button onClick={handleCheckOnline} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7de', cursor: 'pointer' }}>
              Check Online
            </button>
            <button onClick={handleCheckExist} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d7de', cursor: 'pointer' }}>
              Check Exist
            </button>
          </div>
        </div>

        {/* Kết quả check */}
        <div style={{ padding: '8px 16px', fontSize: 13, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {renderCheckResult(lastCheckOnline, 'Online')}
          {renderCheckResult(lastCheckExist, 'Exist')}
        </div>

        {/* Danh sách room đã join/create */}
        <div style={{ padding: '0 16px 8px', fontSize: 13 }}>
          {rooms.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 600 }}>Rooms đã join/create:</div>
              {rooms.map((r) => (
                <span
                  key={r}
                  onClick={() => {
                    setRoomName(r);
                    setMode('room');
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: r === roomName && mode === 'room' ? '#e6f0ff' : '#f1f1f1',
                    border: '1px solid #d0d7de',
                    cursor: 'pointer',
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: '#777' }}>Chưa có room nào (Create/Join để lưu).</div>
          )}
        </div>

        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <button
              onClick={handleGetHistory}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #d0d7de',
                cursor: 'pointer',
                background: '#fff',
              }}
            >
              Lấy lịch sử (page 1)
            </button>
            <span style={{ fontSize: 12, color: '#555' }}>
              {mode === 'people'
                ? `Lịch sử chat với: ${currentChat?.name || '---'}`
                : `Lịch sử chat room: ${roomName || '---'}`}
            </span>
          </div>

          {/* Lịch sử */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Lịch sử:</div>
            {renderHistory()}
          </div>

          {/* Tin nhắn realtime */}
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tin nhắn mới:</div>
          {displayMessages.map((msg) => (
            <div
              key={msg._id}
              style={{
                textAlign: msg.data.from === myUser ? 'right' : 'left',
                margin: '6px 0',
              }}
            >
              <span
                style={{
                  background: msg.data.from === myUser ? '#4c8dff' : '#f1f1f1',
                  color: msg.data.from === myUser ? '#fff' : '#000',
                  padding: '9px 12px',
                  borderRadius: 16,
                  display: 'inline-block',
                  maxWidth: '70%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  fontSize: 14,
                }}
              >
                {msg.data.mes}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            gap: 10,
            background: '#fafafa',
          }}
        >
          <input
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 10,
              border: '1px solid #ccc',
              outline: 'none',
              fontSize: 14,
            }}
            value={inputMes}
            onChange={(e) => setInputMes(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={mode === 'people' ? 'Nhập tin nhắn đến người...' : 'Nhập tin nhắn trong room...'}
          />
          <button
            onClick={send}
            disabled={connectionState !== 'open'}
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: connectionState === 'open' ? '#4c8dff' : '#9fbfff',
              color: '#fff',
              fontWeight: 600,
              cursor: connectionState === 'open' ? 'pointer' : 'not-allowed',
              minWidth: 90,
            }}
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;