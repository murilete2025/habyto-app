export default async function handler(req, res) {
  // 1. Recebe a notificação (IPN ou Webhook)
  // O Mercado Pago envia um POST com query params ou body
  const { action, data, type } = req.body;

  // Só nos interessam pagamentos ou notificações de tópicos 'payment'
  if (type !== 'payment' && action !== 'payment.created' && action !== 'payment.updated') {
    return res.status(200).send('OK');
  }

  const paymentId = data?.id || req.query.id;
  if (!paymentId) return res.status(200).send('No ID');

  try {
    // 2. Buscar o Access Token do Mercado Pago no Firestore do Admin
    const configRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/config/global");
    const configData = await configRes.json();
    const accessToken = configData?.fields?.mp_access_token?.stringValue;

    if (!accessToken) {
      console.error("Webhook Error: MP Access Token não configurado no Admin.");
      return res.status(200).send('Config Missing');
    }

    // 3. Consultar o pagamento no Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const payment = await mpRes.json();

    if (payment.status === 'approved') {
      const customerEmail = payment.payer?.email?.toLowerCase();
      
      if (customerEmail) {
        console.log(`Pagamento Aprovado para: ${customerEmail}`);

        // 4. ATUALIZAR STATUS DO USUÁRIO NO FIRESTORE
        // Procuramos o usuário na collection 'users'
        // Por simplificação (REST API), buscamos pelo documento se o ID fosse o email, 
        // mas no Firebase os IDs costumam ser UIDs. 
        // Vamos buscar todos os usuários (limitado) e filtrar pelo email
        const usersRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/users");
        const usersData = await usersRes.json();
        
        const userDoc = usersData.documents?.find(doc => {
            return doc.fields?.email?.stringValue?.toLowerCase() === customerEmail;
        });

        if (userDoc) {
            const uid = userDoc.name.split('/').pop();
            // Atualiza status para 'active'
            await fetch(`https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=subscriptionStatus`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: { subscriptionStatus: { stringValue: 'active' } }
                })
            });
            console.log(`Usuário ${customerEmail} ATIVADO automaticamente.`);
        } else {
            // Se o usuário ainda não criou conta, marcamos o LEAD como pago
            // Assim, quando ele criar a conta, o sistema já libera o acesso.
            const leadsRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/leads");
            const leadsData = await leadsRes.json();
            const leadDoc = leadsData.documents?.find(doc => doc.fields?.email?.stringValue?.toLowerCase() === customerEmail);

            if (leadDoc) {
                const leadId = leadDoc.name.split('/').pop();
                await fetch(`https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/leads/${leadId}?updateMask.fieldPaths=status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: { status: { stringValue: 'pago' } }
                    })
                });
                console.log(`Lead ${customerEmail} marcado como PAGO.`);
            }
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error("Webhook Internal Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
