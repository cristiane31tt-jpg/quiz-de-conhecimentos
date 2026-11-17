/* Configura o projeto Android gerado pelo Capacitor.
 *
 * Roda depois de `npx cap add android` e `npx cap sync android`.
 * Nao cria chave de assinatura, nao gera credenciais e nao publica nada.
 *
 * Acoes:
 *  - grava o App ID do AdMob em res/values/strings.xml;
 *  - adiciona o meta-data APPLICATION_ID exigido pelo Google Mobile Ads;
 *  - garante apenas as permissoes INTERNET e ACCESS_NETWORK_STATE;
 *  - ajusta o nome de exibicao para "Quiz de Conhecimentos";
 *  - grava versionCode/versionName de native/app-version.json;
 *  - prepara a assinatura de release por variaveis de ambiente (secrets do CI);
 *  - confere applicationId/namespace e o plugin AdMob.
 *
 * As funcoes patch*Text sao puras para permitir verificacao sem gravar arquivos.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADS_CONFIG_PATH = path.join(ROOT, 'native', 'ads-config.json');
const VERSION_PATH = path.join(ROOT, 'native', 'app-version.json');
const ANDROID_DIR = path.join(ROOT, 'android');
const MANIFEST_PATH = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');
const STRINGS_PATH = path.join(ANDROID_DIR, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const APP_GRADLE_PATH = path.join(ANDROID_DIR, 'app', 'build.gradle');
const PLUGINS_PATH = path.join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'capacitor.plugins.json');

const APP_ID_PATTERN = /^ca-app-pub-\d{16}~\d{10}$/;
const BANNER_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{10}$/;
const APP_NAME = 'Quiz de Conhecimentos';
const ANDROID_APPLICATION_ID = 'com.minimonkey.quizdeconhecimentos';

const SIGNING_CONFIG_BLOCK = [
    '    signingConfigs {',
    '        if (System.getenv("ANDROID_KEYSTORE_PATH")) {',
    '            release {',
    '                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))',
    '                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")',
    '                keyAlias System.getenv("ANDROID_KEY_ALIAS")',
    '                keyPassword System.getenv("ANDROID_KEY_PASSWORD")',
    '            }',
    '        }',
    '    }',
    ''
].join('\n');

const SIGNING_RELEASE_LINES = [
    '            if (signingConfigs.findByName("release") != null) {',
    '                signingConfig signingConfigs.release',
    '            } else if (project.hasProperty("requireReleaseSigning")) {',
    '                throw new GradleException("Assinatura de release ausente: defina ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS e ANDROID_KEY_PASSWORD.")',
    '            }'
].join('\n') + '\n';

function fail(message) {
    console.error('[configure-android] ERRO: ' + message);
    process.exit(1);
}

export function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function setString(xml, name, value) {
    const line = '    <string name="' + name + '">' + escapeXml(value) + '</string>';
    const pattern = new RegExp('^[ \\t]*<string\\s+name="' + name + '">[\\s\\S]*?</string>', 'm');
    if (pattern.test(xml)) {
        return xml.replace(pattern, line);
    }
    if (!xml.includes('</resources>')) {
        throw new Error('strings.xml nao contem </resources>.');
    }
    return xml.replace('</resources>', line + '\n</resources>');
}

export function patchManifestText(manifest, appId) {
    const eol = manifest.includes('\r\n') ? '\r\n' : '\n';

    let output = manifest.replace(
        /\s*<meta-data\s+android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[\s\S]*?\/>/g,
        ''
    );

    const requiredPermissions = [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE'
    ];
    const missingPermissions = requiredPermissions.filter(function (permission) {
        return !output.includes('android:name="' + permission + '"');
    });
    if (missingPermissions.length > 0) {
        const block = missingPermissions.map(function (permission) {
            return '    <uses-permission android:name="' + permission + '" />';
        }).join(eol);
        if (!/(<manifest\b[^>]*>)/.test(output)) {
            throw new Error('AndroidManifest.xml nao contem a tag <manifest>.');
        }
        output = output.replace(/(<manifest\b[^>]*>)/, '$1' + eol + block);
    }

    if (!output.includes('</application>')) {
        throw new Error('AndroidManifest.xml nao contem </application>.');
    }

    /* Mantem o historico local fora de backups automaticos do Android. */
    if (!output.includes('android:allowBackup="false"')) {
        output = output.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
        if (!output.includes('android:allowBackup="false"')) {
            output = output.replace(/(<application\b[^>]*?)(\s*>)/, '$1 android:allowBackup="false"$2');
        }
    }
    if (!output.includes('android:allowBackup="false"')) {
        throw new Error('nao foi possivel desativar o backup automatico no AndroidManifest.xml.');
    }

    const metaData = '        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />';
    output = output.replace(/([ \t]*)<\/application>/, function (match, indent) {
        return metaData + eol + indent + '</application>';
    });

    if (!output.includes('@string/admob_app_id')) {
        throw new Error('nao foi possivel adicionar o meta-data do AdMob ao AndroidManifest.xml.');
    }
    if (!output.includes('android.permission.INTERNET') || !output.includes('android.permission.ACCESS_NETWORK_STATE')) {
        throw new Error('nao foi possivel garantir as permissoes de rede no AndroidManifest.xml.');
    }

    return output;
}

export function patchStringsText(strings, appId) {
    let output = strings;
    output = setString(output, 'app_name', APP_NAME);
    output = setString(output, 'title_activity_main', APP_NAME);
    output = setString(output, 'admob_app_id', appId);
    return output;
}

export function patchAppGradleText(gradle, version) {
    if (!/versionCode\s+\d+/.test(gradle)) {
        throw new Error('build.gradle nao contem versionCode.');
    }
    let output = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + version.versionCode);

    if (!/versionName\s+"[^"]*"/.test(output)) {
        throw new Error('build.gradle nao contem versionName.');
    }
    output = output.replace(/versionName\s+"[^"]*"/, 'versionName "' + version.versionName + '"');

    if (!output.includes('signingConfig signingConfigs.release')) {
        const buildTypesIndex = output.indexOf('buildTypes {');
        if (buildTypesIndex < 0) {
            throw new Error('build.gradle nao contem o bloco buildTypes.');
        }
        const releaseIndex = output.indexOf('release {', buildTypesIndex);
        if (releaseIndex < 0) {
            throw new Error('build.gradle nao contem o bloco buildTypes.release.');
        }
        const releaseLineEnd = output.indexOf('\n', releaseIndex);
        if (releaseLineEnd < 0) {
            throw new Error('build.gradle com buildTypes.release incompleto.');
        }
        output = output.slice(0, releaseLineEnd + 1) + SIGNING_RELEASE_LINES + output.slice(releaseLineEnd + 1);

        if (!output.includes('signingConfigs {')) {
            const insertAt = output.lastIndexOf('\n', output.indexOf('buildTypes {')) + 1;
            output = output.slice(0, insertAt) + SIGNING_CONFIG_BLOCK + '\n' + output.slice(insertAt);
        }
    }

    if (!output.includes('signingConfig signingConfigs.release')) {
        throw new Error('nao foi possivel configurar a assinatura de release em build.gradle.');
    }
    return output;
}

export function assertApplicationId(gradle, appId) {
    const namespace = /namespace\s*=?\s*"([^"]+)"/.exec(gradle);
    const applicationId = /applicationId\s*=?\s*"([^"]+)"/.exec(gradle);

    if (!namespace || namespace[1] !== appId) {
        throw new Error(
            'namespace do Android (' + (namespace ? namespace[1] : 'ausente') + ') difere de ' + appId + '.'
        );
    }
    if (!applicationId || applicationId[1] !== appId) {
        throw new Error(
            'applicationId do Android (' + (applicationId ? applicationId[1] : 'ausente') + ') difere de ' + appId + '.'
        );
    }
}

export function parseVersion(raw) {
    let version;
    try {
        version = JSON.parse(raw);
    } catch (error) {
        throw new Error('nao foi possivel ler native/app-version.json: ' + error.message);
    }
    if (!Number.isInteger(version.versionCode) || version.versionCode < 1) {
        throw new Error('versionCode deve ser um inteiro maior ou igual a 1 em native/app-version.json.');
    }
    if (typeof version.versionName !== 'string' || !/^\d+(\.\d+){1,3}(-[0-9A-Za-z.-]+)?$/.test(version.versionName)) {
        throw new Error('versionName invalido em native/app-version.json (use algo como 1.0.0).');
    }
    return version;
}

export function parseAdsConfig(raw) {
    let config;
    try {
        config = JSON.parse(raw);
    } catch (error) {
        throw new Error('nao foi possivel ler native/ads-config.json: ' + error.message);
    }
    if (!APP_ID_PATTERN.test(config.androidAppId || '')) {
        throw new Error('androidAppId invalido em native/ads-config.json.');
    }
    if (!BANNER_ID_PATTERN.test(config.bannerAdUnitId || '')) {
        throw new Error('bannerAdUnitId invalido em native/ads-config.json.');
    }
    return config;
}

async function readRequired(filePath, hint) {
    try {
        return await readFile(filePath, 'utf8');
    } catch (error) {
        throw new Error(hint);
    }
}

async function checkPlugin() {
    try {
        const plugins = await readFile(PLUGINS_PATH, 'utf8');
        if (!plugins.includes('AdMob') && !plugins.includes('@capacitor-community/admob')) {
            console.warn('[configure-android] AVISO: o plugin AdMob nao apareceu em capacitor.plugins.json. Rode `npx cap sync android`.');
        }
    } catch (error) {
        console.warn('[configure-android] AVISO: capacitor.plugins.json nao encontrado. Rode `npx cap sync android`.');
    }
}

function signingStatus() {
    const required = [
        'ANDROID_KEYSTORE_PATH',
        'ANDROID_KEYSTORE_PASSWORD',
        'ANDROID_KEY_ALIAS',
        'ANDROID_KEY_PASSWORD'
    ];
    const missing = required.filter(function (name) {
        return !process.env[name];
    });
    return missing.length === 0 ? 'completa' : 'ausente (faltam ' + missing.join(', ') + ')';
}

async function main() {
    const adsConfig = parseAdsConfig(await readRequired(
        ADS_CONFIG_PATH,
        'nao foi possivel ler native/ads-config.json.'
    ));
    const version = parseVersion(await readRequired(
        VERSION_PATH,
        'nao foi possivel ler native/app-version.json.'
    ));

    const manifest = await readRequired(
        MANIFEST_PATH,
        'AndroidManifest.xml nao encontrado. Rode `npx cap add android` antes.'
    );
    const strings = await readRequired(
        STRINGS_PATH,
        'strings.xml nao encontrado. Rode `npx cap add android` antes.'
    );
    const gradle = await readRequired(
        APP_GRADLE_PATH,
        'app/build.gradle nao encontrado. Rode `npx cap add android` antes.'
    );

    assertApplicationId(gradle, ANDROID_APPLICATION_ID);

    const patchedManifest = patchManifestText(manifest, adsConfig.androidAppId);
    const patchedStrings = patchStringsText(strings, adsConfig.androidAppId);
    const patchedGradle = patchAppGradleText(gradle, version);

    await writeFile(MANIFEST_PATH, patchedManifest, 'utf8');
    await writeFile(STRINGS_PATH, patchedStrings, 'utf8');
    await writeFile(APP_GRADLE_PATH, patchedGradle, 'utf8');

    await checkPlugin();

    console.log('[configure-android] applicationId: ' + ANDROID_APPLICATION_ID);
    console.log('[configure-android] App ID do AdMob: ' + adsConfig.androidAppId);
    console.log('[configure-android] Banner: ' + adsConfig.bannerAdUnitId);
    console.log('[configure-android] Nome de exibicao: ' + APP_NAME);
    console.log('[configure-android] Versao: ' + version.versionName + ' (versionCode ' + version.versionCode + ')');
    console.log('[configure-android] Permissoes: INTERNET e ACCESS_NETWORK_STATE.');
    console.log('[configure-android] Assinatura de release: ' + signingStatus() + '.');
    console.log('[configure-android] AndroidManifest.xml, strings.xml e app/build.gradle configurados.');
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
    main().catch(function (error) {
        fail(error && error.message ? error.message : String(error));
    });
}
