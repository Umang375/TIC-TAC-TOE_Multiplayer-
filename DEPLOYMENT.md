# Deployment Guide — Multiplayer Tic-Tac-Toe

This guide covers deploying the Nakama backend to an **AWS EC2** instance and the React frontend to **Vercel**.

---

## Architecture Overview

```
┌─────────────────┐        HTTPS         ┌──────────────────────┐
│   Vercel CDN    │◄────────────────────►│   Player Browsers    │
│   (Frontend)    │                      └──────────────────────┘
└─────────────────┘                               │
                                                  │ WebSocket / HTTP
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     AWS EC2 Instance                        │
│  ┌───────────┐    ┌──────────┐    ┌──────────────────────┐ │
│  │  Nginx    │───►│  Nakama  │───►│  PostgreSQL          │ │
│  │  (SSL)    │    │  :7350   │    │  :5432               │ │
│  │  :443     │    │  :7351   │    └──────────────────────┘ │
│  └───────────┘    └──────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Backend Deployment (AWS EC2)

### 1.1 Launch EC2 Instance

1. Go to **AWS EC2 Console** → **Launch Instance**
2. Choose:
   - **AMI**: Ubuntu 22.04 LTS
   - **Instance type**: `t3.small` (2 vCPU, 2 GB RAM) — sufficient for development/demo
   - **Storage**: 20 GB gp3
3. **Security Group** — allow the following inbound rules:

| Type  | Port | Source    | Purpose                   |
|-------|------|-----------|---------------------------|
| SSH   | 22   | Your IP   | Server management         |
| HTTP  | 80   | 0.0.0.0/0 | Redirect to HTTPS         |
| HTTPS | 443  | 0.0.0.0/0 | Nakama API + Console      |
| Custom TCP | 7350 | 0.0.0.0/0 | Nakama API (direct) |
| Custom TCP | 7351 | 0.0.0.0/0 | Nakama Console      |

4. Download your key pair (`.pem` file) and launch.
5. **Assign an Elastic IP** to the instance for a stable address.

### 1.2 Connect and Install Prerequisites

```bash
# Connect to your instance
ssh -i your-key.pem ubuntu@<YOUR_EC2_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for docker group to take effect
exit
ssh -i your-key.pem ubuntu@<YOUR_EC2_IP>

# Verify
docker --version
docker-compose --version
```

### 1.3 Deploy Application Files

```bash
# Create project directory
mkdir -p ~/tictactoe && cd ~/tictactoe

# Option A: Clone from repo
git clone <YOUR_REPO_URL> .

# Option B: SCP from local machine
scp -i your-key.pem -r ./docker-compose.yml ./Dockerfile ./nakama ubuntu@<YOUR_EC2_IP>:~/tictactoe/
```

### 1.4 Configure for Production

Create a production docker-compose override:

```bash
cat > docker-compose.prod.yml << 'EOF'
version: '3'
services:
  postgres:
    container_name: ttt-postgres
    image: postgres:12.2-alpine
    environment:
      - POSTGRES_DB=nakama
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-your_strong_password_here}
    volumes:
      - pgdata:/var/lib/postgresql/data
    expose:
      - "5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres", "-d", "nakama"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: always

  nakama:
    container_name: ttt-nakama
    build:
      context: .
      dockerfile: Dockerfile
    entrypoint:
      - "/bin/sh"
      - "-ecx"
      - >
        /nakama/nakama migrate up --database.address postgres:${POSTGRES_PASSWORD:-your_strong_password_here}@postgres:5432/nakama?sslmode=disable &&
        exec /nakama/nakama
        --config /nakama/data/local.yml
        --database.address postgres:${POSTGRES_PASSWORD:-your_strong_password_here}@postgres:5432/nakama?sslmode=disable
        --socket.server_key ${NAKAMA_SERVER_KEY:-defaultkey}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "7350:7350"
      - "7351:7351"
    healthcheck:
      test: ["CMD", "/nakama/nakama", "healthcheck"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: always

volumes:
  pgdata:
EOF
```

Create the `.env` file:

```bash
cat > .env << 'EOF'
POSTGRES_PASSWORD=change_me_to_a_strong_password
NAKAMA_SERVER_KEY=change_me_to_a_random_key
EOF

chmod 600 .env
```

### 1.5 Build and Start

```bash
cd ~/tictactoe
docker-compose -f docker-compose.prod.yml up --build -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f nakama

# Verify it's running
curl http://localhost:7350/healthcheck
```

### 1.6 Set Up SSL with Nginx + Let's Encrypt

You need a domain name pointing to your EC2 Elastic IP (e.g., `nakama.yourdomain.com`).

```bash
# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
sudo cat > /etc/nginx/sites-available/nakama << 'EOF'
server {
    listen 80;
    server_name nakama.yourdomain.com;

    location / {
        proxy_pass http://localhost:7350;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /console {
        proxy_pass http://localhost:7351;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/nakama /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d nakama.yourdomain.com --non-interactive --agree-tos -m your@email.com

# Auto-renew
sudo systemctl enable certbot.timer
```

---

## Part 2: Frontend Deployment (Vercel)

### 2.1 Prepare Environment Variables

Create `frontend/.env.production`:

```env
VITE_NAKAMA_HOST=nakama.yourdomain.com
VITE_NAKAMA_PORT=443
VITE_NAKAMA_KEY=your_server_key_here
VITE_NAKAMA_USE_SSL=true
```

### 2.2 Deploy to Vercel

#### Option A: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from frontend directory
cd frontend
vercel

# Follow the prompts:
# - Link to your Vercel account
# - Set project name: tic-tac-toe
# - Framework: Vite
# - Root directory: ./
# - Build command: npm run build
# - Output directory: dist

# Set environment variables
vercel env add VITE_NAKAMA_HOST production
vercel env add VITE_NAKAMA_PORT production
vercel env add VITE_NAKAMA_KEY production
vercel env add VITE_NAKAMA_USE_SSL production

# Redeploy with production env
vercel --prod
```

#### Option B: Via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables:

| Variable | Value |
|---|---|
| `VITE_NAKAMA_HOST` | `nakama.yourdomain.com` |
| `VITE_NAKAMA_PORT` | `443` |
| `VITE_NAKAMA_KEY` | Your server key |
| `VITE_NAKAMA_USE_SSL` | `true` |

6. Click **Deploy**

### 2.3 CORS Configuration

If you encounter CORS issues, update the Nakama config (`nakama/local.yml`):

```yaml
socket:
  server_key: "your_server_key"
  
runtime:
  js_entrypoint: "build/index.js"
  http_key: "your_http_key"

console:
  username: "admin"
  password: "your_console_password"
  signing_key: "your_signing_key"
```

---

## Part 3: Maintenance

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Just Nakama
docker-compose -f docker-compose.prod.yml logs -f nakama

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 nakama
```

### Restart Services

```bash
docker-compose -f docker-compose.prod.yml restart nakama
```

### Update Application

```bash
cd ~/tictactoe
git pull  # or re-upload files
docker-compose -f docker-compose.prod.yml up --build -d
```

### Database Backup

```bash
# Create backup
docker exec ttt-postgres pg_dump -U postgres nakama > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20250101.sql | docker exec -i ttt-postgres psql -U postgres nakama
```

### Monitor Health

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check Nakama health endpoint
curl https://nakama.yourdomain.com/healthcheck

# Access Nakama Console
# Open in browser: https://nakama.yourdomain.com/console
# Default credentials: admin / password (change these!)
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| WebSocket connection fails | Check Nginx upgrade headers, ensure ports 443/7350 are open |
| CORS errors | Update `local.yml` with proper CORS settings |
| Database connection error | Check PostgreSQL is healthy: `docker-compose logs postgres` |
| Module not loading | Check Nakama logs: `docker-compose logs nakama`, verify `build/index.js` exists |
| SSL certificate expired | Run `sudo certbot renew` |

---

## Quick Reference

| Service | Local URL | Production URL |
|---|---|---|
| Nakama API | `http://localhost:7350` | `https://nakama.yourdomain.com` |
| Nakama Console | `http://localhost:7351` | `https://nakama.yourdomain.com/console` |
| Frontend | `http://localhost:5173` | `https://your-app.vercel.app` |
| PostgreSQL | `localhost:5432` | Internal only |
