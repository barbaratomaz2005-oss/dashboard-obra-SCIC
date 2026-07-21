(function () {
    "use strict";

    /**
     * Verifica se as configurações necessárias foram carregadas.
     */
    function validarConfiguracao() {
        if (!window.SHEET_ID) {
            throw new Error(
                "O SHEET_ID não foi encontrado. Verifique o arquivo config.js."
            );
        }

        if (!window.GIDS) {
            throw new Error(
                "Os GIDs das abas não foram encontrados. Verifique o arquivo config.js."
            );
        }
    }

    /**
     * Monta o endereço utilizado para consultar uma aba da planilha.
     */
    function montarUrl(gid) {
        return (
            "https://docs.google.com/spreadsheets/d/" +
            window.SHEET_ID +
            "/gviz/tq?tqx=out:json&gid=" +
            encodeURIComponent(gid) +
            "&t=" +
            Date.now()
        );
    }

    /**
     * Remove o texto adicional retornado pelo Google Sheets
     * e transforma o resultado em objeto JavaScript.
     */
    function interpretarRespostaGoogle(texto) {
        const inicio = texto.indexOf("{");
        const fim = texto.lastIndexOf("}");

        if (inicio === -1 || fim === -1) {
            throw new Error(
                "O Google Sheets retornou uma resposta inválida."
            );
        }

        const json = texto.substring(inicio, fim + 1);

        return JSON.parse(json);
    }

    /**
     * Retorna o conteúdo apresentado pelo Google Sheets.
     *
     * A propriedade "f" representa o valor formatado.
     * A propriedade "v" representa o valor original.
     */
    function obterValorCelula(celula) {
        if (!celula) {
            return "";
        }

        if (
            celula.f !== undefined &&
            celula.f !== null &&
            celula.f !== ""
        ) {
            return celula.f;
        }

        if (
            celula.v !== undefined &&
            celula.v !== null
        ) {
            return celula.v;
        }

        return "";
    }

    /**
     * Remove espaços extras dos nomes das colunas.
     */
    function normalizarCabecalho(valor, indice) {
        const texto = String(valor || "").trim();

        if (texto) {
            return texto;
        }

        return "Coluna" + (indice + 1);
    }

    /**
     * Converte a tabela retornada pelo Google Sheets
     * em uma lista de objetos.
     *
     * Exemplo:
     *
     * [
     *   {
     *     Semana: "S1",
     *     Previsto: 10,
     *     Realizado: 8
     *   }
     * ]
     */
    function converterTabelaEmObjetos(tabela) {
        if (!tabela || !Array.isArray(tabela.cols)) {
            return [];
        }

        const cabecalhos = tabela.cols.map(function (coluna, indice) {
            return normalizarCabecalho(
                coluna.label || coluna.id,
                indice
            );
        });

        const linhas = Array.isArray(tabela.rows)
            ? tabela.rows
            : [];

        return linhas
            .map(function (linha) {
                const objeto = {};
                let possuiConteudo = false;

                cabecalhos.forEach(function (cabecalho, indice) {
                    const celula = linha.c
                        ? linha.c[indice]
                        : null;

                    const valor = obterValorCelula(celula);

                    if (
                        valor !== "" &&
                        valor !== null &&
                        valor !== undefined
                    ) {
                        possuiConteudo = true;
                    }

                    objeto[cabecalho] = valor;
                });

                return possuiConteudo ? objeto : null;
            })
            .filter(Boolean);
    }

    /**
     * Busca uma aba pelo GID.
     */
    async function buscarAbaPorGid(gid) {
        validarConfiguracao();

        if (
            gid === undefined ||
            gid === null ||
            gid === ""
        ) {
            throw new Error(
                "Não foi informado o GID da aba."
            );
        }

        const resposta = await fetch(
            montarUrl(gid),
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!resposta.ok) {
            throw new Error(
                "Não foi possível acessar a planilha. Código HTTP: " +
                resposta.status
            );
        }

        const texto = await resposta.text();
        const dados = interpretarRespostaGoogle(texto);

        if (
            dados.status &&
            dados.status === "error"
        ) {
            const mensagem =
                dados.errors &&
                dados.errors[0] &&
                dados.errors[0].detailed_message
                    ? dados.errors[0].detailed_message
                    : "Erro retornado pelo Google Sheets.";

            throw new Error(mensagem);
        }

        return converterTabelaEmObjetos(dados.table);
    }

    /**
     * Busca uma aba utilizando o nome configurado em GIDS.
     *
     * Exemplo:
     * buscarAba("avancoFisicoSemanal")
     */
    async function buscarAba(nomeConfiguracao) {
        validarConfiguracao();

        const gid = window.GIDS[nomeConfiguracao];

        if (!gid) {
            throw new Error(
                'O GID da aba "' +
                nomeConfiguracao +
                '" não foi encontrado no config.js.'
            );
        }

        return buscarAbaPorGid(gid);
    }

    /**
     * Busca todas as abas utilizadas no dashboard.
     */
    async function buscarTodasAsAbas() {
        validarConfiguracao();

        const resultados = await Promise.all([
            buscarAba("config"),
            buscarAba("avancoFisicoSemanal"),
            buscarAba("avancoFisicoAcumulado"),
            buscarAba("atividadesSemanaisFotos"),
            buscarAba("atividadesSemanaisPontos"),
            buscarAba("fluxoFinanceiroSemanal"),
            buscarAba("fluxoFinanceiroTrimestral"),
            buscarAba("curvaS"),
            buscarAba("contratacoes"),
            buscarAba("concessionarias"),
            buscarAba("canteiroFuncionarios"),
            buscarAba("rocontec")
        ]);

        return {
            config: resultados[0],
            avancoFisicoSemanal: resultados[1],
            avancoFisicoAcumulado: resultados[2],
            atividadesSemanaisFotos: resultados[3],
            atividadesSemanaisPontos: resultados[4],
            fluxoFinanceiroSemanal: resultados[5],
            fluxoFinanceiroTrimestral: resultados[6],
            curvaS: resultados[7],
            contratacoes: resultados[8],
            concessionarias: resultados[9],
            canteiroFuncionarios: resultados[10],
            rocontec: resultados[11]
        };
    }

    /**
     * Converte links compartilhados do Google Drive
     * em links adequados para exibir imagens no site.
     */
    function converterLinkGoogleDrive(url) {
        if (!url) {
            return "";
        }

        const texto = String(url).trim();

        const correspondencias = [
            /\/file\/d\/([^/]+)/,
            /[?&]id=([^&]+)/,
            /\/d\/([^/]+)/
        ];

        for (
            let indice = 0;
            indice < correspondencias.length;
            indice++
        ) {
            const resultado = texto.match(
                correspondencias[indice]
            );

            if (resultado && resultado[1]) {
                return (
                    "https://drive.google.com/thumbnail?id=" +
                    resultado[1] +
                    "&sz=w1600"
                );
            }
        }

        return texto;
    }

    /**
     * Converte um valor para número.
     *
     * Aceita:
     * 1234.56
     * 1.234,56
     * R$ 1.234,56
     * 10%
     */
    function converterNumero(valor) {
        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {
            return null;
        }

        if (typeof valor === "number") {
            return Number.isFinite(valor)
                ? valor
                : null;
        }

        let texto = String(valor)
            .trim()
            .replace(/\s/g, "")
            .replace(/R\$/gi, "");

        if (!texto) {
            return null;
        }

        const possuiPorcentagem = texto.includes("%");

        texto = texto.replace(/%/g, "");

        if (
            texto.includes(".") &&
            texto.includes(",")
        ) {
            texto = texto
                .replace(/\./g, "")
                .replace(",", ".");
        } else if (texto.includes(",")) {
            texto = texto.replace(",", ".");
        }

        texto = texto.replace(/[^\d.-]/g, "");

        const numero = Number(texto);

        if (!Number.isFinite(numero)) {
            return null;
        }

        return possuiPorcentagem
            ? numero / 100
            : numero;
    }

    /**
     * Disponibiliza as funções para o script.js.
     */
    window.SheetsAPI = {
        buscarAba: buscarAba,
        buscarAbaPorGid: buscarAbaPorGid,
        buscarTodasAsAbas: buscarTodasAsAbas,
        converterLinkGoogleDrive: converterLinkGoogleDrive,
        converterNumero: converterNumero
    };
})();
