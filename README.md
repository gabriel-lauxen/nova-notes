# NOVA — segundo cérebro pessoal

Aplicativo web de **produtividade pessoal** (notas, objetivos e hábitos) com estética de HUD espacial, multiusuário e em tempo real na nuvem. Construído do zero em React, com editor estilo Notion, animações 3D em canvas e backend serverless no Supabase.

🔗 **Demo (teste agora):** https://nova-notes-six.vercel.app/

---

## ✨ Funcionalidades

**Notas (editor estilo Notion)**
- Editor de texto rico (Tiptap) com títulos, listas, to-dos, citações, blocos de código, **tabelas** e **divisores**.
- **Menu de barra `/`** para inserir blocos rapidamente (estilo Notion).
- **Links** com diálogo dedicado: texto customizado + URL externa ou link para outra nota interna (navegação client-side).
- **Tabelas** coláveis do Google Docs/Markdown.
- Persistência em **Markdown**, com importar/exportar `.md`.
- Tags, seletor de emoji por categorias e salvamento automático com debounce.

**Objetivos**
- Qualquer nota pode ser marcada como objetivo; a página agrega todas com barra de progresso.
- **Reordenação por drag-and-drop** (dnd-kit) com ordem persistida.
- **Progresso automático**: calculado pela média de checkboxes/dias marcados na nota.

**Hábitos & Rotinas**
- Grade mensal com um checkbox por dia para cada atividade.
- **Métricas e gráficos** do mês (conclusão por hábito, atividade por dia, calendário-heatmap, sequência atual e melhor sequência).
- Visão isolada por hábito e **vínculo com notas** (clicar abre a nota relacionada).
- Reordenação por drag-and-drop.

**Produtividade**
- **Command palette (Ctrl/Cmd + K)** com busca global em notas (título, conteúdo e tags) e ações de navegação.
- Atalhos de teclado e navegação por SPA.

**Experiência / UI**
- **Tela inicial animada**: campo de partículas em `<canvas>` com matemática pseudo-3D (galáxia/planeta/átomo/sistema solar inclinados, rotação diferencial, projeção em perspectiva e repulsão pelo mouse).
- **Digital rain** estilo Matrix nos cantos e fundo de estrelas em todas as páginas.
- Ícone de "atividades do dia" que **orbita junto com a cena** e vira um mini-menu neon para marcar hábitos do dia.
- **Motor de tema**: escolha uma cor base e o app deriva toda a paleta (fundo, superfícies, bordas, texto, destaques) via manipulação de HSL; 3 tipografias e modo claro/escuro.
- Loader, animações de entrada de página e modais de confirmação.
- **Responsivo**: sidebar vira drawer com botão burger no mobile.

**Conta & dados**
- **Autenticação** por e-mail/senha (Supabase Auth) com nome de perfil.
- **Multiusuário** com isolamento total de dados via **Row Level Security** (`user_id = auth.uid()`).
- **Modo offline-first**: sem Supabase configurado, o app roda 100% local (IndexedDB/localStorage) com a mesma API de dados.

---

## 🛠️ Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, Vite, React Router |
| Editor | Tiptap (ProseMirror) + tiptap-markdown |
| Animação | Canvas 2D (pseudo-3D), GSAP |
| Interações | dnd-kit (drag-and-drop), lucide-react (ícones) |
| Estilo | CSS custom properties (tema dinâmico via HSL), sem framework de UI |
| Backend | Supabase (Postgres, Auth, Row Level Security) |
| Deploy | Vercel (SPA com rewrites) |

---

## 🧠 Destaques técnicos

- **Motor de paleta dinâmica** (`src/theme/palette.js`): a partir de uma única cor, gera ~20 variáveis CSS harmônicas (HSL) que recolorem toda a interface — inclusive a cena em canvas — em tempo real.
- **Camada de dados desacoplada** (`src/lib/store.js`): mesma interface (`notesApi`, `habitsApi`) para dois back-ends — Supabase na nuvem ou armazenamento local — com troca automática conforme a configuração.
- **Renderização pseudo-3D em canvas 2D**: rotação no eixo do disco, inclinação, projeção em perspectiva e profundidade (tamanho/brilho), sem WebGL.
- **Segurança multi-tenant**: políticas RLS no Postgres garantem que cada usuário só acesse os próprios registros, usando a *publishable key* no frontend.
- **Acessibilidade de teclado**: command palette, atalhos e diálogos com Enter/Esc.

---

## 🚀 Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem configuração, já funciona em **modo local** (dados no navegador).

### Conectando o Supabase (nuvem + login)

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, cole `supabase_schema.sql` e rode (cria tabelas, colunas, RLS).
3. **Authentication → Providers:** habilite **Email** (e, para testes, desative *Confirm email*).
4. **Project Settings → API:** copie a **Project URL** e a **Publishable key** (`sb_publishable_...`).
5. Copie `.env.example` para `.env`:

   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   ```

6. Reinicie o `npm run dev`. Agora há login e os dados sincronizam na nuvem.

---

## ☁️ Deploy (Vercel)

1. Suba o repositório no GitHub e importe na Vercel (o Vite é detectado automaticamente).
2. Em **Settings → Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Em **Supabase → Authentication → URL Configuration**, registre a URL da Vercel em *Site URL* e *Redirect URLs*.
4. Deploy. O `vercel.json` já cuida do roteamento SPA.

---

## 📁 Estrutura

```
src/
  theme/palette.js          gerador de paleta (HSL) a partir da cor base
  context/ThemeContext      estado do tema (cor, fonte, modo)
  context/AuthContext       sessão e auth (Supabase)
  lib/supabase.js           cliente Supabase
  lib/store.js              camada de dados (nuvem OU local)
  components/
    JarvisCore              cena de partículas pseudo-3D (canvas)
    MatrixGlitch, Starfield fundos animados
    Editor, slashCommands   editor Tiptap + menu "/"
    CommandPalette          busca global (Ctrl/Cmd+K)
    ProgressTracker         marcador de hábito diário (nó custom do editor)
    Sidebar, Login, modais
  pages/
    Home, Goals, Habits, NotePage, Settings
supabase_schema.sql         schema + RLS multiusuário
vercel.json                 rewrites SPA
```

---

_Projeto pessoal desenvolvido para uso diário e como estudo de front-end, animação em canvas e arquitetura full-stack serverless._
