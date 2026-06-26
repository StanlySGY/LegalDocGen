# LegalDocGen 部署指南

## 服务器要求

- **最低配置**：2核CPU / 2GB内存 / 40GB硬盘
- **推荐配置**：2核CPU / 4GB内存 / 80GB硬盘
- **操作系统**：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **必需软件**：Docker 20.10+ / Docker Compose 2.0+

## 快速部署（5分钟）

### 1. 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 验证安装
docker --version
docker-compose --version
```

### 2. 克隆项目

```bash
git clone https://github.com/StanlySGY/LegalDocGen.git
cd LegalDocGen
```

### 3. 配置环境变量

```bash
# 复制配置模板
cp .env.production.example .env.production

# 编辑配置（必须修改以下项）
vim .env.production
```

**必须配置的参数**：

| 参数 | 说明 | 示例 |
|------|------|------|
| `POSTGRES_PASSWORD` | 数据库密码 | `YourStrongPassword123!` |
| `DATABASE_URL` | 数据库连接串 | `postgresql+psycopg://legaldocgen:YourStrongPassword123!@db:5432/legaldocgen` |
| `DEFAULT_ADMIN_PASSWORD` | 管理员初始密码 | `admin123456` |
| `ADMIN_TOKEN` | API管理令牌 | `随机生成32位字符串` |
| `API_KEY_SECRET` | 加密密钥 | `随机生成32位字符串` |
| `AUTH_SECRET` | 认证密钥 | `随机生成32位字符串` |
| `OPENAI_API_KEY` | AI模型密钥 | `sk-xxxxx` |
| `CORS_ORIGINS` | 允许的域名 | `https://yourdomain.com` |

**生成随机密钥**：
```bash
# 生成32位随机字符串
openssl rand -base64 32
```

### 4. 启动服务

```bash
# 构建并启动
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 查看启动状态
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 查看日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

### 5. 验证部署

```bash
# 健康检查
curl http://localhost/api/health

# 访问前端
# 浏览器打开 http://你的服务器IP
```

## 配置 HTTPS

### 方法一：使用 Let's Encrypt（推荐）

```bash
# 安装 Certbot
apt install certbot

# 获取证书（需停止Nginx）
docker-compose --env-file .env.production -f docker-compose.prod.yml stop web
certbot certonly --standalone -d yourdomain.com

# 修改 nginx 配置
# 在 frontend/nginx.conf 的 server 块中添加：
# listen 443 ssl;
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# 重新构建并启动
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 方法二：使用阿里云证书

1. 在阿里云控制台申请免费SSL证书
2. 下载证书文件（.pem 和 .key）
3. 放入项目目录
4. 修改 nginx.conf 配置

## 常用运维命令

```bash
# 查看服务状态
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 查看后端日志
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f backend

# 重启服务
docker-compose --env-file .env.production -f docker-compose.prod.yml restart

# 停止服务
docker-compose --env-file .env.production -f docker-compose.prod.yml down

# 更新部署
git pull
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 备份数据库
docker exec $(docker-compose --env-file .env.production -f docker-compose.prod.yml ps -q db) \
  pg_dump -U legaldocgen legaldocgen > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker exec -i $(docker-compose --env-file .env.production -f docker-compose.prod.yml ps -q db) \
  psql -U legaldocgen -d legaldocgen
```

## 数据备份

### 自动备份脚本

创建 `/opt/backup-legaldocgen.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/legaldocgen"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec $(docker-compose --env-file .env.production -f docker-compose.prod.yml ps -q db) \
  pg_dump -U legaldocgen legaldocgen | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# 保留最近7天备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

设置定时任务：
```bash
chmod +x /opt/backup-legaldocgen.sh
crontab -e
# 添加：0 2 * * * /opt/backup-legaldocgen.sh
```

## 故障排除

### 问题1：端口被占用

```bash
# 查看80端口占用
lsof -i:80

# 修改 docker-compose.prod.yml 中的端口映射
ports:
  - "8080:80"  # 改为8080端口
```

### 问题2：内存不足

```bash
# 添加swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 限制容器内存
# 在 docker-compose.prod.yml 中添加：
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 500M
```

### 问题3：数据库连接失败

```bash
# 检查数据库状态
docker-compose --env-file .env.production -f docker-compose.prod.yml logs db

# 手动迁移
docker-compose --env-file .env.production -f docker-compose.prod.yml exec backend \
  python -m alembic upgrade head
```

### 问题4：AI生成失败

1. 检查 `OPENAI_API_KEY` 是否正确
2. 检查 `OPENAI_BASE_URL` 是否可达
3. 在前端"AI 服务设置"中测试连接

## 安全建议

1. **修改默认密码**：首次部署后立即修改所有默认密码
2. **限制访问**：配置防火墙，只开放80/443端口
3. **定期更新**：定期更新Docker镜像和系统补丁
4. **监控日志**：定期检查应用日志，发现异常及时处理
5. **备份数据**：配置自动备份，防止数据丢失

## 性能优化

### 2核2G服务器优化

```yaml
# docker-compose.prod.yml 添加资源限制
services:
  db:
    deploy:
      resources:
        limits:
          memory: 300M
    command: postgres -c shared_buffers=128MB -c effective_cache_size=256MB

  backend:
    deploy:
      resources:
        limits:
          memory: 500M

  web:
    deploy:
      resources:
        limits:
          memory: 100M
```

### Nginx缓存优化

在 `nginx.conf` 中添加：

```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# API缓存（可选）
location /api/ {
    proxy_pass http://backend:8000/api/;
    proxy_cache_valid 200 5m;
}
```

## 监控

### 健康检查

```bash
# 创建监控脚本
cat > /opt/monitor-legaldocgen.sh << 'EOF'
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health)
if [ "$RESPONSE" != "200" ]; then
    echo "服务异常，尝试重启..."
    docker-compose --env-file .env.production -f docker-compose.prod.yml restart backend
fi
EOF

chmod +x /opt/monitor-legaldocgen.sh
crontab -e
# 添加：*/5 * * * * /opt/monitor-legaldocgen.sh
```

## 联系支持

如遇问题，请提供：
1. 服务器配置（CPU/内存/系统）
2. 错误日志（`docker-compose logs`）
3. 环境变量配置（脱敏后）
