# Bigital AI Factory Dağıtım Rehberi

Bu klasör tek sunuculu Linux kurulumu ve Docker dağıtımı için Bigital AI Factory örneklerini içerir.

## Dosyalar

- `deploy/bigital.env.example`: üretim ortam değişkenleri örneği
- `deploy/bigital-ai-factory@.service`: kullanıcı seviyesinde systemd servisi
- `deploy/nginx/bigital.conf`: `agents.bigital.net` için nginx reverse proxy
- `deploy/docker-compose.bigital.yml`: sunucu kurulumu için Docker Compose tanımı

## Gereksinimler

- Node.js 22 veya daha yeni sürüm
- pnpm 10.30.1
- systemd kullanan Linux
- TLS sonlandırma için isteğe bağlı nginx

## Uygulamayı derleme

```bash
cd ~/bigital-ai-factory
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

## Ortam dosyasını hazırlama

```bash
cp deploy/bigital.env.example deploy/.env.production
```

En az şu alanları gerçek değerlerle doldurun:

- `OAUTH_ENCRYPTION_SECRET`
- `INBOX_WEBHOOK_SECRET`
- `API_AUTH_TOKEN`
- `OAUTH_BASE_URL=https://agents.bigital.net`

Secret değerlerini repository içine commit etmeyin. Provider API anahtarlarını uygulamadaki **Ayarlar → AI Bağlantıları** panelinden ekleyin.

## systemd servisini kurma

```bash
mkdir -p ~/.config/systemd/user
cp deploy/bigital-ai-factory@.service ~/.config/systemd/user/bigital-ai-factory.service
systemctl --user daemon-reload
systemctl --user enable --now bigital-ai-factory
```

Oturum kapatıldığında servisin çalışmayı sürdürmesi gerekiyorsa:

```bash
sudo loginctl enable-linger "$USER"
```

Durum ve loglar:

```bash
systemctl --user status bigital-ai-factory
journalctl --user -u bigital-ai-factory -f
```

## nginx reverse proxy

```bash
sudo cp deploy/nginx/bigital.conf /etc/nginx/sites-available/bigital-ai-factory
sudo ln -s /etc/nginx/sites-available/bigital-ai-factory /etc/nginx/sites-enabled/bigital-ai-factory
sudo nginx -t
sudo systemctl reload nginx
```

Örnek yapılandırma `agents.bigital.net` alan adını ve Let's Encrypt sertifika yollarını kullanır. Alan adı, DNS ve sertifika hazır değilse nginx'i etkinleştirmeyin.

## Sağlık kontrolü

Yerel kontrol:

```bash
curl -fsS http://127.0.0.1:8790/healthz
```

Uzak ve token korumalı kontrol:

```bash
curl -fsS \
  -H "Authorization: Bearer YOUR_API_AUTH_TOKEN" \
  https://agents.bigital.net/healthz
```

## Güncelleme

```bash
cd ~/bigital-ai-factory
git pull
pnpm install --frozen-lockfile
pnpm build
systemctl --user restart bigital-ai-factory
```

## Docker ile çalıştırma

```bash
cp deploy/bigital.env.example deploy/.env.bigital
docker compose -f deploy/docker-compose.bigital.yml up -d --build
docker logs -f bigital-ai-factory
```

Canlı hosting, DNS, TLS, provider hesapları ve gerçek kota değerleri yerel build sonucundan ayrı kabul testleri gerektirir.
