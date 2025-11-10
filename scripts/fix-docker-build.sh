#!/bin/bash
# ========================================
# 服务器端快速修复脚本
# ========================================
# 用途：在服务器上应用 Docker 构建修复
# 使用：bash fix-docker-build.sh

set -e

echo "========================================="
echo "  NofyAI Docker 构建修复"
echo "========================================="
echo ""

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull

# 2. 验证修复文件
echo ""
echo "🔍 验证修复文件..."

if [ -d "public" ]; then
    echo "✅ public 目录已存在"
else
    echo "⚠️  public 目录不存在，正在创建..."
    mkdir -p public
    echo '# Static assets directory for Next.js' > public/.gitkeep
fi

if grep -q "mkdir -p public" Dockerfile; then
    echo "✅ Dockerfile 已更新"
else
    echo "❌ Dockerfile 未更新！请确认已拉取最新代码"
    exit 1
fi

# 3. 重新构建
echo ""
echo "🔨 重新构建 Docker 镜像..."
docker compose down
docker compose build --no-cache

# 4. 启动服务
echo ""
echo "🚀 启动服务..."
docker compose up -d

# 5. 等待服务就绪
echo ""
echo "⏳ 等待服务就绪..."
sleep 15

# 6. 健康检查
echo ""
echo "🏥 健康检查..."
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "✅ 服务正常运行！"
    echo ""
    docker compose ps
    echo ""
    echo "🌐 访问: http://$(hostname -I | awk '{print $1}'):3000"
else
    echo "❌ 健康检查失败！"
    echo "查看日志: docker compose logs -f"
    exit 1
fi

echo ""
echo "========================================="
echo "  ✨ 修复完成！"
echo "========================================="
