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
            alert('Por favor, preencha nome, e-mail e o relato.');
            return;
        }

        fetch('/contato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, sobrenome, email, telefone, relato })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.mensagem);
            if (data.sucesso) {
                form.reset();
                document.getElementById('modal-contato').classList.remove('mostrar');
            }
        })
        .catch(() => alert('Erro de conexão ao enviar. Tente novamente.'));
    });
});