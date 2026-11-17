/* Banner de teste do Google AdMob para o app Android (Capacitor).
 *
 * IMPORTANTE: este arquivo nao faz parte do site publicado. Ele e copiado
 * apenas para www/ pelo script scripts/prepare-web.mjs e injetado nas copias
 * de index.html e privacidade.html usadas dentro do APK.
 *
 * Regras desta integracao:
 *  - um unico banner inferior, 320x50, sem intersticiais ou premiados;
 *  - IDs oficiais de teste do Google enquanto testMode estiver ativo;
 *  - consentimento UMP antes de inicializar o SDK;
 *  - sem banner quando o consentimento nao permitir anuncios;
 *  - sem banner quando nao houver internet;
 *  - espaco reservado no layout para o banner nao cobrir conteudo.
 */

(function () {
    'use strict';

    var LOG = '[native-ads]';
    var HEIGHT_KEY = 'quiz_native_ad_height';
    var TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
    var TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';

    var Capacitor = window.Capacitor;
    if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
        return;
    }

    var config = window.QUIZ_ADS_CONFIG || null;
    if (!config || !config.bannerAdUnitId || !config.androidAppId) {
        console.warn(LOG + ' configuracao ausente; banner desativado.');
        return;
    }

    if (config.testMode && (config.androidAppId !== TEST_APP_ID || config.bannerAdUnitId !== TEST_BANNER_ID)) {
        console.error(LOG + ' testMode ativo, mas os IDs nao sao os oficiais de teste; banner desativado.');
        return;
    }

    if (!config.testMode) {
        console.warn(LOG + ' anuncios reais habilitados; revise UMP, politica de privacidade e Data Safety.');
    }

    function getPlugin() {
        if (Capacitor.Plugins && Capacitor.Plugins.AdMob) {
            return Capacitor.Plugins.AdMob;
        }
        if (typeof Capacitor.registerPlugin === 'function') {
            try {
                return Capacitor.registerPlugin('AdMob');
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    var plugin = getPlugin();
    if (!plugin) {
        console.warn(LOG + ' plugin AdMob indisponivel; banner desativado.');
        return;
    }

    var style = document.createElement('style');
    style.textContent =
        ':root{--native-ad-inset:0px;}' +
        'body{' +
        'padding-top:var(--safe-area-inset-top,0px);' +
        'padding-right:var(--safe-area-inset-right,0px);' +
        'padding-bottom:calc(var(--native-ad-inset,0px) + var(--safe-area-inset-bottom,0px));' +
        'padding-left:var(--safe-area-inset-left,0px);' +
        '}' +
        '#app,.screen.active{min-height:calc(100vh - var(--safe-area-inset-top,0px) - var(--safe-area-inset-bottom,0px) - var(--native-ad-inset,0px));}' +
        '.topbar{top:var(--safe-area-inset-top,0px);}' +
        '.native-ad-privacy{display:grid;gap:.75rem;margin-top:1rem;}' +
        '.native-ad-privacy[hidden]{display:none;}' +
        '.native-ad-privacy .btn-secondary{justify-self:start;}';
    document.head.appendChild(style);

    function setInset(px) {
        var value = Math.max(0, Math.round(px || 0));
        document.documentElement.style.setProperty('--native-ad-inset', value + 'px');
        try {
            if (value > 0) {
                window.sessionStorage.setItem(HEIGHT_KEY, String(value));
            } else {
                window.sessionStorage.removeItem(HEIGHT_KEY);
            }
        } catch (e) {
            /* sessionStorage indisponivel: segue sem cache */
        }
    }

    /* Reaproveita a altura entre navegacoes internas para evitar salto de layout. */
    try {
        var cached = parseInt(window.sessionStorage.getItem(HEIGHT_KEY) || '0', 10);
        if (cached > 0 && cached < 200) {
            setInset(cached);
        }
    } catch (e) {
        /* ignore */
    }

    var booting = false;
    var waitingForNetwork = false;
    var retryUsed = false;
    var privacyButtonAdded = false;

    function logError(prefix, error) {
        var message = error && error.message ? error.message : String(error || '');
        console.warn(LOG + ' ' + prefix + (message ? ': ' + message : ''));
    }

    function waitForNetwork() {
        if (waitingForNetwork) {
            return;
        }
        waitingForNetwork = true;
        window.addEventListener('online', function () {
            waitingForNetwork = false;
            if (retryUsed) {
                return;
            }
            retryUsed = true;
            boot();
        }, { once: true });
    }

    function requestConsent() {
        return Promise.resolve()
            .then(function () {
                return plugin.requestConsentInfo({});
            })
            .then(function (info) {
                if (info && info.status === 'REQUIRED' && info.isConsentFormAvailable !== false && typeof plugin.showConsentForm === 'function') {
                    return Promise.resolve()
                        .then(function () {
                            return plugin.showConsentForm({});
                        })
                        .then(function (updated) {
                            return updated || info;
                        });
                }
                return info;
            });
    }

    function showPrivacyOptionsButton() {
        if (privacyButtonAdded || typeof plugin.showPrivacyOptionsForm !== 'function') {
            return;
        }
        var container = document.querySelector('.policy-container');
        if (!container) {
            return;
        }

        var section = document.createElement('section');
        section.className = 'native-ad-privacy';
        section.innerHTML =
            '<h2>Preferências de anúncios</h2>' +
            '<p>Você pode revisar ou alterar a qualquer momento as escolhas de consentimento usadas para anúncios personalizados.</p>' +
            '<button type="button" class="btn-secondary" id="native-ad-privacy-options">Gerenciar preferências de anúncios</button>';
        container.appendChild(section);
        privacyButtonAdded = true;

        var button = section.querySelector('#native-ad-privacy-options');
        button.addEventListener('click', function () {
            button.disabled = true;
            Promise.resolve()
                .then(function () {
                    return plugin.showPrivacyOptionsForm({});
                })
                .then(function () {
                    if (typeof plugin.removeBanner !== 'function') {
                        return null;
                    }
                    return Promise.resolve()
                        .then(function () {
                            return plugin.removeBanner({});
                        })
                        .catch(function () {
                            /* removeBanner pode falhar se nao houver banner; segue para reavaliar */
                        });
                })
                .then(function () {
                    setInset(0);
                    booting = false;
                    boot();
                })
                .catch(function (error) {
                    logError('falha ao abrir as preferencias de anuncios', error);
                })
                .then(function () {
                    button.disabled = false;
                });
        });
    }

    function boot() {
        if (booting) {
            return;
        }
        booting = true;

        if (!navigator.onLine) {
            booting = false;
            waitForNetwork();
            return;
        }

        requestConsent()
            .then(function (info) {
                if (info && info.privacyOptionsRequirementStatus === 'REQUIRED') {
                    showPrivacyOptionsButton();
                }
                if (info && info.canRequestAds === false) {
                    console.info(LOG + ' consentimento nao permite anuncios; banner desativado.');
                    setInset(0);
                    return null;
                }
                return Promise.resolve(plugin.initialize({}))
                    .then(function () {
                        return plugin.showBanner({
                            adId: config.bannerAdUnitId,
                            adSize: 'BANNER',
                            position: 'BOTTOM_CENTER',
                            margin: 0,
                            isTesting: false
                        });
                    });
            })
            .catch(function (error) {
                logError('banner indisponivel', error);
                setInset(0);
                if (!navigator.onLine) {
                    waitForNetwork();
                }
            })
            .then(function () {
                booting = false;
            });
    }

    try {
        plugin.addListener('bannerAdSizeChanged', function (info) {
            var height = info && typeof info.height === 'number' ? info.height : 0;
            setInset(height > 0 ? height : 0);
        });
        plugin.addListener('bannerAdLoaded', function () {
            /* A altura chega em bannerAdSizeChanged; nada a fazer aqui. */
        });
        plugin.addListener('bannerAdFailedToLoad', function (info) {
            setInset(0);
            logError('falha ao carregar o banner', info);
            if (!navigator.onLine) {
                waitForNetwork();
            }
        });
    } catch (e) {
        logError('nao foi possivel registrar os eventos do banner', e);
    }

    boot();
})();
