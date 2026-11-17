# Aplicativo Android — Quiz de Conhecimentos

Empacotamento Android do Quiz de Conhecimentos com Capacitor, banner de teste do
Google AdMob e build no GitHub Actions. O site publicado continua sendo a raiz do
repositório (`index.html`, `css/`, `js/`) e não é alterado pelo build do app.

## Estado atual

- **Nenhum APK ou AAB foi gerado ainda.** O build depende de rodar o GitHub
  Actions, e isso exige commit/push autorizado.
- **Nenhum commit, push ou publicação foi feito.** O site publicado continua no
  commit `853de58db528251d5b2e2379e2d1d050b64f3210`.
- O build usa o keystore de depuração gerado pelo Gradle. **Nenhuma chave de
  release foi criada** e nenhum secret foi configurado.
- Anúncios reais continuam desativados: `testMode: true` e apenas os IDs
  oficiais de teste do Google.

## Separação entre site e aplicativo

O GitHub Pages publica o site a partir da branch `main` (única branch do
repositório e sem workflow de Pages). Portanto **qualquer push em `main`
republica o site**.

Para não publicar o site por acidente, o empacotamento Android vive na branch
`android`:

| Branch / tag | Efeito |
| --- | --- |
| `main` | Publica o site no GitHub Pages. Não recebe os arquivos Android nesta etapa. |
| `android` | Contém o site + empacotamento Android. Push aqui dispara o workflow de APK de debug. **Não publica o site.** |
| tag `android-v*` | Dispara o workflow de AAB assinado. Tags não publicam o site. |

`privacidade.html`, `js/questions.js` e `js/quiz.js` já estavam modificados
localmente e são preservados. Eles seguem para a branch `android`; a publicação
dessas mudanças no site é uma decisão separada (ver `PLAY_STORE.md`).

## Estrutura

| Caminho | Função |
| --- | --- |
| `package.json` / `package-lock.json` | Dependências Capacitor 8.6.0 e `@capacitor-community/admob` 8.3.0. |
| `capacitor.config.json` | `appId`, nome, `webDir: www`, scheme HTTPS e SystemBars. |
| `native/ads-config.json` | Fonte única dos IDs de teste e da chave `testMode`. |
| `native/app-version.json` | `versionCode` e `versionName` usados no Gradle. |
| `native/native-ads.js` | Banner, consentimento UMP, offline/falha e inset do layout. |
| `scripts/prepare-web.mjs` | Valida as 500 perguntas, gera `www/` e injeta os scripts nativos nas cópias HTML. |
| `scripts/configure-android.mjs` | Grava App ID, nome, permissões, versão e assinatura de release no projeto gerado. |
| `scripts/verify-android.mjs` | Confere o projeto Android antes de compilar (usado no CI). |
| `.github/workflows/android-debug-apk.yml` | Gera o APK de depuração na branch `android`. |
| `.github/workflows/android-release-aab.yml` | Gera o AAB assinado em tags `android-v*`. |
| `.gitignore` | Ignora `node_modules/`, `www/`, `android/`, builds e chaves. |
| `PLAY_STORE.md` | Checklist de publicação, Data Safety, público-alvo e secrets. |

`www/` e `android/` são saídas de build, ignoradas pelo Git e recriadas no CI.
O projeto Android é gerado por `npx cap add android`; não existe `android/`
commitado.

## Identificadores

- Aplicativo: `com.minimonkey.quizdeconhecimentos` (não pode mudar depois da
  primeira publicação na Play Store).
- Nome de exibição: `Quiz de Conhecimentos`.
- Versão inicial: `1.0.0` (`versionCode 1`) em `native/app-version.json`.

Enquanto `testMode` for `true`, o build aceita **somente** os IDs oficiais de
teste:

- App ID: `ca-app-pub-3940256099942544~3347511713`
- Banner: `ca-app-pub-3940256099942544/6300978111`

O banner é único, global, inferior, tamanho `BANNER` (320×50), posição
`BOTTOM_CENTER`, margem 0. Não há intersticiais, premiados ou app open.

## Como o banner se comporta

1. O script só roda dentro do app nativo (Capacitor).
2. Offline: não pede consentimento nem banner; aguarda o evento `online` e tenta
   uma vez.
3. `requestConsentInfo` (UMP).
4. Se o formulário for exigido e estiver disponível, `showConsentForm`.
5. Se `canRequestAds` for `false`, não inicializa o SDK e não mostra banner.
6. Inicializa o SDK e mostra o banner de teste.
7. `bannerAdSizeChanged` vira o inset CSS `--native-ad-inset`; o conteúdo reserva
   o espaço e não fica coberto.
8. Falha de carregamento ou remoção do banner zera o inset.
9. Na página de privacidade, com `privacyOptionsRequirementStatus === 'REQUIRED'`,
   aparece “Gerenciar preferências de anúncios”.

O CSS injetado usa as variáveis `--safe-area-inset-*` do Capacitor para não
colocar conteúdo sob a barra de status, a barra de navegação ou recortes.

## AdSense

O site mantém `js/ads.js` (AdSense) desativado. No app, o arquivo é removido de
`www/js/ads.js` e a linha correspondente sai de `www/index.html`. A única
publicidade do aplicativo é o banner AdMob. O site publicado mantém sua
estrutura original.

## Workflows

### APK de depuração (`android-debug-apk.yml`)

Dispara em push na branch `android` (quando arquivos relevantes mudam) ou
manualmente. Passos:

1. Node 22 + `npm ci`;
2. `npm run prepare:web`;
3. JDK 21 + Android SDK 36/build-tools 36.0.0;
4. `npx cap add android` e `npx cap sync android`;
5. `npm run configure:android`;
6. `npm run verify:android`;
7. `assembleDebug`;
8. artefato `quiz-de-conhecimentos-debug-apk` (14 dias).

APK em `android/app/build/outputs/apk/debug/app-debug.apk`.

### AAB assinado (`android-release-aab.yml`)

Dispara em tag `android-v*` ou manualmente. Além dos passos acima, valida os
secrets de assinatura, decodifica o keystore no runner, executa
`bundleRelease -PrequireReleaseSigning`, confere a assinatura dentro do AAB e
publica o artefato `quiz-de-conhecimentos-release-aab-<versao>` (30 dias).

AAB em `android/app/build/outputs/bundle/release/app-release.aab`. A tag deve
apontar para um commit da branch `android` (que contém os arquivos do app).

Observação: `workflow_dispatch` só aparece na aba Actions depois que o workflow
existe na branch padrão (`main`). Antes disso, use o push na branch `android`
(APK) e a tag `android-v*` (AAB), que funcionam sem tocar em `main`.

## Versionamento

`native/app-version.json` é a fonte única:

```json
{
  "versionCode": 1,
  "versionName": "1.0.0"
}
```

- `versionCode` precisa ser **maior** a cada upload na Play Store.
- `versionName` é o texto exibido na loja (ex.: `1.0.1`).
- O `configure-android.mjs` grava os dois em `android/app/build.gradle` e o
  `verify-android.mjs` confere.

## Assinatura de release

O workflow espera quatro secrets em **Settings → Secrets and variables →
Actions**:

| Secret | Conteúdo |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | arquivo `.jks` convertido em base64, em uma linha |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | alias da chave (ex.: `upload`) |
| `ANDROID_KEY_PASSWORD` | senha da chave |

O keystore é criado por você (o projeto não gera nem inventa chaves). Em uma
máquina com JDK 21:

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Converta para base64:

```bash
# Linux/macOS
base64 -w0 upload.jks > upload.jks.base64

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | Set-Content -NoNewline upload.jks.base64
```

Guarde `upload.jks` e as senhas fora do repositório (gerenciador de senhas ou
cofre). `*.jks`, `*.keystore` e `*.b64` estão no `.gitignore`.

O projeto usa **Play App Signing**: na primeira publicação o Google guarda a
chave de assinatura do app; o keystore acima é a **chave de upload**. Se a chave
de upload for perdida, ela pode ser redefinida no Play Console.

Sem os quatro secrets o workflow de release falha com mensagem explícita e não
gera AAB.

## Build local (opcional)

Requisitos: Node.js 22+, JDK 21, Android SDK 36 e build-tools 36.0.0. Nesta
máquina esses itens não estão instalados, então o build local não foi testado.

```bash
npm ci
npm run prepare:web
npx cap add android
npx cap sync android
npm run configure:android
npm run verify:android
cd android
./gradlew assembleDebug        # APK de debug
./gradlew bundleRelease        # AAB (exige os 4 secrets/variáveis)
```

No Windows, use `gradlew.bat`. Para o AAB local, defina `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` e
passe `-PrequireReleaseSigning`.

## Verificações executadas (sem Android local)

- `node --check` em `native/native-ads.js` e nos scripts: OK.
- `prepare-web.mjs`: 500 perguntas (179 fáceis, 162 médios, 159 difíceis),
  9 temas, `www/` gerado, HTML original preservado, AdSense fora da cópia.
- Patch do Android validado em memória contra o template real do Capacitor
  8.6.0: `applicationId`, `namespace`, `versionCode`, `versionName`,
  `signingConfigs`, `allowBackup="false"`, permissões, App ID e idempotência: OK.
- `verify-android.mjs` executado sem `android/`: falha com mensagens claras, sem
  exceção não tratada (comportamento esperado fora do CI).
- Workflows YAML validados com parser `js-yaml`: OK.
- Harness Node com bridge Capacitor simulada (etapa anterior): 32/32
  verificações do fluxo de anúncios.

## Pendências

- Autorizar commit/push na branch `android` para gerar o APK de debug.
- Criar o keystore de upload e configurar os quatro secrets para o AAB.
- Publicar a política de privacidade atualizada no site (ver `PLAY_STORE.md`).
- Configurar a mensagem UMP no painel do AdMob.
- Preencher Data Safety, público-alvo, classificação e declaração de anúncios.
- Ícone e splash personalizados; teste em dispositivo real.
- Revisão jurídica da política. Este documento não declara conformidade
  automática com LGPD, GDPR ou políticas do Google.

## Git

- Branch atual: `main`
- HEAD: `853de58db528251d5b2e2379e2d1d050b64f3210`
- Sem commit e sem push.
- Alterações locais: `js/questions.js`, `js/quiz.js`, `privacidade.html`.
- Novos arquivos não rastreados: `.github/`, `.gitignore`, `ANDROID.md`,
  `PLAY_STORE.md`, `capacitor.config.json`, `native/`, `package.json`,
  `package-lock.json`, `scripts/`.
