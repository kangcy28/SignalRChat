import * as signalR from '@microsoft/signalr';
import { IChatHub, IChatClient, GroupInfo, ChatMessage } from './interfaces';
import { chatState } from './state-manager';

/**
 * SignalR聊天連接管理器
 * 封裝與服務器的連接並實現類型安全的方法調用
 */
export class ChatHubConnection {
  private connection: signalR.HubConnection;
  private connectionPromise: Promise<void> | null = null;
  private reconnectTimer: number | null = null;
  private heartbeatInterval: number | null = null;
  private typingTimeout: number | null = null;
  private pingStartTime: number | null = null;

  // 採用狀態管理器，不再需要本地狀態變量
  
  /**
   * 建立SignalR聊天連接管理器
   * @param url Hub URL，預設為"/chatHub"
   */
  constructor(url: string = '/chatHub') {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .configureLogging(signalR.LogLevel.Information)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          // 實現指數退避重連策略
          const maxRetryDelayMs = 30000; // 最大重連延遲 30 秒
          // 根據重連嘗試次數計算延遲
          const reconnectAttempts = chatState.getState<number>('connection.reconnectAttempts');
          const delayMs = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxRetryDelayMs);
          
          console.log(`正在嘗試重新連接，嘗試次數: ${reconnectAttempts}，延遲: ${delayMs}ms`);
          
          return delayMs;
        }
      })
      .build();
    
    this.setupClientMethods();
    this.setupConnectionHandlers();
  }

  /**
   * 獲取當前用戶名
   */
  get currentUsername(): string {
    return chatState.getState<string>('user.username');
  }

  /**
   * 獲取當前活動群組
   */
  get activeGroup(): string {
    return chatState.getState<string>('user.activeGroup');
  }

  /**
   * 獲取用戶所屬群組
   */
  get userGroups(): GroupInfo[] {
    return chatState.getState<GroupInfo[]>('user.groups');
  }

  /**
   * 獲取連接狀態
   */
  get isConnected(): boolean {
    return chatState.getState<boolean>('connection.isConnected');
  }

  /**
   * 設置當前活動的群組
   * @param groupName 群組名稱
   */
  setActiveGroup(groupName: string): void {
    chatState.setActiveGroup(groupName);
  }

  /**
   * 設置用戶名並發送到服務器
   * @param username 新用戶名
   */
  async setUsername(username: string): Promise<void> {
    if (!username.trim()) return;
    
    const oldUsername = this.currentUsername;
    
    // 更新狀態
    chatState.updateState('user.username', username);
    
    // 儲存到 localStorage
    localStorage.setItem('chatUsername', username);
    
    if (this.isConnected) {
      try {
        await this.invoke('registerUsername', username);
        
        // 添加系統消息，通知用戶名變更
        if (oldUsername && oldUsername !== username) {
          chatState.addMessage({
            user: 'System',
            message: `您已將用戶名從 "${oldUsername}" 更改為 "${username}"`,
            timestamp: new Date(),
            isSystem: true
          }, 'General');
        }
        
        return Promise.resolve();
      } catch (err) {
        console.error('註冊用戶名時出錯:', err);
        return Promise.reject(err);
      }
    }
  }

  /**
   * 啟動連接到Hub
   * @returns 連接Promise
   */
  start(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // 更新連接狀態
    chatState.updateConnectionState(false, true);

    this.connectionPromise = this.connection.start()
      .then(() => {
        console.log('SignalR 連接已建立');
        
        // 更新連接狀態
        chatState.updateConnectionState(true, false);
        
        // 開始發送心跳包
        this.startHeartbeat();
        
        // 註冊已經保存的用戶名
        const username = this.currentUsername;
        if (username) {
          return this.invoke('registerUsername', username).then(() => {
            // 註冊成功後獲取可用群組列表
            return this.getAvailableGroups();
          });
        }
      })
      .catch(err => {
        console.error('SignalR 連接失敗:', err);
        chatState.updateConnectionState(false, false, err.toString());
        this.connectionPromise = null;
        
        // 實現自定義重連邏輯
        this.scheduleReconnect();
        
        return Promise.reject(err);
      });

    return this.connectionPromise;
  }
  
  /**
   * 計劃重新連接
   */
  private scheduleReconnect(): void {
    // 清除任何現有的重連計時器
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    
    // 根據重連嘗試次數計算延遲
    const reconnectAttempts = chatState.getState<number>('connection.reconnectAttempts');
    const maxRetryDelayMs = 30000; // 最大重連延遲 30 秒
    const delayMs = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxRetryDelayMs);
    
    console.log(`安排重新連接：嘗試 ${reconnectAttempts}，延遲 ${delayMs}ms`);
    
    // 設置重連計時器
    this.reconnectTimer = window.setTimeout(() => {
      console.log('正在嘗試重新連接...');
      this.start().catch(err => {
        console.error('重新連接失敗:', err);
        // 重連失敗時增加嘗試次數
        chatState.updateState('connection.reconnectAttempts', reconnectAttempts + 1);
      });
    }, delayMs);
  }
  
  /**
   * 開始發送心跳包
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
    }
    
    // 每30秒發送一次心跳包
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendPing();
      }
    }, 30000);
  }
  
  /**
   * 發送 ping 來測量連接延遲
   */
  private sendPing(): void {
    if (!this.isConnected) return;
    
    this.pingStartTime = Date.now();
    
    // 替代方案：使用 echo 消息來測量延遲
    // 發送一個空的 echo 消息並計算時間差
    this.connection.invoke('ping')
      .then(() => {
        if (this.pingStartTime !== null) {
          const pingTime = Date.now() - this.pingStartTime;
          // 更新連接延遲
          chatState.updateState('connection.ping', pingTime);
          this.pingStartTime = null;
        }
      })
      .catch(err => {
        console.error('Ping 錯誤:', err);
        this.pingStartTime = null;
      });
  }

  /**
   * 停止連接
   */
  async stop(): Promise<void> {
    // 清除心跳和重連計時器
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.typingTimeout !== null) {
      window.clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    if (this.connection) {
      // 更新狀態為正在斷開連接
      chatState.updateConnectionState(false, true);
      
      await this.connection.stop();
      
      // 更新狀態為已斷開連接
      chatState.updateConnectionState(false, false);
      this.connectionPromise = null;
    }
  }

  /**
   * 調用Hub方法（帶類型安全）
   * @param methodName 方法名稱
   * @param args 方法參數
   * @returns Promise
   */
  invoke<T = void>(methodName: keyof IChatHub, ...args: any[]): Promise<T> {
    if (!this.isConnected) {
      return Promise.reject(new Error('SignalR尚未連接'));
    }

    // 將方法名轉換為CamelCase (與C#方法名匹配)
    const camelCaseMethod = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    
    return this.connection.invoke<T>(camelCaseMethod, ...args);
  }

  /**
   * 發送一般消息
   * @param message 消息內容
   */
  async sendMessage(message: string): Promise<void> {
    if (!message.trim()) return;
    
    const username = this.currentUsername;
    const groupName = this.activeGroup;
    
    // 創建消息對象
    const chatMessage: ChatMessage = {
      user: username,
      message: message,
      timestamp: new Date(),
      groupName: groupName,
    };
    
    // 將消息加入待發送列表
    chatState.addPendingMessage(chatMessage);
    
    try {
      if (groupName === 'General') {
        await this.invoke('sendMessage', username, message);
      } else {
        await this.invoke('sendGroupMessage', username, groupName, message);
      }
      
      // 發送成功，從待發送列表中移除
      chatState.removePendingMessage(chatMessage.timestamp.toString());
      
      // 重置用戶正在輸入狀態
      this.sendTypingStatus(false);
    } catch (err) {
      console.error('發送消息時出錯:', err);
      
      // 標記消息為失敗
      chatState.markMessageAsFailed(chatMessage);
      
      throw err;
    }
  }

  /**
   * 加入一個群組
   * @param groupName 群組名稱
   */
  async joinGroup(groupName: string): Promise<void> {
    try {
      await this.invoke('joinGroup', groupName);
    } catch (err) {
      console.error(`加入群組 ${groupName} 時出錯:`, err);
      throw err;
    }
  }

  /**
   * 離開一個群組
   * @param groupName 群組名稱
   */
  async leaveGroup(groupName: string): Promise<void> {
    if (groupName === 'General') {
      return; // 不能離開General群組
    }
    
    try {
      await this.invoke('leaveGroup', groupName);
    } catch (err) {
      console.error(`離開群組 ${groupName} 時出錯:`, err);
      throw err;
    }
  }

  /**
   * 獲取可用群組
   */
  async getAvailableGroups(): Promise<void> {
    try {
      await this.invoke('getAvailableGroups');
    } catch (err) {
      console.error('獲取可用群組列表時出錯:', err);
      throw err;
    }
  }
  
  /**
   * 發送用戶正在輸入狀態
   * @param isTyping 是否正在輸入
   */
  sendTypingStatus(isTyping: boolean): void {
    // 更新本地狀態
    chatState.updateUserTyping(isTyping);
    
    // 清除之前的計時器
    if (this.typingTimeout !== null) {
      window.clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    // 如果是正在輸入狀態，設置5秒後自動清除
    if (isTyping) {
      this.typingTimeout = window.setTimeout(() => {
        chatState.updateUserTyping(false);
      }, 5000);
    }
    
    // 向服務器發送狀態（如果服務器支持）
    if (this.isConnected) {
      try {
        this.connection.invoke('UserTyping', this.currentUsername, this.activeGroup, isTyping)
          .catch(err => {
            console.error('發送輸入狀態時出錯:', err);
          });
      } catch (error) {
        // 忽略錯誤，因為服務器可能不支持此功能
      }
    }
  }
  
  /**
   * 重新發送失敗的消息
   * @param messageId 消息ID
   */
  async resendFailedMessage(messageId: string): Promise<void> {
    const failedMessages = chatState.getState<ChatMessage[]>('messages.failedMessages');
    const messageToResend = failedMessages.find(m => m.timestamp.toString() === messageId);
    
    if (!messageToResend) {
      return;
    }
    
    // 從失敗列表中移除
    chatState.updateState('messages.failedMessages', 
      failedMessages.filter(m => m.timestamp.toString() !== messageId));
    
    // 重新添加到待發送列表
    chatState.addPendingMessage(messageToResend);
    
    try {
      const { user, message, groupName } = messageToResend;
      
      if (groupName === 'General' || !groupName) {
        await this.invoke('sendMessage', user, message);
      } else {
        await this.invoke('sendGroupMessage', user, groupName, message);
      }
      
      // 發送成功，從待發送列表中移除
      chatState.removePendingMessage(messageId);
    } catch (err) {
      console.error('重新發送消息時出錯:', err);
      
      // 重新標記為失敗
      chatState.markMessageAsFailed(messageToResend);
      
      throw err;
    }
  }

  /**
   * 添加客戶端方法處理器
   * @param event 事件名稱
   * @param callback 回調函數
   */
  on<K extends keyof IChatClient>(
    event: K, 
    callback: (...args: Parameters<IChatClient[K]>) => void
  ): void {
    // 將事件名轉換為CamelCase (與C#方法名匹配)
    const camelCaseEvent = event.charAt(0).toLowerCase() + event.slice(1);
    
    this.connection.on(camelCaseEvent, callback);
  }
  
  /**
   * 設置連接事件處理器
   */
  private setupConnectionHandlers(): void {
    // 連接關閉處理
    this.connection.onclose(error => {
      console.log('連接已關閉', error);
      chatState.updateConnectionState(false, false, error?.toString());
      this.connectionPromise = null;
      
      // 如果不是手動停止，嘗試重新連接
      if (error) {
        this.scheduleReconnect();
      }
    });
    
    // 重連事件處理
    this.connection.onreconnecting(error => {
      console.log('正在重新連接...', error);
      chatState.updateConnectionState(false, true, error?.toString());
    });
    
    this.connection.onreconnected(connectionId => {
      console.log('已重新連接，ID:', connectionId);
      chatState.updateConnectionState(true, false);
      chatState.updateState('user.id', connectionId);
      
      // 重新註冊用戶名
      const username = this.currentUsername;
      if (username) {
        this.invoke('registerUsername', username).catch(err => {
          console.error('重新連接後註冊用戶名失敗:', err);
        });
      }
    });
  }

  /**
   * 設置默認的客戶端方法處理
   */
  protected setupClientMethods(): void {
    // 接收一般消息
    this.on('receiveMessage', (user, message) => {
      // 添加消息到聊天狀態
      chatState.addMessage({
        user,
        message,
        timestamp: new Date(),
        groupName: 'General'
      });
      
      // 如果不是自己發送的消息，且窗口沒有焦點，顯示通知
      if (user !== this.currentUsername && !chatState.getState<boolean>('system.windowFocused')) {
        chatState.showNotification(`來自 ${user} 的新消息`, {
          body: message,
          icon: '/favicon.ico'
        });
      }
    });
    
    // 接收群組消息
    this.on('receiveGroupMessage', (user, groupName, message) => {
      // 添加消息到聊天狀態
      chatState.addMessage({
        user,
        message,
        timestamp: new Date(),
        groupName
      }, groupName);
      
      // 如果不是自己發送的消息，不是當前活動群組，且窗口沒有焦點，顯示通知
      if (user !== this.currentUsername && 
          (groupName !== this.activeGroup || !chatState.getState<boolean>('system.windowFocused'))) {
        chatState.showNotification(`來自 ${groupName} 群組的新消息`, {
          body: `${user}: ${message}`,
          icon: '/favicon.ico'
        });
      }
    });
    
    // 用戶連接事件
    this.on('userConnected', (username) => {
      // 將用戶加入事件添加為系統消息到所有群組
      this.userGroups.forEach(group => {
        chatState.addMessage({
          user: 'System',
          message: `${username} 已加入聊天室`,
          timestamp: new Date(),
          groupName: group.name,
          isSystem: true
        }, group.name);
      });
    });
    
    // 用戶斷開連接事件
    this.on('userDisconnected', (username) => {
      // 將用戶離開事件添加為系統消息到所有群組
      this.userGroups.forEach(group => {
        chatState.addMessage({
          user: 'System',
          message: `${username} 已離開聊天室`,
          timestamp: new Date(),
          groupName: group.name,
          isSystem: true
        }, group.name);
      });
    });
    
    // 更新用戶列表
    this.on('updateUserList', (users) => {
      // 存儲在狀態中，UI可以從那裡獲取
      chatState.updateState('system.onlineUsers', users);
    });
    
    // 更新用戶群組列表
    this.on('updateUserGroups', (groups) => {
      groups.forEach(group => {
        // 確保群組存在於狀態中
        chatState.addGroup(group);
      });
      
      // 更新用戶的群組列表
      chatState.updateState('user.groups', groups);
    });
    
    // 可用群組列表
    this.on('availableGroups', (groups) => {
      chatState.updateState('system.availableGroups', groups);
    });
    
    // 加入群組事件
    this.on('joinedGroup', (groupName) => {
      // 查找群組描述（如果可用）
      const availableGroups = chatState.getState<GroupInfo[]>('system.availableGroups') || [];
      const groupInfo = availableGroups.find(g => g.name === groupName) || 
                       { name: groupName, description: `${groupName} 群組` };
      
      // 添加群組到用戶的群組列表
      chatState.addGroup(groupInfo);
      
      // 添加系統消息到群組
      chatState.addMessage({
        user: 'System',
        message: `您已加入 ${groupName} 群組`,
        timestamp: new Date(),
        groupName,
        isSystem: true
      }, groupName);
      
      // 設置為活動群組（如果不是 General）
      if (groupName !== 'General') {
        chatState.setActiveGroup(groupName);
      }
    });
    
    // 離開群組事件
    this.on('leftGroup', (groupName) => {
      // 從用戶的群組列表中移除群組
      chatState.removeGroup(groupName);
      
      // 如果當前活動群組是被離開的群組，切換到 General
      if (this.activeGroup === groupName) {
        chatState.setActiveGroup('General');
      }
    });
    
    // 用戶加入群組事件
    this.on('userJoinedGroup', (username, groupName) => {
      // 添加系統消息到群組
      chatState.addMessage({
        user: 'System',
        message: `${username} 已加入群組`,
        timestamp: new Date(),
        groupName,
        isSystem: true
      }, groupName);
    });
    
    // 用戶離開群組事件
    this.on('userLeftGroup', (username, groupName) => {
      // 添加系統消息到群組
      chatState.addMessage({
        user: 'System',
        message: `${username} 已離開群組`,
        timestamp: new Date(),
        groupName,
        isSystem: true
      }, groupName);
    });
    
    // 用戶在群組中改名事件
    this.on('userRenamedInGroup', (oldUsername, newUsername, groupName) => {
      // 添加系統消息到群組
      chatState.addMessage({
        user: 'System',
        message: `用戶 ${oldUsername} 已更改名稱為 ${newUsername}`,
        timestamp: new Date(),
        groupName,
        isSystem: true
      }, groupName);
    });
    
    // 群組錯誤事件
    this.on('groupError', (errorMessage) => {
      console.error('群組錯誤:', errorMessage);
      
      // 將錯誤消息加入系統通知
      chatState.showNotification('群組錯誤', {
        body: errorMessage,
        icon: '/favicon.ico'
      });
    });
    
    // 用戶正在輸入事件（如果服務器支持）
    try {
      this.connection.on('userTyping', (username, groupName, isTyping) => {
        if (username !== this.currentUsername) {
          chatState.updateState(`typing.${groupName}.${username}`, isTyping ? new Date() : null);
        }
      });
    } catch (error) {
      // 忽略錯誤，因為服務器可能不支持此功能
    }
  }
}

// 提供一個全局SignalR連接實例
export const chatConnection = new ChatHubConnection();