/* Gera a pasta www/ usada pelo Capacitor.
 *
 * O site publicado continua sendo a raiz do repositorio (index.html, css/,
 * js/). Esta pasta www/ existe apenas como saida de build do aplicativo e
 * nao deve ser commitada.
 *
 * O que este script faz:
 *  1. valida native/ads-config.json (IDs oficiais de teste enquanto testMode);
 *  2. valida o banco de 500 perguntas sem alterar o arquivo;
 *  3. copia index.html, privacidade.html, css/ e js/ para www/;
 *  4. copia native/native-ads.js e gera native/ads-config.js;
 *  5. injeta os dois scripts apenas nas copias HTML do app;
 *  6. confere por hash que nenhum arquivo copiado foi alterado.
 */

import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = path.join(ROOT, 'www');
const HTML_FILES = ['index.html', 'privacidade.html'];
const COPY_DIRS = ['css', 'js'];
const CONFIG_PATH = path.join(ROOT, 'native', 'ads-config.json');
const ADS_SCRIPT = path.join(ROOT, 'native', 'native-ads.js');

const TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const BANNER_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;

const INJECT_START = '    <!-- native-ads:start (gerado apenas no build do app) -->';
const INJECT_END = '    <!-- native-ads:end -->';
const INJECT_BLOCK = [
    INJECT_START,
    '    <script src="./native/ads-config.js"></script>',
    '    <script src="./native/native-ads.js"></script>',
    INJECT_END
].join('\n');

/* O site usa AdSense (desativado). Dentro do app Android, a publicidade e
   exclusivamente o banner AdMob; por isso o AdSense e removido da copia. */
const ADSENSE_SCRIPT_RE = /^[ \t]*<script src="\.\/js\/ads\.js"><\/script>\r?\n/m;

const THEMES = new Set([
    'gerais', 'historia', 'geografia', 'ciencia', 'tecnologia',
    'cultura', 'esportes', 'brasil', 'curiosidades'
]);
const DIFFICULTIES = new Set(['facil', 'medio', 'dificil']);

function fail(message) {
    console.error('[prepare-web] ERRO: ' + message);
    process.exit(1);
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function readConfig(raw) {
    let config;
    try {
        config = JSON.parse(raw);
    } catch (error) {
        fail('native/ads-config.json nao e um JSON valido: ' + error.message);
    }

    if (typeof config.testMode !== 'boolean') {
        fail('native/ads-config.json: "testMode" deve ser true ou false.');
    }
    if (typeof config.androidAppId !== 'string' || !APP_ID_PATTERN.test(config.androidAppId)) {
        fail('native/ads-config.json: "androidAppId" invalido. Use o formato ca-app-pub-0000000000000000~0000000000.');
    }
    if (typeof config.bannerAdUnitId !== 'string' || !BANNER_ID_PATTERN.test(config.bannerAdUnitId)) {
        fail('native/ads-config.json: "bannerAdUnitId" invalido. Use o formato ca-app-pub-0000000000000000/0000000000.');
    }
    if (config.testMode && (config.androidAppId !== TEST_APP_ID || config.bannerAdUnitId !== TEST_BANNER_ID)) {
        fail('testMode=true exige exatamente os IDs oficiais de teste do Google. Nao use IDs reais em modo de teste.');
    }
    if (!config.testMode && (config.androidAppId === TEST_APP_ID || config.bannerAdUnitId === TEST_BANNER_ID)) {
        console.warn('[prepare-web] AVISO: testMode=false, mas ainda ha IDs de teste configurados.');
    }

    return config;
}

async function validateQuestions() {
    const source = await readFile(path.join(ROOT, 'js', 'questions.js'), 'utf8');
    const sandbox = { module: { exports: {} }, exports: {} };

    try {
        vm.runInNewContext(source, sandbox, { filename: 'js/questions.js' });
    } catch (error) {
        fail('nao foi possivel avaliar js/questions.js: ' + error.message);
    }

    const questions = sandbox.module.exports;
    if (!Array.isArray(questions)) {
        fail('js/questions.js nao exportou uma lista de perguntas.');
    }
    if (questions.length !== 500) {
        fail('js/questions.js deve conter exatamente 500 perguntas; encontrado: ' + questions.length + '.');
    }

    const ids = new Set();
    const themes = {};
    const difficulties = {};

    for (const question of questions) {
        if (!question || typeof question !== 'object') {
            fail('pergunta invalida encontrada em js/questions.js.');
        }
        if (typeof question.id !== 'string' || question.id.trim() === '') {
            fail('pergunta sem id em js/questions.js.');
        }
        if (ids.has(question.id)) {
            fail('id de pergunta duplicado: ' + question.id + '.');
        }
        ids.add(question.id);

        if (!THEMES.has(question.tema)) {
            fail('tema invalido na pergunta ' + question.id + ': ' + question.tema + '.');
        }
        if (!DIFFICULTIES.has(question.dificuldade)) {
            fail('dificuldade invalida na pergunta ' + question.id + ': ' + question.dificuldade + '.');
        }
        if (typeof question.pergunta !== 'string' || question.pergunta.trim() === '') {
            fail('pergunta sem enunciado: ' + question.id + '.');
        }
        if (!Array.isArray(question.alternativas) || question.alternativas.length !== 4) {
            fail('a pergunta ' + question.id + ' deve ter exatamente 4 alternativas.');
        }
        if (!Number.isInteger(question.resposta) || question.resposta < 0 || question.resposta > 3) {
            fail('a pergunta ' + question.id + ' tem resposta fora do intervalo 0-3.');
        }
        if (typeof question.explicacao !== 'string' || question.explicacao.trim() === '') {
            fail('a pergunta ' + question.id + ' nao tem explicacao.');
        }

        themes[question.tema] = (themes[question.tema] || 0) + 1;
        difficulties[question.dificuldade] = (difficulties[question.dificuldade] || 0) + 1;
    }

    console.log(
        '[prepare-web] Perguntas validadas: 500 (' +
        'facil: ' + (difficulties.facil || 0) + ', ' +
        'medio: ' + (difficulties.medio || 0) + ', ' +
        'dificil: ' + (difficulties.dificil || 0) + ').'
    );
    console.log(
        '[prepare-web] Temas: ' +
        Object.keys(themes).sort().map(function (theme) {
            return theme + ': ' + themes[theme];
        }).join(', ') + '.'
    );
}

function renderConfig(config) {
    return [
        '/* Gerado por scripts/prepare-web.mjs a partir de native/ads-config.json. Nao editar. */',
        'window.QUIZ_ADS_CONFIG = Object.freeze({',
        '    testMode: ' + JSON.stringify(config.testMode) + ',',
        '    androidAppId: ' + JSON.stringify(config.androidAppId) + ',',
        '    bannerAdUnitId: ' + JSON.stringify(config.bannerAdUnitId),
        '});',
        ''
    ].join('\n');
}

async function listFiles(directory, base) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(full, base));
        } else {
            files.push(path.relative(base, full));
        }
    }
    return files;
}

async function compareTree(directory) {
    const sourceDir = path.join(ROOT, directory);
    const targetDir = path.join(WEB_DIR, directory);
    const files = await listFiles(sourceDir, sourceDir);

    for (const relative of files) {
        /* ads.js e removido de proposito da copia do app (AdSense nao e usado). */
        if (directory === 'js' && relative === 'ads.js') {
            continue;
        }
        const sourceHash = sha256(await readFile(path.join(sourceDir, relative)));
        const targetHash = sha256(await readFile(path.join(targetDir, relative)));
        if (sourceHash !== targetHash) {
            fail('arquivo copiado difere do original: ' + path.join(directory, relative) + '.');
        }
    }
}

async function main() {
    const config = readConfig(await readFile(CONFIG_PATH, 'utf8'));
    await validateQuestions();

    await rm(WEB_DIR, { recursive: true, force: true });
    await mkdir(WEB_DIR, { recursive: true });

    for (const directory of COPY_DIRS) {
        await cp(path.join(ROOT, directory), path.join(WEB_DIR, directory), { recursive: true });
    }
    for (const file of HTML_FILES) {
        await cp(path.join(ROOT, file), path.join(WEB_DIR, file));
    }

    /* O app usa somente o banner AdMob; o AdSense do site nao e carregado. */
    await rm(path.join(WEB_DIR, 'js', 'ads.js'), { force: true });
    try {
        await access(path.join(WEB_DIR, 'js', 'ads.js'));
        fail('js/ads.js nao deveria existir na copia do app.');
    } catch (error) {
        if (error && error.code !== 'ENOENT') {
            throw error;
        }
    }

    await mkdir(path.join(WEB_DIR, 'native'), { recursive: true });
    await cp(ADS_SCRIPT, path.join(WEB_DIR, 'native', 'native-ads.js'));
    await writeFile(path.join(WEB_DIR, 'native', 'ads-config.js'), renderConfig(config), 'utf8');

    for (const file of HTML_FILES) {
        const target = path.join(WEB_DIR, file);
        const original = await readFile(target, 'utf8');

        if (original.includes(INJECT_START)) {
            fail('o HTML ' + file + ' ja contem o bloco native-ads; o site publicado nao deve ser alterado.');
        }
        if (!original.includes('</body>')) {
            fail('o HTML ' + file + ' nao tem a tag </body>.');
        }

        let appHtml = original;
        if (file === 'index.html') {
            if (!ADSENSE_SCRIPT_RE.test(original)) {
                fail('index.html nao contem a linha esperada do AdSense (js/ads.js).');
            }
            appHtml = original.replace(ADSENSE_SCRIPT_RE, '');
        }

        const injected = appHtml.replace('</body>', INJECT_BLOCK + '\n</body>');
        await writeFile(target, injected, 'utf8');

        const restored = injected.replace(INJECT_BLOCK + '\n', '');
        if (restored !== appHtml) {
            fail('a injecao em ' + file + ' alterou o conteudo da copia do app.');
        }
        if (file === 'index.html') {
            const expected = original.replace(ADSENSE_SCRIPT_RE, '');
            if (appHtml !== expected) {
                fail('a remocao do AdSense em index.html alterou outras linhas.');
            }
        }
    }

    for (const directory of COPY_DIRS) {
        await compareTree(directory);
    }
    if (sha256(await readFile(ADS_SCRIPT)) !== sha256(await readFile(path.join(WEB_DIR, 'native', 'native-ads.js')))) {
        fail('native/native-ads.js copiado difere do original.');
    }

    console.log('[prepare-web] www/ gerado com sucesso.');
    console.log('[prepare-web] HTML original preservado; a copia do app recebeu apenas o bloco native-ads.');
    console.log('[prepare-web] AdSense removido da copia do app; publicidade do app: somente banner AdMob.');
    console.log('[prepare-web] App ID: ' + config.androidAppId);
    console.log('[prepare-web] Banner: ' + config.bannerAdUnitId);
    console.log('[prepare-web] testMode: ' + config.testMode);
}

main().catch(function (error) {
    fail(error && error.stack ? error.stack : String(error));
});
