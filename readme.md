# README.md

## 项目名称

家庭点餐小程序 (Family Kitchen)

## 目标

为家庭成员提供一个点餐系统，成员可以在线点餐，厨师实时收到提示消息以便提前准备食材。项目支持部署在微信小程序环境中，兼顾实时性和易用性。

## 核心功能

* 家庭成员浏览菜单并下单
* 厨师实时接收新订单通知
* 食材库存与准备建议
* 订单状态追踪（已下单 / 准备中 / 完成）
* 用户身份区分（成员 / 厨师 / 管理员）
* 微信小程序适配与消息订阅提醒

## 技术栈建议

* 多端框架：Taro / Uni-app（支持编译到微信小程序）
* 前端：TypeScript + React 风格组件（Taro/Uni-app 封装）
* 状态管理：Zustand / Pinia / 自定义简单 store（依据框架）
* 后端：Node.js + Koa / Fastify / NestJS（RESTful API）
* 数据库：SQLite（轻量本地）或 PostgreSQL（若需要同步多端）
* 实时通知：WebSocket / 微信订阅消息 / 小程序消息推送
* 认证：微信登录（小程序登录态）+ JWT（服务器会话）
* 部署：使用云函数或标准云主机（例如腾讯云、阿里云）并结合微信小程序后台配置

## 目录结构（初始建议）

```
/src
  /components  # 复用 UI 组件
  /pages       # 小程序页面
  /services    # 请求和业务服务封装
  /store       # 状态管理
  /utils       # 工具函数
  /api         # 后端接口定义（API 客户端 / 服务器）
  /types       # TypeScript 类型
  /config      # 配置（分环境）
/tests         # 单元/集成测试
```

## 安装与本地开发

1. 克隆仓库
2. 复制并修改配置文件：`.env.example` -> `.env`
3. 安装依赖（以 npm 为例）：

```bash
npm install
```

4. 本地启动（前端和后端分别）：

```bash
npm run dev:frontend
npm run dev:backend
```

## 环境变量示例

```
# 后端
JWT_SECRET=your_secret
DATABASE_URL=...
WX_APPID=你的微信小程序 AppID
WX_SECRET=你的微信小程序密钥
```

## 通知流程简介

1. 家庭成员提交订单
2. 后端记录订单并更新库存建议
3. 通过 WebSocket 或微信订阅消息将新订单推送给厨师
4. 厨师确认后，更新订单状态
5. 系统可发送完成通知给点餐成员

## 部署到微信小程序

使用 Taro/Uni-app 编译前端为微信小程序代码，配合后端 API 部署到支持 HTTPS 的服务器。配置小程序消息订阅模板用于厨师提醒。

## 贡献指南

请参照 agent.md 中的开发规范进行开发、提交与评审。