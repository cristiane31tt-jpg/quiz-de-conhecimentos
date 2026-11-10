/* Google AdSense - estrutura pronta, porem DESATIVADA.
 *
 * Para ativar:
 *   1. Preencha client com o ID de publicador (formato ca-pub-0000000000000000).
 *   2. Crie dois blocos de anuncio no painel do AdSense e informe os IDs em slots.
 *   3. Publique o site em https e aguarde a aprovacao da conta.
 *
 * Enquanto client estiver vazio, nenhum script externo e carregado e nenhum
 * espaco publicitario aparece na interface (sem areas em branco).
 */

const Ads = {
    /* ====== CONFIGURACAO - preencher apenas com dados oficiais ====== */
    client: '',          // ex.: 'ca-pub-0000000000000000'
    slots: {
        home: '',        // ID do bloco exibido na tela inicial
        result: ''       // ID do bloco exibido na tela de resultado
    },
    /* =============================================================== */

    loaderSrc: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
    fillTimeout: 6000,

    isEnabled: function () {
        return typeof this.client === 'string' && this.client.trim() !== '';
    },

    init: function () {
        if (!this.isEnabled()) return;   // mantem os dois espacos ocultos
        this.loadScript();
        this.mount('home');
        /* O bloco de resultado e montado quando a tela de resultado fica visivel
           (App.showScreen), pois anuncios nao sao preenchidos em telas ocultas. */
    },

    loadScript: function () {
        if (document.querySelector('script[data-adsense-loader]')) return;
        const s = document.createElement('script');
        s.async = true;
        s.src = this.loaderSrc + '?client=' + encodeURIComponent(this.client.trim());
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-adsense-loader', 'true');
        document.head.appendChild(s);
    },

    mount: function (position) {
        const container = document.getElementById('ad-slot-' + position);
        const slotId = this.slots[position];
        if (!container || !slotId) return;

        const frame = container.querySelector('.ad-frame');
        if (!frame || frame.querySelector('.adsbygoogle')) return;

        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', this.client.trim());
        ins.setAttribute('data-ad-slot', String(slotId));
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
        frame.appendChild(ins);

        container.classList.remove('hidden');
        this.watchFill(ins, container);

        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            container.classList.add('hidden');
        }
    },

    /* Se o provedor nao preencher o bloco, a area e recolhida para nao
       deixar espaco vazio. */
    watchFill: function (ins, container) {
        const self = this;
        let settled = false;

        const apply = function () {
            const status = ins.getAttribute('data-ad-status');
            if (status === 'filled') {
                settled = true;
                container.classList.remove('hidden');
            } else if (status === 'unfilled') {
                settled = true;
                container.classList.add('hidden');
            }
        };

        if (window.MutationObserver) {
            const observer = new window.MutationObserver(apply);
            observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
        }

        window.setTimeout(function () {
            if (!settled) container.classList.add('hidden');
        }, self.fillTimeout);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Ads;
}