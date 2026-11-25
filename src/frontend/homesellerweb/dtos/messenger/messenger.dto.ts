export interface AttachmentRequest {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export interface SendMessageRequest {
  chatId: string;
  senderName: string;
  text: string;
  replyId?: string | null;
  attachments?: AttachmentRequest[] | null;
}

export interface GetOrCreateChatRequest {
  productId: string;
  productName?: string | null;
  targetUserId: string;
  initiatorName: string;
}

export interface GetChatHistoryRequest {
  chatId: string;
  page?: number;
  pageSize?: number;
}

export interface EditMessageRequest {
  messageId: string;
  newText: string;
}

export interface DeleteMessageRequest {
  messageId: string;
}



export interface AttachmentResponse {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

export interface ReplyPreviewResponse {
  id: string;
  userId: string;
  text: string;
}

export interface MessageResponse {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  replyId?: string | null;
  reply?: ReplyPreviewResponse | null;
  createAt: string;
  updateAt: string;
  attachments: AttachmentResponse[];
}

export interface ChatResponse {
  id: string;
  productId: string;
  userId1: string;
  userId2: string;
  createAt: string;
}

export interface ChatHistoryResponse {
  chatId: string;
  page: number;
  pageSize: number;
  messages: MessageResponse[];
}