function openModal(idModal) {

    const modal = document.getElementById(idModal);

    modal.classList.add('mostrar');

    if (modal.dataset.listenerFechar !== 'true') {
        modal.dataset.listenerFechar = 'true';

        modal.addEventListener('click', (e) => {
            if (
                e.target.id == idModal ||
                e.target.id == "fechar"
            ) {
                modal.classList.remove('mostrar');
            }
        });
    }
}

/* ---------- Aviso de enviado (toast igual ao de "Postagem excluída") ---------- */
function mostrarAviso(mensagem) {
    const aviso = document.createElement('div');
    aviso.textContent = mensagem;
    aviso.style.cssText =
        'position:fixed;bottom:30px;right:30px;z-index:2000;' +
        'background:rgb(52,73,94);color:#fff;padding:14px 22px;border-radius:8px;' +
        'box-shadow:0 4px 15px rgba(0,0,0,0.2);font-size:0.95rem;max-width:320px;' +
        'opacity:0;transition:opacity .3s;';

    document.body.appendChild(aviso);
    requestAnimationFrame(() => { aviso.style.opacity = '1'; });

    setTimeout(() => {
        aviso.style.opacity = '0';
        setTimeout(() => aviso.remove(), 300);
    }, 3000);
}

/* ---------- Envio do formulário de contato ---------- */
document.addEventListener('DOMContentLoaded', function () {
    const btnEnviarContato = document.getElementById('enviar-contato');
    if (!btnEnviarContato) return;

    btnEnviarContato.addEventListener('click', function () {
        const form = document.getElementById('form-contato');

        const nome = document.getElementById('contato-nome').value.trim();
        const sobrenome = document.getElementById('contato-sobrenome').value.trim();
        const email = document.getElementById('contato-email').value.trim();
        const telefone = document.getElementById('contato-telefone').value.trim();
        const relato = document.getElementById('contato-relato').value.trim();

        if (!nome || !email || !relato) {
            mostrarAviso('Por favor, preencha nome, e-mail e o relato.', false);
            return;
        }

        fetch('/contato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, sobrenome, email, telefone, relato })
        })
        .then(res => res.json())
        .then(data => {
            mostrarAviso(data.mensagem, data.sucesso);
            if (data.sucesso) {
                form.reset();
                document.getElementById('modal-contato').classList.remove('mostrar');
            }
        })
        .catch(() => mostrarAviso('Erro de conexão ao enviar. Tente novamente.', false));
    });
});