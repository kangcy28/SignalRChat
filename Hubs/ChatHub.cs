using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SignalRChat.Hubs
{
    /// <summary>
    /// 聊天Hub，實現強類型IChatHub接口
    /// </summary>
    public class ChatHub : Hub<IChatClient>, IChatHub
    {
        // 靜態字典，存儲當前連接的用戶：ConnectionId -> 用戶名
        private static readonly Dictionary<string, string> ConnectedUsers = new Dictionary<string, string>();

        // 用戶所屬群組的字典：ConnectionId -> List<GroupName>
        private static readonly Dictionary<string, List<string>> UserGroups = new Dictionary<string, List<string>>();

        // 群組描述字典：GroupName -> Description
        private static readonly Dictionary<string, string> GroupDescriptions = new Dictionary<string, string>
        {
            { "General", "一般討論群組" },
            { "Technical", "技術討論群組" },
            { "Random", "隨意聊天群組" }
        };
        private readonly GlobalMessageFilter _messageFilter;

        // 通過依賴注入提供過濾器
        public ChatHub(GlobalMessageFilter messageFilter)
        {
            _messageFilter = messageFilter;
        }
        // 發送消息方法
        public async Task SendMessage(string user, string message)
        {
            try 
            {
                // 先進行消息驗證
                bool isValidMessage = await _messageFilter.InterceptMessage(user, message, nameof(SendMessage));
                // 記錄用戶名（只有在首次連接或用戶名變更時）
                string connectionId = Context.ConnectionId;
                bool shouldUpdateUsersList = false;

                if (!ConnectedUsers.ContainsKey(connectionId))
                {
                    ConnectedUsers[connectionId] = user;
                    shouldUpdateUsersList = true;
                }
                else if (ConnectedUsers[connectionId] != user)
                {
                    ConnectedUsers[connectionId] = user;
                    shouldUpdateUsersList = true;
                }

                // 只有在需要時才通知所有用戶更新用戶列表
                if (shouldUpdateUsersList)
                {
                    await SendConnectedUsersList();
                }

                // 使用強類型調用客戶端方法
                if (isValidMessage)
                {
                    // 原有的發送邏輯
                    await Clients.All.ReceiveMessage(user, message);
                }
                else
                {
                    // 發送錯誤通知
                    await Clients.Caller.GroupError("消息未能通過安全檢查");
                }
            }
            catch (HubException ex)
            {
                // 將驗證錯誤發送給發送者
                await Clients.Caller.GroupError(ex.Message);
            }
        }

        /// <summary>
        /// 用戶正在輸入狀態
        /// </summary>
        /// <param name="username">用戶名</param>
        /// <param name="groupName">群組名稱</param>
        /// <param name="isTyping">是否正在輸入</param>
        public async Task UserTyping(string username, string groupName, bool isTyping)
        {
            // 確保用戶在嘗試發送的群組中
            bool isInGroup = false;
            string connectionId = Context.ConnectionId;

            if (UserGroups.ContainsKey(connectionId))
            {
                isInGroup = UserGroups[connectionId].Contains(groupName);
            }

            if (isInGroup)
            {
                // 向群組中的其他用戶廣播輸入狀態
                await Clients.OthersInGroup(groupName).UserTyping(username, groupName, isTyping);
            }
        }
        public Task Echo()
        {
            // 簡單返回 Task，用於測量連接延遲
            return Task.CompletedTask;
        }
        // 發送群組消息方法
        public async Task SendGroupMessage(string user, string groupName, string message)
        {
            try 
            {
                Console.WriteLine("wow");
                // 先進行消息驗證
                bool isValidMessage = await _messageFilter.InterceptMessage(
            user, message, nameof(SendMessage));
                Console.WriteLine(message);
                string connectionId = Context.ConnectionId;
                // 確保用戶在嘗試發送的群組中
                bool isInGroup = false;

                if (UserGroups.ContainsKey(connectionId))
                {
                    isInGroup = UserGroups[connectionId].Contains(groupName);
                }

                if (isInGroup)
                {
                    // 使用強類型調用客戶端方法
                    
                    if (isValidMessage)
                    {
                        // 原有的發送邏輯
                        await Clients.Group(groupName).ReceiveGroupMessage(user, groupName, message);
                    }
                    else
                    {
                        // 發送錯誤通知
                        await Clients.Caller.GroupError("消息未能通過安全檢查");
                    }
                }
                else
                {
                    // 通知用戶他不在群組中
                    await Clients.Caller.GroupError($"您不是群組 '{groupName}' 的成員，無法發送消息。");
                }
            }
            catch (HubException ex)
            {
                // 將驗證錯誤發送給發送者
                await Clients.Caller.GroupError(ex.Message);
            }
        }

        // 加入群組方法
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
            await Clients.Caller.JoinedGroup(groupName);

            // 通知群組其他成員有新用戶加入
            await Clients.Group(groupName).UserJoinedGroup(username, groupName);

            // 發送更新後的群組列表給用戶
            await SendUserGroupsList(connectionId);
        }

        // 離開群組方法
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
            await Clients.Caller.LeftGroup(groupName);

            // 通知群組其他成員有用戶離開
            await Clients.Group(groupName).UserLeftGroup(username, groupName);

            // 發送更新後的群組列表給用戶
            await SendUserGroupsList(connectionId);
        }

        // 獲取可用群組列表方法
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

            await Clients.Caller.AvailableGroups(groups);
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
            await Clients.Others.UserConnected(username);

            // 如果用戶名變更了，更新所有群組中的顯示
            if (oldUsername != null && oldUsername != username)
            {
                if (UserGroups.ContainsKey(connectionId))
                {
                    foreach (var group in UserGroups[connectionId])
                    {
                        await Clients.Group(group).UserRenamedInGroup(oldUsername, username, group);
                    }
                }
            }

            // 發送當前用戶列表
            await SendConnectedUsersList();
        }

        // 當用戶連接時
        public override async Task OnConnectedAsync()
        {
            // 通知其他客戶端有新連接
            await Clients.Others.UserConnected(Context.ConnectionId);

            // 檢查用戶是否已經在 "General" 群組中
            string connectionId = Context.ConnectionId;
            bool isInGeneralGroup = false;

            if (UserGroups.ContainsKey(connectionId))
            {
                isInGeneralGroup = UserGroups[connectionId].Contains("General");
            }

            // 如果用戶不在 "General" 群組中，才將其加入
            if (!isInGeneralGroup)
            {
                await JoinGroup("General");
            }

            await base.OnConnectedAsync();
        }

        // 當用戶斷開連接時
        public override async Task OnDisconnectedAsync(Exception? exception)
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

            // 當用戶斷開時，從所有群組中移除
            if (UserGroups.ContainsKey(connectionId))
            {
                List<string> userGroupsCopy = new List<string>(UserGroups[connectionId]);
                foreach (var group in userGroupsCopy)
                {
                    // 通知群組其他成員有用戶離開
                    await Clients.Group(group).UserLeftGroup(username ?? connectionId, group);
                }

                UserGroups.Remove(connectionId);
            }

            // 通知其他客戶端有用戶斷開連接
            if (username != null)
            {
                await Clients.Others.UserDisconnected(username);
            }
            else
            {
                await Clients.Others.UserDisconnected(connectionId);
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

            await Clients.All.UpdateUserList(usernames);
        }

        // 輔助方法：發送用戶的群組列表
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

                await Clients.Client(connectionId).UpdateUserGroups(groups);
            }
        }

        // 輔助方法：檢查用戶是否在特定群組中
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