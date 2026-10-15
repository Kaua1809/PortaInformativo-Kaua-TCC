/* ---------- Aviso de enviado (toast igual ao de "Postagem excluída") ---------- */
/* Só define se ainda não existir (o modal-contato.js também define a mesma função). */
if (typeof window.mostrarAviso !== 'function') {
    window.mostrarAviso = function (mensagem) {
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
    };
}

/* ---------- Envio do formulário de feedback ---------- */
document.addEventListener('DOMContentLoaded', function () {
    const btnEnviarFeedback = document.getElementById('enviar-feedback');
    if (!btnEnviarFeedback) return;

    btnEnviarFeedback.addEventListener('click', function () {
        const form = document.getElementById('form-feedback');
        const mensagem = document.getElementById('feedback-mensagem').value.trim();

        if (!mensagem) {
            mostrarAviso('Por favor, escreva seu feedback antes de enviar.');
            return;
        }

        fetch('/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagem })
        })
        .then(res => res.json())
        .then(data => {
            mostrarAviso(data.mensagem);
            if (data.sucesso) {
                form.reset();
                document.getElementById('modal-feedback').classList.remove('mostrar');
            }
        })
        .catch(() => mostrarAviso('Erro de conexão ao enviar. Tente novamente.'));
    });
});