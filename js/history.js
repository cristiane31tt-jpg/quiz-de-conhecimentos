/* Historico dos ultimos 5 resultados, guardado apenas no dispositivo (localStorage). */

const History = {
    key: 'quiz_history',
    limit: 5,

    themeLabels: {
        aleatorio: 'Aleatório',
        gerais: 'Conhecimentos Gerais',
        historia: 'História',
        geografia: 'Geografia',
        ciencia: 'Ciência',
        tecnologia: 'Tecnologia',
        cultura: 'Cultura',
        esportes: 'Esportes',
        brasil: 'Brasil',
        curiosidades: 'Curiosidades'
    },

    difficultyLabels: {
        aleatoria: 'Aleatória',
        facil: 'Fácil',
        medio: 'Médio',
        dificil: 'Difícil'
    },

    themeLabel: function (theme) {
        return this.themeLabels[theme] || theme || 'Aleatório';
    },

    difficultyLabel: function (difficulty) {
        return this.difficultyLabels[difficulty] || difficulty || 'Aleatória';
    },

    all: function () {
        try {
            const raw = window.localStorage.getItem(this.key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    },

    save: function (result) {
        const now = new Date();
        const entry = {
            id: String(now.getTime()),
            date: now.toLocaleDateString('pt-BR'),
            time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            theme: result.config.theme,
            difficulty: result.config.difficulty,
            total: result.total,
            correct: result.correct,
            wrong: result.wrong,
            percentage: result.percentage,
            points: result.points
        };

        const updated = [entry].concat(this.all()).slice(0, this.limit);
        try {
            window.localStorage.setItem(this.key, JSON.stringify(updated));
        } catch (e) {
            /* sem armazenamento: o quiz segue funcionando */
        }
        return entry;
    },

    clear: function () {
        try {
            window.localStorage.removeItem(this.key);
            return true;
        } catch (e) {
            return false;
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = History;
}