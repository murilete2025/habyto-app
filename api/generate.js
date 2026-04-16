export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userData = req.body;
    let apiKey = process.env.OPENAI_API_KEY;

    // Fallback: Tenta buscar a chave salva no Painel Admin (Firestore)
    if (!apiKey) {
      try {
        const fbRes = await fetch("https://firestore.googleapis.com/v1/projects/app-jejum-emagrecimento/databases/(default)/documents/config/global");
        const fbData = await fbRes.json();
        if (fbData?.fields?.openai_key?.stringValue) {
          apiKey = fbData.fields.openai_key.stringValue;
        }
      } catch (err) {
        console.warn("Falha ao ler chave do Firebase:", err.message);
      }
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave da OpenAI não configurada no Vercel nem no Admin.' });
    }

    const weight = userData.weight || 70;
    const height = userData.height || 170;
    const goalWeight = userData.goalWeight || 60;
    const age = userData.age || 30;
    const gender = userData.gender || 'feminino';
    const body = userData.body || 'não especificado';
    const activityLevel = userData.activityLevel || '1.2';
    const goalType = userData.goalType || 'perda_peso';
    
    const context = userData.context || {};
    const goals = (context.goals || []).join(", ");
    const concerns = (context.concerns || []).join(", ");
    const excluded_foods = (context.foods || []).join(", ");
    const routine = context.routine || 'normal';
    const preferred_meals = context.meals || '3';

    const systemPrompt = `
      Você é um Nutricionista Especialista em Jejum Intermitente e Personal Trainer de alto nível.
      Gere um Plano Semanal Completo (7 dias, de Segunda a Domingo) focado em: ${goalType === 'perda_peso' ? 'Emagrecimento Rápido' : 'Ganho de Massa e Tonificação'}.
      
      Contexto do Cliente:
      - Perfil: ${age} anos, gênero ${gender}, altura ${height}cm.
      - Peso Atual: ${weight}kg. Meta: ${goalWeight}kg.
      - Nível de Atividade: ${activityLevel}.
      - Alimentos a evitar: ${excluded_foods}
      
      Requisitos OBRIGATÓRIOS:
      1. Cardápio: ${preferred_meals} refeições por dia. Cada uma com 3 OPÇÕES.
      2. Treino Personalizado: Crie treinos específicos para o gênero ${gender} e para o objetivo ${goalType}. 
         Se for Ganho de Massa, foque em hipertrofia. Se for Perda de Peso, foque em queima calórica e HIIT.
      3. Lista de Compras: Organizada para a semana.
      4. Formato: JSON rigoroso.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Gere meu plano base." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      return res.status(500).json({ error: 'Erro na resposta da OpenAI', details: data });
    }

    let rawContent = data.choices[0].message.content;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("A IA não retornou um formato JSON válido.");

    const aiContent = JSON.parse(jsonMatch[0]);
    return res.status(200).json(aiContent);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
