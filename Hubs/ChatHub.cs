using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SignalRChat.Hubs
{
    public class ChatHub : Hub
    {
        // 靜態字典，存儲當前連接的用戶：ConnectionId -> 用戶名
        private static readonly Dictionary<string, string> ConnectedUsers = new Dictionary<string, string>();

        // 發送消息方法
        public async Task SendMessage(string user, string message)
        {
            // 記錄用戶名（如果之前沒有註冊過）
            string connectionId = Context.ConnectionId;
            if (!ConnectedUsers.ContainsKey(connectionId))
            {
                ConnectedUsers[connectionId] = user;
                // 通知所有用戶更新用戶列表
                await SendConnectedUsersList();
            }

            await Clients.All.SendAsync("ReceiveMessage", user, message);
        }

        // 註冊用戶名方法
        public async Task RegisterUsername(string username)
        {
            string connectionId = Context.ConnectionId;
            
            lock (ConnectedUsers)
            {
                // 更新或添加用戶名
                ConnectedUsers[connectionId] = username;
            }
            
            // 廣播用戶連接訊息（使用用戶名而非 connectionId）
            await Clients.Others.SendAsync("UserConnected", username);
            
            // 發送當前用戶列表
            await SendConnectedUsersList();
        }

        // 當用戶連接時
        public override async Task OnConnectedAsync()
        {
            // 不在這裡添加用戶到字典，等待用戶主動註冊用戶名
            
            // 通知其他客戶端有新連接
            await Clients.Others.SendAsync("UserConnected", Context.ConnectionId);
            
            await base.OnConnectedAsync();
        }

        // 當用戶斷開連接時
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            string connectionId = Context.ConnectionId;
            string username = null;
            
            lock (ConnectedUsers)
            {
                // 如果用戶在字典中，則記錄其用戶名並移除
                if (ConnectedUsers.TryGetValue(connectionId, out username))
                {
                    ConnectedUsers.Remove(connectionId);
                }
            }
            
            // 通知其他客戶端有用戶斷開連接
            if (username != null)
            {
                await Clients.Others.SendAsync("UserDisconnected", username);
            }
            else
            {
                await Clients.Others.SendAsync("UserDisconnected", connectionId);
            }
            
            // 更新用戶列表
            await SendConnectedUsersList();
            
            await base.OnDisconnectedAsync(exception);
        }
        
        // 輔助方法：發送當前連接用戶列表
        private async Task SendConnectedUsersList()
        {
            List<string> usernames = new List<string>();
            
            lock (ConnectedUsers)
            {
                usernames.AddRange(ConnectedUsers.Values);
            }
            
            await Clients.All.SendAsync("UpdateUserList", usernames);
        }
    }
}