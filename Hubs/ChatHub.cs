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

        // 新增: 用戶所屬群組的字典：ConnectionId -> List<GroupName>
        private static readonly Dictionary<string, List<string>> UserGroups = new Dictionary<string, List<string>>();

        // 新增: 群組描述字典：GroupName -> Description
        private static readonly Dictionary<string, string> GroupDescriptions = new Dictionary<string, string>
        {
            { "General", "一般討論群組" },
            { "Technical", "技術討論群組" },
            { "Random", "隨意聊天群組" }
        };

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

        // 新增: 發送群組消息方法
        public async Task SendGroupMessage(string user, string groupName, string message)
        {
            string connectionId = Context.ConnectionId;
            // 確保用戶在嘗試發送的群組中
            bool isInGroup = false;

            if (UserGroups.ContainsKey(connectionId))
            {
                isInGroup = UserGroups[connectionId].Contains(groupName);
            }

            if (isInGroup)
            {
                // 發送消息給群組成員
                await Clients.Group(groupName).SendAsync("ReceiveGroupMessage", user, groupName, message);
            }
            else
            {
                // 通知用戶他不在群組中
                await Clients.Caller.SendAsync("GroupError", $"您不是群組 '{groupName}' 的成員，無法發送消息。");
            }
        }

        // 新增: 加入群組方法
        public async Task JoinGroup(string groupName)
        {
            string connectionId = Context.ConnectionId;
            string username = ConnectedUsers.ContainsKey(connectionId) ? ConnectedUsers[connectionId] : connectionId;

            // 將用戶添加到SignalR群組
            await Groups.AddToGroupAsync(connectionId, groupName);

            // 將群組添加到用戶的群組列表中
            if (!UserGroups.ContainsKey(connectionId))
            {
                UserGroups[connectionId] = new List<string>();
            }

            if (!UserGroups[connectionId].Contains(groupName))
            {
                UserGroups[connectionId].Add(groupName);
            }

            // 通知用戶成功加入群組
            await Clients.Caller.SendAsync("JoinedGroup", groupName);

            // 通知群組其他成員有新用戶加入
            await Clients.Group(groupName).SendAsync("UserJoinedGroup", username, groupName);

            // 發送更新後的群組列表給用戶
            await SendUserGroupsList(connectionId);
        }

        // 新增: 離開群組方法
        public async Task LeaveGroup(string groupName)
        {
            string connectionId = Context.ConnectionId;
            string username = ConnectedUsers.ContainsKey(connectionId) ? ConnectedUsers[connectionId] : connectionId;

            // 將用戶從SignalR群組中移除
            await Groups.RemoveFromGroupAsync(connectionId, groupName);

            // 從用戶的群組列表中移除群組
            if (UserGroups.ContainsKey(connectionId) && UserGroups[connectionId].Contains(groupName))
            {
                UserGroups[connectionId].Remove(groupName);
            }

            // 通知用戶成功離開群組
            await Clients.Caller.SendAsync("LeftGroup", groupName);

            // 通知群組其他成員有用戶離開
            await Clients.Group(groupName).SendAsync("UserLeftGroup", username, groupName);

            // 發送更新後的群組列表給用戶
            await SendUserGroupsList(connectionId);
        }

        // 新增: 獲取可用群組列表方法
        public async Task GetAvailableGroups()
        {
            List<object> groups = new List<object>();

            foreach (var group in GroupDescriptions)
            {
                groups.Add(new
                {
                    Name = group.Key,
                    Description = group.Value,
                    IsJoined = IsUserInGroup(Context.ConnectionId, group.Key)
                });
            }

            await Clients.Caller.SendAsync("AvailableGroups", groups);
        }

        // 註冊用戶名方法
        public async Task RegisterUsername(string username)
        {
            string connectionId = Context.ConnectionId;
            string oldUsername = null;

            lock (ConnectedUsers)
            {
                // 檢查是否已有用戶名，用於記錄變更
                if (ConnectedUsers.ContainsKey(connectionId))
                {
                    oldUsername = ConnectedUsers[connectionId];
                }

                // 更新或添加用戶名
                ConnectedUsers[connectionId] = username;
            }

            // 廣播用戶連接訊息（使用用戶名而非 connectionId）
            await Clients.Others.SendAsync("UserConnected", username);

            // 新增: 如果用戶名變更了，更新所有群組中的顯示
            if (oldUsername != null && oldUsername != username)
            {
                if (UserGroups.ContainsKey(connectionId))
                {
                    foreach (var group in UserGroups[connectionId])
                    {
                        await Clients.Group(group).SendAsync("UserRenamedInGroup", oldUsername, username, group);
                    }
                }
            }

            // 發送當前用戶列表
            await SendConnectedUsersList();
        }

        // 當用戶連接時
        public override async Task OnConnectedAsync()
        {
            // 不在這裡添加用戶到字典，等待用戶主動註冊用戶名

            // 通知其他客戶端有新連接
            await Clients.Others.SendAsync("UserConnected", Context.ConnectionId);

            // 新增: 自動將用戶加入"General"群組
            await JoinGroup("General");

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

            // 新增: 當用戶斷開時，從所有群組中移除
            if (UserGroups.ContainsKey(connectionId))
            {
                List<string> userGroupsCopy = new List<string>(UserGroups[connectionId]);
                foreach (var group in userGroupsCopy)
                {
                    // 通知群組其他成員有用戶離開
                    await Clients.Group(group).SendAsync("UserLeftGroup", username ?? connectionId, group);
                }

                UserGroups.Remove(connectionId);
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

        // 新增: 輔助方法：發送用戶的群組列表
        private async Task SendUserGroupsList(string connectionId)
        {
            if (UserGroups.ContainsKey(connectionId))
            {
                List<object> groups = new List<object>();

                foreach (var groupName in UserGroups[connectionId])
                {
                    groups.Add(new
                    {
                        Name = groupName,
                        Description = GroupDescriptions.ContainsKey(groupName) ? GroupDescriptions[groupName] : ""
                    });
                }

                await Clients.Client(connectionId).SendAsync("UpdateUserGroups", groups);
            }
        }

        // 新增: 輔助方法：檢查用戶是否在特定群組中
        private bool IsUserInGroup(string connectionId, string groupName)
        {
            if (UserGroups.ContainsKey(connectionId))
            {
                return UserGroups[connectionId].Contains(groupName);
            }
            return false;
        }
    }
}