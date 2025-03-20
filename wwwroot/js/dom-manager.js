/**
 * DOM 元素管理器
 * 負責管理所有 DOM 元素引用和 DOM 相關操作
 */
class DOMManager {
    /**
     * DOM 元素引用
     * @type {Object.<string, HTMLElement>}
     */
    elements = {};
  
    /**
     * 元素選擇器
     * @type {Object.<string, string>}
     */
    selectors = {
      sendButton: "#sendButton",
      messageInput: "#messageInput",
      userInput: "#userInput",
      messagesContainer: "#messagesContainer",
      messagesList: "#messagesList",
      connectionStatus: "#connectionStatus",
      statusIndicator: "#statusIndicator",
      userList: "#userList",
      onlineCount: "#onlineCount",
      currentGroupName: "#currentGroupName",
      userGroupsList: "#userGroupsList",
      chatTabs: ".chat-tabs",
      showGroupsBtn: "#showGroupsBtn",
      groupsModal: "#groupsModal",
      closeGroupsBtn: "#closeGroupsBtn",
      availableGroupsList: "#availableGroupsList",
      // 新增: 設置相關元素
      settingsBtn: "#settingsBtn",
      settingsModal: "#settingsModal",
      closeSettingsBtn: "#closeSettingsBtn",
      darkModeToggle: "#darkModeToggle",
      fontSizeRange: "#fontSizeRange",
      notificationsToggle: "#notificationsToggle",
      soundToggle: "#soundToggle",
      settingsConnectionStatus: "#settingsConnectionStatus",
      settingsPing: "#settingsPing",
      settingsRetryCount: "#settingsRetryCount",
      settingsReconnectBtn: "#settingsReconnectBtn",
      // 新增: 連接重試通知
      reconnectNotification: "#reconnectNotification",
      retryCount: "#retryCount",
      reconnectBtn: "#reconnectBtn",
      // 新增: 失敗消息相關元素
      failedMessagesBtn: "#failedMessagesBtn",
      failedMessagesCount: "#failedMessagesCount",
      failedMessagesModal: "#failedMessagesModal",
      closeFailedMessagesBtn: "#closeFailedMessagesBtn",
      failedMessagesList: "#failedMessagesList",
      // 新增: 連接延遲顯示
      connectionPing: "#connectionPing"
    };
  
    /**
     * 初始化 DOM 管理器
     * 獲取所有 DOM 元素引用
     */
    initialize() {
      // 獲取所有 DOM 元素引用
      Object.entries(this.selectors).forEach(([key, selector]) => {
        const element = document.querySelector(selector);
        if (element) {
          this.elements[key] = element;
        } else {
          console.warn(`元素未找到: ${selector}`);
        }
      });
      return this;
    }
  
    /**
     * 獲取 DOM 元素
     * @param {string} key - 元素鍵值
     * @returns {HTMLElement|null} - DOM 元素或 null
     */
    get(key) {
      return this.elements[key] || null;
    }
  
    /**
     * 更新連接狀態指示器
     * @param {boolean} connected - 是否已連接
     * @param {boolean} connecting - 是否正在連接
     * @param {string|null} error - 錯誤信息
     */
    updateConnectionStatus(connected, connecting = false, error = null) {
        const statusText = this.elements.connectionStatus;
        const indicator = this.elements.statusIndicator;
        const sendButton = this.elements.sendButton;
        const settingsStatus = this.elements.settingsConnectionStatus;
        const reconnectNotification = this.elements.reconnectNotification;
        
        if (connected) {
          statusText.textContent = "已連接";
          if (settingsStatus) settingsStatus.textContent = "已連接";
          indicator.classList.add("status-connected");
          indicator.classList.remove("status-disconnected", "status-connecting");
          sendButton.disabled = false;
          if (reconnectNotification) reconnectNotification.style.display = "none";
          
          // 新增：添加脈動動畫效果
          indicator.classList.add("pulse-animation");
        } else if (connecting) {
          statusText.textContent = "正在連接...";
          if (settingsStatus) settingsStatus.textContent = "正在連接...";
          indicator.classList.add("status-connecting");
          indicator.classList.remove("status-connected", "status-disconnected", "pulse-animation");
          sendButton.disabled = true;
          
          // 新增：顯示連接中動畫
          indicator.classList.add("connecting-animation");
        } else {
          statusText.textContent = error ? `連接失敗: ${error.substring(0, 30)}...` : "未連接";
          if (settingsStatus) settingsStatus.textContent = error ? `連接失敗` : "未連接";
          indicator.classList.add("status-disconnected");
          indicator.classList.remove("status-connected", "status-connecting", "pulse-animation", "connecting-animation");
          sendButton.disabled = true;
          
          // 新增：顯示重連通知，如果有重連嘗試次數
          if (reconnectNotification && chatState.getState('connection.reconnectAttempts') > 0) {
            reconnectNotification.style.display = "flex";
          }
        }
      }
  
    /**
     * 更新重連嘗試計數
     * @param {number} count - 重連嘗試次數
     */
    updateReconnectAttempts(count) {
      const retryCount = this.elements.retryCount;
      const settingsRetryCount = this.elements.settingsRetryCount;
      const reconnectNotification = this.elements.reconnectNotification;
      
      if (retryCount) retryCount.textContent = count.toString();
      if (settingsRetryCount) settingsRetryCount.textContent = count.toString();
      
      if (count > 0 && reconnectNotification) {
        reconnectNotification.style.display = "flex";
      } else if (reconnectNotification) {
        reconnectNotification.style.display = "none";
      }
    }
  
    /**
     * 更新連接延遲
     * @param {number} ping - 延遲毫秒數
     */
    updateConnectionPing(ping) {
      const pingElement = this.elements.connectionPing;
      const settingsPing = this.elements.settingsPing;
      
      if (pingElement) pingElement.textContent = `${ping}ms`;
      if (settingsPing) settingsPing.textContent = `${ping}ms`;
    }
    scrollToBottom(element) {
        // 檢查用戶是否已經滾動到底部附近（距離底部不超過100像素）
        const isScrolledToBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 100;
        
        // 如果是，自動滾動到底部
        if (isScrolledToBottom) {
          element.scrollTop = element.scrollHeight;
        } else {
          // 如果用戶已經滾動到上方，顯示新消息提示
          this.showNewMessageIndicator(element, groupName);
        }
      }
      resetUnreadCount(groupName) {
        // 重置群組的未讀消息計數
        chatState.updateState(`messages.unreadCount.${groupName}`, 0);
        
        // 更新UI
        this.updateGroupTabUnreadCount(groupName);
        
        // 更新群組列表中的未讀計數
        const groupListItem = document.querySelector(`.groups-list li[data-group="${groupName}"]`);
        if (groupListItem) {
          const badge = groupListItem.querySelector('.unread-badge');
          if (badge) {
            badge.remove();
          }
        }
      }
      showNewMessageIndicator(messagesContainer, groupName) {
        // 檢查是否已經存在新消息提示
        let indicator = messagesContainer.querySelector('.new-messages-indicator');
        
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.className = 'new-messages-indicator';
          indicator.innerHTML = '<i class="fas fa-arrow-down"></i> 新訊息';
          indicator.addEventListener('click', () => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            indicator.remove();
          });
          messagesContainer.appendChild(indicator);
        }
      }
    showMessage(user, message, groupName, currentUsername) {
        const messagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
        if (!messagesList) return;
        
        const li = document.createElement("li");
        const isSelf = user === currentUsername;
        
        // 設置訊息樣式
        li.className = isSelf ? "self-message" : "message";
        
        // 創建用戶名元素
        const usernameElement = document.createElement("div");
        usernameElement.className = "message-username";
        usernameElement.textContent = isSelf ? "我" : user;
        
        // 創建訊息內容元素並處理連結、表情符號等
        const messageElement = document.createElement("div");
        messageElement.className = "message-content";
        
        // 處理連結
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const processedMessage = message.replace(urlRegex, url => {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
        
        messageElement.innerHTML = processedMessage;
        
        // 創建時間元素
        const timeElement = document.createElement("div");
        timeElement.className = "message-time";
        const messageTime = new Date();
        timeElement.textContent = this.formatTime(messageTime);
        timeElement.title = messageTime.toLocaleString();
        
        // 添加元素到列表項
        li.appendChild(usernameElement);
        li.appendChild(messageElement);
        li.appendChild(timeElement);
        
        // 添加消息操作菜單
        if (!isSelf) {
          // 創建消息操作按鈕
          const actionBtn = document.createElement("button");
          actionBtn.className = "message-actions-btn";
          actionBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
          actionBtn.title = "訊息操作";
          
          // 創建操作菜單
          const actionsMenu = document.createElement("div");
          actionsMenu.className = "message-actions-menu";
          
          // 添加回覆選項
          const replyBtn = document.createElement("button");
          replyBtn.innerHTML = '<i class="fas fa-reply"></i> 回覆';
          replyBtn.addEventListener("click", () => {
            const messageInput = this.elements.messageInput;
            if (messageInput) {
              messageInput.value = `@${user} `;
              messageInput.focus();
            }
          });
          
          actionsMenu.appendChild(replyBtn);
          li.appendChild(actionBtn);
          li.appendChild(actionsMenu);
          
          // 顯示/隱藏操作菜單
          actionBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            actionsMenu.classList.toggle("show");
          });
          
          // 點擊其他地方關閉菜單
          document.addEventListener("click", () => {
            actionsMenu.classList.remove("show");
          });
        }
        
        messagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        this.scrollToBottom(messagesList);
        
        // 如果不是當前活動群組，更新未讀計數
        if (groupName !== window.activeGroup) {
          this.updateGroupTabUnreadCount(groupName);
        }
      }
    /**
     * 顯示訊息
     * @param {string} user - 用戶名
     * @param {string} message - 訊息內容
     * @param {string} groupName - 群組名稱
     * @param {string} currentUsername - 當前用戶名
     */
    showMessage(user, message, groupName, currentUsername) {
      const messagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
      if (!messagesList) return;
      
      const li = document.createElement("li");
      const isSelf = user === currentUsername;
      
      // 設置訊息樣式
      li.className = isSelf ? "self-message" : "message";
      
      // 創建用戶名元素
      const usernameElement = document.createElement("div");
      usernameElement.className = "message-username";
      usernameElement.textContent = isSelf ? "我" : user;
      
      // 創建訊息內容元素
      const messageElement = document.createElement("div");
      messageElement.textContent = message;
      
      // 創建時間元素
      const timeElement = document.createElement("div");
      timeElement.className = "message-time";
      timeElement.textContent = this.formatTime();
      
      // 添加元素到列表項
      li.appendChild(usernameElement);
      li.appendChild(messageElement);
      li.appendChild(timeElement);
      
      messagesList.appendChild(li);
      
      // 自動滾動到最新訊息
      messagesList.scrollTop = messagesList.scrollHeight;
      
      // 如果不是當前活動群組，在標籤頁上添加未讀標記
      if (!isSelf && groupName !== window.activeGroup) {
        const groupTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`);
        if (groupTab && !groupTab.classList.contains("unread")) {
          groupTab.classList.add("unread");
        }
      }
    }
  
    /**
     * 顯示系統訊息
     * @param {string} message - 系統訊息內容
     * @param {string} groupName - 群組名稱
     */
    showSystemMessage(message, groupName) {
      const messagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
      if (!messagesList) return;
      
      const li = document.createElement("li");
      li.textContent = message;
      li.className = "system-message";
      
      messagesList.appendChild(li);
      
      // 自動滾動到最新訊息
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  
    /**
     * 更新用戶列表
     * @param {string[]} users - 用戶名列表
     * @param {string} currentUsername - 當前用戶名
     */
    updateUserList(users, currentUsername) {
        const userList = this.elements.userList;
        const onlineCount = this.elements.onlineCount;
        
        if (!userList) return;
        
        // 清空現有列表
        userList.innerHTML = "";
        
        // 排序用戶列表：當前用戶在最上面，其他按字母排序
        users.sort((a, b) => {
          if (a === currentUsername) return -1;
          if (b === currentUsername) return 1;
          return a.localeCompare(b);
        });
        
        // 添加每個用戶到列表
        users.forEach(user => {
          const li = document.createElement("li");
          
          // 創建用戶頭像元素
          const avatar = document.createElement("div");
          avatar.className = "user-avatar";
          avatar.style.backgroundColor = this.stringToColor(user);
          avatar.textContent = user.charAt(0).toUpperCase();
          
          // 創建用戶狀態指示器
          const statusIndicator = document.createElement("div");
          statusIndicator.className = "user-status status-online";
          avatar.appendChild(statusIndicator);
          
          // 創建用戶名稱元素
          const username = document.createElement("span");
          username.textContent = user === currentUsername ? `${user} (我)` : user;
          
          // 如果是當前用戶，添加特殊樣式
          if (user === currentUsername) {
            li.classList.add("current-user");
            username.style.fontWeight = "bold";
          }
          
          // 添加到列表項
          li.appendChild(avatar);
          li.appendChild(username);
          
          userList.appendChild(li);
        });
        
        // 更新在線用戶計數
        if (onlineCount) {
          onlineCount.textContent = users.length.toString();
        }
      }
  

    /**
     * 切換活動群組
     * @param {string} groupName - 群組名稱
     */
    switchActiveGroup(groupName) {
    // 使用狀態管理器更新活動群組，而不是全局變量
    chatState.setActiveGroup(groupName);
    
    // 獲取當前活動群組從狀態管理器
    const activeGroup = chatState.getState('user.activeGroup');
    
    // 更新當前群組顯示
    if (this.elements.currentGroupName) {
      this.elements.currentGroupName.textContent = groupName;
    }
    
    // 更新群組標籤頁高亮
    document.querySelectorAll('.chat-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.group === groupName) {
        tab.classList.add('active');
        tab.classList.remove('unread'); // 清除未讀標記
      }
    });
    
    // 更新群組列表項高亮
    document.querySelectorAll('.groups-list li').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.group === groupName) {
        item.classList.add('active');
      }
    });
    
    // 更新消息列表顯示
    document.querySelectorAll('.messages-list').forEach(list => {
      list.classList.remove('active');
      if (list.dataset.group === groupName) {
        list.classList.add('active');
      }
    });
    
    // 設置焦點到消息輸入框
    if (this.elements.messageInput) {
      this.elements.messageInput.focus();
    }
  }
  
    /**
     * 創建群組標籤頁
     * @param {string} groupName - 群組名稱
     * @param {Function} onLeaveGroup - 離開群組的回調函數
     * @returns {boolean} - 是否成功創建（如果已存在則返回 false）
     */
    createGroupTab(groupName, onLeaveGroup) {
        // 檢查標籤頁是否已存在
        const existingTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`);
        if (existingTab) {
          // 更新未讀消息計數
          this.updateGroupTabUnreadCount(groupName);
          return false;
        }
        
        const chatTabs = this.elements.chatTabs;
        if (!chatTabs) return false;
        
        const tab = document.createElement("div");
        tab.className = "chat-tab";
        tab.dataset.group = groupName;
        
        // 將群組名稱包裝在 span 中，以便添加未讀消息計數
        const nameSpan = document.createElement("span");
        nameSpan.textContent = groupName;
        tab.appendChild(nameSpan);
        
        // 添加未讀消息計數
        const unreadCount = chatState.getState(`messages.unreadCount.${groupName}`) || 0;
        if (unreadCount > 0) {
          const badge = document.createElement("span");
          badge.className = "unread-badge";
          badge.textContent = unreadCount > 99 ? "99+" : unreadCount.toString();
          tab.appendChild(badge);
        }
        
        // 添加關閉按鈕 (若非"General"群組)
        if (groupName !== "General") {
          const closeBtn = document.createElement("span");
          closeBtn.className = "close-tab";
          closeBtn.innerHTML = "&times;";
          closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            if (typeof onLeaveGroup === 'function') {
              onLeaveGroup(groupName);
            }
          });
          
          tab.appendChild(closeBtn);
        }
        
        // 點擊標籤頁切換群組
        tab.addEventListener("click", () => {
          this.switchActiveGroup(groupName);
        });
        
        chatTabs.appendChild(tab);
        
        // 創建對應的消息列表
        this.createGroupMessagesList(groupName);
        
        return true;
      }
  
    /**
     * 創建群組消息列表
     * @param {string} groupName - 群組名稱
     * @returns {boolean} - 是否成功創建（如果已存在則返回 false）
     */
    createGroupMessagesList(groupName) {
      // 檢查消息列表是否已存在
      if (document.querySelector(`.messages-list[data-group="${groupName}"]`)) {
        return false;
      }
      
      const messagesContainer = this.elements.messagesContainer;
      if (!messagesContainer) return false;
      
      const ul = document.createElement("ul");
      ul.className = "messages-list";
      ul.id = `messagesList-${groupName}`;
      ul.dataset.group = groupName;
      
      // 添加歡迎消息
      const li = document.createElement("li");
      li.textContent = `歡迎來到 ${groupName} 群組！`;
      li.className = "system-message";
      ul.appendChild(li);
      
      messagesContainer.appendChild(ul);
      
      return true;
    }
  
    /**
     * 更新用戶群組列表
     * @param {Array<Object>} groups - 群組列表
     * @param {string} activeGroup - 當前活動群組
     * @param {Function} onLeaveGroup - 離開群組的回調函數
     * @param {Function} onSwitchGroup - 切換群組的回調函數
     */
    updateUserGroupsList(groups, activeGroup, onLeaveGroup, onSwitchGroup) {
        const userGroupsList = this.elements.userGroupsList;
        if (!userGroupsList) return;
        
        userGroupsList.innerHTML = "";
        
        groups.forEach(group => {
          const li = document.createElement("li");
          li.dataset.group = group.name;
          
          // 如果是當前活動群組，添加.active類
          if (group.name === activeGroup) {
            li.classList.add("active");
          }
          
          // 群組名稱
          const groupName = document.createElement("div");
          groupName.className = "group-name";
          groupName.innerHTML = `<i class="fas fa-users"></i> ${group.name}`;
          
          // 添加未讀消息計數
          const unreadCount = chatState.getState(`messages.unreadCount.${group.name}`) || 0;
          if (unreadCount > 0 && group.name !== activeGroup) {
            const badge = document.createElement("span");
            badge.className = "unread-badge";
            badge.textContent = unreadCount > 99 ? "99+" : unreadCount.toString();
            groupName.appendChild(badge);
          }
          
          // 群組操作按鈕
          const groupActions = document.createElement("div");
          groupActions.className = "group-actions";
          
          // 離開群組按鈕 (一般群組不能離開)
          if (group.name !== "General") {
            const leaveBtn = document.createElement("button");
            leaveBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
            leaveBtn.title = "離開群組";
            
            leaveBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              if (typeof onLeaveGroup === 'function') {
                // 添加確認對話框
                if (confirm(`確定要離開 ${group.name} 群組嗎？`)) {
                  onLeaveGroup(group.name);
                }
              }
            });
            
            groupActions.appendChild(leaveBtn);
          }
          
          li.appendChild(groupName);
          li.appendChild(groupActions);
          
          // 點擊群組列表項切換到該群組
          li.addEventListener("click", () => {
            if (typeof onSwitchGroup === 'function') {
              onSwitchGroup(group.name);
            }
          });
          
          userGroupsList.appendChild(li);
          
          // 確保該群組有對應的標籤頁和消息列表
          this.createGroupTab(group.name, onLeaveGroup);
        });
      }
      updateGroupTabUnreadCount(groupName) {
        const groupTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`);
        if (!groupTab) return;
        
        // 移除現有的未讀徽章
        const existingBadge = groupTab.querySelector('.unread-badge');
        if (existingBadge) {
          existingBadge.remove();
        }
        
        // 如果不是當前活動群組，添加未讀計數徽章
        if (groupName !== window.activeGroup) {
          const unreadCount = chatState.getState(`messages.unreadCount.${groupName}`) || 0;
          if (unreadCount > 0) {
            const badge = document.createElement("span");
            badge.className = "unread-badge";
            badge.textContent = unreadCount > 99 ? "99+" : unreadCount.toString();
            groupTab.appendChild(badge);
          }
        }
      }
    /**
     * 更新可用群組列表
     * @param {Array<Object>} groups - 可用群組列表
     * @param {Function} onJoinGroup - 加入群組的回調函數
     * @param {Function} onLeaveGroup - 離開群組的回調函數
     */
    updateAvailableGroupsList(groups, onJoinGroup, onLeaveGroup) {
      const availableGroupsList = this.elements.availableGroupsList;
      if (!availableGroupsList) return;
      
      availableGroupsList.innerHTML = "";
      
      groups.forEach(group => {
        const li = document.createElement("li");
        
        // 群組信息
        const groupInfo = document.createElement("div");
        groupInfo.className = "group-info";
        
        const groupNameElement = document.createElement("div");
        groupNameElement.className = "group-name";
        groupNameElement.textContent = group.name;
        
        const groupDescElement = document.createElement("div");
        groupDescElement.className = "group-description";
        groupDescElement.textContent = group.description;
        
        groupInfo.appendChild(groupNameElement);
        groupInfo.appendChild(groupDescElement);
        
        // 群組加入/離開按鈕
        const groupJoinButton = document.createElement("button");
        groupJoinButton.className = "btn btn-sm";
        groupJoinButton.dataset.group = group.name;
        
        if (group.isJoined) {
          groupJoinButton.className += " btn-secondary";
          groupJoinButton.innerHTML = '<i class="fas fa-check"></i> 已加入';
          groupJoinButton.disabled = group.name === "General"; // 不能離開 General 群組
          
          groupJoinButton.addEventListener("click", () => {
            if (group.name !== "General" && typeof onLeaveGroup === 'function') {
              // 立即更新按鈕外觀，提供即時反饋
              groupJoinButton.innerHTML = '<i class="fas fa-plus"></i> 加入';
              groupJoinButton.className = "btn btn-sm btn-primary";
              
              onLeaveGroup(group.name);
            }
          });
        } else {
          groupJoinButton.className += " btn-primary";
          groupJoinButton.innerHTML = '<i class="fas fa-plus"></i> 加入';
          
          groupJoinButton.addEventListener("click", () => {
            if (typeof onJoinGroup === 'function') {
              // 立即更新按鈕外觀，提供即時反饋
              groupJoinButton.innerHTML = '<i class="fas fa-check"></i> 已加入';
              groupJoinButton.className = "btn btn-sm btn-secondary";
              
              onJoinGroup(group.name);
            }
          });
        }
        
        li.appendChild(groupInfo);
        li.appendChild(groupJoinButton);
        
        availableGroupsList.appendChild(li);
      });
    }
    
    /**
     * 顯示群組對話框
     */
    showGroupsModal() {
      if (this.elements.groupsModal) {
        this.elements.groupsModal.classList.add("show");
      }
    }
  
    /**
     * 隱藏群組對話框
     */
    hideGroupsModal() {
      if (this.elements.groupsModal) {
        this.elements.groupsModal.classList.remove("show");
      }
    }
  
    /**
     * 移除群組標籤頁和消息列表
     * @param {string} groupName - 群組名稱
     * @param {string} activeGroup - 當前活動群組
     * @returns {boolean} - 是否成功移除
     */
    removeGroupTab(groupName, activeGroup) {
      // 移除群組標籤頁
      const groupTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`);
      if (groupTab) {
        groupTab.remove();
      }
      
      // 移除群組消息列表
      const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
      if (groupMessagesList) {
        groupMessagesList.remove();
      }
      
      // 如果當前活動群組是被移除的群組，切換到 General
      if (activeGroup === groupName) {
        this.switchActiveGroup("General");
        return true;
      }
      
      return false;
    }
  
    /**
     * 格式化時間
     * @returns {string} 格式化的時間字串 (HH:MM)
     */
    formatTime() {
      const now = new Date();
      return now.getHours().toString().padStart(2, '0') + ':' + 
             now.getMinutes().toString().padStart(2, '0');
    }
  
    /**
     * 從字串生成顏色
     * @param {string} str - 輸入字串
     * @returns {string} 十六進位顏色代碼
     */
    stringToColor(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const c = (hash & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();
      return '#' + '00000'.substring(0, 6 - c.length) + c;
    }
  
    /**
     * 綁定事件處理器
     * @param {Object} handlers - 事件處理器映射
     */
    bindEventHandlers(handlers) {
      // 傳送按鈕點擊事件
      if (this.elements.sendButton && handlers.onSend) {
        this.elements.sendButton.addEventListener('click', (event) => {
          handlers.onSend();
          event.preventDefault();
        });
      }
      
      // 訊息輸入框Enter鍵事件
      if (this.elements.messageInput && handlers.onSend) {
        this.elements.messageInput.addEventListener('keyup', (event) => {
          if (event.key === 'Enter') {
            handlers.onSend();
          }
        });
      }
      
      // 用戶名輸入變更事件
      if (this.elements.userInput && handlers.onUsernameChange) {
        this.elements.userInput.addEventListener('change', () => {
          const newUsername = this.elements.userInput.value.trim();
          if (newUsername) {
            handlers.onUsernameChange(newUsername);
          }
        });
      }
      
      // 顯示群組對話框按鈕
      if (this.elements.showGroupsBtn && handlers.onShowGroups) {
        this.elements.showGroupsBtn.addEventListener('click', () => {
          handlers.onShowGroups();
        });
      }
      
      // 關閉群組對話框按鈕
      if (this.elements.closeGroupsBtn) {
        this.elements.closeGroupsBtn.addEventListener('click', () => {
          this.hideGroupsModal();
        });
      }
      
      // 點擊對話框外部關閉
      if (this.elements.groupsModal) {
        this.elements.groupsModal.addEventListener('click', (event) => {
          if (event.target === this.elements.groupsModal) {
            this.hideGroupsModal();
          }
        });
      }
      
      // 重新連接按鈕
      if (this.elements.reconnectBtn && handlers.onReconnect) {
        this.elements.reconnectBtn.addEventListener('click', () => {
          handlers.onReconnect();
        });
      }
      
      if (this.elements.settingsReconnectBtn && handlers.onReconnect) {
        this.elements.settingsReconnectBtn.addEventListener('click', () => {
          handlers.onReconnect();
        });
      }
      
      // 設置按鈕相關
      if (this.elements.settingsBtn && this.elements.settingsModal) {
        this.elements.settingsBtn.addEventListener('click', () => {
          this.elements.settingsModal.classList.add('show');
        });
      }
      
      if (this.elements.closeSettingsBtn && this.elements.settingsModal) {
        this.elements.closeSettingsBtn.addEventListener('click', () => {
          this.elements.settingsModal.classList.remove('show');
        });
      }
      
      // 深色模式切換
      if (this.elements.darkModeToggle && handlers.onDarkModeToggle) {
        this.elements.darkModeToggle.addEventListener('change', (event) => {
          handlers.onDarkModeToggle(event.target.checked);
        });
      }
      
      // 字體大小調整
      if (this.elements.fontSizeRange && handlers.onFontSizeChange) {
        this.elements.fontSizeRange.addEventListener('input', (event) => {
          handlers.onFontSizeChange(parseInt(event.target.value));
        });
      }
      
      // 通知開關
      if (this.elements.notificationsToggle && handlers.onNotificationsToggle) {
        this.elements.notificationsToggle.addEventListener('change', (event) => {
          handlers.onNotificationsToggle(event.target.checked);
        });
      }
      
      // 聲音開關
      if (this.elements.soundToggle && handlers.onSoundToggle) {
        this.elements.soundToggle.addEventListener('change', (event) => {
          handlers.onSoundToggle(event.target.checked);
        });
      }
      
      // 失敗消息按鈕
      if (this.elements.failedMessagesBtn && this.elements.failedMessagesModal) {
        this.elements.failedMessagesBtn.addEventListener('click', () => {
          this.elements.failedMessagesModal.classList.add('show');
        });
      }
      
      if (this.elements.closeFailedMessagesBtn && this.elements.failedMessagesModal) {
        this.elements.closeFailedMessagesBtn.addEventListener('click', () => {
          this.elements.failedMessagesModal.classList.remove('show');
        });
      }
      // 點擊設定對話框背景關閉
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (event) => {
            if (event.target === this.elements.settingsModal) {
                this.elements.settingsModal.classList.remove('show');
            }
            });
        }
        
        // 點擊失敗消息對話框背景關閉
        if (this.elements.failedMessagesModal) {
            this.elements.failedMessagesModal.addEventListener('click', (event) => {
            if (event.target === this.elements.failedMessagesModal) {
                this.elements.failedMessagesModal.classList.remove('show');
            }
            });
        }
    }
  }
  
  // 導出 DOM 管理器的單例實例
  const domManager = new DOMManager();