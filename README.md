<p align="center">
  <img src="public/bigital.svg" width="80" alt="Bigital AI Factory" />
</p>

<h1 align="center">Bigital AI Factory</h1>

<p align="center">
  <strong>İşletme bağlamını bilen, AI çalışanlarını koordine eden ve yaptığı işlerden öğrenen yerel AI operasyon sistemi.</strong>
</p>

Bigital AI Factory; CLI, OAuth ve doğrudan API bağlantılarıyla çalışan AI sağlayıcılarını tek bir ürün altında yönetir. Kullanıcı bir işletme ve proje seçer, AI Manager hedefi analiz eder, gerekli ekip ile görev grafiğini kurar, çalışanlar işleri izole Git çalışma alanlarında yürütür, kalite kontrolleri tamamlanır ve sonuç insan onayına sunulur.

Uygulama açıldığında kendiliğinden model çağrısı yapmaz. Token kullanımı yalnızca kullanıcı bir görev, model yanıtı veya bağlantı testi başlattığında oluşur.

## Ürün modülleri

| Modül                         | Sorumluluk                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **AI Manager**                | Talebi analiz eder, planı ve ekip atamalarını oluşturur.                                                    |
| **Bigital Execution Engine**  | Görevleri, gerçek agent süreçlerini, Git worktree izolasyonunu ve canlı durumları yönetir.                  |
| **Bigital Workflow Studio**   | Manager planını denetlenebilir görev grafiği olarak gösterir.                                               |
| **Bigital Project Hive**      | Agent mailbox, proje blackboard'u, paylaşılan bulgular ve circuit breaker akışını sağlar.                   |
| **Bigital Capacity Governor** | Bağlantı, provider seat, kota, maliyet, eşzamanlılık ve insan rezervini dikkate alır.                       |
| **Bigital Graph Engine**      | Kod ilişkilerini, olayları, doğrulanmış çözümleri ve playbook'ları görev için gerekli bağlama dönüştürür.   |
| **Quality Engine**            | Gerçek komut kanıtlarını, bağımsız incelemeyi ve onay durumunu toplar.                                      |
| **Experience Engine**         | Incident, root cause, attempt, solution ve verification kayıtlarından tekrar kullanılabilir deneyim üretir. |

## Temel özellikler

- Türkçe ürün arayüzü ve kullanıcı tarafından anlaşılabilir hata mesajları
- Pixel Office üzerinde çalışanların anlık olarak ne yaptığını gösteren canlı durumlar
- Çalışanlarla normal sohbet üzerinden görev ve proje bilgisi alma
- CLI, OAuth ve API hesaplarını tek **AI Bağlantı Merkezi** ekranında yönetme
- Aynı sağlayıcıya birden fazla adlandırılmış API bağlantısı ekleme
- Bağlantı başına istek, token, maliyet ve sağlayıcı kotası takibi
- İşletme ve proje bazında ayrılmış Company Brain, Project Brain ve özel deneyim verisi
- İzole Git worktree, test, review, insan onayı ve teslimat akışı
- Agent mailbox, ortak blackboard ve tekrarlanan hataları durduran circuit breaker
- Görevden önce yalnızca en ilgili kodu, kararı ve doğrulanmış çözümü getiren Graph Intelligence
- Private proje bilgisini global teknik deneyime taşımadan önce temizleyen sanitization katmanı

## Hızlı başlangıç

Gereksinimler:

- Node.js 22 veya daha yeni sürüm
- pnpm 10.30.1
- macOS, Linux veya Windows

```bash
cd "/Users/rlosener/Documents/Projeler/bigital-ai-factory"
corepack enable
corepack prepare pnpm@10.30.1 --activate
pnpm install --frozen-lockfile
test -f .env || cp .env.example .env
pnpm setup -- --port 8790
DB_PATH=data/bigital.sqlite LOGS_DIR=data/logs pnpm dev:local
```

Ardından uygulamayı açın:

- Arayüz: `http://127.0.0.1:8800/`
- API: `http://127.0.0.1:8790/`
- Sağlık kontrolü: `http://127.0.0.1:8790/healthz`

Kurulum, `.env`, üretim modu, port sorunları ve durdurma adımları için [manuel çalıştırma rehberini](docs/MANUEL_CALISTIRMA.md) kullanın.

## AI bağlantıları

API anahtarlarını kaynak koda yazmayın. Uygulamada **Ayarlar → AI Bağlantıları** ekranını açın.

Bu panelden:

1. CLI, OAuth veya API bağlantısı ekleyebilirsiniz.
2. Aynı sağlayıcı için farklı tokenlara sahip birden fazla bağlantı tanımlayabilirsiniz.
3. Bağlantıları farklı AI çalışanlarına atayabilirsiniz.
4. Yerel istek ve token kullanımını görebilirsiniz.
5. Sağlayıcı kota veya maliyet bilgisi veriyorsa güncel değerleri izleyebilirsiniz.

Sağlayıcının göndermediği veri tahmin edilmez; arayüzde **Sağlayıcı bildirmedi** olarak gösterilir.

## Görev çalışma akışı

```text
Kullanıcı talebi
  → AI Manager analizi
  → Bigital Graph Engine sorgusu
  → İlgili kod + karar + benzer olay + doğrulanmış çözüm
  → Context Optimizer
  → Ekip ve workflow grafiği
  → Bigital Capacity Governor
  → İzole agent çalışması
  → Test ve bağımsız review
  → İnsan onayı
  → Teslimat
  → Experience Engine geri bildirimi
```

Yeni görev branch'leri `bigital/<görev-kısa-kimliği>` adıyla, çalışma alanları `.bigital-worktrees/` altında oluşturulur. Eski yerel kurulumlarda bulunan veri anahtarları yalnızca geriye dönük okuma uyumluluğu için korunur ve ürün arayüzünde gösterilmez.

## Veriler ve güvenlik

- Varsayılan önerilen veritabanı: `data/bigital.sqlite`
- Log klasörü: `data/logs`
- OAuth ve messenger tokenları `OAUTH_ENCRYPTION_SECRET` ile şifrelenir.
- API ve WebSocket erişimi loopback dışına açılırsa `API_AUTH_TOKEN` kullanılmalıdır.
- Project Graph ve Business Graph özel kalır.
- Global Experience yalnızca temizlenmiş ve genelleştirilmiş teknik bilgi içerir.
- Merge, production deploy, dış gönderim ve kritik veri değişiklikleri insan onayına bağlıdır.

## Doğrulama

```bash
pnpm test
pnpm build
pnpm openapi:check
```

Bu komutlar yerel kod ve paket doğrulamasını kanıtlar. Gerçek sağlayıcı hesabı, kota, uzak repository, domain, TLS ve canlı hosting kabulü ayrıca yapılmalıdır.

## Teknik belgeler

- [Manuel çalıştırma](docs/MANUEL_CALISTIRMA.md)
- [Bigital AI Factory mimarisi](docs/BIGITAL_FACTORY_ARCHITECTURE.md)
- [Güncel teknik proje tanımı](docs/BIGITAL_GUNCEL_TEKNIK_PROJE_TANIMI.md)
- [Teknik birleştirme rehberi](docs/BIGITAL_TEKNIK_BIRLESTIRME_REHBERI.md)
- [API rehberi](docs/api.md)
- [OpenAPI sözleşmesi](docs/openapi.json)
- [Dağıtım rehberi](deploy/README.md)
- [Üçüncü taraf bildirimleri](docs/THIRD_PARTY_NOTICES.md)

## Ürün kimliği

Bu repository tek başına **Bigital AI Factory** ürünüdür. Entegre edilen tüm yetenekler Bigital modülleri olarak sunulur; harici projeler veya önceki uygulama adları kullanıcı akışında, ekranlarda, yeni branch adlarında, servislerde ya da kurulum belgelerinde ürün kimliği olarak kullanılmaz.
