/**
 * 聊天應用程序主邏輯
 * 使用模塊模式封裝功能，明確定義依賴關係
 */
(function ChatApp() {
    // 私有變量，保存依賴引用
    let chatConnectionInstance = null;
    let domManagerInstance = null;
    let chatStateInstance = null;
    
    /**
     * 初始化應用程序
     * @param {Object} dependencies - 依賴對象
     */
    function initialize(dependencies) {
      // 獲取依賴
      chatConnectionInstance = dependencies.chatConnection;
      domManagerInstance = dependencies.domManager;
      chatStateInstance = dependencies.chatState;
      
      if (!chatConnectionInstance || !domManagerInstance || !chatStateInstance) {
        console.error('初始化聊天應用失敗: 缺少必要依賴');
        return;
      }
      
      console.log('初始化聊天應用...');
      
      // 初始化 DOM 管理器
      domManagerInstance.initialize();
      
      // 綁定事件處理器
      bindEventHandlers();
      
      // 初始化設置界面的狀態
      initSettingsUI();
      
      // 添加輸入事件來處理輸入狀態
      setupInputEvents();
      
      // 設置狀態監聽器
      setupStateListeners();
      
      // 開始連接
      startConnection();
    }
    
    /**
     * 綁定事件處理器
     */
    function bindEventHandlers() {
      domManagerInstance.bindEventHandlers({
        // 發送消息
        onSend: () => {
          const messageInput = domManagerInstance.get('messageInput');
          const message = messageInput.value.trim();
          
          if (message) {
            chatConnectionInstance.sendMessage(message)
              .then(() => {
                messageInput.value = '';
                messageInput.focus();
              })
              .catch(err => {
                console.error('發送消息失敗:', err);
              });
          }
        },
        
        // 更改用戶名
        onUsernameChange: (newUsername) => {
          if (newUsername) {
            const oldUsername = chatStateInstance.getState('user.username');
            
            // 顯示用戶名變更消息（如果有變化）
            if (oldUsername && oldUsername !== newUsername) {
              domManagerInstance.showSystemMessage(
                `您已將用戶名從 "${oldUsername}" 更改為 "${newUsername}"`,
                'General'
              );
            }
            
            chatConnectionInstance.registerUsername(newUsername);
          }
        },
        
        // 顯示群組列表
        onShowGroups: () => {
          chatConnectionInstance.getAvailableGroups();
        },
        
        // 重新連接
        onReconnect: () => {
          chatConnectionInstance.stop()
            .then(() => chatConnectionInstance.start())
            .catch(err => {
              console.error('重新連接失敗:', err);
            });
        },
        
        // 切換夜間模式
        onDarkModeToggle: (enabled) => {
          chatStateInstance.toggleDarkMode(enabled);
        },
        
        // 調整字體大小
        onFontSizeChange: (size) => {
          chatStateInstance.setFontSize(size);
        },
        
        // 切換通知
        onNotificationsToggle: (enabled) => {
          if (enabled) {
            chatStateInstance.requestNotificationPermission();
          } else {
            chatStateInstance.updateState('system.notificationsEnabled', false);
          }
        },
        
        // 切換聲音通知
        onSoundToggle: (enabled) => {
          chatStateInstance.toggleSoundNotifications(enabled);
        }
      });
    }
    
    /**
     * 初始化設置界面的狀態
     */
    function initSettingsUI() {
      const darkModeToggle = domManagerInstance.get('darkModeToggle');
      const fontSizeRange = domManagerInstance.get('fontSizeRange');
      const notificationsToggle = domManagerInstance.get('notificationsToggle');
      const soundToggle = domManagerInstance.get('soundToggle');
      
      if (darkModeToggle) {
        darkModeToggle.checked = chatStateInstance.getState('system.darkMode');
      }
      
      if (fontSizeRange) {
        fontSizeRange.value = chatStateInstance.getState('system.fontSize');
      }
      
      if (notificationsToggle) {
        notificationsToggle.checked = chatStateInstance.getState('system.notificationsEnabled');
      }
      
      if (soundToggle) {
        soundToggle.checked = chatStateInstance.getState('system.soundEnabled');
      }
    }
    
    /**
     * 設置輸入事件
     */
    function setupInputEvents() {
      const messageInput = domManagerInstance.get('messageInput');
      if (messageInput) {
        let typingTimeout = null;
        
        messageInput.addEventListener('input', () => {
          // 如果用戶開始輸入，發送正在輸入狀態
          if (!chatStateInstance.getState('user.isTyping')) {
            chatConnectionInstance.sendTypingStatus(true);
          }
          
          // 清除之前的計時器
          if (typingTimeout) {
            clearTimeout(typingTimeout);
          }
          
          // 設置新的計時器，在停止輸入後 3 秒清除輸入狀態
          typingTimeout = setTimeout(() => {
            chatConnectionInstance.sendTypingStatus(false);
            typingTimeout = null;
          }, 3000);
        });
      }
    }
    
    /**
     * 更新失敗消息計數的顯示
     */
    function updateFailedMessagesUI() {
      const failedMessagesBtn = domManagerInstance.get('failedMessagesBtn');
      const failedMessagesCount = domManagerInstance.get('failedMessagesCount');
      const failedMessagesList = domManagerInstance.get('failedMessagesList');
      
      const failedMessages = chatStateInstance.getState('messages.failedMessages');
      
      if (failedMessagesBtn && failedMessagesCount) {
        if (failedMessages.length > 0) {
          failedMessagesBtn.style.display = 'flex';
          failedMessagesCount.textContent = failedMessages.length.toString();
        } else {
          failedMessagesBtn.style.display = 'none';
        }
      }
      
      if (failedMessagesList) {
        failedMessagesList.innerHTML = '';
        
        failedMessages.forEach(message => {
          const li = document.createElement('li');
          li.className = 'failed-message-item';
          
          const header = document.createElement('div');
          header.className = 'failed-message-header';
          header.innerHTML = `
            <span>發送時間: ${message.timestamp.toLocaleTimeString()}</span>
            <span class="failed-message-group">${message.groupName || 'General'}</span>
          `;
          
          const content = document.createElement('div');
          content.className = 'failed-message-content';
          content.innerHTML = `
            <div class="failed-message-text">${message.message}</div>
          `;
          
          const actions = document.createElement('div');
          actions.className = 'failed-message-actions';
          
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn btn-sm btn-primary';
          retryBtn.innerHTML = '<i class="fas fa-sync"></i> 重試';
          retryBtn.addEventListener('click', () => {
            chatConnectionInstance.resendFailedMessage(message.timestamp.toString())
              .catch(err => {
                console.error('重新發送消息失敗:', err);
              });
          });
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-sm btn-secondary';
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 刪除';
          deleteBtn.addEventListener('click', () => {
            const failedMessages = chatStateInstance.getState('messages.failedMessages');
            chatStateInstance.updateState('messages.failedMessages', 
              failedMessages.filter(m => m.timestamp.toString() !== message.timestamp.toString()));
          });
          
          actions.appendChild(retryBtn);
          actions.appendChild(deleteBtn);
          
          li.appendChild(header);
          li.appendChild(content);
          li.appendChild(actions);
          
          failedMessagesList.appendChild(li);
        });
      }
    }
    
    /**
     * 設置狀態監聽器
     */
    function setupStateListeners() {
      // 監聽失敗消息的變化
      chatStateInstance.addListener('messages.failedMessages', updateFailedMessagesUI);
      
      // 監聽連接狀態變化來更新 UI
      chatStateInstance.addListener('connection', state => {
        domManagerInstance.updateConnectionStatus(
          state.isConnected, 
          state.isConnecting, 
          state.lastError
        );
        
        domManagerInstance.updateReconnectAttempts(state.reconnectAttempts);
        
        if (state.ping !== null) {
          domManagerInstance.updateConnectionPing(state.ping);
        }
      });
      
      // 監聽活動群組變化
      chatStateInstance.addListener('user.activeGroup', (groupName) => {
        // 同步 DOM 元素狀態
        domManagerInstance.switchActiveGroup(groupName);
      });
    }
    
    /**
     * 開始連接
     */
    function startConnection() {
      chatConnectionInstance.start()
        .then(() => {
          console.log('SignalR 連接已建立');
          
          // 從 localStorage 讀取用戶名，如果沒有則提示輸入
          let username = chatStateInstance.getState('user.username');
          if (!username) {
            username = prompt("請輸入您的用戶名:", "用戶" + Math.floor(Math.random() * 1000));
            if (!username) {
              username = "用戶" + Math.floor(Math.random() * 1000);
            }
          }
          
          // 確保 userInput 顯示正確的用戶名
          const userInput = domManagerInstance.get('userInput');
          if (userInput) {
            userInput.value = username;
          }
          
          // 註冊用戶名並顯示歡迎訊息
          chatConnectionInstance.registerUsername(username)
            .then(() => {
              domManagerInstance.showSystemMessage(`歡迎來到聊天室，${username}！`, 'General');
            });
          
          // 初始化設置界面
          initSettingsUI();
        })
        .catch(err => {
          console.error('連接到 SignalR 失敗:', err);
        });
      
      // 初始化群組相關邏輯
      domManagerInstance.createGroupTab('General', () => {});
      domManagerInstance.switchActiveGroup('General');
    }
    
    // 當 DOM 加載完成時初始化應用
    document.addEventListener('DOMContentLoaded', function() {
      // 檢查依賴是否已加載
      if (typeof chatConnection !== 'undefined' && 
          typeof domManager !== 'undefined' && 
          typeof chatState !== 'undefined') {
        // 使用已定義的全局實例作為依賴
        initialize({
          chatConnection: chatConnection, 
          domManager: domManager,
          chatState: chatState
        });
      } else {
        console.error('無法初始化聊天應用: 缺少必要全局依賴');
      }
    });
    
    // 暴露公共 API (如果需要)
    window.ChatApp = {
      initialize: initialize
    };
  })();