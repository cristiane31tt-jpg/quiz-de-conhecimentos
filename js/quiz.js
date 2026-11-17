/* Logica do quiz: sorteio das perguntas, baralho persistente, estado da partida e resultado. */

const VALID_THEMES = ['gerais', 'historia', 'geografia', 'ciencia', 'tecnologia', 'cultura', 'esportes', 'brasil', 'curiosidades'];
const VALID_DIFFICULTIES = ['facil', 'medio', 'dificil'];

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
    const correctIndex = alternativas.indexOf(correctText);
    if (correctIndex === -1) {
        throw new Error('Pergunta ' + raw.id + ': alternativa correta nao encontrada apos embaralhar.');
    }
    return {
        id: raw.id,
        tema: raw.tema,
        dificuldade: raw.dificuldade,
        pergunta: raw.pergunta,
        alternativas: alternativas,
        correctIndex: correctIndex,
        explicacao: raw.explicacao,
        grupo: raw.grupo || null
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

/* ---------- validacao do banco ---------- */
function validateQuestionBank(bank) {
    const errors = [];
    const ids = new Set();
    const groups = {};

    bank.forEach(function (q, index) {
        const where = (q && typeof q.id === 'string' && q.id) ? q.id : '#' + index;

        if (!q || typeof q !== 'object') {
            errors.push(where + ': item invalido');
            return;
        }
        if (typeof q.id !== 'string' || !q.id.trim()) {
            errors.push(where + ': id invalido');
        } else if (ids.has(q.id)) {
            errors.push(where + ': id duplicado');
        } else {
            ids.add(q.id);
        }
        if (VALID_THEMES.indexOf(q.tema) === -1) {
            errors.push(where + ': tema invalido (' + q.tema + ')');
        }
        if (VALID_DIFFICULTIES.indexOf(q.dificuldade) === -1) {
            errors.push(where + ': dificuldade invalida (' + q.dificuldade + ')');
        }
        if (typeof q.pergunta !== 'string' || !q.pergunta.trim()) {
            errors.push(where + ': pergunta vazia');
        }
        if (!Array.isArray(q.alternativas) || q.alternativas.length !== 4) {
            errors.push(where + ': precisa de exatamente 4 alternativas');
        } else {
            const seen = new Set();
            q.alternativas.forEach(function (alt, i) {
                if (typeof alt !== 'string' || !alt.trim()) {
                    errors.push(where + ': alternativa ' + i + ' vazia');
                } else if (seen.has(alt)) {
                    errors.push(where + ': alternativa repetida (' + alt + ')');
                } else {
                    seen.add(alt);
                }
            });
        }
        if (typeof q.resposta !== 'number' || q.resposta % 1 !== 0 || q.resposta < 0 || q.resposta > 3) {
            errors.push(where + ': resposta invalida (' + q.resposta + ')');
        }
        if (typeof q.explicacao !== 'string' || !q.explicacao.trim()) {
            errors.push(where + ': explicacao vazia');
        }
        if (q.grupo !== undefined) {
            if (typeof q.grupo !== 'string' || !q.grupo.trim()) {
                errors.push(where + ': grupo invalido');
            } else {
                if (!groups[q.grupo]) groups[q.grupo] = [];
                groups[q.grupo].push(q.id);
            }
        }
    });

    Object.keys(groups).forEach(function (group) {
        if (groups[group].length < 2) {
            errors.push('grupo ' + group + ': precisa de pelo menos 2 perguntas');
        }
    });

    return { valid: errors.length === 0, errors: errors, groups: groups };
}

/* ---------- baralho persistente por tema|dificuldade ---------- */
const QuizDeck = {
    key: 'quiz_deck_v1',
    memoryState: null,

    defaultState: function () {
        return { version: 1, decks: {} };
    },

    getStorage: function () {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage;
            }
        } catch (e) {
            return null;
        }
        return null;
    },

    load: function () {
        if (this.memoryState !== null) return this.memoryState;

        const storage = this.getStorage();
        if (!storage) {
            this.memoryState = this.defaultState();
            return this.memoryState;
        }

        try {
            const raw = storage.getItem(this.key);
            if (!raw) return this.defaultState();
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 ||
                !parsed.decks || typeof parsed.decks !== 'object' || Array.isArray(parsed.decks)) {
                return this.defaultState();
            }
            return parsed;
        } catch (e) {
            return this.defaultState();
        }
    },

    save: function (state) {
        const storage = this.getStorage();
        if (!storage) {
            this.memoryState = state;
            return false;
        }
        try {
            storage.setItem(this.key, JSON.stringify(state));
            this.memoryState = null;
            return true;
        } catch (e) {
            this.memoryState = state;
            return false;
        }
    },

    clear: function () {
        this.memoryState = this.defaultState();
        const storage = this.getStorage();
        if (storage) {
            try {
                storage.removeItem(this.key);
            } catch (e) {
                /* sem armazenamento: o estado em memoria ja foi limpo */
            }
        }
    },

    resetMemory: function () {
        this.memoryState = null;
    },

    getDeck: function (filterKey, poolIds) {
        const state = this.load();
        if (!state.decks[filterKey] || typeof state.decks[filterKey] !== 'object') {
            state.decks[filterKey] = { cycle: [], remaining: [], lastDrawn: null };
        }

        const deck = state.decks[filterKey];
        if (!Array.isArray(deck.cycle)) deck.cycle = [];
        if (!Array.isArray(deck.remaining)) deck.remaining = [];
        if (typeof deck.lastDrawn !== 'string') deck.lastDrawn = null;

        const poolSet = new Set(poolIds);

        if (deck.cycle.length === 0) {
            deck.cycle = poolIds.slice();
            deck.remaining = shuffle(poolIds);
            deck.lastDrawn = null;
            return { state: state, deck: deck };
        }

        deck.cycle = uniqueStrings(deck.cycle).filter(function (id) {
            return poolSet.has(id);
        });
        deck.remaining = uniqueStrings(deck.remaining).filter(function (id) {
            return poolSet.has(id) && deck.cycle.indexOf(id) !== -1;
        });

        const cycleSet = new Set(deck.cycle);
        const newIds = poolIds.filter(function (id) {
            return !cycleSet.has(id);
        });
        if (newIds.length > 0) {
            deck.cycle = deck.cycle.concat(newIds);
            newIds.forEach(function (id) {
                const pos = Math.floor(Math.random() * (deck.remaining.length + 1));
                deck.remaining.splice(pos, 0, id);
            });
        }

        if (deck.lastDrawn && !poolSet.has(deck.lastDrawn)) {
            deck.lastDrawn = null;
        }

        return { state: state, deck: deck };
    }
};

function uniqueStrings(list) {
    const seen = new Set();
    const result = [];
    list.forEach(function (item) {
        if (typeof item === 'string' && !seen.has(item)) {
            seen.add(item);
            result.push(item);
        }
    });
    return result;
}

function startNewCycle(deck, poolIds) {
    deck.cycle = poolIds.slice();
    deck.remaining = shuffle(poolIds);
}

function getSelectionMode(config) {
    const randomTheme = !config.theme || config.theme === 'aleatorio';
    const randomDifficulty = !config.difficulty || config.difficulty === 'aleatoria';
    if (randomTheme && randomDifficulty) return 1;
    if (!randomTheme && randomDifficulty) return 2;
    if (randomTheme && !randomDifficulty) return 3;
    return 4;
}

function stratumKey(question, mode) {
    if (mode === 1) return question.tema + '|' + question.dificuldade;
    if (mode === 2) return question.dificuldade;
    if (mode === 3) return question.tema;
    return 'all';
}

/* Sorteio estratificado: em cada rodada, retira uma pergunta de cada estrato
   disponivel, em ordem embaralhada. Isso evita que um tema ou dificuldade
   domine a partida sem sacrificar a variedade quando ha poucas perguntas. */
function selectStratified(candidates, needed, usedGroups, allowGroupReuse, mode) {
    const strataMap = new Map();
    candidates.forEach(function (q) {
        const key = stratumKey(q, mode);
        if (!strataMap.has(key)) strataMap.set(key, []);
        strataMap.get(key).push(q);
    });

    const strata = [];
    strataMap.forEach(function (list, key) {
        strata.push({ key: key, list: shuffle(list) });
    });

    const selected = [];
    let blockedByGroup = 0;
    let active = strata.filter(function (s) { return s.list.length > 0; });

    while (selected.length < needed && active.length > 0) {
        active = shuffle(active);
        let progressed = false;

        for (let i = 0; i < active.length && selected.length < needed; i++) {
            const stratum = active[i];
            let chosen = null;

            while (stratum.list.length > 0) {
                const candidate = stratum.list.shift();
                if (!allowGroupReuse && candidate.grupo && usedGroups.has(candidate.grupo)) {
                    blockedByGroup += 1;
                    continue;
                }
                chosen = candidate;
                break;
            }

            if (chosen) {
                selected.push(chosen);
                if (chosen.grupo) usedGroups.add(chosen.grupo);
                progressed = true;
            }
        }

        active = active.filter(function (s) { return s.list.length > 0; });
        if (!progressed) break;
    }

    return { selected: selected, blockedByGroup: blockedByGroup };
}

function drawQuestions(filterKey, pool, count, config) {
    const poolIds = pool.map(function (q) { return q.id; });
    const byId = new Map();
    pool.forEach(function (q) { byId.set(q.id, q); });

    const loaded = QuizDeck.getDeck(filterKey, poolIds);
    const state = loaded.state;
    const deck = loaded.deck;
    const mode = getSelectionMode(config);
    const selected = [];
    const selectedIds = new Set();
    const usedGroups = new Set();
    let allowGroupReuse = false;
    let recycleCount = 0;
    let heldBackId = null;
    const maxRecycles = 20;

    while (selected.length < count) {
        deck.remaining = deck.remaining.filter(function (id) {
            return byId.has(id) && !selectedIds.has(id);
        });

        if (deck.remaining.length === 0) {
            if (selectedIds.size >= poolIds.length || recycleCount >= maxRecycles) break;

            startNewCycle(deck, poolIds);
            recycleCount += 1;
            deck.remaining = deck.remaining.filter(function (id) {
                return !selectedIds.has(id);
            });

            /* Protecao: a primeira pergunta do novo ciclo nao deve ser a ultima
               pergunta do ciclo anterior. Ela volta ao baralho apos a primeira escolha. */
            if (selected.length === 0 && deck.lastDrawn && deck.remaining.length > 1) {
                heldBackId = deck.lastDrawn;
                deck.remaining = deck.remaining.filter(function (id) {
                    return id !== heldBackId;
                });
            }
            continue;
        }

        const candidates = deck.remaining.map(function (id) {
            return byId.get(id);
        }).filter(Boolean);

        const result = selectStratified(candidates, count - selected.length, usedGroups, allowGroupReuse, mode);

        if (result.selected.length > 0) {
            result.selected.forEach(function (q) {
                selected.push(q);
                selectedIds.add(q.id);
                if (q.grupo) usedGroups.add(q.grupo);
                deck.lastDrawn = q.id;
            });

            deck.remaining = deck.remaining.filter(function (id) {
                return !selectedIds.has(id);
            });

            if (heldBackId) {
                if (byId.has(heldBackId) && !selectedIds.has(heldBackId) &&
                    deck.remaining.indexOf(heldBackId) === -1) {
                    deck.remaining.push(heldBackId);
                }
                heldBackId = null;
            }
            continue;
        }

        const remainingSet = new Set(deck.remaining);
        const hasUnseen = poolIds.some(function (id) {
            return !selectedIds.has(id) && !remainingSet.has(id);
        });

        if (hasUnseen && recycleCount < maxRecycles) {
            startNewCycle(deck, poolIds);
            recycleCount += 1;
            deck.remaining = deck.remaining.filter(function (id) {
                return !selectedIds.has(id);
            });
            continue;
        }

        if (!allowGroupReuse && result.blockedByGroup > 0) {
            allowGroupReuse = true;
            continue;
        }

        break;
    }

    if (heldBackId && byId.has(heldBackId) && !selectedIds.has(heldBackId) &&
        deck.remaining.indexOf(heldBackId) === -1) {
        deck.remaining.push(heldBackId);
    }

    QuizDeck.save(state);
    return selected;
}

function selectQuestions(config) {
    const wanted = Math.max(1, parseInt(config.quantity, 10) || 10);
    const poolInfo = buildPool(config);
    const pool = poolInfo.questions;
    const available = pool.length;
    const total = Math.min(wanted, available);

    if (total === 0) {
        return {
            questions: [],
            requested: wanted,
            available: 0,
            capped: true,
            relaxed: poolInfo.relaxed
        };
    }

    const effectiveTheme = (config.theme && config.theme !== 'aleatorio' &&
        VALID_THEMES.indexOf(config.theme) !== -1) ? config.theme : 'aleatorio';
    const effectiveDifficulty = (!poolInfo.relaxed && config.difficulty &&
        config.difficulty !== 'aleatoria' &&
        VALID_DIFFICULTIES.indexOf(config.difficulty) !== -1) ? config.difficulty : 'aleatoria';
    const filterKey = effectiveTheme + '|' + effectiveDifficulty;

    const rawQuestions = drawQuestions(filterKey, pool, total, {
        theme: effectiveTheme,
        difficulty: effectiveDifficulty
    });

    return {
        questions: rawQuestions.map(prepareQuestion),
        requested: wanted,
        available: available,
        capped: total < wanted,
        relaxed: poolInfo.relaxed
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
        QuizDeck: QuizDeck,
        selectQuestions: selectQuestions,
        buildPool: buildPool,
        shuffle: shuffle,
        prepareQuestion: prepareQuestion,
        validateQuestionBank: validateQuestionBank,
        getSelectionMode: getSelectionMode,
        messageFor: messageFor
    };
}
