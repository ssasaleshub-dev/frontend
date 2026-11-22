import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowUp,
  ArrowDown,
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
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Download,
} from 'lucide-react';
import chatService from '../services/api/chatService';
import fileService from '../services/api/fileService';
import authService from '../services/api/authService';
import axiosClient from '../services/api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { formatIndianTime, formatIndianDate } from '../utils/dateTimeUtils';
import teamChatWebSocket from '../services/websocket/teamChatWebSocket';
import notificationBannerService from '../services/banner/notificationBannerService';
import playIPhoneNotificationSound from '../utils/appleSound';
import pushNotificationService from '../services/pushNotificationService';
import { Capacitor } from '@capacitor/core';
import type { ChatMessage, User } from '../types';

export default function Chat() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [chatType, setChatType] = useState<'group' | 'p2p'>('group');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  // Mobile responsive view: 'list' (conversations sidebar) vs 'chat' (active conversation view)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [listSearchQuery, setListSearchQuery] = useState<string>('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'unread' | 'groups'>('all');
  const [apiNotice, setApiNotice] = useState<string | null>(null);

  // File upload state for attachments
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-app media lightbox viewer state (Never opens separate tab, never exposes raw public URL)
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    type: 'IMAGE' | 'VIDEO' | 'FILE';
    fileName?: string;
    senderName?: string;
    timestamp?: string;
  } | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);

  const handleOpenMedia = (msg: ChatMessage) => {
    if (!msg.mediaUrl) return;
    const isImg = isImageMedia(msg);
    const isVid = isVideoMedia(msg);
    setLightboxZoom(1);
    setLightboxMedia({
      url: msg.mediaUrl,
      type: isImg ? 'IMAGE' : isVid ? 'VIDEO' : 'FILE',
      fileName: msg.fileName,
      senderName: msg.userName || msg.userLogin,
      timestamp: msg.createdAt ? formatIndianTime(msg.createdAt) : undefined,
    });
  };

  const handleCloseLightbox = () => {
    setLightboxMedia(null);
    setLightboxZoom(1);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxMedia) {
        handleCloseLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxMedia]);

  const PAGE_SIZE = 25;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [isNearBottom, setIsNearBottom] = useState<boolean>(true);
  const isInitialLoadRef = useRef<boolean>(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = user?.id || authService.getUser()?.id || 1;
  const currentLogin = (user?.login || authService.getUser()?.login || '').toLowerCase();
  const currentUserName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : authService.getUser()?.firstName
    ? `${authService.getUser()?.firstName} ${authService.getUser()?.lastName || ''}`.trim()
    : user?.login || authService.getUser()?.login || 'User';

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

  const handleImageLoad = useCallback(() => {
    if (isInitialLoadRef.current || isNearBottom) {
      scrollToBottom(false);
    }
  }, [isNearBottom, scrollToBottom]);

  // Reset pagination window whenever switching between group chat and P2P user
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    isInitialLoadRef.current = true;
  }, [chatType, selectedUser?.id]);

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

        setMessages((prev) => {
          if (isSilent) {
            // If message list hasn't changed, retain previous reference to avoid unnecessary DOM re-renders
            if (
              prev.length === data.length &&
              prev[prev.length - 1]?.id === data[data.length - 1]?.id
            ) {
              return prev;
            }
            // Retain any pending optimistic messages that haven't been confirmed yet
            const pending = prev.filter(
              (m) => typeof m.id === 'number' && m.id < 0
            );
            return [...data, ...pending];
          }
          return data;
        });

        setApiNotice(null);
        if (!isSilent) {
          scrollToBottom(false);
          setTimeout(() => scrollToBottom(false), 50);
          setTimeout(() => scrollToBottom(false), 150);
          setTimeout(() => {
            scrollToBottom(false);
            isInitialLoadRef.current = false;
          }, 350);
        }
      } catch (err: any) {
        if (!isSilent) {
          if (err.message?.includes('404')) {
            setApiNotice(
              'Backend messages endpoint is not yet mounted. Running in offline preview mode.'
            );
          } else {
            setApiNotice(`API Notice: ${err.message}`);
          }
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

  // Smart sync on tab focus or visibility change (like WhatsApp Web & Instagram Direct)
  useEffect(() => {
    const handleSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchMessages(true);
      }
    };

    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [fetchMessages]);

  // Gentle fallback sync ONLY when WebSocket is disconnected (every 15s, zero polling when WS is connected)
  useEffect(() => {
    const fallbackTimer = setInterval(() => {
      const isWsConnected = teamChatWebSocket.getIsConnected();
      if (!isWsConnected && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchMessages(true);
      }
    }, 15000);

    return () => clearInterval(fallbackTimer);
  }, [fetchMessages]);

  // Real-Time Team Chat WebSocket & SSE Live Push Integration
  useEffect(() => {
    if (user) {
      teamChatWebSocket.connect(user);
    }

    const unsubscribe = teamChatWebSocket.onMessage((incomingMsg) => {
      const isGroup = chatType === 'group' && (!incomingMsg.recipientId || incomingMsg.channel === 'general');
      const isP2p =
        chatType === 'p2p' &&
        selectedUser &&
        ((Number(incomingMsg.userId) === Number(selectedUser.id) && Number(incomingMsg.recipientId) === Number(currentUserId)) ||
          (Number(incomingMsg.userId) === Number(currentUserId) && Number(incomingMsg.recipientId) === Number(selectedUser.id)));

      const isOwnMessage =
        (user?.id && incomingMsg.userId && Number(user.id) === Number(incomingMsg.userId)) ||
        (user?.login && incomingMsg.userLogin && user.login.toLowerCase() === incomingMsg.userLogin.toLowerCase());

      if (isGroup || isP2p) {
        setVisibleCount((prev) => prev + 1);
        setMessages((prev) => {
          if (prev.some((m) => m.id === incomingMsg.id)) return prev;

          // Replace optimistic pending message if content and sender match
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

        // If tab is in background and not our own message, chime and show desktop notification
        if (!isOwnMessage && typeof document !== 'undefined' && document.hidden) {
          playIPhoneNotificationSound();
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const sender = incomingMsg.userName || incomingMsg.userLogin || 'Colleague';
              const notif = new Notification(sender, {
                body: incomingMsg.content || 'Sent an attachment',
                icon: '/favicon.png',
                badge: '/favicon.png',
                tag: `chat-${incomingMsg.id || Date.now()}`,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch {}
          }
        }
      } else {
        // Message is from another contact/room: on Web show banner, on Android never show in-app banner
        if (!isOwnMessage) {
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

          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const sender = incomingMsg.userName || incomingMsg.userLogin || 'Staff';
              const notif = new Notification(sender, {
                body: incomingMsg.content || 'Sent a message in another chat',
                icon: '/favicon.png',
                badge: '/favicon.png',
                tag: `chat-${incomingMsg.id || Date.now()}`,
              });
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch {}
          }
        }
      }
    });

    return () => unsubscribe();
  }, [chatType, selectedUser, currentUserId, user]);

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
        showAlert({ title: 'Chat Upload', message: `Failed to upload media to R2: ${err?.message || 'Upload error'}` });
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

    const tempId = -Date.now();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: trimmed,
      channel,
      recipientId,
      recipientLogin: isP2p ? selectedUser.login : undefined,
      recipientName: isP2p ? getTargetUserName(selectedUser) : undefined,
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

    setVisibleCount((prev) => prev + 1);
    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    clearPendingFile();
    setTimeout(() => scrollToBottom(true), 50);

    // Real-Time WebSocket Microservice Broadcast
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
    const confirmed = await showConfirm({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await chatService.deleteMessage(id);
    } catch (err: any) {
      setApiNotice(`Could not delete message on server: ${err.message}`);
    }
  };

  const formatTimestamp = (val?: string) => {
    if (!val) return '';
    return formatIndianTime(val, { fallback: '' });
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

  // Lazy loading pagination for chat history:
  // Starts on the most recent messages at the bottom; user scrolling UP loads earlier messages.
  const totalMessagesCount = filteredMessages.length;
  const hasMoreOlder = visibleCount < totalMessagesCount;

  const displayedMessages = useMemo(() => {
    if (totalMessagesCount <= visibleCount) {
      return filteredMessages;
    }
    return filteredMessages.slice(totalMessagesCount - visibleCount);
  }, [filteredMessages, visibleCount, totalMessagesCount]);

  const loadOlderMessages = useCallback(() => {
    if (loadingOlder || !hasMoreOlder) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    setLoadingOlder(true);
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setTimeout(() => {
      setVisibleCount((prev) => Math.min(totalMessagesCount, prev + PAGE_SIZE));
      setLoadingOlder(false);

      // Restore scroll offset so prepending older items causes zero visual jump
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    }, 120);
  }, [loadingOlder, hasMoreOlder, totalMessagesCount, PAGE_SIZE]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(distanceFromBottom < 120);

    // When scrolled near the top (< 60px), automatically lazy-load previous batch of messages
    if (container.scrollTop < 60 && hasMoreOlder && !loadingOlder) {
      loadOlderMessages();
    }
  };

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

  const filteredDirectUsers = useMemo(() => {
    let list = directUsers;
    if (activeFilterTab === 'groups') return [];
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      list = list.filter((u) => {
        const name = getTargetUserName(u).toLowerCase();
        const login = (u.login || '').toLowerCase();
        return name.includes(q) || login.includes(q);
      });
    }
    return list;
  }, [directUsers, listSearchQuery, activeFilterTab]);

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

    const timeStr = formatIndianTime(curr, { fallback: '' });
    let label = '';
    if (isToday) {
      label = `Today at ${timeStr}`;
    } else if (isYesterday) {
      label = `Yesterday at ${timeStr}`;
    } else {
      label = `${formatIndianDate(curr, { weekday: true })} at ${timeStr}`;
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
    <div className="flex flex-col h-[calc(100dvh-113px)] md:h-[calc(100vh-130px)] bg-white md:rounded-2xl md:border md:border-black/[0.08] md:shadow-xs overflow-hidden select-none">
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
        {/* Left Sidebar: Messages List (Default screen on mobile, sidebar on desktop) */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 md:min-w-[320px] border-r border-[rgba(60,60,67,0.12)] bg-[#ffffff] flex-col shrink-0`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[rgba(60,60,67,0.08)] flex items-center justify-between">
            <h1 className="text-[20px] font-bold text-[#000000] tracking-tight">
              Messages
            </h1>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[rgba(60,60,67,0.06)]">
            {/* All Team Chat Item */}
            <button
              onClick={() => {
                setChatType('group');
                setSelectedUser(null);
                setMobileView('chat');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all cursor-pointer ${
                chatType === 'group'
                  ? 'bg-[#007aff] text-white'
                  : 'hover:bg-black/[0.03] text-[#1c1c1e]'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                  chatType === 'group'
                    ? 'bg-white/25 text-white'
                    : 'bg-gradient-to-tr from-[#007aff] to-[#5ac8fa] text-white'
                }`}
              >
                <UsersIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p
                    className={`font-semibold text-[14px] truncate ${
                      chatType === 'group' ? 'text-white' : 'text-[#000000]'
                    }`}
                  >
                    All Team Chat
                  </p>
                  <span
                    className={`text-[11px] ${
                      chatType === 'group' ? 'text-white/80' : 'text-[#8e8e93]'
                    }`}
                  >
                    Group
                  </span>
                </div>
                <p
                  className={`text-[12px] truncate mt-0.5 ${
                    chatType === 'group' ? 'text-white/90' : 'text-[#8e8e93]'
                  }`}
                >
                  Common group chat for all team members
                </p>
              </div>
            </button>

            {/* Direct Messages Section */}
            {directUsers.length > 0 && (
              <div className="px-3.5 py-1.5 bg-black/[0.02] text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider flex items-center justify-between border-y border-[rgba(60,60,67,0.04)] select-none">
                <span>DIRECT MESSAGES</span>
                <span className="font-mono text-[10px] text-[#8e8e93]">{directUsers.length}</span>
              </div>
            )}

            {loadingUsers ? (
              <div className="p-4 text-center text-[#8e8e93] text-xs">
                Loading team members...
              </div>
            ) : directUsers.length === 0 ? null : (
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
                      setMobileView('chat');
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all cursor-pointer ${
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
        </div>

        {/* Right Conversation View: WhatsApp UX Full Screen on Mobile, Side-by-Side on Desktop */}
        <div
          className={`${
            mobileView === 'list'
              ? 'hidden md:flex'
              : 'fixed inset-0 z-50 md:static md:inset-auto md:z-auto flex'
          } flex-1 flex-col min-w-0 bg-white relative`}
        >
          {/* Conversation Top Bar (WhatsApp UX) */}
          <div className="h-14 px-3 sm:px-4 bg-white border-b border-black/[0.08] flex items-center justify-between shrink-0 shadow-2xs z-10">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* WhatsApp Back Button on Mobile */}
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="flex items-center text-[#007aff] hover:opacity-80 active:scale-95 transition-all p-1.5 -ml-1 md:hidden cursor-pointer rounded-full"
                title="Back to Chats"
              >
                <ChevronLeft size={24} strokeWidth={2.4} />
              </button>

              {/* Avatar */}
              <div className="relative shrink-0">
                {chatType === 'group' ? (
                  <div className="w-10 h-10 rounded-full bg-[#007aff]/10 text-[#007aff] flex items-center justify-center shrink-0 border border-[#007aff]/20 font-bold">
                    <UsersIcon size={19} />
                  </div>
                ) : selectedUser?.imageUrl ? (
                  <img
                    src={selectedUser.imageUrl}
                    alt={selectedUser.login}
                    className="w-10 h-10 rounded-full object-cover border border-black/10 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                    {selectedUser?.firstName?.[0] || selectedUser?.login?.[0] || 'U'}
                  </div>
                )}
                {chatType === 'p2p' && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Contact / Room Info */}
              <div className="min-w-0 flex-1 ml-0.5">
                <h2 className="font-bold text-[14px] text-slate-900 tracking-tight truncate leading-tight">
                  {chatType === 'group'
                    ? 'All Team Chat'
                    : selectedUser
                    ? getTargetUserName(selectedUser)
                    : 'Team Conversation'}
                </h2>
                <p className="text-[11px] text-slate-500 font-normal leading-tight truncate mt-0.5">
                  {chatType === 'group'
                    ? `${directUsers.length + 1} team members`
                    : selectedUser
                    ? 'online'
                    : 'Select a conversation'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setMobileView('list')}
                className="hidden md:inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Switch Chat
              </button>
            </div>
          </div>

          {/* Messages Feed (Pure White Background) */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 space-y-2 select-text bg-white"
          >
            {/* Lazy Loading Header for Earlier Messages (Scroll UP to load) */}
            {hasMoreOlder && (
              <div className="py-2 flex items-center justify-center">
                {loadingOlder ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1 bg-white/90 backdrop-blur-md px-3.5 rounded-full border border-black/[0.04] shadow-xs">
                    <RefreshCw size={13} className="animate-spin text-[#007aff]" />
                    <span>Loading earlier messages...</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    className="text-[11px] font-medium text-[#007aff] hover:text-[#005bb5] bg-white/90 backdrop-blur-md px-3.5 py-1 rounded-full transition cursor-pointer active:scale-95 shadow-xs border border-black/[0.04]"
                  >
                    Load earlier messages ({totalMessagesCount - visibleCount} more)
                  </button>
                )}
              </div>
            )}

            {!hasMoreOlder && displayedMessages.length > 0 && (
              <div className="py-2.5 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-slate-500 bg-white/85 backdrop-blur-md px-3 py-1 rounded-full border border-black/[0.04] shadow-2xs uppercase tracking-wider">
                  Beginning of conversation
                </span>
              </div>
            )}

            {loading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 select-none">
                <RefreshCw size={20} className="animate-spin text-[#007aff]" />
                <span className="text-xs">Loading conversation...</span>
              </div>
            ) : displayedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 select-none">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-2.5 text-slate-400">
                  {chatType === 'group' ? (
                    <UsersIcon size={24} />
                  ) : (
                    <UserIcon size={24} />
                  )}
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  {chatType === 'group'
                    ? 'No messages yet'
                    : selectedUser
                    ? `Conversation with @${selectedUser.login}`
                    : 'Select a conversation'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
                  {chatType === 'group'
                    ? 'Send a message to start communicating with the team.'
                    : selectedUser
                    ? `Say hello to @${selectedUser.login} with private 1-on-1 messaging.`
                    : 'Choose a team member from the list to start chatting.'}
                </p>
              </div>
            ) : (
              displayedMessages.map((msg, index) => {
                const prevMsg = index > 0 ? displayedMessages[index - 1] : undefined;
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

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group my-1`}>
                      {/* Message Bubble: WhatsApp UX with clean Apple/CRM styling */}
                      <div
                        className={`relative px-3.5 py-2 text-[14px] leading-relaxed max-w-[85%] sm:max-w-[70%] shadow-2xs select-text ${
                          isMe
                            ? 'bg-[#007aff] text-white rounded-2xl rounded-tr-xs'
                            : 'bg-[#f2f2f7] text-[#1c1c1e] rounded-2xl rounded-tl-xs border border-black/[0.04]'
                        }`}
                      >
                        {/* Inbound sender label for group chats */}
                        {!isMe && chatType === 'group' && (
                          <p className="text-[11px] font-bold text-[#007aff] mb-1 select-none">
                            {author}
                          </p>
                        )}

                        {/* Image / Video Media */}
                        {isImg && (
                          <button
                            type="button"
                            onClick={() => handleOpenMedia(msg)}
                            className="block hover:opacity-95 transition-opacity text-left cursor-pointer w-full rounded-xl overflow-hidden mb-1.5"
                            title="Click to view full photo in app"
                          >
                            <img
                              src={msg.mediaUrl}
                              alt={msg.fileName || 'Attached photo'}
                              loading="lazy"
                              onLoad={handleImageLoad}
                              className="w-full max-h-72 object-cover block rounded-xl"
                            />
                          </button>
                        )}

                        {isVid && (
                          <div className="bg-black rounded-xl overflow-hidden mb-1.5">
                            <video
                              src={msg.mediaUrl}
                              controls
                              onLoadedData={handleImageLoad}
                              className="w-full max-h-72 block"
                            />
                          </div>
                        )}

                        {/* Document Attachment */}
                        {msg.mediaUrl && !isImg && !isVid && (
                          <button
                            type="button"
                            onClick={() => handleDownloadMedia(msg.mediaUrl!, msg.fileName)}
                            className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors w-full text-left cursor-pointer mb-1.5 ${
                              isMe
                                ? 'bg-white/15 text-white hover:bg-white/25'
                                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                            }`}
                            title="Click to download file"
                          >
                            <FileText size={18} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-[12px]">{msg.fileName || 'Document'}</p>
                              {msg.fileSize && (
                                <p className="text-[10px] opacity-75">{formatFileSize(msg.fileSize)}</p>
                              )}
                            </div>
                            <Download size={14} className="shrink-0 opacity-70" />
                          </button>
                        )}

                        {/* Message Content & Inline WhatsApp Timestamp / Checkmark */}
                        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-0.5">
                          {text && (
                            <span className="whitespace-pre-wrap break-words font-normal flex-1">
                              {text}
                            </span>
                          )}

                          <div
                            className={`flex items-center gap-1 shrink-0 ml-auto pt-0.5 select-none text-[10px] ${
                              isMe ? 'text-white/80' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatTimestamp(msg.createdAt || msg.timestamp)}</span>
                            {isMe && (
                              <span className="flex items-center">
                                {typeof msg.id === 'number' && msg.id < 0 ? (
                                  <svg className="w-3 h-3 animate-pulse" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                                  </svg>
                                ) : msg.isRead ? (
                                  <svg className="w-3.5 h-3" viewBox="0 0 16 15" fill="none">
                                    <path d="M10.91 3.4L4.97 9.87L2.14 7.04" stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M14.5 3.4L8.56 9.87L7.5 8.8" stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3" viewBox="0 0 16 15" fill="none">
                                    <path d="M10.91 3.4L4.97 9.87L2.14 7.04" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M14.5 3.4L8.56 9.87L7.5 8.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Delete button on hover for sent messages */}
                      {isMe && (
                        <div className="flex items-center gap-1 mt-0.5 mr-1 text-[11px] select-none">
                          <button
                            onClick={() => handleDeleteMessage(msg.id!)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-0.5 cursor-pointer"
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

          {/* Scroll to Latest Floating Pill Button */}
          {!isNearBottom && (
            <div className="absolute bottom-20 right-5 z-10 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="px-3.5 py-1.5 bg-white/95 hover:bg-white text-[#007aff] border border-black/10 rounded-full shadow-md flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md active:scale-95 transition cursor-pointer"
              >
                <ArrowDown size={14} strokeWidth={2.5} />
                <span>Latest</span>
              </button>
            </div>
          )}

          {/* Chat Input Bar (Pure White) */}
          <form
            onSubmit={handleSendMessage}
            className="p-2 sm:p-2.5 bg-white border-t border-black/[0.08] flex items-end gap-2 shrink-0 z-10"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
          >
            {/* Hidden native file picker */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Circular Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || sending}
              title="Attach photo, video or document"
              className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all shrink-0 shadow-2xs border border-black/[0.06] disabled:opacity-40 cursor-pointer"
            >
              <Plus size={20} strokeWidth={2.4} />
            </button>

            {/* Simple Clean Input Field */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Attachment Sticker / Pill if file selected */}
              {pendingFile && (
                <div className="mb-2 select-none">
                  {filePreviewUrl ? (
                    <div className="relative inline-block w-16 h-16 rounded-lg overflow-hidden border border-black/10 shadow-xs">
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
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#f2f2f7] rounded-lg border border-black/5 relative max-w-sm">
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

              {/* Single Rectangular Input */}
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={chatType === 'p2p' && !selectedUser}
                placeholder={chatType === 'p2p' && !selectedUser ? 'Select a colleague to start chatting' : 'Type a message...'}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] transition"
                aria-label="Message text"
              />
            </div>

            {/* Circular Send Button */}
            <button
              type="submit"
              disabled={
                (!inputText.trim() && !pendingFile) ||
                sending ||
                uploadingFile ||
                (chatType === 'p2p' && !selectedUser)
              }
              className="w-10 h-10 rounded-full bg-[#007aff] hover:bg-[#0071e3] active:scale-95 disabled:bg-slate-300 disabled:opacity-50 text-white flex items-center justify-center transition-all shrink-0 shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="Send"
            >
              {uploadingFile || sending ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <ArrowUp size={18} strokeWidth={2.6} />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Apple-grade In-App Media Viewer Lightbox (Never opens separate tab, never exposes raw public URL) */}
      {lightboxMedia && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200 select-none"
          onClick={handleCloseLightbox}
        >
          {/* Top Bar: Sender info + Controls */}
          <div
            className="flex items-center justify-between gap-3 text-white w-full max-w-5xl mx-auto shrink-0 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center font-semibold text-sm shrink-0">
                {(lightboxMedia.senderName?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">
                  {lightboxMedia.senderName || 'Team Member'}
                </p>
                <p className="text-xs text-white/60 truncate leading-tight mt-0.5">
                  {lightboxMedia.fileName || (lightboxMedia.type === 'VIDEO' ? 'Video' : 'Photo')}
                  {lightboxMedia.timestamp && ` • ${lightboxMedia.timestamp}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {lightboxMedia.type === 'IMAGE' && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom((z) => Math.max(0.5, z - 0.25))}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom(1)}
                    className="px-2.5 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-medium flex items-center justify-center transition cursor-pointer"
                    title="Reset Zoom"
                  >
                    {Math.round(lightboxZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxZoom((z) => Math.min(3, z + 0.25))}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleDownloadMedia(lightboxMedia.url, lightboxMedia.fileName)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition cursor-pointer"
                title="Download file to device"
              >
                <Download size={16} />
              </button>

              <button
                type="button"
                onClick={handleCloseLightbox}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition cursor-pointer ml-1"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Center Content: Image or Video */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden my-3 min-h-0"
            onClick={handleCloseLightbox}
          >
            {lightboxMedia.type === 'IMAGE' ? (
              <img
                src={lightboxMedia.url}
                alt={lightboxMedia.fileName || 'Full photo'}
                style={{ transform: `scale(${lightboxZoom})` }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform duration-150 cursor-grab active:cursor-grabbing select-none"
              />
            ) : lightboxMedia.type === 'VIDEO' ? (
              <div
                className="max-h-[82vh] max-w-[90vw] rounded-xl overflow-hidden shadow-2xl bg-black"
                onClick={(e) => e.stopPropagation()}
              >
                <video
                  src={lightboxMedia.url}
                  controls
                  autoPlay
                  className="max-h-[82vh] max-w-[90vw] block"
                />
              </div>
            ) : null}
          </div>

          {/* Bottom Bar Hint */}
          <div className="text-center text-xs text-white/50 py-1 shrink-0">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 font-mono text-[10px]">ESC</kbd> or click anywhere to return to chat
          </div>
        </div>
      )}
    </div>
  );
}
