
// ==================================================
//      GERENCIAMENTO DA GARAGEM & PERSISTÊNCIA (LocalStorage)
// ==================================================

/**
 * Armazena o estado da garagem, mapeando IDs de veículo para suas instâncias.
 * @type {Object.<string, CarroBase>}
 */
let garagem = {};

/**
 * Chave única usada no LocalStorage para armazenar/recuperar os dados da garagem.
 * A versão na chave ajuda a evitar conflitos com dados antigos.
 * @const {string}
 */
const GARAGEM_KEY = 'garagemData_v6_add';

/**
 * Salva o estado atual da `garagem` (em memória) no LocalStorage.
 * Serializa todo o objeto `garagem` para JSON.
 * **Crucial:** Inclui tratamento para `QuotaExceededError`, comum ao salvar imagens Base64 grandes.
 * @returns {boolean} `true` se salvou com sucesso, `false` se houve erro (ex: quota excedida).
 */
function salvarGaragem() {
    try {
        // Os objetos veículo são convertidos usando seus métodos toJSON() implicitamente pelo stringify.
        localStorage.setItem(GARAGEM_KEY, JSON.stringify(garagem));
        console.log(`Garagem salva no LocalStorage (Chave: ${GARAGEM_KEY}).`);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error("ERRO DE QUOTA AO SALVAR: LocalStorage cheio! Provavelmente devido a imagens grandes.");
            alert("ERRO CRÍTICO AO SALVAR!\n\nO armazenamento local está cheio (provavelmente por causa de uma imagem grande).\nAs últimas alterações NÃO FORAM SALVAS.\n\nConsidere usar imagens menores ou remover itens.");
        } else {
            console.error("Erro inesperado ao salvar garagem:", e);
            alert("Ocorreu um erro inesperado ao salvar os dados da garagem.");
        }
        return false; // Indica falha no salvamento.
    }
}

/**
 * Carrega os dados da garagem do LocalStorage para a variável `garagem`.
 * Desserializa o JSON, recria as instâncias das classes corretas (`CarroBase`, `CarroEsportivo`, `Caminhao`)
 * usando o campo `tipoVeiculo`, e recria as instâncias de `Manutencao`.
 * Se falhar ou não houver dados, chama `inicializarVeiculosPadrao`.
 * Ao final, chama `atualizarInterfaceCompleta`.
 * @returns {void}
 */
function carregarGaragem() {
    const dataJSON = localStorage.getItem(GARAGEM_KEY);
    garagem = {}; // Reseta a garagem em memória antes de carregar.
    let carregouOk = false;

    if (dataJSON) {
        try {
            const garagemData = JSON.parse(dataJSON);
            for (const id in garagemData) {
                const d = garagemData[id]; // Dados do veículo individual do JSON.
                // Validação mínima dos dados essenciais para recriar o objeto.
                if (!d?.id || !d?.modelo || !d?.tipoVeiculo) {
                    console.warn(`Dados inválidos/incompletos para ID ${id} no LocalStorage. Pulando.`);
                    continue;
                }

                let veiculoInstance;
                // Recria o histórico de manutenção primeiro.
                const histRecriado = (d.historicoManutencao || [])
                    .map(m => (!m?.data || !m?.tipo) ? null : new Manutencao(m.data, m.tipo, m.custo, m.descricao))
                    .filter(m => m && m.validar()); // Garante que só manutenções válidas sejam carregadas.

                try {
                    // Argumentos comuns para os construtores das classes de veículo.
                    const args = [d.id, d.modelo, d.cor, d.imagemSrc, d.placa, d.ano, d.dataVencimentoCNH];
                    // Usa o 'tipoVeiculo' salvo para instanciar a classe correta (Polimorfismo na desserialização).
                    switch (d.tipoVeiculo) {
                        case 'CarroEsportivo':
                            veiculoInstance = new CarroEsportivo(...args);
                            veiculoInstance.turboAtivado = d.turboAtivado || false;
                            break;
                        case 'Caminhao':
                            // Adiciona capacidade de carga e carga atual para Caminhao.
                            veiculoInstance = new Caminhao(...args, d.capacidadeCarga || 0);
                            veiculoInstance.cargaAtual = d.cargaAtual || 0;
                            break;
                        default: // Inclui 'CarroBase' ou tipos desconhecidos.
                            veiculoInstance = new CarroBase(...args);
                            break;
                    }
                    // Restaura estado e histórico.
                    veiculoInstance.velocidade = d.velocidade || 0;
                    veiculoInstance.ligado = d.ligado || false;
                    veiculoInstance.historicoManutencao = histRecriado;
                    garagem[id] = veiculoInstance; // Adiciona a instância recriada à garagem em memória.

                } catch (creationError) {
                    console.error(`Erro crítico ao recriar instância do veículo ${id}. Pulando.`, creationError, d);
                }
            }
            console.log("Garagem carregada do LocalStorage.");
            carregouOk = true;
        } catch (e) {
            console.error("Erro ao parsear ou processar dados da garagem do LocalStorage:", e);
            alert("Erro ao carregar dados salvos. Resetando para garagem padrão.");
            localStorage.removeItem(GARAGEM_KEY); // Remove dados corrompidos.
            garagem = {}; // Garante que a garagem está vazia.
        }
    }

    // Se não carregou OK (sem dados ou erro), inicializa com padrão.
    if (!carregouOk) {
        console.log("Nenhum dado válido encontrado ou erro. Inicializando com veículos padrão.");
        inicializarVeiculosPadrao(); // Cria e tenta salvar os padrões.
    } else {
        // Se carregou, atualiza a UI.
        atualizarInterfaceCompleta();
    }
}

/**
 * Inicializa a `garagem` com veículos de exemplo se o LocalStorage estiver vazio ou corrompido.
 * Tenta salvar essa garagem padrão no LocalStorage.
 * Chama `atualizarInterfaceCompleta` no final.
 * @returns {void}
 */
function inicializarVeiculosPadrao() {
    garagem = {}; // Garante que começa vazia.
    try {
        console.log("Criando veículos padrão...");
        // Instancia os veículos padrão.
        garagem['carro1'] = new CarroBase("carro1", "Fusca", "Azul", "default_car.png", "ABC1234", 1975, "2024-12-31");
        garagem['carro2'] = new CarroEsportivo("carro2", "Maverick", "Laranja", "default_sport.png", "DEF5678", 1974, "2025-06-01");
        garagem['cam1'] = new Caminhao("cam1", "Scania 113", "Vermelho", "default_truck.png", "GHI9012", 1995, "2023-01-10", 20000); // CNH vencida.

        // Adiciona manutenções de exemplo.
        garagem['carro1']?.adicionarManutencao(new Manutencao('2023-11-15', 'Troca Pneu', 250)); // AdicionarManutencao já salva.
        garagem['cam1']?.adicionarManutencao(new Manutencao('2024-01-10', 'Revisão Motor', 1200, 'Fumaça estranha'));

        console.log("Veículos padrão criados em memória.");
        // Tenta salvar esta configuração inicial.
        if (!salvarGaragem()) { // salvarGaragem() já foi chamado por adicionarManutencao, mas chamamos de novo para garantir.
            console.warn("Falha ao salvar a garagem padrão inicial (pode ser erro de quota já na inicialização).");
        }
    } catch (e) {
        console.error("Erro crítico ao inicializar veículos padrão:", e);
        alert("Erro grave ao criar veículos padrão.");
        garagem = {}; // Reseta em caso de erro grave.
    }
    // Atualiza a UI com os veículos padrão (mesmo que salvar tenha falhado).
    atualizarInterfaceCompleta();
}


// ==================================================
//      ATUALIZAÇÃO DA INTERFACE GERAL (UI)
// ==================================================

/**
 * Atualiza todos os componentes principais da interface (menu, display, alertas).
 * Chamado após carregar, adicionar, excluir ou realizar ações que mudam o estado geral.
 * Garante que a UI reflita o estado atual da `garagem`.
 * @returns {void}
 */
function atualizarInterfaceCompleta() {
    console.log("Atualizando interface completa...");
    atualizarMenuVeiculos();                // Recria botões de seleção.
    atualizarExibicaoAgendamentosFuturos(); // Atualiza lista geral de agendamentos.
    verificarVencimentoCNH();               // Mostra/esconde alertas de CNH.
    verificarAgendamentosProximos();        // Mostra/esconde alertas de manutenção.

    // Decide o que exibir na área principal.
    const veiculosIds = Object.keys(garagem);
    const displayArea = document.getElementById('veiculo-display-area');
    const idVeiculoAtual = displayArea?.dataset.veiculoId;

    if (veiculosIds.length === 0) {
        limparAreaDisplay(true); // Garagem vazia.
    } else {
        // Se um veículo estava selecionado e ainda existe, re-renderiza/atualiza ele.
        if (idVeiculoAtual && garagem[idVeiculoAtual]) {
             marcarBotaoAtivo(idVeiculoAtual); // Garante botão ativo.
             garagem[idVeiculoAtual].atualizarInformacoesUI("Atualização Completa");
        } else {
             // Se nenhum selecionado ou o selecionado foi removido, exibe o primeiro da lista.
             const primeiroId = veiculosIds[0];
             marcarBotaoAtivo(primeiroId);
             renderizarVeiculo(primeiroId);
        }
    }
    console.log("Interface completa atualizada.");
}

/**
 * Limpa a área de exibição do veículo (`#veiculo-display-area`).
 * Exibe uma mensagem placeholder apropriada (garagem vazia ou selecione um veículo).
 * @param {boolean} [mostrarMsgGaragemVazia=false] - Se true, mostra msg "Garagem vazia".
 * @returns {void}
 */
function limparAreaDisplay(mostrarMsgGaragemVazia = false) {
    const displayArea = document.getElementById('veiculo-display-area');
    if (displayArea) {
        const msg = mostrarMsgGaragemVazia ?
            '<div class="placeholder">Garagem vazia. Adicione um veículo!</div>' :
            '<div class="placeholder">Selecione um veículo no menu acima.</div>';
        displayArea.innerHTML = msg;
        delete displayArea.dataset.veiculoId; // Remove ID associado à área.
    }
}

/**
 * Atualiza o menu de botões (`#menu-veiculos`) com um botão para cada veículo na `garagem`.
 * Adiciona event listener a cada botão para selecionar e renderizar o veículo correspondente.
 * @returns {void}
 */
function atualizarMenuVeiculos() {
    const menu = document.getElementById('menu-veiculos');
    if (!menu) return;
    menu.innerHTML = ''; // Limpa botões antigos.
    const ids = Object.keys(garagem);

    if (ids.length === 0) {
        menu.innerHTML = '<span>Garagem vazia.</span>';
        return;
    }

    ids.forEach(id => {
        const v = garagem[id];
        if (v) { // Checagem extra.
            const btn = document.createElement('button');
            btn.textContent = v.modelo;
            btn.dataset.veiculoId = id; // Guarda ID no botão.
            btn.title = `${v.modelo} (${v.placa || 'S/P'}) - ${v.ano || '?'}`; // Tooltip.
            btn.addEventListener('click', () => {
                marcarBotaoAtivo(id); // Marca visualmente como ativo.
                renderizarVeiculo(id); // Exibe os detalhes.
            });
            menu.appendChild(btn);
        }
    });
}

/**
 * Marca visualmente qual botão no menu de veículos está ativo.
 * Remove a classe 'veiculo-ativo' de todos e a adiciona apenas ao botão do ID fornecido.
 * @param {string} id - O ID do veículo cujo botão deve ser ativado.
 * @returns {void}
 */
function marcarBotaoAtivo(id) {
    document.querySelectorAll('#menu-veiculos button').forEach(b => {
        b.classList.toggle('veiculo-ativo', b.dataset.veiculoId === id);
    });
}


// ==================================================
//       RENDERIZAÇÃO DINÂMICA DO VEÍCULO (usando Template)
// ==================================================

/**
 * Renderiza os detalhes e controles de um veículo específico na área de display (`#veiculo-display-area`).
 * Usa o template HTML `#veiculo-template`, clona seu conteúdo, configura todos os event listeners
 * específicos para as ações do veículo (ligar, acelerar, editar, agendar, etc.) e insere no DOM.
 * Finalmente, chama `atualizarInformacoesUI` do veículo para preencher os dados.
 * @param {string} veiculoId - O ID do veículo na `garagem` a ser renderizado.
 * @returns {void}
 */
function renderizarVeiculo(veiculoId) {
    const veiculo = garagem[veiculoId];
    const displayArea = document.getElementById('veiculo-display-area');
    const template = document.getElementById('veiculo-template');

    // Validações cruciais antes de prosseguir.
    if (!veiculo || !displayArea || !template || !(template instanceof HTMLTemplateElement)) {
        console.error(`Erro ao tentar renderizar ${veiculoId}: Veículo, área de display ou template inválido(s).`);
        limparAreaDisplay(true); // Limpa a área mostrando msg de erro/vazio.
        return;
    }

    console.log(`Renderizando veículo: ${veiculo.modelo} (ID: ${veiculoId})`);

    // Clona o conteúdo do template para criar um novo fragmento de DOM.
    const clone = template.content.cloneNode(true);
    const container = clone.querySelector('.veiculo-renderizado'); // Container principal dentro do template.
    if (!container) {
         console.error("Estrutura do #veiculo-template inválida: .veiculo-renderizado não encontrado.");
         return;
    }

    // --- Adiciona Listeners ESPECÍFICOS para este veículo DENTRO do clone ---
    // Botões de Ação (Ligar, Acelerar, Frear, Buzinar - não Turbo/Carga aqui)
    container.querySelectorAll('.acoes-veiculo button[data-acao]').forEach(btn => {
        const acao = btn.dataset.acao;
        // Só adiciona listener se for ação genérica manipulada por 'interagir'
        if (acao && !['ativarTurbo', 'carregar'].includes(acao)) {
             btn.addEventListener('click', () => interagirVeiculoAtual(acao));
        }
    });
    // Botões Específicos (Excluir, Salvar Edição, Limpar Histórico)
    container.querySelector('.btn-excluir-veiculo')?.addEventListener('click', () => handleExcluirVeiculo(veiculoId));
    container.querySelector('.salvar-veiculo-btn')?.addEventListener('click', () => handleSalvarEdicaoVeiculo(veiculoId));
    container.querySelector('.btn-limpar-historico')?.addEventListener('click', () => handleLimparHistorico(veiculoId));
    // Formulário de Agendamento
    container.querySelector('.form-agendamento')?.addEventListener('submit', (e) => handleAgendarManutencao(e, veiculoId));

    // Listener para Preview de Imagem na Edição
    const editImgInput = container.querySelector('.edit-imagem-input');
    const editImgPreview = container.querySelector('.edit-imagem-preview');
    if (editImgInput && editImgPreview) {
        editImgInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => { // Mostra preview da imagem selecionada (Base64).
                    editImgPreview.src = e.target.result;
                    editImgPreview.style.display = 'block';
                };
                reader.onerror = () => { // Limpa em caso de erro de leitura.
                     editImgPreview.src = '#'; editImgPreview.style.display = 'none';
                     console.error("Erro lendo arquivo de imagem para preview.");
                 };
                reader.readAsDataURL(file); // Lê como Base64.
            } else { // Limpa preview se arquivo inválido ou removido.
                editImgPreview.src = '#'; editImgPreview.style.display = 'none';
            }
        });
    }

    // Configura Ações Específicas (Turbo/Carga) dinamicamente
    const acaoExtraEl = container.querySelector('.acao-extra');
    if (acaoExtraEl) {
        acaoExtraEl.innerHTML = ''; // Limpa ações extras anteriores.
        if (veiculo instanceof CarroEsportivo) {
            // Adiciona botão Turbo
            const btn = document.createElement('button');
            btn.dataset.acao = 'ativarTurbo';
            btn.textContent = 'Turbo'; // O estado ON/OFF será mostrado na info geral
            btn.addEventListener('click', () => interagirVeiculoAtual('ativarTurbo'));
            acaoExtraEl.appendChild(btn);
        } else if (veiculo instanceof Caminhao) {
            // Adiciona input e botão Carregar
            const div = document.createElement('div');
            div.className = 'carga-container';
            // Usar ID único para o label/input é boa prática, mas aqui simplificado
            div.innerHTML = `<label>Carga(kg):</label><input type="number" min="1" class="carga-input" placeholder="Peso"><button data-acao="carregar">Carregar</button>`;
            const cargaBtn = div.querySelector('button[data-acao="carregar"]');
            const inputCarga = div.querySelector('input.carga-input');
            if (cargaBtn && inputCarga) {
                // Listener passa o INPUT como argumento extra para pegar o valor.
                cargaBtn.addEventListener('click', () => interagirVeiculoAtual('carregar', inputCarga));
                // Opcional: Enter no input também carrega.
                 inputCarga.addEventListener('keypress', (e) => { if(e.key === 'Enter') interagirVeiculoAtual('carregar', inputCarga); });
            }
            acaoExtraEl.appendChild(div);
        }
    }

    // --- Finaliza a Renderização ---
    displayArea.innerHTML = ''; // Limpa conteúdo antigo da área de display.
    displayArea.appendChild(clone); // Adiciona o novo conteúdo renderizado.
    displayArea.dataset.veiculoId = veiculoId; // Associa o ID do veículo à área.

    // Chama a atualização da UI do próprio veículo para preencher os dados iniciais.
    veiculo.atualizarInformacoesUI("Renderização Completa");
}


// ==================================================
//       INTERAÇÃO COM O VEÍCULO ATUALMENTE EXIBIDO
// ==================================================

/**
 * Função auxiliar que identifica o veículo atualmente exibido na UI e chama `interagir` para ele.
 * Usada pelos botões de ação dentro do template renderizado.
 * Trata o caso especial da ação 'carregar', que precisa do valor do input associado.
 * @param {string} acao - A ação a ser executada (ex: 'ligar', 'carregar').
 * @param {HTMLInputElement} [extraElement=null] - Elemento extra (ex: input de carga) necessário para a ação.
 * @returns {void}
 */
function interagirVeiculoAtual(acao, extraElement = null) {
    const displayArea = document.getElementById('veiculo-display-area');
    const veiculoId = displayArea?.dataset.veiculoId; // Pega ID do veículo ativo na UI.

    if (veiculoId && garagem[veiculoId]) { // Verifica se ID e veículo existem.
        // Tratamento especial para 'carregar': pega valor do input e limpa-o.
        if (acao === 'carregar' && extraElement instanceof HTMLInputElement) {
            const valor = extraElement.value;
            interagir(veiculoId, acao, valor); // Passa o valor como argumento.
            extraElement.value = ''; // Limpa o input após a ação.
        } else {
            // Outras ações são chamadas sem argumento extra.
            interagir(veiculoId, acao);
        }
    } else {
        console.warn("Nenhum veículo selecionado para interação.");
        alert("Selecione um veículo primeiro.");
    }
}

/**
 * Centraliza a execução de ações em um veículo específico.
 * Recebe o ID do veículo, a ação e um argumento opcional, e chama o método correspondente na instância do veículo.
 * Usa `instanceof` para direcionar ações específicas de subclasses (Turbo, Carga).
 * @param {string} veiculoId - O ID do veículo alvo.
 * @param {string} acao - A string identificadora da ação (ex: 'ligar', 'ativarTurbo').
 * @param {any} [arg=null] - Argumento adicional para a ação (ex: peso para 'carregar').
 * @returns {void}
 */
function interagir(veiculoId, acao, arg = null) {
    const v = garagem[veiculoId];
    if (!v) { // Validação.
        alert(`Veículo ${veiculoId} não encontrado para a ação ${acao}.`);
        return;
    }
    console.log(`Interagir: Ação=${acao}, Veículo=${veiculoId} (${v.modelo}), Arg=${arg}`);
    try {
        // Switch para direcionar a ação ao método correto.
        switch (acao) {
            case 'ligar': v.ligar(); break;
            case 'desligar': v.desligar(); break;
            case 'acelerar': v.acelerar(); break; // Chama método polimórfico.
            case 'frear': v.frear(); break;
            case 'buzinar': v.buzinar(); break;
            // Ações específicas de subclasses:
            case 'ativarTurbo':
                if (v instanceof CarroEsportivo) v.ativarTurbo();
                else v.notificarUsuario("Ação 'Turbo' apenas para Carros Esportivos.");
                break;
            case 'carregar':
                if (v instanceof Caminhao) v.carregar(arg); // Passa o argumento (peso).
                else v.notificarUsuario("Ação 'Carregar' apenas para Caminhões.");
                break;
            default:
                console.warn(`Ação desconhecida ou não manipulada por 'interagir': ${acao}`);
        }
        // Nota: A atualização da UI e salvamento (se necessário) são geralmente
        // responsabilidades dos métodos da classe do veículo ou dos handlers de evento maiores.
    } catch (e) {
        console.error(`Erro ao executar ação '${acao}' no veículo ${veiculoId}:`, e);
        // alert(`Erro ao ${acao}.`); // Evitar muitos alertas.
    }
}


// ==================================================
//          HANDLERS DE EVENTOS GLOBAIS / FORMULÁRIOS
// ==================================================

/**
 * Handler para clique nos botões de navegação por abas.
 * Alterna a visibilidade das seções principais e a classe 'ativa' nas abas.
 * @param {string} abaId - ID do botão da aba clicada ('tab-garagem' ou 'tab-adicionar').
 * @returns {void}
 */
function handleTrocarAba(abaId) {
    document.querySelectorAll('.secao-principal').forEach(s => s.classList.remove('ativa'));
    document.querySelectorAll('#abas-navegacao button').forEach(b => b.classList.remove('aba-ativa'));
    const secaoId = abaId === 'tab-garagem' ? 'secao-garagem' : 'secao-adicionar';
    document.getElementById(secaoId)?.classList.add('ativa');
    document.getElementById(abaId)?.classList.add('aba-ativa');
}

/**
 * Handler para o submit do formulário de adicionar novo veículo.
 * Coleta dados, valida, cria a instância da classe correta, adiciona à `garagem`,
 * tenta salvar no LocalStorage, e atualiza a UI (limpa form, troca aba, renderiza novo).
 * **Importante:** Não processa upload de imagem ao adicionar nesta versão (usa padrão).
 * @param {Event} event - O objeto do evento submit.
 * @returns {void}
 */
function handleAdicionarVeiculo(event) {
    event.preventDefault(); // Impede recarregamento da página.
    const form = event.target;
    // Coleta dados do formulário.
    const mod = form.querySelector('#add-modelo').value.trim();
    const cor = form.querySelector('#add-cor').value.trim();
    const plc = form.querySelector('#add-placa').value.trim().toUpperCase();
    const ano = form.querySelector('#add-ano').value;
    const tipo = form.querySelector('#add-tipo').value;
    const capIn = form.querySelector('#add-capacidade-carga');
    const capCg = (tipo === 'Caminhao' && capIn) ? capIn.value : 0;
    const dtCnh = form.querySelector('#add-cnh').value; // String YYYY-MM-DD ou vazia.

    if (!mod || !tipo) { // Validação básica.
        alert("Modelo e Tipo são obrigatórios!");
        return;
    }
    const nId = `v${Date.now()}`; // ID simples baseado em timestamp.
    // Define imagem padrão baseada no tipo (upload não implementado aqui).
    let imgP = tipo === 'CarroEsportivo' ? 'default_sport.png' : (tipo === 'Caminhao' ? 'default_truck.png' : 'default_car.png');
    let nV; // Nova instância do veículo.

    try {
        const args = [nId, mod, cor, imgP, plc, ano, dtCnh || null]; // Argumentos comuns.
        // Cria instância da classe correta.
        switch (tipo) {
            case 'CarroEsportivo': nV = new CarroEsportivo(...args); break;
            case 'Caminhao': nV = new Caminhao(...args, capCg); break;
            default: nV = new CarroBase(...args); break;
        }
        garagem[nId] = nV; // Adiciona à garagem em memória.

        // Tenta persistir a mudança.
        if (salvarGaragem()) {
            // Sucesso: Atualiza UI e dá feedback.
            atualizarMenuVeiculos();
            form.reset(); // Limpa o formulário.
            document.getElementById('add-capacidade-carga-container').style.display = 'none';
            const addPreview = document.getElementById('add-imagem-preview');
             if(addPreview) { addPreview.src='#'; addPreview.style.display='none'; } // Limpa preview.
            handleTrocarAba('tab-garagem'); // Volta para a garagem.
            marcarBotaoAtivo(nId); // Marca o novo veículo.
            renderizarVeiculo(nId); // Exibe o novo veículo.
            alert(`Veículo "${mod}" adicionado com sucesso!`);
        } else {
            // Falha ao salvar (ex: quota): Desfaz a adição em memória para manter consistência.
            delete garagem[nId];
            // O alerta de erro já foi dado por salvarGaragem().
        }
    } catch (e) {
        console.error("Erro ao criar ou adicionar veículo:", e);
        alert("Erro ao adicionar veículo. Verifique os dados.");
        if (garagem[nId]) delete garagem[nId]; // Garante remoção em caso de erro.
    }
}

/**
 * Handler para o botão "Salvar Edições" do veículo exibido.
 * Coleta dados do form de edição, atualiza o objeto `veiculo` correspondente.
 * **Tratamento especial para imagem:** Se uma nova imagem for selecionada no input,
 * lê como Base64, atualiza `veiculo.imagemSrc` e **tenta** salvar.
 * Se `salvarGaragem` falhar (provavelmente quota), **reverte** a `imagemSrc` para a anterior
 * para evitar estado inconsistente e informa o usuário. Salva outras alterações se a imagem não mudou ou não foi a causa da falha.
 * @param {string} veiculoId - ID do veículo sendo editado.
 * @returns {void}
 */
function handleSalvarEdicaoVeiculo(veiculoId) {
    const v = garagem[veiculoId]; // Veículo alvo.
    const display = document.getElementById('veiculo-display-area');
    // Validações.
    if (!v || !display || display.dataset.veiculoId !== v.id) { alert("Erro interno ao salvar edição."); return; }
    const form = display.querySelector('.edicao-veiculo');
    if (!form) { alert("Erro interno: Formulário de edição não encontrado."); return; }

    console.log(`Salvando edições para ${veiculoId}`);
    let mudou = false; // Flag para detectar se alguma alteração foi feita.

    // Coleta e compara dados de texto/data.
    const nMod = form.querySelector('.edit-modelo-veiculo').value.trim();
    const nCor = form.querySelector('.edit-cor-veiculo').value.trim();
    const nPla = form.querySelector('.edit-placa-veiculo').value.trim().toUpperCase();
    const nAno = parseInt(form.querySelector('.edit-ano-veiculo').value) || null;
    const nCnhS = form.querySelector('.edit-cnh-veiculo').value; // YYYY-MM-DD
    // Converte string para Date (UTC para consistência) ou null.
    let nCnhD = nCnhS ? new Date(nCnhS + 'T00:00:00Z') : null;
    if (nCnhD && isNaN(nCnhD.getTime())) nCnhD = null; // Invalida se conversão falhar.

    // Atualiza propriedades do objeto se houver mudança.
    if (nMod && v.modelo !== nMod) { v.modelo = nMod; mudou = true; }
    if (v.cor !== nCor) { v.cor = nCor; mudou = true; }
    if (v.placa !== nPla) { v.placa = nPla; mudou = true; }
    if (v.ano !== nAno) { v.ano = nAno; mudou = true; }
    // Compara datas pelo timestamp (funciona com null/Date).
    if (v.dataVencimentoCNH?.getTime() !== nCnhD?.getTime()) { v.dataVencimentoCNH = nCnhD; mudou = true; }

    // --- Processamento da Imagem ---
    const imagemInput = form.querySelector('.edit-imagem-input');
    const file = imagemInput?.files[0]; // Pega o arquivo selecionado (se houver).

    // Função para limpar input e preview após sucesso ou cancelamento.
    const limparCamposImagemEdicao = () => {
         if(imagemInput) imagemInput.value = ''; // Limpa seleção de arquivo.
         const p = form.querySelector('.edit-imagem-preview');
         if(p){ p.src='#'; p.style.display='none'; }
    };

    // 1. Se UMA NOVA IMAGEM FOI SELECIONADA:
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = function(e) { // Callback quando a leitura terminar.
            const novaImagemBase64 = e.target.result;
            // Só processa se a imagem for realmente diferente da atual.
            if (v.imagemSrc !== novaImagemBase64) {
                const imagemAntiga = v.imagemSrc; // Guarda para possível rollback.
                v.imagemSrc = novaImagemBase64;   // ATUALIZA o objeto com a nova imagem (Base64).
                mudou = true;
                console.log(`Imagem ${veiculoId} atualizada em memória (Base64). Tentando salvar...`);
                // TENTA SALVAR TUDO (incluindo a nova imagem).
                if (salvarGaragem()) {
                    // SUCESSO AO SALVAR COM NOVA IMAGEM.
                    v.atualizarInformacoesUI("Edição Salva c/ Img");
                    atualizarMenuVeiculos(); // Atualiza menu se modelo mudou.
                    verificarVencimentoCNH(); // Reavalia alertas CNH.
                    alert("Alterações (incluindo imagem) salvas!");
                    limparCamposImagemEdicao(); // Limpa após sucesso.
                } else {
                    // FALHA AO SALVAR (provavelmente Quota Excedida pela imagem).
                    console.warn("Falha ao salvar garagem após atualizar imagem. Revertendo imagem...");
                    v.imagemSrc = imagemAntiga; // *** REVERTE A IMAGEM no objeto ***
                    mudou = false; // Considera que a operação como um todo falhou neste ponto.
                    v.atualizarInformacoesUI("Falha Salvar Img"); // Atualiza UI para refletir reversão.
                    // O alerta sobre a falha já foi dado por salvarGaragem().
                    // Não limpa o input aqui, pode ter sido erro temporário ou o usuário quer tentar de novo.
                }
            } else if (mudou) { // Imagem igual, mas outros campos mudaram.
                if (salvarGaragem()) { /*...*/ } // Lógica como abaixo.
                 limparCamposImagemEdicao();
            } else { // Imagem igual, nada mais mudou.
                 alert("Nenhuma alteração detectada.");
                 limparCamposImagemEdicao();
            }
        };
        reader.onerror = function() { alert("Erro ao ler o arquivo de imagem."); limparCamposImagemEdicao(); };
        reader.readAsDataURL(file); // Inicia a leitura para Base64.

    }
    // 2. Se NENHUMA IMAGEM nova foi selecionada, MAS outros campos mudaram:
    else if (mudou) {
        console.log("Salvando alterações (sem mudança de imagem)...");
        if (salvarGaragem()) {
            v.atualizarInformacoesUI("Edição Salva");
            atualizarMenuVeiculos();
            verificarVencimentoCNH();
            alert("Alterações salvas!");
            limparCamposImagemEdicao(); // Limpa por consistência.
        } else {
             // Falha ao salvar mesmo sem imagem nova (erro inesperado?).
             console.warn("Falha ao salvar garagem (sem alteração de imagem).");
             // Não há o que reverter aqui. O alerta já foi dado.
        }
    }
    // 3. Se NADA mudou (nem imagem, nem outros campos):
    else {
        alert("Nenhuma alteração detectada.");
        limparCamposImagemEdicao(); // Limpa o input/preview.
    }
}


/**
 * Handler para o submit do formulário de agendar/adicionar manutenção.
 * Coleta dados, cria instância de `Manutencao` e chama `veiculo.adicionarManutencao`.
 * @param {Event} event - Objeto do evento submit.
 * @param {string} veiculoId - ID do veículo alvo.
 * @returns {void}
 */
function handleAgendarManutencao(event, veiculoId) {
    event.preventDefault();
    const v = garagem[veiculoId]; if (!v) return;
    const form = event.target;
    // Coleta dados do form de agendamento.
    const dI = form.querySelector('.agendamento-data'), hI = form.querySelector('.agendamento-hora');
    const tI = form.querySelector('.agendamento-tipo'), cI = form.querySelector('.agendamento-custo');
    const oI = form.querySelector('.agendamento-obs');

    if (!dI || !tI || !dI.value || !tI.value.trim()) { // Validação básica.
        alert('Data e Tipo são obrigatórios para agendar/adicionar manutenção!'); return;
    }
    const dS = dI.value, hS = hI?.value || '00:00', tS = tI.value.trim(); // Data, Hora, Tipo.
    const cS = cI?.value, oS = oI?.value.trim(); // Custo, Obs (opcionais).

    // Cria objeto Date combinando data e hora (fuso local do navegador).
    const dt = new Date(`${dS}T${hS}:00`);
    if (isNaN(dt.getTime())) { alert('Data/Hora inválida!'); return; } // Valida data/hora.

    // Cria e adiciona a manutenção.
    const m = new Manutencao(dt, tS, cS, oS);
    if (v.adicionarManutencao(m)) { // adicionarManutencao já salva e atualiza UI.
        alert('Manutenção adicionada/agendada com sucesso!');
        form.reset(); // Limpa o formulário.
    } else {
         // adicionarManutencao já deu alerta de erro.
         console.warn("Falha ao adicionar manutenção via handler.");
    }
}

/**
 * Handler para o botão de limpar histórico de manutenção do veículo exibido.
 * Pede confirmação e chama `veiculo.limparHistoricoManutencao`.
 * @param {string} veiculoId - ID do veículo alvo.
 * @returns {void}
 */
function handleLimparHistorico(veiculoId) {
    const v = garagem[veiculoId]; if (!v) return;
    // Confirmação MUITO IMPORTANTE!
    if (confirm(`Tem certeza que deseja APAGAR TODO o histórico de manutenção de ${v.modelo}?\n\nEsta ação NÃO pode ser desfeita.`)) {
        try {
            v.limparHistoricoManutencao(); // Método da classe faz o trabalho (limpa, salva, atualiza UI).
            alert(`Histórico de ${v.modelo} limpo.`);
        } catch (e) {
            alert('Erro ao tentar limpar o histórico.');
            console.error("Erro em handleLimparHistorico:", e);
        }
    }
}

/**
 * Handler para o botão de excluir o veículo exibido.
 * Pede confirmação rigorosa, remove da `garagem`, salva e atualiza a UI completa.
 * @param {string} veiculoId - ID do veículo a ser excluído.
 * @returns {void}
 */
function handleExcluirVeiculo(veiculoId) {
    const v = garagem[veiculoId]; if (!v) return;
    // Confirmação DUPLA (ou mais enfática) é recomendada para exclusão permanente.
    if (confirm(`EXCLUIR PERMANENTEMENTE o veículo "${v.modelo}" (${v.placa || 'S/P'})?\n\nTODOS OS DADOS SERÃO PERDIDOS.\n\nEsta ação NÃO pode ser desfeita!`)) {
        try {
            delete garagem[veiculoId]; // Remove da memória.
            if (salvarGaragem()) { // Tenta persistir a remoção.
                atualizarInterfaceCompleta(); // Atualiza toda a UI.
                alert(`"${v.modelo}" foi excluído com sucesso.`);
            } else {
                 // Falha ao salvar é crítico aqui. O ideal seria ter um mecanismo de rollback.
                 // Por simplicidade, alertamos e pedimos para recarregar.
                 console.error("Falha CRÍTICA: Veículo removido da memória, mas erro ao salvar a remoção no LocalStorage.");
                 alert("ERRO GRAVE: Não foi possível salvar a exclusão do veículo. Recarregue a página para ver o estado real.");
                 // Poderia tentar readicionar 'v' à garagem, mas é complexo garantir estado correto.
            }
        } catch (e) {
            alert("Erro ao tentar excluir o veículo.");
            console.error("Erro em handleExcluirVeiculo:", e);
        }
    }
}


// ==================================================
//      ALERTAS E VISUALIZAÇÕES GERAIS (Agendamentos, CNH)
// ==================================================

/**
 * Atualiza a lista global de TODOS os agendamentos futuros (#agendamentos-futuros-lista).
 * Busca manutenções futuras em todos os veículos e as exibe ordenadas por data.
 * @returns {void}
 */
function atualizarExibicaoAgendamentosFuturos() {
    const d = document.getElementById('agendamentos-futuros-lista'); if (!d) return;
    d.innerHTML = ''; // Limpa.
    const agora = new Date();
    let tds = []; // Array para todos os agendamentos futuros.
    // Coleta de todos os veículos.
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m?.data instanceof Date && !isNaN(m.data.getTime()) && m.data > agora) // Filtra futuras e válidas.
            .forEach(m => tds.push({ m: m, v: v.modelo })); // Adiciona objeto com manutenção e modelo.
    });
    // Ordena pela data da manutenção (mais próximas primeiro).
    tds.sort((a, b) => a.m.data.getTime() - b.m.data.getTime());
    // Exibe na UI.
    if (tds.length > 0) {
        d.innerHTML = `<ul>${tds.map(i => `<li><strong>${i.v}:</strong> ${i.m.formatarComHora()}</li>`).join('')}</ul>`;
    } else {
        d.innerHTML = '<p>Nenhum agendamento futuro.</p>';
    }
}

/**
 * Verifica manutenções agendadas para HOJE ou AMANHÃ e exibe na área de notificações (#notificacoes-area).
 * @returns {void}
 */
function verificarAgendamentosProximos() {
    const a = document.getElementById('notificacoes-area'); if (!a) return;
    const agora = new Date();
    const fimDeAmanha = new Date(); // Calcula o final do dia de amanhã.
    fimDeAmanha.setDate(agora.getDate() + 1);
    fimDeAmanha.setHours(23, 59, 59, 999);
    let ntf = []; // Array para as notificações.
    // Coleta de todos os veículos.
    Object.values(garagem).forEach(v => {
        (v.historicoManutencao || [])
            .filter(m => m?.data instanceof Date && !isNaN(m.data.getTime()) && m.data > agora && m.data <= fimDeAmanha) // Filtra hoje/amanhã.
            .forEach(m => {
                const hj = m.data.toDateString() === agora.toDateString(); // É hoje?
                const p = hj ? "🚨 HOJE" : "🗓️ Amanhã"; // Prefixo visual.
                const hF = m.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); // Hora formatada.
                ntf.push(`<li>${p}: <strong>${v.modelo}</strong> - ${m.tipo} às ${hF}</li>`);
            });
    });
    // Ordena (hoje primeiro, depois por texto/hora).
    ntf.sort((a, b) => (a.includes("HOJE") ? -1 : 1) - (b.includes("HOJE") ? -1 : 1) || a.localeCompare(b));
    // Exibe na UI.
    if (ntf.length > 0) {
        a.innerHTML = `<h4><span role="img" aria-label="Alerta">⚠️</span> Alertas Manutenção Próxima</h4><ul>${ntf.join('')}</ul>`;
        a.style.display = 'block';
    } else {
        a.style.display = 'none'; // Esconde se vazio.
    }
}

/**
 * Verifica CNHs vencidas ou a vencer em <= 30 dias em todos os veículos.
 * Exibe alertas na área #cnh-alertas-area.
 * @returns {void}
 */
function verificarVencimentoCNH() {
    const a = document.getElementById('cnh-alertas-area'); if (!a) return;
    const hj = new Date(); hj.setHours(0, 0, 0, 0); // Hoje (sem hora).
    let alr = []; // Array para os alertas de CNH.
    // Coleta de todos os veículos.
    Object.values(garagem).forEach(v => {
        if (v.dataVencimentoCNH instanceof Date && !isNaN(v.dataVencimentoCNH.getTime())) { // Se tem CNH válida.
            const dtV = v.dataVencimentoCNH;
            const dias = Math.ceil((dtV.getTime() - hj.getTime()) / (1e3 * 60 * 60 * 24)); // Dias restantes.
            const dtFmt = dtV.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // Data formatada.
            if (dias < 0) { // Vencida.
                alr.push(`<li><strong>${v.modelo} (${v.placa || 'S/P'}):</strong> CNH <span style="color:red;font-weight:bold;">VENCIDA</span> (${dtFmt})!</li>`);
            } else if (dias <= 30) { // Vence em breve.
                alr.push(`<li><strong>${v.modelo} (${v.placa || 'S/P'}):</strong> CNH vence em ${dias}d (${dtFmt})!</li>`);
            }
        }
    });
    // Ordena (vencidas primeiro, depois por texto).
    alr.sort((a, b) => (a.includes("VENCIDA") ? -1 : 1) - (b.includes("VENCIDA") ? -1 : 1) || a.localeCompare(b));
    // Exibe na UI.
    if (alr.length > 0) {
        a.innerHTML = `<h4><span role="img" aria-label="Carteira">💳</span> Alertas de CNH</h4><ul>${alr.join('')}</ul>`;
        a.style.display = 'block';
    } else {
        a.style.display = 'none'; // Esconde se vazio.
    }
}


// ==================================================
//                   INICIALIZAÇÃO DA APLICAÇÃO
// ==================================================

/**
 * Ponto de entrada principal da aplicação. Chamado quando o DOM está pronto.
 * Configura listeners globais e carrega os dados da garagem.
 * Inclui tratamento de erro crítico na inicialização.
 * @returns {void}
 */
function inicializarAplicacao() {
    console.log("DOM Carregado. Iniciando Garagem v6...");
    try {
        setupEventListeners(); // Configura botões de aba, form de add, etc.
        carregarGaragem();     // Carrega dados ou inicializa padrão.
    } catch (e) {
        console.error("ERRO CRÍTICO NA INICIALIZAÇÃO:", e);
        alert("Erro grave ao iniciar a aplicação. Tente recarregar a página.");
        // Considerar limpar localStorage em caso de erro irrecuperável?
        // localStorage.removeItem(GARAGEM_KEY);
    }
}

/**
 * Configura os event listeners globais que não dependem de um veículo específico
 * (navegação por abas, formulário de adicionar, etc.).
 * @returns {void}
 */
function setupEventListeners() {
    console.log("Configurando Listeners Iniciais...");
    // Abas de Navegação.
    document.getElementById('tab-garagem')?.addEventListener('click', () => handleTrocarAba('tab-garagem'));
    document.getElementById('tab-adicionar')?.addEventListener('click', () => handleTrocarAba('tab-adicionar'));

    // Submit do Formulário de Adicionar Veículo.
    document.getElementById('form-add-veiculo')?.addEventListener('submit', handleAdicionarVeiculo);

    // Mostrar/Esconder Capacidade de Carga no Form de Adicionar.
    const tSel = document.getElementById('add-tipo'), cDiv = document.getElementById('add-capacidade-carga-container');
    if (tSel && cDiv) {
        const toggleCarga = () => { cDiv.style.display = tSel.value === 'Caminhao' ? 'block' : 'none'; };
        tSel.addEventListener('change', toggleCarga);
        toggleCarga(); // Garante estado inicial correto.
    }

    // Preview da Imagem no Formulário de Adicionar (usando createObjectURL).
    // Nota: Esta imagem *não* é salva ao adicionar na V6, só na edição. O preview é só visual.
    const addImgIn = document.getElementById('add-imagem-input'), addImgPrv = document.getElementById('add-imagem-preview');
    if (addImgIn && addImgPrv) {
        addImgIn.addEventListener('change', (e) => {
            // Limpa URL anterior se houver.
             if (addImgPrv.src.startsWith('blob:')) URL.revokeObjectURL(addImgPrv.src);

            const f = e.target.files[0];
            if (f && f.type.startsWith("image/")) {
                addImgPrv.src = URL.createObjectURL(f); // Cria URL temporária.
                addImgPrv.style.display = 'block';
                 // Não precisa revogar no onload/onerror aqui, pois se selecionar outra, a linha inicial revoga.
                 // O navegador geralmente libera ao fechar a página.
            } else {
                addImgPrv.src = '#'; addImgPrv.style.display = 'none'; // Limpa se inválido.
            }
        });
    }
    console.log("Listeners Iniciais OK.");
}

// --- Gatilho Inicial ---
// Espera o DOM estar pronto para iniciar a aplicação.
document.addEventListener('DOMContentLoaded', inicializarAplicacao);