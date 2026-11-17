/* Confere o projeto Android gerado no CI antes de compilar.
 *
 * Uso: node scripts/verify-android.mjs
 *
 * Verifica o que o build precisa ter: identificador, nome, versao, permissoes,
 * App ID de teste do AdMob, ausencia do AdSense no app e as 500 perguntas na
 * copia empacotada. Nao altera nenhum arquivo.
 */

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ID = 'com.minimonkey.quizdeconhecimentos';
const APP_NAME = 'Quiz de Conhecimentos';

const paths = {
    adsConfig: path.join(ROOT, 'native', 'ads-config.json'),
    version: path.join(ROOT, 'native', 'app-version.json'),
    gradle: path.join(ROOT, 'android', 'app', 'build.gradle'),
    manifest: path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    strings: path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
    plugins: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json'),
    bundledIndex: path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public', 'index.html'),
    webConfig: path.join(ROOT, 'www', 'native', 'ads-config.js'),
    webQuestions: path.join(ROOT, 'www', 'js', 'questions.js'),
    webAds: path.join(ROOT, 'www', 'js', 'ads.js')
};

const failures = [];

function check(name, condition, detail) {
    if (condition) {
        console.log('[verify-android] OK   ' + name);
    } else {
        failures.push(name + (detail ? ' -> ' + detail : ''));
        console.log('[verify-android] FALHA ' + name + (detail ? ' -> ' + detail : ''));
    }
}

async function readJson(filePath, label) {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
        failures.push('nao foi possivel ler ' + label + ': ' + error.message);
        return null;
    }
}

async function exists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch (error) {
        return false;
    }
}

const adsConfig = await readJson(paths.adsConfig, 'native/ads-config.json');
const version = await readJson(paths.version, 'native/app-version.json');

if (adsConfig) {
    check('testMode ativo (anuncios de teste)', adsConfig.testMode === true, String(adsConfig.testMode));
    check('App ID oficial de teste', adsConfig.androidAppId === 'ca-app-pub-3940256099942544~3347511713', adsConfig.androidAppId);
    check('banner oficial de teste', adsConfig.bannerAdUnitId === 'ca-app-pub-3940256099942544/6300978111', adsConfig.bannerAdUnitId);
}

if (version) {
    check('versionCode inteiro >= 1', Number.isInteger(version.versionCode) && version.versionCode >= 1, String(version.versionCode));
    check('versionName preenchido', typeof version.versionName === 'string' && version.versionName.length > 0, String(version.versionName));
}

let gradle = '';
try {
    gradle = await readFile(paths.gradle, 'utf8');
    check('applicationId correto', gradle.includes('applicationId "' + APP_ID + '"'), APP_ID);
    check('namespace correto', new RegExp('namespace\\s*=?\\s*"' + APP_ID.replace(/\./g, '\\.') + '"').test(gradle), APP_ID);
    check('signingConfigs de release preparada', gradle.includes('signingConfigs {') && gradle.includes('signingConfig signingConfigs.release'));
    if (version) {
        check('versionCode aplicado no Gradle', gradle.includes('versionCode ' + version.versionCode));
        check('versionName aplicado no Gradle', gradle.includes('versionName "' + version.versionName + '"'));
    }
} catch (error) {
    failures.push('nao foi possivel ler android/app/build.gradle: ' + error.message);
}

try {
    const manifest = await readFile(paths.manifest, 'utf8');
    check('meta-data APPLICATION_ID do AdMob', manifest.includes('com.google.android.gms.ads.APPLICATION_ID') && manifest.includes('@string/admob_app_id'));
    check('allowBackup desativado', manifest.includes('android:allowBackup="false"'));
    check('permissao INTERNET', manifest.includes('android.permission.INTERNET'));
    check('permissao ACCESS_NETWORK_STATE', manifest.includes('android.permission.ACCESS_NETWORK_STATE'));
} catch (error) {
    failures.push('nao foi possivel ler AndroidManifest.xml: ' + error.message);
}

try {
    const strings = await readFile(paths.strings, 'utf8');
    check('nome de exibicao', strings.includes('name="app_name">' + APP_NAME + '</string>'));
    if (adsConfig) {
        check('App ID gravado em strings.xml', strings.includes('name="admob_app_id">' + adsConfig.androidAppId + '</string>'));
    }
} catch (error) {
    failures.push('nao foi possivel ler strings.xml: ' + error.message);
}

try {
    const plugins = await readFile(paths.plugins, 'utf8');
    check('plugin AdMob registrado', plugins.includes('@capacitor-community/admob'));
} catch (error) {
    failures.push('nao foi possivel ler capacitor.plugins.json: ' + error.message);
}

check('www/js/ads.js ausente no app', !(await exists(paths.webAds)));

try {
    const webConfig = await readFile(paths.webConfig, 'utf8');
    if (adsConfig) {
        check('config de anuncios gerada no www', webConfig.includes(adsConfig.bannerAdUnitId) && webConfig.includes('testMode: true'));
    }
} catch (error) {
    failures.push('nao foi possivel ler www/native/ads-config.js: ' + error.message);
}

try {
    const questions = await readFile(paths.webQuestions, 'utf8');
    const total = (questions.match(/\bid:\s*'/g) || []).length;
    check('500 perguntas na copia do app', total === 500, String(total));
} catch (error) {
    failures.push('nao foi possivel ler www/js/questions.js: ' + error.message);
}

try {
    const bundledIndex = await readFile(paths.bundledIndex, 'utf8');
    check('scripts nativos no HTML empacotado', bundledIndex.includes('./native/native-ads.js') && bundledIndex.includes('./native/ads-config.js'));
    check('AdSense ausente do HTML empacotado', !bundledIndex.includes('<script src="./js/ads.js"></script>'));
} catch (error) {
    failures.push('nao foi possivel ler android/app/src/main/assets/public/index.html: ' + error.message);
}

if (failures.length > 0) {
    console.error('\n[verify-android] ' + failures.length + ' verificacao(oes) falharam:');
    for (const failure of failures) {
        console.error('  - ' + failure);
    }
    process.exit(1);
}

console.log('\n[verify-android] Projeto Android consistente.');
