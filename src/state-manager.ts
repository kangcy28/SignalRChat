/**
 * 聊天應用程序狀態管理器
 * 提供集中式狀態管理，用於追踪連接、用戶和消息狀態
 */

import { GroupInfo, ChatMessage } from './interfaces';

/**
 * 聊天狀態接口
 */
export interface ChatState {
  // 連接狀態
  connection: {
    isConnected: boolean;
    isConnecting: boolean;
    reconnectAttempts: number;
    lastError: string | null;
    serverTime: Date | null;
    ping: number | null;  // 連接延遲（毫秒）
  };
  
  // 用戶狀態
  user: {
    id: string | null;    // 連接ID
    username: string;
    groups: GroupInfo[];
    activeGroup: string;
    isTyping: boolean;
    status: 'online' | 'away' | 'offline';
    lastActivity: Date;
  };
  
  // 消息狀態
  messages: {
    byGroup: Record<string, ChatMessage[]>;
    unreadCount: Record<string, number>;
    lastMessageTimestamp: Record<string, Date | null>;
    pendingMessages: ChatMessage[];  // 待發送的消息
    failedMessages: ChatMessage[];   // 發送失敗的消息
  };
  
  // 系統狀態
  system: {
    darkMode: boolean;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    language: string;
    fontSize: number;
    windowFocused: boolean;
  };
}

/**
 * 狀態監聽器類型
 */
type StateListener<T = any> = (newValue: T, oldValue: T, path: string) => void;

/**
 * 狀態變更事件
 */
export enum StateEvent {
  CONNECTION_CHANGE = 'connection',
  USER_CHANGE = 'user',
  ACTIVE_GROUP_CHANGE = 'activeGroup',
  MESSAGES_CHANGE = 'messages',
  GROUP_MESSAGES_CHANGE = 'groupMessages',
  UNREAD_COUNT_CHANGE = 'unreadCount',
  SYSTEM_CHANGE = 'system',
}

/**
 * 聊天狀態管理器類別 - 單例設計模式
 */
export class ChatStateManager {
  private static instance: ChatStateManager;
  private state: ChatState;
  private listeners: Map<string, StateListener[]> = new Map();
  
  /**
   * 私有構造函數 - 防止直接創建實例
   */
  private constructor() {
    // 初始化默認狀態
    this.state = {
      connection: {
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
        lastError: null,
        serverTime: null,
        ping: null
      },
      user: {
        id: null,
        username: localStorage.getItem('chatUsername') || '訪客' + Math.floor(Math.random() * 1000),
        groups: [{ name: 'General', description: '一般討論群組' }],
        activeGroup: 'General',
        isTyping: false,
        status: 'online',
        lastActivity: new Date()
      },
      messages: {
        byGroup: { 'General': [] },
        unreadCount: { 'General': 0 },
        lastMessageTimestamp: { 'General': null },
        pendingMessages: [],
        failedMessages: []
      },
      system: {
        darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
        notificationsEnabled: this.checkNotificationPermission(),
        soundEnabled: true,
        language: navigator.language || 'zh-TW',
        fontSize: parseInt(localStorage.getItem('chatFontSize') || '14'),
        windowFocused: document.hasFocus()
      }
    };
    
    // 設置窗口焦點監聽器
    window.addEventListener('focus', () => {
      this.updateState('system.windowFocused', true);
      // 如果窗口重新獲取焦點，重置當前活動群組未讀消息計數
      this.updateState(`messages.unreadCount.${this.state.user.activeGroup}`, 0);
    });
    
    window.addEventListener('blur', () => {
      this.updateState('system.windowFocused', false);
    });
    
    // 初始化狀態持久化
    this.loadFromLocalStorage();
  }
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): ChatStateManager {
    if (!ChatStateManager.instance) {
      ChatStateManager.instance = new ChatStateManager();
    }
    return ChatStateManager.instance;
  }
  
  /**
   * 檢查通知權限
   */
  private checkNotificationPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }
  
  /**
   * 獲取狀態樹的特定路徑值
   * @param path 狀態路徑 (例如: 'user.username', 'connection.isConnected')
   */
  public getState<T>(path: string): T {
    return path.split('.').reduce((obj, key) => 
      obj && obj[key] !== undefined ? obj[key] : null, this.state as any);
  }
  
  /**
   * 獲取整個狀態物件的深拷貝
   */
  public getFullState(): ChatState {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * 更新狀態
   * @param path 要更新的狀態路徑
   * @param value 新值
   */
  public updateState<T>(path: string, value: T): void {
    const pathParts = path.split('.');
    const lastKey = pathParts.pop()!;
    const oldValue = this.getState<T>(path);
    
    // 如果值沒有變化，不進行更新
    if (JSON.stringify(oldValue) === JSON.stringify(value)) {
      return;
    }
    
    // 找到要更新的對象
    const target = pathParts.reduce((obj, key) => {
      if (!obj[key]) {
        obj[key] = {};
      }
      return obj[key];
    }, this.state as any);
    
    // 更新值
    target[lastKey] = value;
    
    // 觸發相關監聽器
    this.notifyListeners(path, value, oldValue);
    
    // 保存某些狀態到 localStorage
    this.saveToLocalStorage();
  }
  
  /**
   * 通知狀態變化的監聽器
   */
  private notifyListeners<T>(path: string, newValue: T, oldValue: T): void {
    // 通知完整路徑的監聽器
    this.getListeners(path).forEach(listener => 
      listener(newValue, oldValue, path));
    
    // 通知父路徑的監聽器
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      const parentNew = this.getState(parentPath);
      const parentOld = parentNew; // 簡化，實際上應該計算更新前的完整父對象
      
      this.getListeners(parentPath).forEach(listener => 
        listener(parentNew, parentOld, parentPath));
    }
    
    // 通知所有根級別的變化
    const rootSegment = path.split('.')[0];
    
    // 針對特定狀態變化發出特定事件
    if (path === 'user.activeGroup') {
      this.getListeners(StateEvent.ACTIVE_GROUP_CHANGE).forEach(listener =>
        listener(newValue, oldValue, path));
    } else if (path.startsWith('messages.byGroup.')) {
      // 例如 messages.byGroup.General 的變化
      const groupName = path.split('.')[2];
      this.getListeners(StateEvent.GROUP_MESSAGES_CHANGE).forEach(listener =>
        listener(groupName, null, path));
    } else if (path.startsWith('messages.unreadCount.')) {
      this.getListeners(StateEvent.UNREAD_COUNT_CHANGE).forEach(listener =>
        listener(newValue, oldValue, path));
    }
    
    // 根據路徑第一段發出一般事件
    this.getListeners(rootSegment).forEach(listener => {
      const rootNewValue = this.state[rootSegment as keyof ChatState];
      listener(rootNewValue, rootNewValue, rootSegment); // 簡化，不提供精確的舊值
    });
  }
  
  /**
   * 獲取特定路徑的監聽器
   */
  private getListeners(path: string): StateListener[] {
    return this.listeners.get(path) || [];
  }
  
  /**
   * 添加狀態監聽器
   * @param path 要監聽的狀態路徑或事件類型
   * @param listener 監聽回調函數
   */
  public addListener<T>(path: string, listener: StateListener<T>): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    
    this.listeners.get(path)!.push(listener as StateListener);
    
    // 返回取消監聽的函數
    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(listener as StateListener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * 將群組添加到用戶的群組列表
   * @param group 群組信息
   */
  public addGroup(group: GroupInfo): void {
    const groups = [...this.state.user.groups];
    // 檢查群組是否已存在
    const existingIndex = groups.findIndex(g => g.name === group.name);
    
    if (existingIndex === -1) {
      groups.push(group);
      this.updateState('user.groups', groups);
      
      // 為新群組初始化消息列表和未讀計數
      if (!this.state.messages.byGroup[group.name]) {
        const byGroup = { ...this.state.messages.byGroup };
        byGroup[group.name] = [];
        this.updateState('messages.byGroup', byGroup);
      }
      
      if (!this.state.messages.unreadCount[group.name]) {
        const unreadCount = { ...this.state.messages.unreadCount };
        unreadCount[group.name] = 0;
        this.updateState('messages.unreadCount', unreadCount);
      }
      
      if (!this.state.messages.lastMessageTimestamp[group.name]) {
        const lastMessageTimestamp = { ...this.state.messages.lastMessageTimestamp };
        lastMessageTimestamp[group.name] = null;
        this.updateState('messages.lastMessageTimestamp', lastMessageTimestamp);
      }
    }
  }
  
  /**
   * 將群組從用戶的群組列表中移除
   * @param groupName 群組名稱
   */
  public removeGroup(groupName: string): void {
    // 不允許移除 General 群組
    if (groupName === 'General') {
      return;
    }
    
    // 更新群組列表
    const groups = this.state.user.groups.filter(g => g.name !== groupName);
    this.updateState('user.groups', groups);
    
    // 如果當前活動群組被移除，切換到 General
    if (this.state.user.activeGroup === groupName) {
      this.updateState('user.activeGroup', 'General');
    }
    
    // 清理該群組的消息和計數
    // 注意：我們保留歷史消息不刪除，以便以後可能的重新加入
    // this.updateState(`messages.byGroup.${groupName}`, []);
    this.updateState(`messages.unreadCount.${groupName}`, 0);
  }
  
  /**
   * 設置活動群組
   * @param groupName 群組名稱
   */
  public setActiveGroup(groupName: string): void {
    // 只有當群組存在於用戶的群組列表中時才能設置為活動
    if (this.state.user.groups.some(g => g.name === groupName)) {
      const oldGroup = this.state.user.activeGroup;
      
      this.updateState('user.activeGroup', groupName);
      
      // 重置新活動群組的未讀消息計數
      this.updateState(`messages.unreadCount.${groupName}`, 0);
    }
  }
  
  /**
   * 添加消息到特定群組
   * @param message 消息對象
   * @param groupName 群組名稱
   */
  public addMessage(message: ChatMessage, groupName?: string): void {
    // 如果未指定群組，使用消息的群組或當前活動群組
    const targetGroup = groupName || message.groupName || this.state.user.activeGroup;
    
    // 確保該群組存在於消息列表中
    if (!this.state.messages.byGroup[targetGroup]) {
      const byGroup = { ...this.state.messages.byGroup };
      byGroup[targetGroup] = [];
      this.updateState('messages.byGroup', byGroup);
    }
    
    // 添加消息
    const messages = [...(this.state.messages.byGroup[targetGroup] || [])];
    messages.push({
      ...message,
      timestamp: message.timestamp || new Date()
    });
    
    this.updateState(`messages.byGroup.${targetGroup}`, messages);
    this.updateState(`messages.lastMessageTimestamp.${targetGroup}`, new Date());
    
    // 如果不是當前活動群組且窗口沒有焦點，增加未讀消息計數
    if (message.user !== this.state.user.username && 
      (targetGroup !== this.state.user.activeGroup || !this.state.system.windowFocused)) {
      const currentCount = this.state.messages.unreadCount[targetGroup] || 0;
      this.updateState(`messages.unreadCount.${targetGroup}`, currentCount + 1);
    }
  }
  
  /**
   * 添加待發送的消息
   * @param message 待發送的消息
   */
  public addPendingMessage(message: ChatMessage): void {
    this.updateState('messages.pendingMessages', [
      ...this.state.messages.pendingMessages,
      message
    ]);
  }
  
  /**
   * 將消息從待發送移除（發送成功）
   * @param messageId 消息ID
   */
  public removePendingMessage(messageId: string): void {
    this.updateState('messages.pendingMessages', 
      this.state.messages.pendingMessages.filter(m => m.timestamp.toString() !== messageId));
  }
  
  /**
   * 將消息標記為發送失敗
   * @param message 失敗的消息
   */
  public markMessageAsFailed(message: ChatMessage): void {
    // 從待發送列表移除
    this.updateState('messages.pendingMessages', 
      this.state.messages.pendingMessages.filter(m => 
        m.timestamp.toString() !== message.timestamp.toString()));
    
    // 添加到失敗列表
    this.updateState('messages.failedMessages', [
      ...this.state.messages.failedMessages,
      message
    ]);
  }
  
  /**
   * 更新連接狀態
   * @param isConnected 是否已連接
   * @param isConnecting 是否正在連接
   * @param error 連接錯誤信息
   */
  public updateConnectionState(isConnected: boolean, isConnecting: boolean, error?: string): void {
    this.updateState('connection.isConnected', isConnected);
    this.updateState('connection.isConnecting', isConnecting);
    
    if (error) {
      this.updateState('connection.lastError', error);
    }
    
    if (!isConnected && !isConnecting) {
      // 連接斷開時增加重連嘗試次數
      this.updateState('connection.reconnectAttempts', 
        this.state.connection.reconnectAttempts + 1);
    } else if (isConnected) {
      // 連接成功時重置重連計數
      this.updateState('connection.reconnectAttempts', 0);
      this.updateState('connection.lastError', null);
    }
  }
  
  /**
   * 更新用戶在線狀態
   * @param status 在線狀態
   */
  public updateUserStatus(status: 'online' | 'away' | 'offline'): void {
    this.updateState('user.status', status);
    this.updateState('user.lastActivity', new Date());
  }
  
  /**
   * 更新用戶是否正在輸入
   * @param isTyping 是否正在輸入
   * @param groupName 群組名稱（可選，默認為當前活動群組）
   */
  public updateUserTyping(isTyping: boolean, groupName?: string): void {
    this.updateState('user.isTyping', isTyping);
    this.updateState('user.lastActivity', new Date());
  }
  
  /**
   * 請求推送通知權限
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }
    
    let permission: NotificationPermission;
    
    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      this.updateState('system.notificationsEnabled', false);
      return false;
    }
    
    const enabled = permission === 'granted';
    this.updateState('system.notificationsEnabled', enabled);
    return enabled;
  }
  
  /**
   * 顯示桌面通知
   * @param title 通知標題
   * @param options 通知選項
   */
  public showNotification(title: string, options?: NotificationOptions): void {
    if (this.state.system.notificationsEnabled && 
        !this.state.system.windowFocused && 
        'Notification' in window && 
        Notification.permission === 'granted') {
      
      new Notification(title, options);
      
      // 如果啟用了聲音通知，播放提示音
      if (this.state.system.soundEnabled) {
        this.playNotificationSound();
      }
    }
  }
  
  /**
   * 播放通知聲音
   */
  private playNotificationSound(): void {
    // 實現播放聲音的邏輯
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(() => console.log('無法播放通知聲音'));
    } catch (error) {
      console.log('播放通知聲音時出錯:', error);
    }
  }
  
  /**
   * 切換夜間模式
   * @param enabled 是否啟用夜間模式，如果不提供則切換當前狀態
   */
  public toggleDarkMode(enabled?: boolean): void {
    const darkMode = enabled !== undefined ? enabled : !this.state.system.darkMode;
    this.updateState('system.darkMode', darkMode);
    
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    localStorage.setItem('chatDarkMode', darkMode ? 'true' : 'false');
  }
  
  /**
   * 切換聲音通知
   * @param enabled 是否啟用聲音通知，如果不提供則切換當前狀態
   */
  public toggleSoundNotifications(enabled?: boolean): void {
    const soundEnabled = enabled !== undefined ? enabled : !this.state.system.soundEnabled;
    this.updateState('system.soundEnabled', soundEnabled);
    localStorage.setItem('chatSoundEnabled', soundEnabled ? 'true' : 'false');
  }
  
  /**
   * 設置字體大小
   * @param size 字體大小（像素）
   */
  public setFontSize(size: number): void {
    this.updateState('system.fontSize', size);
    localStorage.setItem('chatFontSize', size.toString());
    document.documentElement.style.setProperty('--chat-font-size', `${size}px`);
  }
  
  /**
   * 從 localStorage 加載持久化的狀態
   */
  private loadFromLocalStorage(): void {
    // 加載用戶名
    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
      this.updateState('user.username', savedUsername);
    }
    
    // 加載夜間模式設置
    const darkMode = localStorage.getItem('chatDarkMode') === 'true';
    this.toggleDarkMode(darkMode);
    
    // 加載聲音通知設置
    const soundEnabled = localStorage.getItem('chatSoundEnabled') !== 'false'; // 默認為開啟
    this.updateState('system.soundEnabled', soundEnabled);
    
    // 加載字體大小
    const fontSize = parseInt(localStorage.getItem('chatFontSize') || '14');
    this.setFontSize(fontSize);
  }
  
  /**
   * 將關鍵狀態保存到 localStorage
   */
  private saveToLocalStorage(): void {
    // 保存用戶名
    localStorage.setItem('chatUsername', this.state.user.username);
    
    // 保存夜間模式設置
    localStorage.setItem('chatDarkMode', this.state.system.darkMode ? 'true' : 'false');
    
    // 保存聲音通知設置
    localStorage.setItem('chatSoundEnabled', this.state.system.soundEnabled ? 'true' : 'false');
    
    // 保存字體大小
    localStorage.setItem('chatFontSize', this.state.system.fontSize.toString());
  }
  
  /**
   * 重置所有狀態（用於登出或重置應用）
   */
  public resetState(): void {
    // 保留一些系統設置
    const { darkMode, soundEnabled, fontSize } = this.state.system;
    
    // 創建新的狀態對象並重置
    this.state = {
      connection: {
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 0,
        lastError: null,
        serverTime: null,
        ping: null
      },
      user: {
        id: null,
        username: localStorage.getItem('chatUsername') || '訪客' + Math.floor(Math.random() * 1000),
        groups: [{ name: 'General', description: '一般討論群組' }],
        activeGroup: 'General',
        isTyping: false,
        status: 'online',
        lastActivity: new Date()
      },
      messages: {
        byGroup: { 'General': [] },
        unreadCount: { 'General': 0 },
        lastMessageTimestamp: { 'General': null },
        pendingMessages: [],
        failedMessages: []
      },
      system: {
        darkMode,
        notificationsEnabled: this.checkNotificationPermission(),
        soundEnabled,
        language: navigator.language || 'zh-TW',
        fontSize,
        windowFocused: document.hasFocus()
      }
    };
    
    // 通知所有根監聽器
    ['connection', 'user', 'messages', 'system'].forEach(key => {
      this.getListeners(key).forEach(listener => {
        const value = this.state[key as keyof ChatState];
        listener(value, value, key);
      });
    });
  }
}

// 導出單例實例
export const chatState = ChatStateManager.getInstance();