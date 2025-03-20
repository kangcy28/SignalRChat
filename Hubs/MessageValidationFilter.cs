using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace SignalRChat.Hubs
{
    public class GlobalMessageFilter
    {
        // 日誌記錄服務（建議使用依賴注入）
        private readonly ILogger<GlobalMessageFilter> _logger;

        public GlobalMessageFilter(ILogger<GlobalMessageFilter> logger)
        {
            _logger = logger;
        }

        // 全局消息攔截方法
        public async Task<bool> InterceptMessage(string user, string message, string methodName)
        {
            try 
            {
                // 基本安全檢查
                if (string.IsNullOrWhiteSpace(message))
                {
                    _logger.LogWarning($"用戶 {user} 發送了空消息");
                    return false;
                }

                // 消息長度限制
                if (message.Length > 500)
                {
                    _logger.LogWarning($"用戶 {user} 發送了過長消息：{message.Substring(0, 50)}...");
                    return false;
                }

                // 不當詞彙過濾
                if (ContainsBadWords(message))
                {
                    _logger.LogWarning($"用戶 {user} 發送了包含不當詞彙的消息");
                    return false;
                }

                // 自定義規則：限制特定用戶
                if (IsBlockedUser(user))
                {
                    _logger.LogWarning($"被封禁用戶 {user} 嘗試發送消息");
                    return false;
                }

                // 高級安全檢查：防止重複消息
                if (await IsSpamMessage(user, message))
                {
                    _logger.LogWarning($"用戶 {user} 發送了可疑的重複消息");
                    return false;
                }

                // 記錄正常消息
                _logger.LogInformation($"用戶 {user} 在 {methodName} 方法中發送了有效消息");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "消息攔截發生異常");
                return false;
            }
        }

        // 不當詞彙檢查
        private bool ContainsBadWords(string message)
        {
            string[] badWords = { "壞話", "髒話", "攻擊性詞彙" };
            
            return badWords.Any(word => 
                message.Contains(word, StringComparison.OrdinalIgnoreCase));
        }

        // 被封禁用戶檢查（模擬）
        private bool IsBlockedUser(string user)
        {
            // 這裡可以添加真實的用戶黑名單邏輯
            string[] blockedUsers = { "惡意用戶1", "惡意用戶2" };
            return blockedUsers.Contains(user);
        }

        // 防止惡意重複消息
        private async Task<bool> IsSpamMessage(string user, string message)
        {
            // 模擬檢查邏輯 - 實際場景需要使用分佈式緩存
            // 這裡僅作示範
            await Task.Delay(10); // 模擬異步操作
            return false;
        }
    }
}