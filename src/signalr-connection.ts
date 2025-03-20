import * as signalR from '@microsoft/signalr';
import { IChatHub, IChatClient, GroupInfo } from './interfaces';

/**
 * SignalR聊天連接管理器
 * 封裝與服務器的連接並實現類型安全的方法調用
 */
export class ChatHubConnection {
  private connection: signalR.HubConnection;
  private connectionPromise: Promise<void> | null = null;
  private _currentUsername: string = '';
  private _activeGroup: string = 'General';
  private _userGroups: GroupInfo[] = [];

  // 狀態存取器
  get currentUsername(): string { return this._currentUsername; }
  get activeGroup(): string { return this._activeGroup; }
  get userGroups(): GroupInfo[] { return this._userGroups; }
  get isConnected(): boolean { return this.connection?.state === signalR.HubConnectionState.Connected; }

  /**
   * 建立SignalR聊天連接管理器
   * @param url Hub URL，預設為"/chatHub"
   */
  constructor(url: string = '/chatHub') {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .configureLogging(signalR.LogLevel.Information)
      .withAutomaticReconnect([0, 1000, 5000, 10000])
      .build();
    
    this.setupClientMethods();
  }

  /**
   * 設置當前活動的群組
   * @param groupName 群組名稱
   */
  setActiveGroup(groupName: string): void {
    this._activeGroup = groupName;
  }

  /**
   * 設置用戶名並發送到服務器
   * @param username 新用戶名
   */
  async setUsername(username: string): Promise<void> {
    if (!username.trim()) return;
    
    const oldUsername = this._currentUsername;
    this._currentUsername = username;
    
    localStorage.setItem('chatUsername', username);
    
    if (this.isConnected) {
      try {
        await this.invoke('registerUsername', username);
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

    this.connectionPromise = this.connection.start()
      .then(() => {
        console.log('SignalR 連接已建立');
      })
      .catch(err => {
        console.error('SignalR 連接失敗:', err);
        this.connectionPromise = null;
        return Promise.reject(err);
      });

    return this.connectionPromise;
  }

  /**
   * 停止連接
   */
  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
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
    
    try {
      if (this._activeGroup === 'General') {
        await this.invoke('sendMessage', this._currentUsername, message);
      } else {
        await this.invoke('sendGroupMessage', this._currentUsername, this._activeGroup, message);
      }
    } catch (err) {
      console.error('發送消息時出錯:', err);
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
   * 設置默認的客戶端方法處理
   * 子類可以覆蓋這個方法以提供自定義實現
   */
  protected setupClientMethods(): void {
    // 更新用戶群組列表
    this.on('updateUserGroups', (groups: GroupInfo[]) => {
      this._userGroups = groups;
    });

    // 這裡可以添加其他默認事件處理，但通常UI相關處理應該在外部實現
  }
}

// 提供一個全局SignalR連接實例
export const chatConnection = new ChatHubConnection();