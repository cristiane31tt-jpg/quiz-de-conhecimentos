# Publicação na Google Play Store — Quiz de Conhecimentos

Checklist técnico e de formulários para publicar o app em **teste interno** e,
depois, em produção. Nada aqui declara conformidade automática: as respostas dos
formulários são de responsabilidade do titular da conta e devem refletir o que o
app realmente faz.

## 1. O que já está pronto no projeto

- `applicationId`: `com.minimonkey.quizdeconhecimentos`.
- Nome: `Quiz de Conhecimentos`.
- `versionCode 1` / `versionName 1.0.0` em `native/app-version.json`.
- `minSdkVersion 24`, `targetSdkVersion 36`, `compileSdk 36`.
- AAB de release assinado por secrets do GitHub Actions.
- Banner AdMob de teste (`testMode: true`), sem anúncios reais.
- Política de privacidade local atualizada (ainda não publicada no site).
- `allowBackup="false"` e permissões apenas `INTERNET` e `ACCESS_NETWORK_STATE`
  (o SDK do Google Mobile Ads adiciona `com.google.android.gms.permission.AD_ID`
  ao manifesto mesclado).

## 2. O que depende de você

| Item | Situação |
| --- | --- |
| Conta de desenvolvedor Google Play | Necessária (taxa única de US$ 25). |
| Keystore de upload + 4 secrets | **Não criados.** Ver seção 3. |
| Publicar a política de privacidade no site | **Pendente.** Ver seção 4. |
| Mensagem UMP no painel do AdMob | **Pendente.** Ver seção 6. |
| Data Safety, público-alvo, classificação, anúncios | **Pendente.** Ver seções 5 a 8. |
| Ícone 512×512, feature graphic, screenshots | **Pendentes.** Ver seção 9. |
| Autorização de commit/push | **Pendente.** Sem isso não há APK nem AAB. |

## 3. Assinatura (secrets do GitHub)

O workflow de release lê quatro secrets. Sem eles o build falha com mensagem
explícita.

| Secret | Conteúdo |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `.jks` em base64, uma linha |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | alias (ex.: `upload`) |
| `ANDROID_KEY_PASSWORD` | senha da chave |

Criação (máquina com JDK 21; não é necessário instalar Android SDK):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

```bash
# Linux/macOS
base64 -w0 upload.jks > upload.jks.base64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | Set-Content -NoNewline upload.jks.base64
```

Depois: **Settings → Secrets and variables → Actions → New repository secret**.

- Guarde `upload.jks` e as senhas fora do repositório.
- `*.jks`, `*.keystore`, `*.b64` já estão no `.gitignore`.
- Use **Play App Signing** no primeiro envio: o Google guarda a chave de
  assinatura do app e o seu keystore passa a ser a chave de upload (redefinível
  no Play Console se perdida).

## 4. Política de privacidade publicada

A política atualizada está em `privacidade.html` (13/11/2026), mas o site
publicado ainda mostra a versão de 09/11/2026:

- Atual: https://cristiane31tt-jpg.github.io/quiz-de-conhecimentos/privacidade.html

A Play Store exige uma URL pública e acessível que descreva a publicidade. Antes
do envio, publique a versão atualizada. Como o Pages usa a branch `main`, isso
significa um push em `main` **somente** com a política (ou o merge da branch
`android`, se você quiser publicar também as 500 perguntas no site).

Sugestão de commit mínimo, sem tocar no restante do site:

```bash
git switch main
git add privacidade.html
git commit -m "Atualiza politica de privacidade para o app Android"
git push origin main
```

## 5. Data Safety (Segurança dos dados)

O app em si não tem servidor, login ou analytics próprio. O **SDK do Google
Mobile Ads (AdMob)** pode coletar e compartilhar dados. A referência oficial é:

- https://support.google.com/admob/answer/11027496 (divulgação de dados do SDK)
- https://support.google.com/googleplay/android-developer/answer/10787469 (Data Safety)

Mapeamento provável para o formulário (confirme antes de enviar):

| Categoria do Play | Dados | Coletado | Compartilhado | Finalidade |
| --- | --- | --- | --- | --- |
| Localização | localização aproximada | Sim (pelo SDK) | Sim (Google) | Publicidade, prevenção de fraude |
| IDs do dispositivo | ID de publicidade / outros IDs | Sim | Sim | Publicidade, medição |
| Atividade no app | interações com anúncios | Sim | Sim | Publicidade, medição |
| Informações e desempenho do app | diagnóstico, desempenho | Sim | Sim | Publicidade, diagnóstico |
| Informações pessoais | — | Não | Não | — |
| Financeiro, saúde, mensagens, contatos, fotos | — | Não | Não | — |

Outras respostas típicas:

- “Os dados são criptografados em trânsito?” — o SDK do Google usa HTTPS;
  confirme na documentação do SDK antes de marcar.
- “Os usuários podem solicitar a exclusão dos dados?” — não há conta. O histórico
  local é apagado pelo botão “Limpar histórico” e desinstalar o app remove os
  dados locais. A exclusão de dados tratados pelo Google segue os canais do
  Google.
- O app não coleta dados quando o usuário não permite anúncios: nesse caso o
  banner não é exibido.

## 6. Consentimento (UMP)

- O código chama `requestConsentInfo` → `showConsentForm` → só então inicializa o
  SDK.
- A **mensagem de consentimento precisa existir no painel do AdMob** (AdMob →
  Privacidade e mensagens). Sem ela, o formulário não aparece e
  `canRequestAds` pode ficar `false` em regiões que exigem consentimento.
- Configure a mensagem para EEE, Reino Unido e Suíça. Para o Brasil (LGPD), a
  base legal e a necessidade de consentimento para publicidade personalizada
  devem ser avaliadas juridicamente.
- O botão “Gerenciar preferências de anúncios” aparece na política de
  privacidade do app quando o UMP indica que a revisão é obrigatória.
- Os IDs de teste não geram receita. **Antes de publicar em produção**, troque os
  IDs em `native/ads-config.json`, defina `testMode: false` e revise privacidade e
  Data Safety. Para teste interno, os IDs de teste são aceitáveis.

## 7. Público-alvo

O quiz é de conhecimento geral e não foi projetado para crianças. Recomendação:
declarar público **13+ / geral**, não direcionado a crianças.

- Se optar por incluir crianças, valem as Políticas para Famílias do Play e as
  regras de anúncios para crianças (sem publicidade personalizada, tratamento
  child-directed). Isso exige mudanças no código e no AdMob.
- A escolha final é sua; não marque “direcionado a crianças” sem essa análise.

## 8. Classificação indicativa e anúncios

- Questionário IARC: quiz de perguntas e respostas, sem violência, conteúdo
  sexual, drogas, apostas ou compras. A tendência é classificação livre, mas a
  nota final vem do questionário.
- **Declaração de anúncios: “O app contém anúncios” = Sim.**
- Categoria sugerida: Jogos → Trivia (ou Educação, se preferir).
- O app não tem compras no app, assinaturas ou login.

## 9. Ficha da loja (assets)

Obrigatórios para publicar:

- Ícone 512×512 PNG (32-bit).
- Feature graphic 1024×500 PNG/JPEG.
- Pelo menos 2 screenshots de celular (mín. 320 px, máx. 3840 px).
- Nome (até 30 caracteres): `Quiz de Conhecimentos`.
- Descrição curta (até 80 caracteres) e descrição completa (até 4000).
- E-mail de contato: `minimonkeyoficial@gmail.com`.
- URL da política de privacidade (seção 4).
- Categoria e tags.

O ícone/splash do app ainda é o padrão do Capacitor; o ícone da loja é um
arquivo separado e pode ser enviado mesmo assim.

## 10. Passo a passo para teste interno

1. Autorizar o commit e o push da branch `android` (o workflow gera o APK de
   debug como artefato).
2. Criar o keystore de upload e configurar os 4 secrets.
3. Publicar a política de privacidade atualizada no site (seção 4).
4. Estando na branch `android`, criar a tag para o AAB assinado:
   ```bash
   git switch android
   git tag android-v1.0.0
   git push origin android-v1.0.0
   ```
   O artefato `quiz-de-conhecimentos-release-aab-1.0.0-1` aparece em Actions.
5. No Play Console: **Criar app** → nome, idioma, “App”, gratuito, aceitar
   declarações.
6. Preencher: Acesso ao app (sem restrições), Anúncios (Sim), Classificação de
   conteúdo, Público-alvo, Data Safety, Política de privacidade.
7. **Teste interno** → criar faixa → enviar o AAB → adicionar e-mails de teste.
8. Instalar pelo link do teste interno (não é necessário instalar o APK de debug
   no celular).
9. Avaliar banner, safe areas, offline, consentimento e privacidade.
10. Só depois de validar, promover para produção — trocando antes os IDs de
    teste pelos IDs reais do AdMob (`testMode: false`) e atualizando Data Safety.

## 11. Observações de risco

- `versionCode` nunca pode repetir: incremente `native/app-version.json` a cada
  upload.
- O identificador `com.minimonkey.quizdeconhecimentos` é definitivo após a
  primeira publicação.
- `play-services-ads:25.4.+` é uma versão dinâmica do plugin; uma atualização
  futura do Google pode exigir ajuste no build.
- Testar o app em um aparelho real continua sendo necessário antes da produção,
  mesmo com o teste interno.
- Revisão jurídica da política e das bases legais (LGPD/GDPR) é recomendada.
