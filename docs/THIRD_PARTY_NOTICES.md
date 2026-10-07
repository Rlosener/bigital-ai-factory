# Üçüncü taraf bildirimleri

Bu belge yalnızca kaynak, lisans ve atıf sınırlarını kaydeder. Aşağıdaki adlar Bigital AI Factory içinde ürün, modül veya ayrı orchestration sistemi olarak gösterilmez.

## Munder-Difflin

- İncelenen yerel arşiv: `munder-difflin-main`
- Kod lisansı: MIT
- Varlık bildirimi: `LICENSE-ASSETS`, paketlenmiş pixel-art görsellerini MIT kod lisansından ayırır.
- Mimari referans alanları: mailbox, blackboard, agent memory, append-only activity ve circuit breaker.
- Bigital kaynak ağacına bu projenin UI varlıkları kopyalanmadı.

## The Delegation

- İncelenen yerel arşiv: `the-delegation-main`
- Lisans: MIT
- Mimari referans alanları: yönlü workflow grafiği, lead-agent odağı ve inspect edilebilir ekip akışı.
- Bigital bu fikirleri kendi Manager DAG verisi ve kendi bileşenleriyle uygular.

## Clodfarm

- İncelenen yerel arşiv: `clodfarm-main`
- Lisans: MIT
- Mimari referans alanları: insan için kapasite rezervi, seat eşzamanlılığı, kullanım pencereleri ve worker scheduling.
- Sağlayıcıya özel hesap havuzu, AWS/DynamoDB altyapısı ve ayrı farm runtime'ı Bigital ürününe alınmadı.

## Graphify

- İncelenen yerel arşiv: `graphify-8/graphify-8`
- Lisans: Apache-2.0
- Entegrasyon sınırı: Bigital Graph Engine, bağımsız kurulu aracın CLI yüzeyini bounded adapter üzerinden çağırır.
- Bigital'a ait katmanlar: private experience graph, güven dereceleri, global sanitization, context ranking ve kullanıcıya sunulan Türkçe Graph Intelligence API/UI.
- Harici araç görev, agent, Manager planı, provider routing veya insan onayı sahibi değildir.

Üçüncü taraf kaynak dosyaları ve görsel varlıklar Bigital modülleri gibi yeniden paketlenmez. Gelecekte doğrudan kaynak kod alınırsa ilgili copyright ve lisans bildirimi alınan materyalle birlikte eklenecektir.
