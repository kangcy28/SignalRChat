"use strict";

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

// 禁用傳送按鈕直到連接建立
sendButton.disabled = true;

// 接收訊息事件
connection.on("ReceiveMessage", function (user, message) {
    const li = document.createElement("li");
    li.textContent = `${user} 說: ${message}`;
    messagesList.appendChild(li);
    // 自動滾動到最新訊息
    messagesList.scrollTop = messagesList.scrollHeight;
});

// 用戶連接事件
connection.on("UserConnected", function (connectionId) {
    const li = document.createElement("li");
    li.textContent = `新用戶已連接 (ID: ${connectionId.substr(0, 5)}...)`;
    li.className = "system-message";
    messagesList.appendChild(li);
});

// 用戶斷開連接事件
connection.on("UserDisconnected", function (connectionId) {
    const li = document.createElement("li");
    li.textContent = `用戶已斷開連接 (ID: ${connectionId.substr(0, 5)}...)`;
    li.className = "system-message";
    messagesList.appendChild(li);
});

// 開始連接
connection.start()
    .then(function () {
        connectionStatus.textContent = "連線狀態: 已連接";
        sendButton.disabled = false;
        console.log("SignalR 連接已建立");
    })
    .catch(function (err) {
        connectionStatus.textContent = "連線狀態: 連接失敗";
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

// 傳送訊息函式
function sendMessage() {
    const user = userInput.value || "匿名用戶";
    const message = messageInput.value;
    
    if (message) {
        connection.invoke("SendMessage", user, message)
            .catch(function (err) {
                console.error(err.toString());
            });
        messageInput.value = "";
        messageInput.focus();
    }
}