(function () {
    'use strict';

    const KUNCI_PENYIMPANAN = 'wiecara_bahasa';
    const BAHASA_DEFAULT = 'id';
    const BAHASA_DIDUKUNG = new Set(['id', 'en']);
    const ATRIBUT_TERPANTAU = ['placeholder', 'title', 'aria-label', 'alt', 'content'];
    const SELECTOR_DIKECUALIKAN = [
        'script',
        'style',
        'noscript',
        'code',
        'pre',
        '#chatbot-container',
        '#chatbot-container *',
        '.chatbot-modal-overlay',
        '.chatbot-modal-overlay *',
        '.chat-message',
        '.chat-message *',
        '[data-wiecara-language-switcher]',
        '[data-wiecara-language-switcher] *'
    ].join(',');

    const kamus = window.WIECARA_KAMUS_BAHASA || { teks: {}, atribut: {}, kunci: {} };
    const teksAsli = new WeakMap();
    const atributAsli = new WeakMap();
    let bahasaAktif = ambilBahasaTersimpan();
    let sedangMenerapkan = false;
    let observer = null;
    const dialogAsli = {
        alert: window.alert.bind(window),
        confirm: window.confirm.bind(window),
        prompt: window.prompt.bind(window)
    };

    function ambilBahasaTersimpan() {
        try {
            const tersimpan = localStorage.getItem(KUNCI_PENYIMPANAN);
            return BAHASA_DIDUKUNG.has(tersimpan) ? tersimpan : BAHASA_DEFAULT;
        } catch (error) {
            return BAHASA_DEFAULT;
        }
    }

    function simpanBahasa(bahasa) {
        try {
            localStorage.setItem(KUNCI_PENYIMPANAN, bahasa);
        } catch (error) {
            // localStorage bisa diblokir browser; UI tetap berjalan dengan state memori.
        }
    }

    function normalisasiTeks(nilai) {
        return String(nilai || '').replace(/\s+/g, ' ').trim();
    }

    function bolehDiterjemahkanNode(node) {
        const induk = node.parentElement;
        return induk && !induk.closest(SELECTOR_DIKECUALIKAN);
    }

    function bolehDiterjemahkanElemen(elemen) {
        return elemen && !elemen.closest(SELECTOR_DIKECUALIKAN);
    }

    function cariTerjemahanTeks(teksIndonesia, bahasa) {
        if (bahasa === 'id') return teksIndonesia;
        const entri = kamus.teks[teksIndonesia];
        if (typeof entri === 'string') return entri;
        if (entri && typeof entri[bahasa] === 'string') return entri[bahasa];
        return teksIndonesia;
    }

    function terjemahkanTeksBebas(nilai) {
        if (bahasaAktif === 'id') return nilai;
        const teksTrim = normalisasiTeks(nilai);
        if (!teksTrim) return nilai;

        const terjemahanPersis = cariTerjemahanTeks(teksTrim, bahasaAktif);
        if (terjemahanPersis !== teksTrim) return terjemahanPersis;

        // Untuk dialog dengan data dinamis, hanya ganti fragmen UI yang dikenal.
        let hasil = String(nilai);
        Object.entries(kamus.teks).forEach(([teksIndonesia, entri]) => {
            const terjemahan = typeof entri === 'string' ? entri : entri && entri[bahasaAktif];
            if (!terjemahan || teksIndonesia.length < 4) return;
            if (hasil.includes(teksIndonesia)) {
                hasil = hasil.split(teksIndonesia).join(terjemahan);
            }
        });
        return hasil;
    }

    function cariTerjemahanAtribut(teksIndonesia, bahasa) {
        if (bahasa === 'id') return teksIndonesia;
        const entri = kamus.atribut[teksIndonesia] || kamus.teks[teksIndonesia];
        if (typeof entri === 'string') return entri;
        if (entri && typeof entri[bahasa] === 'string') return entri[bahasa];
        return teksIndonesia;
    }

    function terjemahkanKunci(kunci, parameter = {}) {
        const entri = kamus.kunci[kunci];
        let hasil = entri ? (entri[bahasaAktif] || entri.id || kunci) : kunci;
        Object.entries(parameter).forEach(([nama, nilai]) => {
            hasil = hasil.replace(new RegExp(`\\{${nama}\\}`, 'g'), nilai);
        });
        return hasil;
    }

    function terjemahkanPotonganTeks(nilai, bahasa) {
        const teksUtuh = String(nilai);
        const teksTrim = normalisasiTeks(teksUtuh);
        if (!teksTrim) return teksUtuh;

        const terjemahan = cariTerjemahanTeks(teksTrim, bahasa);
        if (terjemahan === teksTrim && bahasa !== 'id') return teksUtuh;

        const awal = teksUtuh.match(/^\s*/)[0];
        const akhir = teksUtuh.match(/\s*$/)[0];
        return awal + terjemahan + akhir;
    }

    function simpanTeksAsli(node) {
        if (!teksAsli.has(node)) {
            teksAsli.set(node, node.nodeValue);
        }
    }

    function perbaruiTeksAsli(node) {
        teksAsli.set(node, node.nodeValue);
    }

    function terapkanPadaTextNode(node, bahasa) {
        if (!bolehDiterjemahkanNode(node)) return;
        if (!normalisasiTeks(node.nodeValue)) return;

        simpanTeksAsli(node);
        const nilaiAsli = teksAsli.get(node);
        const nilaiBaru = terjemahkanPotonganTeks(nilaiAsli, bahasa);
        if (node.nodeValue !== nilaiBaru) {
            node.nodeValue = nilaiBaru;
        }
    }

    function ambilAtributAsli(elemen, atribut) {
        if (!atributAsli.has(elemen)) {
            atributAsli.set(elemen, {});
        }
        const daftar = atributAsli.get(elemen);
        if (!Object.prototype.hasOwnProperty.call(daftar, atribut)) {
            daftar[atribut] = elemen.getAttribute(atribut);
        }
        return daftar[atribut];
    }

    function perbaruiAtributAsli(elemen, atribut) {
        if (!atributAsli.has(elemen)) {
            atributAsli.set(elemen, {});
        }
        atributAsli.get(elemen)[atribut] = elemen.getAttribute(atribut);
    }

    function terapkanPadaAtribut(elemen, bahasa) {
        if (!bolehDiterjemahkanElemen(elemen)) return;

        ATRIBUT_TERPANTAU.forEach((atribut) => {
            if (!elemen.hasAttribute(atribut)) return;
            if (atribut === 'content') {
                const namaMeta = (elemen.getAttribute('name') || '').toLowerCase();
                if (elemen.tagName !== 'META' || namaMeta !== 'description') return;
            }

            const nilaiAsli = ambilAtributAsli(elemen, atribut);
            const teksTrim = normalisasiTeks(nilaiAsli);
            if (!teksTrim) return;

            const terjemahan = cariTerjemahanAtribut(teksTrim, bahasa);
            if (elemen.getAttribute(atribut) !== terjemahan) {
                elemen.setAttribute(atribut, terjemahan);
            }
        });
    }

    function telusuriTextNode(root, callback) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!normalisasiTeks(node.nodeValue)) return NodeFilter.FILTER_REJECT;
                    return bolehDiterjemahkanNode(node)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let node = walker.nextNode();
        while (node) {
            callback(node);
            node = walker.nextNode();
        }
    }

    function terapkanPadaRoot(root, bahasa) {
        if (!root) return;

        if (root.nodeType === Node.TEXT_NODE) {
            terapkanPadaTextNode(root, bahasa);
            return;
        }

        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

        if (root.nodeType === Node.ELEMENT_NODE) {
            terapkanPadaAtribut(root, bahasa);
        }

        const elemenRoot = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
        elemenRoot.querySelectorAll('*').forEach((elemen) => terapkanPadaAtribut(elemen, bahasa));
        telusuriTextNode(elemenRoot, (node) => terapkanPadaTextNode(node, bahasa));
    }

    function terapkanJudulDokumen(bahasa) {
        const judulAsli = document.documentElement.dataset.wiecaraJudulAsli || document.title;
        document.documentElement.dataset.wiecaraJudulAsli = judulAsli;
        document.title = bahasa === 'id' ? judulAsli : cariTerjemahanTeks(normalisasiTeks(judulAsli), bahasa);
    }

    function buatTombolBahasa() {
        if (document.querySelector('[data-wiecara-language-switcher]')) return;

        const pembungkus = document.createElement('div');
        pembungkus.className = 'wiecara-language-switcher';
        pembungkus.setAttribute('data-wiecara-language-switcher', '');
        pembungkus.setAttribute('role', 'group');
        pembungkus.setAttribute('aria-label', terjemahkanKunci('bahasa.label'));
        pembungkus.innerHTML = `
            <span class="wiecara-language-label">${terjemahkanKunci('bahasa.label')}</span>
            <select class="wiecara-language-select" data-wiecara-language-select aria-label="${terjemahkanKunci('bahasa.label')}">
                <option value="id" data-wiecara-language-option="id">${terjemahkanKunci('bahasa.id')}</option>
                <option value="en" data-wiecara-language-option="en">${terjemahkanKunci('bahasa.en')}</option>
            </select>
        `;

        pembungkus.addEventListener('change', (event) => {
            const pilihan = event.target.closest('[data-wiecara-language-select]');
            if (!pilihan) return;
            aturBahasa(pilihan.value);
        });

        const target = cariTargetSwitcher();
        if (target) {
            pembungkus.classList.add('is-embedded');
            target.appendChild(pembungkus);
        } else {
            pembungkus.classList.add('is-floating');
            document.body.appendChild(pembungkus);
        }
    }

    function cariTargetSwitcher() {
        const kandidatSelector = [
            '[data-wiecara-language-target]',
            '.nav-actions',
            '.topbar-right',
            '.actions',
            '.navbar .main-container',
            '.navbar .container',
            '.header-actions',
            '.topbar-actions',
            '.dashboard-header',
            '.page-header',
            '.sidebar-footer'
        ];

        for (const selector of kandidatSelector) {
            const elemen = document.querySelector(selector);
            if (elemen && !elemen.closest(SELECTOR_DIKECUALIKAN) && elemenTerlihat(elemen)) {
                return elemen;
            }
        }

        return null;
    }

    function elemenTerlihat(elemen) {
        const style = window.getComputedStyle(elemen);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (elemen.closest('[hidden], .is-hidden')) return false;
        return elemen.getClientRects().length > 0;
    }

    function perbaruiTombolBahasa() {
        const pembungkus = document.querySelector('[data-wiecara-language-switcher]');
        if (!pembungkus) return;

        pembungkus.setAttribute('aria-label', terjemahkanKunci('bahasa.label'));
        const label = pembungkus.querySelector('.wiecara-language-label');
        if (label) label.textContent = terjemahkanKunci('bahasa.label');

        const select = pembungkus.querySelector('[data-wiecara-language-select]');
        if (select) {
            select.value = bahasaAktif;
            select.setAttribute('aria-label', terjemahkanKunci('bahasa.label'));
            select.title = bahasaAktif === 'id'
                ? terjemahkanKunci('bahasa.pilihInggris')
                : terjemahkanKunci('bahasa.pilihIndonesia');
        }
    }

    function sisipkanGaya() {
        if (document.getElementById('wiecaraI18nStyle')) return;

        const style = document.createElement('style');
        style.id = 'wiecaraI18nStyle';
        style.textContent = `
            .wiecara-language-switcher {
                z-index: 2147483000;
                display: inline-flex;
                align-items: center;
                gap: 0;
                padding: 4px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.34);
                background: rgba(10, 76, 68, 0.82);
                color: #ffffff;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                font-family: Poppins, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                line-height: 1;
                max-width: max-content;
            }

            .wiecara-language-switcher.is-floating {
                position: fixed;
                top: 16px;
                right: 16px;
            }

            .wiecara-language-switcher.is-embedded {
                position: static;
                flex: 0 0 auto;
                margin-left: 8px;
                z-index: 1;
            }

            .wiecara-language-label {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0;
                color: rgba(255, 255, 255, 0.78);
            }

            .wiecara-language-select {
                min-width: 62px;
                height: 30px;
                border: 1px solid rgba(255, 255, 255, 0.24);
                border-radius: 8px;
                background: #ffffff;
                color: #117c6f;
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                padding: 0 28px 0 10px;
                cursor: pointer;
                outline: none;
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
            }

            @media (max-width: 640px) {
                .wiecara-language-switcher.is-floating {
                    top: 10px;
                    right: 10px;
                }

                .wiecara-language-label {
                    display: none;
                }

                .wiecara-language-switcher.is-embedded {
                    margin-left: 4px;
                    padding: 3px;
                }

                .wiecara-language-select {
                    min-width: 56px;
                    height: 28px;
                    font-size: 11px;
                    padding-left: 8px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function mulaiObserver() {
        if (observer) return;

        observer = new MutationObserver((mutations) => {
            if (sedangMenerapkan || bahasaAktif === 'id') return;
            sedangMenerapkan = true;
            mutations.forEach((mutation) => {
                if (mutation.type === 'characterData') {
                    perbaruiTeksAsli(mutation.target);
                    terapkanPadaTextNode(mutation.target, bahasaAktif);
                    return;
                }
                mutation.addedNodes.forEach((node) => terapkanPadaRoot(node, bahasaAktif));
                if (mutation.type === 'attributes') {
                    perbaruiAtributAsli(mutation.target, mutation.attributeName);
                    terapkanPadaAtribut(mutation.target, bahasaAktif);
                }
            });
            sedangMenerapkan = false;
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATRIBUT_TERPANTAU
        });
    }

    function bungkusDialogBrowser() {
        window.alert = function (pesan) {
            return dialogAsli.alert(terjemahkanTeksBebas(pesan));
        };

        window.confirm = function (pesan) {
            return dialogAsli.confirm(terjemahkanTeksBebas(pesan));
        };

        window.prompt = function (pesan, nilaiDefault) {
            return dialogAsli.prompt(
                terjemahkanTeksBebas(pesan),
                typeof nilaiDefault === 'undefined' ? nilaiDefault : terjemahkanTeksBebas(nilaiDefault)
            );
        };
    }

    function terapkanBahasa() {
        sedangMenerapkan = true;
        document.documentElement.lang = bahasaAktif;
        terapkanJudulDokumen(bahasaAktif);
        terapkanPadaRoot(document, bahasaAktif);
        perbaruiTombolBahasa();
        sedangMenerapkan = false;
    }

    function aturBahasa(bahasa) {
        if (!BAHASA_DIDUKUNG.has(bahasa)) return;
        bahasaAktif = bahasa;
        simpanBahasa(bahasa);
        terapkanBahasa();
    }

    function inisialisasi() {
        bungkusDialogBrowser();
        sisipkanGaya();
        buatTombolBahasa();
        terapkanBahasa();
        mulaiObserver();
    }

    window.WiecaraBahasa = {
        aturBahasa,
        bahasaAktif: () => bahasaAktif,
        terjemahkan: terjemahkanKunci,
        terjemahkanTeks: (teks) => cariTerjemahanTeks(normalisasiTeks(teks), bahasaAktif)
    };

    window.WiecaraI18n = window.WiecaraBahasa;
    window.ambilTeks = terjemahkanKunci;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inisialisasi);
    } else {
        inisialisasi();
    }
})();
