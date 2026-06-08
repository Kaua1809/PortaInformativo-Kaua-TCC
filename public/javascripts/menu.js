// MENU LATERAL
const btnMenu = document.getElementById("btn-menu");
const menu = document.querySelector(".menu-lateral");
const overlay = document.getElementById("overlay-menu");

btnMenu.addEventListener("click", () => {
    menu.classList.toggle("ativo");
    overlay.classList.toggle("ativo");
});

overlay.addEventListener("click", () => {
    menu.classList.remove("ativo");
    overlay.classList.remove("ativo");
});


// ================= PESQUISA FUNCIONAL =================

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

function pesquisar() {
    const termo = searchInput.value.toLowerCase();
    console.log("Pesquisando por:", termo);
    // Adicione aqui a lógica de redirecionamento ou filtro de pesquisa
}

// clicar no botão
if (searchBtn) {
    searchBtn.addEventListener("click", pesquisar);
}

// apertar ENTER
if (searchInput) {
    searchInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            pesquisar();
        }
    });
}