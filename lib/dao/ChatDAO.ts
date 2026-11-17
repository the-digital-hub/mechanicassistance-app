import { apiClient } from '../api/apiClient';
import { ConfigService } from '../config/ConfigService';
import {
    ChatConversation,
    ChatMessageDTO,
    ChatMessagePage,
    IChatDAO,
    SendChatMessagePayload,
} from './interfaces';

/** RFC 4122 v4 id for `clientMessageId` (react-native-get-random-values polyfills crypto). */
export function newClientMessageId(): string {
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** chat-service answers photo links relative to the API; make them loadable. */
function absolutize(m: ChatMessageDTO): ChatMessageDTO {
    if (m.mediaUrl?.startsWith('/')) {
        const base = ConfigService.getApiBaseUrl().replace(/\/+$/, '');
        return { ...m, mediaUrl: `${base}${m.mediaUrl}` };
    }
    return m;
}

/**
 * The chat of an appointment (chat-service, through the gateway at /api/chat).
 * The conversation id is the appointment id. New messages from the other side
 * arrive over the socket as `chat_message_created`, not through here.
 */
export class ChatDAO implements IChatDAO {
    async getConversation(appointmentId: string): Promise<ChatConversation> {
        return apiClient.get<ChatConversation>(`/api/chat/conversations/${appointmentId}`);
    }

    async listMessages(appointmentId: string, before?: string | null): Promise<ChatMessagePage> {
        const page = await apiClient.get<ChatMessagePage>(
            `/api/chat/conversations/${appointmentId}/messages`,
            before ? { before } : undefined,
        );
        return { ...page, items: page.items.map(absolutize) };
    }

    async sendMessage(appointmentId: string, payload: SendChatMessagePayload): Promise<ChatMessageDTO> {
        const sent = await apiClient.post<ChatMessageDTO>(
            `/api/chat/conversations/${appointmentId}/messages`,
            payload,
        );
        return absolutize(sent);
    }

    /** For socket payloads, which carry the same relative link. */
    normalize(message: ChatMessageDTO): ChatMessageDTO {
        return absolutize(message);
    }
}

export const chatDAO = new ChatDAO();
