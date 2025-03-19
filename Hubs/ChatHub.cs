using Microsoft.AspNetCore.SignalR;

namespace SignalRChat.Hubs
{
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
}