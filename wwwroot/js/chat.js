/**
 * 聊天應用程序主邏輯
 * 使用狀態管理器和 DOM 管理器來減少耦合
 */

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('初始化聊天應用...');
    
    // 初始化 DOM 管理器
    domManager.initialize();
    
    // 綁定事件處理器
    domManager.bindEventHandlers({
      // 發送消息
      onSend: () => {
        const messageInput = domManager.get('messageInput');
        const message = messageInput.value.trim();
        
        if (message) {
          chatConnection.sendMessage(message)
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
          const oldUsername = chatState.getState('user.username');
          
          // 顯示用戶名變更消息（如果有變化）
          if (oldUsername && oldUsername !== newUsername) {
            domManager.showSystemMessage(
              `您已將用戶名從 "${oldUsername}" 更改為 "${newUsername}"`,
              'General'
            );
          }
          
          chatConnection.registerUsername(newUsername);
        }
      },
      
      // 顯示群組列表
      onShowGroups: () => {
        chatConnection.getAvailableGroups();
      },
      
      // 重新連接
      onReconnect: () => {
        chatConnection.stop()
          .then(() => chatConnection.start())
          .catch(err => {
            console.error('重新連接失敗:', err);
          });
      },
      
      // 切換夜間模式
      onDarkModeToggle: (enabled) => {
        chatState.toggleDarkMode(enabled);
      },
      
      // 調整字體大小
      onFontSizeChange: (size) => {
        chatState.setFontSize(size);
      },
      
      // 切換通知
      onNotificationsToggle: (enabled) => {
        if (enabled) {
          chatState.requestNotificationPermission();
        } else {
          chatState.updateState('system.notificationsEnabled', false);
        }
      },
      
      // 切換聲音通知
      onSoundToggle: (enabled) => {
        chatState.toggleSoundNotifications(enabled);
      }
    });
    
    // 初始化設置界面的狀態
    const initSettingsUI = () => {
      const darkModeToggle = domManager.get('darkModeToggle');
      const fontSizeRange = domManager.get('fontSizeRange');
      const notificationsToggle = domManager.get('notificationsToggle');
      const soundToggle = domManager.get('soundToggle');
      
      if (darkModeToggle) {
        darkModeToggle.checked = chatState.getState('system.darkMode');
      }
      
      if (fontSizeRange) {
        fontSizeRange.value = chatState.getState('system.fontSize');
      }
      
      if (notificationsToggle) {
        notificationsToggle.checked = chatState.getState('system.notificationsEnabled');
      }
      
      if (soundToggle) {
        soundToggle.checked = chatState.getState('system.soundEnabled');
      }
    };
    
    // 添加輸入事件來處理輸入狀態
    const messageInput = domManager.get('messageInput');
    if (messageInput) {
      let typingTimeout = null;
      
      messageInput.addEventListener('input', () => {
        // 如果用戶開始輸入，發送正在輸入狀態
        if (!chatState.getState('user.isTyping')) {
          chatConnection.sendTypingStatus(true);
        }
        
        // 清除之前的計時器
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        
        // 設置新的計時器，在停止輸入後 3 秒清除輸入狀態
        typingTimeout = setTimeout(() => {
          chatConnection.sendTypingStatus(false);
          typingTimeout = null;
        }, 3000);
      });
    }
    
    // 更新失敗消息計數的顯示
    const updateFailedMessagesUI = () => {
      const failedMessagesBtn = domManager.get('failedMessagesBtn');
      const failedMessagesCount = domManager.get('failedMessagesCount');
      const failedMessagesList = domManager.get('failedMessagesList');
      
      const failedMessages = chatState.getState('messages.failedMessages');
      
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
            chatConnection.resendFailedMessage(message.timestamp.toString())
              .catch(err => {
                console.error('重新發送消息失敗:', err);
              });
          });
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-sm btn-secondary';
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i> 刪除';
          deleteBtn.addEventListener('click', () => {
            const failedMessages = chatState.getState('messages.failedMessages');
            chatState.updateState('messages.failedMessages', 
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
    };
    
    // 監聽失敗消息的變化
    chatState.addListener('messages.failedMessages', updateFailedMessagesUI);
    
    // 監聽連接狀態變化來更新 UI
    chatState.addListener('connection', state => {
      domManager.updateConnectionStatus(
        state.isConnected, 
        state.isConnecting, 
        state.lastError
      );
      
      domManager.updateReconnectAttempts(state.reconnectAttempts);
      
      if (state.ping !== null) {
        domManager.updateConnectionPing(state.ping);
      }
    });
    
    // 監聽活動群組變化
    chatState.addListener('user.activeGroup', (groupName) => {
      // 同步 DOM 元素狀態
      domManager.switchActiveGroup(groupName);
      
      // 全局變量同步（為了兼容性）
      window.activeGroup = groupName;
    });
    
    // 開始連接
    chatConnection.start()
      .then(() => {
        console.log('SignalR 連接已建立');
        
        // 從 localStorage 讀取用戶名，如果沒有則提示輸入
        let username = chatState.getState('user.username');
        if (!username) {
          username = prompt("請輸入您的用戶名:", "用戶" + Math.floor(Math.random() * 1000));
          if (!username) {
            username = "用戶" + Math.floor(Math.random() * 1000);
          }
        }
        
        // 確保 userInput 顯示正確的用戶名
        const userInput = domManager.get('userInput');
        if (userInput) {
          userInput.value = username;
        }
        
        // 註冊用戶名並顯示歡迎訊息
        chatConnection.registerUsername(username)
          .then(() => {
            domManager.showSystemMessage(`歡迎來到聊天室，${username}！`, 'General');
          });
        
        // 初始化設置界面
        initSettingsUI();
      })
      .catch(err => {
        console.error('連接到 SignalR 失敗:', err);
      });
    
    // 初始化群組相關邏輯
    domManager.createGroupTab('General', () => {});
    domManager.switchActiveGroup('General');
  });