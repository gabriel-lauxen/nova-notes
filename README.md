# NOVA — seu segundo cérebro

App pessoal de notas e objetivos, estilo Notion, com tela inicial animada estilo "Jarvis".
React + Vite, Three.js + GSAP nas animações, editor de texto rico com Markdown e backend no Supabase.

## ✨ O que tem

- **Tela inicial Jarvis** — núcleo 3D (Three.js) com partículas estilo matrix e entrada animada (GSAP). Reage ao mouse e à cor do tema.
- **Editor estilo Notion** — títulos, listas, checkboxes, código, citações. Salva tudo em **Markdown**. Importa e exporta `.md`.
- **Objetivos** — metas com barra de progresso ajustável.
- **Tema personalizável** — escolha **uma cor base** e o app gera automaticamente as variações (mais claras/escuras) de fundo, bordas, texto e destaque. 3 fontes pra alternar + modo claro/escuro. Tudo salvo no navegador.
- **Backend Supabase** — Postgres na nuvem, grátis. Se não configurar, roda em **modo local** (dados no navegador) automaticamente.

## 🚀 Rodando

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Sem nenhuma configuração, já funciona em **modo local**.

## ☁️ Conectando o Supabase (recomendado)

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No painel: **SQL Editor → New query**, cole o conteúdo de `supabase_schema.sql` e rode.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Copie `.env.example` para `.env` e preencha:

   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```

5. Reinicie o `npm run dev`. A faixa de "modo local" some e os dados passam a salvar na nuvem.

> O plano grátis dá 500 MB de banco — milhares de notas em texto cabem com folga. Projetos grátis pausam após 7 dias sem uso; uso diário mantém ativo.

## 🎨 Personalização

- **Cor**: Configurações → escolha um preset ou clique no seletor de cor personalizado. Toda a UI se recolore na hora.
- **Fonte**: Space Grotesk, Inter ou Sora.
- Quer mudar a cor padrão, presets ou fontes? Edite `src/theme/palette.js`.

## 🧱 Estrutura

```
src/
  theme/palette.js        gerador de paleta a partir da cor base
  context/ThemeContext    estado do tema (cor, fonte, modo) + persistência
  lib/supabase.js         cliente Supabase
  lib/store.js            camada de dados (Supabase OU localStorage)
  components/JarvisCore   cena Three.js da home
  components/Editor       editor Tiptap + Markdown
  components/Sidebar
  pages/Home, Goals, Settings, NotePage
```

## ⚠️ Sobre segurança

Por ser pessoal e sem login, as políticas do banco liberam acesso à chave pública (anon). É seguro pro seu uso, mas não publique a anon key. Para multiusuário com login, troque as policies em `supabase_schema.sql` por regras com `auth.uid()`.
