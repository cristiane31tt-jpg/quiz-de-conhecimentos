/* Logica do quiz: sorteio das perguntas, estado da partida e calculo do resultado. */

function shuffle(items) {
    const list = items.slice();
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = list[i];
        list[i] = list[j];
        list[j] = tmp;
    }
    return list;
}

function filterByTheme(theme) {
    if (!theme || theme === 'aleatorio') return QUESTIONS.slice();
    return QUESTIONS.filter(function (q) { return q.tema === theme; });
}

function filterByDifficulty(list, difficulty) {
    if (!difficulty || difficulty === 'aleatoria') return list.slice();
    return list.filter(function (q) { return q.dificuldade === difficulty; });
}

function prepareQuestion(raw) {
    const correctText = raw.alternativas[raw.resposta];
    const alternativas = shuffle(raw.alternativas);
    return {
        id: raw.id,
        tema: raw.tema,
        dificuldade: raw.dificuldade,
        pergunta: raw.pergunta,
        alternativas: alternativas,
        correctIndex: alternativas.indexOf(correctText),
        explicacao: raw.explicacao
    };
}

/* Monta o conjunto de perguntas da partida.
   Regra: nunca mistura dificuldade nem tema em silencio. Se o filtro estrito
   tiver menos perguntas do que o usuario pediu, a partida usa todas as
   disponiveis e a interface avisa que a quantidade foi ajustada.
   A dificuldade so e relaxada quando o filtro nao retorna nenhuma pergunta. */
function buildPool(config) {
    const byTheme = filterByTheme(config.theme);
    const strict = filterByDifficulty(byTheme, config.difficulty);
    return {
        questions: strict.length > 0 ? strict : byTheme,
        relaxed: strict.length === 0,
        available: strict.length > 0 ? strict.length : byTheme.length
    };
}

function selectQuestions(config) {
    const wanted = Math.max(1, parseInt(config.quantity, 10) || 10);
    const pool = buildPool(config);
    const total = Math.min(wanted, pool.questions.length);
    return {
        questions: shuffle(pool.questions).slice(0, total).map(prepareQuestion),
        requested: wanted,
        available: pool.available,
        capped: total < wanted,
        relaxed: pool.relaxed
    };
}

const QuizEngine = {
    questions: [],
    index: 0,
    correct: 0,
    wrong: 0,
    points: 0,
    config: { theme: 'aleatorio', difficulty: 'aleatoria', quantity: 10 },
    answered: false,
    requested: 10,
    available: 0,
    capped: false,
    relaxed: false,

    init: function (config) {
        this.config = {
            theme: (config && config.theme) || 'aleatorio',
            difficulty: (config && config.difficulty) || 'aleatoria',
            quantity: (config && config.quantity) || 10
        };
        var selection = selectQuestions(this.config);
        this.questions = selection.questions;
        this.requested = selection.requested;
        this.available = selection.available;
        this.capped = selection.capped;
        this.relaxed = selection.relaxed;
        this.index = 0;
        this.correct = 0;
        this.wrong = 0;
        this.points = 0;
        this.answered = false;
        return this.questions;
    },

    current: function () {
        return this.questions[this.index] || null;
    },

    total: function () {
        return this.questions.length;
    },

    isLastQuestion: function () {
        return this.index >= this.total() - 1;
    },

    progress: function () {
        const total = this.total();
        return {
            current: Math.min(this.index + 1, total),
            total: total,
            percent: total > 0 ? Math.round((this.index / total) * 100) : 0
        };
    },

    answer: function (chosenIndex) {
        if (this.answered) return null;
        const question = this.current();
        if (!question) return null;

        this.answered = true;
        const isCorrect = chosenIndex === question.correctIndex;
        if (isCorrect) {
            this.correct += 1;
            this.points += 10;
        } else {
            this.wrong += 1;
        }

        return {
            isCorrect: isCorrect,
            correctIndex: question.correctIndex,
            chosenIndex: chosenIndex,
            explicacao: question.explicacao
        };
    },

    next: function () {
        if (!this.answered) return false;
        this.index += 1;
        this.answered = false;
        return this.index < this.total();
    },

    result: function () {
        const total = this.total();
        const percentage = total > 0 ? Math.round((this.correct / total) * 100) : 0;
        return {
            correct: this.correct,
            wrong: this.wrong,
            total: total,
            percentage: percentage,
            points: this.points,
            config: this.config,
            message: messageFor(percentage)
        };
    }
};

function messageFor(percentage) {
    if (percentage >= 90) return 'Excelente! Você mandou muito bem!';
    if (percentage >= 70) return 'Muito bom! Seu conhecimento está afiado.';
    if (percentage >= 50) return 'Bom resultado! Mais uma rodada pode melhorar ainda mais.';
    return 'Vale tentar novamente. Cada rodada é uma oportunidade de aprender.';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QuizEngine: QuizEngine,
        selectQuestions: selectQuestions,
        buildPool: buildPool,
        shuffle: shuffle,
        messageFor: messageFor
    };
}