class CarroBase {
    /**
     * Cria uma instância de um veículo base.
     * @param {string} id - O identificador único do veículo. Essencial.
     * @param {string} modelo - O modelo do veículo (ex: "Fusca"). Essencial.
     * @param {string} [cor='Padrão'] - A cor do veículo.
     * @param {string} [imagemSrc='default_car.png'] - Caminho do arquivo de imagem ou string Base64 da imagem.
     * @param {string} [placa=''] - A placa do veículo.
     * @param {number|string} [ano=''] - O ano de fabricação. Será convertido para número.
     * @param {string|Date|null} [dataVencimentoCNH=null] - Data de vencimento da CNH associada (ISO string ou Date).
     * @throws {Error} Se `id` ou `modelo` não forem fornecidos.
     */
    constructor(id, modelo, cor, imagemSrc = 'default_car.png', placa = '', ano = '', dataVencimentoCNH = null) {
        if (!id || !modelo) throw new Error("ID e Modelo são obrigatórios para criar um veículo.");
        this.id = id;
        this.modelo = String(modelo || 'Modelo Padrão').trim();
        this.cor = String(cor || 'Cor Padrão').trim();
        this.imagemSrc = imagemSrc || 'default_car.png'; // Armazena caminho ou Base64
        this.placa = String(placa || '').trim().toUpperCase();
        this.ano = parseInt(ano) || null; // Converte para número ou null se inválido/vazio.

        // Processamento robusto da data da CNH.
        this.dataVencimentoCNH = dataVencimentoCNH instanceof Date ? dataVencimentoCNH : (dataVencimentoCNH ? new Date(dataVencimentoCNH) : null);
        if (this.dataVencimentoCNH && isNaN(this.dataVencimentoCNH.getTime())) {
            this.dataVencimentoCNH = null; // Garante null para datas inválidas.
        }

        // Estado inicial do veículo.
        this.velocidade = 0;
        this.ligado = false;
        /** @type {Manutencao[]} */
        this.historicoManutencao = []; // Array para armazenar instâncias de Manutencao.
    }

    // --- Ações Comuns ---

    /**
     * Liga o veículo, se estiver desligado.
     * Atualiza o estado `ligado`, toca som e atualiza a UI.
     * @returns {void}
     */
    ligar() {
        if (!this.ligado) {
            this.ligado = true;
            this.tocarSom('som-ligar');
            this.atualizarInformacoesUI("Ligou"); // Informa a origem para debug/log.
        }
    }

    /**
     * Desliga o veículo, se estiver ligado.
     * Atualiza o estado `ligado`, zera a `velocidade`, toca som e atualiza a UI.
     * @returns {void}
     */
    desligar() {
        if (this.ligado) {
            this.ligado = false;
            this.velocidade = 0; // Ao desligar, o carro para.
            this.tocarSom('som-desligar');
            this.atualizarInformacoesUI("Desligou");
        }
    }

    /**
     * Aumenta a velocidade do veículo, se ligado e abaixo do limite (200 km/h para CarroBase).
     * Toca som e atualiza a UI. Notifica se desligado.
     * Este método pode ser sobrescrito por subclasses (polimorfismo).
     * @returns {void}
     */
    acelerar() {
        if (this.ligado) {
            const VELOCIDADE_MAXIMA_BASE = 200;
            this.velocidade = Math.min(this.velocidade + 10, VELOCIDADE_MAXIMA_BASE);
            this.tocarSom('som-acelerar');
            this.atualizarInformacoesUI("Acelerou");
        } else {
            this.notificarUsuario(`Ligue o ${this.modelo} para acelerar!`);
        }
    }

    /**
     * Diminui a velocidade do veículo, se estiver em movimento (velocidade > 0).
     * Toca som e atualiza a UI. Velocidade mínima é 0.
     * @returns {void}
     */
    frear() {
        if (this.velocidade > 0) {
            this.velocidade = Math.max(this.velocidade - 15, 0); // Garante que não fique negativa.
            this.tocarSom('som-frear');
            this.atualizarInformacoesUI("Freou");
        }
    }

    /**
     * Aciona a buzina do veículo (toca som e loga no console).
     * @returns {void}
     */
    buzinar() {
        this.tocarSom('som-buzinar');
        console.log(`Veículo ${this.id} (${this.modelo}) buzinou.`);
    }

    // --- Manutenção ---

    /**
     * Adiciona um registro de manutenção ao histórico do veículo.
     * Valida a manutenção, adiciona ao array, reordena (mais recentes/futuras primeiro),
     * salva a garagem no LocalStorage e atualiza a UI.
     * @param {Manutencao} m - A instância de Manutencao a ser adicionada.
     * @returns {boolean} `true` se adicionado com sucesso, `false` caso contrário (ex: dados inválidos).
     */
    adicionarManutencao(m) {
        // Valida a instância recebida.
        if (!(m instanceof Manutencao && m.validar())) {
            this.notificarUsuario("Dados da manutenção inválidos. Verifique data e tipo.");
            return false;
        }
        // Garante que historicoManutencao é um array.
        if (!Array.isArray(this.historicoManutencao)) {
            this.historicoManutencao = [];
        }
        this.historicoManutencao.push(m);
        // Reordena: Manutenções futuras vêm primeiro, depois as passadas mais recentes.
        this.historicoManutencao.sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));

        // Efeitos colaterais importantes:
        salvarGaragem(); // Persiste a mudança.
        this.atualizarInformacoesUI("Manut Adicionada"); // Atualiza a view deste veículo.
        atualizarExibicaoAgendamentosFuturos(); // Atualiza a lista global de agendamentos.
        return true;
    }

    /**
     * Obtém o histórico de manutenções formatado, separado entre passadas e futuras.
     * Útil para exibição na UI.
     * @returns {{passadas: string[], futuras: string[]}} Objeto com arrays de strings formatadas.
     */
    getHistoricoManutencaoFormatado() {
        const agora = new Date();
        // Filtra apenas manutenções válidas antes de processar.
        const histValido = (this.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.data instanceof Date && !isNaN(m.data.getTime()));

        // Separa e formata usando os métodos apropriados de Manutencao.
        const passadas = histValido.filter(m => m.data <= agora).map(m => m.formatar());
        const futuras = histValido.filter(m => m.data > agora).map(m => m.formatarComHora());

        return { passadas, futuras };
    }

    /**
     * Remove TODOS os registros de manutenção deste veículo.
     * Salva a alteração no LocalStorage e atualiza a UI. Ação irreversível para este veículo.
     * @returns {void}
     */
    limparHistoricoManutencao() {
        this.historicoManutencao = [];
        // Efeitos colaterais:
        salvarGaragem();
        this.atualizarInformacoesUI("Hist Limpo");
        atualizarExibicaoAgendamentosFuturos(); // Atualiza a lista geral.
    }

    // --- UI e Métodos Auxiliares ---

    /**
     * Atualiza a seção de exibição no HTML (`#veiculo-display-area`) com os dados ATUAIS desta instância.
     * **Importante:** Só executa a atualização se o `data-veiculo-id` da área de display corresponder ao `id` deste veículo.
     * Contém lógica para atualizar título, imagem, status, velocidade, placa, ano, infos extras (turbo/carga), CNH, velocímetro, histórico, e campos de edição.
     * @param {string} [origem="Desconhecida"] - String opcional para identificar o gatilho da atualização (ajuda no debugging).
     * @returns {void}
     */
    atualizarInformacoesUI(origem = "Desconhecida") {
        const displayArea = document.getElementById('veiculo-display-area');
        // Condição crucial: só atualiza se este for o veículo ativo na UI.
        if (!displayArea || displayArea.dataset.veiculoId !== this.id) {
            return;
        }

        // Mini-funções auxiliares para simplificar manipulação do DOM dentro do escopo da displayArea.
        const getEl = (sel) => displayArea.querySelector(sel);
        const setTxt = (sel, txt) => { const el = getEl(sel); if (el) el.textContent = txt; };
        const setHtml = (sel, html) => { const el = getEl(sel); if (el) el.innerHTML = html; };
        const setCls = (sel, base, st) => { const el = getEl(sel); if (el) el.className = `${base} ${st}`; };
        const setImg = (sel, src, alt) => {
            const el = getEl(sel);
            if (el) {
                el.src = src || 'default_car.png'; // Fallback para imagem padrão.
                el.alt = alt || `Imagem ${this.modelo}`;
                // Tratamento de erro para imagem quebrada (importante para Base64 inválido/longo ou paths errados).
                el.onerror = () => {
                    if (el.src !== 'default_car.png') { // Evita loop se a default falhar.
                        console.warn(`Falha ao carregar ${src}. Usando default_car.png`);
                        el.src = 'default_car.png';
                    }
                    el.onerror = null; // Remove o handler para não disparar de novo.
                };
            }
        };

        // --- Atualização dos Elementos ---
        setTxt('.veiculo-titulo', this.modelo);
        setImg('.veiculo-imagem', this.imagemSrc, `Imagem ${this.modelo}`); // Usa a propriedade imagemSrc (path ou Base64).
        setTxt('.veiculo-status', this.ligado ? "Ligado" : "Desligado");
        setCls('.veiculo-status', 'veiculo-status', this.ligado ? "status-ligado" : "status-desligado");
        setTxt('.veiculo-velocidade', this.velocidade);
        setTxt('.veiculo-placa', this.placa || '-');
        setTxt('.veiculo-ano', this.ano || '-');

        // Info extra (polimórfico: depende do tipo real da instância).
        let extraInfo = '';
        if (this instanceof CarroEsportivo) {
            extraInfo = `<span class="info-label">Turbo:</span> ${this.turboAtivado ? 'ON 🔥' : 'OFF'}`;
        } else if (this instanceof Caminhao) {
            extraInfo = `<span class="info-label">Carga:</span> ${this.cargaAtual}/${this.capacidadeCarga}kg`;
        }
        setHtml('.veiculo-info-extra', extraInfo);

        // Info CNH com checagem de vencimento.
        let cnhInfo = '<span class="info-label">Venc. CNH:</span> -';
        if (this.dataVencimentoCNH) {
            const dtVenc = this.dataVencimentoCNH;
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0); // Normaliza hoje para comparar só data.
            const diasRestantes = Math.ceil((dtVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            cnhInfo = `<span class="info-label">Venc. CNH:</span> ${dtVenc.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
            if (diasRestantes < 0) {
                cnhInfo += ' <span style="color:red;font-weight:bold;">(VENCIDA!)</span>';
            } else if (diasRestantes <= 30) {
                cnhInfo += ` <span style="color:orange;font-weight:bold;">(Vence em ${diasRestantes}d!)</span>`;
            }
        }
        setHtml('.veiculo-cnh-info', cnhInfo);

        // Atualiza velocímetro visual (barra e ponteiro).
        // Usa a velocidade máxima correta da classe (importante para subclasses).
        const maxVel = (this instanceof CarroEsportivo) ? 250 : ((this instanceof Caminhao) ? 140 : 200);
        const barra = getEl('.veiculo-barra-progresso');
        if (barra) {
            const perc = Math.min((this.velocidade / maxVel) * 100, 100);
            barra.style.width = `${perc}%`;
        }
        const ponteiro = getEl('.veiculo-ponteiro');
        if (ponteiro) {
            const angulo = Math.min((this.velocidade / maxVel) * 180, 180) - 90; // Mapeia 0..maxVel para -90..+90 graus.
            ponteiro.style.transform = `translateX(-50%) rotate(${angulo}deg)`;
        }

        // Atualiza histórico de manutenções (passadas).
        const histDiv = getEl('.lista-historico');
        if (histDiv) {
            const { passadas } = this.getHistoricoManutencaoFormatado();
            histDiv.innerHTML = passadas.length > 0 ?
                `<ul>${passadas.map(i => `<li>${i}</li>`).join('')}</ul>` :
                '<p>Nenhuma manutenção passada registrada.</p>';
        }

        // Preenche formulário de edição com os dados atuais.
        const editForm = getEl('.edicao-veiculo');
        if (editForm) {
            editForm.querySelector('.edit-modelo-veiculo').value = this.modelo;
            editForm.querySelector('.edit-cor-veiculo').value = this.cor;
            editForm.querySelector('.edit-placa-veiculo').value = this.placa;
            editForm.querySelector('.edit-ano-veiculo').value = this.ano || '';
            editForm.querySelector('.edit-cnh-veiculo').value = this.dataVencimentoCNH ? this.dataVencimentoCNH.toISOString().split('T')[0] : '';
            // Limpa preview de imagem da edição se não houver arquivo selecionado no input.
             const imgInput = editForm.querySelector('.edit-imagem-input');
             const imgPreview = editForm.querySelector('.edit-imagem-preview');
             if (imgInput && imgPreview && !imgInput.files[0]) {
                 imgPreview.src = '#';
                 imgPreview.style.display = 'none';
             }
        }
    }

    /**
     * Toca um arquivo de áudio HTML pelo ID.
     * Reinicia o áudio se já estiver tocando e trata erros comuns de reprodução.
     * @param {string} id - O ID do elemento `<audio>` no HTML.
     * @returns {void}
     */
    tocarSom(id) {
        const audio = document.getElementById(id);
        if (audio) {
            audio.currentTime = 0; // Permite repetição rápida.
            audio.play().catch(e => console.warn(`Erro ao tocar audio ${id}: ${e.message}`)); // Erro comum: interação do usuário necessária.
        }
    }

    /**
     * Exibe uma mensagem de alerta simples para o usuário, prefixada com o modelo do veículo.
     * @param {string} msg - A mensagem a ser exibida.
     * @returns {void}
     */
    notificarUsuario(msg) {
        alert(`${this.modelo}: ${msg}`); // Simples `alert` para feedback rápido.
    }

    /**
     * Converte o estado atual do veículo para um objeto JSON serializável.
     * Inclui um campo `tipoVeiculo` para permitir recriar a instância da classe correta ao carregar do LocalStorage.
     * Também serializa o histórico de manutenção.
     * @returns {object} Um objeto simples representando o veículo, pronto para `JSON.stringify`.
     */
    toJSON() {
        // Serializa o histórico, garantindo que apenas manutenções válidas sejam incluídas.
        const histSerializado = (this.historicoManutencao || [])
            .filter(m => m instanceof Manutencao && m.validar())
            .map(m => m.toJSON())
            .filter(mJson => mJson !== null); // Remove nulos (datas inválidas em Manutencao).

        // Determina o tipo da classe dinamicamente para reconstrução.
        let tipoVeiculo = 'CarroBase';
        if (this instanceof CarroEsportivo) tipoVeiculo = 'CarroEsportivo';
        else if (this instanceof Caminhao) tipoVeiculo = 'Caminhao';

        // Objeto base com dados comuns.
        const data = {
            id: this.id,
            modelo: this.modelo,
            cor: this.cor,
            placa: this.placa,
            ano: this.ano,
            dataVencimentoCNH: this.dataVencimentoCNH?.toISOString() || null, // Salva como ISO string ou null.
            velocidade: this.velocidade,
            ligado: this.ligado,
            imagemSrc: this.imagemSrc, // Salva path ou Base64.
            tipoVeiculo: tipoVeiculo, // Crucial para recarregar a classe correta!
            historicoManutencao: histSerializado
        };

        // Adiciona propriedades específicas das subclasses.
        if (tipoVeiculo === 'CarroEsportivo') {
            data.turboAtivado = this.turboAtivado;
        } else if (tipoVeiculo === 'Caminhao') {
            data.capacidadeCarga = this.capacidadeCarga;
            data.cargaAtual = this.cargaAtual;
        }
        return data;
    }
}

