const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./family_kitchen.db');

console.log('开始初始化数据库...');

db.serialize(() => {
  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建菜品表
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image TEXT,
      preparation_time INTEGER DEFAULT 30,
      available BOOLEAN DEFAULT 1,
      ingredients TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建订单表
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (item_id) REFERENCES menu_items (id)
    )
  `);

  // 插入示例用户数据
  const users = [
    ['dad', '爸爸', 'chef', 'https://api.dicebear.com/7.x/avataaars/svg?seed=dad'],
    ['mom', '妈妈', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=mom'],
    ['child1', '小明', 'member', 'https://api.dicebear.com/7.x/avataaars/svg?seed=child1'],
    ['child2', '小红', 'member', 'https://api.dicebear.com/7.x/avataaars/svg?seed=child2']
  ];

  db.run('DELETE FROM users');
  const userStmt = db.prepare('INSERT INTO users (username, name, role, avatar) VALUES (?, ?, ?, ?)');
  users.forEach(user => {
    userStmt.run(user);
  });
  userStmt.finalize();

  // 插入示例菜品数据
  const menuItems = [
    ['红烧肉', '经典家常菜，肥瘦相间，香甜可口', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300', 45, '猪肉,生抽,老抽,冰糖,料酒,葱,姜'],
    ['宫保鸡丁', '四川传统名菜，酸甜微辣', 'https://images.unsplash.com/photo-1603073135628-d6ee83f08e4c?w=300', 30, '鸡胸肉,花生米,干辣椒,葱,蒜'],
    ['麻婆豆腐', '四川特色豆腐料理，麻辣鲜香', 'https://images.unsplash.com/photo-1584255014406-2a68ea38e48c?w=300', 25, '嫩豆腐,猪肉末,豆瓣酱,花椒,葱'],
    ['糖醋排骨', '酸甜开胃，老少皆宜', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300', 50, '排骨,番茄酱,醋,糖,生抽'],
    ['青椒土豆丝', '清爽下饭的家常菜', 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300', 15, '土豆,青椒,蒜,醋'],
    ['蒸蛋羹', '嫩滑营养，适合老人小孩', 'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=300', 20, '鸡蛋,温水,盐,香油'],
    ['西红柿鸡蛋', '经典搭配，营养丰富', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300', 20, '西红柿,鸡蛋,糖,盐'],
    ['青菜汤', '清淡健康，解腻必备', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300', 10, '青菜,高汤,盐,胡椒粉']
  ];

  db.run('DELETE FROM menu_items');
  const menuStmt = db.prepare('INSERT INTO menu_items (name, description, image, preparation_time, ingredients) VALUES (?, ?, ?, ?, ?)');
  menuItems.forEach(item => {
    menuStmt.run(item);
  });
  menuStmt.finalize();

  console.log('数据库初始化完成！');
  console.log('已创建示例用户：');
  console.log('- 爸爸 (chef) - 用户名: dad');
  console.log('- 妈妈 (admin) - 用户名: mom');
  console.log('- 小明 (member) - 用户名: child1');
  console.log('- 小红 (member) - 用户名: child2');
});

db.close();