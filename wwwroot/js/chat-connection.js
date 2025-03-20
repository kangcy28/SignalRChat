/**
 * SignalR 聊天連接管理器
 * 封裝與服務器的連接並實現類型安全的方法調用
 */
class ChatConnection {
    /**
     * SignalR 連接對象
     * @type {signalR.HubConnection}
     */
    connection = null;
    
    /**
     * 連接 Promise
     * @type {Promise<void>|null}
     */
    connectionPromise = null;
    
    /**
     * 重連計時器
     * @type {number|null}
     */
    reconnectTimer = null;
    
    /**
     * 心跳包計時器
     * @type {number|null}
     */
    heartbeatInterval = null;
    
    /**
     * 輸入狀態計時器
     * @type {number|null}
     */
    typingTimeout = null;
    
    /**
     * Ping 開始時間
     * @type {number|null}
     */
    pingStartTime = null;
    
    /**
     * DOM 管理器
     * @type {DOMManager}
     */
    domManager = null;
    
    /**
     * 創建聊天連接管理器
     * @param {string} url - Hub URL，預設為"/chatHub"
     * @param {DOMManager} domManager - DOM 管理器
     */
    constructor(url = "/chatHub", domManager) {
      this.domManager = domManager;
      
      // 建立 SignalR 連接
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(url)
        .configureLogging(signalR.LogLevel.Information)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: retryContext => {
            // 實現指數退避重連策略
            const maxRetryDelayMs = 30000; // 最大重連延遲 30 秒
            // 根據重連嘗試次數計算延遲
            const reconnectAttempts = chatState.getState('connection.reconnectAttempts');
            const delayMs = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxRetryDelayMs);
            
            console.log(`正在嘗試重新連接，嘗試次數: ${reconnectAttempts}，延遲: ${delayMs}ms`);
            
            return delayMs;
          }
        })
        .build();
      
      // 設置連接處理程序
      this.setupConnectionHandlers();
      
      // 設置客戶端方法
      this.setupClientMethods();
      
      // 向全局作用域公開活動群組
      window.activeGroup = "General";
    }
    
    /**
     * 啟動連接
     * @returns {Promise<void>} 連接 Promise
     */
    start() {
      if (this.connectionPromise) {
        return this.connectionPromise;
      }
      
      // 更新連接狀態
      chatState.updateConnectionState(false, true);
      this.domManager.updateConnectionStatus(false, true);
      
      this.connectionPromise = this.connection.start()
        .then(() => {
          console.log('SignalR 連接已建立');
          
          // 更新連接狀態
          chatState.updateConnectionState(true, false);
          this.domManager.updateConnectionStatus(true);
          
          // 開始發送心跳包
          this.startHeartbeat();
          
          // 註冊已經保存的用戶名
          const username = chatState.getState('user.username');
          if (username) {
            return this.registerUsername(username).then(() => {
              // 註冊成功後獲取可用群組列表
              return this.getAvailableGroups();
            });
          }
        })
        .catch(err => {
          console.error('SignalR 連接失敗:', err);
          chatState.updateConnectionState(false, false, err.toString());
          this.domManager.updateConnectionStatus(false, false, err.toString());
          this.connectionPromise = null;
          
          // 實現自定義重連邏輯
          this.scheduleReconnect();
          
          return Promise.reject(err);
        });
      
      return this.connectionPromise;
    }
    
    /**
     * 停止連接
     * @returns {Promise<void>} 停止連接的 Promise
     */
    async stop() {
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
        this.domManager.updateConnectionStatus(false, true);
        
        await this.connection.stop();
        
        // 更新狀態為已斷開連接
        chatState.updateConnectionState(false, false);
        this.domManager.updateConnectionStatus(false, false);
        this.connectionPromise = null;
      }
    }
    
    /**
     * 計劃重新連接
     */
    scheduleReconnect() {
      // 清除任何現有的重連計時器
      if (this.reconnectTimer !== null) {
        window.clearTimeout(this.reconnectTimer);
      }
      
      // 根據重連嘗試次數計算延遲
      const reconnectAttempts = chatState.getState('connection.reconnectAttempts');
      const maxRetryDelayMs = 30000; // 最大重連延遲 30 秒
      const delayMs = Math.min(Math.pow(2, reconnectAttempts) * 1000, maxRetryDelayMs);
      
      console.log(`安排重新連接：嘗試 ${reconnectAttempts}，延遲 ${delayMs}ms`);
      
      // 更新 UI 顯示
      this.domManager.updateReconnectAttempts(reconnectAttempts);
      
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
    startHeartbeat() {
      if (this.heartbeatInterval !== null) {
        window.clearInterval(this.heartbeatInterval);
      }
      
      // 每30秒發送一次心跳包
      this.heartbeatInterval = window.setInterval(() => {
        if (chatState.getState('connection.isConnected')) {
          this.sendPing();
        }
      }, 30000);
    }
    
    /**
     * 發送 ping 來測量連接延遲
     */
    sendPing() {
      if (!chatState.getState('connection.isConnected')) return;
      
      this.pingStartTime = Date.now();
      
      // 發送 ping
      this.connection.invoke('Echo')
        .then(() => {
          if (this.pingStartTime !== null) {
            const pingTime = Date.now() - this.pingStartTime;
            // 更新連接延遲
            chatState.updateState('connection.ping', pingTime);
            this.domManager.updateConnectionPing(pingTime);
            this.pingStartTime = null;
          }
        })
        .catch(err => {
          console.error('Ping 錯誤:', err);
          this.pingStartTime = null;
        });
    }
    
    /**
     * 調用Hub方法
     * @param {string} methodName - 方法名稱
     * @param  {...any} args - 方法參數
     * @returns {Promise<any>} 調用結果
     */
    invoke(methodName, ...args) {
      if (!chatState.getState('connection.isConnected')) {
        return Promise.reject(new Error('SignalR尚未連接'));
      }
      
      return this.connection.invoke(methodName, ...args);
    }
    
    /**
     * 註冊用戶名
     * @param {string} username - 用戶名
     * @returns {Promise<void>} 註冊 Promise
     */
    registerUsername(username) {
      if (!username.trim()) return Promise.resolve();
      
      const oldUsername = chatState.getState('user.username');
      
      // 更新狀態
      chatState.updateState('user.username', username);
      
      // 儲存到 localStorage
      localStorage.setItem('chatUsername', username);
      
      if (chatState.getState('connection.isConnected')) {
        return this.invoke('RegisterUsername', username)
          .then(() => {
            // 添加系統消息，通知用戶名變更
            if (oldUsername && oldUsername !== username) {
              this.domManager.showSystemMessage(
                `您已將用戶名從 "${oldUsername}" 更改為 "${username}"`,
                'General'
              );
            }
          })
          .catch(err => {
            console.error('註冊用戶名時出錯:', err);
            throw err;
          });
      }
      
      return Promise.resolve();
    }
    
    /**
     * 發送一般消息
     * @param {string} message - 消息內容
     * @returns {Promise<void>} 發送 Promise
     */
    sendMessage(message) {
        if (!message.trim()) return Promise.resolve();
        
        // 從狀態管理器獲取當前活動群組，而不是依賴全局變量
        const username = chatState.getState('user.username');
        const groupName = chatState.getState('user.activeGroup');
        
        console.log(`正在向群組 ${groupName} 發送消息`); // 添加調試日誌
        
        // 創建消息對象
        const chatMessage = {
          user: username,
          message: message,
          timestamp: new Date(),
          groupName: groupName,
        };
        
        // 將消息加入待發送列表
        chatState.addPendingMessage(chatMessage);
        
        try {
          let invokePromise;
          
          if (groupName === 'General') {
            invokePromise = this.invoke('SendMessage', username, message);
          } else {
            invokePromise = this.invoke('SendGroupMessage', username, groupName, message);
          }
          
          return invokePromise
            .then(() => {
              // 發送成功，從待發送列表中移除
              chatState.removePendingMessage(chatMessage.timestamp.toString());
              
              // 重置用戶正在輸入狀態
              this.sendTypingStatus(false);
            })
            .catch(err => {
              console.error('發送消息時出錯:', err);
              
              // 標記消息為失敗
              chatState.markMessageAsFailed(chatMessage);
              
              throw err;
            });
        } catch (err) {
          console.error('準備發送消息時出錯:', err);
          
          // 標記消息為失敗
          chatState.markMessageAsFailed(chatMessage);
          
          return Promise.reject(err);
        }
      }
    
    /**
     * 加入群組
     * @param {string} groupName - 群組名稱
     * @returns {Promise<void>} 加入群組 Promise
     */
    joinGroup(groupName) {
      return this.invoke('JoinGroup', groupName)
        .catch(err => {
          console.error(`加入群組 ${groupName} 時出錯:`, err);
          throw err;
        });
    }
    
    /**
     * 離開群組
     * @param {string} groupName - 群組名稱
     * @returns {Promise<void>} 離開群組 Promise
     */
    leaveGroup(groupName) {
      if (groupName === 'General') {
        return Promise.resolve(); // 不能離開 General 群組
      }
      
      return this.invoke('LeaveGroup', groupName)
        .catch(err => {
          console.error(`離開群組 ${groupName} 時出錯:`, err);
          throw err;
        });
    }
    
    /**
     * 獲取可用群組
     * @returns {Promise<void>} 獲取群組 Promise
     */
    getAvailableGroups() {
      return this.invoke('GetAvailableGroups')
        .catch(err => {
          console.error('獲取可用群組列表時出錯:', err);
          throw err;
        });
    }
    
    /**
     * 發送用戶正在輸入狀態
     * @param {boolean} isTyping - 是否正在輸入
     */
    sendTypingStatus(isTyping) {
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
      if (chatState.getState('connection.isConnected')) {
        try {
          this.connection.invoke('UserTyping', 
            chatState.getState('user.username'), 
            chatState.getState('user.activeGroup'), 
            isTyping)
            .catch(err => {
              console.log('發送輸入狀態時出錯 (可能是服務器不支持此功能)');
            });
        } catch (error) {
          // 忽略錯誤，因為服務器可能不支持此功能
        }
      }
    }
    
    /**
     * 重新發送失敗的消息
     * @param {string} messageId - 消息 ID (時間戳)
     * @returns {Promise<void>} 重新發送 Promise
     */
    resendFailedMessage(messageId) {
      const failedMessages = chatState.getState('messages.failedMessages');
      const messageToResend = failedMessages.find(m => m.timestamp.toString() === messageId);
      
      if (!messageToResend) {
        return Promise.resolve();
      }
      
      // 從失敗列表中移除
      chatState.updateState('messages.failedMessages', 
        failedMessages.filter(m => m.timestamp.toString() !== messageId));
      
      // 重新添加到待發送列表
      chatState.addPendingMessage(messageToResend);
      
      try {
        const { user, message, groupName } = messageToResend;
        
        let invokePromise;
        
        if (groupName === 'General' || !groupName) {
          invokePromise = this.invoke('SendMessage', user, message);
        } else {
          invokePromise = this.invoke('SendGroupMessage', user, groupName, message);
        }
        
        return invokePromise
          .then(() => {
            // 發送成功，從待發送列表中移除
            chatState.removePendingMessage(messageId);
          })
          .catch(err => {
            console.error('重新發送消息時出錯:', err);
            
            // 重新標記為失敗
            chatState.markMessageAsFailed(messageToResend);
            
            throw err;
          });
      } catch (err) {
        console.error('準備重新發送消息時出錯:', err);
        
        // 重新標記為失敗
        chatState.markMessageAsFailed(messageToResend);
        
        return Promise.reject(err);
      }
    }
    
    /**
     * 設置連接事件處理器
     */
    setupConnectionHandlers() {
      // 連接關閉處理
      this.connection.onclose(error => {
        console.log('連接已關閉', error);
        chatState.updateConnectionState(false, false, error?.toString());
        this.domManager.updateConnectionStatus(false, false, error?.toString());
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
        this.domManager.updateConnectionStatus(false, true, error?.toString());
      });
      
      this.connection.onreconnected(connectionId => {
        console.log('已重新連接，ID:', connectionId);
        chatState.updateConnectionState(true, false);
        this.domManager.updateConnectionStatus(true);
        chatState.updateState('user.id', connectionId);
        
        // 重新註冊用戶名
        const username = chatState.getState('user.username');
        if (username) {
          this.registerUsername(username).catch(err => {
            console.error('重新連接後註冊用戶名失敗:', err);
          });
        }
      });
    }
    
    /**
     * 設置客戶端方法
     */
    setupClientMethods() {
      // 接收一般消息
      this.connection.on('ReceiveMessage', (user, message) => {
        // 添加消息到聊天狀態
        chatState.addMessage({
          user,
          message,
          timestamp: new Date(),
          groupName: 'General'
        });
        
        // 更新 UI
        this.domManager.showMessage(
          user, 
          message, 
          'General', 
          chatState.getState('user.username')
        );
        
        // 如果不是自己發送的消息，且窗口沒有焦點，顯示通知
        if (user !== chatState.getState('user.username') && 
            !chatState.getState('system.windowFocused')) {
          chatState.showNotification(`來自 ${user} 的新消息`, {
            body: message,
            icon: '/favicon.ico'
          });
        }
      });
      
      // 接收群組消息
      this.connection.on('ReceiveGroupMessage', (user, groupName, message) => {
        // 添加消息到聊天狀態
        chatState.addMessage({
          user,
          message,
          timestamp: new Date(),
          groupName
        }, groupName);
        
        // 更新 UI
        this.domManager.showMessage(
          user, 
          message, 
          groupName, 
          chatState.getState('user.username')
        );
        
        // 如果不是自己發送的消息，不是當前活動群組，且窗口沒有焦點，顯示通知
        if (user !== chatState.getState('user.username') && 
            (groupName !== chatState.getState('user.activeGroup') || 
             !chatState.getState('system.windowFocused'))) {
          chatState.showNotification(`來自 ${groupName} 群組的新消息`, {
            body: `${user}: ${message}`,
            icon: '/favicon.ico'
          });
        }
      });
      
      // 用戶連接事件
      this.connection.on('UserConnected', (username) => {
        // 在所有已加入的群組中顯示用戶加入訊息
        chatState.getState('user.groups').forEach(group => {
          this.domManager.showSystemMessage(`${username} 已加入聊天室`, group.name);
        });
      });
      
      // 用戶斷開連接事件
      this.connection.on('UserDisconnected', (username) => {
        // 在所有已加入的群組中顯示用戶離開訊息
        chatState.getState('user.groups').forEach(group => {
          this.domManager.showSystemMessage(`${username} 已離開聊天室`, group.name);
        });
      });
      
      // 更新用戶列表
      this.connection.on('UpdateUserList', (users) => {
        // 更新狀態
        chatState.updateState('system.onlineUsers', users);
        
        // 更新 UI
        this.domManager.updateUserList(users, chatState.getState('user.username'));
      });
      
      // 更新用戶群組列表
      this.connection.on('UpdateUserGroups', (groups) => {
        // 確保所有群組都存在於狀態中
        groups.forEach(group => {
          chatState.addGroup(group);
        });
        
        // 更新狀態
        chatState.updateState('user.groups', groups);
        
        // 更新 UI
        this.domManager.updateUserGroupsList(
          groups, 
          chatState.getState('user.activeGroup'),
          groupName => this.leaveGroup(groupName),
          groupName => this.domManager.switchActiveGroup(groupName)
        );
      });
      
      // 可用群組列表
      this.connection.on('AvailableGroups', (groups) => {
        // 更新狀態
        chatState.updateState('system.availableGroups', groups);
        
        // 更新 UI
        this.domManager.updateAvailableGroupsList(
          groups,
          groupName => this.joinGroup(groupName),
          groupName => this.leaveGroup(groupName)
        );
        
        // 顯示群組對話框
        this.domManager.showGroupsModal();
      });
      
      // 加入群組事件
      this.connection.on('JoinedGroup', (groupName) => {
        // 查找群組描述（如果可用）
        const availableGroups = chatState.getState('system.availableGroups') || [];
        const groupInfo = availableGroups.find(g => g.name === groupName) || 
                        { name: groupName, description: `${groupName} 群組` };
        
        // 添加群組到用戶的群組列表
        chatState.addGroup(groupInfo);
        
        // 添加系統消息到群組
        this.domManager.showSystemMessage(`您已加入 ${groupName} 群組`, groupName);
        
        // 設置為活動群組（如果不是 General）
        if (groupName !== 'General') {
          chatState.setActiveGroup(groupName);
          this.domManager.switchActiveGroup(groupName);
        }
      });
      
      // 離開群組事件
      this.connection.on('LeftGroup', (groupName) => {
        // 從用戶的群組列表中移除群組
        chatState.removeGroup(groupName);
        
        // 移除 UI 元素
        const needSwitchToGeneral = this.domManager.removeGroupTab(
          groupName, 
          chatState.getState('user.activeGroup')
        );
        
        // 如果當前活動群組是被離開的群組，切換到 General
        if (needSwitchToGeneral) {
          chatState.setActiveGroup('General');
        }
      });
      
      // 用戶加入群組事件
      this.connection.on('UserJoinedGroup', (username, groupName) => {
        // 添加系統消息到群組
        this.domManager.showSystemMessage(`${username} 已加入群組`, groupName);
      });
      
      // 用戶離開群組事件
      this.connection.on('UserLeftGroup', (username, groupName) => {
        // 添加系統消息到群組
        this.domManager.showSystemMessage(`${username} 已離開群組`, groupName);
      });
      
      // 用戶在群組中改名事件
      this.connection.on('UserRenamedInGroup', (oldUsername, newUsername, groupName) => {
        // 添加系統消息到群組
        this.domManager.showSystemMessage(
          `用戶 ${oldUsername} 已更改名稱為 ${newUsername}`,
          groupName
        );
      });
      
      // 群組錯誤事件
      this.connection.on('GroupError', (errorMessage) => {
        console.error('群組錯誤:', errorMessage);
        
        // 顯示錯誤消息
        alert(errorMessage);
      });
      
      // 用戶正在輸入事件（如果服務器支持）
      try {
        this.connection.on('UserTyping', (username, groupName, isTyping) => {
          if (username !== chatState.getState('user.username')) {
            chatState.updateState(`typing.${groupName}.${username}`, isTyping ? new Date() : null);
            // 這裡可以添加 UI 更新來顯示誰在輸入
          }
        });
      } catch (error) {
        // 忽略錯誤，因為服務器可能不支持此功能
      }
    }
  }
  
  // 導出聊天連接實例
  const chatConnection = new ChatConnection("/chatHub", domManager);