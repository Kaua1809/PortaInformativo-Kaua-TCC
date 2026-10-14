// Envio de e-mail pela API HTTP do Brevo (o Render grátis bloqueia SMTP)
const REMETENTE = {
  name: 'IncluaNeuro',
  email: process.env.MAIL_FROM || 'incluaneuro@gmail.com'
};

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
      htmlContent: html
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