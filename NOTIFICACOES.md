# Notificações push (lembretes + hábitos)

Passo a passo pra ativar o envio de notificações **mesmo com o app fechado**.
Tudo cabe no plano free do Supabase. Faça na ordem.

## 1. Gerar as chaves VAPID

No terminal (precisa do Node):

```bash
npx web-push generate-vapid-keys
```

Guarde a **Public Key** e a **Private Key** que aparecerem.

## 2. Chave pública no frontend

No `.env` (e nas variáveis de ambiente da Vercel) adicione:

```
VITE_VAPID_PUBLIC_KEY=<sua Public Key>
```

Faça **redeploy** do frontend depois (a chave pública pode ficar no cliente).

## 3. Banco de dados

No SQL editor do Supabase, rode o `supabase_schema.sql` atualizado — ele cria
as tabelas `push_subscriptions`, `reminders` e as colunas de notificação em
`habits`. É idempotente e não apaga nada.

## 4. Supabase CLI

```bash
npm i -g supabase
supabase login
supabase link --project-ref <SEU_PROJECT_REF>
```

(O `PROJECT_REF` está na URL do projeto: `https://<REF>.supabase.co`.)

## 5. Secrets da Edge Function

Crie um segredo aleatório pro cron (qualquer string longa), e configure:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<Public Key>" \
  VAPID_PRIVATE_KEY="<Private Key>" \
  VAPID_SUBJECT="mailto:voce@email.com" \
  CRON_SECRET="<um-segredo-aleatorio-longo>"
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente na função.

## 6. Deploy da função

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

O `--no-verify-jwt` deixa a função ser chamada pelo cron sem token — ela é
protegida pelo header `x-cron-secret` que você definiu.

## 7. Agendar (pg_cron) — rode no SQL editor

Troque `<SEU_PROJECT_REF>` e `<CRON_SECRET>` pelos seus valores:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- roda a cada minuto e chama a Edge Function
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Pra desagendar depois, se precisar: `select cron.unschedule('send-reminders');`

## 8. Testar

1. Abra o app, vá em **Configurações → Notificações → Ativar notificações**
   (no iPhone, instale antes na Tela de Início e abra pelo ícone).
2. Crie um lembrete numa nota (menu `/` → **Lembrete**) com horário daqui a 1–2 min.
3. Espere o minuto virar — a notificação deve chegar, mesmo com o app fechado.

Pra testar a função na mão:

```bash
curl -X POST 'https://<SEU_PROJECT_REF>.supabase.co/functions/v1/send-reminders' \
  -H 'x-cron-secret: <CRON_SECRET>'
```

## Como funciona

- O navegador gera uma *subscription* (salva em `push_subscriptions`).
- O `pg_cron` chama a função a cada minuto.
- A função procura `reminders`/`habits` com `next_fire_at <= agora`, envia o push
  via VAPID e reagenda (diário = +1 dia, intervalo = +X horas até concluir,
  uma vez = desativa). Assinaturas expiradas (404/410) são removidas sozinhas.
