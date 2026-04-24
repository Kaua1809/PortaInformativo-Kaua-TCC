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

    if (termo === "") {
        alert("Digite algo para pesquisar!");
        return;
    }

    // Exemplo simples (tu pode melhorar depois)
    alert("Você pesquisou por: " + termo);
}

// clicar no botão
searchBtn.addEventListener("click", pesquisar);

// apertar ENTER
searchInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
        pesquisar();
    }
});