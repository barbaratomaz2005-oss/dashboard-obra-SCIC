// ==========================================================
// PREENCHIMENTO E FUNCIONAMENTO DO DASHBOARD
// ==========================================================

(function () {
    "use strict";

    const graficos = {};

    const CORES = {
        principal: "#14324b",
        secundaria: "#1f5d78",
        destaque: "#d1a93c",
        verde: "#15803d",
        vermelho: "#b91c1c",
        cinza: "#94a3b8",
        grade: "rgba(100, 116, 139, 0.16)"
    };

    // ======================================================
    // FUNÇÕES AUXILIARES
    // ======================================================

    function selecionar(id) {
        return document.getElementById(id);
    }

    function textoSeguro(valor, alternativa) {
        if (
            valor === null ||
            valor === undefined ||
            String(valor).trim() === ""
        ) {
            return alternativa || "—";
        }

        return String(valor).trim();
    }

    function obterValor(objeto, nomesPossiveis) {
        if (!objeto) {
            return "";
        }

        const chaves = Object.keys(objeto);

        for (let i = 0; i < nomesPossiveis.length; i++) {
            const nomeProcurado = normalizarTexto(
                nomesPossiveis[i]
            );

            const chaveEncontrada = chaves.find(function (chave) {
                return normalizarTexto(chave) === nomeProcurado;
            });

            if (chaveEncontrada !== undefined) {
                return objeto[chaveEncontrada];
            }
        }

        return "";
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function converterNumero(valor) {
        if (
            window.SheetsAPI &&
            typeof window.SheetsAPI.converterNumero === "function"
        ) {
            return window.SheetsAPI.converterNumero(valor);
        }

        const numero = Number(valor);

        return Number.isFinite(numero)
            ? numero
            : null;
    }

    function formatarNumero(valor, casasDecimais) {
        const numero = converterNumero(valor);

        if (numero === null) {
            return "—";
        }

        return numero.toLocaleString("pt-BR", {
            minimumFractionDigits: casasDecimais || 0,
            maximumFractionDigits: casasDecimais || 0
        });
    }

    function formatarMoeda(valor) {
        const numero = converterNumero(valor);

        if (numero === null) {
            return textoSeguro(valor);
        }

        return numero.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 2
        });
    }

    function formatarPorcentagem(valor) {
        const numero = converterNumero(valor);

        if (numero === null) {
            return "—";
        }

        /*
         * Valores menores ou iguais a 1 são tratados como:
         * 0,10 = 10%
         *
         * Valores maiores que 1 são tratados como:
         * 10 = 10%
         */
        const percentual =
            Math.abs(numero) <= 1
                ? numero
                : numero / 100;

        return percentual.toLocaleString("pt-BR", {
            style: "percent",
            minimumFractionDigits: 1,
            maximumFractionDigits: 2
        });
    }

    function formatarData(valor) {
        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {
            return "—";
        }

        const texto = String(valor).trim();

        /*
         * O Google Sheets normalmente já envia a data
         * formatada. Nesse caso, o texto é mantido.
         */
        if (
            texto.includes("/") ||
            texto.includes("-") ||
            /[a-zA-Z]/.test(texto)
        ) {
            return texto;
        }

        /*
         * Caso seja recebido o número serial do Excel,
         * convertemos para uma data legível.
         */
        const numero = Number(texto);

        if (Number.isFinite(numero) && numero > 20000) {
            const dataBase = new Date(
                Date.UTC(1899, 11, 30)
            );

            dataBase.setUTCDate(
                dataBase.getUTCDate() + numero
            );

            return dataBase.toLocaleDateString(
                "pt-BR",
                {
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC"
                }
            );
        }

        return texto;
    }

    function escaparHTML(valor) {
        return String(valor || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function criarClasseStatus(status) {
        const texto = normalizarTexto(status);

        if (
            texto === "ok" ||
            texto === "concluido" ||
            texto === "fechado" ||
            texto === "aprovado"
        ) {
            return "status-ok";
        }

        if (
            texto.includes("critic") ||
            texto.includes("atras")
        ) {
            return "status-critico";
        }

        if (
            texto.includes("andamento") ||
            texto.includes("monitor") ||
            texto.includes("pendente") ||
            texto.includes("aguardando")
        ) {
            return "status-andamento";
        }

        if (
            texto.includes("nao iniciado") ||
            texto.includes("não iniciado")
        ) {
            return "status-nao-iniciado";
        }

        return "status-pendente";
    }

    function criarBadgeStatus(status) {
        const texto = textoSeguro(status);

        return (
            '<span class="status ' +
            criarClasseStatus(texto) +
            '">' +
            escaparHTML(texto) +
            "</span>"
        );
    }

    function mostrarMensagem(mensagem, erro) {
        const elemento = selecionar("mensagemSistema");

        if (!elemento) {
            return;
        }

        elemento.textContent = mensagem;

        if (erro) {
            elemento.classList.add("erro");
            elemento.style.display = "block";
        } else {
            elemento.classList.remove("erro");
            elemento.style.display = "none";
        }
    }

    function destruirGrafico(nome) {
        if (graficos[nome]) {
            graficos[nome].destroy();
            delete graficos[nome];
        }
    }

    function opcoesGrafico(configuracao) {
        const percentual =
            configuracao &&
            configuracao.percentual;

        const moeda =
            configuracao &&
            configuracao.moeda;

        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 18,
                        color: "#42505c",
                        font: {
                            family: "Inter",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (contexto) {
                            const nome =
                                contexto.dataset.label || "";

                            const valor =
                                contexto.parsed.y;

                            if (
                                valor === null ||
                                valor === undefined
                            ) {
                                return nome + ": Sem informação";
                            }

                            if (moeda) {
                                return (
                                    nome +
                                    ": " +
                                    formatarMoeda(valor)
                                );
                            }

                            if (percentual) {
                                return (
                                    nome +
                                    ": " +
                                    formatarPorcentagem(valor)
                                );
                            }

                            return (
                                nome +
                                ": " +
                                formatarNumero(valor, 2)
                            );
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: "#687785",
                        font: {
                            family: "Inter",
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: CORES.grade
                    },
                    ticks: {
                        color: "#687785",
                        font: {
                            family: "Inter",
                            size: 10
                        },
                        callback: function (valor) {
                            if (moeda) {
                                return (
                                    "R$ " +
                                    Number(valor).toLocaleString(
                                        "pt-BR",
                                        {
                                            notation: "compact",
                                            maximumFractionDigits: 1
                                        }
                                    )
                                );
                            }

                            if (percentual) {
                                return (
                                    Number(valor * 100)
                                        .toLocaleString(
                                            "pt-BR",
                                            {
                                                maximumFractionDigits: 1
                                            }
                                        ) + "%"
                                );
                            }

                            return valor;
                        }
                    }
                }
            }
        };
    }

    // ======================================================
    // CONFIGURAÇÕES DO PROJETO
    // ======================================================

    function transformarConfigEmObjeto(linhas) {
        const config = {};

        linhas.forEach(function (linha) {
            const campo = obterValor(
                linha,
                ["Campo"]
            );

            const valor = obterValor(
                linha,
                ["Valor"]
            );

            if (campo) {
                config[normalizarTexto(campo)] = valor;
            }
        });

        return config;
    }

    function preencherConfiguracoes(linhas) {
        const config = transformarConfigEmObjeto(linhas);

        selecionar("nomeProjeto").textContent =
            textoSeguro(
                config.projeto,
                "Dashboard da Obra"
            );

        selecionar("dataAtualizacao").textContent =
            textoSeguro(
                config.dataatualizacao,
                "Não informada"
            );

        selecionar("responsavelProjeto").textContent =
            textoSeguro(
                config.responsavel,
                "Não informado"
            );

        selecionar("indicadorIDP").textContent =
            formatarPorcentagem(config.idp);
    }

    // ======================================================
    // INDICADORES
    // ======================================================

    function preencherIndicadores(dados) {
        const totalFuncionarios =
            dados.canteiroFuncionarios.reduce(
                function (total, linha) {
                    const numero = converterNumero(
                        obterValor(
                            linha,
                            ["Numero", "Número"]
                        )
                    );

                    return total + (numero || 0);
                },
                0
            );

        const contratacoesFechadas =
            dados.contratacoes.reduce(
                function (total, linha) {
                    const colunas = [
                        obterValor(linha, ["Obra"]),
                        obterValor(linha, ["Suprimentos"]),
                        obterValor(linha, ["Gerenciadora"])
                    ];

                    return (
                        total +
                        colunas.filter(function (valor) {
                            return normalizarTexto(valor) === "fechado";
                        }).length
                    );
                },
                0
            );

        const pontosCriticos =
            dados.atividadesSemanaisPontos.filter(
                function (linha) {
                    const status = obterValor(
                        linha,
                        ["Status"]
                    );

                    return normalizarTexto(status).includes(
                        "critic"
                    );
                }
            ).length;

        selecionar("indicadorFuncionarios").textContent =
            formatarNumero(totalFuncionarios);

        selecionar("totalFuncionarios").textContent =
            formatarNumero(totalFuncionarios);

        selecionar("indicadorContratacoes").textContent =
            formatarNumero(contratacoesFechadas);

        selecionar("indicadorCriticos").textContent =
            formatarNumero(pontosCriticos);
    }

    // ======================================================
    // GRÁFICOS DE AVANÇO FÍSICO
    // ======================================================

    function criarGraficoAvancoSemanal(linhas) {
        destruirGrafico("avancoSemanal");

        const elemento = selecionar(
            "graficoAvancoSemanal"
        );

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Semana"])
            );
        });

        const previsto = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Previsto"])
            );
        });

        const realizado = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Realizado"])
            );
        });

        graficos.avancoSemanal = new Chart(
            elemento,
            {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Previsto",
                            data: previsto,
                            backgroundColor:
                                "rgba(20, 50, 75, 0.72)",
                            borderColor:
                                CORES.principal,
                            borderWidth: 1,
                            borderRadius: 5
                        },
                        {
                            label: "Realizado",
                            data: realizado,
                            backgroundColor:
                                "rgba(209, 169, 60, 0.78)",
                            borderColor:
                                CORES.destaque,
                            borderWidth: 1,
                            borderRadius: 5
                        }
                    ]
                },
                options: opcoesGrafico({
                    percentual: true
                })
            }
        );
    }

    function criarGraficoAvancoAcumulado(linhas) {
        destruirGrafico("avancoAcumulado");

        const elemento = selecionar(
            "graficoAvancoAcumulado"
        );

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Mes", "Mês"])
            );
        });

        const previsto = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Previsto"])
            );
        });

        const realizado = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Realizado"])
            );
        });

        graficos.avancoAcumulado = new Chart(
            elemento,
            {
                type: "line",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Previsto",
                            data: previsto,
                            borderColor: CORES.principal,
                            backgroundColor:
                                "rgba(20, 50, 75, 0.08)",
                            borderWidth: 3,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            tension: 0.32,
                            spanGaps: false
                        },
                        {
                            label: "Realizado",
                            data: realizado,
                            borderColor: CORES.destaque,
                            backgroundColor:
                                "rgba(209, 169, 60, 0.08)",
                            borderWidth: 3,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            tension: 0.32,
                            spanGaps: false
                        }
                    ]
                },
                options: opcoesGrafico({
                    percentual: true
                })
            }
        );
    }

    // ======================================================
    // GRÁFICOS FINANCEIROS
    // ======================================================

    function criarGraficoFinanceiroSemanal(linhas) {
        destruirGrafico("financeiroSemanal");

        const elemento = selecionar(
            "graficoFinanceiroSemanal"
        );

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Semana"])
            );
        });

        const pedido = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Pedido"])
            );
        });

        const aprovado = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Aprovado"])
            );
        });

        graficos.financeiroSemanal = new Chart(
            elemento,
            {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Pedido",
                            data: pedido,
                            backgroundColor:
                                "rgba(31, 93, 120, 0.75)",
                            borderColor:
                                CORES.secundaria,
                            borderWidth: 1,
                            borderRadius: 5
                        },
                        {
                            label: "Aprovado",
                            data: aprovado,
                            backgroundColor:
                                "rgba(21, 128, 61, 0.72)",
                            borderColor:
                                CORES.verde,
                            borderWidth: 1,
                            borderRadius: 5
                        }
                    ]
                },
                options: opcoesGrafico({
                    moeda: true
                })
            }
        );
    }

    function criarGraficoFinanceiroTrimestral(linhas) {
        destruirGrafico("financeiroTrimestral");

        const elemento = selecionar(
            "graficoFinanceiroTrimestral"
        );

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Mes", "Mês"])
            );
        });

        const previsto = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Previsto"])
            );
        });

        const realizado = linhas.map(function (linha) {
            return converterNumero(
                obterValor(linha, ["Realizado"])
            );
        });

        graficos.financeiroTrimestral = new Chart(
            elemento,
            {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Previsto",
                            data: previsto,
                            backgroundColor:
                                "rgba(20, 50, 75, 0.75)",
                            borderColor:
                                CORES.principal,
                            borderWidth: 1,
                            borderRadius: 5
                        },
                        {
                            label: "Realizado",
                            data: realizado,
                            backgroundColor:
                                "rgba(209, 169, 60, 0.78)",
                            borderColor:
                                CORES.destaque,
                            borderWidth: 1,
                            borderRadius: 5
                        }
                    ]
                },
                options: opcoesGrafico({
                    moeda: true
                })
            }
        );
    }

    // ======================================================
    // CURVA S
    // ======================================================

    function criarGraficoCurvaS(linhas) {
        destruirGrafico("curvaS");

        const elemento = selecionar("graficoCurvaS");

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Mes", "Mês"])
            );
        });

        function valores(coluna) {
            return linhas.map(function (linha) {
                return converterNumero(
                    obterValor(linha, [coluna])
                );
            });
        }

        graficos.curvaS = new Chart(
            elemento,
            {
                type: "line",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Físico previsto",
                            data: valores(
                                "FisicaPrevisto"
                            ),
                            borderColor:
                                CORES.principal,
                            backgroundColor:
                                "rgba(20, 50, 75, 0.06)",
                            borderWidth: 3,
                            pointRadius: 2,
                            tension: 0.3,
                            spanGaps: false
                        },
                        {
                            label: "Físico realizado",
                            data: valores(
                                "FisicaRealizado"
                            ),
                            borderColor:
                                CORES.destaque,
                            backgroundColor:
                                "rgba(209, 169, 60, 0.06)",
                            borderWidth: 3,
                            pointRadius: 2,
                            tension: 0.3,
                            spanGaps: false
                        },
                        {
                            label: "Financeiro previsto",
                            data: valores(
                                "FinanceiroPrevisto"
                            ),
                            borderColor:
                                CORES.secundaria,
                            borderDash: [7, 5],
                            borderWidth: 2,
                            pointRadius: 2,
                            tension: 0.3,
                            spanGaps: false
                        },
                        {
                            label: "Financeiro realizado",
                            data: valores(
                                "FinanceiroRealizado"
                            ),
                            borderColor:
                                CORES.verde,
                            borderDash: [7, 5],
                            borderWidth: 2,
                            pointRadius: 2,
                            tension: 0.3,
                            spanGaps: false
                        }
                    ]
                },
                options: opcoesGrafico({
                    percentual: true
                })
            }
        );
    }

    // ======================================================
    // FOTOGRAFIAS
    // ======================================================

    function preencherGaleriaFotos(linhas) {
        const galeria = selecionar("galeriaFotos");

        if (!galeria) {
            return;
        }

        if (!linhas.length) {
            galeria.innerHTML =
                '<div class="vazio">Nenhuma fotografia informada.</div>';

            return;
        }

        galeria.innerHTML = linhas
            .map(function (linha) {
                const titulo = obterValor(
                    linha,
                    ["Titulo", "Título"]
                );

                const urlOriginal = obterValor(
                    linha,
                    ["URL", "Link"]
                );

                const url =
                    window.SheetsAPI.converterLinkGoogleDrive(
                        urlOriginal
                    );

                return (
                    '<article class="foto-card">' +
                        '<div class="foto-card-imagem">' +
                            (
                                url
                                    ? '<img src="' +
                                      escaparHTML(url) +
                                      '" alt="' +
                                      escaparHTML(titulo) +
                                      '" loading="lazy" ' +
                                      'onerror="this.style.display=\'none\'; this.parentElement.innerHTML=\'Imagem indisponível\';">'
                                    : "Imagem não informada"
                            ) +
                        "</div>" +
                        '<div class="foto-card-conteudo">' +
                            "<h4>" +
                                escaparHTML(
                                    textoSeguro(
                                        titulo,
                                        "Registro da obra"
                                    )
                                ) +
                            "</h4>" +
                        "</div>" +
                    "</article>"
                );
            })
            .join("");
    }

    // ======================================================
    // TABELA DE PONTOS DE ATENÇÃO
    // ======================================================

    function preencherTabelaPontos(linhas) {
        const tabela = selecionar("tabelaPontos");

        if (!tabela) {
            return;
        }

        if (!linhas.length) {
            tabela.innerHTML =
                '<tr><td colspan="4">Nenhum ponto informado.</td></tr>';

            return;
        }

        tabela.innerHTML = linhas
            .map(function (linha) {
                const item = obterValor(
                    linha,
                    ["Item"]
                );

                const descricao = obterValor(
                    linha,
                    ["Descricao", "Descrição"]
                );

                const responsavel = obterValor(
                    linha,
                    ["Responsavel", "Responsável"]
                );

                const status = obterValor(
                    linha,
                    ["Status"]
                );

                return (
                    "<tr>" +
                        "<td><strong>" +
                            escaparHTML(textoSeguro(item)) +
                        "</strong></td>" +
                        "<td>" +
                            escaparHTML(textoSeguro(descricao)) +
                        "</td>" +
                        "<td>" +
                            escaparHTML(textoSeguro(responsavel)) +
                        "</td>" +
                        "<td>" +
                            criarBadgeStatus(status) +
                        "</td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    // ======================================================
    // CONTRATAÇÕES
    // ======================================================

    function preencherTabelaContratacoes(linhas) {
        const tabela = selecionar(
            "tabelaContratacoes"
        );

        if (!tabela) {
            return;
        }

        if (!linhas.length) {
            tabela.innerHTML =
                '<tr><td colspan="4">Nenhuma contratação informada.</td></tr>';

            return;
        }

        tabela.innerHTML = linhas
            .map(function (linha) {
                const atividade = obterValor(
                    linha,
                    ["Atividade"]
                );

                const obra = obterValor(
                    linha,
                    ["Obra"]
                );

                const suprimentos = obterValor(
                    linha,
                    ["Suprimentos"]
                );

                const gerenciadora = obterValor(
                    linha,
                    ["Gerenciadora"]
                );

                return (
                    "<tr>" +
                        "<td><strong>" +
                            escaparHTML(
                                textoSeguro(atividade)
                            ) +
                        "</strong></td>" +
                        "<td>" +
                            criarBadgeStatus(obra) +
                        "</td>" +
                        "<td>" +
                            criarBadgeStatus(suprimentos) +
                        "</td>" +
                        "<td>" +
                            criarBadgeStatus(gerenciadora) +
                        "</td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    // ======================================================
    // CONCESSIONÁRIAS
    // ======================================================

    function preencherTabelaConcessionarias(linhas) {
        const tabela = selecionar(
            "tabelaConcessionarias"
        );

        if (!tabela) {
            return;
        }

        if (!linhas.length) {
            tabela.innerHTML =
                '<tr><td colspan="3">Nenhuma etapa informada.</td></tr>';

            return;
        }

        tabela.innerHTML = linhas
            .map(function (linha) {
                const numero = obterValor(
                    linha,
                    ["N", "Nº", "Numero", "Número"]
                );

                const etapa = obterValor(
                    linha,
                    ["Etapa"]
                );

                const status = obterValor(
                    linha,
                    ["Status"]
                );

                return (
                    "<tr>" +
                        "<td>" +
                            escaparHTML(textoSeguro(numero)) +
                        "</td>" +
                        "<td><strong>" +
                            escaparHTML(textoSeguro(etapa)) +
                        "</strong></td>" +
                        "<td>" +
                            criarBadgeStatus(status) +
                        "</td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    // ======================================================
    // FUNCIONÁRIOS DO CANTEIRO
    // ======================================================

    function preencherFuncionarios(linhas) {
        const lista = selecionar(
            "listaFuncionarios"
        );

        if (!lista) {
            return;
        }

        if (!linhas.length) {
            lista.innerHTML =
                "<li>Nenhum funcionário informado.</li>";

            return;
        }

        lista.innerHTML = linhas
            .map(function (linha) {
                const empresa = obterValor(
                    linha,
                    ["Empresa"]
                );

                const numero = obterValor(
                    linha,
                    ["Numero", "Número"]
                );

                return (
                    "<li>" +
                        "<span>" +
                            escaparHTML(
                                textoSeguro(empresa)
                            ) +
                        "</span>" +
                        "<strong>" +
                            escaparHTML(
                                formatarNumero(numero)
                            ) +
                        "</strong>" +
                    "</li>"
                );
            })
            .join("");

        criarGraficoFuncionarios(linhas);
    }

    function criarGraficoFuncionarios(linhas) {
        destruirGrafico("funcionarios");

        const elemento = selecionar(
            "graficoFuncionarios"
        );

        if (!elemento) {
            return;
        }

        const labels = linhas.map(function (linha) {
            return textoSeguro(
                obterValor(linha, ["Empresa"])
            );
        });

        const valores = linhas.map(function (linha) {
            return converterNumero(
                obterValor(
                    linha,
                    ["Numero", "Número"]
                )
            );
        });

        const opcoes = opcoesGrafico({});

        opcoes.indexAxis = "y";

        opcoes.plugins.legend.display = false;

        opcoes.scales.y.grid = {
            display: false
        };

        opcoes.scales.x.ticks.precision = 0;

        graficos.funcionarios = new Chart(
            elemento,
            {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Funcionários",
                            data: valores,
                            backgroundColor:
                                "rgba(31, 93, 120, 0.76)",
                            borderColor:
                                CORES.secundaria,
                            borderWidth: 1,
                            borderRadius: 6
                        }
                    ]
                },
                options: opcoes
            }
        );
    }

    // ======================================================
    // ROCONTEC
    // ======================================================

    function preencherTabelaRocontec(linhas) {
        const tabela = selecionar(
            "tabelaRocontec"
        );

        if (!tabela) {
            return;
        }

        if (!linhas.length) {
            tabela.innerHTML =
                '<tr><td colspan="3">Nenhum registro informado.</td></tr>';

            return;
        }

        tabela.innerHTML = linhas
            .map(function (linha) {
                const mes = obterValor(
                    linha,
                    ["Mes", "Mês"]
                );

                const taxaAdm = obterValor(
                    linha,
                    [
                        "TaxaAdm",
                        "Taxa Administrativa",
                        "TaxaAdm."
                    ]
                );

                const folha = obterValor(
                    linha,
                    ["Folha"]
                );

                return (
                    "<tr>" +
                        "<td><strong>" +
                            escaparHTML(
                                formatarData(mes)
                            ) +
                        "</strong></td>" +
                        "<td>" +
                            criarBadgeStatus(taxaAdm) +
                        "</td>" +
                        "<td>" +
                            criarBadgeStatus(folha) +
                        "</td>" +
                    "</tr>"
                );
            })
            .join("");
    }

    // ======================================================
    // INICIALIZAÇÃO
    // ======================================================

    async function iniciarDashboard() {
        try {
            mostrarMensagem(
                "Carregando os dados da planilha...",
                false
            );

            if (!window.SheetsAPI) {
                throw new Error(
                    "O arquivo sheets.js não foi carregado corretamente."
                );
            }

            if (typeof Chart === "undefined") {
                throw new Error(
                    "A biblioteca de gráficos não foi carregada."
                );
            }

            const dados =
                await window.SheetsAPI.buscarTodasAsAbas();

            preencherConfiguracoes(dados.config);

            preencherIndicadores(dados);

            criarGraficoAvancoSemanal(
                dados.avancoFisicoSemanal
            );

            criarGraficoAvancoAcumulado(
                dados.avancoFisicoAcumulado
            );

            criarGraficoFinanceiroSemanal(
                dados.fluxoFinanceiroSemanal
            );

            criarGraficoFinanceiroTrimestral(
                dados.fluxoFinanceiroTrimestral
            );

            criarGraficoCurvaS(
                dados.curvaS
            );

            preencherGaleriaFotos(
                dados.atividadesSemanaisFotos
            );

            preencherTabelaPontos(
                dados.atividadesSemanaisPontos
            );

            preencherTabelaContratacoes(
                dados.contratacoes
            );

            preencherTabelaConcessionarias(
                dados.concessionarias
            );

            preencherFuncionarios(
                dados.canteiroFuncionarios
            );

            preencherTabelaRocontec(
                dados.rocontec
            );

            mostrarMensagem("", false);

            console.log(
                "Dashboard carregado com sucesso.",
                dados
            );
        } catch (erro) {
            console.error(
                "Erro ao carregar o dashboard:",
                erro
            );

            mostrarMensagem(
                "Não foi possível carregar os dados da planilha. " +
                erro.message +
                " Verifique se a planilha está compartilhada como “Qualquer pessoa com o link — Leitor”.",
                true
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciarDashboard
        );
    } else {
        iniciarDashboard();
    }
})();
