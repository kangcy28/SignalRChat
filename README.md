# SignalR Chat Application

這是一個使用 ASP.NET Core SignalR 建立的實時聊天應用程式，展示了 SignalR 的核心功能。這個專案提供了一個最小可行性產品 (MVP)，適合開發者學習 SignalR 的基礎知識。


## 功能特點

- **實時通訊**：使用 SignalR 進行即時雙向通訊
- **使用者狀態通知**：顯示用戶連接和斷開連接的通知
- **簡潔的使用者介面**：提供聊天所需的基本功能
- **連接狀態指示器**：顯示與 SignalR Hub 的當前連接狀態
- **響應式設計**：適用於桌面和移動設備

## 技術棧

- **後端**：ASP.NET Core 6.0
- **前端**：HTML, CSS, JavaScript
- **實時通訊**：SignalR
- **開發工具**：Visual Studio Code

## 快速開始

### 前置要求

- [.NET SDK](https://dotnet.microsoft.com/download) (6.0 或更高版本)
- [Visual Studio Code](https://code.visualstudio.com/)
- [C# 擴充套件](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp)

### 安裝與運行

1. 克隆存儲庫

```bash
git clone https://github.com/yourusername/SignalRChat.git
cd SignalRChat
```

2. 還原依賴項

```bash
dotnet restore
```

3. 運行應用程式

```bash
dotnet run
```

4. 在瀏覽器中訪問 `https://localhost:5001` 或 `http://localhost:5000`

## 使用方法

1. 打開應用程式網址
2. 在「使用者名稱」欄位輸入您的名稱
3. 在「訊息」欄位輸入訊息，然後點擊「送出」按鈕或按 Enter 鍵
4. 要測試多人聊天功能，請在其他瀏覽器或標籤中打開相同 URL

## 專案結構

```
SignalRChat/
│
├── Properties/
│   └── launchSettings.json
│
├── wwwroot/
│   ├── css/
│   │   └── site.css
│   ├── js/
│   │   └── chat.js
│   └── index.html
│
├── Hubs/
│   └── ChatHub.cs
│
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
└── SignalRChat.csproj
```

## 代碼說明

### SignalR Hub

聊天功能的核心是 `ChatHub` 類，它處理所有實時通訊：

```csharp
public class ChatHub : Hub
{
    public async Task SendMessage(string user, string message)
    {
        // 廣播訊息給所有連接的客戶端
        await Clients.All.SendAsync("ReceiveMessage", user, message);
    }
    
    public override async Task OnConnectedAsync()
    {
        // 當有新用戶連接時通知所有人
        await Clients.All.SendAsync("UserConnected", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // 當用戶斷開連接時通知所有人
        await Clients.All.SendAsync("UserDisconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
```

### 客戶端 JavaScript

前端使用 SignalR JavaScript 客戶端庫與 Hub 進行通訊：

```javascript
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

// 接收訊息事件
connection.on("ReceiveMessage", function (user, message) {
    const li = document.createElement("li");
    li.textContent = `${user} 說: ${message}`;
    messagesList.appendChild(li);
});
```

## 如何貢獻

1. Fork 這個專案
2. 創建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟一個 Pull Request

## 擴展想法

這個 MVP 可以通過以下方式進行擴展：

- 添加用戶認證系統
- 實現私人聊天功能
- 添加群組聊天功能
- 支持發送圖片和檔案
- 添加已讀回執功能
- 實現訊息持久化存儲
- 添加表情符號和富文本支持

## 學習資源

- [SignalR 官方文檔](https://docs.microsoft.com/aspnet/core/signalr/introduction)
- [ASP.NET Core SignalR JavaScript 客戶端](https://docs.microsoft.com/aspnet/core/signalr/javascript-client)
- [SignalR Hub API](https://docs.microsoft.com/aspnet/core/signalr/hubs)

## 許可證

這個專案採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 聯繫方式

如果您有任何問題或建議，請通過以下方式聯繫我：

- GitHub Issues: [建立新 Issue](https://github.com/kangcy28/SignalRChat/issues)
- Email: kcy0928@gmail.com
