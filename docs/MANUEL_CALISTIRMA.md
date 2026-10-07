# Bigital AI Factory'yi Manuel Çalıştırma

Bu belge projeyi bu bilgisayarda geliştirme veya derlenmiş uygulama modunda çalıştırmak içindir.

## Gereksinimler

- Node.js 22 veya daha yeni sürüm
- pnpm 10.30.1
- macOS, Linux veya Windows

Sürümleri kontrol edin:

```bash
node -v
pnpm -v
```

`pnpm` kurulu değilse Node.js ile gelen Corepack üzerinden etkinleştirin:

```bash
corepack enable
corepack prepare pnpm@10.30.1 --activate
```

## İlk kurulum

Terminalde gerçek proje klasörüne geçin:

```bash
cd "/Users/rlosener/Documents/Projeler/bigital-ai-factory"
```

Bağımlılıkları kilit dosyasındaki sürümlerle kurun:

```bash
pnpm install --frozen-lockfile
```

Henüz `.env` dosyası yoksa örnek dosyayı kopyalayın. Mevcut `.env` dosyasının üzerine yazmayın.

```bash
test -f .env || cp .env.example .env
```

`.env` içindeki `OAUTH_ENCRYPTION_SECRET` değerini gerçek ve güçlü bir anahtarla değiştirin:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Üretilen değeri `.env` dosyasındaki `OAUTH_ENCRYPTION_SECRET` alanına yazın. API anahtarlarını kaynak koda veya bu belgeye eklemeyin; uygulama içindeki **Ayarlar → AI Bağlantıları** ekranından yönetin.

İlk proje hazırlığını çalıştırın:

```bash
pnpm setup -- --port 8790
```

## Geliştirme modunda çalıştırma

Bu çalışma alanındaki mevcut Bigital işletme, proje ve bağlantı kayıtlarını kullanmak için:

```bash
DB_PATH=data/bigital.sqlite LOGS_DIR=data/logs pnpm dev:local
```

Boş, yeni bir yerel veritabanıyla başlamak isterseniz yalnızca `pnpm dev:local` çalıştırabilirsiniz.

Bu komut iki yerel servisi birlikte açar:

- Uygulama: `http://127.0.0.1:8800/`
- API: `http://127.0.0.1:8790/`

Sağlık kontrolü:

```bash
curl -fsS http://127.0.0.1:8790/healthz
```

Uygulamayı durdurmak için çalıştığı terminalde `Ctrl+C` tuşlarına basın.

## Derlenmiş uygulamayı çalıştırma

Önce üretim paketini oluşturun:

```bash
pnpm build
```

Ardından uygulamayı başlatın:

Mevcut Bigital verileriyle:

```bash
DB_PATH=data/bigital.sqlite LOGS_DIR=data/logs pnpm start
```

Bu modda arayüz ve API aynı adresten sunulur:

- `http://127.0.0.1:8790/`

## Veri ve log dosyaları

Bu çalışma alanındaki mevcut Bigital V0 verileri `data/bigital.sqlite` dosyasındadır. Yukarıdaki önerilen komutlar bu dosyayı kullanır.

Özel bir yol tanımlanmadığında dosyalar proje klasöründe tutulur:

- Veritabanı: yol verilmezse proje kökündeki varsayılan sqlite dosyası (bu kurulum `data/bigital.sqlite` kullanır)
- Çalışma logları: `logs/`

Farklı konum kullanmak için `.env` içinde `DB_PATH` ve `LOGS_DIR` ayarlanabilir. Mevcut veritabanını silmek tüm yerel işletme, proje, görev ve bağlantı geçmişini kaybettirir; yedek almadan silmeyin.

## AI bağlantıları ve token kullanımı

Uygulamayı açmak tek başına AI yanıtı üretmez ve completion tokenı harcamaz. Token kullanımı şu işlemlerde başlar:

- Bir görev çalıştırıldığında
- Bir çalışandan model tarafından üretilen normal sohbet yanıtı istendiğinde
- Bağlantı veya model testi açıkça başlatıldığında
- OAuth sağlayıcısında model listesi açıkça yenilendiğinde

Görev durumu, “Ne yapıyorsun?” ve benzeri ilerleme soruları mümkün olduğunda yerel görev verisinden yanıtlanır. Bu akış yeni model çağrısı açmaz.

**Ayarlar → AI Bağlantıları** ekranından:

- CLI, OAuth ve API bağlantılarını tek panelde yönetebilirsiniz.
- Aynı sağlayıcı için farklı adlarla birden fazla API anahtarı ekleyebilirsiniz.
- Her bağlantıyı farklı AI çalışanlara atayabilirsiniz.
- Yerel istek sayısını ve sağlayıcının bildirdiği token, maliyet ve kota bilgisini görebilirsiniz.

Sağlayıcı token, maliyet veya kota bilgisi göndermiyorsa arayüz bunu `Sağlayıcı bildirmedi` şeklinde gösterir. Bilinmeyen değerler sıfır kabul edilmez.

## Sık karşılaşılan sorunlar

### Node.js sürümü eski

`node -v` çıktısı 22'den düşükse Node.js'i güncelleyin, ardından `pnpm install --frozen-lockfile` komutunu yeniden çalıştırın.

### 8800 veya 8790 portu kullanımda

macOS/Linux üzerinde hangi işlemin portu kullandığını kontrol edin:

```bash
lsof -nP -iTCP:8800 -sTCP:LISTEN
lsof -nP -iTCP:8790 -sTCP:LISTEN
```

Eski Bigital sürecini normal biçimde durdurduktan sonra `pnpm dev:local` komutunu tekrar çalıştırın.

### Arayüz açılıyor fakat bağlantı kurulamıyor

1. `http://127.0.0.1:8790/healthz` adresinin yanıt verdiğini kontrol edin.
2. `pnpm dev:local` terminalindeki açık Türkçe hata mesajını inceleyin.
3. `.env` içindeki `HOST=127.0.0.1` ve `PORT=8790` değerlerini kontrol edin.
4. Ayarlar → AI Bağlantıları ekranında ilgili hesabı test edin.

### OAuth hesabı kaydedilemiyor

`.env` içinde gerçek bir `OAUTH_ENCRYPTION_SECRET` bulunduğunu ve uygulamanın bu değişiklikten sonra yeniden başlatıldığını kontrol edin.

## Doğrulama komutları

Değişikliklerden sonra temel kontroller:

```bash
pnpm test
pnpm build
pnpm openapi:check
```

Bu komutların geçmesi yerel kod ve paket doğrulamasıdır. Harici sağlayıcı hesabı, gerçek kota, canlı hosting ve üretim yayını ayrıca doğrulanmalıdır.
