import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import {
  Download,
  Upload,
  Trash2,
  Check,
  Loader2,
  Target,
  MoreVertical,
} from "lucide-react";
import Editor from "../components/Editor";
import LinkDialog from "../components/LinkDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import EmojiPicker from "../components/EmojiPicker";
import AIDialog from "../components/AIDialog";
import { RingLoader } from "react-spinners";
import { marked } from "marked";
import { generateNote } from "../lib/ai";
import { notesApi } from "../lib/store";

// cor primária atual (para o spinner)
function accentColor() {
  if (typeof window === "undefined") return "#a855f7";
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#a855f7";
}

// conta checkboxes (to-dos) e os dias dos marcadores de progresso
function countTasks(md) {
  const text = md || "";
  const items = text.match(/^\s*[-*+]\s+\[( |x|X)\]/gm) || [];
  let total = items.length;
  let checked = items.filter((l) => /\[(x|X)\]/.test(l)).length;
  const trackers = text.matchAll(/data-count="(\d+)"\s+data-done="([01]*)"/g);
  for (const m of trackers) {
    total += parseInt(m[1], 10);
    checked += (m[2].match(/1/g) || []).length;
  }
  return { total, checked };
}

export default function NotePage({ onChanged, onDeleted }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [allNotes, setAllNotes] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | saving | saved
  const [tagInput, setTagInput] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [headMenu, setHeadMenu] = useState(null); // null | { x, y }
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);

  const openHeadMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHeadMenu({ x: Math.max(8, r.right - 210), y: r.bottom + 4 });
  };
  const saveTimer = useRef(null);
  const fileInput = useRef(null);
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const [aiPos, setAiPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    let active = true;
    notesApi.get(id).then((n) => active && setNote(n));
    notesApi
      .list()
      .then((ns) => active && setAllNotes(ns.filter((n) => n.id !== id)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  // abre o diálogo de link (disparado pelo menu "/")
  useEffect(() => {
    const openLink = () => setLinkOpen(true);
    const openAi = () => setAiOpen(true);
    window.addEventListener("nova:add-link", openLink);
    window.addEventListener("nova:ai-generate", openAi);
    return () => {
      window.removeEventListener("nova:add-link", openLink);
      window.removeEventListener("nova:ai-generate", openAi);
    };
  }, []);

  const runAi = async (instruction, meta) => {
    setAiOpen(false);
    setAiError(null);
    // posiciona o indicador no cursor e rola até ele
    const ed0 = editorRef.current;
    if (ed0 && bodyRef.current) {
      ed0.chain().focus().scrollIntoView().run();
      try {
        const c = ed0.view.coordsAtPos(ed0.state.selection.from);
        const r = bodyRef.current.getBoundingClientRect();
        setAiPos({ top: c.top - r.top, left: c.left - r.left });
      } catch {
        setAiPos({ top: 0, left: 0 });
      }
    }
    setAiBusy(true);
    try {
      const { content, title, emoji } = await generateNote(instruction, meta);
      const ed = editorRef.current;
      if (ed && content)
        ed.chain().focus().insertContent(marked.parse(content)).run();
      const patch = {};
      if (meta && title) patch.title = title;
      if (meta && emoji)
        patch.emoji = Array.from(emoji.trim())[0] || emoji.trim();
      if (Object.keys(patch).length) queueSave(patch);
    } catch (e) {
      setAiError(e.message || "Falha ao gerar.");
    } finally {
      setAiBusy(false);
    }
  };

  const queueSave = (patch) => {
    setNote((n) => ({ ...n, ...patch }));
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await notesApi.update(id, patch);
      setStatus("saved");
      onChanged?.();
      setTimeout(() => setStatus("idle"), 1500);
    }, 600);
  };

  const handleContent = (content) => {
    const patch = { content };
    const { total, checked } = countTasks(content);
    if (total > 0) {
      patch.progress = Math.round((checked / total) * 100);
      patch.done = patch.progress === 100;
    }
    queueSave(patch);
  };

  const exportMd = () => {
    const blob = new Blob([note.content || ""], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(note.title || "nota").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importMd = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    queueSave({ content: text, title: file.name.replace(/\.md$/i, "") });
    e.target.value = "";
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    await notesApi.remove(id);
    onDeleted?.(id);
  };

  const insertLink = ({ text, href }) => {
    setLinkOpen(false);
    const ed = editorRef.current;
    if (ed)
      ed.chain().focus().insertContent(`<a href="${href}">${text}</a> `).run();
  };

  // clique em link: nota interna navega no app, externo abre em nova aba
  const onBodyClick = (e) => {
    const a = e.target.closest && e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    if (href.startsWith("/note/")) navigate(href);
    else window.open(href, "_blank", "noopener");
  };

  const toggleGoal = () =>
    queueSave({
      is_goal: !note.is_goal,
      emoji: !note.is_goal && note.emoji === "📄" ? "🎯" : note.emoji,
    });
  const focusBody = () => editorRef.current?.commands.focus("start");

  // sincroniza o título (carregar nota / título gerado pela IA) sem mover o cursor
  useEffect(() => {
    const el = titleRef.current;
    if (el && el.textContent !== (note?.title || ""))
      el.textContent = note?.title || "";
  }, [note?.title]);

  if (!note) return <div className="panel">Carregando…</div>;

  return (
    <div className="editor-page">
      <div className="editor-head">
        <button
          className={"goal-toggle" + (note.is_goal ? " on" : "")}
          onClick={toggleGoal}
          title="Marcar como objetivo"
        >
          <Target size={15} />{" "}
          {note.is_goal ? "Objetivo" : "Marcar como objetivo"}
        </button>
        {note.is_goal &&
          (() => {
            const { total, checked } = countTasks(note.content);
            if (total > 0) {
              return (
                <div
                  className="head-progress"
                  title="Calculado pelas tarefas marcadas"
                >
                  <div className="progress" style={{ width: 110 }}>
                    <span style={{ width: `${note.progress || 0}%` }} />
                  </div>
                  <span className="head-progress-val">
                    {note.progress || 0}% · {checked}/{total} ✓{" "}
                  </span>
                </div>
              );
            }
            return (
              <div className="head-progress">
                <input
                  className="range"
                  type="range"
                  min="0"
                  max="100"
                  value={note.progress || 0}
                  onChange={(e) =>
                    queueSave({
                      progress: Number(e.target.value),
                      done: Number(e.target.value) === 100,
                    })
                  }
                />
                <span className="head-progress-val">{note.progress || 0}%</span>
              </div>
            );
          })()}
        {status === "saving" && (
          <span className="save-tag">
            <Loader2 size={14} className="spin" /> salvando…
          </span>
        )}
        {status === "saved" && (
          <span className="save-tag" style={{ color: "var(--accent)" }}>
            <Check size={14} /> salvo
          </span>
        )}
        <div className="spacer" />
        <div className="head-actions">
          <button
            className="icon-btn head-full"
            title="Importar .md"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={18} />
          </button>
          <button
            className="icon-btn head-full"
            title="Exportar .md"
            onClick={exportMd}
          >
            <Download size={18} />
          </button>
          <button
            className="icon-btn head-full"
            title="Excluir"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={18} />
          </button>

          <button
            className="icon-btn head-more"
            title="Mais"
            onClick={openHeadMenu}
          >
            <MoreVertical size={18} />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          hidden
          onChange={importMd}
        />
      </div>

      <div className="editor-body fade-in">
        <div className="emoji-wrap">
          <button
            className="emoji-input"
            onClick={() => setEmojiOpen((o) => !o)}
            title="Escolher emoji"
          >
            {note.emoji || "📄"}
          </button>
          {emojiOpen && (
            <EmojiPicker
              onPick={(e) => {
                queueSave({ emoji: e });
                setEmojiOpen(false);
              }}
              onClose={() => setEmojiOpen(false)}
            />
          )}
        </div>
        <div
          ref={titleRef}
          className="title-input"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Sem título"
          onInput={(e) => queueSave({ title: e.currentTarget.textContent })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              focusBody();
            }
          }}
        />
        <div className="tags-row">
          {(note.tags || []).map((t) => (
            <span className="tag-chip" key={t}>
              {t}
              <button
                onClick={() =>
                  queueSave({ tags: (note.tags || []).filter((x) => x !== t) })
                }
              >
                ×
              </button>
            </span>
          ))}
          <input
            className="tag-input"
            placeholder="+ tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                const t = tagInput.trim().replace(/^#/, "");
                if (t && !(note.tags || []).includes(t))
                  queueSave({ tags: [...(note.tags || []), t] });
                setTagInput("");
              }
            }}
          />
        </div>
        <div
          ref={bodyRef}
          onClick={onBodyClick}
          className={aiBusy ? "generating" : ""}
          style={{ position: "relative" }}
        >
          {aiBusy && (
            <div className="ai-generating" style={{ top: aiPos.top, left: aiPos.left }}>
              <span className="ai-generating-text">Gerando</span>
              <RingLoader color={accentColor()} size={20} />
            </div>
          )}
          {aiError && (
            <div className="ai-error" style={{ top: aiPos.top, left: aiPos.left }}>
              {aiError} <button onClick={() => setAiError(null)}>×</button>
            </div>
          )}
          <Editor
            content={note.content}
            onChange={handleContent}
            onEditor={(ed) => (editorRef.current = ed)}
          />
        </div>
      </div>

      {headMenu &&
        createPortal(
          <>
            <div className="menu-backdrop" onClick={() => setHeadMenu(null)} />
            <div
              className="card-menu"
              style={{
                position: "fixed",
                top: headMenu.y,
                left: headMenu.x,
                right: "auto",
                zIndex: 120,
              }}
            >
              <button
                onClick={() => {
                  setHeadMenu(null);
                  toggleGoal();
                }}
              >
                <Target size={14} /> Objetivo{" "}
                {note.is_goal && (
                  <Check
                    size={13}
                    style={{ marginLeft: "auto", color: "var(--accent)" }}
                  />
                )}
              </button>
              <button
                onClick={() => {
                  setHeadMenu(null);
                  fileInput.current?.click();
                }}
              >
                <Upload size={14} /> Importar .md
              </button>
              <button
                onClick={() => {
                  setHeadMenu(null);
                  exportMd();
                }}
              >
                <Download size={14} /> Exportar .md
              </button>
              <button
                className="danger"
                onClick={() => {
                  setHeadMenu(null);
                  setConfirmOpen(true);
                }}
              >
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </>,
          document.body,
        )}

      {aiOpen && (
        <AIDialog
          onSubmit={runAi}
          onCancel={() => setAiOpen(false)}
          defaultMeta={
            (!note.title || note.title === "Sem título") &&
            (!note.emoji || note.emoji === "📄")
          }
        />
      )}
      {linkOpen && (
        <LinkDialog
          notes={allNotes}
          onConfirm={insertLink}
          onCancel={() => setLinkOpen(false)}
        />
      )}
      {confirmOpen && (
        <ConfirmDialog
          title="Excluir nota"
          message={`Tem certeza que deseja excluir "${note.title || "Sem título"}"? Esta ação não pode ser desfeita.`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
