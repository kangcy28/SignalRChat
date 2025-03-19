"use strict";

// 當前用戶名稱 (用於區分自己的訊息)
let currentUsername = "";

// 當前活動群組
let activeGroup = "General";

// 用戶所屬的群組列表
let userGroups = [];

// 建立 SignalR 連接
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .withAutomaticReconnect([0, 1000, 5000, 10000]) // 新增: 自動重連
    .build();

// DOM 元素參考
const sendButton = document.getElementById("sendButton");
const messageInput = document.getElementById("messageInput");
const userInput = document.getElementById("userInput");
const messagesList = document.getElementById("messagesList");
const messagesContainer = document.getElementById("messagesContainer");
const connectionStatus = document.getElementById("connectionStatus");
const statusIndicator = document.getElementById("statusIndicator");
const userList = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");
const currentGroupName = document.getElementById("currentGroupName");
const userGroupsList = document.getElementById("userGroupsList");
const chatTabs = document.querySelector(".chat-tabs");

// 群組對話框元素
const showGroupsBtn = document.getElementById("showGroupsBtn");
const groupsModal = document.getElementById("groupsModal");
const closeGroupsBtn = document.getElementById("closeGroupsBtn");
const availableGroupsList = document.getElementById("availableGroupsList");

// 禁用傳送按鈕直到連接建立
sendButton.disabled = true;

// 格式化時間的輔助函數
function formatTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
}

// 生成用戶頭像顏色的輔助函數
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// 設置用戶名函數
function setUsername(username) {
    // 保存當前用戶名以識別自己的訊息
    currentUsername = username;
    
    // 保存用戶名到 localStorage 以便持久化
    localStorage.setItem("chatUsername", username);
    userInput.value = username;
    
    // 向服務器註冊用戶名
    connection.invoke("RegisterUsername", username)
        .catch(function (err) {
            console.error("註冊用戶名時出錯:", err.toString());
        });
}

// 更新用戶列表函數
function updateUserList(users) {
    // 清空現有列表
    userList.innerHTML = "";
    
    // 添加每個用戶到列表
    users.forEach(user => {
        const li = document.createElement("li");
        
        // 創建用戶頭像元素
        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        avatar.style.backgroundColor = stringToColor(user);
        avatar.textContent = user.charAt(0).toUpperCase();
        
        // 創建用戶名稱元素
        const username = document.createElement("span");
        username.textContent = user;
        
        // 添加到列表項
        li.appendChild(avatar);
        li.appendChild(username);
        
        // 如果是當前用戶，高亮顯示
        if (user === currentUsername) {
            li.style.fontWeight = "bold";
        }
        
        userList.appendChild(li);
    });
    
    // 更新在線用戶計數
    if (onlineCount) {
        onlineCount.textContent = users.length;
    }
}

// 新增: 切換活動群組
function switchActiveGroup(groupName) {
    // 更新活動群組
    activeGroup = groupName;
    
    // 更新當前群組顯示
    currentGroupName.textContent = groupName;
    
    // 更新群組標籤頁高亮
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.group === groupName) {
            tab.classList.add('active');
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
    messageInput.focus();
}

// 新增: 創建群組標籤頁
function createGroupTab(groupName) {
    // 檢查標籤頁是否已存在
    if (document.querySelector(`.chat-tab[data-group="${groupName}"]`)) {
        return;
    }
    
    const tab = document.createElement("div");
    tab.className = "chat-tab";
    tab.dataset.group = groupName;
    tab.textContent = groupName;
    
    // 添加關閉按鈕 (若非"General"群組)
    if (groupName !== "General") {
        const closeBtn = document.createElement("span");
        closeBtn.className = "close-tab";
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", function(event) {
            event.stopPropagation();
            connection.invoke("LeaveGroup", groupName)
                .catch(function (err) {
                    console.error("離開群組時出錯:", err.toString());
                });
        });
        
        tab.appendChild(closeBtn);
    }
    
    // 點擊標籤頁切換群組
    tab.addEventListener("click", function() {
        switchActiveGroup(groupName);
    });
    
    chatTabs.appendChild(tab);
    
    // 創建對應的消息列表
    createGroupMessagesList(groupName);
}

// 新增: 創建群組消息列表
function createGroupMessagesList(groupName) {
    // 檢查消息列表是否已存在
    if (document.querySelector(`.messages-list[data-group="${groupName}"]`)) {
        return;
    }
    
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
}

// 新增: 更新用戶群組列表
function updateUserGroupsList(groups) {
    userGroups = groups;
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
        
        // 群組操作按鈕
        const groupActions = document.createElement("div");
        groupActions.className = "group-actions";
        
        // 離開群組按鈕 (一般群組不能離開)
        if (group.name !== "General") {
            const leaveBtn = document.createElement("button");
            leaveBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i>`;
            leaveBtn.title = "離開群組";
            
            leaveBtn.addEventListener("click", function(event) {
                event.stopPropagation();
                connection.invoke("LeaveGroup", group.name)
                    .catch(function (err) {
                        console.error("離開群組時出錯:", err.toString());
                    });
            });
            
            groupActions.appendChild(leaveBtn);
        }
        
        li.appendChild(groupName);
        li.appendChild(groupActions);
        
        // 點擊群組列表項切換到該群組
        li.addEventListener("click", function() {
            switchActiveGroup(group.name);
        });
        
        userGroupsList.appendChild(li);
        
        // 確保該群組有對應的標籤頁和消息列表
        createGroupTab(group.name);
    });
}

// 新增: 更新可用群組列表
function updateAvailableGroupsList(groups) {
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
        
        if (group.isJoined) {
            groupJoinButton.className += " btn-secondary";
            groupJoinButton.innerHTML = '<i class="fas fa-check"></i> 已加入';
            groupJoinButton.disabled = group.name === "General"; // 不能離開 General 群組
            
            groupJoinButton.addEventListener("click", function() {
                if (group.name !== "General") {
                    connection.invoke("LeaveGroup", group.name)
                        .catch(function (err) {
                            console.error("離開群組時出錯:", err.toString());
                        });
                }
            });
        } else {
            groupJoinButton.className += " btn-primary";
            groupJoinButton.innerHTML = '<i class="fas fa-plus"></i> 加入';
            
            groupJoinButton.addEventListener("click", function() {
                connection.invoke("JoinGroup", group.name)
                    .catch(function (err) {
                        console.error("加入群組時出錯:", err.toString());
                    });
            });
        }
        
        li.appendChild(groupInfo);
        li.appendChild(groupJoinButton);
        
        availableGroupsList.appendChild(li);
    });
}

// 接收訊息事件
connection.on("ReceiveMessage", function (user, message) {
    // 將消息顯示在 General 群組
    const messagesList = document.querySelector('.messages-list[data-group="General"]');
    
    const li = document.createElement("li");
    const isSelf = user === currentUsername;
    
    // 設置訊息樣式（自己的訊息與他人訊息區分）
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
    timeElement.textContent = formatTime();
    
    // 添加元素到列表項
    li.appendChild(usernameElement);
    li.appendChild(messageElement);
    li.appendChild(timeElement);
    
    messagesList.appendChild(li);
    
    // 自動滾動到最新訊息
    messagesList.scrollTop = messagesList.scrollHeight;
});

// 新增: 接收群組訊息事件
connection.on("ReceiveGroupMessage", function (user, groupName, message) {
    // 尋找對應群組的消息列表
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
    
    if (groupMessagesList) {
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
        timeElement.textContent = formatTime();
        
        // 添加元素到列表項
        li.appendChild(usernameElement);
        li.appendChild(messageElement);
        li.appendChild(timeElement);
        
        groupMessagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
        
        // 如果不是當前活動群組，在標籤頁上添加未讀標記
        if (groupName !== activeGroup) {
            const groupTab = document.querySelector(`.chat-tab[data-group="${groupName}"]`);
            if (groupTab && !groupTab.classList.contains("unread")) {
                groupTab.classList.add("unread");
            }
        }
    }
});

// 用戶連接事件 - 使用用戶名
connection.on("UserConnected", function (username) {
    // 在所有已加入的群組中顯示用戶加入訊息
    userGroups.forEach(group => {
        const messagesList = document.querySelector(`.messages-list[data-group="${group.name}"]`);
        if (messagesList) {
            const li = document.createElement("li");
            li.textContent = `${username} 已加入聊天室`;
            li.className = "system-message";
            messagesList.appendChild(li);
            
            // 自動滾動到最新訊息
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    });
});

// 用戶斷開連接事件 - 使用用戶名
connection.on("UserDisconnected", function (username) {
    // 在所有已加入的群組中顯示用戶離開訊息
    userGroups.forEach(group => {
        const messagesList = document.querySelector(`.messages-list[data-group="${group.name}"]`);
        if (messagesList) {
            const li = document.createElement("li");
            li.textContent = `${username} 已離開聊天室`;
            li.className = "system-message";
            messagesList.appendChild(li);
            
            // 自動滾動到最新訊息
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    });
});

// 更新用戶列表事件
connection.on("UpdateUserList", function (users) {
    updateUserList(users);
});

// 新增: 更新用戶群組列表事件
connection.on("UpdateUserGroups", function (groups) {
    updateUserGroupsList(groups);
});

// 新增: 可用群組列表事件
connection.on("AvailableGroups", function (groups) {
    updateAvailableGroupsList(groups);
    groupsModal.classList.add("show");
});

// 新增: 加入群組事件
connection.on("JoinedGroup", function (groupName) {
    // 添加系統消息到群組
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
    if (groupMessagesList) {
        const li = document.createElement("li");
        li.textContent = `您已加入 ${groupName} 群組`;
        li.className = "system-message";
        groupMessagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
    }
    
    // 如果是首次加入該群組，切換到該群組
    if (groupName !== "General" && !document.querySelector(`.chat-tab[data-group="${groupName}"]`)) {
        switchActiveGroup(groupName);
    }
});

// 新增: 離開群組事件
connection.on("LeftGroup", function (groupName) {
    // 如果當前活動群組是被離開的群組，切換到 General
    if (activeGroup === groupName) {
        switchActiveGroup("General");
    }
    
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
});

// 新增: 用戶加入群組事件
connection.on("UserJoinedGroup", function (username, groupName) {
    // 將用戶加入消息添加到對應群組
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
    if (groupMessagesList) {
        const li = document.createElement("li");
        li.textContent = `${username} 已加入群組`;
        li.className = "system-message";
        groupMessagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
    }
});

// 新增: 用戶離開群組事件
connection.on("UserLeftGroup", function (username, groupName) {
    // 將用戶離開消息添加到對應群組
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
    if (groupMessagesList) {
        const li = document.createElement("li");
        li.textContent = `${username} 已離開群組`;
        li.className = "system-message";
        groupMessagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
    }
});

// 新增: 用戶在群組中改名事件
connection.on("UserRenamedInGroup", function (oldUsername, newUsername, groupName) {
    // 將用戶改名消息添加到對應群組
    const groupMessagesList = document.querySelector(`.messages-list[data-group="${groupName}"]`);
    if (groupMessagesList) {
        const li = document.createElement("li");
        li.textContent = `用戶 ${oldUsername} 已更改名稱為 ${newUsername}`;
        li.className = "system-message";
        groupMessagesList.appendChild(li);
        
        // 自動滾動到最新訊息
        groupMessagesList.scrollTop = groupMessagesList.scrollHeight;
    }
});

// 新增: 群組錯誤事件
connection.on("GroupError", function (errorMessage) {
    // 顯示錯誤消息
    alert(errorMessage);
});

// 開始連接
connection.start()
    .then(function () {
        connectionStatus.textContent = "已連接";
        statusIndicator.classList.add("status-connected");
        sendButton.disabled = false;
        console.log("SignalR 連接已建立");
        
        // 從 localStorage 讀取用戶名，如果沒有則提示輸入
        let username = localStorage.getItem("chatUsername");
        if (!username) {
            username = prompt("請輸入您的用戶名:", "用戶" + Math.floor(Math.random() * 1000));
            if (!username) {
                username = "用戶" + Math.floor(Math.random() * 1000);
            }
        }
        const generalTab = document.querySelector('.chat-tab[data-group="General"]');
        if (generalTab && !generalTab.hasAttribute('listener')) {
            generalTab.addEventListener("click", function() {
                switchActiveGroup("General");
            });
            generalTab.setAttribute('listener', 'true');
        }
        // 設置用戶名
        setUsername(username);
        
        // 在頁面載入時添加歡迎訊息
        const li = document.createElement("li");
        li.textContent = `歡迎來到聊天室，${username}！`;
        li.className = "system-message";
        messagesList.appendChild(li);
        
        // 新增: 獲取可用群組列表
        connection.invoke("GetAvailableGroups")
            .catch(function (err) {
                console.error("獲取群組列表時出錯:", err.toString());
            });
    })
    .catch(function (err) {
        connectionStatus.textContent = "連接失敗";
        statusIndicator.classList.add("status-disconnected");
        console.error(err.toString());
    });

// 綁定傳送按鈕點擊事件
sendButton.addEventListener("click", function (event) {
    sendMessage();
    event.preventDefault();
});

// 綁定訊息輸入框的 Enter 鍵事件
messageInput.addEventListener("keyup", function (event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// 允許用戶更改用戶名
userInput.addEventListener("change", function (event) {
    const newUsername = userInput.value.trim();
    if (newUsername) {
        // 添加用戶名更改的系統訊息
        if (currentUsername && currentUsername !== newUsername) {
            const li = document.createElement("li");
            li.textContent = `您已將用戶名從 "${currentUsername}" 更改為 "${newUsername}"`;
            li.className = "system-message";
            messagesList.appendChild(li);
        }
        
        setUsername(newUsername);
    }
});

// 傳送訊息函式
function sendMessage() {
    const user = userInput.value || "匿名用戶";
    const message = messageInput.value.trim();
    
    if (message) {
        // 新增: 根據當前活動群組發送消息
        if (activeGroup === "General") {
            // 發送到所有用戶
            connection.invoke("SendMessage", user, message)
                .catch(function (err) {
                    console.error(err.toString());
                });
        } else {
            // 發送到特定群組
            connection.invoke("SendGroupMessage", user, activeGroup, message)
                .catch(function (err) {
                    console.error(err.toString());
                });
        }
        
        messageInput.value = "";
        messageInput.focus();
    }
}

// 新增: 群組對話框相關事件
showGroupsBtn.addEventListener("click", function() {
    connection.invoke("GetAvailableGroups")
        .catch(function (err) {
            console.error("獲取群組列表時出錯:", err.toString());
        });
});

closeGroupsBtn.addEventListener("click", function() {
    groupsModal.classList.remove("show");
});

// 點擊對話框外部關閉對話框
groupsModal.addEventListener("click", function(event) {
    if (event.target === groupsModal) {
        groupsModal.classList.remove("show");
    }
});

// 初始化：創建一般群組標籤和消息列表
createGroupTab("General");
switchActiveGroup("General");

// 在文件加載完成後運行
document.addEventListener('DOMContentLoaded', function() {
    // 確保所有標籤頁都能點擊切換群組
    document.querySelectorAll('.chat-tab').forEach(tab => {
        if (!tab.hasAttribute('listener')) {
            tab.addEventListener('click', function() {
                const groupName = tab.dataset.group;
                if (groupName) {
                    switchActiveGroup(groupName);
                }
            });
            tab.setAttribute('listener', 'true');
        }
    });
});