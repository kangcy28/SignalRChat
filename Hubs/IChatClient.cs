using System.Collections.Generic;
using System.Threading.Tasks;

namespace SignalRChat.Hubs
{
    /// <summary>
    /// 強類型Hub的客戶端接口
    /// 定義服務器可以調用的客戶端方法
    /// </summary>
    public interface IChatClient
    {
        /// <summary>
        /// 接收一般消息
        /// </summary>
        /// <param name="user">發送消息的用戶名</param>
        /// <param name="message">消息內容</param>
        Task ReceiveMessage(string user, string message);

        /// <summary>
        /// 接收群組消息
        /// </summary>
        /// <param name="user">發送消息的用戶名</param>
        /// <param name="groupName">群組名稱</param>
        /// <param name="message">消息內容</param>
        Task ReceiveGroupMessage(string user, string groupName, string message);

        /// <summary>
        /// 通知用戶連接事件
        /// </summary>
        /// <param name="username">用戶名</param>
        Task UserConnected(string username);

        /// <summary>
        /// 通知用戶斷開連接事件
        /// </summary>
        /// <param name="username">用戶名</param>
        Task UserDisconnected(string username);

        /// <summary>
        /// 更新用戶列表
        /// </summary>
        /// <param name="users">用戶名列表</param>
        Task UpdateUserList(List<string> users);

        /// <summary>
        /// 更新用戶群組列表
        /// </summary>
        /// <param name="groups">用戶所屬群組列表</param>
        Task UpdateUserGroups(List<object> groups);

        /// <summary>
        /// 返回可用群組列表
        /// </summary>
        /// <param name="groups">群組資訊列表</param>
        Task AvailableGroups(List<object> groups);

        /// <summary>
        /// 通知已加入群組
        /// </summary>
        /// <param name="groupName">群組名稱</param>
        Task JoinedGroup(string groupName);

        /// <summary>
        /// 通知已離開群組
        /// </summary>
        /// <param name="groupName">群組名稱</param>
        Task LeftGroup(string groupName);

        /// <summary>
        /// 通知用戶加入群組
        /// </summary>
        /// <param name="username">用戶名</param>
        /// <param name="groupName">群組名稱</param>
        Task UserJoinedGroup(string username, string groupName);

        /// <summary>
        /// 通知用戶離開群組
        /// </summary>
        /// <param name="username">用戶名</param>
        /// <param name="groupName">群組名稱</param>
        Task UserLeftGroup(string username, string groupName);

        /// <summary>
        /// 通知用戶在群組中改名
        /// </summary>
        /// <param name="oldUsername">舊用戶名</param>
        /// <param name="newUsername">新用戶名</param>
        /// <param name="groupName">群組名稱</param>
        Task UserRenamedInGroup(string oldUsername, string newUsername, string groupName);

        /// <summary>
        /// 發送群組錯誤信息
        /// </summary>
        /// <param name="errorMessage">錯誤信息</param>
        Task GroupError(string errorMessage);
    }
}