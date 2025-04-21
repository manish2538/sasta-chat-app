import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { config } from '../config';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Chat.css';

interface UserProfile {
  name: string;
  email: string;
  userId: string;
  role: string;
}

interface Message {
  senderId: string;
  senderName: string;
  content: string;
  type: 'TEXT' | 'EMOJI' | 'GIF';
}

const Chat: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifOffset, setGifOffset] = useState(0);
  const stompClient = useRef<Client | null>(null);
  const giphy = new GiphyFetch(config.giphyApiKey);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);

  // Add click outside handler for emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add click outside handler for GIF picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
        setShowGifPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const connect = async () => {
    if (!token.startsWith('Bearer ')) {
      alert("Please enter token with 'Bearer ' prefix.");
      return;
    }

    try {
      const res = await fetch(`${config.baseUrl}/v1/users/profile`, {
        headers: { 'Authorization': token }
      });

      if (!res.ok) throw new Error("Failed to fetch profile");

      const data = await res.json();
      setUserProfile(data);

      const socket = new SockJS(`${config.baseUrl}/chat`);
      stompClient.current = new Client({
        webSocketFactory: () => socket,
        connectHeaders: { Authorization: token },
        onConnect: (frame) => {
          console.log('Connected to WebSocket:', frame);
          setConnected(true);
          
          // Subscribe to the room
          stompClient.current?.subscribe(`/topic/room/${roomId}`, (msg) => {
            console.log('Received message:', msg);
            const body = JSON.parse(msg.body);
            setMessages(prev => [...prev, {
              senderId: body.senderId,
              senderName: body.senderName || "Anonymous",
              content: body.content,
              type: body.eventType
            }]);
          });

          // Send a test message to verify connection
          sendMessage("User joined the chat", "TEXT");
        },
        onWebSocketError: (err) => {
          console.error("WebSocket Error:", err);
          alert("WebSocket connection error. Please try again.");
        },
        onStompError: (frame) => {
          console.error("STOMP Error:", frame.headers['message'], frame.body);
          alert("STOMP protocol error. Please try again.");
        }
      });

      stompClient.current.activate();
    } catch (e) {
      console.error("Connection error:", e);
      alert("Error connecting: " + (e as Error).message);
    }
  };

  const disconnect = () => {
    if (stompClient.current) {
      stompClient.current.deactivate();
    }
    setConnected(false);
    setUserProfile(null);
  };

  const sendMessage = (content: string, type: 'TEXT' | 'EMOJI' | 'GIF' = 'TEXT') => {
    if (!stompClient.current?.connected) {
      alert("Not connected to WebSocket.");
      return;
    }

    if (!content) {
      alert("Message cannot be empty.");
      return;
    }

    const msg = {
      senderId: userProfile?.userId,
      senderName: userProfile?.name,
      roomExternalId: roomId,
      eventType: type,
      content
    };

    console.log('Sending message:', msg);

    stompClient.current.publish({
      destination: `/app/sendMessage/${roomId}`,
      body: JSON.stringify(msg),
      headers: { Authorization: token }
    });

    setMessage('');
  };

  const onEmojiSelect = (emoji: any) => {
    console.log('Selected emoji:', emoji);
    if (emoji && emoji.native) {
      const emojiContent = emoji.native;
      console.log('Sending emoji:', emojiContent);
      sendMessage(emojiContent, 'EMOJI');
      setShowEmojiPicker(false);
    }
  };

  const handleGifButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowGifPicker(!showGifPicker);
  };

  const onGifSelect = (gif: any) => {
    console.log('Selected GIF:', gif);
    if (gif && gif.images && gif.images.original && gif.images.original.url) {
      const gifUrl = gif.images.original.url;
      console.log('Sending GIF URL:', gifUrl);
      sendMessage(gifUrl, 'GIF');
      setShowGifPicker(false);
    }
  };

  const fetchGifs = (offset: number) => {
    console.log('Fetching GIFs, query:', gifSearchQuery, 'offset:', offset);
    if (gifSearchQuery) {
      return giphy.search(gifSearchQuery, { 
        offset, 
        limit: 10,
        rating: 'g',
        lang: 'en'
      });
    }
    return giphy.trending({ 
      offset, 
      limit: 10,
      rating: 'g'
    });
  };

  const handleGifSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    console.log('GIF search query:', query);
    setGifSearchQuery(query);
    setGifOffset(0);
  };

  return (
    <div className="chat-container">
      {!connected ? (
        <div className="connection-form">
          <div className="connection-header">
            <h2>Sprintmate Chat</h2>
            <p>Connect to start chatting</p>
          </div>
          
          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Enter Bearer Token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              className="form-input"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button
              className="connect-button"
              onClick={connect}
              disabled={!token || !roomId}
            >
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="chat-header">
            <div className="chat-header-info">
              <h3>Sprintmate Chat</h3>
              {userProfile && (
                <span className="user-status">Logged in as: {userProfile.name}</span>
              )}
              <button className="disconnect-button" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message ${msg.senderId === userProfile?.userId ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  {msg.type === 'GIF' ? (
                    <img src={msg.content} alt="GIF" className="message-gif" />
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
                <div className="message-time">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <button 
                className="emoji-button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <span role="img" aria-label="emoji">😊</span>
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(message)}
                placeholder="Type a message..."
                className="chat-input"
              />
              <button 
                className="gif-button"
                onClick={handleGifButtonClick}
              >
                <span role="img" aria-label="gif">🎬</span>
              </button>
              <button 
                className="send-button"
                onClick={() => sendMessage(message)}
              >
                <span role="img" aria-label="send">➤</span>
              </button>
            </div>

            {showEmojiPicker && (
              <div 
                ref={emojiPickerRef}
                className="emoji-picker-container"
              >
                <Picker
                  data={data}
                  onEmojiSelect={onEmojiSelect}
                  theme="light"
                  previewPosition="none"
                  searchPosition="none"
                  skinTonePosition="none"
                  perLine={8}
                  emojiSize={24}
                  emojiButtonSize={28}
                />
              </div>
            )}

            {showGifPicker && (
              <div 
                ref={gifPickerRef}
                className="gif-picker"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="gif-search">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    value={gifSearchQuery}
                    onChange={(e) => setGifSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="gif-grid">
                  <Grid
                    width={380}
                    columns={3}
                    fetchGifs={fetchGifs}
                    onGifClick={onGifSelect}
                    key={gifSearchQuery}
                    noLink={true}
                    hideAttribution={true}
                    className="giphy-grid"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Chat; 