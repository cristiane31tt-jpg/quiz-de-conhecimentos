/* Interface: telas, eventos e renderizacao. */

const App = {
    quantity: 10,
    lastResult: null,

    /* Endereco publico do app, usado no compartilhamento.
       Deixe vazio para usar automaticamente a URL atual quando o quiz estiver
       publicado em http/https. So preencha se for hospedar em um dominio proprio.
       Nao invente enderecos. */
    APP_URL: '',

    els: {},

    init: function () {
        this.cacheElements();
        SoundFX.init();
        this.bindHome();
        this.bindQuiz();
        this.bindResult();
        this.bindHistory();
        this.syncSoundButton();
        /* ads.js e opcional: se faltar, o quiz continua funcionando. */
        if (typeof Ads !== 'undefined') Ads.init();
        this.showScreen('screen-home');
    },

    cacheElements: function () {
        const ids = [
            'select-theme', 'select-difficulty', 'btn-sound-toggle', 'sound-icon', 'sound-label',
            'btn-start', 'btn-history-home',
            'btn-quit-quiz', 'quiz-counter', 'score-live', 'progress-bar', 'progress-role',
            'quiz-notice', 'question-text', 'alternatives-list', 'feedback-section', 'feedback-icon',
            'feedback-message', 'explanation-text', 'btn-next-question',
            'score-percent', 'result-headline', 'result-points', 'result-message',
            'result-correct', 'result-wrong', 'result-theme', 'result-difficulty', 'result-qty',
            'btn-play-again', 'btn-share-result', 'btn-pick-theme', 'btn-history-result',
            'copy-feedback', 'whatsapp-share',
            'btn-back-history', 'history-empty', 'history-list', 'history-actions',
            'btn-start-from-history', 'btn-clear-history'
        ];
        const self = this;
        ids.forEach(function (id) { self.els[id] = document.getElementById(id); });
    },

    /* ---------- eventos ---------- */
    bindHome: function () {
        const self = this;
        const qtyButtons = document.querySelectorAll('.qty-btn');

        Array.prototype.forEach.call(qtyButtons, function (btn) {
            btn.addEventListener('click', function () {
                Array.prototype.forEach.call(qtyButtons, function (other) {
                    other.classList.remove('active');
                    other.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                self.quantity = parseInt(btn.getAttribute('data-qty'), 10) || 10;
            });
        });

        this.els['btn-sound-toggle'].addEventListener('click', function () {
            SoundFX.toggle();
            self.syncSoundButton();
        });

        this.els['btn-start'].addEventListener('click', function () { self.startQuiz(); });
        this.els['btn-history-home'].addEventListener('click', function () {
            self.renderHistory();
            self.showScreen('screen-history');
        });
    },

    bindQuiz: function () {
        const self = this;
        this.els['btn-next-question'].addEventListener('click', function () { self.goNext(); });
        this.els['btn-quit-quiz'].addEventListener('click', function () {
            if (window.confirm('Sair do quiz? O progresso desta partida será perdido.')) {
                self.showScreen('screen-home');
            }
        });
    },

    bindResult: function () {
        const self = this;
        this.els['btn-play-again'].addEventListener('click', function () { self.startQuiz(); });
        this.els['btn-pick-theme'].addEventListener('click', function () { self.showScreen('screen-home'); });
        this.els['btn-share-result'].addEventListener('click', function () { self.share(); });
        this.els['btn-history-result'].addEventListener('click', function () {
            self.renderHistory();
            self.showScreen('screen-history');
        });
    },

    bindHistory: function () {
        const self = this;
        this.els['btn-back-history'].addEventListener('click', function () { self.showScreen('screen-home'); });
        this.els['btn-start-from-history'].addEventListener('click', function () { self.showScreen('screen-home'); });
        this.els['btn-clear-history'].addEventListener('click', function () {
            if (window.confirm('Limpar todo o histórico de resultados?')) {
                History.clear();
                self.renderHistory();
            }
        });
    },

    /* ---------- telas ---------- */
    showScreen: function (id) {
        const screens = document.querySelectorAll('.screen');
        Array.prototype.forEach.call(screens, function (s) { s.classList.remove('active'); });
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
        if (id === 'screen-result' && typeof Ads !== 'undefined' && Ads.isEnabled()) {
            Ads.mount('result');
        }
        window.scrollTo(0, 0);
    },

    syncSoundButton: function () {
        const on = SoundFX.isEnabled();
        this.els['sound-icon'].textContent = on ? '🔊' : '🔇';
        this.els['sound-label'].textContent = on ? 'Som ligado' : 'Som desligado';
        this.els['btn-sound-toggle'].setAttribute('aria-pressed', on ? 'true' : 'false');
    },

    /* ---------- quiz ---------- */
    startQuiz: function () {
        const theme = this.els['select-theme'].value;
        const difficulty = this.els['select-difficulty'].value;

        QuizEngine.init({ theme: theme, difficulty: difficulty, quantity: this.quantity });
        this.showSetupNotice();
        this.renderQuestion();
        this.showScreen('screen-quiz');
    },

    /* Evita que o resultado seja apresentado com um filtro que nao foi usado:
       se a quantidade ou a dificuldade tiveram de ser ajustadas, avisamos. */
    showSetupNotice: function () {
        const notice = this.els['quiz-notice'];
        const messages = [];

        if (QuizEngine.capped) {
            messages.push('Este filtro tem ' + QuizEngine.available + ' pergunta' +
                (QuizEngine.available === 1 ? '' : 's') + ', sua partida foi ajustada para ' +
                QuizEngine.total() + '.');
        }
        if (QuizEngine.relaxed) {
            messages.push('Não havia perguntas com essa dificuldade, então a partida usa questões de dificuldade variada.');
        }

        if (messages.length === 0) {
            notice.classList.add('hidden');
            notice.textContent = '';
            return;
        }
        notice.textContent = messages.join(' ');
        notice.classList.remove('hidden');
    },

    renderQuestion: function () {
        const question = QuizEngine.current();
        const progress = QuizEngine.progress();

        this.els['quiz-counter'].textContent = 'Pergunta ' + progress.current + ' de ' + progress.total;
        this.els['score-live'].textContent = 'Pontos: ' + QuizEngine.points;
        this.els['progress-bar'].style.width = progress.percent + '%';
        this.els['progress-role'].setAttribute('aria-valuenow', String(progress.percent));

        this.els['question-text'].textContent = question ? question.pergunta : 'Nenhuma pergunta disponível.';
        this.els['feedback-section'].classList.add('hidden');
        this.els['btn-next-question'].classList.add('hidden');

        const list = this.els['alternatives-list'];
        list.innerHTML = '';

        if (!question) return;

        const self = this;
        const letters = ['A', 'B', 'C', 'D'];
        question.alternativas.forEach(function (text, index) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'alternative-btn';
            btn.innerHTML = '<span class="alt-letter" aria-hidden="true">' + letters[index] + '</span>' +
                '<span class="alt-text"></span><span class="alt-mark" aria-hidden="true"></span>';
            btn.querySelector('.alt-text').textContent = text;
            btn.addEventListener('click', function () { self.answer(index); });
            list.appendChild(btn);
        });
    },

    answer: function (index) {
        const outcome = QuizEngine.answer(index);
        if (!outcome) return;

        const buttons = this.els['alternatives-list'].querySelectorAll('.alternative-btn');
        Array.prototype.forEach.call(buttons, function (btn, i) {
            btn.disabled = true;
            if (i === outcome.correctIndex) {
                btn.classList.add('correct');
                btn.querySelector('.alt-mark').textContent = '✓ Correta';
            } else if (i === outcome.chosenIndex) {
                btn.classList.add('wrong');
                btn.querySelector('.alt-mark').textContent = '✕ Incorreta';
            } else {
                btn.classList.add('dim');
            }
        });

        const feedback = this.els['feedback-section'];
        feedback.classList.remove('hidden');
        feedback.classList.toggle('is-ok', outcome.isCorrect);
        feedback.classList.toggle('is-bad', !outcome.isCorrect);
        this.els['feedback-icon'].textContent = outcome.isCorrect ? '🎉' : '💡';
        this.els['feedback-message'].textContent = outcome.isCorrect ? 'Acertou!' : 'Não foi dessa vez';
        this.els['explanation-text'].textContent = outcome.explicacao;

        this.els['score-live'].textContent = 'Pontos: ' + QuizEngine.points;
        this.els['btn-next-question'].textContent = QuizEngine.isLastQuestion() ? 'Ver resultado' : 'Próxima pergunta';
        this.els['btn-next-question'].classList.remove('hidden');

        SoundFX.play(outcome.isCorrect ? 'correct' : 'wrong');
    },

    goNext: function () {
        if (QuizEngine.next()) {
            this.renderQuestion();
        } else {
            this.finishQuiz();
        }
    },

    finishQuiz: function () {
        /* Evita salvar o mesmo resultado duas vezes se o botao final for
           acionado de novo antes da troca de tela. */
        const resultScreen = document.getElementById('screen-result');
        if (resultScreen && resultScreen.classList.contains('active')) return;

        const result = QuizEngine.result();
        this.lastResult = result;

        this.els['score-percent'].textContent = result.percentage + '%';
        this.els['result-headline'].textContent = 'Você acertou ' + result.correct + ' de ' + result.total;
        this.els['result-points'].textContent = result.points + ' pontos';
        this.els['result-message'].textContent = result.message;
        this.els['result-correct'].textContent = String(result.correct);
        this.els['result-wrong'].textContent = String(result.wrong);
        this.els['result-theme'].textContent = History.themeLabel(result.config.theme);
        this.els['result-difficulty'].textContent = QuizEngine.relaxed
            ? 'Dificuldade variada'
            : History.difficultyLabel(result.config.difficulty);
        this.els['result-qty'].textContent = String(result.total);

        this.resetShareFeedback();
        History.save(result);
        SoundFX.play('finish');
        this.showScreen('screen-result');
    },

    /* ---------- compartilhamento ---------- */
    share: function () {
        if (!this.lastResult) return;

        const text = this.buildShareText(this.lastResult);
        const url = this.shareUrl();
        this.resetShareFeedback();

        if (navigator.share) {
            const payload = { title: 'Quiz de Conhecimentos', text: text };
            if (url) payload.url = url;
            try {
                navigator.share(payload).catch(function () {
                    /* usuario cancelou ou o sistema recusou: nada a fazer */
                });
            } catch (e) {
                this.copyResult(text, url);
            }
            return;
        }

        /* Sem Web Share (ex.: desktop): copia e oferece o WhatsApp. */
        this.copyResult(text, url);
    },

    /* Mensagem com pontuacao, acertos, total, percentual e tema. */
    buildShareText: function (r) {
        return [
            'Acabei de fazer o Quiz de Conhecimentos! 🧠',
            '',
            'Tema: ' + History.themeLabel(r.config.theme),
            'Acertei ' + r.correct + ' de ' + r.total + ' perguntas e consegui ' + r.percentage + '% de aproveitamento!',
            '',
            'E você, consegue superar minha pontuação?',
            '',
            'Desafie seus conhecimentos!'
        ].join('\n');
    },

    /* Usa o endereco real do app. Em file:// nao existe link publico,
       entao devolvemos string vazia em vez de inventar um endereco. */
    shareUrl: function () {
        if (this.APP_URL) return this.APP_URL;
        const loc = window.location;
        if (loc && (loc.protocol === 'http:' || loc.protocol === 'https:')) {
            return loc.href.split('#')[0];
        }
        return '';
    },

    copyResult: function (text, url) {
        const self = this;
        const done = function () {
            self.showCopyFeedback('Resultado copiado!');
            self.showWhatsApp(text, url);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () {
                self.copyViaTextarea(text, done);
            });
            return;
        }
        this.copyViaTextarea(text, done);
    },

    copyViaTextarea: function (text, onDone) {
        let copied = false;
        try {
            const tmp = document.createElement('textarea');
            tmp.value = text;
            tmp.setAttribute('readonly', 'readonly');
            tmp.style.position = 'fixed';
            tmp.style.top = '-1000px';
            tmp.style.opacity = '0';
            document.body.appendChild(tmp);
            tmp.select();
            copied = document.execCommand('copy');
            document.body.removeChild(tmp);
        } catch (e) {
            copied = false;
        }

        if (copied) {
            onDone();
            return;
        }
        this.showCopyFeedback('Não foi possível copiar automaticamente. Use o botão do WhatsApp abaixo.');
        this.showWhatsApp(text, '');
    },

    showWhatsApp: function (text, url) {
        const link = this.els['whatsapp-share'];
        if (!link) return;
        const full = url ? text + '\n\n' + url : text;
        link.href = 'https://wa.me/?text=' + encodeURIComponent(full);
        link.classList.remove('hidden');
    },

    resetShareFeedback: function () {
        this.els['copy-feedback'].classList.add('hidden');
        this.els['whatsapp-share'].classList.add('hidden');
    },

    showCopyFeedback: function (message) {
        const el = this.els['copy-feedback'];
        el.textContent = message;
        el.classList.remove('hidden');
    },

    /* ---------- historico ---------- */
    renderHistory: function () {
        const items = History.all();
        const empty = this.els['history-empty'];
        const list = this.els['history-list'];
        const actions = this.els['history-actions'];

        list.innerHTML = '';

        if (items.length === 0) {
            empty.classList.remove('hidden');
            list.classList.add('hidden');
            actions.classList.add('hidden');
            return;
        }

        empty.classList.add('hidden');
        list.classList.remove('hidden');
        actions.classList.remove('hidden');

        const self = this;
        items.forEach(function (item) {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML =
                '<div class="history-top"><span class="history-when"></span><span class="history-score"></span></div>' +
                '<div class="history-mid"><span class="history-theme"></span><span class="history-diff"></span><span class="history-qty"></span></div>' +
                '<div class="history-bottom"></div>';
            li.querySelector('.history-when').textContent = item.date + ' — ' + item.time;
            li.querySelector('.history-score').textContent = item.correct + '/' + item.total + ' • ' + item.percentage + '%';
            li.querySelector('.history-theme').textContent = self.themeText(item.theme);
            li.querySelector('.history-diff').textContent = self.diffText(item.difficulty);
            li.querySelector('.history-qty').textContent = item.total + ' perguntas';
            li.querySelector('.history-bottom').textContent = item.points + ' pontos';
            list.appendChild(li);
        });
    },

    themeText: function (theme) {
        return History.themeLabel(theme);
    },

    diffText: function (difficulty) {
        return History.difficultyLabel(difficulty);
    }
};

document.addEventListener('DOMContentLoaded', function () {
    App.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}