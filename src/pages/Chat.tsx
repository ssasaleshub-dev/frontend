import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowUp,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  Users as UsersIcon,
  User as UserIcon,
  FileText,
  X,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';
import chatService from '../services/api/chatService';
import fileService from '../services/api/fileService';
import authService from '../services/api/authService';
import axiosClient from '../services/api/axiosClient';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, User } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const [chatType, setChatType] = useState<'group' | 'p2p'>('group');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // File upload state for attachments
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = user?.id || authService.getUser()?.id || 1;
  const currentLogin = (user?.login || authService.getUser()?.login || '').toLowerCase();
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : authService.getUser()?.firstName
    ? `${authService.getUser()?.firstName} ${authService.getUser()?.lastName || ''}`.trim()
    : user?.login || authService.getUser()?.login || 'User';

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const parseMessageList = (res: any): ChatMessage[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.content)) return res.content;
    if (Array.isArray(res?.messages)) return res.messages;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  // Fetch real staff users from database for P2P direct messages (never static)
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const myLogin = (user?.login || authService.getUser()?.login || '').toLowerCase();
    try {
      const res: any = await axiosClient.get('/api/users');
      const list: User[] = Array.isArray(res) ? res : res?.content || [];
      const others = list.filter((u) => {
        const l = (u.login || '').toLowerCase();
        return l && l !== myLogin;
      });
      setUsersList(others);
    } catch {
      try {
        const res2: any = await axiosClient.get('/api/admin/users', {
          params: { size: 50 },
        });
        const list2: User[] = Array.isArray(res2) ? res2 : res2?.content || [];
        const others2 = list2.filter((u) => {
          const l = (u.login || '').toLowerCase();
          return l && l !== myLogin;
        });
        setUsersList(others2);
      } catch {
        setUsersList([]);
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch messages for active conversation (General group or P2P direct messages)
  const fetchMessages = useCallback(
    async (isSilent = false) => {
      if (chatType === 'p2p' && !selectedUser) {
        setMessages([]);
        setLoading(false);
        return;
      }

      if (!isSilent) setLoading(true);
      try {
        let res: any;
        if (chatType === 'p2p' && selectedUser?.id) {
          res = await chatService.getP2pMessages(selectedUser.id);
        } else {
          res = await chatService.getMessages('general');
        }
        const data = parseMessageList(res);

        setMessages(data);
        setApiNotice(null);
        if (!isSilent) {
          setTimeout(() => scrollToBottom(false), 80);
        }
      } catch (err: any) {
        if (err.message?.includes('404')) {
          setApiNotice(
            'Backend messages endpoint is not yet mounted. Running in offline preview mode.'
          );
        } else {
          setApiNotice(`API Notice: ${err.message}`);
        }
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [chatType, selectedUser]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMessages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const preview = URL.createObjectURL(file);
      setFilePreviewUrl(preview);
    } else {
      setFilePreviewUrl(null);
    }
  };

  const clearPendingFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setPendingFile(null);
    setFilePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && !pendingFile) || sending || uploadingFile) return;
    if (chatType === 'p2p' && !selectedUser) return;

    setSending(true);
    let uploadedMediaUrl: string | undefined;
    let uploadedMediaType: string | undefined;
    let uploadedFileName: string | undefined;
    let uploadedFileSize: number | undefined;

    // Upload attachment to Cloudflare R2 if selected
    if (pendingFile) {
      setUploadingFile(true);
      try {
        const uploadRes = await fileService.uploadFile(pendingFile, 'chat');
        if (uploadRes?.url) {
          uploadedMediaUrl = uploadRes.url;
          uploadedMediaType = uploadRes.mediaType || (pendingFile.type.startsWith('video/') ? 'VIDEO' : 'IMAGE');
          uploadedFileName = uploadRes.fileName || pendingFile.name;
          uploadedFileSize = uploadRes.fileSize || pendingFile.size;
        }
      } catch (err: any) {
        alert(`Failed to upload media to R2: ${err?.message || 'Upload error'}`);
        setSending(false);
        setUploadingFile(false);
        return;
      } finally {
        setUploadingFile(false);
      }
    }

    const isP2p = chatType === 'p2p' && selectedUser;
    const recipientId = isP2p && selectedUser.id ? Number(selectedUser.id) : undefined;
    const channel = isP2p ? 'p2p' : 'general';

    const tempId = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: trimmed,
      channel,
      recipientId,
      recipientLogin: isP2p ? selectedUser.login : undefined,
      recipientName: isP2p ? getTargetUserName(selectedUser) : undefined,
      isRead: false,
      userId: currentUserId,
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
    clearPendingFile();
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const response = await chatService.sendMessage({
        content: trimmed,
        channel,
        recipientId,
        userId: currentUserId,
        userName: currentUserName,
        mediaUrl: uploadedMediaUrl,
        mediaType: uploadedMediaType,
        fileName: uploadedFileName,
        fileSize: uploadedFileSize,
      });

      if (response && response.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? response : m))
        );
      }
      setApiNotice(null);
    } catch (err: any) {
      if (err.message?.includes('404')) {
        setApiNotice('Message saved locally (Backend endpoint not mounted).');
      } else {
        setApiNotice(`Failed to send message: ${err.message}`);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (id: number | string) => {
    if (!window.confirm('Delete this message?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await chatService.deleteMessage(id);
    } catch (err: any) {
      setApiNotice(`Could not delete message on server: ${err.message}`);
    }
  };

  const formatTimestamp = (val?: string) => {
    if (!val) return '';
    const date = new Date(val);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const text = (m.content || m.message || '').toLowerCase();
    const author = (m.userName || m.userLogin || '').toLowerCase();
    const file = (m.fileName || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return text.includes(q) || author.includes(q) || file.includes(q);
  });

  const getTargetUserName = (target: User) => {
    if (target.firstName || target.lastName) {
      return `${target.firstName || ''} ${target.lastName || ''}`.trim();
    }
    return target.login;
  };

  // Real database staff users for 1-on-1 P2P, strictly excluding current user
  const directUsers = useMemo(() => {
    return usersList.filter((u) => {
      const l = (u.login || '').toLowerCase();
      return l && l !== currentLogin;
    });
  }, [usersList, currentLogin]);

  const isImageMedia = (msg: ChatMessage) => {
    if (msg.mediaType === 'IMAGE') return true;
    if (!msg.mediaUrl) return false;
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(msg.mediaUrl);
  };

  const isVideoMedia = (msg: ChatMessage) => {
    if (msg.mediaType === 'VIDEO') return true;
    if (!msg.mediaUrl) return false;
    return /\.(mp4|mov|webm|ogg)$/i.test(msg.mediaUrl);
  };

  // Center-aligned iOS conversation date divider
  const renderDateDivider = (currStr?: string, prevStr?: string) => {
    if (!currStr) return null;
    const curr = new Date(currStr);
    if (isNaN(curr.getTime())) return null;

    if (prevStr) {
      const prev = new Date(prevStr);
      if (!isNaN(prev.getTime())) {
        const diffMs = curr.getTime() - prev.getTime();
        if (diffMs < 20 * 60 * 1000 && curr.toDateString() === prev.toDateString()) {
          return null;
        }
      }
    }

    const now = new Date();
    const isToday = curr.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = curr.toDateString() === yesterday.toDateString();

    const timeStr = curr.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let label = '';
    if (isToday) {
      label = `Today ${timeStr}`;
    } else if (isYesterday) {
      label = `Yesterday ${timeStr}`;
    } else {
      label = `${curr.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${timeStr}`;
    }

    return (
      <div className="flex justify-center my-3 select-none">
        <span className="text-[11px] font-semibold text-[#8e8e93] tracking-tight">
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] bg-white rounded-2xl border border-[rgba(60,60,67,0.12)] shadow-sm overflow-hidden select-none">
      {apiNotice && (
        <div className="bg-[#fff9e6] border-b border-[#ffe699] px-4 py-2 flex items-center justify-between text-xs text-[#806000]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-[#b38600]" />
            <span>{apiNotice}</span>
          </div>
          <button
            onClick={() => setApiNotice(null)}
            className="text-[#806000] hover:text-[#4d3a00] font-bold ml-4 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: iOS Messages Style */}
        <div className="w-72 sm:w-80 border-r border-[rgba(60,60,67,0.12)] bg-[#f6f6f8] flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-[rgba(60,60,67,0.08)] flex items-center justify-between">
            <h1 className="text-[20px] font-bold text-[#000000] tracking-tight">
              Messages
            </h1>
            <button
              onClick={() => {
                fetchUsers();
                fetchMessages(false);
              }}
              title="Refresh messages"
              className="w-7 h-7 rounded-full bg-black/[0.04] hover:bg-black/[0.08] active:scale-95 text-[#636366] hover:text-[#000000] flex items-center justify-center transition-all cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={loading || loadingUsers ? 'animate-spin text-[#007aff]' : ''}
              />
            </button>
          </div>

          {/* Search Bar & Segmented Switch */}
          <div className="px-3 pt-2.5 pb-2 space-y-2 border-b border-[rgba(60,60,67,0.08)]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#e3e3e8] rounded-xl pl-8 pr-3 py-1.5 text-[13px] text-[#1c1c1e] border-none outline-none focus:ring-1 focus:ring-[#007aff]"
                aria-label="Search conversations"
              />
            </div>

            {/* Apple Segmented Control */}
            <div className="ios-segmented w-full flex">
              <button
                type="button"
                onClick={() => {
                  setChatType('group');
                  setSelectedUser(null);
                }}
                className={`ios-segmented-btn flex-1 flex items-center justify-center gap-1.5 ${
                  chatType === 'group' ? 'active' : ''
                }`}
              >
                <UsersIcon size={13} />
                <span>All Team</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChatType('p2p');
                  if (!selectedUser && directUsers.length > 0) {
                    setSelectedUser(directUsers[0]);
                  }
                }}
                className={`ios-segmented-btn flex-1 flex items-center justify-center gap-1.5 ${
                  chatType === 'p2p' ? 'active' : ''
                }`}
              >
                <UserIcon size={13} />
                <span>Direct ({directUsers.length})</span>
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[rgba(60,60,67,0.06)]">
            {chatType === 'group' ? (
              <button
                onClick={() => {
                  setChatType('group');
                  setSelectedUser(null);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors bg-white/70 hover:bg-white"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#007aff] to-[#5ac8fa] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UsersIcon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[14px] text-[#000000] truncate">
                      All Team Chat
                    </p>
                    <span className="text-[11px] text-[#8e8e93]">Group</span>
                  </div>
                  <p className="text-[12px] text-[#8e8e93] truncate mt-0.5">
                    Common group chat for all team members
                  </p>
                </div>
              </button>
            ) : directUsers.length === 0 ? (
              <div className="p-8 text-center text-[#8e8e93] text-xs">
                {loadingUsers ? 'Loading team members...' : 'No other users found'}
              </div>
            ) : (
              directUsers.map((target) => {
                const isSelected =
                  chatType === 'p2p' && selectedUser?.login === target.login;
                const name = getTargetUserName(target);
                const initial = (target.firstName?.[0] || target.login[0] || 'U').toUpperCase();

                return (
                  <button
                    key={target.login || target.id}
                    onClick={() => {
                      setChatType('p2p');
                      setSelectedUser(target);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-[#007aff] text-white'
                        : 'hover:bg-black/[0.03] text-[#1c1c1e]'
                    }`}
                  >
                    {target.imageUrl ? (
                      <img
                        src={target.imageUrl}
                        alt={name}
                        className={`w-11 h-11 rounded-full object-cover shrink-0 border ${
                          isSelected ? 'border-white/30' : 'border-black/10'
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shrink-0 uppercase shadow-2xs ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={`font-semibold text-[13px] truncate ${
                            isSelected ? 'text-white' : 'text-[#000000]'
                          }`}
                        >
                          {name}
                        </p>
                        <span
                          className={`text-[11px] font-mono ${
                            isSelected ? 'text-white/80' : 'text-[#8e8e93]'
                          }`}
                        >
                          @{target.login}
                        </span>
                      </div>
                      <p
                        className={`text-[12px] truncate mt-0.5 ${
                          isSelected ? 'text-white/90' : 'text-[#8e8e93]'
                        }`}
                      >
                        {isSelected ? 'Direct conversation active' : 'Tap to message'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Auto Refresh Footer */}
          <div className="p-3 border-t border-[rgba(60,60,67,0.08)] bg-white/70 flex items-center justify-between text-[11px] text-[#8e8e93]">
            <span>Auto-Refresh</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                autoRefresh
                  ? 'bg-[#34c759] text-white'
                  : 'bg-black/[0.06] text-[#8e8e93]'
              }`}
            >
              {autoRefresh ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Right Conversation View: Authentic Apple iMessage Layout */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* iOS Top Bar Header (Centered Contact Name & iMessage tag) */}
          <div className="h-14 px-6 border-b border-[rgba(60,60,67,0.12)] bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1.5">
                {chatType === 'group' ? (
                  <div className="w-5 h-5 rounded-full bg-[#007aff]/15 text-[#007aff] flex items-center justify-center shrink-0">
                    <UsersIcon size={12} />
                  </div>
                ) : selectedUser?.imageUrl ? (
                  <img
                    src={selectedUser.imageUrl}
                    alt={selectedUser.login}
                    className="w-5 h-5 rounded-full object-cover border border-black/10 shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0 uppercase">
                    {selectedUser?.firstName?.[0] || selectedUser?.login?.[0] || 'U'}
                  </div>
                )}
                <h2 className="font-semibold text-[13px] text-[#000000] tracking-tight truncate max-w-xs">
                  {chatType === 'group'
                    ? 'All Team Chat'
                    : selectedUser
                    ? getTargetUserName(selectedUser)
                    : 'Private Messages'}
                </h2>
              </div>
              <p className="text-[11px] text-[#8e8e93] font-normal leading-none mt-0.5">
                {chatType === 'group'
                  ? 'Team conversation'
                  : selectedUser
                  ? 'iMessage'
                  : 'Select a conversation'}
              </p>
            </div>

            <div className="w-7 flex justify-end">
              <button
                onClick={() => fetchMessages(false)}
                title="Refresh thread"
                className="text-[#007aff] hover:opacity-75 transition-opacity cursor-pointer p-1"
              >
                <Info size={16} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-[#ffffff] select-text">
            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] gap-2 select-none">
                <RefreshCw size={20} className="animate-spin text-[#007aff]" />
                <span className="text-xs">Loading iMessage...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] py-12 select-none">
                <div className="w-12 h-12 rounded-full bg-[#f2f2f7] flex items-center justify-center mb-2 text-[#8e8e93]">
                  {chatType === 'group' ? (
                    <UsersIcon size={22} />
                  ) : (
                    <UserIcon size={22} />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-[#1c1c1e]">
                  {chatType === 'group'
                    ? 'No messages yet'
                    : selectedUser
                    ? `iMessage with @${selectedUser.login}`
                    : 'Select a conversation'}
                </h4>
                <p className="text-xs text-[#8e8e93] mt-1 max-w-xs text-center">
                  {chatType === 'group'
                    ? 'Send a message to start communicating with the team.'
                    : selectedUser
                    ? `Say hello to @${selectedUser.login} with private 1-on-1 messaging.`
                    : 'Choose a team member from the list to start chatting.'}
                </p>
              </div>
            ) : (
              filteredMessages.map((msg, index) => {
                const prevMsg = index > 0 ? filteredMessages[index - 1] : undefined;
                const dateDivider = renderDateDivider(
                  msg.createdAt || msg.timestamp,
                  prevMsg?.createdAt || prevMsg?.timestamp
                );

                const isMe =
                  (msg.userId != null && String(msg.userId) === String(currentUserId)) ||
                  (msg.userLogin && msg.userLogin.toLowerCase() === currentLogin) ||
                  msg.userName === currentUserName;
                const author =
                  msg.userName ||
                  msg.userLogin ||
                  (isMe ? 'You' : `User #${msg.userId || '1'}`);
                const text = msg.content || msg.message || '';
                const isImg = isImageMedia(msg);
                const isVid = isVideoMedia(msg);

                return (
                  <React.Fragment key={msg.id || `${msg.userId}-${msg.createdAt}-${index}`}>
                    {dateDivider}

                    <div
                      className={`flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      } group my-1`}
                    >
                      {/* Inbound sender label for group chats */}
                      {!isMe && chatType === 'group' && (
                        <span className="text-[11px] font-medium text-[#8e8e93] ml-3 mb-0.5 select-none">
                          {author}
                        </span>
                      )}

                      {/* Pure Media: Photo or Video without text (Exact Apple iMessage styling: borderless, flush, rounded bubble) */}
                      {(isImg || isVid) && !text ? (
                        <div
                          className={`max-w-[75%] sm:max-w-[70%] overflow-hidden rounded-[18px] ${
                            isMe ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
                          } shadow-xs select-none`}
                        >
                          {isImg && (
                            <a
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block hover:opacity-95 transition-opacity"
                              title="Click to view full photo"
                            >
                              <img
                                src={msg.mediaUrl}
                                alt={msg.fileName || 'Attached photo'}
                                className="max-w-full max-h-80 object-cover block"
                              />
                            </a>
                          )}
                          {isVid && (
                            <div className="bg-black">
                              <video
                                src={msg.mediaUrl}
                                controls
                                className="max-w-full max-h-80 block"
                              />
                            </div>
                          )}
                        </div>
                      ) : (isImg || isVid) && text ? (
                        /* Media WITH caption: Media is flush to top and sides with zero padding, caption below */
                        <div
                          className={`max-w-[75%] sm:max-w-[70%] overflow-hidden rounded-[18px] shadow-2xs select-text ${
                            isMe ? 'ios-message-sent rounded-br-[4px]' : 'ios-message-received rounded-bl-[4px]'
                          }`}
                        >
                          {isImg && (
                            <a
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block hover:opacity-95 transition-opacity"
                              title="Click to view full photo"
                            >
                              <img
                                src={msg.mediaUrl}
                                alt={msg.fileName || 'Attached photo'}
                                className="w-full max-h-80 object-cover block"
                              />
                            </a>
                          )}
                          {isVid && (
                            <div className="bg-black">
                              <video
                                src={msg.mediaUrl}
                                controls
                                className="w-full max-h-80 block"
                              />
                            </div>
                          )}
                          <div className="px-3.5 py-2 text-[14px] leading-relaxed">
                            <p className="whitespace-pre-wrap break-words font-normal">{text}</p>
                          </div>
                        </div>
                      ) : (
                        /* Text or Document Bubble */
                        <div
                          className={`px-3.5 py-2 text-[14px] leading-relaxed max-w-[75%] sm:max-w-[70%] shadow-2xs space-y-2 select-text ${
                            isMe ? 'ios-message-sent' : 'ios-message-received'
                          }`}
                        >
                          {/* Media Attachment: Document */}
                          {msg.mediaUrl && !isImg && !isVid && (
                            <a
                              href={msg.mediaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
                                isMe
                                  ? 'bg-white/15 text-white hover:bg-white/25'
                                  : 'bg-black/5 text-[#000000] hover:bg-black/10'
                              }`}
                            >
                              <FileText size={16} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-[12px]">{msg.fileName || 'Document'}</p>
                                {msg.fileSize && (
                                  <p className="text-[10px] opacity-75">{formatFileSize(msg.fileSize)}</p>
                                )}
                              </div>
                              <ExternalLink size={12} className="shrink-0 opacity-70" />
                            </a>
                          )}

                          {/* Message Text Content */}
                          {text && (
                            <p className="whitespace-pre-wrap break-words font-normal">
                              {text}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Beneath Outgoing Bubble: Signature Apple Read / Delivered Status */}
                      {isMe && (
                        <div className="flex items-center gap-1 mt-0.5 mr-1 text-[11px] text-[#8e8e93] font-normal select-none">
                          {msg.isRead ? (
                            <span>Read {formatTimestamp(msg.createdAt || msg.timestamp)}</span>
                          ) : (
                            <span>Delivered</span>
                          )}

                          <button
                            onClick={() => handleDeleteMessage(msg.id!)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 text-[#8e8e93] hover:text-[#ff3b30] transition-opacity ml-1.5 p-0.5 cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Authentic Apple iOS iMessage Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-[#f6f6f6] border-t border-[rgba(60,60,67,0.12)] flex items-end gap-2.5"
          >
            {/* Hidden native file picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Apple Circular Plus Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || sending}
              title="Attach photo, video or document"
              className="w-8 h-8 rounded-full bg-[#e9e9eb] hover:bg-[#dcdce0] active:scale-95 text-[#636366] hover:text-[#000000] flex items-center justify-center transition-all shrink-0 mb-0.5 shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.4} />
            </button>

            {/* iOS Capsule Input Pill */}
            <div className="flex-1 ios-capsule-input px-3.5 py-1.5 flex flex-col justify-center min-h-[38px] transition-all">
              {/* Attachment Sticker / Pill INSIDE the Capsule */}
              {pendingFile && (
                <div className="mb-2 pt-1 select-none">
                  {filePreviewUrl ? (
                    <div className="relative inline-block w-16 h-16 rounded-xl overflow-hidden border border-black/10 shadow-xs">
                      <img
                        src={filePreviewUrl}
                        alt="Attachment"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearPendingFile}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                        title="Remove attachment"
                      >
                        <X size={11} strokeWidth={2.8} />
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f2f2f7] rounded-xl border border-black/5 relative max-w-sm">
                      <FileText size={16} className="text-[#007aff] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-[#1c1c1e] truncate">{pendingFile.name}</p>
                        <p className="text-[10px] text-[#8e8e93]">{formatFileSize(pendingFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearPendingFile}
                        className="w-4 h-4 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center shrink-0 ml-1.5 cursor-pointer"
                        title="Remove file"
                      >
                        <X size={9} strokeWidth={2.8} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Text Input Row + Authentic iOS Upward Arrow Send Button */}
              <div className="flex items-center gap-2 w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={chatType === 'p2p' && !selectedUser}
                  className="flex-1 bg-transparent border-none outline-none text-[14px] text-[#000000] py-0.5"
                  aria-label="Message text"
                />

                <button
                  type="submit"
                  disabled={
                    (!inputText.trim() && !pendingFile) ||
                    sending ||
                    uploadingFile ||
                    (chatType === 'p2p' && !selectedUser)
                  }
                  className="ios-send-btn shrink-0"
                  title="Send"
                >
                  {uploadingFile || sending ? (
                    <Loader2 size={14} className="animate-spin text-white" />
                  ) : (
                    <ArrowUp size={16} strokeWidth={2.8} />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
