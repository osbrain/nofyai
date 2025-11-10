# 🚀 快速开始（Docker）

## 最快 5 分钟部署

### 1. 安装 Docker（CentOS/RHEL）

```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到 docker 组（可选）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

### 2. 配置项目

```bash
# 克隆或上传代码
cd /opt
git clone <your-repo> nofyai
cd nofyai

# 复制配置文件
cp config.json.example config.json

# 编辑配置（填入你的 API 密钥）
nano config.json
```

**必填项**：
- `traders[].aster_user` - Aster 用户地址
- `traders[].aster_signer` - Aster API 钱包地址
- `traders[].aster_private_key` - Aster 私钥
- `traders[].deepseek_api_key` - DeepSeek API 密钥
- `traders[].initial_balance` - 初始余额（与交易所一致）
- `traders[].enabled` - 设为 `true`

### 3. 一键部署

```bash
# 运行部署脚本
./scripts/deploy.sh
```

### 4. 验证部署

```bash
# 查看状态
docker compose ps

# 健康检查
curl http://localhost:3000/api/health

# 查看日志
docker compose logs -f
```

### 5. 访问 Web 界面

浏览器打开：`http://服务器IP:3000`

---

## 常用命令

```bash
# 停止服务
docker compose stop

# 启动服务
docker compose start

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f

# 更新代码
git pull
docker compose up -d --build

# 备份数据
./scripts/backup.sh
```

---

## 配置 HTTPS（可选，使用 Caddy）

### 1. 安装 Caddy

```bash
sudo yum install -y yum-plugin-copr
sudo yum copr enable @caddy/caddy -y
sudo yum install -y caddy
```

### 2. 配置 Caddy

```bash
# 复制配置文件
sudo cp Caddyfile /etc/caddy/Caddyfile

# 编辑配置，替换为你的域名
sudo nano /etc/caddy/Caddyfile
# 将 nofyai.example.com 改为你的域名

# 启动 Caddy
sudo systemctl enable caddy
sudo systemctl start caddy
```

### 3. 配置 DNS

在域名服务商添加 A 记录，指向服务器 IP。

### 4. 开放防火墙端口

```bash
# 开放 HTTP (80) 和 HTTPS (443)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 5. 验证 HTTPS

访问 `https://你的域名`，应该看到：
- ✅ 绿色锁标志
- ✅ 自动 HTTPS
- ✅ 证书自动更新

---

## 开放防火墙端口（仅 HTTP）

如果不使用 HTTPS，只需开放 3000 端口：

```bash
# 开放端口
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

**注意**：云服务器还需在安全组开放端口：
- 阿里云/腾讯云/AWS 控制台
- 添加入站规则：TCP 3000（或 80/443）

---

## 故障排除

### 问题：容器启动失败

```bash
# 查看详细日志
docker compose logs

# 检查配置
cat config.json | jq .

# 重新构建
docker compose down
docker compose up -d --build
```

### 问题：无法访问 Web

```bash
# 检查容器状态
docker compose ps

# 检查端口监听
sudo netstat -tunlp | grep 3000

# 测试本地访问
curl http://localhost:3000/api/health
```

### 问题：API 请求失败

如果 Binance API 被墙：

```bash
# 创建代理配置
cat > .env.local << EOF
HTTP_PROXY=http://代理地址:端口
HTTPS_PROXY=http://代理地址:端口
EOF

# 取消 docker-compose.yml 中代理挂载的注释
nano docker-compose.yml

# 重启
docker compose restart
```

---

## 完整文档

详细部署指南：[docs/DEPLOYMENT.md](./DEPLOYMENT.md)

---

**🎉 部署成功后，访问 http://服务器IP:3000 开始交易！**
