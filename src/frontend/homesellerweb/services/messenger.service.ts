import { apiFetch } from '@/lib/http'; 
import {
  AttachmentResponse,
  ChatHistoryResponse,
  ChatResponse,
  GetChatHistoryRequest,
  GetOrCreateChatRequest,
  MessageResponse,
} from '@/dtos/messenger/messenger.dto'; 

const MESSENGER_API_URL =
  process.env.NEXT_PUBLIC_MESSENGER_API_URL || 'http://localhost:5214';
const BASE_ENDPOINT = `${MESSENGER_API_URL}/api/Messenger`;

export const messengerService = {

  getUserChats(): Promise<ChatResponse[]> {
    return apiFetch<ChatResponse[]>(`${BASE_ENDPOINT}/chats`, {
      method: 'GET',
    });
  },


  getOrCreateChat(request: GetOrCreateChatRequest): Promise<ChatResponse> {
    return apiFetch<ChatResponse>(`${BASE_ENDPOINT}/chats`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },


  getChatHistory({
    chatId,
    page = 1,
    pageSize = 50,
  }: GetChatHistoryRequest): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    return apiFetch<Omit<ChatHistoryResponse, "messages"> & { messages: MessageResponse[] | null }>(
      `${BASE_ENDPOINT}/chats/${chatId}/messages?${params.toString()}`,
      {
        method: 'GET',
      }
    ).then((history) => ({ ...history, messages: history.messages ?? [] }));
  },


  getMessageById(messageId: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>(`${BASE_ENDPOINT}/messages/${messageId}`, {
      method: 'GET',
    });
  },


  uploadAttachments(files: File[]): Promise<AttachmentResponse[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    // apiFetch сам не добавит Content-Type для FormData и подставит Bearer токен
    return apiFetch<AttachmentResponse[]>(`${BASE_ENDPOINT}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Удалить загруженное вложение по его URL
   */
  deleteAttachment(fileUrl: string): Promise<void> {
    const params = new URLSearchParams({ fileUrl });
    return apiFetch<void>(`${BASE_ENDPOINT}/attachments?${params.toString()}`, {
      method: 'DELETE',
    });
  },
};