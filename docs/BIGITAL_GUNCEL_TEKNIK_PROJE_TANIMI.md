# Bigital AI Factory — güncel teknik proje tanımı

**Belge tarihi:** 7 Ekim 2026

**Kaynak repository:** `/Users/rlosener/Documents/Projeler/bigital-ai-factory`
**Amaç:** BigitalFarm ile yapılacak mimari birleşmede Bigital AI Factory tarafının mevcut, çalışan sözleşmesini tanımlamak.

Bu belge hedef mimariyi değil, mevcut source code içinde bulunan davranışı anlatır. “Çalışıyor”, “kısmi” ve “planlı” sınırları 15. bölümde ayrıca ayrılmıştır.

## 1. Ürünün amacı ve mevcut çalışma akışı

Bigital AI Factory, işletme ve proje bağlamını bilen AI çalışanlarını tek bir yerel operasyon katmanında yöneten bir agent orchestration ürünüdür. Birden fazla CLI, OAuth ve API hesabını tek panelde toplar; görevleri kalıcı planlara dönüştürür; gerçek agent process’lerini izole Git worktree’lerinde çalıştırır; test, bağımsız inceleme ve insan onayıyla teslimata götürür.

Ana akış:

1. Kullanıcı bir işletme ve o işletmeye bağlı proje seçer.
2. Görevi normal sohbetten, görev formundan, directive endpointinden veya Factory çalışma alanından verir.
3. AI Manager talebi `software`, `product` veya `social` akışına sınıflandırır.
4. Manager proje erişimi, Git repository, kullanılabilir agent ve provider önkoşullarını kontrol eder.
5. Kalıcı bir `factory_plan` ve bağımlı `factory_steps` DAG’i oluşturur.
6. Plan kullanıcı onayı bekler. Plan onaylanmadan Factory execution başlamaz.
7. Dispatch öncesi Bigital Graph Engine ilgili kodu, benzer incident’ları, doğrulanmış çözümleri, başarısız denemeleri ve playbook’ları sorgular.
8. Context Optimizer yalnızca en yüksek skorlu, kısa bağlamı agent prompt’una ekler.
9. Model Router rol, tool ihtiyacı, provider kurulumu/oturumu, farklı reviewer zorunluluğu ve kapasite seat’ine göre gerçek agent seçer.
10. Yazılım agent’ı `.bigital-worktrees/<task-id>` altında, `bigital/<task-id>` branch’inde çalışır.
11. CLI/API runtime stdout, durum, token ve hata olaylarını kaydeder; Pixel Office ve canlı agent akışı WebSocket üzerinden güncellenir.
12. Test/build kanıtları toplanır. Üreticiden farklı reviewer diff ve kanıtları inceler.
13. Reviewer revizyon isterse mailbox mesajı üreticiye döner. Tekrarlanan hata circuit breaker’ı `STEER → CONSTRAIN → STOP` yönünde ilerletir.
14. Kalite kapısı geçen deliverable son insan onayına gelir.
15. Onaylanan sonuç versioned deliverable ve verified experience olarak kaydedilir. Ret veya revizyon, başarısız/düzeltilmiş yol olarak Experience Graph’e geri beslenir.
16. GitHub origin ve `gh` oturumu varsa draft PR hazırlanabilir. Merge ve production deploy otomatik değildir.

## 2. Mimari

### 2.1 Ana bileşenler

| Katman             | Mevcut teknoloji                                                      | Görev                                                                                 |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Frontend           | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4                      | Factory workspace, Pixel Office, görev panosu, sohbet, bağlantı ve graph ekranları    |
| Pixel Office       | PixiJS 8                                                              | Agent durumlarını ve ofis hareketlerini görselleştirme                                |
| Backend            | Node.js 22+, Express 5, TypeScript/tsx                                | REST API, orchestration, provider adapter’ları, process ve lifecycle                  |
| Realtime           | `ws` WebSocket                                                        | Görev, agent, Factory ve office olaylarını tarayıcıya yayınlama                       |
| Database           | Node `node:sqlite`, SQLite WAL                                        | Task, agent, plan, approval, usage, mailbox, graph ve audit verisi                    |
| Agent runtime      | `child_process`, CLI adapter’ları ve HTTP provider adapter’ları       | Gerçek CLI process veya şifreli API bağlantısı çalıştırma                             |
| İzolasyon          | Git branch + Git worktree                                             | Her yazılım görevini ayrı çalışma alanında yürütme                                    |
| Scheduler          | Factory runtime + lifecycle interval sweep                            | Uygun adımı başlatma, heartbeat, stale run toparlama ve retry kontrolü                |
| Queue              | SQLite task/subtask/mailbox kayıtları; process içi aktif-run map’leri | Harici Redis/BullMQ yok; kalıcılık SQLite, canlı process sahipliği uygulama sürecinde |
| Graph Intelligence | Bigital Experience Graph + isteğe bağlı yerel AST code graph motoru   | İlgili kod ve öğrenilmiş çözüm retrieval                                              |
| Test               | Vitest, Testing Library, Supertest, Playwright                        | Web, API, sözleşme ve E2E doğrulama                                                   |
| Dağıtım            | Docker, Docker Compose, systemd, nginx örnekleri                      | Yerel/tek sunuculu dağıtım hazırlığı                                                  |

### 2.2 Tek omurga kuralı

Execution Engine tek görev ve process sahibidir. Manager, Workflow Studio, Project Hive, Capacity Governor, Graph Engine ve Experience Engine ikinci bir orchestrator oluşturmaz. BigitalFarm birleşmesinde de tek bir durable task lifecycle, tek bir agent process registry ve tek bir approval modeli korunmalıdır.

### 2.3 Queue ve worker gerçeği

Sistemde ayrı bir message broker yoktur. Kalıcı iş durumu SQLite tablolarındadır. Agent subprocess’leri aynı Node uygulaması tarafından başlatılır; canlı PID/process bilgisi process belleğinde tutulur, task logları ve statüler veritabanına yazılır. Başlangıç ve periyodik lifecycle sweep, canlı process’i olmayan stale `working/in_progress` kayıtlarını toparlar. Çok makineli worker fabric henüz yoktur.

## 3. AI Yönetici

AI Manager ayrı bir görsel chatbot adı değil, Factory planlama ve kontrol katmanıdır.

Verdiği kararlar:

- talebin `software`, `product` veya `social` workflow’u olması;
- risk seviyesinin `low`, `medium` veya `high` olması;
- proje ve Git önkoşullarının yeterli olup olmaması;
- adım sırası ve `depends_on` bağımlılıkları;
- gereken roller ve skill etiketleri;
- uygun agent, provider, model ve provider seat seçimi;
- reviewer’ın üreticiden farklı olması;
- planın başlayabilmesi için hangi insan onayının gerektiği;
- başarısızlıkta retry, steer, constrain veya stop kararı;
- sonucun teslimata ve deneyim kaydına dönüşüp dönüşemeyeceği.

Mevcut V0 plan üretimi deterministik/kural tabanlıdır:

- Yazılım: repository analizi → uygulama/test → bağımsız review
- Ürün: ürün/MVP planı → bağımsız review
- Sosyal: strateji/içerik → marka ve içerik review

Manager tam serbest biçimli bir LLM supervisor değildir. Plan şablonu kod tarafından üretilir; agent içerikleri yapılandırılmış output sözleşmelerinden geçer. Bu yaklaşım kararları tekrar üretilebilir ve test edilebilir tutar.

## 4. Sinir Ağı / öğrenilmiş çözüm sistemi

### 4.1 Çözümden sonra kaydedilenler

Başarısız veya bloke çalışma için:

- normalize edilmiş hata metni;
- SHA-256 `error_hash`;
- aynı hash’in proje kapsamındaki `repeat_count` değeri;
- incident başlığı ve redacted detay;
- outcome: `failed` veya `blocked`;
- task, plan, business ve project bağlantıları;
- kanıt metinleri;
- başarısız attempt node’u.

Başarılı çalışma için:

- versioned deliverable;
- test/build kanıtları;
- bağımsız reviewer sonucu;
- final insan onayı;
- outcome: `verified`;
- solution ve verification node’ları;
- güven seviyesi;
- uygun ise temizlenmiş global playbook ve prevention rule.

### 4.2 Benzer problem eşleştirme

İki farklı eşleştirme mekanizması vardır:

1. **Kesin tekrar:** Normalize edilen hata metninin SHA-256 hash’i aynıysa aynı hata ailesi sayılır ve `repeat_count` artar.
2. **Benzer retrieval:** Sorgu ile node metinleri token/terim kümelerine ayrılır. Jaccard benzeri overlap; geçmiş başarı, confidence, teknoloji uyumu, scope ve recency ile birleştirilir.

Mevcut skor ağırlıkları:

- relevance: %45
- historical success: %20
- confidence: %15
- technology match: %10
- scope match: %5
- recency: %5

`0.22` altındaki kayıtlar elenir. Brief içinde her kategoriden en fazla iki madde ve varsayılan yaklaşık 1.800 karakter bulunur.

### 4.3 LLM çağrısı yapmadan ne yapılır?

LLM kullanmadan şu işler yapılır:

- exact error hash eşleştirme;
- graph node oluşturma ve edge kurma;
- lexical relevance skoru;
- confidence promotion;
- private/global scope filtresi;
- secret/path/domain/e-posta/UUID sanitization;
- AST code graph sorgusu ve change-impact açıklaması;
- kısa context brief üretimi;
- normal sohbette gerçek görev durumundan ilerleme yanıtı.

**Mevcut sistem eski bir çözümü LLM olmadan otomatik olarak source code’a uygulamaz.** Doğrulanmış çözüm deterministic olarak bulunup agent’a context veya operatöre öneri olarak verilir. Kod değiştirme yine agent runtime, gerçek test, reviewer ve insan onayı zincirinden geçer. BigitalFarm birleşmesinde otomatik patch replay eklenecekse yalnız exact technology/version uyumu, temiz çalışma ağacı, idempotent patch, test geçişi ve insan onayıyla açılmalıdır.

### 4.4 Kullanılan teknikler

- Embedding: yok
- Vector database: yok
- Harici ML classifier: yok
- Bigital Experience Graph: SQLite node/edge tabloları
- Code dependency graph: isteğe bağlı yerel AST graph motoru
- Similarity: lexical term overlap + ağırlıklı ranking
- Exact repeat: normalize error + SHA-256
- Confidence: `NEW → OBSERVED → VERIFIED → REPEATED → PROVEN`

Başarılı çözümün `success=1`, başarısız attempt’ın `success=0` değeri vardır. Yalnız `VERIFIED/REPEATED/PROVEN` çözüm playbook adayı olabilir.

## 5. Memory / Brain yapısı

| Katman                        | Mevcut durum | Veri                                                                                                        |
| ----------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| Company Brain                 | Çalışıyor    | Business kapsamındaki `factory_knowledge`, plan, incident, activity ve business-scope graph node’ları       |
| Project Brain                 | Çalışıyor    | Project knowledge, repository yolu, plan/step, task, blackboard, incident, experience ve project graph      |
| Shared Blackboard             | Çalışıyor    | current objective, active plan, shared finding, blocker, decision, deliverable; optimistic version kontrolü |
| Agent Mailbox                 | Çalışıyor    | request, inform, review_feedback, done; idempotency key, parent, hop limit 8, pending/handled               |
| Agent sohbet geçmişi          | Çalışıyor    | `messages`, task logları ve direct chat                                                                     |
| Agent skill memory            | Çalışıyor    | öğrenilmiş skill geçmişi, provider, repo, status, command ve timestamp                                      |
| Agent private semantic memory | Kısmi        | Ayrı bir vector/semantic `agent_memory` tablosu yok; agent’a özel sohbet, görev ve skill geçmişi var        |
| Global Experience             | Çalışıyor    | Sadece sanitize edilmiş, genellenebilir, doğrulanmış playbook/prevention node’ları                          |

Company ve Project kayıtları `business_id/project_id` ile scope edilir. Global Experience üretilirken secret, token, URL, e-posta, UUID, yerel path, domain ve özel isimler temizlenir.

## 6. Sinir Ağı ekranı

Sinir Ağı ekranındaki görsel node/edge’ler **öğrenilmiş Experience Graph’i** temsil eder:

Node türleri:

- `incident`
- `root_cause`
- `attempt`
- `solution`
- `verification`
- `playbook`
- `prevention`

Edge türleri:

- `caused_by`
- `attempted`
- `fixed_by`
- `verified_by`
- `prevents`

Bu ekran agent organizasyon şeması değildir. Agent/step ilişkileri ayrı Workflow Graph ekranındadır.

Kod dependency graph aynı panelde durum, node sayısı ve sorgu sonucu olarak kullanılır; mevcut UI bütün AST code node’larını Experience Graph node’larıyla tek canvas’ta birleştirmez. Code graph, Manager retrieval ve “ilgili kod / değişiklik etkisi” için ayrı kaynaktır.

**Graphify**, kullanıcı tarafından sağlanan yerel arşivde bulunan Apache-2.0 lisanslı AST code graph aracıdır. Bigital içinde ayrı ürün adı olarak sunulmaz. `server/modules/factory/graph/graphify-client.ts` bounded adapter’ı, bağımsız kurulu aracın `update`, `query`, `affected`, `save-result` ve `reflect` CLI komutlarını çağırır. Ham `graphify-out/graph.json` agent prompt’una verilmez.

## 7. AI Çalışanları

Agent sayısı sabit değildir; `agents` tablosundan dinamik gelir. Kullanıcı çalışan ekleyebilir, düzenleyebilir ve silebilir. Factory’nin kullandığı fonksiyonel roller:

- analyst
- developer
- reviewer
- product_manager
- content_strategist
- manager/team_leader
- genel departman/uzman rolleri

Desteklenen provider/runtime tipleri:

- Claude Code CLI
- Codex CLI
- Gemini CLI
- OpenCode CLI
- Kimi CLI
- GitHub Copilot
- Antigravity/OAuth
- doğrudan API provider
- Ollama ve OpenAI-compatible özel endpoint’ler, API provider katmanı üzerinden

Agent kimliği modelden ayrıdır. Agent’ın rolü ve geçmişi kalıcıdır; provider/model ataması değişebilir. Reviewer seçiminde mümkünse farklı provider family tercih edilir ve reviewer üretici agent olamaz.

Agent’lar şu kanallarla haberleşir:

- Factory mailbox;
- task/subtask ilişkileri;
- shared blackboard;
- direct chat/messages;
- Manager activity ve WebSocket olayları;
- review feedback → producer remediation akışı.

## 8. Yetenek sistemi

Skill, agent prompt’una eklenen tekrar kullanılabilir çalışma talimatı ve yetenek paketidir.

Kaynaklar:

- yerleşik katalog;
- repository’ye bağlı öğrenilmiş skill;
- kullanıcı tarafından eklenen custom skill;
- agent’ın mevcut CLI provider’ına kurulmuş skill.

Akış:

1. `GET /api/skills` katalog ve metadata’yı döndürür.
2. `POST /api/skills/learn` repository + skill kimliği + provider listesiyle asenkron kurulum işi açar.
3. Durum `GET /api/skills/learn/:jobId` ve history endpointiyle izlenir.
4. Başarılı kayıt `skill_learning_history` tablosuna yazılır.
5. `prompt-skills.ts`, görevin/agent’ın seçili skill’lerini bounded prompt bloğuna dönüştürür.
6. `POST /api/skills/unlearn` provider CLI’dan kaldırır ve başarılı history kaydını temizler.
7. Custom skill endpointleri ekleme, listeleme ve silmeyi yönetir.

Factory Manager plan adımlarına skill etiketlerini deterministik olarak yazar. Runtime seçili agent’ın kurulmuş ve uygun skill’lerini prompt’a taşır. Henüz embedding tabanlı otomatik skill discovery yoktur.

## 9. Görev sistemi

Ana task state’leri:

- `inbox`
- `planned`
- `collaborating`
- `in_progress`
- `review`
- `done`
- `pending`
- `cancelled`

Factory plan/step/run kendi durumlarını ayrıca tutar. Plan başlangıcı için plan approval gerekir; deliverable bitişi için final approval gerekir.

Failure handling:

- normalized incident ve error hash;
- retry counter;
- aynı hata tekrar sayısı;
- capacity cooldown/`retry_after`;
- reviewer remediation mailbox;
- stale process recovery;
- `NORMAL → STEER → CONSTRAIN → STOP` circuit breaker;
- insan tarafından controller reset/revision.

Varsayılan controller politikası üç deneme, aynı hatada iki tekrar ve 30 dakikalık çalışma sınırı etrafında çalışır. Cost limiti yalnız gerçek sağlayıcı maliyet bildirdiğinde uygulanabilir; bilinmeyen maliyet sıfır sayılmaz.

Concurrency, provider seat’in `max_concurrency`, `reserve_slots`, `human_reserve_percent`, aktif worker lease’leri, cooldown ve remaining capacity değerleriyle sınırlandırılır.

## 10. GitHub / kod geliştirme sistemi

Yazılım akışı:

1. Proje path’i gerçek Git repository olarak doğrulanır.
2. Görev için `bigital/<short-task-id>` branch’i açılır.
3. Worktree `.bigital-worktrees/<short-task-id>` altında oluşturulur.
4. Agent yalnız bu çalışma alanında çalışır.
5. Güvenli dosya allowlist’i ile tracked/untracked değişiklikler stage edilir; secret, database, archive ve key dosyaları engellenir.
6. Test/build komutları gerçek exit code, stdout/stderr özeti ve digest ile kaydedilir.
7. Reviewer aynı snapshot/digest’i inceler.
8. Son değişiklikten sonra code graph artımlı güncellenir.
9. GitHub origin ve `gh auth` varsa branch push edilir ve draft PR açılır.
10. Main/master/production/release üzerinde PR hazırlığı engellenir.
11. Merge endpointi explicit kullanıcı aksiyonudur; Factory final approval otomatik merge veya deploy anlamına gelmez.
12. Deploy ayrıca insan kontrollü systemd/nginx veya Docker akışıdır.

Eski branch ve klasör adları yalnız geriye dönük veri uyumluluğu için okunabilir; yeni işler Bigital ad alanını kullanır.

## 11. Güvenlik sınırları

- API key, OAuth refresh token ve messenger tokenları server-side AES-256-GCM ile şifrelenir.
- `.env`, SQLite, key/certificate, credential ve archive dosyaları auto-commit dışında tutulur.
- Loopback dışı API/WebSocket erişiminde bearer token desteklenir.
- CORS ve allowed-origin ayarları vardır.
- Factory repository katmanı knowledge, mailbox, graph ve deliverable girdilerinde secret patternlerini reddeder/redact eder.
- Business/project scope backend sorgularında kontrol edilir.
- Shell komutları serbest metin web endpointi olarak sunulmaz; provider adapter ve task runtime sözleşmeleri üzerinden çalışır.
- CLI agent’ın filesystem erişimi seçilen project/worktree ve host kullanıcısının izinleriyle sınırlıdır. OS sandbox iddiası yoktur.
- Destructive database migration yapılmaz; schema migration’ları additive tasarlanır.
- Main merge, production deploy, dış mesaj/yayın, kritik veri değişikliği ve final deliverable insan onayına bağlıdır.
- Pixel Office operatör görünümüdür; raw terminal logları host seviyesinde korunmalıdır.
- Mevcut business/project scope izolasyonu güvenlik katmanıdır fakat ürün henüz internet ölçekli multi-tenant RBAC iddiasında değildir.

## 12. Veri modeli

### Core tablolar

| Tablo                                                 | İçerik                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `settings`                                            | şirket, dil, provider ve ürün ayarları                         |
| `departments`, `agents`                               | organizasyon, roller, model/provider atamaları ve agent durumu |
| `projects`, `project_agents`                          | repository/project kayıtları ve agent eşlemeleri               |
| `tasks`, `subtasks`, `task_logs`                      | görev lifecycle, alt işler ve teknik loglar                    |
| `messages`                                            | direct chat ve agent mesajları                                 |
| `meeting_minutes`, `meeting_minute_entries`           | toplantı ve review kayıtları                                   |
| `api_providers`                                       | şifreli API bağlantıları ve model cache                        |
| `oauth_accounts`, `oauth_credentials`, `oauth_states` | OAuth hesapları ve bağlantı akışı                              |
| `provider_usage_stats`, `cli_usage_cache`             | istek/token/maliyet/kota snapshot’ları                         |
| `skill_learning_history`                              | skill install/uninstall geçmişi                                |
| `workflow_packs`                                      | workflow pack tanımları                                        |

### Factory tabloları

| Tablo                                        | İçerik                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `businesses`                                 | şirket/işletme scope                                                   |
| `factory_knowledge`                          | Company Brain ve Project Brain kayıtları                               |
| `factory_plans`, `factory_steps`             | Manager DAG ve adımlar                                                 |
| `factory_runs`                               | agent execution, provider/model, token, cost, retry ve capacity sonucu |
| `factory_approvals`                          | plan/deliverable/critical action onayları                              |
| `factory_deliverables`                       | versioned yapılandırılmış sonuçlar                                     |
| `factory_incidents`                          | normalize hata, hash ve repeat count                                   |
| `factory_experience_episodes`                | blocked/failed/verified/rejected deneyim                               |
| `factory_blackboard`                         | proje ortak bağlamı                                                    |
| `factory_mailbox`                            | agent koordinasyon mesajları                                           |
| `factory_activity`                           | insan tarafından okunabilir audit/activity                             |
| `factory_control_events`                     | circuit breaker geçişleri                                              |
| `factory_provider_seats`                     | capacity ve insan rezervi                                              |
| `factory_workers`                            | aktif/released worker lease                                            |
| `factory_graph_nodes`, `factory_graph_edges` | Experience Graph                                                       |

SQLite foreign key, unique index, partial unique index ve WAL/busy timeout kullanır.

## 13. API endpointleri / servisler

OpenAPI sözleşmesinde **133 operation** vardır. Ana gruplar:

### Factory

- `GET /api/factory/workspace`
- `POST /api/factory/businesses`
- `POST /api/factory/projects`
- `POST /api/factory/projects/:id/bind`
- `POST|PATCH|DELETE /api/factory/knowledge...`
- `POST /api/factory/plans`
- `GET /api/factory/plans/:id`
- `POST /api/factory/plans/:id/recheck`
- `POST /api/factory/plans/:id/start`
- `POST /api/factory/plans/:id/controller/reset`
- `POST /api/factory/approvals/:id/resolve`
- `GET /api/factory/graph`
- `POST /api/factory/graph/build`
- `POST /api/factory/graph/query`
- `PUT /api/factory/blackboard/:section`
- `POST /api/factory/mailbox`
- `POST /api/factory/mailbox/:id/handled`
- `POST|PATCH /api/factory/provider-seats...`

### Core operasyon

- `/api/tasks`, `/api/subtasks`, `/api/tasks/:id/run|stop|resume|inject`
- `/api/tasks/:id/diff|merge|discard|verify-commit|terminal`
- `/api/agents`, `/api/agents/:id/spawn`, `/api/agents/active`
- `/api/projects`, path picker/browse ve GitHub clone endpointleri
- `/api/messages`, `/api/directives`, `/api/inbox`, `/api/decision-inbox`
- `/api/api-providers`, `/api/provider-connections/usage`
- `/api/oauth`, `/api/oauth/accounts`, model refresh ve device flow
- `/api/skills`, `/api/skills/learn`, `/api/skills/unlearn`, custom skills
- `/api/workflow-packs`, `/api/workflow/route`
- `/api/task-reports`, meeting minutes ve archive
- `/healthz`, `/api/health`, `/api/openapi.json`

Realtime servis: aynı HTTP server’a bağlı WebSocket hub; `factory_update`, agent/task/activity ve office olaylarını yayınlar.

## 14. Proje klasör ağacı

```text
bigital-ai-factory/
├── src/
│   ├── app/                     # uygulama bootstrap, state ve ana aksiyonlar
│   ├── api/                     # typed frontend API client
│   ├── components/
│   │   ├── factory/             # Manager, Hive, Workflow, Sinir Ağı ve live feed
│   │   ├── settings/            # AI Bağlantı Merkezi ve provider ayarları
│   │   ├── office-view/         # Pixi Office scene/runtime
│   │   └── taskboard/           # görev CRUD, filtre ve diff
│   ├── lib/                     # kullanıcı dostu hata/presentation yardımcıları
│   └── i18n.ts                  # Türkçe runtime ve legacy çeviri sözleşmesi
├── server/
│   ├── server-main.ts           # Express/HTTP/WS uygulama başlangıcı
│   ├── config/runtime.ts        # port, origin, path ve runtime config
│   ├── db/runtime.ts            # SQLite WAL ve migration bootstrap
│   ├── modules/
│   │   ├── factory/             # Manager/domain/runtime/Hive/capacity/experience
│   │   │   └── graph/           # code graph adapter, optimizer, schema, sanitization
│   │   ├── workflow/            # CLI/API agent execution ve orchestration
│   │   ├── routes/              # core/ops REST endpointleri
│   │   ├── bootstrap/           # schema, seed ve lifecycle migration
│   │   └── lifecycle.ts         # stale process ve shutdown yönetimi
│   ├── messenger/               # Telegram/Discord/direct messenger
│   ├── oauth/                   # OAuth yardımcıları
│   ├── security/                # API auth
│   └── ws/                      # WebSocket hub
├── shared/
│   └── factory.ts               # frontend/backend ortak Factory tipleri
├── scripts/                     # setup, migration, QA, OpenAPI ve release araçları
├── tests/e2e/                   # Playwright uçtan uca testleri
├── docs/                        # mimari, API, çalıştırma ve dağıtım belgeleri
├── deploy/                      # systemd, nginx ve Docker örnekleri
├── public/                      # Bigital logo ve pixel sprite’lar
├── data/                        # gitignore edilen yerel SQLite/log alanı
├── README.md
├── package.json
├── Dockerfile
└── docker-compose.yml
```

Önemli dosyalar:

- `server/modules/factory/service.ts`: Manager planı ve domain servisleri
- `server/modules/factory/runtime.ts`: Factory adım dispatch/finalize akışı
- `server/modules/factory/model-router.ts`: agent/model/provider seçimi
- `server/modules/factory/capacity-governor.ts`: seat kapasite kararı
- `server/modules/factory/controller.ts`: circuit breaker
- `server/modules/factory/hive.ts`: mailbox ve blackboard
- `server/modules/factory/graph/intelligence.ts`: Experience Graph
- `server/modules/factory/graph/optimizer.ts`: context ranking
- `server/modules/factory/quality.ts`: gerçek kalite kanıtları
- `server/modules/workflow/core/worktree/lifecycle.ts`: branch/worktree
- `src/components/factory/FactoryWorkspace.tsx`: ana Factory UI
- `src/components/factory/GraphNervousSystem.tsx`: Sinir Ağı ekranı
- `src/components/settings/ConnectionCenterTab.tsx`: merkezi bağlantı paneli
- `docs/openapi.json`: API sözleşmesi

## 15. Gerçekten çalışan / kısmi / planlı

### Çalışan

- React/Express/SQLite uygulaması ve WebSocket realtime
- Türkçe ürün runtime’ı
- Pixel Office ve gerçek agent/task durum gösterimi
- task/subtask CRUD, run, stop, resume, inject, diff ve explicit merge
- CLI/API/OAuth bağlantıları ve aynı provider için çoklu hesap
- bağlantı bazlı yerel request/token/cost istatistikleri
- provider bildirdiğinde quota snapshot’ı
- Manager planı, plan approval, adım dispatch ve deliverable approval
- software/product/social plan şablonları
- farklı reviewer zorunluluğu
- Hive blackboard ve mailbox
- circuit breaker ve incident normalization
- provider seat/capacity sözleşmesi ve worker lease
- private Experience Graph, confidence ve sanitized global playbook
- graph query/build API’si ve Sinir Ağı UI
- Git worktree, test/build evidence ve draft PR hazırlama
- skill katalog, learn/unlearn history ve custom skill
- normal sohbetten gerçek görev/ilerleme bilgisi
- manuel çalıştırma ve deployment örnekleri

### Kısmi / ortama bağlı

- Yerel AST code graph motoru optional external kurulumdur; kurulmazsa Experience Graph çalışır, code graph build çalışmaz.
- GitHub draft PR yalnız gerçek origin ve `gh auth` varsa çalışır.
- Kota doğruluğu provider’ın verdiği metriklerle sınırlıdır.
- Agent private memory ayrı semantic store değildir.
- Workflow Studio mevcut Manager DAG’ini gösterir; serbest graph editor/persisted template tasarımı tamamlanmamıştır.
- Capacity Governor local provider seat ve process concurrency yönetir; çok makineli worker fabric değildir.
- Docker/systemd/nginx dosyaları hazırdır; canlı sunucu kabulü yapılmadan production hazır denemez.
- Messenger kanalları ilgili token ve provider hesabı olmadan dış ortamda doğrulanamaz.

### Planlı / henüz yok

- Durable Mission ve cron/interval scheduler
- remote worker registry ve multi-machine execution
- Bigital MCP server
- embedding/vector DB tabanlı semantic retrieval
- doğrulanmış çözümün otomatik deterministic patch replay’i
- tam RBAC/multi-tenant SaaS authorization
- Workflow Studio’da editable graph ve reusable team templates
- otomatik production deploy
- otomatik main merge
- global deneyimin projeler arası kendiliğinden kod uygulaması

### Mock sınırı

Ana ürün ekranları SQLite/API verisiyle çalışır; yalnız görsel buton şeklinde bırakılmış Factory özelliği hedeflenmemiştir. Testlerde fixture/mock provider kullanımı vardır. Screenshot ve örnek sunum dosyaları ürün kanıtı değil, dokümantasyon örneğidir. Harici provider, GitHub ve hosting kabulü ayrı yapılır.

## 16. BigitalFarm birleşmesinde kesin taşınması gerekenler

1. **Tek orchestration omurgası:** İki task runtime, iki scheduler veya iki agent process registry çalıştırılmamalı.
2. **Business/Project scope:** Her plan, memory, graph, usage ve approval business/project sınırında kalmalı.
3. **AI Manager DAG’i:** Plan ve step’ler kalıcı, denetlenebilir ve tekrar başlatılabilir olmalı.
4. **İnsan onayı:** Plan başlangıcı, final deliverable, merge, deploy ve dış aksiyon sınırları korunmalı.
5. **Bağımsız reviewer:** Üretici ile reviewer aynı agent olamamalı.
6. **Git worktree izolasyonu:** Yeni kod işi `bigital/*` branch ve ayrı worktree’de yürümeli.
7. **Project Hive:** Blackboard optimistic versioning, mailbox idempotency ve hop limit taşınmalı.
8. **Incident + Experience Graph:** Başarılı ve başarısız yollar ayrı kaydedilmeli.
9. **Context Optimizer:** Bütün repo/geçmiş prompt’a basılmamalı; bounded ve ranked brief kullanılmalı.
10. **Private/global ayrımı:** Proje ve şirket verisi global experience’a ham taşınmamalı.
11. **Capacity Governor:** Provider seat, human reserve, cooldown, concurrency ve unknown-capacity davranışı korunmalı.
12. **Connection Center:** CLI, OAuth ve çoklu API token yönetimi tek panelde kalmalı.
13. **Usage visibility:** Request/token/cost/quota provider connection düzeyinde izlenmeli; bilinmeyen değer sıfır gösterilmemeli.
14. **Live agent activity:** Pixel agent ve detay paneli gerçek runtime olaylarından “şu an ne yapıyor” göstermeli.
15. **Türkçe hata/presentation katmanı:** Raw exit code/HTTP hata ana akışta kullanıcıya gösterilmemeli.
16. **Additive migration:** BigitalFarm verisi destructive migration ile dönüştürülmemeli; adapter ve backfill kullanılmalı.
17. **Audit ve evidence:** Test/build/review/approval kanıt zinciri korunmalı.
18. **Uyumluluk kapısı:** BigitalFarm özelliği önce mevcut domain sözleşmesine bağlanmalı; ayrı ürün adı veya ayrı orchestration servisi olarak UI’ya eklenmemeli.

## İlgili belgeler

- `README.md`
- `docs/BIGITAL_FACTORY_ARCHITECTURE.md`
- `docs/BIGITAL_TEKNIK_BIRLESTIRME_REHBERI.md`
- `docs/MANUEL_CALISTIRMA.md`
- `docs/openapi.json`
- `server/modules/bootstrap/schema/base-schema.ts`
- `server/modules/factory/schema.ts`
- `server/modules/factory/control-schema.ts`
- `server/modules/factory/graph/schema.ts`
