import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import chatService from '../services/api/chatService';
import fileService from '../services/api/fileService';
import authService from '../services/api/authService';
import axiosClient from '../services/api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { formatIndianTime } from '../utils/dateTimeUtils';
import teamChatWebSocket from '../services/websocket/teamChatWebSocket';
import notificationBannerService from '../services/banner/notificationBannerService';
import playIPhoneNotificationSound from '../utils/appleSound';
import { Capacitor } from '@capacitor/core';
import type { ChatMessage, User } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Active chat: 'all' for team group chat, or numeric userId / login for P2P
  const [cur, setCur] = useState<string>('all');
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Lightbox Media Viewer State
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    type: 'IMAGE' | 'VIDEO' | 'FILE';
    fileName?: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = user?.id || authService.getUser()?.id || 1;
  const currentLogin = (user?.login || authService.getUser()?.login || '').toLowerCase();
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : authService.getUser()?.firstName
    ? `${authService.getUser()?.firstName} ${authService.getUser()?.lastName || ''}`.trim()
    : user?.login || authService.getUser()?.login || 'Administrator';

  const scrollToBottom = useCallback((smooth = false) => {
    const container = messagesContainerRef.current;
    if (container) {
      if (smooth) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  // Fetch real staff users for 1-on-1 direct messages
  const fetchUsers = useCallback(async () => {
    const myLogin = (user?.login || authService.getUser()?.login || '').toLowerCase();
    try {
      const res: any = await axiosClient.get('/api/users');
      const list: User[] = Array.isArray(res) ? res : res?.content || [];
      const others = list.filter((u) => {
        const l = (u.login || '').toLowerCase();
        return l && l !== myLogin;
      });
      if (others.length > 0) {
        setUsersList(others);
        return;
      }
    } catch {}

    try {
      const res2: any = await axiosClient.get('/api/admin/users', { params: { size: 50 } });
      const list2: User[] = Array.isArray(res2) ? res2 : res2?.content || [];
      const others2 = list2.filter((u) => {
        const l = (u.login || '').toLowerCase();
        return l && l !== myLogin;
      });
      if (others2.length > 0) {
        setUsersList(others2);
        return;
      }
    } catch {}

    // Fallback known colleagues if backend endpoint is unavailable
    setUsersList([
      { id: 101, login: 'ranjani', firstName: 'ranjani' } as User,
      { id: 102, login: 'parvathim', firstName: 'parvathim' } as User,
      { id: 103, login: 'testuser', firstName: 'testuser' } as User,
      { id: 104, login: 'kavin', firstName: 'kavin' } as User,
    ]);
  }, [user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Selected user for P2P
  const selectedUser = useMemo(() => {
    if (cur === 'all') return null;
    return usersList.find((u) => String(u.id) === cur || u.login === cur) || null;
  }, [cur, usersList]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(
    async (isSilent = false) => {
      try {
        let res: any;
        if (cur === 'all') {
          res = await chatService.getMessages('general');
        } else if (selectedUser?.id) {
          res = await chatService.getP2pMessages(selectedUser.id);
        } else {
          setMessages([]);
          return;
        }

        const data: ChatMessage[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.content)
          ? res.content
          : Array.isArray(res?.messages)
          ? res.messages
          : [];

        setMessages((prev) => {
          if (isSilent) {
            if (prev.length === data.length && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
              return prev;
            }
            const pending = prev.filter((m) => typeof m.id === 'number' && m.id < 0);
            return [...data, ...pending];
          }
          return data;
        });

        if (!isSilent) {
          setTimeout(() => scrollToBottom(false), 50);
          setTimeout(() => scrollToBottom(false), 200);
        }
      } catch (err: any) {
        if (!isSilent) {
          console.warn('Failed to load chat messages:', err);
        }
      }
    },
    [cur, selectedUser, scrollToBottom]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-Time Team Chat WebSocket Integration
  useEffect(() => {
    if (user) {
      teamChatWebSocket.connect(user);
    }

    const unsubscribe = teamChatWebSocket.onMessage((incomingMsg) => {
      const isGroup = cur === 'all' && (!incomingMsg.recipientId || incomingMsg.channel === 'general');
      const isP2p =
        cur !== 'all' &&
        selectedUser &&
        ((Number(incomingMsg.userId) === Number(selectedUser.id) && Number(incomingMsg.recipientId) === Number(currentUserId)) ||
          (Number(incomingMsg.userId) === Number(currentUserId) && Number(incomingMsg.recipientId) === Number(selectedUser.id)));

      const isOwnMessage =
        (user?.id && incomingMsg.userId && Number(user.id) === Number(incomingMsg.userId)) ||
        (user?.login && incomingMsg.userLogin && user.login.toLowerCase() === incomingMsg.userLogin.toLowerCase());

      if (isGroup || isP2p) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;
          const optIdx = prev.findIndex(
            (m) =>
              typeof m.id === 'number' &&
              m.id < 0 &&
              m.content === incomingMsg.content &&
              Number(m.userId) === Number(incomingMsg.userId)
          );
          if (optIdx !== -1) {
            const updated = [...prev];
            updated[optIdx] = incomingMsg;
            return updated;
          }
          return [...prev, incomingMsg];
        });
        setTimeout(() => scrollToBottom(true), 60);

        if (!isOwnMessage && typeof document !== 'undefined' && document.hidden) {
          playIPhoneNotificationSound();
        }
      } else if (!isOwnMessage) {
        playIPhoneNotificationSound();
        if (!Capacitor.isNativePlatform()) {
          notificationBannerService.show({
            title: `New Message from ${incomingMsg.userName || 'Staff'}`,
            description: incomingMsg.content || 'Sent an attachment in Team Chat',
            type: 'CHAT',
            timestamp: 'now',
            url: '/chat',
          });
        }
      }
    });

    return () => unsubscribe();
  }, [cur, selectedUser, currentUserId, user, scrollToBottom]);

  // File Select & Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
  };

  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if ((!trimmed && !pendingFile) || sending || uploadingFile) return;

    setSending(true);
    let uploadedMediaUrl: string | undefined;
    let uploadedMediaType: string | undefined;
    let uploadedFileName: string | undefined;
    let uploadedFileSize: number | undefined;

    if (pendingFile) {
      setUploadingFile(true);
      try {
        const uploadRes = await fileService.uploadFile(pendingFile, 'chat');
        if (uploadRes?.url) {
          uploadedMediaUrl = uploadRes.url;
          uploadedMediaType = uploadRes.mediaType || (pendingFile.type.startsWith('image/') ? 'IMAGE' : 'FILE');
          uploadedFileName = uploadRes.fileName || pendingFile.name;
          uploadedFileSize = uploadRes.fileSize || pendingFile.size;
        }
      } catch (err: any) {
        showAlert({ title: 'Upload Failed', message: err?.message || 'File upload error' });
        setSending(false);
        setUploadingFile(false);
        return;
      } finally {
        setUploadingFile(false);
      }
    }

    const isP2p = cur !== 'all' && selectedUser;
    const recipientId = isP2p && selectedUser?.id ? Number(selectedUser.id) : undefined;
    const channel = isP2p ? 'p2p' : 'general';

    const tempId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: trimmed,
      channel,
      recipientId,
      recipientLogin: isP2p ? selectedUser.login : undefined,
      recipientName: isP2p ? (selectedUser.firstName || selectedUser.login) : undefined,
      isRead: false,
      userId: Number(currentUserId),
      userName: currentUserName,
      userLogin: currentLogin,
      userImageUrl: user?.imageUrl,
      mediaUrl: uploadedMediaUrl,
      mediaType: uploadedMediaType,
      fileName: uploadedFileName,
      fileSize: uploadedFileSize,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setTimeout(() => scrollToBottom(true), 50);

    teamChatWebSocket.sendMessage({
      content: trimmed,
      channel,
      recipientId,
      userId: Number(currentUserId),
      userName: currentUserName,
      mediaUrl: uploadedMediaUrl,
      mediaType: uploadedMediaType,
      fileName: uploadedFileName,
      fileSize: uploadedFileSize,
    });

    try {
      const response = await chatService.sendMessage({
        content: trimmed,
        channel,
        recipientId,
        userId: Number(currentUserId),
        userName: currentUserName,
        mediaUrl: uploadedMediaUrl,
        mediaType: uploadedMediaType,
        fileName: uploadedFileName,
        fileSize: uploadedFileSize,
      });

      if (response && response.id) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? response : m)));
      }
    } catch {
      // Retain optimistic message in offline mode
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isImageMedia = (msg: ChatMessage) => {
    if (msg.mediaType === 'IMAGE') return true;
    if (!msg.mediaUrl) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(msg.mediaUrl);
  };

  const handleOpenMedia = (msg: ChatMessage) => {
    if (!msg.mediaUrl) return;
    setLightboxMedia({
      url: msg.mediaUrl,
      type: isImageMedia(msg) ? 'IMAGE' : 'FILE',
      fileName: msg.fileName,
    });
  };

  const handleDownloadMedia = async (url: string, fileName?: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Filtered direct message staff
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return usersList;
    const q = searchQuery.toLowerCase();
    return usersList.filter((u) => {
      const name = (u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.login).toLowerCase();
      const login = (u.login || '').toLowerCase();
      return name.includes(q) || login.includes(q);
    });
  }, [usersList, searchQuery]);

  const showGroup = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return 'all team chat'.includes(q) || 'groups'.includes(q);
  }, [searchQuery]);

  // Current active conversation details
  const activeHeaderName = cur === 'all' ? 'All Team Chat' : selectedUser?.firstName || selectedUser?.login || 'Chat';
  const activeHeaderSub = cur === 'all' ? `${usersList.length + 1} team members` : `@${selectedUser?.login || ''}`;

  return (
    <>
      <div className="crm-t" id="crmT">
        <div className={`app${isMobileOpen ? ' open' : ''}`} id="app">
          {/* Left Sidebar */}
          <aside className="side">
            <h2>Messages</h2>
            <div className="sr">
              <input
                id="q"
                type="search"
                placeholder="Search people or groups"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="gl" id="gl">
              {/* Groups Section */}
              {showGroup && (
                <>
                  <div className="sec">Groups</div>
                  <button
                    type="button"
                    className={`cv${cur === 'all' ? ' on' : ''}`}
                    onClick={() => {
                      setCur('all');
                      setIsMobileOpen(true);
                    }}
                  >
                    <div className="av g">
                      <svg viewBox="0 0 24 24">
                        <circle cx="9" cy="8" r="3.5" />
                        <path d="M2.5 20a6.5 6.5 0 0113 0M16 5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />
                      </svg>
                    </div>
                    <div className="ct">
                      <div className="r1">
                        <b>All Team Chat</b>
                        <span>Group</span>
                      </div>
                      <div className="r2">
                        <span className="pv">Common group chat for all team members</span>
                      </div>
                    </div>
                  </button>
                </>
              )}

              {/* Direct Messages Section */}
              {filteredStaff.length > 0 && (
                <>
                  <div className="sec">
                    <span>Direct messages</span>
                    <span>{filteredStaff.length}</span>
                  </div>
                  {filteredStaff.map((p) => {
                    const isSelected = cur === String(p.id) || cur === p.login;
                    const initial = (p.firstName || p.login).charAt(0).toUpperCase();

                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`cv${isSelected ? ' on' : ''}`}
                        onClick={() => {
                          setCur(String(p.id));
                          setIsMobileOpen(true);
                        }}
                      >
                        <div className="av">{initial}</div>
                        <div className="ct">
                          <div className="r1">
                            <b>{p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : p.login}</b>
                            <span>@{p.login}</span>
                          </div>
                          <div className="r2">
                            <span className="pv">Tap to message</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {!showGroup && filteredStaff.length === 0 && (
                <div className="em">No results</div>
              )}
            </div>
          </aside>

          {/* Right Main Chat Area */}
          <section className="main">
            {/* Header */}
            <div className="mh">
              <button
                type="button"
                className="back"
                id="bk"
                aria-label="Back"
                onClick={() => setIsMobileOpen(false)}
              >
                ‹
              </button>
              <div id="mhav">
                {cur === 'all' ? (
                  <div className="av g">
                    <svg viewBox="0 0 24 24">
                      <circle cx="9" cy="8" r="3.5" />
                      <path d="M2.5 20a6.5 6.5 0 0113 0M16 5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />
                    </svg>
                  </div>
                ) : (
                  <div className="av">{activeHeaderName.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div>
                <b id="mn">{activeHeaderName}</b>
                <small id="ms2">{activeHeaderSub}</small>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="ms" id="ms" ref={messagesContainerRef}>
              {messages.length === 0 ? (
                <div className="em">
                  <div className="ic">
                    <svg viewBox="0 0 24 24">
                      <circle cx="9" cy="8" r="3.5" />
                      <path d="M2.5 20a6.5 6.5 0 0113 0M16 5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6" />
                    </svg>
                  </div>
                  <b>No messages yet</b>
                  <span>
                    Send a message to start communicating with the{' '}
                    {cur === 'all' ? 'team.' : 'conversation.'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="day">
                    <span>Today</span>
                  </div>
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const next = messages[i + 1];
                    const me =
                      (user?.id && Number(m.userId) === Number(user.id)) ||
                      (user?.login && m.userLogin && user.login.toLowerCase() === m.userLogin.toLowerCase());
                    const isFirst = !prev || prev.userId !== m.userId;
                    const isLast = !next || next.userId !== m.userId;

                    return (
                      <div
                        key={m.id || i}
                        className={`m${me ? ' me' : ''}${isFirst ? ' first' : ''}`}
                      >
                        {isFirst && !me && cur === 'all' && (
                          <div className="nm">{m.userName || m.userLogin}</div>
                        )}
                        <div className="bb">
                          {m.mediaUrl && isImageMedia(m) && (
                            <img
                              src={m.mediaUrl}
                              alt={m.fileName || 'Attachment'}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '240px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'block',
                                marginBottom: m.content ? '6px' : 0,
                              }}
                              onClick={() => handleOpenMedia(m)}
                            />
                          )}
                          {m.mediaUrl && !isImageMedia(m) && (
                            <div
                              className="fl"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleDownloadMedia(m.mediaUrl!, m.fileName)}
                            >
                              📎 Attachment: {m.fileName || 'File'}
                            </div>
                          )}
                          {m.content && <div>{m.content}</div>}
                        </div>
                        {isLast && (
                          <div className="tm">
                            {m.createdAt ? formatIndianTime(m.createdAt) : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Pending Attachment preview bar */}
            {pendingFile && (
              <div
                style={{
                  padding: '6px 16px',
                  background: 'var(--blue-soft)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12.5px',
                  color: 'var(--blue)',
                }}
              >
                <span>📎 Ready to send: {pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{ border: 0, background: 'none', fontWeight: '700', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Message Composer */}
            <div className="cp">
              <button
                type="button"
                className="ib"
                id="at"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                id="file"
                hidden
                onChange={handleFileSelect}
              />
              <textarea
                ref={textareaRef}
                id="tx"
                rows={1}
                placeholder="Type a message"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                className="ib s"
                id="sd"
                aria-label="Send"
                disabled={(!inputText.trim() && !pendingFile) || sending || uploadingFile}
                onClick={handleSendMessage}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox Media Viewer Modal */}
      {lightboxMedia && (
        <div
          onClick={() => setLightboxMedia(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderBottom: '1px solid #e3e6ea',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '13px' }}>
                {lightboxMedia.fileName || 'Attachment Preview'}
              </span>
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                style={{ border: 0, background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', textAlign: 'center' }}>
              {lightboxMedia.type === 'IMAGE' ? (
                <img
                  src={lightboxMedia.url}
                  alt={lightboxMedia.fileName || 'Preview'}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ padding: '30px' }}>
                  <p>Attachment: {lightboxMedia.fileName}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadMedia(lightboxMedia.url, lightboxMedia.fileName)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--blue)',
                      color: '#fff',
                      border: 0,
                      borderRadius: '4px',
                      fontWeight: 600,
                      marginTop: '12px',
                    }}
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
