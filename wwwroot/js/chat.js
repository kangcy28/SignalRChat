"use strict";

// 當前用戶名稱 (用於區分自己的訊息)
let currentUsername = "";

// 建立 SignalR 連接
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

// DOM 元素參考
const sendButton = document.getElementById("sendButton");
const messageInput = document.getElementById("messageInput");
const userInput = document.getElementById("userInput");
const messagesList = document.getElementById("messagesList");
const connectionStatus = document.getElementById("connectionStatus");
const statusIndicator = document.getElementById("statusIndicator");
const userList = document.getElementById("userList");
const onlineCount = document.getElementById("onlineCount");

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

// 接收訊息事件
connection.on("ReceiveMessage", function (user, message) {
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

// 用戶連接事件 - 使用用戶名
connection.on("UserConnected", function (username) {
    const li = document.createElement("li");
    li.textContent = `${username} 已加入聊天室`;
    li.className = "system-message";
    messagesList.appendChild(li);
    
    // 自動滾動到最新訊息
    messagesList.scrollTop = messagesList.scrollHeight;
});

// 用戶斷開連接事件 - 使用用戶名
connection.on("UserDisconnected", function (username) {
    const li = document.createElement("li");
    li.textContent = `${username} 已離開聊天室`;
    li.className = "system-message";
    messagesList.appendChild(li);
    
    // 自動滾動到最新訊息
    messagesList.scrollTop = messagesList.scrollHeight;
});

// 更新用戶列表事件
connection.on("UpdateUserList", function (users) {
    updateUserList(users);
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
        
        // 設置用戶名
        setUsername(username);
        
        // 在頁面載入時添加歡迎訊息
        const li = document.createElement("li");
        li.textContent = `歡迎來到聊天室，${username}！`;
        li.className = "system-message";
        messagesList.appendChild(li);
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
        connection.invoke("SendMessage", user, message)
            .catch(function (err) {
                console.error(err.toString());
            });
        messageInput.value = "";
        messageInput.focus();
    }
}