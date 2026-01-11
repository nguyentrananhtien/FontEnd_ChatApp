import React, { createContext, useRef, useState, useEffect, useCallback } from 'react';

export const WebSocketContext = createContext(null);

const WS_URL = 'wss://chat.longapp.site/chat/chat';

export const WebSocketProvider = ({ children }) => {
  const [connectionState, setConnectionState] = useState('connecting'); // 'connecting' | 'open' | 'closed'
  const [messages, setMessages] = useState([]);
  const [userList, setUserList] = useState([]);
  const socket = useRef(null);

  useEffect(() => {
    socket.current = new WebSocket(WS_URL);

    socket.current.onopen = () => {
      console.log('✅ Đã kết nối tới Server');
      setConnectionState('open');
    };

    socket.current.onclose = (e) => {
      console.log('❌ Mất kết nối', e.code, e.reason, e.wasClean);
      setConnectionState('closed');
    };

    socket.current.onerror = (err) => {
      console.error('⚠️ WS error:', err);
    };

    socket.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log('📩 Nhận tin:', response);

        if (response.event === 'GET_USER_LIST' && Array.isArray(response.data)) {
          setUserList(response.data);
        }
        setMessages((prev) => [...prev, response]);
      } catch (e) {
        console.error('Lỗi đọc tin nhắn:', e);
      }
    };

    return () => socket.current && socket.current.close();
  }, []);

  const sendMessage = useCallback((eventName, dataPayload = {}) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      const payload = {
        action: 'onchat',
        data: { event: eventName, data: dataPayload },
      };
      socket.current.send(JSON.stringify(payload));
    } else {
      console.warn('Chưa kết nối tới server, không thể gửi:', eventName);
    }
  }, []);

  // Thêm local message vào state (dùng để hiển thị tin nhắn đã gửi ngay lập tức)
  const appendLocalMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // API object chứa các hàm gửi sự kiện WebSocket
  const api = {
    login: (user, pass) => sendMessage('LOGIN', { user, pass }),
    register: (user, pass) => sendMessage('REGISTER', { user, pass }),
    reLogin: (user, code) => sendMessage('RE_LOGIN', { user, code }),
    getUserList: () => sendMessage('GET_USER_LIST'),
    sendPeopleChat: (to, mes) => sendMessage('SEND_CHAT', { type: 'people', to, mes }),
    sendRoomChat: (to, mes) => sendMessage('SEND_CHAT', { type: 'room', to, mes }),
    createRoom: (name) => sendMessage('CREATE_ROOM', { name }),
    joinRoom: (name) => sendMessage('JOIN_ROOM', { name }),
    getPeopleMessages: (name, page) => sendMessage('GET_PEOPLE_CHAT_MES', { name, page }),
    getRoomMessages: (name, page) => sendMessage('GET_ROOM_CHAT_MES', { name, page }),
    checkUserOnline: (user) => sendMessage('CHECK_USER_ONLINE', { user }),
    checkUserExist: (user) => sendMessage('CHECK_USER_EXIST', { user }),
    logout: () => sendMessage('LOGOUT'),
  };

  return (
    <WebSocketContext.Provider value={{ 
      sendMessage, 
      messages, 
      connectionState, 
      userList, 
      api,
      appendLocalMessage 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};