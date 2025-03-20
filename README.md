# SignalR Chat Application

這是一個使用 ASP.NET Core SignalR 建立的實時聊天應用程式，展示了 SignalR 的核心功能。這個專案提供了一個最小可行性產品 (MVP)，適合開發者學習 SignalR 的基礎知識。

## 功能特點

- **實時通訊**：使用 SignalR 進行即時雙向通訊
- **使用者狀態通知**：顯示用戶連接和斷開連接的通知
- **簡潔的使用者介面**：提供聊天所需的基本功能
- **連接狀態指示器**：顯示與 SignalR Hub 的當前連接狀態
- **響應式設計**：適用於桌面和移動設備
- **群組聊天功能**：支持多個聊天群組
- **強類型Hub**：使用介面定義客戶端和服務器間的通訊協議，提高類型安全性

## 技術棧

- **後端**：ASP.NET Core 8.0
- **前端**：HTML, CSS, JavaScript
- **實時通訊**：SignalR
- **開發工具**：Visual Studio Code
- **測試框架**：xUnit, Moq

## 快速開始

### 前置要求

- [.NET SDK](https://dotnet.microsoft.com/download) (8.0 或更高版本)
- [Visual Studio Code](https://code.visualstudio.com/)
- [C# 擴充套件](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csharp)

### 安裝與運行

1. 克隆存儲庫

```bash
git clone https://github.com/kangcy28/SignalRChat.git
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

4. 在瀏覽器中訪問 `https://localhost:7192` 或 `http://localhost:5067`

## 使用方法

1. 打開應用程式網址
2. 在「使用者名稱」欄位輸入您的名稱
3. 在「訊息」欄位輸入訊息，然後點擊「送出」按鈕或按 Enter 鍵
4. 要測試多人聊天功能，請在其他瀏覽器或標籤中打開相同 URL
5. 點擊「+」按鈕加入不同的聊天群組

## 專案結構

```
SignalRChat/
│
├── Hubs/
│   ├── ChatHub.cs          // 聊天Hub實現（現在使用強類型）
│   ├── IChatClient.cs      // 客戶端介面定義
│   └── IChatHub.cs         // 服務器介面定義
│
├── Tests/                  // 單元測試
│   └── ChatHubTests.cs
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
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
└── SignalRChat.csproj
```

## 代碼說明

### 強類型 SignalR Hub

聊天功能的核心是 `ChatHub` 類，現在它實現了強類型介面：

```csharp
// 強類型Hub定義
public class ChatHub : Hub<IChatClient>, IChatHub
{
    // Hub方法實現
    public async Task SendMessage(string user, string message)
    {
        // 發送消息給所有連接的客戶端
        await Clients.All.ReceiveMessage(user, message);
    }
    
    // 其他方法...
}
```

### 客戶端介面定義

```csharp
// 定義服務器可調用的客戶端方法
public interface IChatClient
{
    Task ReceiveMessage(string user, string message);
    Task ReceiveGroupMessage(string user, string groupName, string message);
    Task UserConnected(string username);
    // 其他方法...
}
```

### 服務器介面定義

```csharp
// 定義客戶端可調用的服務器方法
public interface IChatHub
{
    Task SendMessage(string user, string message);
    Task SendGroupMessage(string user, string groupName, string message);
    Task JoinGroup(string groupName);
    // 其他方法...
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

## 如何運行測試

本專案包含單元測試以確保功能正常。要運行測試，請執行：

```bash
dotnet test
```

## 強類型Hub的優勢

- **編譯時類型檢查**：減少運行時錯誤
- **更好的IDE支持**：提供自動完成和參數提示
- **重構友好**：重命名方法會自動更新所有引用
- **清晰的API定義**：明確定義客戶端和服務器可用的方法
- **易於測試**：可以方便地進行單元測試

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
- 添加更多群組聊天功能
- 支持發送圖片和檔案
- 添加已讀回執功能
- 實現訊息持久化存儲
- 添加表情符號和富文本支持
- 使用TypeScript實現前端強類型

## 學習資源

- [SignalR 官方文檔](https://docs.microsoft.com/aspnet/core/signalr/introduction)
- [ASP.NET Core SignalR JavaScript 客戶端](https://docs.microsoft.com/aspnet/core/signalr/javascript-client)
- [SignalR Hub API](https://docs.microsoft.com/aspnet/core/signalr/hubs)
- [強類型Hub文檔](https://docs.microsoft.com/aspnet/core/signalr/hub-protocol)

## 許可證

這個專案採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 聯繫方式

如果您有任何問題或建議，請通過以下方式聯繫我：

- GitHub Issues: [建立新 Issue](https://github.com/kangcy28/SignalRChat/issues)
- Email: kcy0928@gmail.com