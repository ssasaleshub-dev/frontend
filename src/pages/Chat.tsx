import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
  Users as UsersIcon,
  User as UserIcon,
} from 'lucide-react';
import chatService from '../services/api/chatService';
import axiosClient from '../services/api/axiosClient';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, User } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const [chatType, setChatType] = useState<'group' | 'p2p'>('group');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = user?.id || 1;
  const currentLogin = (user?.login || 'user').toLowerCase();
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.login || 'User';

  // Compute active channel:
  // - "general" for common group chat with all users
  // - "dm_userA_userB" (alphabetically sorted) for 1-on-1 P2P chat
  const activeChannel =
    chatType === 'group' || !selectedUser
      ? 'general'
      : `dm_${[currentLogin, (selectedUser.login || '').toLowerCase()].sort().join('_')}`;

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const parseMessageList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.content)) return res.content;
    if (Array.isArray(res?.messages)) return res.messages;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  };

  // Fetch staff users for P2P direct messages
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res: any = await axiosClient.get('/api/users');
      const list: User[] = Array.isArray(res) ? res : res?.content || [];
      const others = list.filter(
        (u) => (u.login || '').toLowerCase() !== currentLogin
      );
      setUsersList(others);
    } catch {
      try {
        const res2: any = await axiosClient.get('/api/admin/users', {
          params: { size: 50 },
        });
        const list2: User[] = Array.isArray(res2) ? res2 : res2?.content || [];
        const others2 = list2.filter(
          (u) => (u.login || '').toLowerCase() !== currentLogin
        );
        setUsersList(others2);
      } catch {
        // keep existing list
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [currentLogin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch messages for active channel
  const fetchMessages = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setLoading(true);
      try {
        const res = await chatService.getMessages(activeChannel);
        const data = parseMessageList(res);

        setMessages(data);
        setApiNotice(null);
        if (!isSilent) {
          setTimeout(() => scrollToBottom(false), 80);
        }
      } catch (err: any) {
        if (err.message?.includes('404')) {
          setApiNotice(
            'Backend /api/messages endpoint is not yet mounted. Running in offline preview mode.'
          );
        } else {
          setApiNotice(`API Notice: ${err.message}`);
        }
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [activeChannel]
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

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const tempId = Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: trimmed,
      channel: activeChannel,
      userId: currentUserId,
      userName: currentUserName,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const response = await chatService.sendMessage({
        content: trimmed,
        channel: activeChannel,
        userId: currentUserId,
        userName: currentUserName,
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredMessages = messages.filter((m) => {
    if (!searchQuery.trim()) return true;
    const text = (m.content || m.message || '').toLowerCase();
    const author = (m.userName || m.user?.login || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return text.includes(q) || author.includes(q);
  });

  const getTargetUserName = (target: User) => {
    if (target.firstName || target.lastName) {
      return `${target.firstName || ''} ${target.lastName || ''}`.trim();
    }
    return target.login;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] bg-white rounded-2xl border border-[rgba(60,60,67,0.1)] shadow-xs overflow-hidden">
      {apiNotice && (
        <div className="bg-[#fff9e6] border-b border-[#ffe699] px-4 py-2 flex items-center justify-between text-xs text-[#806000]">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-[#b38600]" />
            <span>{apiNotice}</span>
          </div>
          <button
            onClick={() => setApiNotice(null)}
            className="text-[#806000] hover:text-[#4d3a00] font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar: 1 Common Group Chat + P2P User Chat */}
        <div className="w-64 border-r border-[rgba(60,60,67,0.1)] bg-[#f9f9fa] flex flex-col shrink-0">
          {/* Header */}
          <div className="p-3.5 border-b border-[rgba(60,60,67,0.08)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#007aff]" />
              <h2 className="font-semibold text-xs text-[#1c1c1e]">
                Conversations
              </h2>
            </div>
            <button
              onClick={() => {
                fetchUsers();
                fetchMessages(false);
              }}
              title="Refresh conversation"
              className="p-1 hover:bg-black/[0.05] rounded-full text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
            >
              <RefreshCw
                size={13}
                className={loading || loadingUsers ? 'animate-spin text-[#007aff]' : ''}
              />
            </button>
          </div>

          <div className="p-2.5 space-y-4 flex-1 overflow-y-auto">
            {/* 1. Common Group Chat (All Users) */}
            <div>
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider">
                Group Chat
              </p>
              <button
                onClick={() => {
                  setChatType('group');
                  setSelectedUser(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                  chatType === 'group'
                    ? 'bg-[#007aff] text-white font-semibold shadow-[0_2px_8px_rgba(0,122,255,0.25)]'
                    : 'text-[#1c1c1e] hover:bg-black/[0.04]'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    chatType === 'group'
                      ? 'bg-white/20 text-white'
                      : 'bg-black/[0.06] text-[#3c3c43]'
                  }`}
                >
                  <UsersIcon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">All Team Chat</p>
                  <p
                    className={`text-[10px] truncate ${
                      chatType === 'group' ? 'text-white/80' : 'text-[#8e8e93]'
                    }`}
                  >
                    Common group chat
                  </p>
                </div>
              </button>
            </div>

            {/* 2. User Chat (P2P 1-on-1) */}
            <div>
              <div className="px-2.5 pb-1.5 flex items-center justify-between text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider">
                <span>Direct Messages (P2P)</span>
                <span>{usersList.length}</span>
              </div>
              <div className="space-y-1">
                {usersList.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-[#8e8e93]">
                    {loadingUsers ? 'Loading team members...' : 'No other users found'}
                  </p>
                ) : (
                  usersList.map((target) => {
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                          isSelected
                            ? 'bg-[#007aff] text-white font-semibold shadow-[0_2px_8px_rgba(0,122,255,0.25)]'
                            : 'text-[#1c1c1e] hover:bg-black/[0.04]'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 uppercase ${
                            isSelected
                              ? 'bg-white/25 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{name}</p>
                          <p
                            className={`text-[10px] truncate font-mono ${
                              isSelected ? 'text-white/80' : 'text-[#8e8e93]'
                            }`}
                          >
                            @{target.login}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Auto Refresh Footer */}
          <div className="p-3 border-t border-[rgba(60,60,67,0.08)] bg-white">
            <div className="flex items-center justify-between text-[11px] text-[#8e8e93]">
              <span>Auto-Refresh</span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all ${
                  autoRefresh
                    ? 'bg-[#34c759] text-white'
                    : 'bg-black/[0.06] text-[#8e8e93]'
                }`}
              >
                {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Conversation View */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Header */}
          <div className="px-5 py-3 border-b border-[rgba(60,60,67,0.08)] flex items-center justify-between gap-4">
            <div className="min-w-0 flex items-center gap-3">
              {chatType === 'group' ? (
                <div className="w-9 h-9 rounded-xl bg-[#007aff]/10 text-[#007aff] flex items-center justify-center shrink-0">
                  <UsersIcon size={18} />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                  {(selectedUser?.firstName?.[0] || selectedUser?.login?.[0] || 'U')}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#1c1c1e] truncate">
                  {chatType === 'group'
                    ? 'All Team Chat'
                    : getTargetUserName(selectedUser!)}
                </h3>
                <p className="text-[11px] text-[#8e8e93] truncate">
                  {chatType === 'group'
                    ? 'Common group conversation for all team members'
                    : `Direct message (P2P) • @${selectedUser?.login}`}
                </p>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative w-48 shrink-0">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93]"
              />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ios-input w-full pl-8 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f2f2f7]/35">
            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] gap-2">
                <RefreshCw size={20} className="animate-spin text-[#007aff]" />
                <span className="text-xs">Loading messages...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] py-12">
                <div className="w-10 h-10 rounded-2xl bg-black/[0.05] flex items-center justify-center mb-2 text-[#8e8e93]">
                  {chatType === 'group' ? (
                    <UsersIcon size={20} />
                  ) : (
                    <UserIcon size={20} />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-[#1c1c1e]">
                  {chatType === 'group'
                    ? 'No messages in All Team Chat'
                    : `No messages with @${selectedUser?.login}`}
                </h4>
                <p className="text-xs text-[#8e8e93] mt-1 max-w-sm text-center">
                  {chatType === 'group'
                    ? 'Say hello to the entire team! Share updates and coordinate.'
                    : `Start a direct conversation with @${selectedUser?.login}.`}
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe =
                  msg.userId === currentUserId ||
                  (msg.userLogin && msg.userLogin.toLowerCase() === currentLogin) ||
                  msg.userName === currentUserName;
                const author =
                  msg.userName ||
                  msg.userLogin ||
                  (isMe ? 'You' : `User #${msg.userId || '1'}`);
                const text = msg.content || msg.message || '';
                const timeStr = formatTimestamp(msg.createdAt || msg.timestamp);

                return (
                  <div
                    key={msg.id || `${msg.userId}-${msg.createdAt}`}
                    className={`flex items-start gap-2.5 group ${
                      isMe ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0 ${
                        isMe
                          ? 'bg-[#007aff] text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {author[0] || 'U'}
                    </div>

                    <div
                      className={`max-w-[70%] flex flex-col ${
                        isMe ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-semibold text-[#3c3c43]">
                          {isMe ? 'You' : author}
                        </span>
                        {timeStr && (
                          <span className="text-[10px] text-[#8e8e93]">
                            {timeStr}
                          </span>
                        )}
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 text-[#8e8e93] hover:text-[#ff3b30] transition-opacity p-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>

                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-2xs ${
                          isMe
                            ? 'bg-[#007aff] text-white rounded-br-xs'
                            : 'bg-[#e5e5ea] text-[#000000] rounded-bl-xs'
                        }`}
                      >
                        {text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-[rgba(60,60,67,0.08)] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                chatType === 'group'
                  ? 'Message all staff in team chat...'
                  : `Message @${selectedUser?.login || 'user'}...`
              }
              className="ios-input flex-1 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="ios-btn-primary text-xs"
            >
              <Send size={13} className={sending ? 'animate-pulse' : ''} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
