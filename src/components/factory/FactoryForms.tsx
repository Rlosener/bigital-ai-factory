import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import * as api from "../../api/factory";
import type { FactoryProject, FactoryKnowledge } from "../../../shared/factory";
import { FactoryError } from "./TechnicalDetails";

export type FactoryFormKind = "business" | "project" | "knowledge";
interface Props {
  kind: FactoryFormKind;
  scope: api.FactoryScope;
  unboundProjects: FactoryProject[];
  knowledge?: FactoryKnowledge;
  onClose: () => void;
  onSaved: (id?: string) => Promise<void>;
}
export default function FactoryForms({ kind, scope, unboundProjects, knowledge, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [existing, setExisting] = useState("");
  const [name, setName] = useState(knowledge?.title || "");
  const [description, setDescription] = useState(knowledge?.content || "");
  const [path, setPath] = useState("");
  const [category, setCategory] = useState(knowledge?.category || "brand");
  const [businessKnowledge, setBusinessKnowledge] = useState(!scope.projectId);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const title = knowledge
    ? "Bilgiyi düzenle"
    : { business: "İşletme oluştur", project: "Proje ekle", knowledge: "Bilgi ekle" }[kind];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setValidation("");
    if (!existing && !name.trim()) {
      setValidation(kind === "knowledge" ? "Bilgi başlığı gereklidir." : "Ad alanı gereklidir.");
      return;
    }
    if (kind === "project" && !existing && !path.trim().match(/^(\/|[A-Za-z]:[\\/])/)) {
      setValidation("Proje için sunucuda mevcut olan tam klasör yolunu yazın.");
      return;
    }
    if (kind !== "business" && !existing && !description.trim()) {
      setValidation(kind === "project" ? "Projenin hedefini yazın." : "Bilgi içeriğini yazın.");
      return;
    }
    setBusy(true);
    try {
      let id: string | undefined;
      if (kind === "business")
        id = (await api.createFactoryBusiness({ name: name.trim(), description: description.trim() })).business.id;
      else if (kind === "project") {
        if (existing) {
          await api.bindFactoryProject(existing, scope.businessId);
          id = existing;
        } else
          id = (
            await api.createFactoryProject({
              business_id: scope.businessId,
              name: name.trim(),
              project_path: path.trim(),
              core_goal: description.trim(),
            })
          ).project.id;
      } else if (knowledge)
        await api.updateFactoryKnowledge(knowledge.id, scope, {
          category,
          title: name.trim(),
          content: description.trim(),
        });
      else
        await api.createFactoryKnowledge({
          business_id: scope.businessId,
          project_id: businessKnowledge ? undefined : scope.projectId,
          category,
          title: name.trim(),
          content: description.trim(),
        });
      await onSaved(id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="factory-dialog"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      aria-labelledby="factory-form-title"
    >
      <form onSubmit={submit} className="factory-form" noValidate>
        <div className="factory-section-heading">
          <h2 id="factory-form-title">{title}</h2>
          <button type="button" aria-label="Kapat" onClick={onClose} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        {kind === "project" && unboundProjects.length > 0 && (
          <label>
            Mevcut projeyi bağla
            <select value={existing} onChange={(event) => setExisting(event.target.value)} disabled={busy}>
              <option value="">Yeni proje kaydı oluştur</option>
              {unboundProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!existing && (
          <>
            <label>
              {kind === "knowledge" ? "Başlık" : "Ad"}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                autoFocus
                disabled={busy}
              />
            </label>
            {kind === "project" && (
              <label>
                Proje klasörü
                <input
                  aria-label="Proje klasörü"
                  aria-describedby="factory-path-help"
                  value={path}
                  onChange={(event) => setPath(event.target.value)}
                  placeholder="/tam/yol/proje"
                  disabled={busy}
                />
                <small id="factory-path-help">
                  Sunucuda mevcut bir klasör olmalıdır. Yol kaydedilmeden önce doğrulanır.
                </small>
              </label>
            )}
            {kind === "knowledge" && (
              <>
                <label>
                  Kategori
                  <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={busy}>
                    <option value="brand">Marka ve işletme</option>
                    <option value="technical">Teknik mimari</option>
                    <option value="product">Ürün ve hedef kitle</option>
                    <option value="decision">Kararlar</option>
                    <option value="guidelines">Çalışma kuralları</option>
                  </select>
                </label>
                {scope.projectId && !knowledge && (
                  <label className="factory-checkbox">
                    <input
                      type="checkbox"
                      checked={businessKnowledge}
                      onChange={(event) => setBusinessKnowledge(event.target.checked)}
                      disabled={busy}
                    />
                    İşletmenin bütün projeleriyle paylaş
                  </label>
                )}
              </>
            )}
            <label>
              {kind === "project" ? "Proje hedefi" : kind === "knowledge" ? "İçerik" : "Açıklama"}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={50000}
                disabled={busy}
              />
            </label>
          </>
        )}
        {validation && (
          <p className="factory-error" role="alert">
            {validation}
          </p>
        )}
        {error && <FactoryError error={error} />}
        <div className="factory-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Vazgeç
          </button>
          <button className="factory-primary" disabled={busy} type="submit">
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
