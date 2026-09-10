import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';

const unwrap = (response) => response.data;

export const createConversation = (data) =>
  apiClient.post(API_PATHS.chat.create, data).then(unwrap);

export const getConversations = () =>
  apiClient.get(API_PATHS.chat.list).then(unwrap);

export const getConversationById = (id) =>
  apiClient.get(API_PATHS.chat.byId(id)).then(unwrap);

export const sendMessage = (conversationId, message) =>
  apiClient.post(API_PATHS.chat.messages(conversationId), { message }).then(unwrap);

export const deleteConversation = (id) =>
  apiClient.delete(API_PATHS.chat.byId(id)).then(unwrap);
