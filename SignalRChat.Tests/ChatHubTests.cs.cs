using Microsoft.AspNetCore.SignalR;
using Moq;
using SignalRChat.Hubs;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace SignalRChat.Tests
{
    public class ChatHubTests
    {
        /// <summary>
        /// 測試 SendMessage 方法是否正確調用客戶端的 ReceiveMessage 方法
        /// </summary>
        [Fact]
        public async Task SendMessage_CallsReceiveMessageOnAllClients()
        {
            // Arrange
            var mockClients = new Mock<IHubCallerClients<IChatClient>>();
            var mockClientProxy = new Mock<IChatClient>();
            
            mockClients.Setup(clients => clients.All).Returns(mockClientProxy.Object);
            
            var hub = new ChatHub
            {
                Clients = mockClients.Object,
                Context = GetMockHubCallerContext().Object
            };

            string user = "TestUser";
            string message = "Hello, world!";

            // Act
            await hub.SendMessage(user, message);

            // Assert
            mockClientProxy.Verify(
                client => client.ReceiveMessage(user, message),
                Times.Once);
        }

        /// <summary>
        /// 測試 JoinGroup 方法是否正確調用 JoinedGroup 方法
        /// </summary>
        [Fact]
        public async Task JoinGroup_CallsJoinedGroupOnCaller()
        {
            // Arrange
            var mockClients = new Mock<IHubCallerClients<IChatClient>>();
            var mockClientProxy = new Mock<IChatClient>();
            var mockGroupManager = new Mock<IGroupManager>();
            
            mockClients.Setup(clients => clients.Caller).Returns(mockClientProxy.Object);
            mockClients.Setup(clients => clients.Group(It.IsAny<string>())).Returns(mockClientProxy.Object);
            mockClients.Setup(clients => clients.Client(It.IsAny<string>())).Returns(mockClientProxy.Object);
            
            var hub = new ChatHub
            {
                Clients = mockClients.Object,
                Groups = mockGroupManager.Object,
                Context = GetMockHubCallerContext().Object
            };

            string groupName = "TestGroup";

            // Act
            await hub.JoinGroup(groupName);

            // Assert
            mockClientProxy.Verify(
                client => client.JoinedGroup(groupName),
                Times.Once);
            
            mockGroupManager.Verify(
                manager => manager.AddToGroupAsync(
                    It.IsAny<string>(),
                    groupName,
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        /// <summary>
        /// 獲取模擬的 HubCallerContext
        /// </summary>
        private Mock<HubCallerContext> GetMockHubCallerContext()
        {
            var mockContext = new Mock<HubCallerContext>();
            mockContext.Setup(c => c.ConnectionId).Returns("test-connection-id");
            return mockContext;
        }
    }
}