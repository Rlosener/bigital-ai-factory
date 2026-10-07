# Bigital AI Factory — teknik birleştirme rehberi

Bu belge, ayrı ekipler tarafından geliştirilen çalışma akışı, agent koordinasyonu, kapasite ve graph intelligence parçalarının tek Bigital AI Factory ürününde nasıl birleştiğini açıklar. Hedef farklı uygulamaları yan yana çalıştırmak değil, bütün yetenekleri tek Bigital domaini ve tek execution omurgası altında toplamaktır.

## Kilit karar

Sistemde yalnızca bir görev ve process sahibi vardır: Bigital Execution Engine. AI Manager planı, Hive koordinasyonu, kapasite seçimi, Graph Intelligence sorgusu, kalite kapısı ve insan onayı bu runtime çevresinde çalışan Bigital modülleridir. Eski geliştirme kollarındaki supervisor, queue, PTY veya scheduler süreçleri ikinci kez çalıştırılmaz.

```text
Kullanıcı
  -> Bigital işletme/proje kapsamı
  -> AI Manager planı
  -> Bigital Graph Engine bağlamı
  -> Bigital Project Hive koordinasyonu
  -> Bigital Capacity Governor seçimi
  -> Bigital task/worktree/process runtime
  -> test + bağımsız review
  -> insan onayı
  -> Bigital Experience Graph öğrenmesi
```

## Birleşen modüller

| Bigital modülü    | Sorumluluk                                                                  | Tek ürün sınırı                                             |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Execution Engine  | Express, SQLite, görevler, CLI process, worktree, WebSocket ve Pixel Office | Tek görev ve process sahibi                                 |
| Workflow Studio   | ekip ve bağımlılık grafiği                                                  | Aynı kalıcı Manager plan sözleşmesi                         |
| Project Hive      | mailbox, blackboard, agent hafıza sınırı ve circuit breaker                 | İkinci supervisor veya task ledger yok                      |
| Capacity Governor | seat kapasitesi, insan rezervi, concurrency ve cooldown                     | Provider bağımsız karar modeli                              |
| Graph Engine      | AST code graph, query, change impact, artımlı update ve reflection          | Task, approval ve business graph sahipliği Manager'da kalır |
| Product Layer     | işletme/proje kapsamı, Manager, kalite, Türkçe UX ve yönetişim              | Ürünün ana domaini                                          |

## Kod seviyesinde birleşim

### 1. Domain ve veri sahipliği

Factory tabloları aynı SQLite veritabanında yaşar. `business_id` ve `project_id` her özel kaydın kapsamını belirler. İşletmeler, projeler, planlar, adımlar, onaylar, teslimler, olaylar, mailbox, blackboard, provider seat ve experience graph aynı transaction modeliyle yönetilir.

Bigital Graph Engine'in yerel graph dosyası yalnızca proje kodunun yapısal ilişkilerini tutar. Müşteri, şirket ve operasyon deneyimi bu dosyaya taşınmaz. Bigital deneyim kayıtları `factory_graph_nodes` ve `factory_graph_edges` tablolarında tutulur.

### 2. Görev oluşturma

Manager önce kalıcı bir plan ve bağımlı adımlar üretir. Plan insan tarafından onaylanmadan agent process başlamaz. Dispatch öncesinde Graph Intelligence katmanı görevi sorgular:

1. Bigital Graph Engine ilgili fonksiyon, servis, dosya ve bağlantıları getirir.
2. Bigital aynı proje içindeki benzer olayları ve başarısız denemeleri bulur.
3. Doğrulanmış çözümler ve uygun global playbook'lar eklenir.
4. Sonuçlar alaka, önceki başarı, güven, teknoloji uyumu, proje/kapsam benzerliği ve güncellik ile sıralanır.
5. Karakter bütçesine uyan kısa bir bağlam agent prompt'una eklenir.

Agent bütün repository'yi veya bütün sohbet geçmişini prompt içinde almaz. Gerektiğinde gerçek dosyayı kendi tool erişimiyle açar.

### 3. Execution ve izolasyon

Yazılım işi Bigital worktree mekanizmasıyla ayrı bir Git çalışma alanında yürür. Agent kimliği, model, provider credential/seat, worker ve runtime birbirinden ayrıdır. Bir agent'ın modelini değiştirmek agent geçmişini veya rolünü değiştirmez.

Kod değişikliği gerçek test/build kapısından geçer. Reviewer üretici agent'tan farklı olmak zorundadır. Nihai onay merge veya production deploy yetkisi vermez. Draft PR hazırlığı yalnızca gerçek GitHub origin ve geçerli `gh` oturumu varsa yapılır.

### 4. Öğrenme döngüsü

Başarısız execution veya kalite sonucu `Incident` ve `Attempt` üretir. Normalize edilmiş hata hash'i aynı hatanın tekrarını ölçer. Başarılı sonuç ancak test, bağımsız review ve nihai insan onayından sonra `verified` experience olur.

```text
Incident -> caused_by -> Root Cause
Incident -> attempted -> Attempt
Incident -> fixed_by -> Solution
Solution -> verified_by -> Verification
Playbook -> prevents -> Prevention Rule
```

Güven sırası `NEW -> OBSERVED -> VERIFIED -> REPEATED -> PROVEN` şeklindedir. Yalnızca doğrulanmış ve genellenebilir çözüm global playbook adayıdır. Global metinde şirket/proje adları, domain, e-posta, yerel path, UUID, token, secret ve bağlantı bilgileri temizlenir.

Nihai insan kararı ayrıca projenin yerel Bigital graph çalışma hafızasına gönderilir:

- onay: faydalı sonuç
- red: başarısız yol
- revizyon: düzeltilmiş sonuç

Reflection sonucu yine proje klasöründe kalır; global experience alanına otomatik olarak kopyalanmaz.

### 5. Artımlı güncelleme

Runtime izole branch'te commit oluşturduğunda artımlı graph güncellemesi arka planda çalışır. Tam graph yeniden çıkarılmak yerine değişen dosya/manifest yaklaşımı kullanılır. Graph güncelleme hatası commit veya PR'ı başarılı saydırmaz; kullanıcı Sinir Ağı ekranında graph durumunu görür ve manuel güncelleme başlatabilir.

## API ve UI sınırı

Türkçe Sinir Ağı ekranı üç gerçek API kullanır:

- `GET /api/factory/graph`: kapsamlı Experience Graph özeti ve kod ağı durumu
- `POST /api/factory/graph/build`: proje kod ağını artımlı üretme/güncelleme
- `POST /api/factory/graph/query`: kod ve deneyim sorgusu ile ajana gidecek kısa bağlam

İç servis katmanı `query_project_graph`, `find_related_code`, `find_similar_incidents`, `get_verified_solutions`, `get_playbook` ve `get_change_impact` işlemlerini tek sözleşmede toplar. Agent'lara graph dosya yolu veya ham JSON verilmez.

## Çakışmaları nasıl yönetiyoruz?

- Aynı görevi yöneten iki scheduler çalıştırmıyoruz.
- Eski geliştirme kollarının veri modellerini topluca taşımıyoruz; Bigital kapsam ve lifecycle kurallarına uyan alanları yeniden modelliyoruz.
- UI componentlerini kopyalamıyoruz; mevcut design system içinde aynı işlevi yeniden kuruyoruz.
- Provider'a özel kota mantığını core domaine sokmuyoruz; adapter normalleştirilmiş kapasite snapshot'ı verir.
- Kod grafiği ile private Experience Graph'i aynı veri olarak kabul etmiyoruz.
- Her değişikliği küçük, test edilebilir ve geri alınabilir entegrasyon dilimlerine ayırıyoruz.

## Birleştirme ve sürümleme akışı

1. Ana omurgayı koruyan bir integration branch açılır.
2. Her yetenek için bir adapter/domain dilimi taşınır; toplu klasör kopyası yapılmaz.
3. Schema değişiklikleri additive migration olarak eklenir.
4. Eski ve yeni API sözleşmeleri birlikte typecheck ve OpenAPI kontrolünden geçer.
5. Domain, runtime, UI ve scope/privacy testleri çalıştırılır.
6. Gerçek browser akışında loading, empty, error, success ve responsive durumları kontrol edilir.
7. Bağımsız review sonrası insan onayıyla merge edilir.
8. Deployment, provider hesabı ve canlı hosting kabulü yerel build kabulünden ayrı tutulur.

## Şu an birleşmiş parçalar

- Business/Project/Manager ve kalıcı Factory planları
- Bigital task/CLI/worktree execution
- bağımsız kalite ve insan onay kapıları
- Bigital blackboard, mailbox ve circuit breaker
- gerçek workflow DAG görünümü
- provider seat, kapasite rezervi ve worker lease modeli
- Bigital kod grafiği adaptörü, bağlam optimizer'ı ve Sinir Ağı ekranı
- private Experience Graph, confidence promotion ve sanitized global playbook
- Türkçe ürün dili, canlı pixel agent durumu, normal agent sohbeti ve merkezi AI bağlantı paneli

## Sonraki güvenli dilimler

Workflow Studio düzenleme ve reusable team templates aynı Factory plan sözleşmesine yazılmalı. Durable Mission/scheduler mevcut Manager ve approval kapılarını yeniden kullanmalı. Remote worker ve Bigital MCP yüzeyi authentication, project scope ve audit eklenmeden açılmamalı. Bu işler mevcut omurganın yerine yeni bir orchestrator kurmamalıdır.
