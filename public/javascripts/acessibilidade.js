(function () {
  'use strict';

  const RAIZ = document.documentElement;
  const CHAVE_STORAGE = 'incluaneuro_acessibilidade';

  const opcoesPadrao = {
    fonte: 'normal',        // menor2 | menor | normal | grande | maior
    tema: 'padrao',         // padrao | escuro | contraste
    daltonismo: 'nenhum',   // nenhum | protanopia | deuteranopia | tritanopia
    fonteLeitura: 'normal', // normal | opendyslexic | lexend | hyperlegible
    destacarLinks: false,
    semAnimacao: false,
    espacamentoTexto: 'normal', // normal | media | grande
    cursorGrande: false,
    monocromatico: false,
    contraste: 'normal',    // normal | elevado | reduzido
    linha: 'normal',        // normal | media | grande
    reguaLeitura: false,
    reguaIntensidade: 'leve',      // leve | medio | forte
    guiaLeitura: false,
    modoFoco: false,
    modoFocoForma: 'circular',     // circular | retangular
    modoFocoTamanho: 'medio',      // pequeno | medio | grande
    modoFocoIntensidade: 'medio'   // leve | medio | forte
  };

  const CLASSES_FONTE = {
    menor2: 'fonte-menor2', menor: 'fonte-menor', normal: '',
    grande: 'fonte-grande', maior: 'fonte-maior'
  };

  const CLASSES_TEMA = { padrao: '', escuro: 'tema-escuro', contraste: 'tema-contraste', contrasteClaro: 'tema-contraste-claro' };

  const CLASSES_DALTONISMO = {
    nenhum: '',
    protanopia: 'daltonismo-protanopia',
    deuteranopia: 'daltonismo-deuteranopia',
    tritanopia: 'daltonismo-tritanopia'
  };

  const CLASSES_CONTRASTE = {
    normal: '', elevado: 'contraste-elevado', reduzido: 'contraste-reduzido'
  };

  const CLASSES_LINHA = {
    normal: '', media: 'linha-media', grande: 'linha-grande'
  };

  const CLASSES_ESPACAMENTO = {
    normal: '', media: 'espacamento-media', grande: 'espacamento-grande'
  };

  const CLASSES_FONTE_LEITURA = {
    normal: '',
    opendyslexic: 'leitura-fonte-opendyslexic',
    lexend: 'leitura-fonte-lexend',
    hyperlegible: 'leitura-fonte-hyperlegible'
  };

  const ALPHA_MODO_FOCO = { leve: 0.35, medio: 0.6, forte: 0.8 };
  const ALPHA_REGUA = { leve: 0.15, medio: 0.28, forte: 0.45 };

  // Tamanho em px do "diâmetro" pro círculo, e largura/altura pro retângulo
  // (retângulo mais largo que alto, formato melhor pra acompanhar um bloco
  // de texto de leitura)
  const TAMANHOS_MODO_FOCO = {
    pequeno: { circular: 160, retW: 260, retH: 130 },
    medio: { circular: 240, retW: 380, retH: 180 },
    grande: { circular: 340, retW: 520, retH: 240 }
  };

  function carregarOpcoes() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_STORAGE));
      if (!salvo || typeof salvo !== 'object') return { ...opcoesPadrao };
      return { ...opcoesPadrao, ...salvo };
    } catch (erro) {
      return { ...opcoesPadrao };
    }
  }

  function salvarOpcoes(opcoes) {
    try { localStorage.setItem(CHAVE_STORAGE, JSON.stringify(opcoes)); }
    catch (erro) { console.warn('[acessibilidade] falha ao salvar', erro); }
  }

  function limparTodasAsClasses() {
    Object.values(CLASSES_FONTE).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_TEMA).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_DALTONISMO).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_CONTRASTE).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_LINHA).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_ESPACAMENTO).forEach(c => c && RAIZ.classList.remove(c));
    Object.values(CLASSES_FONTE_LEITURA).forEach(c => c && RAIZ.classList.remove(c));
    RAIZ.classList.remove(
      'destacar-links', 'sem-animacao',
      'cursor-grande', 'monocromatico'
    );
  }

  /* ===== Régua de leitura =====
     Faixa horizontal (100% da largura) que só rastreia a posição vertical
     do mouse. Criada/destruída via JS - funciona em qualquer página que
     carregue este script. */
  let elementoRegua = null;
  let handlerReguaMouseMove = null;

  function ativarRegua(intensidade) {
    if (!elementoRegua) {
      elementoRegua = document.createElement('div');
      elementoRegua.id = 'regua-leitura-acessibilidade';
      elementoRegua.setAttribute('aria-hidden', 'true');
      document.body.appendChild(elementoRegua);

      handlerReguaMouseMove = function (evento) {
        elementoRegua.style.top = (evento.clientY - 27) + 'px'; // 54px de altura / 2
      };
      document.addEventListener('mousemove', handlerReguaMouseMove);
    }
    const alpha = ALPHA_REGUA[intensidade] ?? ALPHA_REGUA.leve;
    elementoRegua.style.setProperty('--regua-alpha', alpha);
  }

  function desativarRegua() {
    if (handlerReguaMouseMove) {
      document.removeEventListener('mousemove', handlerReguaMouseMove);
      handlerReguaMouseMove = null;
    }
    if (elementoRegua) {
      elementoRegua.remove();
      elementoRegua = null;
    }
  }

  /* ===== Guia de leitura =====
     Separado da régua a pedido - uma linha fina que acompanha o mouse
     verticalmente, SEM escurecer o resto da página. Recurso
     independente, pode ser usado com ou sem a régua/modo de foco. */
  let elementoGuia = null;
  let handlerGuiaMouseMove = null;

  function ativarGuia() {
    if (elementoGuia) return;
    elementoGuia = document.createElement('div');
    elementoGuia.id = 'guia-leitura-acessibilidade';
    elementoGuia.setAttribute('aria-hidden', 'true');
    document.body.appendChild(elementoGuia);

    handlerGuiaMouseMove = function (evento) {
      elementoGuia.style.top = (evento.clientY - 1) + 'px'; // 3px de altura / 2
    };
    document.addEventListener('mousemove', handlerGuiaMouseMove);
  }

  function desativarGuia() {
    if (handlerGuiaMouseMove) {
      document.removeEventListener('mousemove', handlerGuiaMouseMove);
      handlerGuiaMouseMove = null;
    }
    if (elementoGuia) {
      elementoGuia.remove();
      elementoGuia = null;
    }
  }

  /* ===== Modo de foco (spotlight interativo) =====
     Janela iluminada que segue o mouse, com forma (círculo/retângulo) e
     tamanho ajustáveis. pointer-events:none sempre - nunca bloqueia
     cliques na página. */
  let elementoSpotlight = null;
  let handlerSpotlightMouseMove = null;

  function ativarModoFoco(forma, tamanho, intensidade) {
    if (!elementoSpotlight) {
      elementoSpotlight = document.createElement('div');
      elementoSpotlight.id = 'modo-foco-spotlight';
      elementoSpotlight.setAttribute('aria-hidden', 'true');
      document.body.appendChild(elementoSpotlight);

      handlerSpotlightMouseMove = function (evento) {
        elementoSpotlight.style.left = evento.clientX + 'px';
        elementoSpotlight.style.top = evento.clientY + 'px';
      };
      document.addEventListener('mousemove', handlerSpotlightMouseMove);
    }
    configurarSpotlight(forma, tamanho, intensidade);
  }

  function configurarSpotlight(forma, tamanho, intensidade) {
    if (!elementoSpotlight) return;
    const medidas = TAMANHOS_MODO_FOCO[tamanho] ?? TAMANHOS_MODO_FOCO.medio;
    const alpha = ALPHA_MODO_FOCO[intensidade] ?? ALPHA_MODO_FOCO.medio;

    if (forma === 'retangular') {
      elementoSpotlight.style.width = medidas.retW + 'px';
      elementoSpotlight.style.height = medidas.retH + 'px';
      elementoSpotlight.style.borderRadius = '14px';
    } else {
      elementoSpotlight.style.width = medidas.circular + 'px';
      elementoSpotlight.style.height = medidas.circular + 'px';
      elementoSpotlight.style.borderRadius = '50%';
    }
    elementoSpotlight.style.setProperty('--modo-foco-alpha', alpha);
  }

  function desativarModoFoco() {
    if (handlerSpotlightMouseMove) {
      document.removeEventListener('mousemove', handlerSpotlightMouseMove);
      handlerSpotlightMouseMove = null;
    }
    if (elementoSpotlight) {
      elementoSpotlight.remove();
      elementoSpotlight = null;
    }
  }

  function aplicarOpcoes(opcoes) {
    limparTodasAsClasses();

    const classeFonte = CLASSES_FONTE[opcoes.fonte];
    if (classeFonte) RAIZ.classList.add(classeFonte);

    const classeTema = CLASSES_TEMA[opcoes.tema];
    if (classeTema) RAIZ.classList.add(classeTema);

    const classeDaltonismo = CLASSES_DALTONISMO[opcoes.daltonismo];
    if (classeDaltonismo) RAIZ.classList.add(classeDaltonismo);

    const classeContraste = CLASSES_CONTRASTE[opcoes.contraste];
    if (classeContraste) RAIZ.classList.add(classeContraste);

    const classeLinha = CLASSES_LINHA[opcoes.linha];
    if (classeLinha) RAIZ.classList.add(classeLinha);

    const classeEspacamento = CLASSES_ESPACAMENTO[opcoes.espacamentoTexto];
    if (classeEspacamento) RAIZ.classList.add(classeEspacamento);

    const classeFonteLeitura = CLASSES_FONTE_LEITURA[opcoes.fonteLeitura];
    if (classeFonteLeitura) RAIZ.classList.add(classeFonteLeitura);
    if (opcoes.destacarLinks) RAIZ.classList.add('destacar-links');
    if (opcoes.semAnimacao) RAIZ.classList.add('sem-animacao');
    if (opcoes.cursorGrande) RAIZ.classList.add('cursor-grande');
    if (opcoes.monocromatico) RAIZ.classList.add('monocromatico');

    if (opcoes.reguaLeitura) ativarRegua(opcoes.reguaIntensidade);
    else desativarRegua();

    if (opcoes.guiaLeitura) ativarGuia();
    else desativarGuia();

    if (opcoes.modoFoco) ativarModoFoco(opcoes.modoFocoForma, opcoes.modoFocoTamanho, opcoes.modoFocoIntensidade);
    else desativarModoFoco();
  }

  function definirOpcao(chave, valor) {
    const opcoes = carregarOpcoes();

    if (chave === 'escuro') {
      opcoes.tema = valor ? 'escuro' : 'padrao';
    } else if (chave === 'contrasteAlto') {
      // Alto contraste (escuro ou claro) é mutuamente exclusivo com
      // Daltonismo e com Monocromático - nenhuma dessas combinações
      // tem uma paleta própria bem definida (era preto/branco/âmbar
      // competindo com a paleta colorida do daltonismo, ou com o filtro
      // de escala de cinza do monocromático). Ativar o contraste desliga
      // os dois.
      opcoes.tema = valor ? 'contraste' : 'padrao';
      if (valor) {
        opcoes.daltonismo = 'nenhum';
        opcoes.monocromatico = false;
      }
    } else if (chave === 'contrasteClaro') {
      opcoes.tema = valor ? 'contrasteClaro' : 'padrao';
      if (valor) {
        opcoes.daltonismo = 'nenhum';
        opcoes.monocromatico = false;
      }
    } else if (chave === 'modoFoco' && valor) {
      // Modo de foco e régua de leitura são mutuamente exclusivos - os dois
      // juntos faziam os box-shadow se sobreporem e davam a impressão de
      // que desligar um "não funcionava" (o outro continuava visível)
      opcoes.modoFoco = true;
      opcoes.reguaLeitura = false;
    } else if (chave === 'reguaLeitura' && valor) {
      opcoes.reguaLeitura = true;
      opcoes.modoFoco = false;
    } else if (chave === 'monocromatico' && valor) {
      // Monocromático é mutuamente exclusivo com Daltonismo (o
      // daltonismo é uma paleta de CORES, e o monocromático remove cor
      // de tudo - as duas coisas competindo pela mesma aparência não faz
      // sentido) e também com Alto Contraste (espelha a regra de
      // 'contrasteAlto'/'contrasteClaro' acima). Modo escuro comum
      // continua permitido junto com monocromático.
      opcoes.monocromatico = true;
      opcoes.daltonismo = 'nenhum';
      if (opcoes.tema === 'contraste' || opcoes.tema === 'contrasteClaro') {
        opcoes.tema = 'padrao';
      }
    } else if (chave === 'daltonismo' && valor !== 'nenhum') {
      // Espelha a regra acima: ativar daltonismo desliga o alto
      // contraste (claro ou escuro), já que os dois nunca combinam.
      // Modo escuro comum continua permitido junto com daltonismo.
      opcoes.daltonismo = valor;
      opcoes.monocromatico = false;
      if (opcoes.tema === 'contraste' || opcoes.tema === 'contrasteClaro') {
        opcoes.tema = 'padrao';
      }
    } else {
      opcoes[chave] = valor;
    }

    salvarOpcoes(opcoes);
    aplicarOpcoes(opcoes);
    return opcoes;
  }

  function obterOpcoesParaUI() {
    const opcoes = carregarOpcoes();
    return {
      ...opcoes,
      escuro: opcoes.tema === 'escuro',
      contrasteAlto: opcoes.tema === 'contraste',
      contrasteClaro: opcoes.tema === 'contrasteClaro'
    };
  }

  function resetarOpcoes() {
    salvarOpcoes(opcoesPadrao);
    aplicarOpcoes(opcoesPadrao);
  }

  window.acessibilidade = {
    obter: obterOpcoesParaUI,
    definir: definirOpcao,
    resetar: resetarOpcoes
  };

  /* Atalho de teclado global: Alt+Shift+F liga/desliga o Modo de Foco de
     qualquer lugar da página. */
  document.addEventListener('keydown', function (evento) {
    if (evento.altKey && evento.shiftKey && evento.key.toLowerCase() === 'f') {
      evento.preventDefault();
      const opcoes = carregarOpcoes();
      definirOpcao('modoFoco', !opcoes.modoFoco);
      if (typeof window.sincronizarControlesAcessibilidade === 'function') {
        window.sincronizarControlesAcessibilidade();
      }
    }
  });

  aplicarOpcoes(carregarOpcoes());
})();