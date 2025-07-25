# AIMA System - Production Deployment Guide

## 🚀 Phase 5: Production Deployment

Dieses Dokument beschreibt die vollständige Produktionsbereitstellung des AIMA Systems mit allen Sicherheits-, Monitoring- und Performance-Optimierungen.

## 📋 Übersicht

### Implementierte Komponenten

✅ **Production Infrastructure**
- Multi-stage Docker builds für optimierte Container
- Production-ready Docker Compose Konfiguration
- Nginx Reverse Proxy mit SSL/TLS
- Load Balancing und Rate Limiting
- Security Headers und CORS-Konfiguration

✅ **Monitoring & Logging**
- Prometheus für Metriken-Sammlung
- Grafana für Visualisierung
- Loki für Log-Aggregation
- Promtail für Log-Collection
- Node Exporter für System-Metriken

✅ **Security Hardening**
- SSL/TLS-Verschlüsselung
- Security Headers (HSTS, CSP, etc.)
- Rate Limiting pro Endpoint
- Non-root Container-Benutzer
- Secrets Management

✅ **Backup & Recovery**
- Automatisierte Datenbank-Backups
- Konfigurierbare Retention-Policies
- Backup-Integritätsprüfung
- Disaster Recovery Procedures

✅ **Performance Optimization**
- Gzip/Brotli Kompression
- Static Asset Caching
- Connection Pooling
- Resource Limits

## 🛠️ Voraussetzungen

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ empfohlen)
- **RAM**: Minimum 4GB, empfohlen 8GB+
- **CPU**: Minimum 2 Cores, empfohlen 4+ Cores
- **Disk**: Minimum 50GB freier Speicher
- **Network**: Stabile Internetverbindung

### Software Requirements

```bash
# Docker & Docker Compose
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker $USER

# SSL Certificate Tools (optional)
sudo apt install -y certbot

# Monitoring Tools
sudo apt install -y curl wget htop
```

## 🔧 Installation

### 1. Repository Setup

```bash
# Clone Repository
git clone <repository-url>
cd AIMAS_AIDev

# Checkout Production Branch
git checkout main
```

### 2. Environment Configuration

```bash
# Copy and configure environment file
cp .env.production .env.production.local

# Edit configuration (WICHTIG: Alle CHANGE_ME Werte ersetzen!)
nano .env.production.local
```

#### Wichtige Konfigurationen:

```bash
# Starke Passwörter generieren
openssl rand -base64 32  # Für Datenbank-Passwörter
openssl rand -base64 64  # Für JWT Secrets

# Domain konfigurieren
DOMAIN=yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# SSL Zertifikate
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

### 3. SSL Zertifikate (Produktion)

#### Option A: Let's Encrypt (Empfohlen)

```bash
# Certbot installieren
sudo apt install certbot

# Zertifikat erstellen
sudo certbot certonly --standalone -d yourdomain.com

# Zertifikate kopieren
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
sudo chown $USER:$USER ./ssl/*
```

#### Option B: Self-Signed (Development)

```bash
# Self-signed Zertifikat erstellen
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/C=DE/ST=State/L=City/O=Organization/CN=localhost"
```

### 4. Deployment

```bash
# Deployment-Script ausführbar machen
chmod +x scripts/deploy.sh

# Production Deployment starten
./scripts/deploy.sh
```

## 📊 Monitoring Setup

### Grafana Dashboard

1. **Zugriff**: http://localhost:3000
2. **Login**: admin / (siehe GRAFANA_PASSWORD in .env)
3. **Dashboards importieren**:
   - Node Exporter Dashboard (ID: 1860)
   - Docker Dashboard (ID: 193)
   - Nginx Dashboard (ID: 12559)

### Prometheus Targets

- **Prometheus UI**: http://localhost:9090
- **Targets prüfen**: http://localhost:9090/targets

### Log Aggregation

- **Loki**: http://localhost:3100
- **Logs in Grafana**: Explore → Loki Data Source

## 🔒 Security Konfiguration

### Firewall Setup

```bash
# UFW Firewall konfigurieren
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Monitoring Ports (nur intern)
sudo ufw allow from 10.0.0.0/8 to any port 3000  # Grafana
sudo ufw allow from 10.0.0.0/8 to any port 9090  # Prometheus
```

### Fail2Ban (Optional)

```bash
# Fail2Ban installieren
sudo apt install fail2ban

# Nginx Jail konfigurieren
sudo tee /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
EOF

sudo systemctl restart fail2ban
```

## 💾 Backup Konfiguration

### Automatisierte Backups

```bash
# Backup-Script ausführbar machen
chmod +x scripts/backup.sh

# Cron Job für tägliche Backups (2 Uhr morgens)
crontab -e
# Folgende Zeile hinzufügen:
0 2 * * * /path/to/AIMAS_AIDev/scripts/backup.sh
```

### Backup Restore

```bash
# Datenbank wiederherstellen
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U aima_user -d aima_db < backups/database/aima_db_YYYYMMDD_HHMMSS.sql

# Uploads wiederherstellen
tar -xzf backups/uploads/uploads_YYYYMMDD_HHMMSS.tar.gz -C /
```

## 🔍 Health Monitoring

### Health Check Script

```bash
# Health Check ausführen
chmod +x scripts/health-check.sh
./scripts/health-check.sh

# Automatische Health Checks (alle 5 Minuten)
crontab -e
# Folgende Zeile hinzufügen:
*/5 * * * * /path/to/AIMAS_AIDev/scripts/health-check.sh
```

### Uptime Monitoring

- **UptimeRobot**: https://uptimerobot.com
- **Pingdom**: https://pingdom.com
- **StatusCake**: https://statuscake.com

## 🚀 Performance Tuning

### Docker Optimierungen

```bash
# Docker Daemon Konfiguration
sudo tee /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF

sudo systemctl restart docker
```

### System Optimierungen

```bash
# Kernel Parameter optimieren
sudo tee -a /etc/sysctl.conf << EOF
# Network optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 12582912 16777216
net.ipv4.tcp_wmem = 4096 12582912 16777216

# File descriptor limits
fs.file-max = 65536
EOF

sudo sysctl -p
```

## 🔧 Wartung

### Regelmäßige Aufgaben

```bash
# Docker System bereinigen (wöchentlich)
docker system prune -f

# Log-Rotation prüfen
sudo logrotate -d /etc/logrotate.conf

# SSL Zertifikat erneuern
sudo certbot renew --dry-run
```

### Updates

```bash
# System Updates
sudo apt update && sudo apt upgrade -y

# Docker Images aktualisieren
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d

# Alte Images bereinigen
docker image prune -f
```

## 🚨 Troubleshooting

### Häufige Probleme

#### 1. Container startet nicht

```bash
# Logs prüfen
docker-compose -f docker-compose.production.yml logs service_name

# Container Status prüfen
docker ps -a

# Resource Usage prüfen
docker stats
```

#### 2. Datenbank Verbindungsfehler

```bash
# Datenbank Status prüfen
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Datenbank Logs prüfen
docker-compose -f docker-compose.production.yml logs postgres
```

#### 3. SSL Zertifikat Probleme

```bash
# Zertifikat prüfen
openssl x509 -in ssl/fullchain.pem -text -noout

# Nginx Konfiguration testen
docker-compose -f docker-compose.production.yml exec nginx nginx -t
```

#### 4. Performance Probleme

```bash
# System Resources prüfen
htop
df -h
free -h

# Docker Stats
docker stats --no-stream

# Network Connectivity
netstat -tulpn
```

### Log Locations

- **Application Logs**: `./logs/backend/`
- **Nginx Logs**: `./logs/nginx/`
- **Docker Logs**: `docker-compose logs`
- **System Logs**: `/var/log/syslog`

## 📞 Support

### Monitoring Dashboards

- **Application**: https://yourdomain.com
- **Grafana**: https://yourdomain.com:3000
- **Prometheus**: https://yourdomain.com:9090
- **Health Check**: https://yourdomain.com/health

### Alerting

- **Slack Integration**: Konfiguriert über SLACK_WEBHOOK_URL
- **Email Alerts**: Konfiguriert über SMTP Settings
- **PagerDuty**: Integration über Webhook

### Emergency Procedures

1. **System Down**: `./scripts/health-check.sh` ausführen
2. **Database Issues**: Backup wiederherstellen
3. **Security Incident**: Container stoppen, Logs sichern
4. **Performance Issues**: Resource Monitoring aktivieren

## 📈 Skalierung

### Horizontal Scaling

```yaml
# docker-compose.production.yml
backend:
  deploy:
    replicas: 3
  
nginx:
  # Load Balancer Konfiguration
  upstream backend {
    server backend_1:3001;
    server backend_2:3001;
    server backend_3:3001;
  }
```

### Vertical Scaling

```yaml
# Resource Limits erhöhen
backend:
  deploy:
    resources:
      limits:
        memory: 4G
        cpus: '2.0'
```

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Alle Umgebungsvariablen konfiguriert
- [ ] SSL Zertifikate installiert
- [ ] Firewall konfiguriert
- [ ] Backup-System getestet
- [ ] Monitoring konfiguriert

### Post-Deployment

- [ ] Health Checks bestanden
- [ ] SSL Zertifikat gültig
- [ ] Monitoring Dashboards funktional
- [ ] Backup-Jobs konfiguriert
- [ ] Performance Tests durchgeführt
- [ ] Security Scan durchgeführt

### Go-Live

- [ ] DNS auf Produktions-Server zeigt
- [ ] CDN konfiguriert (falls verwendet)
- [ ] Uptime Monitoring aktiv
- [ ] Team über Go-Live informiert
- [ ] Rollback-Plan bereit

---

## 🎉 Fazit

Phase 5 (Production Deployment) ist erfolgreich implementiert! Das AIMA System ist jetzt produktionsbereit mit:

- ✅ **Security Hardening**: SSL/TLS, Security Headers, Rate Limiting
- ✅ **Monitoring**: Prometheus, Grafana, Loki für vollständige Observability
- ✅ **Backup & Recovery**: Automatisierte Backups mit Retention Policies
- ✅ **Performance**: Optimierte Container, Caching, Load Balancing
- ✅ **Maintenance**: Health Checks, Update Procedures, Troubleshooting

Das System ist bereit für den Produktionseinsatz! 🚀