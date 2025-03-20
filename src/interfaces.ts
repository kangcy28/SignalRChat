/**
 * TypeScript interfaces for SignalR Chat application
 * Matching the C# strong-typed hub interfaces
 */

// ========================================
// Server methods (methods client can call)
// Matches C# IChatHub interface
// ========================================
export interface IChatHub {
    /**
     * 發送消息到所有連接的客戶端
     * @param user 發送消息的用戶名
     * @param message 消息內容
     */
    sendMessage(user: string, message: string): Promise<void>;
  
    /**
     * 發送消息到特定群組
     * @param user 發送消息的用戶名
     * @param groupName 目標群組名稱
     * @param message 消息內容
     */
    sendGroupMessage(user: string, groupName: string, message: string): Promise<void>;
  
    /**
     * 加入群組
     * @param groupName 要加入的群組名稱
     */
    joinGroup(groupName: string): Promise<void>;
  
    /**
     * 離開群組
     * @param groupName 要離開的群組名稱
     */
    leaveGroup(groupName: string): Promise<void>;
  
    /**
     * 獲取可用群組列表
     */
    getAvailableGroups(): Promise<void>;
  
    /**
     * 註冊用戶名
     * @param username 要註冊的用戶名
     */
    registerUsername(username: string): Promise<void>;
  }
  
  // ========================================
  // Client methods (methods server can call)
  // Matches C# IChatClient interface
  // ========================================
  export interface IChatClient {
    /**
     * 接收一般消息
     * @param user 發送消息的用戶名
     * @param message 消息內容
     */
    receiveMessage(user: string, message: string): void;
  
    /**
     * 接收群組消息
     * @param user 發送消息的用戶名
     * @param groupName 群組名稱
     * @param message 消息內容
     */
    receiveGroupMessage(user: string, groupName: string, message: string): void;
  
    /**
     * 通知用戶連接事件
     * @param username 用戶名
     */
    userConnected(username: string): void;
  
    /**
     * 通知用戶斷開連接事件
     * @param username 用戶名
     */
    userDisconnected(username: string): void;
  
    /**
     * 更新用戶列表
     * @param users 用戶名列表
     */
    updateUserList(users: string[]): void;
  
    /**
     * 更新用戶群組列表
     * @param groups 用戶所屬群組列表
     */
    updateUserGroups(groups: GroupInfo[]): void;
  
    /**
     * 返回可用群組列表
     * @param groups 群組資訊列表
     */
    availableGroups(groups: GroupInfo[]): void;
  
    /**
     * 通知已加入群組
     * @param groupName 群組名稱
     */
    joinedGroup(groupName: string): void;
  
    /**
     * 通知已離開群組
     * @param groupName 群組名稱
     */
    leftGroup(groupName: string): void;
  
    /**
     * 通知用戶加入群組
     * @param username 用戶名
     * @param groupName 群組名稱
     */
    userJoinedGroup(username: string, groupName: string): void;
  
    /**
     * 通知用戶離開群組
     * @param username 用戶名
     * @param groupName 群組名稱
     */
    userLeftGroup(username: string, groupName: string): void;
  
    /**
     * 通知用戶在群組中改名
     * @param oldUsername 舊用戶名
     * @param newUsername 新用戶名
     * @param groupName 群組名稱
     */
    userRenamedInGroup(oldUsername: string, newUsername: string, groupName: string): void;
  
    /**
     * 發送群組錯誤信息
     * @param errorMessage 錯誤信息
     */
    groupError(errorMessage: string): void;
  }
  
  // ========================================
  // Supporting types
  // ========================================
  
  /**
   * 群組信息介面
   */
  export interface GroupInfo {
    /** 群組名稱 */
    name: string;
    /** 群組描述 */
    description: string;
    /** 用戶是否已加入該群組 (可選，用於可用群組列表) */
    isJoined?: boolean;
  }
  
  /**
   * 消息介面
   */
  export interface ChatMessage {
    /** 發送者用戶名 */
    user: string;
    /** 消息內容 */
    message: string;
    /** 發送時間 */
    timestamp: Date;
    /** 群組名稱 (如果是群組消息) */
    groupName?: string;
    /** 是否是系統消息 */
    isSystem?: boolean;
  }