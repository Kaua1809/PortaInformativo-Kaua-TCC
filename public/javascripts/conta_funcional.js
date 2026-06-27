document.addEventListener('DOMContentLoaded', function() {
    // 1. Alternância de Abas (Informações vs Configurações)
    const tabInfo = document.getElementById('tab-info');
    const tabConfig = document.getElementById('tab-config');
    const infoContent = document.getElementById('info-content');
    const configContent = document.getElementById('config-content');

    if (tabInfo && tabConfig) {
        tabInfo.addEventListener('click', () => {
            tabInfo.classList.add('active');
            tabConfig.classList.remove('active');
            infoContent.style.display = 'grid';
            configContent.style.display = 'none';
        });

        tabConfig.addEventListener('click', () => {
            tabConfig.classList.add('active');
            tabInfo.classList.remove('active');
            infoContent.style.display = 'none';
            configContent.style.display = 'block';
        });
    }

    // 2. Olhinho da Senha
    const togglePassword = document.getElementById('toggle-password');
    const passwordDisplay = document.getElementById('password-display');
    let isVisible = false;

    if (togglePassword && passwordDisplay) {
        togglePassword.addEventListener('click', () => {
            isVisible = !isVisible;
            if (isVisible) {
                passwordDisplay.textContent = '••••••••'; // Máscara de visualização
                togglePassword.classList.remove('bi-eye');
                togglePassword.classList.add('bi-eye-slash');
            } else {
                passwordDisplay.textContent = '************';
                togglePassword.classList.remove('bi-eye-slash');
                togglePassword.classList.add('bi-eye');
            }
        });
    }

    // 3. Toggle de Notificações (AJAX)
    const notifyToggle = document.getElementById('notify-toggle');
    if (notifyToggle) {
        notifyToggle.addEventListener('change', function() {
            fetch('/conta/notificacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: this.checked })
            })
            .then(res => res.json())
            .then(data => {
                if (!data.sucesso) {
                    alert('Erro ao salvar preferência');
                    this.checked = !this.checked;
                }
            });
        });
    }

    // 4. Redefinir Senha
    const btnReset = document.getElementById('btn-reset-password');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (confirm('Deseja receber um e-mail para redefinir sua senha?')) {
                fetch('/conta/redefinir-senha', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    alert(data.mensagem || 'Verifique seu e-mail!');
                });
            }
        });
    }

    // 5. Deletar Conta
    const btnDelete = document.getElementById('btn-delete-account');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (confirm('TEM CERTEZA? Esta ação é irreversível.')) {
                const senha = prompt('Por favor, digite sua senha para confirmar:');
                if (senha) {
                    fetch('/conta/deletar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ senha })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.sucesso) {
                            alert('Conta deletada com sucesso.');
                            window.location.href = '/login';
                        } else {
                            alert(data.mensagem || 'Senha incorreta.');
                        }
                    });
                }
            }
        });
    }
});