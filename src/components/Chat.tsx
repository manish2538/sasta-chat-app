import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { config } from '../config';
import 'bootstrap/dist/css/bootstrap.min.css';

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
  type: 'TEXT' | 'EMOJI' | 'GIF' | 'STICKER';
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
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const stompClient = useRef<Client | null>(null);
  const giphy = new GiphyFetch(config.giphyApiKey);

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

  const sendMessage = (content: string, type: 'TEXT' | 'EMOJI' | 'GIF' | 'STICKER' = 'TEXT') => {
    if (!stompClient.current?.connected) {
      alert("Not connected to WebSocket.");
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
    sendMessage(emoji.native, 'EMOJI');
    setShowEmojiPicker(false);
  };

  const onGifSelect = (gif: any) => {
    sendMessage(gif.images.original.url, 'GIF');
    setShowGifPicker(false);
  };

  const onStickerSelect = (sticker: any) => {
    sendMessage(sticker.url, 'STICKER');
    setShowStickerPicker(false);
  };

  return (
    <div className="container mt-4">
      <h2>Sprintmate Chat</h2>
      
      {userProfile && (
        <div className="alert alert-info">
          Logged in as: {userProfile.name} ({userProfile.email})
        </div>
      )}
      
      <div className="form-group">
        <input
          type="text"
          className="form-control"
          placeholder="Enter Bearer Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      <div className="form-group mt-2">
        <input
          type="text"
          className="form-control"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
      </div>

      <div className="form-inline mb-3">
        <button
          className="btn btn-success me-2"
          onClick={connect}
          disabled={connected || !token || !roomId}
        >
          Connect
        </button>
        <button
          className="btn btn-danger"
          onClick={disconnect}
          disabled={!connected}
        >
          Disconnect
        </button>
      </div>

      {connected && (
        <>
          <div className="chat-messages mb-3" style={{ height: '400px', overflowY: 'auto', border: '1px solid #ddd', padding: '10px' }}>
            {messages.map((msg, index) => (
              <div key={index} className="message mb-2">
                <strong>{msg.senderName}:</strong>
                {msg.type === 'GIF' ? (
                  <img src={msg.content} alt="GIF" style={{ maxWidth: '200px' }} />
                ) : msg.type === 'STICKER' ? (
                  <img src={msg.content} alt="Sticker" style={{ maxWidth: '100px' }} />
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            ))}
          </div>

          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Enter your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(message)}
            />
            <button
              className="btn btn-outline-secondary"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😊
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setShowGifPicker(!showGifPicker)}
            >
              GIF
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => setShowStickerPicker(!showStickerPicker)}
            >
              Stickers
            </button>
            <button
              className="btn btn-primary"
              onClick={() => sendMessage(message)}
            >
              Send
            </button>
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker">
              <Picker data={data} onEmojiSelect={onEmojiSelect} />
            </div>
          )}

          {showGifPicker && (
            <div className="gif-picker" style={{ height: '300px', overflowY: 'auto' }}>
              <Grid
                width={400}
                columns={3}
                fetchGifs={(offset) => giphy.trending({ offset, limit: 10 })}
                onGifClick={onGifSelect}
              />
            </div>
          )}

          {showStickerPicker && (
            <div className="sticker-picker">
              {config.defaultStickers.map((sticker) => (
                <img
                  key={sticker.id}
                  src={sticker.url}
                  alt={`Sticker ${sticker.id}`}
                  onClick={() => onStickerSelect(sticker)}
                  style={{ width: '50px', cursor: 'pointer', margin: '5px' }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Chat; 