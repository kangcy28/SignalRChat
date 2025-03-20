import { ChatHubConnection, chatConnection } from './signalr-connection';
import { GroupInfo, ChatMessage } from './interfaces';

/**
 * 聊天應用UI管理器
 * 負責處理DOM更新和事件綁定
 */
export class ChatUIManager {
  private connection: ChatHubConnection;
  private domElements: Record<string, HTMLElement> = {} as Record<string, HTMLElement>;

  // DOM元素選擇器
  private readonly selectors = {
    sendButton: '#sendButton',
    messageInput: '#messageInput',
    userInput: '#userInput',
    messagesContainer: '#messagesContainer',
    connectionStatus: '#connectionStatus',
    statusIndicator: '#statusIndicator',
    userList: '#userList',
    onlineCount: '#onlineCount',
    currentGroupName: '#currentGroupName',
    userGroupsList: '#userGroupsList',
    chatTabs: '.chat-tabs',
    showGroupsBtn: '#showGroupsBtn',
    groupsModal: '#groupsModal',
    closeGroupsBtn: '#closeGroupsBtn',
    availableGroupsList: '#availableGroupsList'
  };

  /**
   * 創建聊天UI管理器
   * @param connection SignalR連接實例，默認使用全局實例
   */
  constructor(connection: ChatHubConnection = chatConnection) {
    this.connection = connection;
  }

  /**
   * 初始化UI管理器
   */
  async initialize(): Promise<void> {
    // 獲取所有DOM元素引用
    Object.entries(this.selectors).forEach(([key, selector]) => {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) {
          this.domElements[key] = element;
        } else {
          console.warn(`Element not found or not an HTMLElement: ${selector}`);
          // 創建一個空的元素作為替代，避免空指針錯誤
          this.domElements[key] = document.createElement('div');
        }
      });

    // 綁定事件處理
    this.bindEventHandlers();

    // 設置SignalR客戶端方法處理
    this.setupSignalREvents();

    // 啟動連接
    try {
      await this.connection.start();
      this.updateConnectionStatus(true);

      // 獲取存儲的用戶名或提示輸入
      let username = localStorage.getItem('chatUsername');
      if (!username) {
        username = prompt('請輸入您的用戶名:', '用戶' + Math.floor(Math.random() * 1000));
        if (!username) {
          username = '用戶' + Math.floor(Math.random() * 1000);
        }
      }

      // 設置用戶名並顯示歡迎訊息
      await this.connection.setUsername(username);
      this.showSystemMessage(`歡迎來到聊天室，${username}！`, 'General');

      // 初始化群組
      this.createGroupTab('General');
      this.switchActiveGroup('General');
      
      // 獲取可用群組列表
      await this.connection.getAvailableGroups();
    } catch (err) {
      this.updateConnectionStatus(false);
      console.error('初始化聊天失敗:', err);
    }
  }

  /**
   * 綁定UI事件處理
   */
  private bindEventHandlers(): void {
    // 發送按鈕點擊事件
    this.domElements.sendButton.addEventListener('click', (event) => {
      this.sendMessage();
      event.preventDefault();
    });

    // 訊息輸入框Enter鍵事件
    this.domElements.messageInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        this.sendMessage();
      }
    });

    // 用戶名輸入變更事件
    this.domElements.userInput.addEventListener('change', () => {
      const newUsername = (this.domElements.userInput as HTMLInputElement).value.trim();
      if (newUsername) {
        const oldUsername = this.connection.currentUsername;
        
        // 顯示用戶名變更消息
        if (oldUsername && oldUsername !== newUsername) {
          this.showSystemMessage(
            `您已將用戶名從 "${oldUsername}" 更改為 "${newUsername}"`, 
            'General'
          );
        }
        
        this.connection.setUsername(newUsername);
      }
    });

    // 顯示群組對話框按鈕
    this.domElements.showGroupsBtn.addEventListener('click', () => {
      this.connection.getAvailableGroups();
    });

    // 關閉群組對話框按鈕
    this.domElements.closeGroupsBtn.addEventListener('click', () => {
      (this.domElements.groupsModal as HTMLElement).classList.remove('show');
    });

    // 點擊對話框外部關閉
    this.domElements.groupsModal.addEventListener('click', (event) => {
      if (event.target === this.domElements.groupsModal) {
        (this.domElements.groupsModal as HTMLElement).classList.remove('show');
      }
    });
  }

  /**
   * 設置SignalR事件處理
   */
  private setupSignalREvents(): void {
    // 接收一般消息
    this.connection.on('receiveMessage', (user, message) => {
      this.showMessage(user, message, 'General');
    });

    // 接收群組消息
    this.connection.on('receiveGroupMessage', (user, groupName, message) => {
      this.showMessage(user, message, groupName);
      
      // 若非當前活動群組，添加未讀標記
      if (groupName !== this.connection.activeGroup) {
        const groupTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`) as HTMLElement;
        if (groupTab && !groupTab.classList.contains('unread')) {
          groupTab.classList.add('unread');
        }
      }
    });

    // 用戶連接事件
    this.connection.on('userConnected', (username) => {
      this.connection.userGroups.forEach(group => {
        this.showSystemMessage(`${username} 已加入聊天室`, group.name);
      });
    });

    // 用戶斷開連接事件
    this.connection.on('userDisconnected', (username) => {
      this.connection.userGroups.forEach(group => {
        this.showSystemMessage(`${username} 已離開聊天室`, group.name);
      });
    });

    // 更新用戶列表
    this.connection.on('updateUserList', (users) => {
      this.updateUserList(users);
    });

    // 更新用戶群組列表
    this.connection.on('updateUserGroups', (groups) => {
      this.updateUserGroupsList(groups);
    });

    // 可用群組列表
    this.connection.on('availableGroups', (groups) => {
      this.updateAvailableGroupsList(groups);
      (this.domElements.groupsModal as HTMLElement).classList.add('show');
    });

    // 加入群組事件
    this.connection.on('joinedGroup', (groupName) => {
      // 添加系統消息到群組
      this.showSystemMessage(`您已加入 ${groupName} 群組`, groupName);
      
      // 如果是首次加入該群組，切換到該群組
      if (groupName !== 'General' && !document.querySelector(`.chat-tab[data-group="${groupName}"]`)) {
        this.switchActiveGroup(groupName);
      }
    });

    // 離開群組事件
    this.connection.on('leftGroup', (groupName) => {
      // 如果當前活動群組是被離開的群組，切換到General
      if (this.connection.activeGroup === groupName) {
        this.switchActiveGroup('General');
      }
      
      // 移除群組標籤頁和消息列表
      this.removeGroupTab(groupName);
    });

    // 用戶加入群組事件
    this.connection.on('userJoinedGroup', (username, groupName) => {
      this.showSystemMessage(`${username} 已加入群組`, groupName);
    });

    // 用戶離開群組事件
    this.connection.on('userLeftGroup', (username, groupName) => {
      this.showSystemMessage(`${username} 已離開群組`, groupName);
    });

    // 用戶在群組中改名事件
    this.connection.on('userRenamedInGroup', (oldUsername, newUsername, groupName) => {
      this.showSystemMessage(`用戶 ${oldUsername} 已更改名稱為 ${newUsername}`, groupName);
    });

    // 群組錯誤事件
    this.connection.on('groupError', (errorMessage) => {
      alert(errorMessage);
    });
  }

  /**
   * 發送消息
   */
  private async sendMessage(): Promise<void> {
    const messageInput = this.domElements.messageInput as HTMLInputElement;
    const message = messageInput.value.trim();
    
    if (message) {
      try {
        await this.connection.sendMessage(message);
        messageInput.value = '';
        messageInput.focus();
      } catch (err) {
        console.error('發送消息失敗:', err);
      }
    }
  }

  /**
   * 更新連接狀態指示器
   * @param connected 是否已連接
   */
  private updateConnectionStatus(connected: boolean): void {
    const statusText = this.domElements.connectionStatus as HTMLElement;
    const indicator = this.domElements.statusIndicator as HTMLElement;
    const sendButton = this.domElements.sendButton as HTMLButtonElement;
    
    if (connected) {
      statusText.textContent = '已連接';
      indicator.classList.add('status-connected');
      indicator.classList.remove('status-disconnected');
      sendButton.disabled = false;
    } else {
      statusText.textContent = '連接失敗';
      indicator.classList.add('status-disconnected');
      indicator.classList.remove('status-connected');
      sendButton.disabled = true;
    }
  }

  /**
   * 顯示用戶消息
   * @param user 用戶名
   * @param message 消息內容
   * @param groupName 群組名稱
   */
  private showMessage(user: string, message: string, groupName: string): void {
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`) as HTMLElement;
    if (!groupMessagesList) return;
    
    const li = document.createElement('li');
    const isSelf = user === this.connection.currentUsername;
    
    // 設置訊息樣式
    li.className = isSelf ? 'self-message' : 'message';
    
    // 創建用戶名元素
    const usernameElement = document.createElement('div');
    usernameElement.className = 'message-username';
    usernameElement.textContent = isSelf ? '我' : user;
    
    // 創建訊息內容元素
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    
    // 創建時間元素
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = this.formatTime();
    
    // 添加元素到列表項
    li.appendChild(usernameElement);
    li.appendChild(messageElement);
    li.appendChild(timeElement);
    
    groupMessagesList.appendChild(li);
    
    // 自動滾動到最新訊息
    groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
  }

  /**
   * 顯示系統消息
   * @param message 系統消息內容
   * @param groupName 群組名稱
   */
  private showSystemMessage(message: string, groupName: string): void {
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`) as HTMLElement;
    if (!groupMessagesList) return;
    
    const li = document.createElement('li');
    li.textContent = message;
    li.className = 'system-message';
    
    groupMessagesList.appendChild(li);
    
    // 自動滾動到最新訊息
    groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
  }

  /**
   * 更新用戶列表
   * @param users 用戶名列表
   */
  private updateUserList(users: string[]): void {
    const userList = this.domElements.userList as HTMLElement;
    const onlineCount = this.domElements.onlineCount as HTMLElement;
    
    // 清空現有列表
    userList.innerHTML = '';
    
    // 添加每個用戶到列表
    users.forEach(user => {
      const li = document.createElement('li');
      
      // 創建用戶頭像元素
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.style.backgroundColor = this.stringToColor(user);
      avatar.textContent = user.charAt(0).toUpperCase();
      
      // 創建用戶名稱元素
      const username = document.createElement('span');
      username.textContent = user;
      
      // 添加到列表項
      li.appendChild(avatar);
      li.appendChild(username);
      
      // 如果是當前用戶，高亮顯示
      if (user === this.connection.currentUsername) {
        li.style.fontWeight = 'bold';
      }
      
      userList.appendChild(li);
    });
    
    // 更新在線用戶計數
    if (onlineCount) {
      onlineCount.textContent = users.length.toString();
    }
  }

  /**
   * 更新用戶群組列表
   * @param groups 群組列表
   */
  private updateUserGroupsList(groups: GroupInfo[]): void {
    const userGroupsList = this.domElements.userGroupsList as HTMLElement;
    
    userGroupsList.innerHTML = '';
    
    groups.forEach(group => {
      const li = document.createElement('li');
      li.dataset.group = group.name;
      
      // 如果是當前活動群組，添加.active類
      if (group.name === this.connection.activeGroup) {
        li.classList.add('active');
      }
      
      // 群組名稱
      const groupName = document.createElement('div');
      groupName.className = 'group-name';
      groupName.innerHTML = `<i class="fas fa-users"></i> ${group.name}`;
      
      // 群組操作按鈕
      const groupActions = document.createElement('div');
      groupActions.className = 'group-actions';
      
      // 離開群組按鈕 (一般群組不能離開)
      if (group.name !== 'General') {
        const leaveBtn = document.createElement('button');
        leaveBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
        leaveBtn.title = '離開群組';
        
        leaveBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          this.connection.leaveGroup(group.name);
        });
        
        groupActions.appendChild(leaveBtn);
      }
      
      li.appendChild(groupName);
      li.appendChild(groupActions);
      
      // 點擊群組列表項切換到該群組
      li.addEventListener('click', () => {
        this.switchActiveGroup(group.name);
      });
      
      userGroupsList.appendChild(li);
      
      // 確保該群組有對應的標籤頁和消息列表
      this.createGroupTab(group.name);
    });
  }

  /**
   * 更新可用群組列表
   * @param groups 可用群組列表
   */
  private updateAvailableGroupsList(groups: GroupInfo[]): void {
    const availableGroupsList = this.domElements.availableGroupsList as HTMLElement;
    
    availableGroupsList.innerHTML = '';
    
    groups.forEach(group => {
      const li = document.createElement('li');
      
      // 群組信息
      const groupInfo = document.createElement('div');
      groupInfo.className = 'group-info';
      
      const groupNameElement = document.createElement('div');
      groupNameElement.className = 'group-name';
      groupNameElement.textContent = group.name;
      
      const groupDescElement = document.createElement('div');
      groupDescElement.className = 'group-description';
      groupDescElement.textContent = group.description;
      
      groupInfo.appendChild(groupNameElement);
      groupInfo.appendChild(groupDescElement);
      
      // 群組加入/離開按鈕
      const groupJoinButton = document.createElement('button');
      groupJoinButton.className = 'btn btn-sm';
      groupJoinButton.dataset.group = group.name;
      
      if (group.isJoined) {
        groupJoinButton.className += ' btn-secondary';
        groupJoinButton.innerHTML = '<i class="fas fa-check"></i> 已加入';
        groupJoinButton.disabled = group.name === 'General'; // 不能離開General群組
        
        groupJoinButton.addEventListener('click', () => {
          if (group.name !== 'General') {
            this.connection.leaveGroup(group.name);
          }
        });
      } else {
        groupJoinButton.className += ' btn-primary';
        groupJoinButton.innerHTML = '<i class="fas fa-plus"></i> 加入';
        
        groupJoinButton.addEventListener('click', () => {
          this.connection.joinGroup(group.name);
        });
      }
      
      li.appendChild(groupInfo);
      li.appendChild(groupJoinButton);
      
      availableGroupsList.appendChild(li);
    });
  }

  /**
   * 創建群組標籤頁
   * @param groupName 群組名稱
   */
  private createGroupTab(groupName: string): void {
    // 檢查標籤頁是否已存在
    if (document.querySelector(`.chat-tab[data-group="${groupName}"]`)) {
      return;
    }
    
    const chatTabs = this.domElements.chatTabs as HTMLElement;
    const tab = document.createElement('div');
    tab.className = 'chat-tab';
    tab.dataset.group = groupName;
    tab.textContent = groupName;
    
    // 添加關閉按鈕 (若非"General"群組)
    if (groupName !== 'General') {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close-tab';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.connection.leaveGroup(groupName);
      });
      
      tab.appendChild(closeBtn);
    }
    
    // 點擊標籤頁切換群組
    tab.addEventListener('click', () => {
      this.switchActiveGroup(groupName);
    });
    
    chatTabs.appendChild(tab);
    
    // 創建對應的消息列表
    this.createGroupMessagesList(groupName);
  }

  /**
   * 創建群組消息列表
   * @param groupName 群組名稱
   */
  private createGroupMessagesList(groupName: string): void {
    // 檢查消息列表是否已存在
    if (document.querySelector(`.messages-list[data-group="${groupName}"]`)) {
      return;
    }
    
    const messagesContainer = this.domElements.messagesContainer as HTMLElement;
    const ul = document.createElement('ul');
    ul.className = 'messages-list';
    ul.id = `messagesList-${groupName}`;
    ul.dataset.group = groupName;
    
    // 添加歡迎消息
    const li = document.createElement('li');
    li.textContent = `歡迎來到 ${groupName} 群組！`;
    li.className = 'system-message';
    ul.appendChild(li);
    
    messagesContainer.appendChild(ul);
  }

  /**
   * 移除群組標籤頁和消息列表
   * @param groupName 群組名稱
   */
  private removeGroupTab(groupName: string): void {
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
  }

  /**
   * 切換活動群組
   * @param groupName 群組名稱
   */
  private switchActiveGroup(groupName: string): void {
    // 更新連接管理器中的活動群組
    this.connection.setActiveGroup(groupName);
    
    // 更新當前群組顯示
    const currentGroupName = this.domElements.currentGroupName as HTMLElement;
    currentGroupName.textContent = groupName;
    
    // 更新群組標籤頁高亮
    document.querySelectorAll('.chat-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.getAttribute('data-group') === groupName) {
        tab.classList.add('active');
        tab.classList.remove('unread'); // 清除未讀標記
      }
    });
    
    // 更新群組列表項高亮
    document.querySelectorAll('.groups-list li').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-group') === groupName) {
        item.classList.add('active');
      }
    });
    
    // 更新消息列表顯示
    document.querySelectorAll('.messages-list').forEach(list => {
      list.classList.remove('active');
      if (list.getAttribute('data-group') === groupName) {
        list.classList.add('active');
      }
    });
    
    // 設置焦點到消息輸入框
    const messageInput = this.domElements.messageInput as HTMLInputElement;
    messageInput.focus();
  }

  /**
   * 格式化時間
   * @returns 格式化的時間字串 (HH:MM)
   */
  private formatTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
  }

  /**
   * 從字串生成顏色
   * @param str 輸入字串
   * @returns 十六進位顏色代碼
   */
  private stringToColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }
}

// 導出初始化函數，確保它能被正確識別
export function initChatApp(): void {
  const uiManager = new ChatUIManager();
  
  // 當DOM加載完成時初始化UI
  document.addEventListener('DOMContentLoaded', () => {
    uiManager.initialize().catch(err => {
      console.error('聊天應用初始化失敗:', err);
    });
  });
}

