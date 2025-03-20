// 主入口點檔案 - index.ts

import { initChatApp } from './ui-manager';
import { chatState } from './state-manager';

// 初始化應用程式
initChatApp();

// 讓狀態管理器在全局可用（用於調試）
declare global {
  interface Window {
    chatState: typeof chatState;
  }
}

window.chatState = chatState;