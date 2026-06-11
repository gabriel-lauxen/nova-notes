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
  BookOpen,
  Tag,
  ListChecks,
  Share2,
} from "lucide-react";
import Editor from "../components/Editor";
import Spinner from "../components/Spinner";
import LinkDialog from "../components/LinkDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import EmojiPicker from "../components/EmojiPicker";
import AIDialog from "../components/AIDialog";
import AgentDialog from "../components/AgentDialog";
import ShareDialog from "../components/ShareDialog";
import { RingLoader } from "react-spinners";
import { marked } from "marked";
import { generateNote, transcribe } from "../lib/ai";
import { recordVoice } from "../lib/recorder";
import { notesApi } from "../lib/store";

// 5 presets de tamanho de fonte (fator de escala)
const FONT_SCALES = [0.85, 0.93, 1, 1.12, 1.28];

// cor primária atual (para o spinner)
function accentColor() {
  if (typeof window === "undefined") return "#a855f7";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#a855f7"
  );
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
  const [refactorOpen, setRefactorOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [readMode, setReadMode] = useState(false);
  const [tagAdding, setTagAdding] = useState(false);

  // só mostra o loader se demorar mais de 500ms
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    setShowLoader(false);
    const t = setTimeout(() => setShowLoader(true), 500);
    return () => clearTimeout(t);
  }, [id]);

  // modo leitura é salvo por nota (independente)
  useEffect(() => {
    let on = false;
    try {
      on = localStorage.getItem(`nova-read-${id}`) === "1";
    } catch {}
    setReadMode(on);
  }, [id]);
  const toggleRead = () =>
    setReadMode((v) => {
      const nv = !v;
      try {
        localStorage.setItem(`nova-read-${id}`, nv ? "1" : "0");
      } catch {}
      return nv;
    });
  const [fontIdx, setFontIdx] = useState(() => {
    const v = parseInt(localStorage.getItem("nova-note-font") || "2", 10);
    return Number.isFinite(v) && v >= 0 && v < FONT_SCALES.length ? v : 2;
  });
  const voiceStopRef = useRef(null);
  const runVoiceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("nova-note-font", String(fontIdx));
  }, [fontIdx]);

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
    const openVoice = () => runVoiceRef.current?.();
    const openRefactor = () => setRefactorOpen(true);
    const openAgent = () => setAgentOpen(true);
    window.addEventListener("nova:add-link", openLink);
    window.addEventListener("nova:ai-generate", openAi);
    window.addEventListener("nova:ai-voice", openVoice);
    window.addEventListener("nova:ai-refactor", openRefactor);
    window.addEventListener("nova:ai-agent", openAgent);
    return () => {
      window.removeEventListener("nova:add-link", openLink);
      window.removeEventListener("nova:ai-generate", openAi);
      window.removeEventListener("nova:ai-voice", openVoice);
      window.removeEventListener("nova:ai-refactor", openRefactor);
      window.removeEventListener("nova:ai-agent", openAgent);
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

  // refatora: pega o conteúdo atual da nota e reescreve conforme o pedido
  const runRefactor = async (userPrompt) => {
    setRefactorOpen(false);
    setAiError(null);
    const ed = editorRef.current;
    if (!ed) return;
    const current = ed.storage.markdown.getMarkdown();
    // posiciona o "Gerando" no cursor
    if (bodyRef.current) {
      ed.chain().focus().scrollIntoView().run();
      try {
        const c = ed.view.coordsAtPos(ed.state.selection.from);
        const r = bodyRef.current.getBoundingClientRect();
        setAiPos({ top: c.top - r.top, left: c.left - r.left });
      } catch {
        setAiPos({ top: 0, left: 0 });
      }
    }
    setAiBusy(true);
    try {
      const prompt =
        "Abaixo está o conteúdo atual de uma nota em Markdown. Reescreva/refatore o " +
        "conteúdo TODO conforme o pedido do usuário e devolva a nota completa em " +
        "Markdown (sem comentários nem explicações). Pedido: " +
        userPrompt +
        "\n\n--- Conteúdo atual ---\n" +
        (current || "(vazio)");
      const { content } = await generateNote(prompt, false);
      if (content) ed.chain().focus().setContent(content).run();
    } catch (e) {
      setAiError(e.message || "Falha ao refatorar.");
    } finally {
      setAiBusy(false);
    }
  };

  // roda um ou mais agentes (soma os prompts) + instrução, insere no cursor
  const runAgent = async (chosenAgents, instruction) => {
    setAgentOpen(false);
    setAiError(null);
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
      const persona = chosenAgents
        .map((a) => (a.content || "").trim())
        .filter(Boolean)
        .join("\n\n---\n\n");
      const ed = editorRef.current;
      const noteMd = ed ? ed.storage.markdown.getMarkdown() : "";
      let prompt = persona;
      if (instruction) prompt += `\n\n# Instrução do usuário\n${instruction}`;
      if (noteMd.trim())
        prompt += `\n\n# Conteúdo atual da nota (contexto)\n${noteMd}`;
      const { content } = await generateNote(prompt, false);
      if (ed && content)
        ed.chain().focus().insertContent(marked.parse(content)).run();
    } catch (e) {
      setAiError(e.message || "Falha ao rodar o agente.");
    } finally {
      setAiBusy(false);
    }
  };

  // grava a voz, transcreve e gera o texto no cursor (item "/" Gerar com voz)
  const runVoice = async () => {
    // posiciona o indicador no cursor (igual ao "Gerando")
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
    setAiError(null);
    setRecording(true);
    let blob;
    try {
      const rec = recordVoice({});
      voiceStopRef.current = rec.stop;
      blob = await rec.promise;
    } catch {
      setRecording(false);
      setAiError("Não consegui acessar o microfone.");
      return;
    }
    setRecording(false);
    setAiBusy(true);
    try {
      const text = await transcribe(blob);
      if (!text) throw new Error("Não entendi o áudio. Tente de novo.");
      // enquadra o ditado como pedido de nota, pra a IA aplicar as regras
      // de formatação do SYSTEM (checkboxes, tabelas, títulos…)
      const prompt =
        "A seguir está um ditado de voz. Transforme em uma nota bem organizada " +
        "em Markdown, aplicando a formatação adequada (use checkboxes '- [ ] ' para " +
        "itens acionáveis/listas de compras/tarefas, tabelas quando houver dados a " +
        "comparar, títulos e listas quando ajudar). Preserve o conteúdo, melhore só a " +
        'estrutura. Ditado:\n\n"' +
        text +
        '"';
      const { content } = await generateNote(prompt, false);
      const ed = editorRef.current;
      if (ed && content)
        ed.chain().focus().insertContent(marked.parse(content)).run();
    } catch (e) {
      setAiError(e.message || "Falha ao gerar.");
    } finally {
      setAiBusy(false);
    }
  };
  runVoiceRef.current = runVoice;

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
    if (a) {
      const href = a.getAttribute("href");
      if (!href) return;
      e.preventDefault();
      if (href.startsWith("/note/")) navigate(href);
      else window.open(href, "_blank", "noopener");
      return;
    }
  };

  // área clicável abaixo do editor -> garante uma linha no fim e foca nela
  // (sem rolar pro topo: seta a seleção e foca o DOM com preventScroll)
  const addLineAtEnd = () => {
    if (readMode) return;
    const ed = editorRef.current;
    if (!ed) return;
    const last = ed.state.doc.lastChild;
    const emptyPara =
      last && last.type.name === "paragraph" && last.content.size === 0;
    if (!emptyPara) {
      ed.chain()
        .insertContentAt(ed.state.doc.content.size, { type: "paragraph" })
        .run();
    }
    ed.commands.setTextSelection(ed.state.doc.content.size);
    try {
      ed.view.dom.focus({ preventScroll: true });
    } catch {
      ed.view.dom.focus();
    }
  };

  // marca/desmarca todas as checkboxes (to-dos) da página
  const toggleAllChecks = () => {
    const ed = editorRef.current;
    if (!ed) return;
    let total = 0,
      checked = 0;
    ed.state.doc.descendants((n) => {
      if (n.type.name === "taskItem") {
        total++;
        if (n.attrs.checked) checked++;
      }
    });
    if (!total) return;
    const target = checked < total; // se nem todas marcadas -> marca todas
    ed.chain()
      .focus()
      .command(({ tr }) => {
        tr.doc.descendants((n, pos) => {
          if (n.type.name === "taskItem" && n.attrs.checked !== target)
            tr.setNodeMarkup(pos, undefined, { ...n.attrs, checked: target });
        });
        return true;
      })
      .run();
  };

  const toggleGoal = () =>
    queueSave({
      is_goal: !note.is_goal,
      emoji: !note.is_goal && note.emoji === "📄" ? "🎯" : note.emoji,
    });
  const focusBody = () => editorRef.current?.commands.focus("start");

  // some o balão de erro sozinho depois de alguns segundos
  useEffect(() => {
    if (!aiError) return;
    const t = setTimeout(() => setAiError(null), 6000);
    return () => clearTimeout(t);
  }, [aiError]);

  // sincroniza o título (carregar nota / título gerado pela IA) sem mover o cursor
  useEffect(() => {
    const el = titleRef.current;
    if (el && el.textContent !== (note?.title || ""))
      el.textContent = note?.title || "";
  }, [note?.title]);

  if (!note) return showLoader ? <Spinner /> : null;

  return (
    <div className="editor-page" style={{ "--note-fs": FONT_SCALES[fontIdx] }}>
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
            title="Compartilhar"
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={18} />
          </button>
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
        <div className="title-meta">
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
          <div className="title-controls">
            {tagAdding && (
              <input
                className="tag-input"
                autoFocus
                placeholder="tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={() => setTagAdding(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim().replace(/^#/, "");
                    if (t && !(note.tags || []).includes(t))
                      queueSave({ tags: [...(note.tags || []), t] });
                    setTagInput("");
                  } else if (e.key === "Escape") setTagAdding(false);
                }}
              />
            )}
            <button
              className="meta-btn"
              onClick={() => setTagAdding(true)}
              title="Adicionar tag"
            >
              <Tag size={17} />
            </button>
            <button
              className={"meta-btn" + (readMode ? " active" : "")}
              onClick={toggleRead}
              title="Modo leitura"
            >
              <BookOpen size={18} />
            </button>
          </div>
        </div>
        <div
          ref={titleRef}
          className="title-input"
          contentEditable={!readMode}
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
        {(note.tags || []).length > 0 && (
          <div className="tags-row">
            {(note.tags || []).map((t) => (
              <span className="tag-chip" key={t}>
                <span className="tag-text">{t}</span>
                <button
                  onClick={() =>
                    queueSave({
                      tags: (note.tags || []).filter((x) => x !== t),
                    })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div
          ref={bodyRef}
          onClick={onBodyClick}
          className={"note-body" + (aiBusy || recording ? " generating" : "")}
          style={{ position: "relative" }}
        >
          {recording && (
            <button
              className="ai-listening"
              style={{ top: aiPos.top, left: aiPos.left }}
              onClick={() => voiceStopRef.current?.()}
              title="Parar e gerar"
            >
              <span className="ai-listening-text">Ouvindo</span>
              <span className="ai-listening-dot" />
            </button>
          )}
          {aiBusy && (
            <div
              className="ai-generating"
              style={{ top: aiPos.top, left: aiPos.left }}
            >
              <span className="ai-generating-text">Gerando</span>
              <RingLoader color={accentColor()} size={20} />
            </div>
          )}
          {aiError && (
            <div
              className="ai-error"
              style={{ top: aiPos.top, left: aiPos.left }}
            >
              <span className="ai-error-msg">{aiError}</span>
              <button onClick={() => setAiError(null)}>×</button>
            </div>
          )}
          <Editor
            content={note.content}
            onChange={handleContent}
            onEditor={(ed) => (editorRef.current = ed)}
            editable={!readMode}
          />
          {!readMode && (
            <div className="editor-pad" onClick={addLineAtEnd} />
          )}
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
              <div className="menu-fontsize">
                <span>Fonte</span>
                <div className="fs-options">
                  {FONT_SCALES.map((s, i) => (
                    <button
                      key={i}
                      className={i === fontIdx ? "active" : ""}
                      style={{ fontSize: 11 + i * 2.5 }}
                      onClick={() => setFontIdx(i)}
                      title={`Tamanho ${i + 1}`}
                    >
                      A
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setHeadMenu(null);
                  toggleRead();
                }}
              >
                <BookOpen size={14} /> Modo leitura{" "}
                {readMode && (
                  <Check
                    size={13}
                    style={{ marginLeft: "auto", color: "var(--accent)" }}
                  />
                )}
              </button>
              <button
                onClick={() => {
                  setHeadMenu(null);
                  toggleAllChecks();
                }}
              >
                <ListChecks size={14} /> Marcar/desmarcar todas
              </button>
              <button
                onClick={() => {
                  setHeadMenu(null);
                  setShareOpen(true);
                }}
              >
                <Share2 size={14} /> Compartilhar
              </button>

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
      {refactorOpen && (
        <AIDialog
          title="Refatorar com IA"
          message="Como quer mudar o texto da nota? A IA reescreve o conteúdo todo."
          placeholder="Ex.: resuma em tópicos · deixe mais formal · vire um checklist"
          hideMeta
          onSubmit={runRefactor}
          onCancel={() => setRefactorOpen(false)}
        />
      )}
      {agentOpen && (
        <AgentDialog onSubmit={runAgent} onCancel={() => setAgentOpen(false)} />
      )}
      {shareOpen && (
        <ShareDialog
          noteId={id}
          title={note.title}
          onClose={() => setShareOpen(false)}
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
