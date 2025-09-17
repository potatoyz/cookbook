const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 数据库初始化
const db = new sqlite3.Database('./family_kitchen.db');

// WebSocket连接管理
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  clients.add(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket连接断开');
  });
});

// 广播消息给所有连接的客户端
function broadcast(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return;
    }
  });
}

// API路由

// 获取菜单
app.get('/api/menu', (req, res) => {
  db.all('SELECT * FROM menu_items WHERE available = 1', (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

// 上传菜单
app.post('/api/menu', (req, res) => {
  const { name, description, image, preparation_time, ingredients } = req.body;

  if (!name || !image) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }

  db.run(
    'INSERT INTO menu_items (name, description, image, preparation_time, ingredients, available) VALUES (?, ?, ?, ?, ?, 1)',
    [name, description || '', image, preparation_time || 30, ingredients || ''],
    function(err) {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      res.json({ success: true, data: { id: this.lastID } });
    }
  );
});

// 获取所有订单
app.get('/api/orders', (req, res) => {
  const { role, userId } = req.query;
  
  let query = `
    SELECT o.*, u.name as user_name, m.name as item_name, m.image as item_image
    FROM orders o
    JOIN users u ON o.user_id = u.id
    JOIN menu_items m ON o.item_id = m.id
  `;
  
  if (role === 'member') {
    query += ` WHERE o.user_id = ${userId}`;
  }
  
  query += ' ORDER BY o.created_at DESC';
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

// 创建订单
app.post('/api/orders', (req, res) => {
  const { userId, itemId, quantity, note } = req.body;
  
  if (!userId || !itemId || !quantity) {
    res.status(400).json({ success: false, error: '缺少必要参数' });
    return;
  }
  
  const orderTime = new Date().toISOString();
  
  db.run(
    'INSERT INTO orders (user_id, item_id, quantity, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, itemId, quantity, note || '', 'pending', orderTime],
    function(err) {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      // 获取完整订单信息用于通知
      db.get(`
        SELECT o.*, u.name as user_name, m.name as item_name
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN menu_items m ON o.item_id = m.id
        WHERE o.id = ?
      `, [this.lastID], (err, row) => {
        if (!err && row) {
          // 广播新订单通知
          broadcast({
            type: 'new_order',
            data: row
          });
        }
      });
      
      res.json({ success: true, data: { id: this.lastID } });
    }
  );
});

// 更新订单状态
app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!['pending', 'preparing', 'completed', 'cancelled'].includes(status)) {
    res.status(400).json({ success: false, error: '无效的订单状态' });
    return;
  }
  
  db.run(
    'UPDATE orders SET status = ?, updated_at = ? WHERE id = ?',
    [status, new Date().toISOString(), id],
    function(err) {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      // 广播状态更新通知
      broadcast({
        type: 'order_status_update',
        data: { orderId: id, status }
      });
      
      res.json({ success: true });
    }
  );
});

// 获取用户列表
app.get('/api/users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

// 用户登录（简单模拟）
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (!user) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }
    
    res.json({ success: true, data: user });
  });
});

// 统计数据
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  // 今日订单数
  db.get(
    "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')",
    (err, row) => {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      stats.todayOrders = row.count;
      
      // 待处理订单数
      db.get(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'pending'",
        (err, row) => {
          if (err) {
            res.status(500).json({ success: false, error: err.message });
            return;
          }
          
          stats.pendingOrders = row.count;
          res.json({ success: true, data: stats });
        }
      );
    }
  );
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('WebSocket服务器已启动');
});
