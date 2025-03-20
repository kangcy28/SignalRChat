using System;
using System.Threading.Tasks;

namespace SignalRChat.Hubs
{
    /// <summary>
    /// 強類型Hub的服務器接口
    /// 定義客戶端可以調用的服務器方法
    /// </summary>
    public interface IChatHub
    {
        /// <summary>
        /// 發送消息到所有連接的客戶端
        /// </summary>
        /// <param name="user">發送消息的用戶名</param>
        /// <param name="message">消息內容</param>
        Task SendMessage(string user, string message);

        /// <summary>
        /// 發送消息到特定群組
        /// </summary>
        /// <param name="user">發送消息的用戶名</param>
        /// <param name="groupName">目標群組名稱</param>
        /// <param name="message">消息內容</param>
        Task SendGroupMessage(string user, string groupName, string message);

        /// <summary>
        /// 加入群組
        /// </summary>
        /// <param name="groupName">要加入的群組名稱</param>
        Task JoinGroup(string groupName);

        /// <summary>
        /// 離開群組
        /// </summary>
        /// <param name="groupName">要離開的群組名稱</param>
        Task LeaveGroup(string groupName);

        /// <summary>
        /// 獲取可用群組列表
        /// </summary>
        Task GetAvailableGroups();

        /// <summary>
        /// 註冊用戶名
        /// </summary>
        /// <param name="username">要註冊的用戶名</param>
        Task RegisterUsername(string username);
    }
}