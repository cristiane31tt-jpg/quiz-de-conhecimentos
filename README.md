# Quiz de Conhecimentos

Aplicativo web simples para testar seus conhecimentos. Funciona localmente, sem backend.

## Como executar

Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge, Safari).
Para publicar, envie a pasta inteira para qualquer hospedagem estatica com HTTPS.

## Funcionalidades

- Temas: Aleatório, Conhecimentos Gerais, História, Geografia, Ciência, Tecnologia, Cultura, Esportes, Brasil, Curiosidades.
- Dificuldade: Aleatória, Fácil, Médio, Difícil.
- Quantidade: 5, 10, 15, 20.
- Pontuação: +10 por acerto, 0 por erro.
- Feedback imediato com explicação.
- Sons com Web Audio API (liga/desliga).
- Resultado com percentual e mensagem motivadora.
- Compartilhamento do resultado com tema, acertos, total e percentual.
- Histórico dos 5 últimos resultados (localStorage), com limpeza.
- Responsivo para celular, tablet e desktop.
- Acessibilidade básica.

## Compartilhamento

O botão "Compartilhar resultado" monta uma mensagem com:

- tema escolhido;
- acertos e total de perguntas;
- percentual de aproveitamento;
- convite para outra pessoa jogar.

Comportamento:

1. Se o navegador tiver Web Share API (`navigator.share`), abre a folha de
   compartilhamento do sistema (WhatsApp, Telegram, e-mail e outros apps instalados).
2. Sem Web Share, o resultado é copiado para a área de transferência e aparece a
   confirmação "Resultado copiado!", junto com o link "Abrir no WhatsApp".
3. Se a cópia automática falhar, aparece a mensagem de erro e o link do WhatsApp.

O endereço incluído no compartilhamento é sempre o endereço real do app:

- quando publicado em `http` ou `https`, usa a URL atual automaticamente;
- em `file://` (aberto direto do computador) nenhum link é incluído;
- para fixar um domínio específico, preencha `APP_URL` no topo de `js/app.js`.

## Publicidade (Google AdSense)

A estrutura está pronta, mas os anúncios estão DESATIVADOS: nenhum identificador
oficial foi configurado e nenhuma requisição ao Google é feita.

### Onde ficam os dois espaços

1. **Tela inicial**: `#ad-slot-home`, logo depois dos botões de início e histórico
   e antes da nota de privacidade. Fica abaixo das opções de configuração, sem
   competir com o título e sem cobrir os controles.
2. **Tela de resultado**: `#ad-slot-result`, depois do resumo de pontuação e antes
   dos botões de jogar novamente e compartilhar.

Não há anúncios durante as perguntas, sobre alternativas, sobre botões, em pop-ups
ou no histórico.

### Como ativar no futuro

1. Publique o site em HTTPS e cadastre-o no Google AdSense.
2. Depois da aprovação, crie dois blocos de anúncio no painel do AdSense.
3. Abra `js/ads.js` e preencha:

```js
client: 'ca-pub-0000000000000000',   // ID de publicador
slots: {
    home: '0000000000',              // ID do bloco da tela inicial
    result: '0000000000'             // ID do bloco da tela de resultado
},
```

4. Salve e recarregue. O script oficial do AdSense passa a ser carregado uma única
   vez e os dois blocos aparecem automaticamente.

Enquanto `client` estiver vazio:

- o script do AdSense não é carregado;
- os dois blocos ficam com `hidden`, sem reservar espaço em branco;
- nenhuma requisição externa é feita.

Se o provedor não preencher um bloco, a área é recolhida automaticamente para não
deixar espaço vazio.

### Identificadores necessários

- ID de publicador (`ca-pub-...`);
- ID do bloco da tela inicial;
- ID do bloco da tela de resultado.

### O que ainda é necessário para aprovação

- site publicado em domínio próprio ou subdomínio, com HTTPS;
- conteúdo original e navegação clara (já existente);
- política de privacidade publicada (`privacidade.html`, já criada);
- mensagem de consentimento do Google configurada no painel do AdSense para
  visitantes do EEE, Reino Unido e Suíça;
- arquivo `ads.txt` na raiz do domínio, com a linha fornecida pelo AdSense;
- revisão das políticas do programa AdSense antes de ativar.

Nada disso é automático: a monetização só começa depois da configuração dos
identificadores e da aprovação da conta pelo Google.

## Privacidade

O app não pede cadastro e não coleta dados pessoais. Guarda apenas, no próprio
navegador, o histórico dos últimos 5 resultados e a preferência de som.
A política completa está em `privacidade.html`.

## Testes realizados nesta versão

- Carregamento da página sem erros no console.
- Início do quiz pelo botão "Começar Quiz".
- Partida completa até a tela de resultado.
- Compartilhamento nativo (quando disponível) e fallback de cópia.
- Confirmação visual de cópia e link do WhatsApp.
- Banner da tela inicial oculto com anúncios desativados.
- Banner do resultado oculto com anúncios desativados.
- Ausência de espaços vazios quando os anúncios estão desativados.
- Layout em 320 px e 1280 px sem rolagem horizontal.
- Histórico, limpeza do histórico, som e pontuação preservados.

## Estrutura

```
quiz-de-conhecimentos/
  index.html
  privacidade.html
  css/style.css
  js/questions.js
  js/sounds.js
  js/history.js
  js/quiz.js
  js/ads.js
  js/app.js
  README.md
```