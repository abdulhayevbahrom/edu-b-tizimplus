# SAB backend

Express API local serverda ham, Vercel Function sifatida ham ishlaydi.

## Vercelga joylash

1. Vercelda yangi project oching va `backend` papkasini Root Directory sifatida tanlang.
2. Build Command va Output Directory maydonlarini bo'sh qoldiring. Vercel `src/app.js` dagi Express exportni avtomatik aniqlaydi.
3. Environment Variables bo'limiga quyidagilarni kiriting:

   - `MONGODB_URI` - MongoDB Atlas connection string
   - `MONGODB_DB_NAME` - masalan, `sab_center`
   - `AUTH_SECRET` - uzun va o'zgarmaydigan tasodifiy qiymat
   - `CRON_SECRET` - `AUTH_SECRET`dan boshqa uzun tasodifiy qiymat

4. Deploy qiling va `https://<project>.vercel.app/api/health` manzilini tekshiring.
5. Frontenddagi `VITE_API_BASE_URL`ni `https://<project>.vercel.app/api` qilib belgilang.

Secret yaratish uchun:

```bash
openssl rand -base64 48
```

## Vaqtinchalik Vercel cheklovlari

- Socket.IO doimiy WebSocket ulanishi Vercel Functions ichida ishlamaydi. REST API ishlaydi, ammo real-time notification uchun keyinchalik oddiy server yoki alohida realtime provider kerak.
- `uploads` papkasi Vercelda doimiy storage emas. Logo upload vaqtinchalik o'chiriladi; production uchun S3, Cloudinary yoki Vercel Blob ulash kerak.
- Balanslarni davriy yangilash `vercel.json` ichidagi himoyalangan Cron orqali kuniga bir marta ishlaydi. Bu Vercel Hobby tarifiga mos; oddiy serverda mavjud 6 soatlik interval ishlashda davom etadi.

## Oddiy server

```bash
npm install
npm start
```

Oddiy serverga o'tilganda Socket.IO, lokal upload va background interval avvalgidek ishlaydi.

## Contabo VPS deploy

Loyiha serverda `/root/edu-tizimplus` papkasida `edu-tizimplus` process nomi bilan PM2 orqali `4021` portda yuradi. GitHub `main` branchga push bo'lganda workflow ishga tushadi, lekin server faqat pushdagi commit message ichida `deploy` so'zi bo'lsa yangilanadi. Deploy paytida `.github/workflows/deploy.yml` serverga SSH orqali kirib, `/root/edu-tizimplus` papkasida `git pull` qiladi, yangi package bo'lsa `npm ci --omit=dev` qiladi va PM2 restart beradi. Public domain: `edu-tizimplus.my-hotels.uz`.

### 1. VPSni bir marta tayyorlash

Ubuntu serverda:

```bash
sudo apt update
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

`.env` faylini serverda yarating:

```bash
mkdir -p /root/edu-tizimplus
nano /root/edu-tizimplus/.env
```

Kerakli envlar:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=sab_center
AUTH_SECRET=replace-with-a-long-random-secret
CRON_SECRET=replace-with-another-long-random-secret
PORT=4021
```

Secret yaratish:

```bash
openssl rand -base64 48
```

PM2 server rebootdan keyin ham ishga tushishi uchun:

```bash
pm2 startup
```

Chiqqan `sudo ...` komandani bir marta bajarib qo'ying.

### 2. Nginx domain sozlash

DNS panelda `edu-tizimplus.my-hotels.uz` uchun `A` recordni Contabo server IP manziliga yo'naltiring.

Serverda Nginx config yarating:

```bash
sudo nano /etc/nginx/sites-available/edu-tizimplus
```

Config:

```nginx
server {
    listen 80;
    server_name edu-tizimplus.my-hotels.uz;

    location / {
        proxy_pass http://127.0.0.1:4021;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Yoqing va tekshiring:

```bash
sudo ln -s /etc/nginx/sites-available/edu-tizimplus /etc/nginx/sites-enabled/edu-tizimplus
sudo nginx -t
sudo systemctl reload nginx
```

SSL uchun:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d edu-tizimplus.my-hotels.uz
```

### 3. SSH key tayyorlash

Kompyuteringizda deploy uchun SSH key yarating:

```bash
ssh-keygen -t ed25519 -C "edu-tizimplus-deploy" -f ~/.ssh/edu-tizimplus-deploy
```

Public keyni serverga qo'shing:

```bash
ssh-copy-id -i ~/.ssh/edu-tizimplus-deploy.pub user@SERVER_IP
```

Private keyni GitHub secretga joylash uchun ko'ring:

```bash
cat ~/.ssh/edu-tizimplus-deploy
```

### 4. GitHub Secrets

GitHub repo ichida `Settings -> Secrets and variables -> Actions -> New repository secret` orqali qo'shing:

- `VPS_HOST` - server IP manzili
- `VPS_USER` - SSH user, masalan `root` yoki deploy user
- `VPS_SSH_KEY` - yuqoridagi private key matni
- `VPS_PORT` - SSH port, odatda `22` (ixtiyoriy)
- `APP_DIR` - `/root/edu-tizimplus` (ixtiyoriy)

Oddiy push, server yangilanmaydi:

```bash
git add .
git commit -m "Update backend code"
git push origin main
```

Deploy bilan push, server yangilanadi:

```bash
git add .
git commit -m "deploy: update backend"
git push origin main
```
