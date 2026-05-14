function openModal(idModal){

    const modal = document.getElementById(idModal)

    modal.classList.add('mostrar')

    modal.addEventListener('click', (e) => {

        if(
            e.target.id == idModal ||
            e.target.id == "fechar" ||
            e.target.id == "enviar"
        ){
            modal.classList.remove('mostrar')
        }

    })

}