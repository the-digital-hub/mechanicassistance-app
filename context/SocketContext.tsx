import { useUser } from '@/context/UserContext';
import { getFreshAccessToken } from '@/lib/api/apiClient';
import { ConfigService } from '@/lib/config/ConfigService';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    timestamp: string;
    conversationId: string;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    lastMessage: any;
    sendMessage: (type: string, payload: any) => void;
    chatHistory: Record<string, ChatMessage[]>;
    clearChatHistory: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// socket.io-client wants an http(s) origin; map ws/wss to http/https.
function toIoUrl(wsUrl: string): string {
    return wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

// Server-driven domain events the app reacts to (besides chat).
const SERVER_EVENTS = ['assistance_update', 'appointment_update', 'video_room_ready', 'new_request', 'verification_update', 'mechanic_status'];

export function SocketProvider({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});

    const currentSocket = useRef<Socket | null>(null);

    const clearChatHistory = (conversationId: string) => {
        setChatHistory(prev => {
            const next = { ...prev };
            delete next[conversationId];
            return next;
        });
    };

    const sendMessage = (type: string, payload: any) => {
        const s = currentSocket.current;
        if (!s || !s.connected) return;
        s.emit(type, payload);

        // If it's a chat message, also store it locally in history (optimistic).
        if (type === 'chat_message' && payload.conversationId) {
            const myMsg: ChatMessage = {
                id: Date.now().toString(),
                text: payload.text,
                senderId: payload.senderId,
                timestamp: new Date().toISOString(),
                conversationId: payload.conversationId,
            };
            setChatHistory(prev => ({
                ...prev,
                [payload.conversationId]: [...(prev[payload.conversationId] || []), myMsg],
            }));
        }
    };

    // Initial connection logic & listeners
    useEffect(() => {
        if (!user?.id) return;

        // Reconnect if config changes while we are authenticated
        const handleConfigChange = () => {
            console.log('[Socket] Config changed, reconnecting...');
            connect();
        };
        ConfigService.addListener(handleConfigChange);

        // Mark offline/online as the app backgrounds/foregrounds
        const handleAppState = (nextState: AppStateStatus) => {
            const s = currentSocket.current;
            if (!s) return;
            if (nextState === 'background' || nextState === 'inactive') {
                s.emit('unregister');
            } else if (nextState === 'active') {
                // No payload: the gateway re-joins the rooms of the identity it
                // verified at handshake time.
                s.emit('register');
            }
        };
        const appStateSub = AppState.addEventListener('change', handleAppState);

        ConfigService.init().then(() => connect());

        return () => {
            ConfigService.removeListener(handleConfigChange);
            appStateSub.remove();
            const s = currentSocket.current;
            if (s) {
                s.emit('unregister');
                s.removeAllListeners();
                s.disconnect();
            }
        };
    }, [user?.id]);

    const connect = () => {
        const url = toIoUrl(ConfigService.getWsUrl());
        console.log('[Socket] Connecting to', url);

        // Tear down any prior socket before creating a new one.
        if (currentSocket.current) {
            currentSocket.current.removeAllListeners();
            currentSocket.current.disconnect();
        }

        const s = io(url, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 2000,
            // A function, not a value: socket.io-client re-evaluates it on every
            // connection attempt, so a reconnect after the app was backgrounded
            // presents a fresh token instead of the 30-minute one it held when
            // it first connected. The gateway derives the room from this token
            // and ignores anything we claim in a message body.
            auth: (cb: (data: { token?: string }) => void) => {
                getFreshAccessToken()
                    .then((token) => cb({ token: token ?? undefined }))
                    .catch(() => cb({}));
            },
        });
        currentSocket.current = s;
        setSocket(s);

        s.on('connect', () => {
            console.log('[Socket] Connected');
            setIsConnected(true);
            // Surface a connect tick so consumers can refetch anything missed
            // while the socket was down (events are ephemeral, not replayed).
            setLastMessage({ type: 'socket_connect', ts: Date.now() });
        });

        s.on('disconnect', () => {
            console.log('[Socket] Disconnected');
            setIsConnected(false);
        });

        s.on('connect_error', (err: Error) => {
            // Reconnection is left on: `auth` is re-evaluated per attempt, so a
            // rejection caused by an expired token clears itself once the
            // refresh lands. A genuinely dead session stops retrying when
            // apiClient sees its own 401 and tears the provider down.
            console.warn('[Socket] connect_error:', err?.message);
        });

        // The gateway says so explicitly before closing an unauthenticated
        // socket. Nothing to do but log it — retrying with a fresh token is
        // already what the next attempt does.
        s.on('unauthorized', (payload: any) => {
            console.warn('[Socket] unauthorized:', payload?.message);
        });

        // Chat relay — the emitted arg is the flat message body.
        s.on('chat_message', (payload: any) => {
            setLastMessage({ type: 'chat_message', payload });
            const conversationId = payload?.conversationId;
            if (conversationId) {
                const newMsg: ChatMessage = {
                    id: Date.now().toString(),
                    text: payload.text,
                    senderId: payload.senderId,
                    timestamp: payload.timestamp || new Date().toISOString(),
                    conversationId,
                };
                setChatHistory(prev => ({
                    ...prev,
                    [conversationId]: [...(prev[conversationId] || []), newMsg],
                }));
            }
        });

        // Server-driven domain events.
        SERVER_EVENTS.forEach((evt) => {
            s.on(evt, (payload: any) => {
                setLastMessage({ type: evt, payload });
                if (evt === 'assistance_update' && payload?.status === 'canceled') {
                    const reqId = payload.requestId || payload.id;
                    if (reqId) clearChatHistory(reqId);
                }
            });
        });
    };

    return (
        <SocketContext.Provider value={{ socket, isConnected, lastMessage, sendMessage, chatHistory, clearChatHistory }}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (context === undefined) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}
