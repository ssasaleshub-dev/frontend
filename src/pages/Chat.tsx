import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Hash,
  Search,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import chatService from '../services/api/chatService';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../types';

const CHANNELS = [
  { id: 'general', name: 'general', desc: 'Company announcements and team discussions' },
  { id: 'leads', name: 'leads', desc: 'Lead updates, follow-ups, and conversions' },
  { id: 'support', name: 'support', desc: 'Customer support inquiries and escalations' },
  { id: 'sales-deals', name: 'sales-deals', desc: 'Mattress sales closures and deal tracking' },
];

const PRESETS = [
  '🎉 New lead converted!',
  '📞 Following up with customer now',
  '🛏️ Queen size ortho in stock?',
  '✅ Deal closed and payment verified',
];

export default function Chat() {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState<string>('general');
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
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.login || 'User';

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

  const fetchMessages = useCallback(async (isSilent = false) => {
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
        setApiNotice('Backend /api/messages endpoint is not yet available on the active server. Running in preview mode.');
      } else {
        setApiNotice(`API Error: ${err.message}`);
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [activeChannel]);

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
        setApiNotice('Message saved locally (Backend /api/messages endpoint is not yet mounted on server).');
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

  const activeChannelMeta = CHANNELS.find((c) => c.id === activeChannel) || CHANNELS[0];

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {apiNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <span>{apiNotice}</span>
          </div>
          <button
            onClick={() => setApiNotice(null)}
            className="text-amber-600 hover:text-amber-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 ios-card overflow-hidden">
        {/* Left Channels Sidebar */}
        <div className="w-64 border-r border-black/[0.06] bg-[#f9f9fa] flex flex-col shrink-0">
          <div className="p-3.5 border-b border-black/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-[#007aff]" />
              <h2 className="font-semibold text-xs text-[#8e8e93] uppercase tracking-wider">
                Channels
              </h2>
            </div>
            <button
              onClick={() => fetchMessages(false)}
              title="Refresh messages"
              className="p-1 hover:bg-black/[0.05] rounded-full text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#007aff]' : ''} />
            </button>
          </div>

          <div className="p-2.5 space-y-1 flex-1 overflow-y-auto">
            {CHANNELS.map((ch) => {
              const isActive = activeChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left ${
                    isActive
                      ? 'bg-[#007aff] text-white font-semibold shadow-[0_2px_8px_rgba(0,122,255,0.3)]'
                      : 'text-[#3c3c43] hover:bg-black/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Hash size={14} className={isActive ? 'text-white' : 'text-[#8e8e93]'} />
                    <span className="truncate">{ch.name}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t border-black/[0.05] bg-white">
            <div className="flex items-center justify-between text-[11px] text-[#8e8e93]">
              <div className="flex items-center gap-1.5">
                <span>Auto-Refresh</span>
              </div>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full transition-all ${
                  autoRefresh ? 'bg-[#34c759] text-white shadow-xs' : 'bg-black/[0.06] text-[#8e8e93]'
                }`}
              >
                {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Chat Conversation Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Channel Header */}
          <div className="px-5 py-3 border-b border-black/[0.05] flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Hash size={16} className="text-[#007aff] shrink-0" />
                <h3 className="font-bold text-sm text-[#1c1c1e] truncate">
                  {activeChannelMeta.name}
                </h3>
              </div>
              <p className="text-[11px] text-[#8e8e93] truncate">
                {activeChannelMeta.desc}
              </p>
            </div>

            <div className="relative w-48 shrink-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93]" />
              <input
                type="text"
                placeholder="Search channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ios-input w-full pl-8 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f2f2f7]/35">
            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] gap-2">
                <RefreshCw size={20} className="animate-spin text-[#007aff]" />
                <span className="text-xs">Loading channel history...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#8e8e93] py-12">
                <div className="ios-squircle bg-[#007aff]/10 text-[#007aff] mb-3">
                  <MessageSquare size={20} />
                </div>
                <h4 className="text-sm font-semibold text-[#1c1c1e]">No messages in #{activeChannel}</h4>
                <p className="text-xs text-[#8e8e93] mt-1 max-w-sm text-center">
                  Start the conversation! Post an update, tag an order, or ask a question.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isMe = msg.userId === currentUserId || msg.userName === currentUserName;
                const author = msg.userName || (isMe ? currentUserName : `User #${msg.userId || '1'}`);
                const text = msg.content || msg.message || '';
                const timeStr = formatTimestamp(msg.createdAt || msg.timestamp);

                return (
                  <div
                    key={msg.id || `${msg.userId}-${msg.createdAt}`}
                    className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
                        isMe
                          ? 'bg-[#007aff] text-white shadow-xs'
                          : 'bg-[#e5e5ea] text-[#3c3c43]'
                      }`}
                    >
                      {author[0] || 'U'}
                    </div>

                    <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-[#3c3c43]">
                          {isMe ? 'You' : author}
                        </span>
                        {timeStr && (
                          <span className="text-[10px] text-[#8e8e93]">{timeStr}</span>
                        )}
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 text-[#8e8e93] hover:text-[#ff3b30] transition-opacity p-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed break-words ${
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

          {/* Quick Preset Chips */}
          <div className="px-4 py-2 bg-[#f9f9fa] border-t border-black/[0.05] flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-semibold text-[#8e8e93] uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-[#007aff]" /> Quick:
            </span>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setInputText(p);
                  inputRef.current?.focus();
                }}
                className="text-[11px] bg-white hover:bg-black/[0.03] border border-black/[0.06] text-[#1c1c1e] px-3 py-1 rounded-full whitespace-nowrap transition-colors shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-black/[0.05] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message #${activeChannelMeta.name}...`}
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
