/* ---------- Envio do formulário de feedback ---------- */
/* A função openModal já está definida em modal-contato.js (compartilhada
   entre os dois modais). Este arquivo só cuida do envio do feedback. */
document.addEventListener('DOMContentLoaded', function () {
    const btnEnviarFeedback = document.getElementById('enviar-feedback');
    if (!btnEnviarFeedback) return;

    btnEnviarFeedback.addEventListener('click', function () {
        const form = document.getElementById('form-feedback');
        const mensagem = document.getElementById('feedback-mensagem').value.trim();

        if (!mensagem) {
            alert('Por favor, escreva seu feedback antes de enviar.');
            return;
        }

        fetch('/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagem })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.mensagem);
            if (data.sucesso) {
                form.reset();
                document.getElementById('modal-feedback').classList.remove('mostrar');
            }
        })
        .catch(() => alert('Erro de conexão ao enviar. Tente novamente.'));
    });
});