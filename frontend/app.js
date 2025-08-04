// 全局变量
let currentUser = null;
let ws = null;
let menuItems = [];
let orders = [];

// API 基础 URL
const API_BASE = window.location.origin + '/api';

// DOM 元素
const loginPage = document.getElementById('loginPage');
const mainApp = document.getElementById('mainApp');
const userSelect = document.getElementById('userSelect');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const menuList = document.getElementById('menuList');
const ordersList = document.getElementById('ordersList');
const kitchenOrders = document.getElementById('kitchenOrders');
const orderModal = document.getElementById('orderModal');
const notification = document.getElementById('notification');

// 初始化应用
async function initApp() {
    try {
        await loadUsers();
        setupEventListeners();
        
        // 检查是否有保存的登录状态
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showMainApp();
        }
    } catch (error) {
        console.error('应用初始化失败:', error);
        showNotification('应用初始化失败', 'error');
    }
}

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const result = await response.json();
        
        if (result.success) {
            const users = result.data;
            userSelect.innerHTML = '<option value="">请选择家庭成员</option>';
            
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = JSON.stringify(user);
                option.textContent = `${user.name} (${getRoleText(user.role)})`;
                userSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}

// 获取角色文本
function getRoleText(role) {
    const roleMap = {
        'member': '家庭成员',
        'chef': '厨师',
        'admin': '管理员'
    };
    return roleMap[role] || role;
}

// 设置事件监听器
function setupEventListeners() {
    // 登录按钮
    loginBtn.addEventListener('click', handleLogin);
    
    // 退出按钮
    logoutBtn.addEventListener('click', handleLogout);
    
    // 标签栏切换
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // 弹窗关闭
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    orderModal.addEventListener('click', (e) => {
        if (e.target === orderModal) closeModal();
    });
    
    // 数量选择器
    document.getElementById('qtyMinus').addEventListener('click', () => {
        const qty = document.getElementById('quantity');
        if (qty.value > 1) qty.value--;
    });
    
    document.getElementById('qtyPlus').addEventListener('click', () => {
        const qty = document.getElementById('quantity');
        if (qty.value < 10) qty.value++;
    });
    
    // 确认下单
    document.getElementById('confirmOrder').addEventListener('click', handleConfirmOrder);
}

// 处理登录
async function handleLogin() {
    const selectedUser = userSelect.value;
    if (!selectedUser) {
        showNotification('请选择一个用户', 'warning');
        return;
    }
    
    try {
        currentUser = JSON.parse(selectedUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        showMainApp();
    } catch (error) {
        console.error('登录失败:', error);
        showNotification('登录失败', 'error');
    }
}

// 处理退出
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    if (ws) {
        ws.close();
        ws = null;
    }
    
    loginPage.classList.add('active');
    mainApp.classList.remove('active');
    document.body.className = '';
}

// 显示主应用
async function showMainApp() {
    // 更新UI
    userAvatar.src = currentUser.avatar;
    userName.textContent = currentUser.name;
    userRole.textContent = getRoleText(currentUser.role);
    userRole.className = `role-badge role-${currentUser.role}`;
    
    // 根据角色显示不同的标签
    document.body.className = currentUser.role;
    
    // 切换页面
    loginPage.classList.remove('active');
    mainApp.classList.add('active');
    
    // 初始化WebSocket连接
    initWebSocket();
    
    // 加载初始数据
    await loadMenuItems();
    await loadOrders();
    
    // 如果是厨师或管理员，加载统计数据
    if (currentUser.role === 'chef' || currentUser.role === 'admin') {
        await loadStats();
    }
}

// 初始化WebSocket连接
function initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket连接已建立');
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error('处理WebSocket消息失败:', error);
        }
    };
    
    ws.onclose = () => {
        console.log('WebSocket连接已断开');
        // 重连逻辑
        setTimeout(() => {
            if (currentUser) initWebSocket();
        }, 5000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'new_order':
            if (currentUser.role === 'chef' || currentUser.role === 'admin') {
                showNotification(`新订单：${message.data.user_name} 点了 ${message.data.item_name}`, 'info');
                loadOrders();
                loadStats();
            }
            break;
            
        case 'order_status_update':
            showNotification('订单状态已更新', 'info');
            loadOrders();
            if (currentUser.role === 'chef' || currentUser.role === 'admin') {
                loadStats();
            }
            break;
    }
}

// 切换标签
function switchTab(tabName) {
    // 更新标签栏状态
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // 根据标签加载相应数据
    switch (tabName) {
        case 'menu':
            loadMenuItems();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'kitchen':
            loadOrders();
            loadStats();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// 加载菜单项
async function loadMenuItems() {
    try {
        const response = await fetch(`${API_BASE}/menu`);
        const result = await response.json();
        
        if (result.success) {
            menuItems = result.data;
            renderMenuItems();
        }
    } catch (error) {
        console.error('加载菜单失败:', error);
        showNotification('加载菜单失败', 'error');
    }
}

// 渲染菜单项
function renderMenuItems() {
    menuList.innerHTML = '';
    
    menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        menuItem.innerHTML = `
            <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x200?text=美食'">
            <div class="menu-item-info">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="menu-item-meta">
                    <span>⏱️ ${item.preparation_time}分钟</span>
                    <span>🥬 ${item.ingredients.split(',').length}种食材</span>
                </div>
            </div>
        `;
        
        menuItem.addEventListener('click', () => showOrderModal(item));
        menuList.appendChild(menuItem);
    });
}

// 显示下单弹窗
function showOrderModal(item) {
    if (currentUser.role === 'chef') {
        showNotification('厨师不能点餐', 'warning');
        return;
    }
    
    document.getElementById('modalDishName').textContent = item.name;
    document.getElementById('modalDescription').textContent = item.description;
    document.getElementById('modalPrepTime').textContent = item.preparation_time;
    document.getElementById('modalIngredients').textContent = item.ingredients;
    document.getElementById('modalImage').src = item.image;
    document.getElementById('quantity').value = 1;
    document.getElementById('orderNote').value = '';
    
    orderModal.dataset.itemId = item.id;
    orderModal.classList.add('active');
}

// 关闭弹窗
function closeModal() {
    orderModal.classList.remove('active');
}

// 确认下单
async function handleConfirmOrder() {
    const itemId = orderModal.dataset.itemId;
    const quantity = document.getElementById('quantity').value;
    const note = document.getElementById('orderNote').value;
    
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                itemId: parseInt(itemId),
                quantity: parseInt(quantity),
                note: note
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('下单成功！', 'success');
            closeModal();
            loadOrders();
        } else {
            showNotification(result.error || '下单失败', 'error');
        }
    } catch (error) {
        console.error('下单失败:', error);
        showNotification('下单失败', 'error');
    }
}

// 加载订单
async function loadOrders() {
    try {
        const params = new URLSearchParams({
            role: currentUser.role,
            userId: currentUser.id
        });
        
        const response = await fetch(`${API_BASE}/orders?${params}`);
        const result = await response.json();
        
        if (result.success) {
            orders = result.data;
            renderOrders();
            if (currentUser.role === 'chef' || currentUser.role === 'admin') {
                renderKitchenOrders();
            }
        }
    } catch (error) {
        console.error('加载订单失败:', error);
        showNotification('加载订单失败', 'error');
    }
}

// 渲染订单列表
function renderOrders() {
    ordersList.innerHTML = '';
    
    const userOrders = currentUser.role === 'member' 
        ? orders.filter(order => order.user_id === currentUser.id)
        : orders;
    
    if (userOrders.length === 0) {
        ordersList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无订单</div>';
        return;
    }
    
    userOrders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div class="order-header">
                <span class="order-id">#${order.id}</span>
                <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
            </div>
            <div class="order-content">
                <img src="${order.item_image}" alt="${order.item_name}" class="order-image" 
                     onerror="this.src='https://via.placeholder.com/80x80?text=菜品'">
                <div class="order-details">
                    <h4>${order.item_name}</h4>
                    <div class="order-meta">
                        <div>数量：${order.quantity}</div>
                        <div>下单人：${order.user_name}</div>
                        <div>时间：${formatTime(order.created_at)}</div>
                        ${order.note ? `<div>备注：${order.note}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        ordersList.appendChild(orderItem);
    });
}

// 渲染厨房订单
function renderKitchenOrders() {
    kitchenOrders.innerHTML = '';
    
    const activeOrders = orders.filter(order => 
        order.status === 'pending' || order.status === 'preparing'
    );
    
    if (activeOrders.length === 0) {
        kitchenOrders.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无待处理订单</div>';
        return;
    }
    
    activeOrders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.className = 'kitchen-order-item';
        orderItem.innerHTML = `
            <div class="kitchen-order-header">
                <span class="order-id">#${order.id} - ${order.item_name}</span>
                <span class="order-time">${formatTime(order.created_at)}</span>
            </div>
            <div class="order-content">
                <img src="${order.item_image}" alt="${order.item_name}" class="order-image"
                     onerror="this.src='https://via.placeholder.com/80x80?text=菜品'">
                <div class="order-details">
                    <h4>${order.user_name} 的订单</h4>
                    <div class="order-meta">
                        <div>菜品：${order.item_name}</div>
                        <div>数量：${order.quantity}</div>
                        ${order.note ? `<div>备注：${order.note}</div>` : ''}
                        <div>状态：<span class="order-status status-${order.status}">${getStatusText(order.status)}</span></div>
                    </div>
                </div>
            </div>
            <div class="kitchen-order-actions">
                ${order.status === 'pending' ? `
                    <button class="action-btn preparing" onclick="updateOrderStatus(${order.id}, 'preparing')">
                        开始制作
                    </button>
                ` : ''}
                ${order.status === 'preparing' ? `
                    <button class="action-btn complete" onclick="updateOrderStatus(${order.id}, 'completed')">
                        完成
                    </button>
                ` : ''}
                <button class="action-btn cancel" onclick="updateOrderStatus(${order.id}, 'cancelled')">
                    取消
                </button>
            </div>
        `;
        
        kitchenOrders.appendChild(orderItem);
    });
}

// 更新订单状态
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('订单状态已更新', 'success');
            loadOrders();
            loadStats();
        } else {
            showNotification(result.error || '更新失败', 'error');
        }
    } catch (error) {
        console.error('更新订单状态失败:', error);
        showNotification('更新失败', 'error');
    }
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            
            // 更新统计页面
            const todayOrdersElement = document.getElementById('todayOrdersCount');
            const totalPendingElement = document.getElementById('totalPendingCount');
            
            if (todayOrdersElement) todayOrdersElement.textContent = stats.todayOrders;
            if (totalPendingElement) totalPendingElement.textContent = stats.pendingOrders;
            
            // 更新厨房页面统计
            updateKitchenStats();
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 更新厨房统计
function updateKitchenStats() {
    const pendingCount = orders.filter(order => order.status === 'pending').length;
    const preparingCount = orders.filter(order => order.status === 'preparing').length;
    
    const pendingElement = document.getElementById('pendingCount');
    const preparingElement = document.getElementById('preparingCount');
    
    if (pendingElement) pendingElement.textContent = pendingCount;
    if (preparingElement) preparingElement.textContent = preparingCount;
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'preparing': '制作中',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 格式化时间
function formatTime(timeString) {
    const date = new Date(timeString);
    const now = new Date();
    const diff = now - date;
    const diffMinutes = Math.floor(diff / (1000 * 60));
    
    if (diffMinutes < 1) return '刚刚';
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}小时前`;
    
    return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 显示通知
function showNotification(message, type = 'success') {
    const notificationText = document.getElementById('notificationText');
    notificationText.textContent = message;
    
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);

// 全局函数（供HTML调用）
window.updateOrderStatus = updateOrderStatus;