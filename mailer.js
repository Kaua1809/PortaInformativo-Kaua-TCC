// Envio de e-mail pela API HTTP do Brevo (o Render grátis bloqueia SMTP)
const REMETENTE = {
  name: 'IncluaNeuro',
  email: process.env.MAIL_FROM || 'incluaneuro@gmail.com'
};

// Imagem do topo de todos os e-mails (arquivo em public/images).
// O endereço precisa ser público: no Render, BASE_URL deve ser o endereço do site.
function cabecalhoComImagem() {
  const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const logo = base + '/images/favicon.png'; // troque pelo nome da imagem que você quiser
  return '<div style="text-align: center; padding: 16px 0 0;">' +
         '<img src="' + logo + '" alt="IncluaNeuro" width="120" ' +
         'style="display: block; margin: 0 auto; max-width: 100%; height: auto; border: 0;">' +
         '</div>';
}

async function enviar({ to, subject, html }) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      sender: REMETENTE,
      to: [{ email: to }],
      subject: subject,
      htmlContent: cabecalhoComImagem() + html
    }),
    signal: AbortSignal.timeout(15000) // não fica preso mais de 15 segundos
  });

  if (!resp.ok) {
    throw new Error('Brevo ' + resp.status + ': ' + (await resp.text()));
  }
}

module.exports = {
  sendMail(options, callback) {
    enviar(options).then(
      () => callback && callback(null, {}),
      (err) => callback && callback(err)
    );
  }
};